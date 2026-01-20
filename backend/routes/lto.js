// TrustChain LTO - LTO Admin Routes
// Handles LTO admin actions: approving clearances, inspections, etc.
// NOTE: Manual request sending has been removed - requests are now automatically sent via clearanceService

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fabricService = require('../services/optimizedFabricService');

// Configure multer for file uploads
const inspectionDocsDir = path.join(__dirname, '../uploads/inspection-documents');
if (!fs.existsSync(inspectionDocsDir)) {
    fs.mkdirSync(inspectionDocsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, inspectionDocsDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB per file
    },
    fileFilter: function (req, file, cb) {
        // Allowed file types for inspection documents
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}`));
        }
    }
});

// Perform LTO vehicle inspection
router.post('/inspect', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, inspectionResult, roadworthinessStatus, emissionCompliance, inspectionOfficer, inspectionNotes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        // Validate required fields
        if (!inspectionResult || !roadworthinessStatus || !emissionCompliance) {
            return res.status(400).json({
                success: false,
                error: 'Inspection result, roadworthiness status, and emission compliance are required'
            });
        }

        // Validate values
        const validResults = ['PASS', 'FAIL', 'PENDING'];
        const validRoadworthiness = ['ROADWORTHY', 'NOT_ROADWORTHY'];
        const validCompliance = ['COMPLIANT', 'NON_COMPLIANT'];

        if (!validResults.includes(inspectionResult)) {
            return res.status(400).json({
                success: false,
                error: `Invalid inspection result. Must be one of: ${validResults.join(', ')}`
            });
        }

        if (!validRoadworthiness.includes(roadworthinessStatus)) {
            return res.status(400).json({
                success: false,
                error: `Invalid roadworthiness status. Must be one of: ${validRoadworthiness.join(', ')}`
            });
        }

        if (!validCompliance.includes(emissionCompliance)) {
            return res.status(400).json({
                success: false,
                error: `Invalid emission compliance. Must be one of: ${validCompliance.join(', ')}`
            });
        }

        // Get vehicle
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if inspection already exists
        if (vehicle.mvir_number) {
            return res.status(409).json({
                success: false,
                error: 'Vehicle already has an inspection record',
                mvirNumber: vehicle.mvir_number,
                inspectionDate: vehicle.inspection_date
            });
        }

        // Get current user for inspection officer if not provided
        const currentUser = await db.getUserById(req.user.userId);
        const officerName = inspectionOfficer || `${currentUser.first_name} ${currentUser.last_name}`;

        // Assign MVIR number and inspection data
        const inspectionResult_data = await db.assignMvirNumber(vehicleId, {
            inspectionResult,
            roadworthinessStatus,
            emissionCompliance,
            inspectionOfficer: officerName,
            inspectionNotes: inspectionNotes || null
        });

        // Log inspection to vehicle history
        await db.addVehicleHistory({
            vehicleId,
            action: 'LTO_INSPECTION_COMPLETED',
            description: `LTO inspection completed. Result: ${inspectionResult}, Roadworthiness: ${roadworthinessStatus}, Emission: ${emissionCompliance}. MVIR: ${inspectionResult_data.mvirNumber}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                mvirNumber: inspectionResult_data.mvirNumber,
                inspectionResult,
                roadworthinessStatus,
                emissionCompliance,
                inspectionOfficer: officerName
            }
        });

        // Get updated vehicle
        const updatedVehicle = await db.getVehicleById(vehicleId);

        // If there are any active transfer requests waiting for LTO inspection for this vehicle,
        // move them forward and record inspection metadata.
        try {
            const pendingTransfers = await db.getTransferRequests({
                vehicleId,
                status: 'AWAITING_LTO_INSPECTION'
            });

            if (pendingTransfers && pendingTransfers.length > 0) {
                const nowIso = new Date().toISOString();
                for (const tr of pendingTransfers) {
                    // Mark transfer as back under review now that inspection is complete
                    await db.updateTransferRequestStatus(
                        tr.id,
                        'UNDER_REVIEW',
                        req.user.userId,
                        null,
                        {
                            ltoInspectionCompleted: true,
                            ltoInspectionCompletedAt: nowIso,
                            ltoInspection: {
                                mvirNumber: inspectionResult_data.mvirNumber,
                                inspectionDate: inspectionResult_data.inspectionDate,
                                inspectionResult,
                                roadworthinessStatus,
                                emissionCompliance,
                                inspectionOfficer: officerName
                            }
                        }
                    );

                    // Add history entry tying this inspection to the transfer request
                    await db.addVehicleHistory({
                        vehicleId,
                        action: 'LTO_INSPECTION_LINKED_TO_TRANSFER',
                        description: `LTO inspection completed for active transfer request ${tr.id}. MVIR: ${inspectionResult_data.mvirNumber}`,
                        performedBy: req.user.userId,
                        transactionId: null,
                        metadata: {
                            transferRequestId: tr.id,
                            mvirNumber: inspectionResult_data.mvirNumber
                        }
                    });

                    // Notify seller and buyer that inspection has been completed
                    try {
                        if (tr.seller_id) {
                            await db.createNotification({
                                userId: tr.seller_id,
                                title: 'LTO Inspection Completed',
                                message: `LTO inspection for your transfer request on vehicle ${updatedVehicle.plate_number || updatedVehicle.vin} has been completed. The request is now under review.`,
                                type: 'success'
                            });
                        }
                        if (tr.buyer_id) {
                            await db.createNotification({
                                userId: tr.buyer_id,
                                title: 'LTO Inspection Completed',
                                message: `LTO inspection for the vehicle ${updatedVehicle.plate_number || updatedVehicle.vin} has been completed. The transfer request is now under review.`,
                                type: 'info'
                            });
                        }
                    } catch (notifError) {
                        console.warn('⚠️ Failed to create inspection completion notifications:', notifError.message);
                    }
                }
            }
        } catch (transferLinkError) {
            console.warn('⚠️ Failed to update transfer requests after inspection:', transferLinkError.message);
        }
        
        res.json({
            success: true,
            message: 'Vehicle inspection completed successfully',
            inspection: {
                mvirNumber: inspectionResult_data.mvirNumber,
                inspectionDate: inspectionResult_data.inspectionDate,
                inspectionResult,
                roadworthinessStatus,
                emissionCompliance,
                inspectionOfficer: officerName,
                inspectionNotes: inspectionNotes || null
            },
            vehicle: updatedVehicle
        });

    } catch (error) {
        console.error('Error performing LTO inspection:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform inspection: ' + error.message
        });
    }
});

