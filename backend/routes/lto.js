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
const { sendMail } = require('../services/gmailApiService');
const crypto = require('crypto');
const certificateBlockchain = require('../services/certificateBlockchainService');
const dbModule = require('../database/db');
const { REGISTRATION_ACTIONS, normalizeAction } = require('../config/actionConstants');
const { validateVehicleStatusTransition } = require('../middleware/statusValidation');

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
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can conduct inspections)
router.post('/inspect', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const { vehicleId, inspectionResult, roadworthinessStatus, inspectionOfficer, inspectionNotes, documentReferences } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        // Validate required fields
        if (!inspectionResult || !roadworthinessStatus) {
            return res.status(400).json({
                success: false,
                error: 'Inspection result and roadworthiness status are required'
            });
        }

        // Validate values
        const validResults = ['PASS', 'FAIL', 'PENDING'];
        const validRoadworthiness = ['ROADWORTHY', 'NOT_ROADWORTHY'];

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

        // Assign MVIR number and inspection data (writes mvir_number, inspection_date, etc. to vehicles table)
        const inspectionResult_data = await db.assignMvirNumber(vehicleId, {
            inspectionResult,
            roadworthinessStatus,
            inspectionOfficer: officerName,
            inspectionNotes: inspectionNotes || null
        });

        // Issue MVIR certificate at inspection time so later transfers can validate against it.
        // This mirrors the issued_certificates write in certificate-generation, but is now anchored to LTO inspection.
        try {
            if (documentReferences && documentReferences.mvirDocument && documentReferences.mvirDocument.filename) {
                const mvirFilePath = path.join(inspectionDocsDir, documentReferences.mvirDocument.filename);
                if (fs.existsSync(mvirFilePath)) {
                    const fileBuffer = fs.readFileSync(mvirFilePath);
                    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

                    const issueDateIso = inspectionResult_data.inspectionDate || new Date().toISOString();
                    const compositeHash = certificateBlockchain.generateCompositeHash(
                        inspectionResult_data.mvirNumber,
                        vehicle.vin,
                        issueDateIso,
                        fileHash
                    );

                    // MVIR is stored in issued_certificates as type 'hpg_clearance' (both are vehicle clearance docs),
                    // using an issuer with issuer_type 'hpg' as in transfer certificate generation.
                    const issuerQuery = await dbModule.query(
                        `SELECT id FROM external_issuers WHERE issuer_type = $1 AND is_active = true LIMIT 1`,
                        ['hpg']
                    );

                    if (issuerQuery.rows.length > 0) {
                        const issuerId = issuerQuery.rows[0].id;

                        const metadata = {
                            originalCertificateType: 'mvir_cert',
                            inspectionResult,
                            roadworthinessStatus,
                            inspectionOfficer: officerName,
                            inspectionNotes: inspectionNotes || null
                        };

                        await dbModule.query(
                            `INSERT INTO issued_certificates 
                             (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                              file_hash, composite_hash, issued_at, expires_at, metadata)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                            [
                                issuerId,
                                'hpg_clearance', // DB-allowed type for MVIR certificates
                                inspectionResult_data.mvirNumber,
                                vehicle.vin,
                                null, // owner_name optional; can be enriched later if needed
                                fileHash,
                                compositeHash,
                                issueDateIso,
                                null,
                                JSON.stringify(metadata)
                            ]
                        );
                        console.log(`[LTO Inspection] ✅ Issued MVIR certificate ${inspectionResult_data.mvirNumber} for VIN ${vehicle.vin}`);
                    } else {
                        console.warn('[LTO Inspection] ⚠️ No active issuer found for MVIR (issuer_type=hpg); skipping issued_certificates write');
                    }
                } else {
                    console.warn('[LTO Inspection] ⚠️ MVIR document file not found at path:', mvirFilePath);
                }
            } else {
                console.warn('[LTO Inspection] ⚠️ No MVIR document reference provided; skipping MVIR issued_certificates write');
            }
        } catch (certError) {
            console.error('[LTO Inspection] ❌ Error issuing MVIR certificate:', certError.message);
            // Do not fail the inspection if certificate issuance fails.
        }

        // Log inspection to vehicle history
        await db.addVehicleHistory({
            vehicleId,
            action: 'LTO_INSPECTION_COMPLETED',
            description: `LTO inspection completed. Result: ${inspectionResult}, Roadworthiness: ${roadworthinessStatus}. MVIR: ${inspectionResult_data.mvirNumber}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                mvirNumber: inspectionResult_data.mvirNumber,
                inspectionResult,
                roadworthinessStatus,
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
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can upload inspection documents)
router.post('/inspect-documents', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), upload.any(), async (req, res) => {
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
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can approve clearances)
router.post('/approve-clearance', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
        
        // Log validation check for debugging
        console.log(`[LTO Approval] Checking verifications for vehicle ${vehicleId}:`, {
            hpg: hpgRequest ? hpgRequest.status : 'MISSING',
            insurance: insuranceVerification ? insuranceVerification.status : 'MISSING',
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

        // Register vehicle on blockchain (with OR/CR numbers and documents)
        // CRITICAL: Blockchain registration is MANDATORY for vehicle registration
        // If blockchain fails, the entire approval must fail (blockchain is source of truth)
        let blockchainTxId = null;
        
        // STRICT FABRIC: Enforce real blockchain service - NO FALLBACKS ALLOWED
        const blockchainMode = process.env.BLOCKCHAIN_MODE || 'fabric';
        if (blockchainMode !== 'fabric') {
            console.error('❌ CRITICAL: BLOCKCHAIN_MODE must be "fabric". No fallback mode allowed.');
            return res.status(500).json({
                success: false,
                error: 'Blockchain mode invalid',
                message: 'BLOCKCHAIN_MODE must be set to "fabric". System requires real Hyperledger Fabric network. No fallback modes allowed.'
            });
        }
        
        // Validate Fabric connection - MANDATORY
        if (!fabricService.isConnected || fabricService.mode !== 'fabric') {
            return res.status(503).json({
                success: false,
                error: 'Blockchain service unavailable',
                message: 'Cannot approve vehicle: Hyperledger Fabric network is not connected. Please ensure the blockchain network is running.'
            });
        }
        
        // Blockchain is ALWAYS required - proceed with registration
        {
            
            try {
                // Fetch vehicle documents and build document CIDs object
                const documents = await db.getDocumentsByVehicle(vehicleId);
                const documentCids = {};
                const docTypes = require('../config/documentTypes');
                
                for (const doc of documents) {
                    if (doc.ipfs_cid) {
                        // Map database type to logical type
                        const logicalType = docTypes.mapToLogicalType(doc.document_type);
                        
                        // Only include valid logical types (exclude 'other')
                        if (logicalType && logicalType !== 'other' && docTypes.isValidLogicalType(logicalType)) {
                            documentCids[logicalType] = {
                                cid: doc.ipfs_cid,
                                filename: doc.filename || doc.original_name || 'unknown',
                                documentType: doc.document_type
                            };
                        }
                    }
                }
                
                console.log(`[LTO Approval] Prepared ${Object.keys(documentCids).length} document(s) for blockchain registration`);
                
                // Get owner user details for blockchain record
                let ownerData = vehicle.owner_name || vehicle.owner_email;
                if (vehicle.owner_id) {
                    try {
                        const ownerUser = await db.getUserById(vehicle.owner_id);
                        if (ownerUser) {
                            ownerData = {
                                id: ownerUser.id,
                                email: ownerUser.email,
                                firstName: ownerUser.first_name || '',
                                lastName: ownerUser.last_name || ''
                            };
                        }
                    } catch (ownerError) {
                        console.warn(`[LTO Approval] Could not fetch owner user details: ${ownerError.message}`);
                    }
                }
                
                // Fetch current user to get employee_id
                const currentUser = await db.getUserById(req.user.userId);
                
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
                    owner: ownerData, // Include owner as object (not just email)
                    orNumber: orNumber, // Include separate OR number in blockchain record
                    crNumber: crNumber, // Include separate CR number in blockchain record
                    documents: documentCids, // Include document CIDs
                    // Include officer information for traceability (with employee_id)
                    officerInfo: {
                        userId: req.user.userId,
                        email: req.user.email,
                        name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                        employeeId: currentUser?.employee_id || null
                    }
                };

                // Check if vehicle already exists on blockchain (migration concern)
                let vehicleExists = false;
                try {
                    const existingVehicle = await fabricService.getVehicle(vehicle.vin);
                    if (existingVehicle && existingVehicle.success && existingVehicle.vehicle) {
                        vehicleExists = true;
                        // Get transaction ID from existing vehicle
                        blockchainTxId = existingVehicle.vehicle.blockchainTxId || 
                                        existingVehicle.vehicle.transactionId ||
                                        existingVehicle.vehicle.lastTxId ||
                                        existingVehicle.vehicle.history?.[0]?.transactionId ||
                                        null;
                        
                        if (blockchainTxId) {
                            console.log(`[LTO Approval] Vehicle already exists on blockchain. Using existing transaction ID: ${blockchainTxId}`);
                        } else {
                            console.warn(`[LTO Approval] Vehicle exists on blockchain but no transaction ID found`);
                        }
                    }
                } catch (queryError) {
                    // Vehicle doesn't exist on blockchain - proceed with registration
                    vehicleExists = false;
                }
                
                // Only register if vehicle doesn't exist
                if (!vehicleExists) {
                    const result = await fabricService.registerVehicle(vehicleData);
                    blockchainTxId = result.transactionId;
                    
                    if (!blockchainTxId) {
                        throw new Error('Blockchain registration completed but no transaction ID returned');
                    }
                    
                    console.log(`[LTO Approval] Vehicle registered on blockchain. Transaction ID: ${blockchainTxId}`);
                } else {
                    console.log(`[LTO Approval] Vehicle already on blockchain. Skipping registration. Status will be updated to REGISTERED.`);
                }
            } catch (blockchainError) {
                const errorMessage = blockchainError.message || blockchainError.toString();
                const isAlreadyExists = errorMessage.includes('already exists') || 
                                       (errorMessage.includes('Vehicle with VIN') && errorMessage.includes('already exists'));
                
                if (isAlreadyExists) {
                    // Vehicle already exists - try to get transaction ID
                    console.log(`[LTO Approval] Vehicle already exists on blockchain. Attempting to retrieve transaction ID...`);
                    try {
                        const existingVehicle = await fabricService.getVehicle(vehicle.vin);
                        if (existingVehicle && existingVehicle.success && existingVehicle.vehicle) {
                            blockchainTxId = existingVehicle.vehicle.blockchainTxId || 
                                            existingVehicle.vehicle.transactionId ||
                                            existingVehicle.vehicle.lastTxId ||
                                            existingVehicle.vehicle.history?.[0]?.transactionId ||
                                            null;
                            
                            if (blockchainTxId) {
                                console.log(`[LTO Approval] Recovered transaction ID from existing blockchain record: ${blockchainTxId}`);
                            } else {
                                throw new Error('Vehicle exists on blockchain but no transaction ID found');
                            }
                        } else {
                            throw new Error('Vehicle exists on blockchain but could not retrieve details');
                        }
                    } catch (queryError) {
                        console.error(`[LTO Approval] Failed to query existing vehicle from blockchain:`, queryError.message);
                        return res.status(500).json({
                            success: false,
                            error: 'Blockchain query failed',
                            message: `Cannot approve vehicle: ${queryError.message}. Please try again or contact support.`
                        });
                    }
                } else {
                    // Blockchain registration failed - this is CRITICAL
                    console.error('❌ CRITICAL: Failed to register vehicle on blockchain:', blockchainError);
                    return res.status(500).json({
                        success: false,
                        error: 'Blockchain registration failed',
                        message: `Cannot approve vehicle: ${blockchainError.message}. The vehicle registration must be recorded on the blockchain. Please try again or contact support if the issue persists.`
                    });
                }
            }
        }
        
        // STRICT FABRIC: Validate blockchain transaction ID exists - MANDATORY
        if (!blockchainTxId) {
            console.error('❌ CRITICAL: Blockchain transaction ID missing after registration');
            return res.status(500).json({
                success: false,
                error: 'Blockchain transaction ID missing',
                message: 'Registration completed but blockchain transaction ID was not recorded. This should not happen. Please contact support.'
            });
        }

        // PHASE 1 FIX: Validate blockchain transaction ID format
        // Fabric transaction IDs are 64-character hexadecimal strings (no hyphens)
        // UUIDs contain hyphens and are NOT blockchain transaction IDs
        const isValidBlockchainTxId = blockchainTxId && 
                                     typeof blockchainTxId === 'string' &&
                                     blockchainTxId.length >= 40 && 
                                     blockchainTxId.length <= 255 &&
                                     !blockchainTxId.includes('-') &&
                                     /^[0-9a-fA-F]+$/.test(blockchainTxId);
        
        if (!isValidBlockchainTxId) {
            console.error('❌ CRITICAL: Invalid blockchain transaction ID format:', {
                blockchainTxId,
                length: blockchainTxId?.length,
                containsHyphens: blockchainTxId?.includes('-'),
                type: typeof blockchainTxId
            });
            return res.status(500).json({
                success: false,
                error: 'Invalid blockchain transaction ID format',
                message: 'Blockchain transaction ID does not match expected format. This indicates a system error. Please contact support.'
            });
        }

        // PHASE 3: Validate vehicle status transition before updating
        const currentVehicle = await db.getVehicleById(vehicleId);
        if (currentVehicle) {
            const statusValidation = validateVehicleStatusTransition(currentVehicle.status, 'REGISTERED');
            if (!statusValidation.valid) {
                console.error(`[Phase 3] Invalid status transition: ${currentVehicle.status} → REGISTERED`, statusValidation.error);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status transition',
                    message: statusValidation.error,
                    currentStatus: currentVehicle.status,
                    newStatus: 'REGISTERED'
                });
            }
        }

        // PHASE 1 FIX: Update vehicle status to REGISTERED and save blockchain transaction ID
        // This ensures consistency with transfer workflow and improves certificate generator performance
        // The blockchainTxId is saved to vehicles.blockchain_tx_id column for direct access
        // (previously only saved to vehicle_history, requiring slower lookup)
        try {
            await db.updateVehicle(vehicleId, {
                status: 'REGISTERED',
                blockchainTxId: blockchainTxId  // Save blockchain transaction ID (MANDATORY - always required)
            });
            console.log(`✅ [Phase 1] Vehicle ${vehicleId} updated: status=REGISTERED, blockchainTxId=${blockchainTxId.substring(0, 20)}...`);
        } catch (updateError) {
            // CRITICAL: If vehicle update fails, we cannot proceed
            // The blockchain registration succeeded, but database update failed
            // This is a data consistency issue that must be resolved
            console.error('❌ CRITICAL: Failed to update vehicle with blockchain transaction ID:', {
                vehicleId,
                blockchainTxId: blockchainTxId.substring(0, 20) + '...',
                error: updateError.message,
                stack: updateError.stack
            });
            return res.status(500).json({
                success: false,
                error: 'Database update failed',
                message: 'Vehicle was registered on blockchain but failed to update database. This is a critical error. Please contact support immediately.',
                details: {
                    vehicleId,
                    blockchainTxId: blockchainTxId.substring(0, 20) + '...',
                    error: updateError.message
                }
            });
        }
        
        // Set registration expiry (1 year from now)
        const expiryService = require('../services/expiryService');
        await expiryService.setRegistrationExpiry(vehicleId, new Date());
        
        // PHASE 3: Create BLOCKCHAIN_REGISTERED history entry with standardized action name
        await db.addVehicleHistory({
            vehicleId,
            action: REGISTRATION_ACTIONS.BLOCKCHAIN_REGISTERED, // PHASE 3: Use standardized action constant
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
        console.log(`✅ [Phase 3] Created BLOCKCHAIN_REGISTERED history entry with txId: ${blockchainTxId}`);

        // Send approval email to owner (only on successful blockchain registration)
        try {
                if (vehicle.owner_id) {
                    const ownerUser = await db.getUserById(vehicle.owner_id);
                    const ownerEmail = ownerUser?.email || vehicle.owner_email;
                    const ownerName = ownerUser ? `${ownerUser.first_name || ''} ${ownerUser.last_name || ''}`.trim() : (vehicle.owner_name || 'Owner');
                    if (ownerEmail) {
                        const appBaseUrl = process.env.APP_BASE_URL || 'https://ltoblockchain.duckdns.org';
                        const subject = 'Vehicle Registration Approved';
                        const statusLabel = blockchainTxId ? 'REGISTERED' : 'APPROVED';
                        const trackUrl = `${appBaseUrl}`;
                        const downloadNote = 'You can download your OR/CR by logging in to your account.';

                        const text = `
Dear ${ownerName || 'Owner'},

Your vehicle registration has been ${statusLabel}.

Details:
- VIN: ${vehicle.vin}
- Plate Number: ${vehicle.plate_number || vehicle.plateNumber || 'Pending'}
- OR: ${orNumber || 'Pending'}
- CR: ${crNumber || 'Pending'}
- Blockchain Tx: ${blockchainTxId}

${downloadNote}
Track status: ${trackUrl}

Thank you,
TrustChain LTO Team
                        `.trim();

                        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
        .email-container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
        .header { background: #667eea; color: #ffffff; padding: 20px 24px; }
        .header h1 { margin: 0; font-size: 22px; }
        .content { padding: 24px; color: #374151; }
        .content p { line-height: 1.6; margin: 0 0 12px 0; }
        .details { background: #f8fafc; border-left: 4px solid #667eea; padding: 16px; border-radius: 6px; margin: 16px 0; }
        .details p { margin: 6px 0; font-size: 14px; }
        .details strong { color: #111827; }
        .button { display: inline-block; padding: 12px 18px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 8px; margin: 12px 0; font-weight: 600; }
        .footer { padding: 16px 24px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div style="padding: 16px;">
        <div class="email-container">
            <div class="header">
                <h1>Vehicle Registration ${statusLabel}</h1>
            </div>
            <div class="content">
                <p>Dear ${ownerName || 'Owner'},</p>
                <p>Your vehicle registration has been <strong>${statusLabel}</strong>.</p>
                <div class="details">
                    <p><strong>VIN:</strong> ${vehicle.vin}</p>
                    <p><strong>Plate Number:</strong> ${vehicle.plate_number || vehicle.plateNumber || 'Pending'}</p>
                    <p><strong>OR Number:</strong> ${orNumber || 'Pending'}</p>
                    <p><strong>CR Number:</strong> ${crNumber || 'Pending'}</p>
                    <p><strong>Blockchain Tx:</strong> ${blockchainTxId}</p>
                </div>
                <p>${downloadNote}</p>
                <p style="text-align: center;">
                    <a href="${trackUrl}" class="button">Track Status</a>
                </p>
                <p>Thank you for using TrustChain LTO System.</p>
            </div>
            <div class="footer">
                <p>TrustChain LTO Team</p>
            </div>
        </div>
    </div>
</body>
</html>
                        `.trim();

                        await sendMail({ to: ownerEmail, subject, text, html });
                        console.log('✅ Approval email sent to owner:', ownerEmail);
                    } else {
                        console.warn('⚠️ No owner email available, skipping approval email');
                    }
                }
        } catch (emailError) {
            console.error('❌ Failed to send approval email:', emailError);
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

// Scrap/retire a vehicle (admin and lto_admin only - officers cannot scrap vehicles)
// STRICT: Only admin and lto_admin can scrap vehicles (officers do not have this authority)
router.post('/scrap/:vehicleId', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
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

