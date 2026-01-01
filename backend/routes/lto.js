// TrustChain LTO - LTO Admin Routes
// Handles LTO admin actions: sending clearance requests, approving clearances

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fabricService = require('../services/optimizedFabricService');

// Send clearance request to HPG
router.post('/send-to-hpg', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, purpose, notes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
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

        // Check if HPG request already exists
        const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        const existingHPGRequest = existingRequests.find(r => r.request_type === 'hpg' && r.status !== 'REJECTED' && r.status !== 'COMPLETED');
        
        if (existingHPGRequest) {
            return res.status(409).json({
                success: false,
                error: 'HPG clearance request already exists for this vehicle',
                requestId: existingHPGRequest.id
            });
        }

        // Find HPG admin user (or assign to first admin if no HPG user exists)
        // Note: 'hpg_admin' role doesn't exist in enum, so we check by email pattern
        const dbModule = require('../database/db');
        const hpgAdmins = await dbModule.query(
            "SELECT id FROM users WHERE email LIKE '%hpg%' OR (role = 'admin' AND email LIKE '%hpg%') LIMIT 1"
        );
        const assignedTo = hpgAdmins.rows[0]?.id || null;

        // Get the vehicle's documents (owner ID, OR/CR only - HPG specific)
        const documents = await db.getDocumentsByVehicle(vehicleId);
        
        // Find Owner ID document
        const ownerIdDoc = documents.find(d => 
            d.document_type === 'owner_id' || 
            d.document_type === 'ownerId' ||
            (d.original_name && d.original_name.toLowerCase().includes('id'))
        );
        
        // Find OR/CR (Official Receipt / Certificate of Registration) document
        const orCrDoc = documents.find(d => 
            d.document_type === 'or_cr' || 
            d.document_type === 'registration_cert' || 
            d.document_type === 'registrationCert' ||
            d.document_type === 'registration' ||
            (d.original_name && (
                d.original_name.toLowerCase().includes('or_cr') ||
                d.original_name.toLowerCase().includes('or-cr') ||
                d.original_name.toLowerCase().includes('orcr') ||
                d.original_name.toLowerCase().includes('registration')
            ))
        );

        // HPG only receives: Owner ID and OR/CR documents
        // Filter to include ONLY documents relevant to HPG (not emission, insurance, etc.)
        const hpgRelevantDocTypes = ['owner_id', 'ownerId', 'or_cr', 'registration_cert', 'registrationCert', 'registration'];
        const hpgDocuments = documents.filter(d => {
            // Include if document type matches HPG-relevant types
            if (hpgRelevantDocTypes.includes(d.document_type)) {
                return true;
            }
            // Also check filename for OR/CR or ID
            if (d.original_name) {
                const filename = d.original_name.toLowerCase();
                return filename.includes('id') || 
                       filename.includes('or_cr') || 
                       filename.includes('or-cr') || 
                       filename.includes('orcr') ||
                       filename.includes('registration');
            }
            return false;
        });

        console.log(`[LTO→HPG] Sending ${hpgDocuments.length} documents to HPG (filtered from ${documents.length} total)`);
        console.log(`[LTO→HPG] Document types sent: ${hpgDocuments.map(d => d.document_type).join(', ')}`);

        // Create clearance request with ONLY HPG-relevant document references
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'hpg',
            requestedBy: req.user.userId,
            purpose: purpose || 'Vehicle clearance verification',
            notes: notes || null,
            metadata: {
                vehicleVin: vehicle.vin,
                vehiclePlate: vehicle.plate_number,
                vehicleMake: vehicle.make,
                vehicleModel: vehicle.model,
                vehicleYear: vehicle.year,
                vehicleColor: vehicle.color,
                engineNumber: vehicle.engine_number,
                chassisNumber: vehicle.chassis_number,
                ownerName: vehicle.owner_name,
                ownerEmail: vehicle.owner_email,
                // Include ONLY HPG-relevant document references
                ownerIdDocId: ownerIdDoc?.id || null,
                ownerIdDocCid: ownerIdDoc?.ipfs_cid || null,
                ownerIdDocPath: ownerIdDoc?.file_path || null,
                ownerIdDocFilename: ownerIdDoc?.original_name || null,
                orCrDocId: orCrDoc?.id || null,
                orCrDocCid: orCrDoc?.ipfs_cid || null,
                orCrDocPath: orCrDoc?.file_path || null,
                orCrDocFilename: orCrDoc?.original_name || null,
                // ONLY include HPG-relevant documents (Owner ID and OR/CR)
                documents: hpgDocuments.map(d => ({
                    id: d.id,
                    type: d.document_type,
                    cid: d.ipfs_cid,
                    path: d.file_path,
                    filename: d.original_name
                }))
            },
            assignedTo
        });

        // Don't update vehicle status - keep it as SUBMITTED
        // The clearance request status is tracked separately in clearance_requests table
        // Vehicle status will be updated when clearance is approved/rejected

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'HPG_CLEARANCE_REQUESTED',
            description: `HPG clearance requested by ${req.user.email}. Purpose: ${purpose || 'Vehicle clearance verification'}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { clearanceRequestId: clearanceRequest.id }
        });

        // Create notification for HPG admin (if assigned)
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: 'New HPG Clearance Request',
                message: `New clearance request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'info'
            });
        }

        res.json({
            success: true,
            message: 'HPG clearance request sent successfully',
            requestId: clearanceRequest.id,
            clearanceRequest
        });

    } catch (error) {
        console.error('Error sending HPG clearance request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send HPG clearance request: ' + error.message
        });
    }
});

