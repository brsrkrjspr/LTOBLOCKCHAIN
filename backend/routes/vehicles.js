// TrustChain Vehicle Management Routes
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');
const db = require('../database/services');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const crypto = require('crypto');

// Get all vehicles (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let vehicles;
        let totalCount;

        if (status) {
            vehicles = await db.getVehiclesByStatus(status, parseInt(limit), offset);
            // Get total count for this status
            const dbModule = require('../database/db');
            const countResult = await dbModule.query(
                'SELECT COUNT(*) FROM vehicles WHERE status = $1',
                [status]
            );
            totalCount = parseInt(countResult.rows[0].count);
        } else {
            vehicles = await db.getAllVehicles(parseInt(limit), offset);
            // Get total count
            const dbModule = require('../database/db');
            const countResult = await dbModule.query('SELECT COUNT(*) FROM vehicles');
            totalCount = parseInt(countResult.rows[0].count);
        }

        // Get verifications and documents for each vehicle
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
            vehicles: vehicles.map(v => formatVehicleResponse(v)),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalVehicles: totalCount,
                hasNext: offset + vehicles.length < totalCount,
                hasPrev: offset > 0
            }
        });

    } catch (error) {
        console.error('Get vehicles error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
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
            vehicles: vehicles.map(v => formatVehicleResponse(v)),
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
            vehicles: vehicles.map(v => formatVehicleResponse(v)),
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

        res.json({
            success: true,
            vehicle: formatVehicleResponse(vehicle)
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
            vehicle: formatVehicleResponse(vehicle)
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
            vehicle: formatVehicleResponse(vehicle)
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
            vehicles: vehicles.map(v => formatVehicleResponse(v)),
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
                (owner.phone && ownerUser.phone !== owner.phone)
            )) {
                // Update user details
                const dbModule = require('../database/db');
                await dbModule.query(
                    `UPDATE users 
                     SET first_name = $1, last_name = $2, phone = COALESCE($3, phone), updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4`,
                    [owner.firstName, owner.lastName, owner.phone || null, ownerUser.id]
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
                    phone: owner.phone
                });
                console.log(`✅ Created new user account for vehicle owner: ${owner.email}`);
            } else {
                // User exists - update info if needed
                const dbModule = require('../database/db');
                await dbModule.query(
                    `UPDATE users 
                     SET first_name = $1, last_name = $2, phone = COALESCE($3, phone), updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4`,
                    [owner.firstName, owner.lastName, owner.phone || null, ownerUser.id]
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
            vehicleType: vehicle.vehicleType || 'PASSENGER',
            fuelType: vehicle.fuelType || 'GASOLINE',
            transmission: vehicle.transmission || 'AUTOMATIC',
            engineDisplacement: vehicle.engineDisplacement,
            ownerId: ownerUser.id,
            status: 'SUBMITTED',
            notes: registrationData.notes
        });

        // Add to history
        await db.addVehicleHistory({
            vehicleId: newVehicle.id,
            action: 'REGISTERED',
            description: 'Vehicle registration submitted',
            performedBy: ownerUser.id,
            transactionId: null,
            metadata: { registrationData }
        });
        
        // Link uploaded documents to vehicle and collect CIDs for blockchain
        const documentCids = {};
        if (registrationData.documents && typeof registrationData.documents === 'object') {
            const documentTypes = {
                'registrationCert': 'registration_cert',
                'insuranceCert': 'insurance_cert',
                'emissionCert': 'emission_cert',
                'ownerId': 'owner_id'
            };
            
            for (const [docType, dbDocType] of Object.entries(documentTypes)) {
                if (registrationData.documents[docType]) {
                    const docData = registrationData.documents[docType];
                    try {
                        let documentRecord = null;
                        const dbModule = require('../database/db');
                        
                        // Method 1: If document ID is provided (from upload response), update directly
                        if (docData.id && !docData.id.toString().startsWith('TEMP_')) {
                            const docByIdResult = await dbModule.query(
                                'SELECT * FROM documents WHERE id = $1',
                                [docData.id]
                            );
                            if (docByIdResult.rows.length > 0) {
                                documentRecord = docByIdResult.rows[0];
                                // Update to link to vehicle
                                await dbModule.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4',
                                    [newVehicle.id, dbDocType, ownerUser.id, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${docType} by ID: ${documentRecord.id}`);
                            }
                        }
                        
                        // Method 2: If not found by ID, try filename or CID (for unlinked documents)
                        if (!documentRecord && (docData.filename || docData.cid)) {
                            const docResult = await dbModule.query(
                                'SELECT * FROM documents WHERE (filename = $1 OR ipfs_cid = $2) AND (vehicle_id IS NULL OR vehicle_id = $3) LIMIT 1',
                                [docData.filename || null, docData.cid || null, newVehicle.id]
                            );
                            if (docResult.rows.length > 0) {
                                documentRecord = docResult.rows[0];
                                // Update to link to vehicle
                                await dbModule.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4',
                                    [newVehicle.id, dbDocType, ownerUser.id, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${docType} by filename/CID: ${documentRecord.id}`);
                            }
                        }
                        
                        // Method 3: Create new document record if not found
                        if (!documentRecord) {
                            documentRecord = await db.createDocument({
                                vehicleId: newVehicle.id,
                                documentType: dbDocType,
                                filename: docData.filename,
                                originalName: docData.filename,
                                filePath: docData.url || `/uploads/${docData.filename}`,
                                fileSize: 0, // Size not available from upload
                                mimeType: 'application/pdf', // Default
                                fileHash: null,
                                uploadedBy: ownerUser.id, // Set owner as uploader
                                ipfsCid: docData.cid || null
                            });
                            console.log(`✅ Created new document record for ${docType}: ${documentRecord.id}`);
                        }
                        
                        // Collect CID for blockchain
                        if (documentRecord.ipfs_cid || docData.cid) {
                            documentCids[docType] = {
                                cid: documentRecord.ipfs_cid || docData.cid,
                                filename: documentRecord.filename || docData.filename,
                                documentType: dbDocType
                            };
                        }
                    } catch (docError) {
                        console.error(`Error linking ${docType} document:`, docError);
                        // Continue even if document linking fails
                    }
                }
            }
        }
        
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
                            metadata: { blockchainResult, txStatus }
                        });
                    } else {
                        // Transaction pending, keep PENDING_BLOCKCHAIN status
                        await db.addVehicleHistory({
                            vehicleId: newVehicle.id,
                            action: 'BLOCKCHAIN_PENDING',
                            description: `Vehicle registration submitted to blockchain (status: ${txStatus.status})`,
                            performedBy: ownerUser.id,
                            transactionId: blockchainTxId,
                            metadata: { blockchainResult, txStatus }
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
                        metadata: { blockchainResult, pollingError: pollError.message }
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
                    metadata: { registrationData }
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

        // Get full vehicle data
        const fullVehicle = await db.getVehicleById(newVehicle.id);
        fullVehicle.verifications = await db.getVehicleVerifications(newVehicle.id);
        fullVehicle.documents = await db.getDocumentsByVehicle(newVehicle.id);

        res.json({
            success: true,
            message: 'Vehicle registration submitted successfully',
            vehicle: formatVehicleResponse(fullVehicle),
            blockchainStatus: blockchainTxId ? 'REGISTERED' : 'PENDING'
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
            vehicle: formatVehicleResponse(updatedVehicle)
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
            vehicle: formatVehicleResponse(updatedVehicle)
        });

    } catch (error) {
        console.error('Update verification error:', error);
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
            vehicle: formatVehicleResponse(updatedVehicle)
        });

    } catch (error) {
        console.error('Transfer ownership error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to format vehicle response
function formatVehicleResponse(vehicle) {
    if (!vehicle) return null;

    // Format verification status
    const verificationStatus = {};
    if (vehicle.verifications) {
        vehicle.verifications.forEach(v => {
            verificationStatus[v.verification_type] = v.status;
        });
    }

    // Format documents to ensure they have required fields (id, documentType, etc.)
    const formattedDocuments = (vehicle.documents || []).map(doc => {
        // Ensure document has id field and both snake_case and camelCase versions
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
        fuelType: vehicle.fuel_type,
        transmission: vehicle.transmission,
        engineDisplacement: vehicle.engine_displacement,
        ownerId: vehicle.owner_id,
        ownerName: vehicle.owner_name || (vehicle.owner_email ? 'Unknown' : null),
        ownerEmail: vehicle.owner_email,
        status: vehicle.status,
        registrationDate: vehicle.registration_date,
        lastUpdated: vehicle.last_updated,
        verificationStatus: verificationStatus,
        verifications: vehicle.verifications || [],
        documents: formattedDocuments, // Use formatted documents with proper structure
        history: vehicle.history || [],
        notes: vehicle.notes
    };
}

module.exports = router;
