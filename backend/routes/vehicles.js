// TrustChain Vehicle Management Routes
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');
const db = require('../database/services');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { sendEmail } = require('./notifications');
const { sendMail } = require('../services/gmailApiService');

/**
 * Safely serialize metadata to avoid circular references and large objects
 */
function createSafeRegistrationMetadata(registrationData, vehicle, owner) {
    try {
        return {
            timestamp: new Date().toISOString(),
            vehicleVin: vehicle?.vin || null,
            vehiclePlateNumber: vehicle?.plateNumber || null,
            vehicleMake: vehicle?.make || null,
            vehicleModel: vehicle?.model || null,
            ownerEmail: owner?.email || null,
            ownerName: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() : null,
            hasDocuments: !!(registrationData?.documents && Object.keys(registrationData.documents).length > 0),
            documentCount: registrationData?.documents ? Object.keys(registrationData.documents).length : 0,
            documentTypes: registrationData?.documents ? Object.keys(registrationData.documents) : []
        };
    } catch (error) {
        console.error('Error creating safe metadata:', error);
        return {
            timestamp: new Date().toISOString(),
            error: 'Failed to serialize metadata'
        };
    }
}

/**
 * Safely serialize blockchain metadata
 */
function createSafeBlockchainMetadata(blockchainResult, txStatus) {
    try {
        return {
            transactionId: blockchainResult?.transactionId || null,
            status: txStatus?.status || null,
            timestamp: new Date().toISOString(),
            success: blockchainResult?.success !== false
        };
    } catch (error) {
        console.error('Error creating safe blockchain metadata:', error);
        return {
            timestamp: new Date().toISOString(),
            error: 'Failed to serialize blockchain metadata'
        };
    }
}