// Upload inspection documents (MVIR, photos, etc.)
router.post('/inspect-documents', authenticateToken, authorizeRole(['admin']), upload.any(), async (req, res) => {
    try {
        const { vehicleId } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        // Get vehicle
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Organize documents by type
        const documentReferences = {
            mvirDocument: null,
            vehiclePhotos: [],
            additionalDocuments: []
        };

        // Process uploaded files
        for (const file of req.files) {
            const fileReference = {
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                path: `/uploads/inspection-documents/${file.filename}`
            };

            // Categorize by field name
            if (file.fieldname === 'mvirDocument') {
                documentReferences.mvirDocument = fileReference;
            } else if (file.fieldname === 'vehiclePhotos') {
                documentReferences.vehiclePhotos.push(fileReference);
            } else if (file.fieldname === 'additionalDocuments') {
                documentReferences.additionalDocuments.push(fileReference);
            }
        }

        // Store document references in a JSON file or database record
        // For now, we'll store it in a temporary location that can be retrieved later
        const docRefFile = path.join(inspectionDocsDir, `${vehicleId}-documents.json`);
        fs.writeFileSync(docRefFile, JSON.stringify(documentReferences, null, 2));

        res.json({
            success: true,
            message: 'Inspection documents uploaded successfully',
            documentReferences: documentReferences
        });

    } catch (error) {
        console.error('Error uploading inspection documents:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                const filepath = path.join(inspectionDocsDir, file.filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to upload inspection documents: ' + error.message
        });
    }
});

// Get inspection documents for a vehicle
router.get('/inspect-documents/:vehicleId', authenticateToken, authorizeRole(['admin', 'vehicle_owner']), async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission
        if (req.user.role !== 'admin' && vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view these documents'
            });
        }

        // Try to load document references
        const docRefFile = path.join(inspectionDocsDir, `${vehicleId}-documents.json`);
        if (fs.existsSync(docRefFile)) {
            const documentReferences = JSON.parse(fs.readFileSync(docRefFile, 'utf-8'));
            res.json({
                success: true,
                documentReferences: documentReferences
            });
        } else {
            res.json({
                success: true,
                documentReferences: {
                    mvirDocument: null,
                    vehiclePhotos: [],
                    additionalDocuments: []
                }
            });
        }

    } catch (error) {
        console.error('Error retrieving inspection documents:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve inspection documents: ' + error.message
        });
    }
});

