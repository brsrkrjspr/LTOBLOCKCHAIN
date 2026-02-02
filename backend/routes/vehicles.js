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
 * Auto-verify CSR and Sales Invoice documents against issued_certificates (mint).
 * Updates document.verified when file_hash matches. No "pending" – unmatched = user submitted.
 * @param {string} vehicleId - Vehicle UUID
 * @param {string|null} verifiedByUserId - User ID to set as verified_by (null for system)
 * @returns {Promise<{ verified: number, alreadyVerified: number, unmatched: number }>}
 */
async function autoVerifyCsrSalesInvoiceForVehicle(vehicleId, verifiedByUserId = null) {
    const certificateBlockchain = require('../services/certificateBlockchainService');
    const documents = await db.getDocumentsByVehicle(vehicleId);
    const csrOrSi = documents.filter(d => {
        const t = (d.document_type || d.documentType || '').toLowerCase();
        return t === 'csr' || t === 'sales_invoice' || t === 'salesinvoice';
    });
    let verified = 0, alreadyVerified = 0, unmatched = 0;
    for (const doc of csrOrSi) {
        if (doc.verified === true) {
            alreadyVerified++;
            continue;
        }
        const fileHash = doc.file_hash || doc.fileHash;
        if (!fileHash) {
            unmatched++;
            continue;
        }
        const certType = (doc.document_type || doc.documentType || '').toLowerCase() === 'salesinvoice' ? 'sales_invoice' : (doc.document_type || doc.documentType || '').toLowerCase();
        try {
            const auth = await certificateBlockchain.checkCertificateAuthenticity(fileHash, vehicleId, certType);
            if (auth && auth.authentic) {
                await db.verifyDocument(doc.id, verifiedByUserId);
                verified++;
            } else {
                unmatched++;
            }
        } catch (err) {
            unmatched++;
        }
    }
    return { verified, alreadyVerified, unmatched };
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
// STRICT: Allow admin, lto_admin for all vehicles; lto_officer for assigned vehicles only
// NOTE: Filtering for lto_officer assigned vehicles should be implemented in the query logic
router.get('/', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
            // STRICT: For lto_officer, filter to show only assigned vehicles
            // NOTE: Assignment mechanism needs to be implemented (e.g., assigned_to field or assignment table)
            // For now, officers can see all vehicles, but this should be restricted to assigned vehicles
            const userRole = req.user.role;
            if (userRole === 'lto_officer') {
                // TODO: Implement assignment filtering when assignment mechanism is added
                // For now, allow officers to see all vehicles (will be restricted later)
                console.log('[API /api/vehicles] lto_officer accessing - assignment filtering not yet implemented');
            }

            vehicles = await db.getAllVehicles(parseInt(limit), offset);
            // Get total count
            const countResult = await dbModule.query('SELECT COUNT(*) FROM vehicles');
            totalCount = parseInt(countResult.rows[0].count);
        }

        const includeHistory = req.query.includeHistory === 'true' || req.query.includeHistory === '1';
        const historyLimitRaw = parseInt(req.query.historyLimit || req.query.history_limit, 10);
        const historyLimit = Number.isFinite(historyLimitRaw)
            ? Math.min(Math.max(historyLimitRaw, 1), 20)
            : 5;

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

            let historyByVehicle = null;
            if (includeHistory) {
                const historyQuery = `
                    SELECT *
                    FROM (
                        SELECT vh.*,
                               u.first_name || ' ' || u.last_name as performer_name,
                               ROW_NUMBER() OVER (PARTITION BY vh.vehicle_id ORDER BY vh.performed_at DESC) AS rn
                        FROM vehicle_history vh
                        LEFT JOIN users u ON vh.performed_by = u.id
                        WHERE vh.vehicle_id = ANY($1::uuid[])
                    ) history
                    WHERE history.rn <= $2
                    ORDER BY history.performed_at DESC
                `;
                const historyResult = await dbModule.query(historyQuery, [vehicleIds, historyLimit]);
                historyByVehicle = {};
                historyResult.rows.forEach(h => {
                    if (!historyByVehicle[h.vehicle_id]) {
                        historyByVehicle[h.vehicle_id] = [];
                    }
                    historyByVehicle[h.vehicle_id].push(h);
                });
            }

            // Attach to vehicles
            for (let vehicle of vehicles) {
                vehicle.verifications = verificationsByVehicle[vehicle.id] || [];
                vehicle.documents = documentsByVehicle[vehicle.id] || [];

                // Format verification status
                vehicle.verificationStatus = {};
                vehicle.verifications.forEach(v => {
                    vehicle.verificationStatus[v.verification_type] = v.status;
                });

                if (includeHistory) {
                    vehicle.history = historyByVehicle?.[vehicle.id] || [];
                }
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

// ============================================================
// GET PRE-MINTED VEHICLES FROM FABRIC (SOURCE OF TRUTH)
// ============================================================
// This endpoint queries Fabric directly for vehicles with PRE_MINTED status
// MUST come before /:vin route to avoid parameter collision
router.get('/pre-minted', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        console.log('[API /api/vehicles/pre-minted] Request received:', {
            user: req.user?.email,
            role: req.user?.role,
            timestamp: new Date().toISOString()
        });

        // Query Fabric directly for pre-minted vehicles
        const result = await fabricService.getPreMintedVehicles();

        if (!result.success) {
            throw new Error('Failed to query Fabric for pre-minted vehicles');
        }

        console.log('[API /api/vehicles/pre-minted] Success:', {
            vehicleCount: result.vehicles.length
        });

        res.json({
            success: true,
            vehicles: result.vehicles,
            count: result.vehicles.length,
            source: 'fabric' // Indicate this is from blockchain, not PostgreSQL cache
        });

    } catch (error) {
        console.error('[API /api/vehicles/pre-minted] Error:', {
            message: error.message,
            stack: error.stack
        });

        // Check if it's a Fabric connection error
        if (error.message.includes('Not connected') || error.message.includes('Fabric')) {
            return res.status(503).json({
                success: false,
                error: 'Blockchain service unavailable',
                message: 'Unable to connect to Fabric network. Please try again later.',
                vehicles: []
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to fetch pre-minted vehicles',
            message: error.message,
            vehicles: []
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

            // Extract rejection reason from verifications if vehicle is rejected
            if (vehicle.status === 'REJECTED') {
                // Check for rejection in verifications
                const rejectedVerification = vehicle.verifications.find(v => v.status === 'REJECTED');
                if (rejectedVerification) {
                    // Try to extract from verification metadata
                    let rejectionReason = rejectedVerification.notes || null;

                    // Check metadata for manual review notes
                    if (rejectedVerification.verification_metadata) {
                        try {
                            const metadata = typeof rejectedVerification.verification_metadata === 'string'
                                ? JSON.parse(rejectedVerification.verification_metadata)
                                : rejectedVerification.verification_metadata;

                            if (metadata.manualReview && metadata.manualReview.manualNotes) {
                                rejectionReason = metadata.manualReview.manualNotes;
                            } else if (metadata.verificationMetadata && metadata.verificationMetadata.reason) {
                                rejectionReason = metadata.verificationMetadata.reason;
                            }
                        } catch (e) {
                            console.warn('Failed to parse verification metadata:', e);
                        }
                    }

                    vehicle.rejectionReason = rejectionReason;
                }
            }
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

        // Priority 4: For REGISTERED vehicles only, query Fabric directly
        // NOTE: APPROVED vehicles are not yet on blockchain (registration happens during approval)
        if (!transactionId && vehicle.status === 'REGISTERED') {
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

                // Initialize with user context for MSP-based filtering
                await fabricService.initialize(req.user ? { role: req.user.role, email: req.user.email } : {});

                // Query Fabric by VIN with user context for filtering
                const blockchainResult = await fabricService.getVehicle(vehicle.vin, req.user ? { role: req.user.role, email: req.user.email } : null);
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
        const isPending = ['SUBMITTED', 'PROCESSING'].includes(vehicle.status);

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

        // Handle APPROVED vehicles (awaiting blockchain registration during approval)
        if (vehicle.status === 'APPROVED') {
            return res.json({
                success: true,
                transactionId: null,
                source: 'awaiting_blockchain',
                vehicleStatus: vehicle.status,
                isPending: false,
                message: 'Vehicle is approved and awaiting blockchain registration during final approval'
            });
        }

        // Vehicle is REGISTERED but no transaction ID found - this is an error state
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
            // LTO inspection is not part of the NEW_REG registration application workflow.
            // It is only relevant for transfer-of-ownership scenarios. For registration
            // progress, we explicitly mark this step as not applicable.
            ltoInspection: {
                status: 'not_applicable',
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

        // NOTE: LTO inspection (MVIR) is intentionally excluded from the registration
        // progress timeline. Inspection/MVIR is handled only for transfer-of-ownership
        // workflows and should not appear as a registration application step.

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
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'hpg_admin';

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

        // Auto-verify CSR/Sales Invoice against mint so no "pending" for these types
        try {
            await autoVerifyCsrSalesInvoiceForVehicle(vehicle.id, req.user && req.user.userId || null);
            vehicle.documents = await db.getDocumentsByVehicle(vehicle.id);
        } catch (avErr) {
            console.warn('Auto-verify CSR/Sales Invoice (get vehicle):', avErr.message);
        }

        // CRITICAL: Verify blockchain transaction ID against Fabric
        // This ensures the transaction ID from PostgreSQL actually exists on Fabric
        await verifyBlockchainTransactionId(vehicle, req.user);

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
        const isVerifier = req.user.role === 'insurance_verifier';

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

        // CRITICAL: Verify blockchain transaction ID against Fabric
        // This ensures the transaction ID from PostgreSQL actually exists on Fabric
        await verifyBlockchainTransactionId(vehicle, req.user);

        // Apply additional filtering based on role (application-level privacy)
        let responseVehicle = vehicle;

        // HPG sees minimal data
        const isHPG = ['hpg_admin', 'hpg_officer'].includes(req.user.role) ||
            (req.user.role === 'admin' && req.user.email?.toLowerCase().includes('hpg'));

        // Insurance sees minimal data
        const isInsurance = ['insurance_verifier', 'insurance_admin'].includes(req.user.role);

        if (isHPG) {
            // Filter documents - only HPG-relevant
            if (responseVehicle.documents) {
                responseVehicle.documents = responseVehicle.documents.filter(d =>
                    ['or_cr', 'hpg_clearance', 'owner_id'].includes(d.document_type)
                );
            }
            // Filter history - only HPG-related actions
            if (responseVehicle.history) {
                responseVehicle.history = responseVehicle.history.filter(h =>
                    h.action?.includes('HPG') || h.action?.includes('VERIFICATION')
                );
            }
            // Remove sensitive owner info (keep only name/email)
            if (responseVehicle.owner) {
                responseVehicle.owner = {
                    name: responseVehicle.owner_name || responseVehicle.owner?.name,
                    email: responseVehicle.owner_email || responseVehicle.owner?.email
                };
            }
        }

        if (isInsurance) {
            // Filter documents - only insurance-relevant
            if (responseVehicle.documents) {
                responseVehicle.documents = responseVehicle.documents.filter(d =>
                    ['insurance_cert', 'or_cr'].includes(d.document_type)
                );
            }
            // Filter history - only insurance-related actions
            if (responseVehicle.history) {
                responseVehicle.history = responseVehicle.history.filter(h =>
                    h.action?.includes('INSURANCE') || h.action?.includes('VERIFICATION')
                );
            }
            // Remove sensitive owner info and engine/chassis (not needed for insurance)
            if (responseVehicle.owner) {
                responseVehicle.owner = {
                    name: responseVehicle.owner_name || responseVehicle.owner?.name,
                    email: responseVehicle.owner_email || responseVehicle.owner?.email
                };
            }
            // Remove engine/chassis numbers (not needed for insurance verification)
            delete responseVehicle.engine_number;
            delete responseVehicle.chassis_number;
        }

        res.json({
            success: true,
            vehicle: formatVehicleResponse(responseVehicle, req, res)
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

        // Normalize VIN to uppercase (VINs are standardized as uppercase)
        // This ensures consistent comparison and storage
        const normalizedVin = vehicle.vin ? vehicle.vin.toUpperCase().trim() : vehicle.vin;
        if (!normalizedVin || normalizedVin.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid VIN: VIN cannot be empty'
            });
        }

        // Update vehicle object with normalized VIN for use throughout registration
        vehicle.vin = normalizedVin;

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
            const missing = [];
            if (!vehicle.vehicleCategory) missing.push('Vehicle Category (PNS Code)');
            if (!vehicle.passengerCapacity) missing.push('Passenger Capacity');
            if (!vehicle.grossVehicleWeight) missing.push('Gross Vehicle Weight');
            if (!vehicle.netWeight) missing.push('Net Weight');

            return res.status(400).json({
                success: false,
                error: `Missing required vehicle information: ${missing.join(', ')}. Please complete all fields in Step 2 (Vehicle Information).`
            });
        }

        // Validate numeric fields are valid numbers and positive
        const passengerCapacity = parseInt(vehicle.passengerCapacity);
        const grossWeight = parseFloat(vehicle.grossVehicleWeight);
        const netWeight = parseFloat(vehicle.netWeight);

        if (isNaN(passengerCapacity) || passengerCapacity < 1) {
            return res.status(400).json({
                success: false,
                error: 'Passenger Capacity must be a positive number'
            });
        }

        if (isNaN(grossWeight) || grossWeight <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Gross Vehicle Weight must be a positive number'
            });
        }

        if (isNaN(netWeight) || netWeight <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Net Weight must be a positive number'
            });
        }

        // Validate net weight is less than GVW
        if (netWeight >= grossWeight) {
            return res.status(400).json({
                success: false,
                error: 'Net Weight must be less than Gross Vehicle Weight'
            });
        }

        // Validate vehicle category (PNS code)
        const validCategories = ['L1', 'L2', 'L3', 'L5', 'M1', 'M2', 'M3', 'N1', 'N2', 'N3', 'O1', 'O2', 'O3', 'O4'];
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

        // Wrap vehicle creation, history, and document linking in a database transaction
        // This ensures atomicity - all succeed or all fail
        const vehicleRegistrationTransaction = require('../services/vehicleRegistrationTransaction');
        const safeMetadata = createSafeRegistrationMetadata(registrationData, vehicle, owner);

        let newVehicle;
        let documentCids = {};
        let documentLinkingResults = {
            total: 0,
            linked: 0,
            failed: 0,
            failures: [],
            linkedDocuments: []
        };
        let transactionResult = null;

        try {
            transactionResult = await vehicleRegistrationTransaction.createVehicleWithDocumentsTransaction({
                vehicle,
                ownerUser,
                registrationData,
                safeMetadata
            });

            newVehicle = transactionResult.vehicle;
            documentCids = transactionResult.documentCids;
            documentLinkingResults = transactionResult.documentLinkingResults;
        } catch (transactionError) {
            // Transaction was rolled back automatically
            console.error('❌ Transaction rolled back due to error:', transactionError);
            console.error('   Error stack:', transactionError.stack);

            // Handle duplicate VIN/plate errors from transaction
            if (transactionError.code === 'DUPLICATE_VIN' || transactionError.code === 'DUPLICATE_PLATE') {
                return res.status(409).json({
                    success: false,
                    error: transactionError.message,
                    duplicateField: transactionError.duplicateField,
                    existingStatus: transactionError.existingStatus,
                    canResubmit: false
                });
            }

            // Handle PostgreSQL unique constraint violations (23505)
            // This is a fallback in case the SELECT FOR UPDATE check missed something
            if (transactionError.code === '23505') {
                // Extract which field caused the duplicate
                let fieldName = 'record';
                let fieldValue = '';

                const constraintName = transactionError.constraint || '';
                const errorDetail = transactionError.detail || '';

                if (constraintName === 'vehicles_plate_number_key' || constraintName === 'vehicles_plate_active_unique' || errorDetail.includes('plate_number')) {
                    fieldName = 'plate number';
                    fieldValue = errorDetail.match(/\(plate_number\)=\(([^)]+)\)/)?.[1] || '';
                } else if (constraintName === 'vehicles_vin_key' || constraintName === 'vehicles_vin_active_unique' || errorDetail.includes('vin')) {
                    fieldName = 'VIN';
                    fieldValue = errorDetail.match(/\(vin\)=\(([^)]+)\)/)?.[1] || '';
                }

                return res.status(409).json({
                    success: false,
                    error: `Vehicle with this ${fieldName}${fieldValue ? ` (${fieldValue})` : ''} already exists and is currently registered or pending`,
                    duplicateField: fieldName === 'VIN' ? 'vin' : 'plateNumber',
                    duplicateValue: fieldValue
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Vehicle registration failed. Please try again.',
                details: process.env.NODE_ENV === 'development' ? transactionError.message : undefined
            });
        }

        // After transaction commits successfully, continue with non-critical operations

        // Auto-verify CSR/Sales Invoice against mint so no "pending" for these types
        try {
            await autoVerifyCsrSalesInvoiceForVehicle(newVehicle.id, ownerUser.id);
        } catch (avErr) {
            console.warn('Auto-verify CSR/Sales Invoice (registration):', avErr.message);
        }

        // Registration validation - check for critical documents (warn but allow)
        const requiredDocuments = ['pnpHpgClearance', 'insuranceCert']; // Configurable per registration type
        const docTypes = require('../config/documentTypes');
        const hasCriticalDocs = requiredDocuments.some(docType => {
            const logicalType = docTypes.mapLegacyType(docType);
            return logicalType && documentCids[logicalType];
        });

        if (documentLinkingResults.linked === 0) {
            // Fail registration - no documents at all
            console.error(`❌ Registration ${newVehicle.id} failed: No documents were linked`);
            return res.status(400).json({
                success: false,
                error: 'No documents were linked to this vehicle. Registration cannot proceed without documents.',
                documentLinking: {
                    status: 'failed',
                    summary: {
                        total: documentLinkingResults.total,
                        linked: 0,
                        failed: documentLinkingResults.failed
                    },
                    failures: documentLinkingResults.failures,
                    message: 'Please ensure documents were uploaded successfully before submitting registration.'
                }
            });
        }

        if (!hasCriticalDocs) {
            // Warn but allow - log for admin review
            const missingDocs = requiredDocuments.filter(docType => {
                const logicalType = docTypes.mapLegacyType(docType);
                return !logicalType || !documentCids[logicalType];
            });
            console.warn(`⚠️ Registration ${newVehicle.id} missing critical documents: ${missingDocs.join(', ')}`);
            // Continue - frontend will show warning via documentLinking status
        }

        // Note: Blockchain registration is now deferred until admin approval
        // This ensures OR/CR numbers are included in the blockchain record

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
            const isResubmission = !!(transactionResult && transactionResult.isResubmission);
            autoSendResults = await clearanceService.autoSendClearanceRequests(
                newVehicle.id,
                registrationData.documents,
                requestedBy,
                { isResubmission }
            );
            console.log('✅ Auto-sent clearance requests:', {
                hpg: autoSendResults?.hpg?.sent ? 'Yes' : 'No',
                insurance: autoSendResults?.insurance?.sent ? 'Yes' : 'No'
            });
        } catch (autoSendError) {
            console.error('❌ Failed to auto-send clearance requests:', autoSendError);
            // Don't fail the registration if auto-send fails - admin can manually send later
            // Auto-send is a convenience feature, not critical to registration
        }

        // Prepare auto-verification summary
        const autoVerificationSummary = {};
        if (autoSendResults) {
            if (autoSendResults.insurance && autoSendResults.insurance.autoVerification) {
                autoVerificationSummary.insurance = {
                    status: autoSendResults.insurance.autoVerification.status,
                    automated: autoSendResults.insurance.autoVerification.automated,
                    score: autoSendResults.insurance.autoVerification.score,
                    confidence: autoSendResults.insurance.autoVerification.confidence,
                    reason: autoSendResults.insurance.autoVerification.reason
                };
            }
            if (autoSendResults.hpg && autoSendResults.hpg.autoVerification) {
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
            blockchainStatus: 'PENDING', // Blockchain registration will occur during admin approval
            documentLinking: {
                status: documentLinkingResults.linked === 0 ? 'failed' :
                    documentLinkingResults.linked < documentLinkingResults.total ? 'partial' : 'success',
                summary: {
                    total: documentLinkingResults.total,
                    linked: documentLinkingResults.linked,
                    failed: documentLinkingResults.failed
                },
                linkedDocuments: documentLinkingResults.linkedDocuments,
                failures: documentLinkingResults.failures,
                warnings: documentLinkingResults.linked === 0 ? [
                    'No documents were linked to this vehicle. Clearance requests cannot be created automatically. Please contact support.'
                ] : documentLinkingResults.linked < documentLinkingResults.total ? [
                    `${documentLinkingResults.failed} document(s) failed to link. Some features may be unavailable.`
                ] : []
            },
            clearanceRequests: autoSendResults && autoSendResults.hpg && autoSendResults.insurance ? {
                hpg: autoSendResults.hpg.sent,
                insurance: autoSendResults.insurance.sent
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

        // Handle PostgreSQL unique constraint violations (duplicate key errors)
        if (error.code === '23505') {
            // Extract which field caused the duplicate
            let fieldName = 'record';
            let fieldValue = '';

            // Handle both old constraint names and new partial unique index names
            const constraintName = error.constraint || '';

            if (constraintName === 'vehicles_plate_number_key' || constraintName === 'vehicles_plate_active_unique') {
                fieldName = 'plate number';
                fieldValue = error.detail?.match(/\(plate_number\)=\(([^)]+)\)/)?.[1] || '';
            } else if (constraintName === 'vehicles_vin_key' || constraintName === 'vehicles_vin_active_unique') {
                fieldName = 'VIN';
                fieldValue = error.detail?.match(/\(vin\)=\(([^)]+)\)/)?.[1] || '';
            } else if (error.detail?.includes('plate_number')) {
                // Fallback: check error detail for plate_number
                fieldName = 'plate number';
                fieldValue = error.detail?.match(/\(plate_number\)=\(([^)]+)\)/)?.[1] || '';
            } else if (error.detail?.includes('vin')) {
                // Fallback: check error detail for vin
                fieldName = 'VIN';
                fieldValue = error.detail?.match(/\(vin\)=\(([^)]+)\)/)?.[1] || '';
            }

            return res.status(409).json({
                success: false,
                error: `Vehicle with this ${fieldName}${fieldValue ? ` (${fieldValue})` : ''} already exists and is currently registered or pending`,
                duplicateField: fieldName,
                duplicateValue: fieldValue
            });
        }

        // Provide more detailed error in development
        const isDevelopment = process.env.NODE_ENV !== 'production';
        res.status(500).json({
            success: false,
            error: isDevelopment ? `Internal server error: ${error.message}` : 'Internal server error',
            ...(isDevelopment && { details: error.stack })
        });
    }
});