// Send insurance verification request
router.post('/send-to-insurance', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, purpose, notes } = req.body;
        
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

        // Check if insurance request already exists
        const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        const existingInsuranceRequest = existingRequests.find(r => r.request_type === 'insurance' && r.status !== 'REJECTED' && r.status !== 'COMPLETED');
        
        if (existingInsuranceRequest) {
            return res.status(409).json({
                success: false,
                error: 'Insurance verification request already exists for this vehicle',
                requestId: existingInsuranceRequest.id
            });
        }

        // Find insurance verifier
        const dbModule = require('../database/db');
        const insuranceVerifiers = await dbModule.query(
            "SELECT id FROM users WHERE role = 'insurance_verifier' LIMIT 1"
        );
        const assignedTo = insuranceVerifiers.rows[0]?.id || null;

        // Get the insurance document from the vehicle's documents
        // Insurance verifier ONLY receives Insurance Certificate - nothing else
        const allDocuments = await db.getDocumentsByVehicle(vehicleId);
        const insuranceDoc = allDocuments.find(d => 
            d.document_type === 'insurance_cert' || 
            d.document_type === 'insuranceCert' ||
            d.document_type === 'insurance' ||
            (d.original_name && d.original_name.toLowerCase().includes('insurance'))
        );

        // Filter to include ONLY insurance document (not OR/CR, emission, owner ID, etc.)
        const insuranceDocuments = insuranceDoc ? [{
            id: insuranceDoc.id,
            type: insuranceDoc.document_type,
            cid: insuranceDoc.ipfs_cid,
            path: insuranceDoc.file_path,
            filename: insuranceDoc.original_name
        }] : [];

        console.log(`[LTO→Insurance] Sending ${insuranceDocuments.length} document(s) to Insurance (filtered from ${allDocuments.length} total)`);
        console.log(`[LTO→Insurance] Document type sent: ${insuranceDoc?.document_type || 'none'}`);

        // Create clearance request with ONLY insurance document reference
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'insurance',
            requestedBy: req.user.userId,
            purpose: purpose || 'Insurance verification',
            notes: notes || null,
            metadata: {
                vehicleVin: vehicle.vin,
                vehiclePlate: vehicle.plate_number,
                vehicleMake: vehicle.make,
                vehicleModel: vehicle.model,
                vehicleYear: vehicle.year,
                ownerName: vehicle.owner_name,
                ownerEmail: vehicle.owner_email,
                // Include ONLY insurance document reference for verifier
                documentId: insuranceDoc?.id || null,
                documentCid: insuranceDoc?.ipfs_cid || null,
                documentPath: insuranceDoc?.file_path || null,
                documentType: insuranceDoc?.document_type || null,
                documentFilename: insuranceDoc?.original_name || null,
                // Documents array for consistency with HPG structure
                documents: insuranceDocuments
            },
            assignedTo
        });

        // Update vehicle verification status
        await db.updateVerificationStatus(vehicleId, 'insurance', 'PENDING', null, null);

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'INSURANCE_VERIFICATION_REQUESTED',
            description: `Insurance verification requested by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { clearanceRequestId: clearanceRequest.id, documentId: insuranceDoc?.id }
        });

        // Create notification
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: 'New Insurance Verification Request',
                message: `New insurance verification request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'info'
            });
        }

        res.json({
            success: true,
            message: 'Insurance verification request sent successfully',
            requestId: clearanceRequest.id,
            clearanceRequest,
            documentIncluded: !!insuranceDoc
        });

    } catch (error) {
        console.error('Error sending insurance verification request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send insurance verification request: ' + error.message
        });
    }
});