// Get all vehicles (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        console.log('[API /api/vehicles] Request received:', {
            query: req.query,
            user: req.user?.email,
            timestamp: new Date().toISOString()
        });

        const { status, page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let vehicles;
        let totalCount;
        const dbModule = require('../database/db');

        if (status) {
            // Handle comma-separated status values
            const statusValues = status.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
            
            if (statusValues.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status filter'
                });
            }

            console.log('[API /api/vehicles] Filtering by statuses:', statusValues);

            // Build query with IN clause for multiple statuses
            if (statusValues.length === 1) {
                // Single status - use existing function
                vehicles = await db.getVehiclesByStatus(statusValues[0], parseInt(limit), offset);
                const countResult = await dbModule.query(
                    'SELECT COUNT(*) FROM vehicles WHERE status = $1',
                    [statusValues[0]]
                );
                totalCount = parseInt(countResult.rows[0].count);
            } else {
                // Multiple statuses - use IN clause with text casting to avoid enum label errors
                const placeholders = statusValues.map((_, i) => `$${i + 1}`).join(', ');
                const query = `
                    SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
                    FROM vehicles v
                    LEFT JOIN users u ON v.owner_id = u.id
                    WHERE v.status::text IN (${placeholders})
                    ORDER BY COALESCE(v.registration_date, v.last_updated) DESC
                    LIMIT $${statusValues.length + 1} OFFSET $${statusValues.length + 2}
                `;
                const params = [...statusValues, parseInt(limit), offset];
                
                console.log('[API /api/vehicles] Query:', query);
                console.log('[API /api/vehicles] Params:', params);
                
                const result = await dbModule.query(query, params);
                vehicles = result.rows;
                
                // Get total count
                const countQuery = `SELECT COUNT(*) FROM vehicles WHERE status::text IN (${placeholders})`;
                const countResult = await dbModule.query(countQuery, statusValues);
                totalCount = parseInt(countResult.rows[0].count);
            }
        } else {
            vehicles = await db.getAllVehicles(parseInt(limit), offset);
            // Get total count
            const countResult = await dbModule.query('SELECT COUNT(*) FROM vehicles');
            totalCount = parseInt(countResult.rows[0].count);
        }

        // Get verifications and documents for each vehicle (BATCH QUERIES - fixes N+1 problem)
        if (vehicles.length > 0) {
            const vehicleIds = vehicles.map(v => v.id);
            
            // Batch fetch all verifications at once
            const verificationsQuery = `
                SELECT * FROM vehicle_verifications 
                WHERE vehicle_id = ANY($1::uuid[])
                ORDER BY created_at DESC
            `;
            const verificationsResult = await dbModule.query(verificationsQuery, [vehicleIds]);
            
            // Batch fetch all documents at once
            const documentsQuery = `
                SELECT * FROM documents 
                WHERE vehicle_id = ANY($1::uuid[])
                ORDER BY uploaded_at DESC
            `;
            const documentsResult = await dbModule.query(documentsQuery, [vehicleIds]);
            
            // Group verifications and documents by vehicle_id
            const verificationsByVehicle = {};
            verificationsResult.rows.forEach(v => {
                if (!verificationsByVehicle[v.vehicle_id]) {
                    verificationsByVehicle[v.vehicle_id] = [];
                }
                verificationsByVehicle[v.vehicle_id].push(v);
            });
            
            const documentsByVehicle = {};
            documentsResult.rows.forEach(d => {
                if (!documentsByVehicle[d.vehicle_id]) {
                    documentsByVehicle[d.vehicle_id] = [];
                }
                documentsByVehicle[d.vehicle_id].push(d);
            });
            
            // Attach to vehicles
            for (let vehicle of vehicles) {
                vehicle.verifications = verificationsByVehicle[vehicle.id] || [];
                vehicle.documents = documentsByVehicle[vehicle.id] || [];
                
                // Format verification status
                vehicle.verificationStatus = {};
                vehicle.verifications.forEach(v => {
                    vehicle.verificationStatus[v.verification_type] = v.status;
                });
            }
        }

        console.log('[API /api/vehicles] Success:', {
            vehicleCount: vehicles.length,
            totalCount
        });

        res.json({
            success: true,
            vehicles: vehicles.map(v => formatVehicleResponse(v, req, res)),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalVehicles: totalCount,
                hasNext: offset + vehicles.length < totalCount,
                hasPrev: offset > 0
            }
        });

    } catch (error) {
        console.error('[API /api/vehicles] Error:', {
            message: error.message,
            stack: error.stack,
            query: req.query
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get vehicles by current user (convenience endpoint) - MUST come before /:vin route
router.get('/my-vehicles', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const vehicles = await db.getVehiclesByOwner(userId);

        // Get related data for each vehicle
        for (let vehicle of vehicles) {
            vehicle.verifications = await db.getVehicleVerifications(vehicle.id);
            vehicle.documents = await db.getDocumentsByVehicle(vehicle.id);
            
            // Format verification status
            vehicle.verificationStatus = {};
            vehicle.verifications.forEach(v => {
                vehicle.verificationStatus[v.verification_type] = v.status;
            });
        }

        res.json({
            success: true,
            vehicles: vehicles.map(v => formatVehicleResponse(v, req, res)),
            count: vehicles.length
        });

    } catch (error) {
        console.error('Get my vehicles error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicles by owner (for vehicle owners to see their own vehicles)
router.get('/owner/:ownerId', authenticateToken, async (req, res) => {
    try {
        const { ownerId } = req.params;
        const userId = req.user.userId;

        // Check if user is requesting their own vehicles or is admin
        if (req.user.role !== 'admin' && String(userId) !== String(ownerId)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const vehicles = await db.getVehiclesByOwner(ownerId);

        // Get related data for each vehicle
        for (let vehicle of vehicles) {
            vehicle.verifications = await db.getVehicleVerifications(vehicle.id);
            vehicle.documents = await db.getDocumentsByVehicle(vehicle.id);
            
            // Format verification status
            vehicle.verificationStatus = {};
            vehicle.verifications.forEach(v => {
                vehicle.verificationStatus[v.verification_type] = v.status;
            });
        }

        res.json({
            success: true,
            vehicles: vehicles.map(v => formatVehicleResponse(v, req, res)),
            count: vehicles.length
        });

    } catch (error) {
        console.error('Get vehicles by owner error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle by ID (for admin/owner viewing by UUID)
// GET /api/vehicles/:id/transaction-id - Get blockchain transaction ID for vehicle
router.get('/:id/transaction-id', optionalAuth, async (req, res) => {
    try {
        const vehicleId = req.params.id;
        
        // Get vehicle to verify it exists
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }
        
        // Get latest blockchain transaction ID from vehicle history
        const history = await db.getVehicleHistory(vehicleId, 50);
        
        // Find the most recent transaction with a transaction_id
        let transactionId = null;
        let transactionSource = null;
        
        // Priority 1: BLOCKCHAIN_REGISTERED action (from initial registration or LTO approval)
        const blockchainRegistered = history.find(h => 
            h.action === 'BLOCKCHAIN_REGISTERED' && h.transaction_id
        );
        if (blockchainRegistered) {
            transactionId = blockchainRegistered.transaction_id;
            transactionSource = 'BLOCKCHAIN_REGISTERED';
            console.log(`✅ Found transaction ID from BLOCKCHAIN_REGISTERED: ${transactionId}`);
        }
        
        // Priority 2: CLEARANCE_APPROVED action (LTO approval with blockchain - for backward compatibility)
        if (!transactionId) {
            const clearanceApproved = history.find(h => 
                h.action === 'CLEARANCE_APPROVED' && h.transaction_id && !h.transaction_id.includes('-')
            );
            if (clearanceApproved) {
                transactionId = clearanceApproved.transaction_id;
                transactionSource = 'CLEARANCE_APPROVED';
                console.log(`✅ Found transaction ID from CLEARANCE_APPROVED: ${transactionId}`);
                
                // Backfill: Create BLOCKCHAIN_REGISTERED entry for future lookups
                try {
                    const dbServices = require('../database/services');
                    await dbServices.addVehicleHistory({
                        vehicleId: vehicleId,
                        action: 'BLOCKCHAIN_REGISTERED',
                        description: 'Transaction ID recovered from CLEARANCE_APPROVED history',
                        performedBy: null,
                        transactionId: transactionId,
                        metadata: JSON.stringify({ 
                            recovered: true, 
                            source: 'clearance_approved_backfill',
                            recoveredAt: new Date().toISOString()
                        })
                    });
                    console.log(`✅ Backfilled BLOCKCHAIN_REGISTERED entry for vehicle ${vehicleId}`);
                } catch (backfillError) {
                    console.warn('⚠️ Could not backfill BLOCKCHAIN_REGISTERED entry:', backfillError.message);
                }
            }
        }
        
        // Priority 3: Any history entry with valid transaction_id (non-UUID)
        if (!transactionId) {
            const anyTx = history.find(h => h.transaction_id && !h.transaction_id.includes('-'));
            if (anyTx) {
                transactionId = anyTx.transaction_id;
                transactionSource = anyTx.action;
                console.log(`✅ Found transaction ID from ${anyTx.action}: ${transactionId}`);
            }
        }
        
        // Priority 4: For REGISTERED/APPROVED vehicles, query Fabric directly
        if (!transactionId && ['REGISTERED', 'APPROVED'].includes(vehicle.status)) {
            try {
                const fabricService = require('../services/optimizedFabricService');
                
                // Ensure we're using real Fabric, not mock
                if (fabricService.mode !== 'fabric') {
                    console.error('❌ Mock blockchain service detected - real Fabric required');
                    return res.status(503).json({
                        success: false,
                        error: 'Blockchain service unavailable',
                        message: 'Real Hyperledger Fabric connection required'
                    });
                }
                
                // Query Fabric by VIN
                const blockchainResult = await fabricService.getVehicle(vehicle.vin);
                if (blockchainResult && blockchainResult.success && blockchainResult.vehicle) {
                    // Try to get transaction ID from vehicle data
                    // Chaincode may store it in different fields
                    const fabricVehicle = blockchainResult.vehicle;
                    transactionId = fabricVehicle.lastTxId || 
                                   fabricVehicle.transactionId || 
                                   fabricVehicle.blockchainTxId ||
                                   null;
                    
                    // If we found a transaction ID, backfill to vehicle_history
                    if (transactionId) {
                        const dbServices = require('../database/services');
                        await dbServices.addVehicleHistory({
                            vehicleId: vehicleId,
                            action: 'BLOCKCHAIN_REGISTERED',
                            description: 'Transaction ID recovered from blockchain ledger',
                            performedBy: null,
                            transactionId: transactionId,
                            metadata: JSON.stringify({ 
                                recovered: true, 
                                source: 'fabric_ledger_query', 
                                vin: vehicle.vin,
                                recoveredAt: new Date().toISOString()
                            })
                        });
                        console.log(`✅ Recovered and backfilled transaction ID for ${vehicle.vin}: ${transactionId}`);
                    }
                }
            } catch (fabricError) {
                console.warn('⚠️ Could not query blockchain for transaction ID:', fabricError.message);
                // Don't fallback - if Fabric fails, report the actual status
            }
        }
        
        // Return result based on what we found
        if (transactionId) {
            return res.json({
                success: true,
                transactionId: transactionId,
                source: 'blockchain',
                vehicleStatus: vehicle.status,
                isPending: false
            });
        }
        
        // Determine if vehicle is actually pending
        const isPending = ['SUBMITTED', 'PENDING_BLOCKCHAIN', 'PROCESSING'].includes(vehicle.status);
        
        if (isPending) {
            // Vehicle is genuinely pending - this is expected
            return res.json({
                success: true,
                transactionId: null,
                source: 'pending',
                vehicleStatus: vehicle.status,
                isPending: true,
                message: 'Vehicle registration is being processed on the blockchain'
            });
        }
        
        // Vehicle is REGISTERED/APPROVED but no transaction ID found - this is an error state
        // Per Chapter 2 requirements: "all registrations are recorded on blockchain IMMEDIATELY"
        console.error(`❌ Data integrity issue: Vehicle ${vehicle.vin} is ${vehicle.status} but has no blockchain transaction ID`);
        return res.status(500).json({
            success: false,
            error: 'Blockchain record not found',
            message: 'This vehicle is marked as registered but the blockchain transaction ID is missing. Please contact LTO support.',
            vehicleStatus: vehicle.status,
            vin: vehicle.vin
        });
        
    } catch (error) {
        console.error('Error getting vehicle transaction ID:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get transaction ID'
        });
    }
});

// GET /api/vehicles/:id/certificate-data - Get certificate-ready data with transfer info
router.get('/:id/certificate-data', optionalAuth, async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ 
                success: false, 
                error: 'Vehicle not found' 
            });
        }

        // Get owner data
        const owner = vehicle.owner_id ? await db.getUserById(vehicle.owner_id) : null;
        
        // Get transfer information if applicable
        let transferInfo = null;
        const originType = vehicle.origin_type || vehicle.originType;
        const transactionType = vehicle.transaction_type;
        
        // Check if this is a transfer (origin_type = 'TRANSFER' or transaction_type contains 'TRANSFER')
        if (originType === 'TRANSFER' || 
            (transactionType && transactionType.toUpperCase().includes('TRANSFER'))) {
            
            const history = await db.getOwnershipHistory(vehicleId);
            const transferRecord = history.find(h => 
                h.action === 'OWNERSHIP_TRANSFERRED' || 
                (h.metadata && h.metadata.previousOwnerName)
            );
            
            if (transferRecord) {
                const metadata = transferRecord.metadata || {};
                transferInfo = {
                    isTransfer: true,
                    previousOwnerName: transferRecord.previousOwnerName || 
                                      metadata.previousOwnerName || null,
                    previousOwnerEmail: transferRecord.previousOwnerEmail || 
                                       metadata.previousOwnerEmail || null,
                    transferDate: transferRecord.transferDate || 
                                 metadata.transferDate || 
                                 transferRecord.timestamp || null,
                    transferReason: transferRecord.transferReason || 
                                   metadata.transferReason || null
                };
            }
        }

        // Format vehicle response
        const formattedVehicle = formatVehicleResponse(vehicle, req, res);
        
        // Format owner response
        const formattedOwner = owner ? {
            id: owner.id,
            firstName: owner.first_name,
            lastName: owner.last_name,
            email: owner.email,
            address: owner.address || owner.full_address,
            phone: owner.phone
        } : null;

        res.json({
            success: true,
            vehicle: formattedVehicle,
            owner: formattedOwner,
            transfer: transferInfo
        });
    } catch (error) {
        console.error('Certificate data error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get vehicle registration progress for timeline
router.get('/:id/progress', authenticateToken, async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const vehicle = await db.getVehicleById(vehicleId);
        
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }
        
        // Check permission
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        // Get vehicle history and verifications
        const history = await db.getVehicleHistory(vehicleId);
        const verifications = await db.getVehicleVerifications(vehicleId);
        
        // Get clearance requests
        const dbModule = require('../database/db');
        const clearanceQuery = await dbModule.query(
            `SELECT * FROM clearance_requests WHERE vehicle_id = $1 ORDER BY created_at DESC`,
            [vehicleId]
        );
        const clearanceRequests = clearanceQuery.rows;
        
        // Build progress object
        const progress = {
            applicationSubmitted: {
                status: vehicle.status !== 'DRAFT' ? 'completed' : 'pending',
                date: vehicle.created_at || null
            },
            hpgClearance: {
                status: 'pending',
                date: null
            },
            insuranceVerification: {
                status: 'pending',
                date: null
            },
            emissionTest: {
                status: 'pending',
                date: null
            },
            ltoInspection: {
                status: 'pending',
                date: null
            },
            blockchainRegistration: {
                status: 'pending',
                date: null
            },
            completed: {
                status: vehicle.status === 'REGISTERED' ? 'completed' : 'pending',
                date: vehicle.status === 'REGISTERED' ? (vehicle.last_updated || vehicle.created_at) : null
            }
        };
        
        // Check HPG clearance
        const hpgClearance = clearanceRequests.find(cr => cr.type === 'hpg');
        if (hpgClearance) {
            if (hpgClearance.status === 'APPROVED') {
                progress.hpgClearance = {
                    status: 'completed',
                    date: hpgClearance.updated_at || hpgClearance.created_at
                };
            } else if (hpgClearance.status === 'PENDING') {
                progress.hpgClearance = {
                    status: 'pending',
                    date: hpgClearance.created_at
                };
            } else if (hpgClearance.status === 'REJECTED') {
                progress.hpgClearance = {
                    status: 'rejected',
                    date: hpgClearance.updated_at
                };
            }
        }
        
        // Check Insurance verification
        const insuranceVerification = verifications.find(v => v.organization_type === 'insurance');
        if (insuranceVerification) {
            if (insuranceVerification.status === 'APPROVED') {
                progress.insuranceVerification = {
                    status: 'completed',
                    date: insuranceVerification.verified_at || insuranceVerification.created_at
                };
            } else if (insuranceVerification.status === 'PENDING') {
                progress.insuranceVerification = {
                    status: 'pending',
                    date: insuranceVerification.created_at
                };
            } else if (insuranceVerification.status === 'REJECTED') {
                progress.insuranceVerification = {
                    status: 'rejected',
                    date: insuranceVerification.verified_at
                };
            }
        }
        
        // Check Emission test
        const emissionVerification = verifications.find(v => v.organization_type === 'emission');
        if (emissionVerification) {
            if (emissionVerification.status === 'APPROVED') {
                progress.emissionTest = {
                    status: 'completed',
                    date: emissionVerification.verified_at || emissionVerification.created_at
                };
            } else if (emissionVerification.status === 'PENDING') {
                progress.emissionTest = {
                    status: 'pending',
                    date: emissionVerification.created_at
                };
            } else if (emissionVerification.status === 'REJECTED') {
                progress.emissionTest = {
                    status: 'rejected',
                    date: emissionVerification.verified_at
                };
            }
        }
        
        // Check LTO Inspection (MVIR)
        const inspectionHistory = history.find(h => h.action === 'INSPECTION_COMPLETED' || h.action === 'MVIR_GENERATED');
        if (inspectionHistory) {
            progress.ltoInspection = {
                status: 'completed',
                date: inspectionHistory.performed_at
            };
        } else if (vehicle.mvir_number && vehicle.mvir_number !== 'PENDING') {
            progress.ltoInspection = {
                status: 'completed',
                date: vehicle.inspection_date || vehicle.last_updated
            };
        }
        
        // Check Blockchain Registration
        const blockchainHistory = history.find(h => 
            h.action === 'BLOCKCHAIN_REGISTERED' && h.transaction_id && !h.transaction_id.includes('-')
        );
        if (blockchainHistory) {
            progress.blockchainRegistration = {
                status: 'completed',
                date: blockchainHistory.performed_at
            };
        } else if (vehicle.status === 'REGISTERED') {
            // Vehicle is registered but blockchain entry might be missing
            progress.blockchainRegistration = {
                status: 'pending',
                date: null
            };
        }
        
        res.json({
            success: true,
            progress,
            vehicle: formatVehicleResponse(vehicle, req, res)
        });
        
    } catch (error) {
        console.error('Error getting vehicle progress:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get progress'
        });
    }
});

router.get('/id/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const vehicle = await db.getVehicleById(id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to view this vehicle
        // Allow: admins, vehicle owners, and verifiers (for verification purposes)
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier' || req.user.role === 'hpg_admin';
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Vehicle view permission check:', {
                userRole: req.user.role,
                userId: req.user.userId,
                vehicleOwnerId: vehicle.owner_id,
                isAdmin,
                isOwner,
                isVerifier
            });
        }
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: `You do not have permission to view this vehicle. Required: admin, owner, or verifier. Your role: ${req.user.role || 'none'}`
            });
        }

        // Get related data
        vehicle.verifications = await db.getVehicleVerifications(vehicle.id);
        vehicle.documents = await db.getDocumentsByVehicle(vehicle.id);
        vehicle.history = await db.getVehicleHistory(vehicle.id);
        
        // Generate QR code server-side
        vehicle.qr_code_base64 = await generateVehicleQRCode(vehicle);

        res.json({
            success: true,
            vehicle: formatVehicleResponse(vehicle, req, res)
        });

    } catch (error) {
        console.error('Get vehicle by ID error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle by VIN - MUST come after specific routes like /my-vehicles and /id/:id
router.get('/:vin', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const vehicle = await db.getVehicleByVin(vin);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to view this vehicle
        // Allow: admins, vehicle owners, and verifiers (for verification purposes)
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier';
        
        // Debug logging (temporary)
        if (process.env.NODE_ENV === 'development') {
            console.log('Permission check:', {
                userRole: req.user.role,
                userId: req.user.userId,
                vehicleOwnerId: vehicle.owner_id,
                ownerIdType: typeof vehicle.owner_id,
                userIdType: typeof req.user.userId,
                isEqual: String(vehicle.owner_id) === String(req.user.userId),
                isAdmin,
                isOwner,
                isVerifier
            });
        }
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get related data
        vehicle.verifications = await db.getVehicleVerifications(vehicle.id);
        vehicle.documents = await db.getDocumentsByVehicle(vehicle.id);
        vehicle.history = await db.getVehicleHistory(vehicle.id);

        res.json({
            success: true,
            vehicle: formatVehicleResponse(vehicle, req, res)
        });

    } catch (error) {
        console.error('Get vehicle error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle by plate number
router.get('/plate/:plateNumber', authenticateToken, async (req, res) => {
    try {
        const { plateNumber } = req.params;
        const dbModule = require('../database/db');
        const result = await dbModule.query(
            `SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
             FROM vehicles v
             LEFT JOIN users u ON v.owner_id = u.id
             WHERE v.plate_number = $1`,
            [plateNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        const vehicle = result.rows[0];

        // Check if user has permission to view this vehicle
        if (req.user.role !== 'admin' && vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get related data
        vehicle.verifications = await db.getVehicleVerifications(vehicle.id);
        vehicle.documents = await db.getDocumentsByVehicle(vehicle.id);

        res.json({
            success: true,
            vehicle: formatVehicleResponse(vehicle, req, res)
        });

    } catch (error) {
        console.error('Get vehicle by plate error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicles by owner
router.get('/owner/:ownerId', authenticateToken, async (req, res) => {
    try {
        const { ownerId } = req.params;

        // Check if user has permission to view these vehicles
        if (req.user.role !== 'admin' && req.user.userId !== ownerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const vehicles = await db.getVehiclesByOwner(ownerId);

        // Get verifications for each vehicle
        for (let vehicle of vehicles) {
            vehicle.verifications = await db.getVehicleVerifications(vehicle.id);
        }

        res.json({
            success: true,
            vehicles: vehicles.map(v => formatVehicleResponse(v, req, res)),
            count: vehicles.length
        });

    } catch (error) {
        console.error('Get vehicles by owner error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Register new vehicle (new endpoint for registration wizard)
// Authentication is optional - if user is logged in, use their account; otherwise find/create by email
router.post('/register', optionalAuth, async (req, res) => {
    try {
        const registrationData = req.body;
        
        // Validate required fields
        if (!registrationData.vehicle || !registrationData.owner) {
            return res.status(400).json({
                success: false,
                error: 'Missing required vehicle or owner information'
            });
        }
        
        const { vehicle, owner } = registrationData;
        
        if (!vehicle.vin || !vehicle.plateNumber || !vehicle.make || !vehicle.model) {
            return res.status(400).json({
                success: false,
                error: 'Missing required vehicle information (VIN, plate number, make, model)'
            });
        }
        
        if (!owner.firstName || !owner.lastName || !owner.email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required owner information (name, email)'
            });
        }
        
        // Check if vehicle already exists
        const existingVehicle = await db.getVehicleByVin(vehicle.vin);
        if (existingVehicle) {
            return res.status(409).json({
                success: false,
                error: 'Vehicle with this VIN already exists'
            });
        }

        // Determine owner user - prioritize logged-in user
        let ownerUser = null;
        
        // If user is authenticated, use their account
        if (req.user && req.user.userId) {
            ownerUser = await db.getUserById(req.user.userId);
            
            // Verify email matches (for security)
            if (ownerUser && ownerUser.email.toLowerCase() !== owner.email.toLowerCase()) {
                // Email mismatch - log warning but allow if user is logged in
                console.warn(`⚠️ Email mismatch: logged-in user (${ownerUser.email}) vs registration email (${owner.email}). Using logged-in user account.`);
            }
            
            // Update user info if provided and different
            if (ownerUser && (
                ownerUser.first_name !== owner.firstName ||
                ownerUser.last_name !== owner.lastName ||
                (owner.phone && ownerUser.phone !== owner.phone) ||
                (owner.address && ownerUser.address !== owner.address)
            )) {
                // Update user details
                const dbModule = require('../database/db');
                await dbModule.query(
                    `UPDATE users 
                     SET first_name = $1, last_name = $2, phone = COALESCE($3, phone), address = COALESCE($4, address), updated_at = CURRENT_TIMESTAMP
                     WHERE id = $5`,
                    [owner.firstName, owner.lastName, owner.phone || null, owner.address || null, ownerUser.id]
                );
                // Refresh user data
                ownerUser = await db.getUserById(req.user.userId);
            }
        }
        
        // If no logged-in user or user not found, find or create by email
        if (!ownerUser) {
            ownerUser = await db.getUserByEmail(owner.email);
            
            if (!ownerUser) {
                // Create new owner user (only if not logged in)
                const bcrypt = require('bcryptjs');
                const passwordHash = await bcrypt.hash('temp_password_' + Date.now(), 12);
                ownerUser = await db.createUser({
                    email: owner.email,
                    passwordHash,
                    firstName: owner.firstName,
                    lastName: owner.lastName,
                    role: 'vehicle_owner',
                    organization: 'Individual',
                    phone: owner.phone,
                    address: owner.address
                });
                console.log(`✅ Created new user account for vehicle owner: ${owner.email}`);
            } else {
                // User exists - update info if needed
                const dbModule = require('../database/db');
                await dbModule.query(
                    `UPDATE users 
                     SET first_name = $1, last_name = $2, phone = COALESCE($3, phone), address = COALESCE($4, address), updated_at = CURRENT_TIMESTAMP
                     WHERE id = $5`,
                    [owner.firstName, owner.lastName, owner.phone || null, owner.address || null, ownerUser.id]
                );
                // Refresh user data
                ownerUser = await db.getUserById(ownerUser.id);
            }
        }
        
        // Ensure we have a valid owner user
        if (!ownerUser || !ownerUser.id) {
            return res.status(500).json({
                success: false,
                error: 'Failed to determine or create owner account'
            });
        }
        
        // Validate new LTO required fields
        if (!vehicle.vehicleCategory || !vehicle.passengerCapacity || !vehicle.grossVehicleWeight || !vehicle.netWeight) {
            return res.status(400).json({
                success: false,
                error: 'Missing required LTO fields: vehicleCategory, passengerCapacity, grossVehicleWeight, netWeight'
            });
        }
        
        // Validate net weight is less than GVW
        if (parseFloat(vehicle.netWeight) >= parseFloat(vehicle.grossVehicleWeight)) {
            return res.status(400).json({
                success: false,
                error: 'Net weight must be less than Gross Vehicle Weight'
            });
        }
        
        // Validate vehicle category (PNS code)
        const validCategories = ['L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4'];
        if (!validCategories.includes(vehicle.vehicleCategory)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid vehicle category. Must be a valid PNS code (L1-L5, M1-M3, N1-N3, O1-O4)'
            });
        }
        
        // Validate classification
        const validClassifications = ['Private', 'For Hire', 'Government', 'Exempt'];
        if (vehicle.classification && !validClassifications.includes(vehicle.classification)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid classification. Must be one of: Private, For Hire, Government, Exempt'
            });
        }

        // Create vehicle in database
        const newVehicle = await db.createVehicle({
            vin: vehicle.vin,
            plateNumber: vehicle.plateNumber,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            engineNumber: vehicle.engineNumber,
            chassisNumber: vehicle.chassisNumber,
            vehicleType: vehicle.vehicleType || 'Car',
            vehicleCategory: vehicle.vehicleCategory,
            passengerCapacity: parseInt(vehicle.passengerCapacity),
            grossVehicleWeight: parseFloat(vehicle.grossVehicleWeight),
            netWeight: parseFloat(vehicle.netWeight),
            classification: vehicle.classification || 'Private',
            ownerId: ownerUser.id,
            status: 'SUBMITTED',
            notes: registrationData.notes,
            originType: 'NEW_REG'
        });

        // Validate vehicle was created successfully
        if (!newVehicle || !newVehicle.id) {
            console.error('❌ Vehicle creation failed: newVehicle is missing or invalid');
            return res.status(500).json({
                success: false,
                error: 'Failed to create vehicle record'
            });
        }

        // Add to history with safe metadata
        try {
            const safeMetadata = createSafeRegistrationMetadata(registrationData, vehicle, owner);
            await db.addVehicleHistory({
                vehicleId: newVehicle.id,
                action: 'REGISTERED',
                description: 'Vehicle registration submitted',
                performedBy: ownerUser.id,
                transactionId: null,
                metadata: safeMetadata
            });
        } catch (historyError) {
            console.error('❌ Failed to add vehicle history:', historyError);
            // Don't fail registration if history fails - log and continue
        }
        
        // Link uploaded documents to vehicle and collect CIDs for blockchain
        const documentCids = {};
        if (registrationData.documents && typeof registrationData.documents === 'object') {
            // Use documentTypes config to map frontend keys to database types
            const docTypes = require('../config/documentTypes');
            
            // Process all documents from registrationData
            // Note: ownerUser is already validated at line 971, no need to check again
            for (const [frontendKey, docData] of Object.entries(registrationData.documents)) {
                // Validate docData is an object
                if (!docData || typeof docData !== 'object') {
                    console.warn(`⚠️ Invalid document data for ${frontendKey}, skipping`);
                    continue;
                }
                
                // Map frontend key to logical type, then to database type
                const logicalType = docTypes.mapLegacyType(frontendKey);
                const dbDocType = docTypes.mapToDbType(logicalType);
                
                // Validate mapping results
                if (!logicalType || !dbDocType) {
                    console.error(`❌ Unknown document type key: ${frontendKey} (mapped to: ${logicalType}, dbType: ${dbDocType})`);
                    // Don't fail entire registration, but log error for admin review
                    continue;
                }
                
                // Explicitly reject 'other' type
                if (dbDocType === 'other') {
                    console.error(`❌ Document type mapped to 'other' for key: ${frontendKey}. This indicates a configuration error.`);
                    // Log but continue - document exists, just wrong type
                    // Admin will need to correct via admin interface
                    continue;
                }
                
                // Validate logicalType is a valid logical type before using as key
                if (!docTypes.isValidLogicalType(logicalType)) {
                    console.warn(`⚠️ Invalid logical type for ${frontendKey}: ${logicalType}, skipping`);
                    continue;
                }
                
                try {
                    let documentRecord = null;
                    const dbModule = require('../database/db');
                    
                    // Method 1: If document ID is provided (from upload response), update directly
                    if (docData.id && typeof docData.id === 'string' && !docData.id.toString().startsWith('TEMP_')) {
                        try {
                            const docByIdResult = await dbModule.query(
                                'SELECT * FROM documents WHERE id = $1',
                                [docData.id]
                            );
                            if (docByIdResult.rows && docByIdResult.rows.length > 0) {
                                documentRecord = docByIdResult.rows[0];
                                // Update to link to vehicle
                                await dbModule.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4',
                                    [newVehicle.id, dbDocType, ownerUser.id, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${frontendKey} by ID: ${documentRecord.id}`);
                            }
                        } catch (queryError) {
                            console.error(`❌ Error querying document by ID ${docData.id}:`, queryError.message);
                            // Continue to next method
                        }
                    }
                    
                    // Method 2: If not found by ID, try filename or CID (for unlinked documents)
                    if (!documentRecord && (docData.filename || docData.cid)) {
                        try {
                            const docResult = await dbModule.query(
                                'SELECT * FROM documents WHERE (filename = $1 OR ipfs_cid = $2) AND (vehicle_id IS NULL OR vehicle_id = $3) LIMIT 1',
                                [docData.filename || null, docData.cid || null, newVehicle.id]
                            );
                            if (docResult.rows && docResult.rows.length > 0) {
                                documentRecord = docResult.rows[0];
                                // Update to link to vehicle
                                await dbModule.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4',
                                    [newVehicle.id, dbDocType, ownerUser.id, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${frontendKey} by filename/CID: ${documentRecord.id}`);
                            }
                        } catch (queryError) {
                            console.error(`❌ Error querying document by filename/CID:`, queryError.message);
                            // Continue to next method
                        }
                    }
                    
                    // Method 3: Try to find any unlinked document for this owner (fallback)
                    if (!documentRecord && ownerUser.id) {
                        try {
                            // Look for recent unlinked documents uploaded by this owner (within last hour)
                            const recentUnlinkedResult = await dbModule.query(
                                `SELECT * FROM documents 
                                 WHERE vehicle_id IS NULL 
                                 AND uploaded_by = $1 
                                 AND document_type = $2
                                 AND uploaded_at > NOW() - INTERVAL '1 hour'
                                 ORDER BY uploaded_at DESC 
                                 LIMIT 1`,
                                [ownerUser.id, dbDocType]
                            );
                            if (recentUnlinkedResult.rows && recentUnlinkedResult.rows.length > 0) {
                                documentRecord = recentUnlinkedResult.rows[0];
                                // Update to link to vehicle
                                await dbModule.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2 WHERE id = $3',
                                    [newVehicle.id, dbDocType, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${frontendKey} by recent unlinked document: ${documentRecord.id}`);
                            }
                        } catch (queryError) {
                            console.error(`❌ Error querying recent unlinked documents:`, queryError.message);
                            // Continue to next method
                        }
                    }
                    
                    // Method 4: Create new document record if not found (with minimal data)
                    if (!documentRecord) {
                        // Only create if we have at least a filename or CID
                        if (docData.filename || docData.cid) {
                            try {
                                documentRecord = await db.createDocument({
                                    vehicleId: newVehicle.id,
                                    documentType: dbDocType,
                                    filename: docData.filename || `unknown_${frontendKey}_${Date.now()}`,
                                    originalName: docData.filename || `unknown_${frontendKey}`,
                                    filePath: docData.url || `/uploads/${docData.filename || 'unknown'}`,
                                    fileSize: 0, // Size not available from upload
                                    mimeType: docData.mimeType || 'application/pdf', // Use provided mimeType or default
                                    fileHash: null,
                                    uploadedBy: ownerUser.id, // Set owner as uploader
                                    ipfsCid: docData.cid || null
                                });
                                console.log(`✅ Created new document record for ${frontendKey}: ${documentRecord.id}`);
                            } catch (createError) {
                                console.error(`❌ Error creating document record for ${frontendKey}:`, createError.message);
                                // Continue without this document
                            }
                        } else {
                            console.warn(`⚠️ Cannot link ${frontendKey} document: No ID, filename, CID, or unlinked document found`);
                        }
                    }
                    
                    // Collect CID for blockchain (only if we have a valid document record with CID and valid logicalType)
                    if (documentRecord && (documentRecord.ipfs_cid || docData.cid) && logicalType && docTypes.isValidLogicalType(logicalType)) {
                        try {
                            documentCids[logicalType] = {
                                cid: documentRecord.ipfs_cid || docData.cid,
                                filename: documentRecord.filename || docData.filename || frontendKey,
                                documentType: dbDocType
                            };
                            console.log(`✅ Collected CID for blockchain: ${logicalType} = ${documentCids[logicalType].cid}`);
                        } catch (cidError) {
                            console.error(`❌ Error collecting CID for ${frontendKey}:`, cidError.message);
                        }
                    } else {
                        if (!documentRecord) {
                            console.warn(`⚠️ No document record found for ${frontendKey} - will not be included in blockchain registration`);
                        } else if (!documentRecord.ipfs_cid && !docData.cid) {
                            console.warn(`⚠️ No CID available for ${frontendKey} document - will not be included in blockchain registration`);
                        } else if (!logicalType || !docTypes.isValidLogicalType(logicalType)) {
                            console.warn(`⚠️ Invalid logical type ${logicalType} for ${frontendKey} - will not be included in blockchain registration`);
                        }
                    }
                } catch (docError) {
                    console.error(`❌ Error linking ${frontendKey} document:`, docError);
                    console.error(`   Error message:`, docError.message);
                    console.error(`   Error stack:`, docError.stack);
                    console.error(`   Document data:`, docData);
                    // Continue even if document linking fails - vehicle registration can proceed without documents
                }
            }
        } else {
            console.warn('⚠️ No documents provided in registration data - vehicle will be registered without documents');
        }
        
        // Log document linking summary
        const linkedCount = Object.keys(documentCids).length;
        console.log(`📄 Document linking summary: ${linkedCount} document(s) linked with CIDs for blockchain registration`);
        console.log(`📄 Document linking complete: ${linkedCount} documents linked, proceeding to auto-send`);
        
        // Register on blockchain
        let blockchainTxId = null;
        let blockchainStatus = 'PENDING';
        try {
            // Set status to PENDING_BLOCKCHAIN while registration is in progress
            await db.updateVehicle(newVehicle.id, { status: 'PENDING_BLOCKCHAIN' });
            
            // Prepare blockchain registration data with proper owner object and document CIDs
            const blockchainData = {
                vin: vehicle.vin,
                plateNumber: vehicle.plateNumber,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
                engineNumber: vehicle.engineNumber,
                chassisNumber: vehicle.chassisNumber,
                vehicleType: vehicle.vehicleType || 'PASSENGER',
                fuelType: vehicle.fuelType || 'GASOLINE',
                transmission: vehicle.transmission || 'AUTOMATIC',
                engineDisplacement: vehicle.engineDisplacement,
                // Send owner as object (not just ID) to match chaincode expectations
                owner: {
                    id: ownerUser.id,
                    email: ownerUser.email,
                    firstName: ownerUser.first_name || owner.firstName,
                    lastName: ownerUser.last_name || owner.lastName
                },
                // Include document CIDs for blockchain storage
                documents: documentCids
            };
            
            const blockchainResult = await fabricService.registerVehicle(blockchainData);
            blockchainTxId = blockchainResult.transactionId;
            
            // Poll for transaction status to confirm it's committed
            if (blockchainTxId && fabricService.mode === 'fabric') {
                try {
                    const txStatus = await fabricService.getTransactionStatus(blockchainTxId, vehicle.vin);
                    blockchainStatus = txStatus.status;
                    
                    if (txStatus.status === 'committed') {
                        // Change status back to SUBMITTED - admin needs to approve before REGISTERED
                        // Blockchain registration is just for audit trail
                        // Status will change to REGISTERED when admin approves via /api/lto/approve-clearance
                        await db.updateVehicle(newVehicle.id, { status: 'SUBMITTED' });
                        
                        // Add blockchain history
                        await db.addVehicleHistory({
                            vehicleId: newVehicle.id,
                            action: 'BLOCKCHAIN_REGISTERED',
                            description: 'Vehicle registered on blockchain (awaiting admin approval)',
                            performedBy: ownerUser.id,
                            transactionId: blockchainTxId,
                            metadata: createSafeBlockchainMetadata(blockchainResult, txStatus)
                        });
                    } else {
                        // Transaction pending, keep PENDING_BLOCKCHAIN status
                        await db.addVehicleHistory({
                            vehicleId: newVehicle.id,
                            action: 'BLOCKCHAIN_PENDING',
                            description: `Vehicle registration submitted to blockchain (status: ${txStatus.status})`,
                            performedBy: ownerUser.id,
                            transactionId: blockchainTxId,
                            metadata: createSafeBlockchainMetadata(blockchainResult, txStatus)
                        });
                    }
                } catch (pollError) {
                    console.warn('⚠️ Transaction status polling failed, assuming committed:', pollError.message);
                    // Assume committed if polling fails, change status back to SUBMITTED
                    // Admin will approve later via /api/lto/approve-clearance
                    await db.updateVehicle(newVehicle.id, { status: 'SUBMITTED' });
                    await db.addVehicleHistory({
                        vehicleId: newVehicle.id,
                        action: 'BLOCKCHAIN_REGISTERED',
                        description: 'Vehicle registered on blockchain (status polling unavailable, awaiting admin approval)',
                        performedBy: ownerUser.id,
                        transactionId: blockchainTxId,
                        metadata: createSafeBlockchainMetadata(blockchainResult, { status: 'unknown', error: pollError.message })
                    });
                }
            } else {
                // No transaction ID - keep SUBMITTED status
                // Blockchain registration failed or not attempted, admin can still review
                await db.addVehicleHistory({
                    vehicleId: newVehicle.id,
                    action: 'REGISTRATION_SUBMITTED',
                    description: 'Vehicle registration submitted (blockchain registration not attempted)',
                    performedBy: ownerUser.id,
                    transactionId: null,
                    metadata: createSafeRegistrationMetadata(registrationData, vehicle, owner)
                });
            }
            
        } catch (blockchainError) {
            console.error('❌ Blockchain registration failed:', blockchainError);
            // Rollback: Delete vehicle record since blockchain registration failed
            try {
                await db.deleteVehicle(newVehicle.id);
            } catch (deleteError) {
                console.error('Failed to rollback vehicle record:', deleteError);
            }
            
            // Return error - no fallback allowed
            return res.status(500).json({
                success: false,
                error: `Vehicle registration failed: Blockchain registration required but failed: ${blockchainError.message}`,
                details: 'System requires real Hyperledger Fabric. Ensure Fabric network is running and properly configured.'
            });
        }

        // Get full vehicle data with error handling
        let fullVehicle;
        try {
            fullVehicle = await db.getVehicleById(newVehicle.id);
            if (!fullVehicle) {
                throw new Error('Vehicle not found after creation');
            }
            
            // Safely get verifications and documents
            try {
                fullVehicle.verifications = await db.getVehicleVerifications(newVehicle.id);
            } catch (verifError) {
                console.error('❌ Failed to get vehicle verifications:', verifError);
                fullVehicle.verifications = [];
            }
            
            try {
                fullVehicle.documents = await db.getDocumentsByVehicle(newVehicle.id);
            } catch (docError) {
                console.error('❌ Failed to get vehicle documents:', docError);
                fullVehicle.documents = [];
            }
        } catch (vehicleError) {
            console.error('❌ Failed to retrieve vehicle data:', vehicleError);
            // Return error - vehicle was created but we can't retrieve it
            return res.status(500).json({
                success: false,
                error: 'Vehicle registration completed but failed to retrieve vehicle data',
                vehicleId: newVehicle.id
            });
        }

        // Send email notification to owner (using Gmail API like transfer of ownership)
        try {
            const ownerName = `${ownerUser.first_name || owner.firstName} ${ownerUser.last_name || owner.lastName}`.trim() || ownerUser.email;
            const subject = 'Vehicle Registration Submitted - TrustChain LTO';
            const registrationUrl = `${process.env.APP_BASE_URL || 'https://ltoblockchain.duckdns.org'}`;
            
            const text = `
Dear ${ownerName},

Your vehicle registration has been successfully submitted to the TrustChain LTO System.

Vehicle Details:
- VIN: ${vehicle.vin}
- Plate Number: ${vehicle.plateNumber}
- Make/Model: ${vehicle.make} ${vehicle.model}
- Year: ${vehicle.year}
- Color: ${vehicle.color}
- Vehicle Type: ${vehicle.vehicleType || 'Passenger Car'}
- Registration Date: ${new Date().toLocaleDateString()}

Your registration is now being processed. You will receive updates on the verification status of your documents.

You can track your registration status by logging into your TrustChain account at ${registrationUrl}.

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
            `.trim();

            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #667eea;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #667eea;
            margin: 0;
            font-size: 24px;
        }
        .content {
            margin-bottom: 30px;
        }
        .vehicle-details {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .vehicle-details p {
            margin: 8px 0;
            font-size: 14px;
        }
        .vehicle-details strong {
            color: #667eea;
        }
        .footer {
            text-align: center;
            color: #666666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #667eea;
            color: #ffffff;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>TrustChain LTO System</h1>
        </div>
        <div class="content">
            <p>Dear ${ownerName},</p>
            <p>Your vehicle registration has been successfully submitted to the TrustChain LTO System.</p>
            
            <div class="vehicle-details">
                <p><strong>VIN:</strong> ${vehicle.vin}</p>
                <p><strong>Plate Number:</strong> ${vehicle.plateNumber}</p>
                <p><strong>Make/Model:</strong> ${vehicle.make} ${vehicle.model}</p>
                <p><strong>Year:</strong> ${vehicle.year}</p>
                <p><strong>Color:</strong> ${vehicle.color}</p>
                <p><strong>Vehicle Type:</strong> ${vehicle.vehicleType || 'Passenger Car'}</p>
                <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>Your registration is now being processed. You will receive updates on the verification status of your documents.</p>
            
            <p style="text-align: center;">
                <a href="${registrationUrl}" class="button">Track Registration Status</a>
            </p>
            
            <p>Thank you for using TrustChain LTO System.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>LTO Lipa City Team</p>
        </div>
    </div>
</body>
</html>
            `.trim();

            await sendMail({ to: ownerUser.email, subject, text, html });
            console.log('✅ Registration confirmation email sent to:', ownerUser.email);
        } catch (emailError) {
            console.error('❌ Failed to send registration email:', emailError);
            // Don't fail the registration if email fails - registration is still successful
            // Email is a notification, not critical to the registration process
        }

        // Automatically send clearance requests to organizations
        let autoSendResults = null;
        try {
            const clearanceService = require('../services/clearanceService');
            const requestedBy = ownerUser.id; // Use owner as requester (system-initiated)
            autoSendResults = await clearanceService.autoSendClearanceRequests(
                newVehicle.id,
                registrationData.documents,
                requestedBy
            );
            console.log('✅ Auto-sent clearance requests:', {
                hpg: autoSendResults.hpg.sent ? 'Yes' : 'No',
                insurance: autoSendResults.insurance.sent ? 'Yes' : 'No',
                emission: autoSendResults.emission.sent ? 'Yes' : 'No'
            });
        } catch (autoSendError) {
            console.error('❌ Failed to auto-send clearance requests:', autoSendError);
            // Don't fail the registration if auto-send fails - admin can manually send later
            // Auto-send is a convenience feature, not critical to registration
        }

        // Prepare auto-verification summary
        const autoVerificationSummary = {};
        if (autoSendResults) {
            if (autoSendResults.insurance.autoVerification) {
                autoVerificationSummary.insurance = {
                    status: autoSendResults.insurance.autoVerification.status,
                    automated: autoSendResults.insurance.autoVerification.automated,
                    score: autoSendResults.insurance.autoVerification.score,
                    confidence: autoSendResults.insurance.autoVerification.confidence,
                    reason: autoSendResults.insurance.autoVerification.reason
                };
            }
            if (autoSendResults.emission.autoVerification) {
                autoVerificationSummary.emission = {
                    status: autoSendResults.emission.autoVerification.status,
                    automated: autoSendResults.emission.autoVerification.automated,
                    score: autoSendResults.emission.autoVerification.score,
                    confidence: autoSendResults.emission.autoVerification.confidence,
                    reason: autoSendResults.emission.autoVerification.reason
                };
            }
            if (autoSendResults.hpg.autoVerification) {
                autoVerificationSummary.hpg = {
                    status: autoSendResults.hpg.autoVerification.status,
                    automated: autoSendResults.hpg.autoVerification.automated,
                    canPreFill: autoSendResults.hpg.autoVerification.canPreFill,
                    extractedData: autoSendResults.hpg.autoVerification.extractedData
                };
            }
        }

        res.json({
            success: true,
            message: 'Vehicle registration submitted successfully',
            vehicle: formatVehicleResponse(fullVehicle, req, res),
            blockchainStatus: blockchainTxId ? 'REGISTERED' : 'PENDING',
            clearanceRequests: autoSendResults ? {
                hpg: autoSendResults.hpg.sent,
                insurance: autoSendResults.insurance.sent,
                emission: autoSendResults.emission.sent
            } : null,
            autoVerification: Object.keys(autoVerificationSummary).length > 0 ? autoVerificationSummary : null
        });
        
    } catch (error) {
        console.error('Vehicle registration error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });
        
        // Provide more detailed error in development
        const isDevelopment = process.env.NODE_ENV !== 'production';
        res.status(500).json({
            success: false,
            error: isDevelopment ? `Internal server error: ${error.message}` : 'Internal server error',
            ...(isDevelopment && { details: error.stack })
        });
    }
});

// Update vehicle status (admin only) - MUST come before /:vin routes
router.put('/id/:id/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        console.log(`[PUT /api/vehicles/id/${id}/status] Updating vehicle status to ${status}`);

        // Validate status
        const validStatuses = ['SUBMITTED', 'APPROVED', 'REJECTED', 'REGISTERED', 'PENDING_BLOCKCHAIN', 'PROCESSING'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        // Find vehicle
        const vehicle = await db.getVehicleById(id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Update vehicle status
        await db.updateVehicle(id, { 
            status: status,
            notes: notes || vehicle.notes || null
        });

        // Add to history
        const historyEntry = await db.addVehicleHistory({
            vehicleId: id,
            action: `STATUS_${status}`,
            description: notes || `Vehicle status changed to ${status} by admin`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { previousStatus: vehicle.status, newStatus: status, notes }
        });

        // Note: If status update triggers blockchain transaction, it will be stored on Fabric automatically
        // No local ledger writes - all blockchain data comes from Fabric

        // Get updated vehicle
        const updatedVehicle = await db.getVehicleById(id);
        updatedVehicle.verifications = await db.getVehicleVerifications(id);
        updatedVehicle.documents = await db.getDocumentsByVehicle(id);
        updatedVehicle.history = await db.getVehicleHistory(id);

        res.json({
            success: true,
            message: 'Vehicle status updated successfully',
            vehicle: formatVehicleResponse(updatedVehicle, req, res)
        });

    } catch (error) {
        console.error('Update vehicle status error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update vehicle verification status
router.put('/:vin/verification', authenticateToken, authorizeRole(['admin', 'insurance_verifier', 'emission_verifier']), async (req, res) => {
    try {
        const { vin } = req.params;
        const { verificationType, status, notes } = req.body;

        // Validate verification type
        const validTypes = ['insurance', 'emission', 'admin'];
        if (!validTypes.includes(verificationType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification type'
            });
        }

        // Validate status
        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        // Check role permissions
        if (req.user.role === 'insurance_verifier' && verificationType !== 'insurance') {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for this verification type'
            });
        }

        if (req.user.role === 'emission_verifier' && verificationType !== 'emission') {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for this verification type'
            });
        }

        // Find vehicle
        const vehicle = await db.getVehicleByVin(vin);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Update verification status in database
        await db.updateVerificationStatus(
            vehicle.id,
            verificationType,
            status,
            req.user.userId,
            notes
        );

        // Sync verification status to blockchain
        let blockchainTxId = null;
        try {
            const fabricService = require('../services/optimizedFabricService');
            const blockchainResult = await fabricService.updateVerificationStatus(
                vin,
                verificationType,
                status,
                notes || ''
            );
            
            if (blockchainResult && blockchainResult.transactionId) {
                blockchainTxId = blockchainResult.transactionId;
                console.log(`✅ Verification status synced to blockchain: ${verificationType} = ${status}`);
            }
        } catch (blockchainError) {
            // Log error but continue - database is source of truth
            console.warn('⚠️ Blockchain sync failed for verification update:', blockchainError.message);
            console.warn('   Database update succeeded, but blockchain update failed');
        }

        // Add to history
        await db.addVehicleHistory({
            vehicleId: vehicle.id,
            action: `${verificationType.toUpperCase()}_${status}`,
            description: notes || `${verificationType} verification ${status.toLowerCase()}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: { verificationType, status, notes, blockchainSynced: !!blockchainTxId }
        });

        // Check if all verifications are complete
        const verifications = await db.getVehicleVerifications(vehicle.id);
        const allApproved = verifications.every(v => v.status === 'APPROVED');
        
        if (allApproved && verifications.length >= 3) {
            await db.updateVehicle(vehicle.id, { status: 'REGISTERED' });
        }

        // Get updated vehicle
        const updatedVehicle = await db.getVehicleById(vehicle.id);
        updatedVehicle.verifications = await db.getVehicleVerifications(vehicle.id);

        res.json({
            success: true,
            message: 'Verification status updated successfully',
            vehicle: formatVehicleResponse(updatedVehicle, req, res)
        });

    } catch (error) {
        console.error('Update verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get owner's ownership history (all vehicles owned by current user)
// MUST come before /:vin/ownership-history to avoid route conflict
router.get('/my-vehicles/ownership-history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }
        
        // Safely get vehicles with error handling
        let vehicles = [];
        try {
            vehicles = await db.getVehiclesByOwner(userId);
        } catch (vehiclesError) {
            console.error('Error getting vehicles by owner:', vehiclesError);
            console.error('Error stack:', vehiclesError.stack);
            // Return empty result instead of 500 error
            return res.json({
                success: true,
                ownershipHistory: []
            });
        }
        
        if (!vehicles || !Array.isArray(vehicles)) {
            console.warn('getVehiclesByOwner returned invalid result:', vehicles);
            return res.json({
                success: true,
                ownershipHistory: []
            });
        }

        const ownershipHistory = [];
        for (const vehicle of vehicles) {
            try {
                // Validate vehicle has required fields
                if (!vehicle || !vehicle.id) {
                    console.warn('Skipping invalid vehicle:', vehicle);
                    continue;
                }
                
                // Safely get ownership history for each vehicle
                const history = await db.getOwnershipHistory(vehicle.id);
                
                // Include complete vehicle information
                ownershipHistory.push({
                    vehicle: {
                        id: vehicle.id,
                        vin: vehicle.vin || null,
                        plateNumber: vehicle.plate_number || null,
                        make: vehicle.make || null,
                        model: vehicle.model || null,
                        year: vehicle.year || null,
                        color: vehicle.color || null,
                        engineNumber: vehicle.engine_number || null,
                        chassisNumber: vehicle.chassis_number || null,
                        vehicleType: vehicle.vehicle_type || null,
                        fuelType: vehicle.fuel_type || null,
                        transmission: vehicle.transmission || null,
                        engineDisplacement: vehicle.engine_displacement || null,
                        status: vehicle.status || null,
                        registrationDate: vehicle.registration_date || null,
                        // Separate OR and CR numbers (new format)
                        orNumber: vehicle.or_number || null,
                        crNumber: vehicle.cr_number || null,
                        orIssuedAt: vehicle.or_issued_at || null,
                        crIssuedAt: vehicle.cr_issued_at || null,
                        // Backward compatibility (deprecated)
                        or_cr_number: vehicle.or_number || vehicle.or_cr_number || null,
                        orCrNumber: vehicle.or_number || vehicle.or_cr_number || null,  // camelCase for frontend compatibility
                        or_cr_issued_at: vehicle.or_issued_at || vehicle.or_cr_issued_at || null,
                        orCrIssuedAt: vehicle.or_issued_at || vehicle.or_cr_issued_at || null,  // camelCase for frontend compatibility
                        // Additional fields
                        dateOfRegistration: vehicle.date_of_registration || vehicle.registration_date || null,
                        netWeight: vehicle.net_weight || null,
                        registrationType: vehicle.registration_type || 'PRIVATE',
                        vehicleClassification: vehicle.vehicle_classification || null
                    },
                    history: Array.isArray(history) ? history : []
                });
            } catch (vehicleError) {
                // Log error for this specific vehicle but continue with others
                console.error(`Error loading history for vehicle ${vehicle?.id} (${vehicle?.vin || 'unknown'}):`, vehicleError);
                console.error('Vehicle error stack:', vehicleError.stack);
                
                // Still include the vehicle with empty history
                ownershipHistory.push({
                    vehicle: {
                        id: vehicle?.id || null,
                        vin: vehicle?.vin || null,
                        plateNumber: vehicle?.plate_number || null,
                        make: vehicle?.make || null,
                        model: vehicle?.model || null,
                        year: vehicle?.year || null,
                        color: vehicle?.color || null,
                        engineNumber: vehicle?.engine_number || null,
                        chassisNumber: vehicle?.chassis_number || null,
                        vehicleType: vehicle?.vehicle_type || null,
                        fuelType: vehicle?.fuel_type || null,
                        transmission: vehicle?.transmission || null,
                        engineDisplacement: vehicle?.engine_displacement || null,
                        status: vehicle?.status || null,
                        registrationDate: vehicle?.registration_date || null
                    },
                    history: []
                });
            }
        }

        res.json({
            success: true,
            ownershipHistory
        });

    } catch (error) {
        console.error('Get my ownership history error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            name: error.name
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get ownership history for a vehicle
router.get('/:vin/ownership-history', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const vehicle = await db.getVehicleByVin(vin);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permissions
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const ownershipHistory = await db.getOwnershipHistory(vehicle.id);

        res.json({
            success: true,
            vehicle: {
                id: vehicle.id,
                vin: vehicle.vin,
                plate_number: vehicle.plate_number,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
                engine_number: vehicle.engine_number,
                chassis_number: vehicle.chassis_number,
                vehicle_type: vehicle.vehicle_type,
                fuel_type: vehicle.fuel_type,
                transmission: vehicle.transmission,
                engine_displacement: vehicle.engine_displacement,
                registration_date: vehicle.registration_date,
                date_of_registration: vehicle.date_of_registration,
                or_number: vehicle.or_number,
                cr_number: vehicle.cr_number,
                or_issued_at: vehicle.or_issued_at,
                cr_issued_at: vehicle.cr_issued_at,
                inspection_date: vehicle.inspection_date,
                inspection_result: vehicle.inspection_result,
                mvir_number: vehicle.mvir_number,
                status: vehicle.status,
                owner_name: vehicle.owner_name || null,
                owner_email: vehicle.owner_email || null
            },
            ownershipHistory
        });

    } catch (error) {
        console.error('Get ownership history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get registration progress for a vehicle
router.get('/:vehicleId/registration-progress', authenticateToken, async (req, res) => {
    try {
        const { vehicleId } = req.params;
        
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permissions
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const progress = await db.getRegistrationProgress(vehicleId);

        res.json({
            success: true,
            vehicleId,
            progress
        });

    } catch (error) {
        console.error('Get registration progress error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle history
router.get('/:vin/history', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const vehicle = await db.getVehicleByVin(vin);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to view this vehicle
        if (req.user.role !== 'admin' && vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const history = await db.getVehicleHistory(vehicle.id);

        res.json({
            success: true,
            history: history.map(h => ({
                action: h.action,
                timestamp: h.performed_at,
                performedBy: h.performed_by,
                performerName: h.performer_name,
                details: h.description,
                transactionId: h.transaction_id,
                metadata: h.metadata ? (typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata) : null
            }))
        });

    } catch (error) {
        console.error('Get vehicle history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Transfer vehicle ownership
router.put('/:vin/transfer', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const { vin } = req.params;
        const { newOwnerId, newOwnerName, transferData } = req.body;

        if (!newOwnerId) {
            return res.status(400).json({
                success: false,
                error: 'New owner ID is required'
            });
        }

        // Find vehicle
        const vehicle = await db.getVehicleByVin(vin);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to transfer this vehicle
        if (req.user.role !== 'admin' && vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Check if all verifications are approved
        const verifications = await db.getVehicleVerifications(vehicle.id);
        const allApproved = verifications.every(v => v.status === 'APPROVED');
        
        if (!allApproved || verifications.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle must be fully verified before ownership transfer'
            });
        }

        // Get new owner
        const newOwner = await db.getUserById(newOwnerId);
        if (!newOwner) {
            return res.status(404).json({
                success: false,
                error: 'New owner not found'
            });
        }

        const previousOwnerId = vehicle.owner_id;

        // Update ownership
        await db.updateVehicle(vehicle.id, { ownerId: newOwnerId });

        // Reset verification status for new owner
        for (let verification of verifications) {
            await db.updateVerificationStatus(
                vehicle.id,
                verification.verification_type,
                'PENDING',
                req.user.userId,
                'Reset for new owner'
            );
        }

        // Add to history
        await db.addVehicleHistory({
            vehicleId: vehicle.id,
            action: 'OWNERSHIP_TRANSFERRED',
            description: `Ownership transferred from ${vehicle.owner_name} to ${newOwner.first_name} ${newOwner.last_name}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { previousOwnerId, newOwnerId, transferData }
        });

        // Get updated vehicle
        const updatedVehicle = await db.getVehicleById(vehicle.id);
        updatedVehicle.verifications = await db.getVehicleVerifications(vehicle.id);

        res.json({
            success: true,
            message: 'Ownership transferred successfully',
            vehicle: formatVehicleResponse(updatedVehicle, req, res)
        });

    } catch (error) {
        console.error('Transfer ownership error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to generate QR code for vehicle
async function generateVehicleQRCode(vehicle) {
    try {
        // CRITICAL: Only use real blockchain transaction IDs, NOT vehicle.id (UUID)
        // QR codes must point to verifiable blockchain transactions
        let transactionId = null;
        
        // Priority 1: Check blockchain_tx_id field (if it's a real transaction ID, not UUID)
        if (vehicle.blockchain_tx_id && 
            !vehicle.blockchain_tx_id.includes('-') && 
            vehicle.blockchain_tx_id.length >= 40) {
            // Valid blockchain transaction ID (no hyphens, long enough)
            transactionId = vehicle.blockchain_tx_id;
        }
        
        // Priority 2: Check history for BLOCKCHAIN_REGISTERED entry
        if (!transactionId && vehicle.history && vehicle.history.length > 0) {
            const blockchainRegistered = vehicle.history.find(h => 
                h.action === 'BLOCKCHAIN_REGISTERED' && 
                h.transaction_id && 
                !h.transaction_id.includes('-') &&
                h.transaction_id.length >= 40
            );
            if (blockchainRegistered) {
                transactionId = blockchainRegistered.transaction_id;
            } else {
                // Priority 3: Any history entry with valid transaction_id (non-UUID)
                const anyTx = vehicle.history.find(h => 
                    h.transaction_id && 
                    !h.transaction_id.includes('-') &&
                    h.transaction_id.length >= 40
                );
                if (anyTx) {
                    transactionId = anyTx.transaction_id;
                }
            }
        }
        
        // If no valid blockchain transaction ID found, return null
        // QR code should only be generated for vehicles with blockchain transactions
        if (!transactionId) {
            console.log(`[QR Code] No blockchain transaction ID found for vehicle ${vehicle.id || vehicle.vin}. QR code not generated.`);
            return null;
        }
        
        // Generate verification URL with certificate view parameter
        const baseUrl = process.env.FRONTEND_URL || process.env.APP_BASE_URL || 'https://ltoblockchain.duckdns.org';
        const verifyUrl = `${baseUrl}/verify/${transactionId}?view=certificate`;
        
        console.log(`[QR Code] Generating QR code for vehicle ${vehicle.id || vehicle.vin} with transaction ID: ${transactionId.substring(0, 20)}...`);
        
        // Generate QR code as base64 data URL
        const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
        });
        
        return qrCodeBase64;
    } catch (error) {
        console.error('Error generating QR code:', error);
        return null; // Return null if generation fails
    }
}

// Helper function to format vehicle response
// Helper function to format documents
function formatDocuments(documents) {
    return (documents || []).map(doc => {
        return {
            id: doc.id,
            vehicleId: doc.vehicle_id || doc.vehicleId,
            documentType: doc.document_type || doc.documentType,
            document_type: doc.document_type || doc.documentType,
            originalName: doc.original_name || doc.originalName,
            original_name: doc.original_name || doc.originalName,
            filename: doc.filename,
            fileSize: doc.file_size || doc.fileSize,
            file_size: doc.file_size || doc.fileSize,
            mimeType: doc.mime_type || doc.mimeType,
            mime_type: doc.mime_type || doc.mimeType,
            fileHash: doc.file_hash || doc.fileHash,
            file_hash: doc.file_hash || doc.fileHash,
            uploadedBy: doc.uploaded_by || doc.uploadedBy,
            uploaded_by: doc.uploaded_by || doc.uploadedBy,
            uploaderName: doc.uploader_name || doc.uploaderName,
            uploadedAt: doc.uploaded_at || doc.uploadedAt,
            uploaded_at: doc.uploaded_at || doc.uploadedAt,
            verified: doc.verified,
            verifiedAt: doc.verified_at || doc.verifiedAt,
            verified_at: doc.verified_at || doc.verifiedAt,
            ipfs_cid: doc.ipfs_cid || doc.cid,
            cid: doc.ipfs_cid || doc.cid,
            url: doc.url || `/uploads/${doc.filename}`,
            file_path: doc.file_path || doc.filePath
        };
    });
}

// Helper function to format owner info
function formatOwnerInfo(vehicle) {
    return {
        id: vehicle.owner_id,
        firstName: vehicle.owner_first_name || (vehicle.owner_name ? vehicle.owner_name.split(' ')[0] : null),
        lastName: vehicle.owner_last_name || (vehicle.owner_name ? vehicle.owner_name.split(' ').slice(1).join(' ') : null),
        name: vehicle.owner_name,
        email: vehicle.owner_email,
        phone: vehicle.owner_phone,
        address: vehicle.owner_address,
        organization: vehicle.owner_organization
    };
}

// Helper function to format verification status
function formatVerificationStatus(vehicle) {
    const verificationStatus = {};
    if (vehicle.verifications) {
        vehicle.verifications.forEach(v => {
            verificationStatus[v.verification_type] = v.status;
        });
    }
    return verificationStatus;
}

// V1 API format (deprecated - includes old fields)
function formatVehicleResponseV1(vehicle) {
    if (!vehicle) return null;

    const baseResponse = {
        id: vehicle.id,
        vin: vehicle.vin,
        plateNumber: vehicle.plate_number,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        engineNumber: vehicle.engine_number,
        chassisNumber: vehicle.chassis_number,
        vehicleType: vehicle.vehicle_type,
        // Deprecated fields (included for backward compatibility)
        fuelType: vehicle.fuel_type || null,
        transmission: vehicle.transmission || null,
        engineDisplacement: vehicle.engine_displacement || null,
        // New LTO fields
        vehicleCategory: vehicle.vehicle_category || null,
        passengerCapacity: vehicle.passenger_capacity || null,
        grossVehicleWeight: vehicle.gross_vehicle_weight || null,
        netWeight: vehicle.net_weight || null,
        classification: vehicle.registration_type || 'Private',
        ownerId: vehicle.owner_id,
        ownerName: vehicle.owner_name || (vehicle.owner_email ? 'Unknown' : null),
        ownerEmail: vehicle.owner_email,
        ownerPhone: vehicle.owner_phone,
        ownerFirstName: vehicle.owner_first_name || (vehicle.owner_name ? vehicle.owner_name.split(' ')[0] : null),
        ownerLastName: vehicle.owner_last_name || (vehicle.owner_name ? vehicle.owner_name.split(' ').slice(1).join(' ') : null),
        ownerAddress: vehicle.owner_address,
        ownerOrganization: vehicle.owner_organization,
        owner: formatOwnerInfo(vehicle),
        status: vehicle.status,
        registrationDate: vehicle.registration_date,
        dateOfRegistration: vehicle.date_of_registration || vehicle.registration_date,
        lastUpdated: vehicle.last_updated,
        orNumber: vehicle.or_number || null,
        crNumber: vehicle.cr_number || null,
        orIssuedAt: vehicle.or_issued_at || null,
        crIssuedAt: vehicle.cr_issued_at || null,
        orCrNumber: vehicle.or_number || vehicle.or_cr_number || vehicle.orCrNumber || null,
        or_cr_number: vehicle.or_number || vehicle.or_cr_number || null,
        orCrIssuedAt: vehicle.or_issued_at || vehicle.or_cr_issued_at || vehicle.orCrIssuedAt || null,
        or_cr_issued_at: vehicle.or_issued_at || vehicle.or_cr_issued_at || null,
        registrationType: vehicle.registration_type || 'PRIVATE',
        vehicleClassification: vehicle.vehicle_classification || null,
        verificationStatus: formatVerificationStatus(vehicle),
        verifications: vehicle.verifications || [],
        documents: formatDocuments(vehicle.documents),
        history: vehicle.history || [],
        notes: vehicle.notes,
        qr_code_base64: vehicle.qr_code_base64 || null
    };
    
    return baseResponse;
}

// V2 API format (LTO-compliant - excludes deprecated fields)
function formatVehicleResponseV2(vehicle) {
    if (!vehicle) return null;

    return {
        id: vehicle.id,
        vin: vehicle.vin,
        plateNumber: vehicle.plate_number,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        engineNumber: vehicle.engine_number,
        chassisNumber: vehicle.chassis_number,
        vehicleType: vehicle.vehicle_type,
        // New LTO required fields
        vehicleCategory: vehicle.vehicle_category,
        passengerCapacity: vehicle.passenger_capacity,
        grossVehicleWeight: vehicle.gross_vehicle_weight,
        netWeight: vehicle.net_weight,
        classification: vehicle.registration_type || 'Private',
        ownerId: vehicle.owner_id,
        ownerName: vehicle.owner_name || (vehicle.owner_email ? 'Unknown' : null),
        ownerEmail: vehicle.owner_email,
        ownerPhone: vehicle.owner_phone,
        ownerFirstName: vehicle.owner_first_name || (vehicle.owner_name ? vehicle.owner_name.split(' ')[0] : null),
        ownerLastName: vehicle.owner_last_name || (vehicle.owner_name ? vehicle.owner_name.split(' ').slice(1).join(' ') : null),
        ownerAddress: vehicle.owner_address,
        ownerOrganization: vehicle.owner_organization,
        owner: formatOwnerInfo(vehicle),
        status: vehicle.status,
        registrationDate: vehicle.registration_date,
        dateOfRegistration: vehicle.date_of_registration || vehicle.registration_date,
        lastUpdated: vehicle.last_updated,
        orNumber: vehicle.or_number || null,
        crNumber: vehicle.cr_number || null,
        orIssuedAt: vehicle.or_issued_at || null,
        crIssuedAt: vehicle.cr_issued_at || null,
        orCrNumber: vehicle.or_number || vehicle.or_cr_number || vehicle.orCrNumber || null,
        or_cr_number: vehicle.or_number || vehicle.or_cr_number || null,
        orCrIssuedAt: vehicle.or_issued_at || vehicle.or_cr_issued_at || vehicle.orCrIssuedAt || null,
        or_cr_issued_at: vehicle.or_issued_at || vehicle.or_cr_issued_at || null,
        vehicleClassification: vehicle.vehicle_classification || null,
        verificationStatus: formatVerificationStatus(vehicle),
        verifications: vehicle.verifications || [],
        documents: formatDocuments(vehicle.documents),
        history: vehicle.history || [],
        notes: vehicle.notes,
        qr_code_base64: vehicle.qr_code_base64 || null
    };
}

// Main format function - checks API version and returns appropriate format
// Also sets deprecation headers for v1 API
function formatVehicleResponse(vehicle, req = null, res = null) {
    if (!vehicle) return null;
    
    // Determine API version from request
    let apiVersion = 'v2'; // Default to v2 (LTO-compliant)
    
    if (req) {
        // Check query parameter
        const versionParam = req.query?.version || req.query?.v;
        // Check header
        const versionHeader = req.headers?.['x-api-version'] || req.headers?.['api-version'];
        // Check Accept header
        const acceptHeader = req.headers?.accept;
        if (acceptHeader && acceptHeader.includes('application/vnd.lto.v1+json')) {
            apiVersion = 'v1';
        } else if (versionParam || versionHeader) {
            apiVersion = (versionParam || versionHeader).toLowerCase();
        }
    }
    
    // Set deprecation headers for v1 API
    if (apiVersion === 'v1' && res) {
        res.set('X-API-Deprecated', 'true');
        res.set('Deprecation', 'true');
        // Set sunset date to 6 months from now
        const sunsetDate = new Date();
        sunsetDate.setMonth(sunsetDate.getMonth() + 6);
        res.set('Sunset', sunsetDate.toUTCString());
        res.set('Link', '</api/v2/vehicles>; rel="successor-version"');
    }
    
    if (apiVersion === 'v1') {
        return formatVehicleResponseV1(vehicle);
    } else {
        return formatVehicleResponseV2(vehicle);
    }
}

module.exports = router;