// Get inspection data for a vehicle
router.get('/inspection/:vehicleId', authenticateToken, authorizeRole(['admin', 'vehicle_owner']), async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission (admin or vehicle owner)
        if (req.user.role !== 'admin' && vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to view this vehicle inspection'
            });
        }

        // Return inspection data if exists
        if (!vehicle.mvir_number) {
            return res.json({
                success: true,
                hasInspection: false,
                message: 'No inspection record found for this vehicle'
            });
        }

        res.json({
            success: true,
            hasInspection: true,
            inspection: {
                mvirNumber: vehicle.mvir_number,
                inspectionDate: vehicle.inspection_date,
                inspectionResult: vehicle.inspection_result,
                roadworthinessStatus: vehicle.roadworthiness_status,
                emissionCompliance: vehicle.emission_compliance,
                inspectionOfficer: vehicle.inspection_officer,
                inspectionNotes: vehicle.inspection_notes
            }
        });

    } catch (error) {
        console.error('Error getting inspection data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get inspection data: ' + error.message
        });
    }
});

// Approve clearance (final approval after all verifications complete)
router.post('/approve-clearance', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, notes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if all required verifications are complete
        const verifications = await db.getVehicleVerifications(vehicleId);
        const clearanceRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        
        // Collect pending and rejected approvals for comprehensive error reporting
        const pendingApprovals = [];
        const rejectedApprovals = [];
        
        // Check HPG clearance - MUST exist and be APPROVED or COMPLETED
        const hpgRequest = clearanceRequests.find(r => r.request_type === 'hpg');
        if (!hpgRequest) {
            pendingApprovals.push('HPG');
        } else if (hpgRequest.status !== 'APPROVED' && hpgRequest.status !== 'COMPLETED') {
            if (hpgRequest.status === 'REJECTED') {
                rejectedApprovals.push('HPG');
            } else {
                pendingApprovals.push('HPG');
            }
        }
        
        // Check insurance verification - MUST exist and be APPROVED
        const insuranceVerification = verifications.find(v => v.verification_type === 'insurance');
        if (!insuranceVerification) {
            pendingApprovals.push('Insurance');
        } else if (insuranceVerification.status !== 'APPROVED') {
            if (insuranceVerification.status === 'REJECTED') {
                rejectedApprovals.push('Insurance');
            } else {
                pendingApprovals.push('Insurance');
            }
        }
        
        // Check emission verification - MUST exist and be APPROVED
        const emissionVerification = verifications.find(v => v.verification_type === 'emission');
        if (!emissionVerification) {
            pendingApprovals.push('Emission');
        } else if (emissionVerification.status !== 'APPROVED') {
            if (emissionVerification.status === 'REJECTED') {
                rejectedApprovals.push('Emission');
            } else {
                pendingApprovals.push('Emission');
            }
        }
        
        // Log validation check for debugging
        console.log(`[LTO Approval] Checking verifications for vehicle ${vehicleId}:`, {
            hpg: hpgRequest ? hpgRequest.status : 'MISSING',
            insurance: insuranceVerification ? insuranceVerification.status : 'MISSING',
            emission: emissionVerification ? emissionVerification.status : 'MISSING',
            pendingApprovals,
            rejectedApprovals
        });
        
        // Block approval if any organizations are pending
        if (pendingApprovals.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot approve vehicle registration. Pending organization approvals required.',
                pendingApprovals,
                message: `The following organizations must approve before LTO can finalize: ${pendingApprovals.join(', ')}`
            });
        }
        
        // Block approval if any organizations have rejected
        if (rejectedApprovals.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot approve vehicle registration. Some organizations have rejected.',
                rejectedApprovals,
                message: `The following organizations have rejected: ${rejectedApprovals.join(', ')}`
            });
        }

        // All verifications complete - approve and register on blockchain
        console.log(`[LTO Approval] All verifications approved for vehicle ${vehicleId}. Proceeding with approval.`);

        // Generate separate OR and CR Numbers - MANDATORY for approval
        let orNumber = null;
        let crNumber = null;
        let orIssuedAt = null;
        let crIssuedAt = null;
        try {
            const orCrResult = await db.assignOrAndCrNumbers(vehicleId);
            orNumber = orCrResult.orNumber;
            crNumber = orCrResult.crNumber;
            orIssuedAt = orCrResult.orIssuedAt;
            crIssuedAt = orCrResult.crIssuedAt;
            console.log(`[LTO Approval] OR number assigned: ${orNumber}, CR number assigned: ${crNumber}`);
        } catch (orCrError) {
            console.error('Failed to generate OR/CR numbers:', orCrError);
            // OR/CR assignment is mandatory - fail approval if it cannot be generated
            return res.status(500).json({
                success: false,
                error: 'Failed to generate OR/CR numbers. Approval cannot proceed without OR/CR assignment.',
                details: orCrError.message,
                vehicleId: vehicleId
            });
        }

        // Determine if this approval is for a transfer-of-ownership workflow
        const isTransferWorkflow = vehicle.origin_type === 'TRANSFER' || vehicle.registration_type === 'TRANSFER';

        // MVIR / physical inspection is ONLY used for transfer-of-ownership.
        // For new registrations (origin_type !== 'TRANSFER'), we must NOT auto-generate MVIR here.
        let mvirNumber = vehicle.mvir_number;
        let inspectionDate = vehicle.inspection_date;

        if (isTransferWorkflow) {
            // For transfer approvals, auto-generate inspection if missing
            if (!vehicle.mvir_number) {
                try {
                    // Get current user for inspection officer
                    const currentUser = await db.getUserById(req.user.userId);
                    const officerName = `${currentUser.first_name} ${currentUser.last_name}`;
                    
                    // Auto-generate inspection with default values (PASS, ROADWORTHY, COMPLIANT)
                    const inspectionResult = await db.assignMvirNumber(vehicleId, {
                        inspectionResult: 'PASS',
                        roadworthinessStatus: 'ROADWORTHY',
                        emissionCompliance: 'COMPLIANT',
                        inspectionOfficer: officerName,
                        inspectionNotes: 'Auto-generated during approval process (transfer of ownership)'
                    });
                    
                    mvirNumber = inspectionResult.mvirNumber;
                    inspectionDate = inspectionResult.inspectionDate;
                    
                    console.log(`[LTO Approval] Auto-generated transfer inspection: MVIR ${mvirNumber}`);
                    
                    // Log auto-inspection to vehicle history
                    await db.addVehicleHistory({
                        vehicleId,
                        action: 'LTO_INSPECTION_AUTO_GENERATED',
                        description: `LTO inspection auto-generated during transfer approval. MVIR: ${mvirNumber}`,
                        performedBy: req.user.userId,
                        transactionId: null,
                        metadata: {
                            mvirNumber,
                            autoGenerated: true,
                            context: 'TRANSFER'
                        }
                    });
                } catch (inspectionError) {
                    // Log error but don't fail approval - inspection can be added manually later
                    console.warn(`[LTO Approval] Failed to auto-generate transfer inspection: ${inspectionError.message}`);
                    console.warn('   Transfer approval will proceed without MVIR. Inspection can be added manually.');
                }
            } else {
                console.log(`[LTO Approval] Vehicle already has transfer inspection: MVIR ${vehicle.mvir_number}`);
            }
        } else {
            // New registration workflow: do NOT auto-generate MVIR and do not depend on it
            if (vehicle.mvir_number) {
                console.log(`[LTO Approval] MVIR present (${vehicle.mvir_number}) but ignored for NEW_REG approval workflow.`);
            }
            mvirNumber = null;
            inspectionDate = null;
        }

        // Update vehicle status to APPROVED (with OR/CR number if generated)
        await db.updateVehicle(vehicleId, {
            status: 'APPROVED'
        });

        // Register vehicle on blockchain
        let blockchainTxId = null;
        try {
            if (fabricService.isConnected && fabricService.mode === 'fabric') {
                const vehicleData = {
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
                    owner: vehicle.owner_name || vehicle.owner_email,
                    orNumber: orNumber, // Include separate OR number in blockchain record
                    crNumber: crNumber, // Include separate CR number in blockchain record
                    documents: {}
                };

                const result = await fabricService.registerVehicle(vehicleData);
                blockchainTxId = result.transactionId;
            }
        } catch (blockchainError) {
            console.error('Failed to register vehicle on blockchain:', blockchainError);
            // Continue with approval even if blockchain fails
        }

        // Update vehicle status to REGISTERED if blockchain registration succeeded
        if (blockchainTxId) {
            await db.updateVehicle(vehicleId, {
                status: 'REGISTERED'
            });
            
            // Set registration expiry (1 year from now)
            const expiryService = require('../services/expiryService');
            await expiryService.setRegistrationExpiry(vehicleId, new Date());
            
            // ✅ ADD: Create BLOCKCHAIN_REGISTERED history entry for certificate generator
            await db.addVehicleHistory({
                vehicleId,
                action: 'BLOCKCHAIN_REGISTERED',
                description: `Vehicle registered on Hyperledger Fabric. TX: ${blockchainTxId}`,
                performedBy: req.user.userId,
                transactionId: blockchainTxId,
                metadata: {
                    source: 'lto_final_approval',
                    orNumber: orNumber,
                    crNumber: crNumber,
                    mvirNumber: mvirNumber,
                    registeredAt: new Date().toISOString(),
                    fabricNetwork: 'ltochannel',
                    chaincode: 'vehicle-registration'
                }
            });
            console.log(`✅ Created BLOCKCHAIN_REGISTERED history entry with txId: ${blockchainTxId}`);
        }

        // Add to history (include separate OR/CR numbers in metadata)
        await db.addVehicleHistory({
            vehicleId,
            action: 'CLEARANCE_APPROVED',
            description: isTransferWorkflow
                ? `Clearance approved by ${req.user.email}. OR: ${orNumber || 'Pending'}, CR: ${crNumber || 'Pending'}, MVIR: ${mvirNumber || 'Pending'}. ${notes || 'All verifications complete.'}`
                : `Clearance approved by ${req.user.email}. OR: ${orNumber || 'Pending'}, CR: ${crNumber || 'Pending'}. ${notes || 'All verifications complete.'}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: { 
                notes,
                blockchainTxId,
                orNumber,
                crNumber,
                orIssuedAt,
                crIssuedAt,
                // Only attach MVIR metadata for transfer workflows
                ...(isTransferWorkflow && {
                    mvirNumber,
                    inspectionDate
                }),
                // Keep backward compatibility
                orCrNumber: orNumber, // For backward compatibility
                orCrIssuedAt: orIssuedAt, // For backward compatibility
                verifications: verifications.map(v => ({ type: v.verification_type, status: v.status }))
            }
        });

        // Create notification for owner (include separate OR/CR numbers)
        if (vehicle.owner_id) {
            await db.createNotification({
                userId: vehicle.owner_id,
                title: 'Vehicle Registration Approved',
                message: `Your vehicle registration (${vehicle.plate_number || vehicle.vin}) has been approved! OR: ${orNumber || 'Processing'}, CR: ${crNumber || 'Processing'}`,
                type: 'success'
            });
        }

        // Return response with separate OR/CR numbers and MVIR
        res.json({
            success: true,
            message: 'Clearance approved successfully',
            vehicleId,
            orNumber,
            crNumber,
            orIssuedAt,
            crIssuedAt,
            // Only surface MVIR values to callers when the approval is part of a transfer workflow
            mvirNumber: isTransferWorkflow ? (mvirNumber || null) : null,
            inspectionDate: isTransferWorkflow ? (inspectionDate || null) : null,
            // Backward compatibility
            orCrNumber: orNumber, // For backward compatibility
            orCrIssuedAt: orIssuedAt, // For backward compatibility
            blockchainTxId,
            status: blockchainTxId ? 'REGISTERED' : 'APPROVED'
        });

    } catch (error) {
        console.error('Error approving clearance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve clearance: ' + error.message
        });
    }
});

// Scrap/retire a vehicle (admin only)
router.post('/scrap/:vehicleId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { scrapReason } = req.body;
        
        if (!scrapReason) {
            return res.status(400).json({
                success: false,
                error: 'Scrap reason is required'
            });
        }
        
        // Get vehicle
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }
        
        // Cannot scrap already scrapped vehicles
        if (vehicle.status === 'SCRAPPED') {
            return res.status(400).json({
                success: false,
                error: 'Vehicle is already scrapped'
            });
        }
        
        // Call chaincode to scrap on blockchain
        const blockchainResult = await fabricService.scrapVehicle(vehicle.vin, scrapReason);
        
        // Update PostgreSQL
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE vehicles 
             SET status = 'SCRAPPED', 
                 scrapped_at = NOW(), 
                 scrap_reason = $1,
                 scrapped_by = $2,
                 last_updated = NOW()
             WHERE id = $3`,
            [scrapReason, req.user.userId, vehicleId]
        );
        
        // Revoke any active OR records
        await dbModule.query(
            `UPDATE certificates 
             SET status = 'REVOKED'
             WHERE vehicle_id = $1 AND status = 'ACTIVE'`,
            [vehicleId]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId,
            action: 'VEHICLE_SCRAPPED',
            description: `Vehicle scrapped: ${scrapReason}`,
            performedBy: req.user.userId,
            transactionId: blockchainResult.transactionId,
            metadata: JSON.stringify({
                scrapReason,
                blockchainTxId: blockchainResult.transactionId
            })
        });
        
        res.json({
            success: true,
            message: 'Vehicle scrapped successfully',
            transactionId: blockchainResult.transactionId
        });
        
    } catch (error) {
        console.error('Scrap vehicle error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to scrap vehicle'
        });
    }
});

module.exports = router;