// Send emission verification request
router.post('/send-to-emission', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, purpose, notes } = req.body;
        
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

        // Check if emission request already exists
        const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        const existingEmissionRequest = existingRequests.find(r => r.request_type === 'emission' && r.status !== 'REJECTED' && r.status !== 'COMPLETED');
        
        if (existingEmissionRequest) {
            return res.status(409).json({
                success: false,
                error: 'Emission verification request already exists for this vehicle',
                requestId: existingEmissionRequest.id
            });
        }

        // Find emission verifier
        const dbModule = require('../database/db');
        const emissionVerifiers = await dbModule.query(
            "SELECT id FROM users WHERE role = 'emission_verifier' LIMIT 1"
        );
        const assignedTo = emissionVerifiers.rows[0]?.id || null;

        // Get the emission document from the vehicle's documents
        // Emission verifier ONLY receives Emission Certificate - nothing else
        const allDocuments = await db.getDocumentsByVehicle(vehicleId);
        const emissionDoc = allDocuments.find(d => 
            d.document_type === 'emission_cert' || 
            d.document_type === 'emissionCert' ||
            d.document_type === 'emission' ||
            (d.original_name && d.original_name.toLowerCase().includes('emission'))
        );

        // Filter to include ONLY emission document (not OR/CR, insurance, owner ID, etc.)
        const emissionDocuments = emissionDoc ? [{
            id: emissionDoc.id,
            type: emissionDoc.document_type,
            cid: emissionDoc.ipfs_cid,
            path: emissionDoc.file_path,
            filename: emissionDoc.original_name
        }] : [];

        console.log(`[LTO→Emission] Sending ${emissionDocuments.length} document(s) to Emission (filtered from ${allDocuments.length} total)`);
        console.log(`[LTO→Emission] Document type sent: ${emissionDoc?.document_type || 'none'}`);

        // Create clearance request with ONLY emission document reference
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'emission',
            requestedBy: req.user.userId,
            purpose: purpose || 'Emission test verification',
            notes: notes || null,
            metadata: {
                vehicleVin: vehicle.vin,
                vehiclePlate: vehicle.plate_number,
                vehicleMake: vehicle.make,
                vehicleModel: vehicle.model,
                vehicleYear: vehicle.year,
                ownerName: vehicle.owner_name,
                ownerEmail: vehicle.owner_email,
                // Include ONLY emission document reference for verifier
                documentId: emissionDoc?.id || null,
                documentCid: emissionDoc?.ipfs_cid || null,
                documentPath: emissionDoc?.file_path || null,
                documentType: emissionDoc?.document_type || null,
                documentFilename: emissionDoc?.original_name || null,
                // Documents array for consistency with HPG structure
                documents: emissionDocuments
            },
            assignedTo
        });

        // Update vehicle verification status
        await db.updateVerificationStatus(vehicleId, 'emission', 'PENDING', null, null);

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'EMISSION_VERIFICATION_REQUESTED',
            description: `Emission verification requested by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { clearanceRequestId: clearanceRequest.id, documentId: emissionDoc?.id }
        });

        // Create notification
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: 'New Emission Verification Request',
                message: `New emission verification request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'info'
            });
        }

        res.json({
            success: true,
            message: 'Emission verification request sent successfully',
            requestId: clearanceRequest.id,
            clearanceRequest,
            documentIncluded: !!emissionDoc
        });

    } catch (error) {
        console.error('Error sending emission verification request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send emission verification request: ' + error.message
        });
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

        // Auto-generate inspection if missing (Option A: Auto-inspection on approval)
        let mvirNumber = vehicle.mvir_number;
        let inspectionDate = vehicle.inspection_date;
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
                    inspectionNotes: 'Auto-generated during approval process'
                });
                
                mvirNumber = inspectionResult.mvirNumber;
                inspectionDate = inspectionResult.inspectionDate;
                
                console.log(`[LTO Approval] Auto-generated inspection: MVIR ${mvirNumber}`);
                
                // Log auto-inspection to vehicle history
                await db.addVehicleHistory({
                    vehicleId,
                    action: 'LTO_INSPECTION_AUTO_GENERATED',
                    description: `LTO inspection auto-generated during approval. MVIR: ${mvirNumber}`,
                    performedBy: req.user.userId,
                    transactionId: null,
                    metadata: {
                        mvirNumber,
                        autoGenerated: true
                    }
                });
            } catch (inspectionError) {
                // Log error but don't fail approval - inspection can be added manually later
                console.warn(`[LTO Approval] Failed to auto-generate inspection: ${inspectionError.message}`);
                console.warn('   Approval will proceed without inspection. Inspection can be added manually.');
            }
        } else {
            console.log(`[LTO Approval] Vehicle already has inspection: MVIR ${vehicle.mvir_number}`);
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
            description: `Clearance approved by ${req.user.email}. OR: ${orNumber || 'Pending'}, CR: ${crNumber || 'Pending'}, MVIR: ${mvirNumber || 'Pending'}. ${notes || 'All verifications complete.'}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: { 
                notes,
                blockchainTxId,
                orNumber,
                crNumber,
                orIssuedAt,
                crIssuedAt,
                mvirNumber,
                inspectionDate,
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
            mvirNumber: mvirNumber || null,
            inspectionDate: inspectionDate || null,
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

module.exports = router;