// Update vehicle status
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can update vehicle status)
// APPROVED is only allowed when org clearances (HPG) and CSR validation are satisfied.
router.put('/id/:id/status', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        console.log(`[PUT /api/vehicles/id/${id}/status] Updating vehicle status to ${status}`);

        // Validate status
        const validStatuses = ['SUBMITTED', 'APPROVED', 'REJECTED', 'REGISTERED', 'PROCESSING'];
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

        // Gate: do not allow APPROVED until HPG clearance, insurance verification, and CSR are valid
        if (status === 'APPROVED') {
            const dbModule = require('../database/db');
            const [verifications, documents, hpgResult] = await Promise.all([
                db.getVehicleVerifications(id),
                db.getDocumentsByVehicle(id),
                dbModule.query(
                    `SELECT 1 FROM clearance_requests 
                     WHERE vehicle_id = $1 AND request_type = 'hpg' AND status IN ('APPROVED', 'COMPLETED') 
                     LIMIT 1`,
                    [id]
                )
            ]);
            const hasHpgClearance = hpgResult.rows.length > 0;
            const hasInsuranceApproved = verifications.some(
                v => v.verification_type === 'insurance' && v.status === 'APPROVED'
            );
            const hasCsrVerified = documents.some(
                d => d.document_type === 'csr' && d.verified === true
            );
            if (!hasHpgClearance || !hasInsuranceApproved || !hasCsrVerified) {
                const missing = [];
                if (!hasHpgClearance) missing.push('HPG clearance (org)');
                if (!hasInsuranceApproved) missing.push('insurance verification');
                if (!hasCsrVerified) missing.push('CSR document verified');
                return res.status(400).json({
                    success: false,
                    error: 'Cannot approve application until all validations are complete.',
                    missing
                });
            }
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

        // When rejected, notify applicant by email and in-app notification
        if (status === 'REJECTED' && (vehicle.owner_id || vehicle.owner_email)) {
            const ownerEmail = vehicle.owner_email || (vehicle.owner_id ? (await db.getUserById(vehicle.owner_id))?.email : null);
            const ownerName = [vehicle.owner_first_name, vehicle.owner_last_name].filter(Boolean).join(' ') || 'Applicant';
            const rejectionReason = (notes || '').replace(/^Application rejected:\s*/i, '').trim() || 'No reason provided.';
            const registrationUrl = process.env.APP_BASE_URL || 'https://ltoblockchain.duckdns.org';
            try {
                if (ownerEmail) {
                    const subject = 'Vehicle Registration Application Rejected - TrustChain LTO';
                    const text = `
Dear ${ownerName},

Your vehicle registration application has been rejected by LTO.

Vehicle: ${vehicle.plate_number || vehicle.vin || 'N/A'} - ${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.year || ''})

Reason: ${rejectionReason}

You may correct the issues and resubmit your application by logging in at ${registrationUrl}.

Best regards,
LTO Lipa City Team
                    `.trim();
                    const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;}
.email-container{background:#fff;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}
.header{text-align:center;border-bottom:2px solid #e74c3c;padding-bottom:20px;margin-bottom:20px;}
.header h1{color:#c0392b;margin:0;font-size:22px;}
.reason-box{background:#fdf2f2;border-left:4px solid #e74c3c;padding:15px;margin:20px 0;border-radius:4px;}
.footer{text-align:center;color:#666;font-size:12px;margin-top:24px;padding-top:20px;border-top:1px solid #eee;}
.btn{display:inline-block;padding:12px 24px;background:#3498db;color:#fff;text-decoration:none;border-radius:4px;margin:16px 0;}</style></head><body>
<div class="email-container">
<div class="header"><h1>Application Rejected</h1></div>
<p>Dear ${ownerName},</p>
<p>Your vehicle registration application has been rejected by LTO.</p>
<p><strong>Vehicle:</strong> ${vehicle.plate_number || vehicle.vin || 'N/A'} - ${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.year || ''})</p>
<div class="reason-box"><strong>Reason:</strong> ${rejectionReason}</div>
<p>You may correct the issues and resubmit your application.</p>
<p style="text-align:center;"><a href="${registrationUrl}" class="btn">Log in to resubmit</a></p>
<div class="footer"><p>Best regards,<br>LTO Lipa City Team</p></div>
</div></body></html>`;
                    await sendMail({ to: ownerEmail, subject, text, html });
                    console.log('✅ Rejection email sent to:', ownerEmail);
                }
                if (vehicle.owner_id) {
                    await db.createNotification({
                        userId: vehicle.owner_id,
                        title: 'Application Rejected',
                        message: `Your vehicle registration (${vehicle.plate_number || vehicle.vin || 'N/A'}) has been rejected. Reason: ${rejectionReason}. You may resubmit after correcting the issues.`,
                        type: 'warning'
                    });
                }
            } catch (notifyErr) {
                console.error('Rejection notification error (non-blocking):', notifyErr.message);
            }
        }

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

// GET /id/:id/csr-validation – two buckets: issued at mint (verified) + user submitted (verified or user submitted, no pending)
// STRICT: admin, lto_admin, lto_officer; auto-verifies user-submitted docs before returning
router.get('/id/:id/csr-validation', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        const dbModule = require('../database/db');
        const vin = vehicle.vin;
        const issuedRes = await dbModule.query(
            `SELECT certificate_type, certificate_number, vehicle_vin, issued_at, file_hash
             FROM issued_certificates
             WHERE vehicle_vin = $1 AND certificate_type IN ('csr', 'sales_invoice') AND is_revoked = false
             ORDER BY certificate_type, issued_at DESC`,
            [vin]
        );
        const issuedAtMint = (issuedRes.rows || []).map(r => ({
            type: r.certificate_type,
            certificateNumber: r.certificate_number,
            vehicleVin: r.vehicle_vin,
            issuedAt: r.issued_at,
            verified: true,
            label: 'Verified (issued at mint)'
        }));
        await autoVerifyCsrSalesInvoiceForVehicle(vehicleId, req.user.userId);
        const documents = await db.getDocumentsByVehicle(vehicleId);
        const userSubmitted = documents
            .filter(d => {
                const t = (d.document_type || d.documentType || '').toLowerCase();
                return t === 'csr' || t === 'sales_invoice' || t === 'salesinvoice';
            })
            .map(d => ({
                id: d.id,
                documentType: d.document_type || d.documentType,
                verified: d.verified === true,
                verifiedAt: d.verified_at || d.verifiedAt,
                label: d.verified === true ? 'Verified (matches mint)' : 'User submitted'
            }));
        res.json({
            success: true,
            issuedAtMint,
            userSubmitted
        });
    } catch (error) {
        console.error('CSR validation error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

// POST /id/:id/documents/verify-mint-documents – verify CSR/Sales Invoice against issued_certificates (mint)
// STRICT: admin, lto_admin, lto_officer only (kept for backwards compatibility; GET csr-validation is preferred)
router.post('/id/:id/documents/verify-mint-documents', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        const result = await autoVerifyCsrSalesInvoiceForVehicle(vehicleId, req.user.userId);
        const documents = await db.getDocumentsByVehicle(vehicleId);
        const csrSiOnly = documents.filter(d => {
            const t = (d.document_type || d.documentType || '').toLowerCase();
            return t === 'csr' || t === 'sales_invoice' || t === 'salesinvoice';
        });
        res.json({
            success: true,
            verified: result.verified,
            alreadyVerified: result.alreadyVerified,
            failed: result.unmatched,
            documents: csrSiOnly.map(d => ({
                id: d.id,
                documentType: d.document_type || d.documentType,
                verified: d.verified,
                verifiedAt: d.verified_at || d.verifiedAt
            }))
        });
    } catch (error) {
        console.error('Verify mint documents error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

// Update vehicle verification status
// STRICT: Allow admin, lto_admin, lto_officer, and insurance_verifier
router.put('/:vin/verification', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer', 'insurance_verifier']), async (req, res) => {
    try {
        const { vin } = req.params;
        const { verificationType, status, notes } = req.body;

        // Validate verification type
        const validTypes = ['insurance', 'admin'];
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

        // STRICT: lto_officer can only verify admin/insurance types, not system-level verifications
        if (req.user.role === 'lto_officer' && !['insurance', 'admin'].includes(verificationType)) {
            return res.status(403).json({
                success: false,
                error: 'Officers can only verify insurance and admin verification types'
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

        // Sync verification status to blockchain (only if vehicle is REGISTERED)
        let blockchainTxId = null;
        let blockchainSynced = false;

        if (vehicle.status === 'REGISTERED') {
            try {
                const fabricService = require('../services/optimizedFabricService');

                // Fetch current user to get employee_id
                const currentUser = await db.getUserById(req.user.userId);

                // Include officer information in notes for traceability (chaincode will parse if JSON)
                const notesWithOfficer = JSON.stringify({
                    notes: notes || '',
                    officerInfo: {
                        userId: req.user.userId,
                        email: req.user.email,
                        name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                        employeeId: currentUser?.employee_id || null
                    }
                });

                // Initialize Fabric service with current user context for dynamic identity selection
                await fabricService.initialize({
                    role: req.user.role,
                    email: req.user.email
                });

                const blockchainResult = await fabricService.updateVerificationStatus(
                    vin,
                    verificationType,
                    status,
                    notesWithOfficer
                );

                if (blockchainResult && blockchainResult.transactionId) {
                    blockchainTxId = blockchainResult.transactionId;
                    blockchainSynced = true;
                    console.log(`✅ Verification status synced to blockchain: ${verificationType} = ${status}`);
                }
            } catch (blockchainError) {
                // Log error but continue - database is source of truth
                console.warn('⚠️ Blockchain sync failed for verification update:', blockchainError.message);
                console.warn('   Database update succeeded, but blockchain update failed');
            }
        } else {
            console.log(`[Verification Update] Blockchain sync deferred - vehicle ${vin} is ${vehicle.status}, not yet registered on blockchain. Sync will occur when vehicle is registered during approval.`);
        }

        // Add to history
        await db.addVehicleHistory({
            vehicleId: vehicle.id,
            action: `${verificationType.toUpperCase()}_${status}`,
            description: notes || `${verificationType} verification ${status.toLowerCase()}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: { verificationType, status, notes, blockchainSynced: blockchainSynced }
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

        // Helper functions for privacy filtering
        const isAdmin = req.user.role === 'admin';
        const maskTransactionId = (txId) => {
            if (!txId || typeof txId !== 'string' || txId.length < 12) return null;
            return `${txId.substring(0, 8)}...${txId.substring(txId.length - 4)}`;
        };
        const filterMetadata = (metadata) => {
            if (!metadata) return {};
            const filtered = {};
            if (metadata.transferType) filtered.transferType = metadata.transferType;
            if (metadata.transferDate) filtered.transferDate = metadata.transferDate;
            return filtered;
        };
        const filterHistoryForPrivacy = (history) => {
            if (isAdmin) return history; // Admins see everything
            return history.map(record => ({
                ...record,
                previousOwnerName: null,
                previousOwnerEmail: null,
                newOwnerName: (record.action === 'REGISTERED' || record.action === 'BLOCKCHAIN_REGISTERED')
                    ? record.newOwnerName : null,
                newOwnerEmail: (record.action === 'REGISTERED' || record.action === 'BLOCKCHAIN_REGISTERED')
                    ? record.newOwnerEmail : null,
                performerName: 'LTO Officer',
                performerEmail: null,
                transactionId: maskTransactionId(record.transactionId),
                transaction_id: maskTransactionId(record.transaction_id),
                metadata: filterMetadata(record.metadata)
            }));
        };

        const ownershipHistory = [];
        for (const vehicle of vehicles) {
            try {
                // Validate vehicle has required fields
                if (!vehicle || !vehicle.id) {
                    console.warn('Skipping invalid vehicle:', vehicle);
                    continue;
                }

                // Safely get ownership history for each vehicle
                let history = await db.getOwnershipHistory(vehicle.id);

                // Apply privacy filtering for non-admin users
                history = filterHistoryForPrivacy(history);

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

        // CRITICAL: Get ownership history from Fabric blockchain (source of truth)
        let ownershipHistory = [];
        try {
            const fabricService = require('../services/optimizedFabricService');

            // Ensure Fabric is connected
            if (!fabricService.isConnected || fabricService.mode !== 'fabric') {
                console.warn('⚠️ Fabric not connected, falling back to database (not recommended)');
                ownershipHistory = await db.getOwnershipHistory(vehicle.id);
            } else {
                // Initialize with user context for MSP-based filtering
                await fabricService.initialize(req.user ? { role: req.user.role, email: req.user.email } : {});

                // Query Fabric blockchain for ownership history
                const fabricResult = await fabricService.getOwnershipHistory(vin);

                if (fabricResult.success) {
                    // Get full vehicle history to find initial registration
                    let fullHistory = [];
                    try {
                        const historyResult = await fabricService.getVehicleHistory(vin);
                        if (historyResult.success) {
                            fullHistory = historyResult.history || [];
                        }
                    } catch (historyError) {
                        console.warn('Could not retrieve full vehicle history:', historyError);
                    }

                    // Transform Fabric data to frontend format
                    ownershipHistory = transformFabricOwnershipHistory(
                        fabricResult.currentOwner,
                        fabricResult.pastOwners,
                        fabricResult.ownershipTransfers,
                        fullHistory,
                        vehicle
                    );
                    console.log(`✅ Retrieved ownership history from Fabric for VIN ${vin}`);
                } else {
                    throw new Error('Failed to retrieve ownership history from Fabric');
                }
            }
        } catch (fabricError) {
            console.error('❌ Error querying Fabric for ownership history:', fabricError);
            // Fallback to database if Fabric query fails
            console.warn('⚠️ Falling back to database (not recommended for production)');
            ownershipHistory = await db.getOwnershipHistory(vehicle.id);
        }

        // Helper function to mask transaction IDs
        const maskTransactionId = (txId) => {
            if (!txId || typeof txId !== 'string' || txId.length < 12) return null;
            return `${txId.substring(0, 8)}...${txId.substring(txId.length - 4)}`;
        };

        // Helper function to filter metadata for privacy
        const filterMetadata = (metadata) => {
            if (!metadata) return {};
            const filtered = {};
            // Only allow generic transfer type and date
            if (metadata.transferType) filtered.transferType = metadata.transferType;
            if (metadata.transferDate) filtered.transferDate = metadata.transferDate;
            return filtered;
        };

        // Filter ownership history for non-admin users (privacy protection)
        if (!isAdmin && isOwner) {
            ownershipHistory = ownershipHistory.map(record => {
                const filtered = {
                    ...record,
                    // Remove sensitive information
                    previousOwnerName: null,
                    previousOwnerEmail: null,
                    // Only show new owner info if it's the current user (for registration)
                    newOwnerName: (record.action === 'REGISTERED' || record.action === 'BLOCKCHAIN_REGISTERED')
                        ? record.newOwnerName : null,
                    newOwnerEmail: (record.action === 'REGISTERED' || record.action === 'BLOCKCHAIN_REGISTERED')
                        ? record.newOwnerEmail : null,
                    // Generic officer name, hide email
                    performerName: 'LTO Officer',
                    performerEmail: null,
                    // Mask transaction ID
                    transactionId: maskTransactionId(record.transactionId),
                    transaction_id: maskTransactionId(record.transaction_id),
                    // Filter metadata
                    metadata: filterMetadata(record.metadata)
                };
                return filtered;
            });
        }

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

// Helper function to transform Fabric ownership history to frontend format
function transformFabricOwnershipHistory(currentOwner, pastOwners, ownershipTransfers, fullHistory, vehicle) {
    const history = [];

    // Find initial registration entry
    const registrationEntry = fullHistory.find(h =>
        h.action === 'REGISTERED' || h.action === 'BLOCKCHAIN_REGISTERED'
    );

    // Add initial registration entry if found
    if (registrationEntry) {
        history.push({
            id: null,
            vehicleId: vehicle.id,
            action: registrationEntry.action,
            description: registrationEntry.details || 'Vehicle initially registered',
            timestamp: registrationEntry.timestamp,
            performed_at: registrationEntry.timestamp,
            performedBy: registrationEntry.performedBy,
            performerName: registrationEntry.officerInfo?.name || 'LTO Officer',
            performerEmail: registrationEntry.officerInfo?.email || null,
            transactionId: registrationEntry.transactionId,
            transaction_id: registrationEntry.transactionId,
            vin: vehicle.vin,
            plateNumber: vehicle.plate_number,
            currentOwnerName: currentOwner ? `${currentOwner.firstName || ''} ${currentOwner.lastName || ''}`.trim() : null,
            currentOwnerEmail: currentOwner?.email || null,
            newOwnerName: currentOwner ? `${currentOwner.firstName || ''} ${currentOwner.lastName || ''}`.trim() : null,
            newOwnerEmail: currentOwner?.email || null,
            metadata: {
                is_initial: true,
                owner_email: currentOwner?.email || null,
                owner_name: currentOwner ? `${currentOwner.firstName || ''} ${currentOwner.lastName || ''}`.trim() : null
            }
        });
    }

    // Transform ownership transfers from Fabric
    ownershipTransfers.forEach((transfer, index) => {
        const previousOwner = transfer.previousOwner || {};
        const newOwner = transfer.newOwner || {};

        history.push({
            id: null,
            vehicleId: vehicle.id,
            action: 'OWNERSHIP_TRANSFERRED',
            description: transfer.details || `Ownership transferred from ${previousOwner.email || 'Unknown'} to ${newOwner.email || 'Unknown'}`,
            timestamp: transfer.timestamp,
            performed_at: transfer.timestamp,
            performedBy: transfer.performedBy,
            performerName: transfer.officerInfo?.name || 'LTO Officer',
            performerEmail: transfer.officerInfo?.email || null,
            transactionId: transfer.transactionId,
            transaction_id: transfer.transactionId,
            vin: vehicle.vin,
            plateNumber: vehicle.plate_number,
            previousOwnerName: previousOwner.firstName && previousOwner.lastName
                ? `${previousOwner.firstName} ${previousOwner.lastName}`.trim()
                : previousOwner.email || null,
            previousOwnerEmail: previousOwner.email || null,
            newOwnerName: newOwner.firstName && newOwner.lastName
                ? `${newOwner.firstName} ${newOwner.lastName}`.trim()
                : newOwner.email || null,
            newOwnerEmail: newOwner.email || null,
            currentOwnerName: newOwner.firstName && newOwner.lastName
                ? `${newOwner.firstName} ${newOwner.lastName}`.trim()
                : newOwner.email || null,
            currentOwnerEmail: newOwner.email || null,
            transferReason: transfer.transferData?.reason || null,
            transferDate: transfer.timestamp,
            metadata: {
                transferType: transfer.transferData?.transferType || null,
                transferDate: transfer.timestamp,
                transferReason: transfer.transferData?.reason || null,
                previousOwnerId: previousOwner.email || null,
                newOwnerId: newOwner.email || null
            }
        });
    });

    // Sort by timestamp (oldest first)
    history.sort((a, b) => {
        const dateA = new Date(a.performed_at || a.timestamp);
        const dateB = new Date(b.performed_at || b.timestamp);
        return dateA - dateB;
    });

    return history;
}

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
// STRICT: Allow vehicle_owner, admin, lto_admin, and lto_officer
router.put('/:vin/transfer', authenticateToken, authorizeRole(['vehicle_owner', 'admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
        // STRICT: Allow vehicle owner, admin, lto_admin, and lto_officer
        if (!['admin', 'lto_admin', 'lto_officer'].includes(req.user.role) && vehicle.owner_id !== req.user.userId) {
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

// Helper function to verify blockchain transaction ID against Fabric
// This ensures the transaction ID from PostgreSQL actually exists on Fabric
async function verifyBlockchainTransactionId(vehicle, userContext = null) {
    // Only verify if we have a valid transaction ID format
    if (!vehicle.blockchain_tx_id ||
        vehicle.blockchain_tx_id.includes('-') ||
        vehicle.blockchain_tx_id.length < 40) {
        vehicle.blockchain_tx_verified = null;
        vehicle.blockchain_tx_validation = null;
        return;
    }

    try {
        const fabricService = require('../services/optimizedFabricService');

        // Initialize Fabric service with user context (if available) for dynamic identity selection
        await fabricService.initialize(userContext ? {
            role: userContext.role,
            email: userContext.email
        } : {});

        // Verify transaction exists on Fabric
        const transactionProof = await fabricService.getTransactionProof(vehicle.blockchain_tx_id);

        if (transactionProof && transactionProof.validationCode === 0) {
            // Transaction is valid on Fabric
            vehicle.blockchain_tx_verified = true;
            vehicle.blockchain_tx_validation = 'VALID';
            console.log(`✅ Verified transaction ID ${vehicle.blockchain_tx_id.substring(0, 20)}... on Fabric`);
        } else {
            // Transaction ID exists but validation failed
            vehicle.blockchain_tx_verified = false;
            vehicle.blockchain_tx_validation = transactionProof?.validationCodeName || 'INVALID';
            console.warn(`⚠️ Transaction ID ${vehicle.blockchain_tx_id.substring(0, 20)}... found on Fabric but validation code: ${transactionProof?.validationCode}`);
        }
    } catch (verifyError) {
        // Transaction ID not found on Fabric or verification failed
        vehicle.blockchain_tx_verified = false;
        vehicle.blockchain_tx_validation = 'NOT_FOUND';
        console.error(`❌ Transaction ID ${vehicle.blockchain_tx_id?.substring(0, 20)}... not found on Fabric:`, verifyError.message);
        // Don't fail the request - just mark as unverified
    }
}

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
        blockchainTxId: vehicle.blockchain_tx_id || vehicle.blockchainTxId || null,
        blockchain_tx_id: vehicle.blockchain_tx_id || vehicle.blockchainTxId || null,
        blockchainTxVerified: vehicle.blockchain_tx_verified !== undefined ? vehicle.blockchain_tx_verified : null,
        blockchain_tx_verified: vehicle.blockchain_tx_verified !== undefined ? vehicle.blockchain_tx_verified : null,
        blockchainTxValidation: vehicle.blockchain_tx_validation || null,
        blockchain_tx_validation: vehicle.blockchain_tx_validation || null,
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
        blockchainTxId: vehicle.blockchain_tx_id || vehicle.blockchainTxId || null,
        blockchain_tx_id: vehicle.blockchain_tx_id || vehicle.blockchainTxId || null,
        blockchainTxVerified: vehicle.blockchain_tx_verified !== undefined ? vehicle.blockchain_tx_verified : null,
        blockchain_tx_verified: vehicle.blockchain_tx_verified !== undefined ? vehicle.blockchain_tx_verified : null,
        blockchainTxValidation: vehicle.blockchain_tx_validation || null,
        blockchain_tx_validation: vehicle.blockchain_tx_validation || null,
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
