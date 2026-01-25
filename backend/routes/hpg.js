// TrustChain LTO - HPG Admin Routes
// Handles HPG clearance verification and certificate release

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const storageService = require('../services/storageService');
const autoVerificationService = require('../services/autoVerificationService');
const certificateBlockchain = require('../services/certificateBlockchainService');
const crypto = require('crypto');
const fs = require('fs').promises;
const { CLEARANCE_STATUS, normalizeStatusLower, normalizeStatus, isValidClearanceStatus } = require('../config/statusConstants');
const { HPG_ACTIONS, normalizeAction } = require('../config/actionConstants');
const { validateClearanceStatusTransition } = require('../middleware/statusValidation');

// Get HPG dashboard statistics
router.get('/stats', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        // Get all HPG requests
        const requests = await db.getClearanceRequestsByType('hpg');
        
        // Count by status (using normalized status for consistent comparison)
        const stats = {
            pending: requests.filter(r => normalizeStatusLower(r.status) === 'pending').length,
            approved: requests.filter(r => normalizeStatusLower(r.status) === 'approved').length,
            completed: requests.filter(r => normalizeStatusLower(r.status) === 'completed').length,
            rejected: requests.filter(r => normalizeStatusLower(r.status) === 'rejected').length
        };

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting HPG stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get HPG stats: ' + error.message
        });
    }
});

// Get all HPG clearance requests
// Note: 'hpg_admin' role doesn't exist in enum, so we allow 'admin' role and check email pattern
router.get('/requests', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { status } = req.query;
        
        console.log(`[HPG API] Getting requests, status filter: ${status || 'none'}`);
        
        let requests;
        if (status) {
            // Normalize status to uppercase (database format) before querying
            // This fixes case sensitivity issues (e.g., 'pending' vs 'PENDING')
            const normalizedStatus = normalizeStatus(status);
            console.log(`[HPG API] Normalized status: ${status} -> ${normalizedStatus}`);
            
            // Validate that the normalized status is a valid clearance status
            if (!normalizedStatus || !isValidClearanceStatus(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid status: "${status}". Valid statuses are: ${Object.values(CLEARANCE_STATUS).join(', ')}`
                });
            }
            
            const allRequests = await db.getClearanceRequestsByStatus(normalizedStatus);
            console.log(`[HPG API] Got ${allRequests.length} requests with status ${normalizedStatus}`);
            requests = allRequests.filter(r => r.request_type === 'hpg');
            console.log(`[HPG API] Filtered to ${requests.length} HPG requests`);
        } else {
            // Get all HPG requests regardless of status
            requests = await db.getClearanceRequestsByType('hpg');
            console.log(`[HPG API] Got ${requests.length} HPG requests (all statuses)`);
        }

        console.log(`[HPG API] Returning ${requests.length} HPG request(s)`);
        if (requests.length > 0) {
            console.log(`[HPG API] Sample request:`, {
                id: requests[0].id,
                request_type: requests[0].request_type,
                status: requests[0].status,
                vehicle_id: requests[0].vehicle_id
            });
        }

        res.json({
            success: true,
            requests: requests,
            total: requests.length
        });

    } catch (error) {
        console.error('[HPG API] Error getting HPG requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get HPG requests: ' + error.message
        });
    }
});

// Get single HPG request by ID
router.get('/requests/:id', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await db.getClearanceRequestById(id);
        if (!request || request.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        // Get vehicle details
        const vehicle = await db.getVehicleById(request.vehicle_id);
        
        // Get owner information for auto-fill
        let owner = null;
        if (vehicle && vehicle.owner_id) {
            owner = await db.getUserById(vehicle.owner_id);
        }
        
        // Extract documents from metadata (filtered by LTO)
        // HPG should ONLY see documents that were explicitly included in metadata.documents
        const metadata = request.metadata || {};
        const documents = metadata.documents || [];
        
        // Extract Phase 1 automation data for auto-fill
        const extractedData = metadata.extractedData || {};
        const databaseCheck = metadata.hpgDatabaseCheck || null;
        const automationPhase1 = metadata.automationPhase1 || null;

        console.log(`[HPG] Returning ${documents.length} document(s) from metadata (filtered by LTO)`);
        console.log(`[HPG] Document types: ${documents.map(d => d.type).join(', ')}`);
        console.log(`[HPG] Phase 1 automation:`, {
            completed: automationPhase1?.completed || false,
            ocrExtracted: automationPhase1?.ocrExtracted || false,
            databaseChecked: automationPhase1?.databaseChecked || false,
            databaseStatus: databaseCheck?.status || 'N/A'
        });

        res.json({
            success: true,
            request: {
                ...request,
                vehicle,
                owner: owner ? {
                    id: owner.id,
                    firstName: owner.first_name,
                    lastName: owner.last_name,
                    email: owner.email,
                    phone: owner.phone,
                    address: owner.address,
                    organization: owner.organization
                } : null,
                certificates: documents, // Return filtered documents as certificates
                documents: documents, // Also include as documents for consistency
                // Phase 1 automation data for auto-fill
                automation: {
                    phase1: automationPhase1,
                    extractedData: Object.keys(extractedData).length > 0 ? extractedData : null,
                    databaseCheck: databaseCheck
                }
            }
        });

    } catch (error) {
        console.error('Error getting HPG request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get HPG request: ' + error.message
        });
    }
});

// Auto-verify HPG clearance with hashing and duplicate detection
router.post('/verify/auto-verify', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId } = req.body;
        
        console.log('🔍 [HPG Auto-Verify API] ==========================================');
        console.log('🔍 [HPG Auto-Verify API] Starting auto-verification request');
        console.log('🔍 [HPG Auto-Verify API] Request ID:', requestId);
        console.log('🔍 [HPG Auto-Verify API] User:', req.user?.userId, req.user?.email);
        
        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: 'Request ID is required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            console.error('❌ [HPG Auto-Verify API] Clearance request not found or not HPG type');
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        console.log('✅ [HPG Auto-Verify API] Clearance request found:', {
            id: clearanceRequest.id,
            vehicle_id: clearanceRequest.vehicle_id,
            status: clearanceRequest.status,
            request_type: clearanceRequest.request_type
        });

        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        if (!vehicle) {
            console.error('❌ [HPG Auto-Verify API] Vehicle not found for ID:', clearanceRequest.vehicle_id);
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        console.log('✅ [HPG Auto-Verify API] Vehicle data:', {
            id: vehicle.id,
            vin: vehicle.vin,
            engine_number: vehicle.engine_number,
            chassis_number: vehicle.chassis_number,
            plate_number: vehicle.plate_number,
            make: vehicle.make,
            model: vehicle.model
        });

        // Get documents from clearance request
        const metadata = typeof clearanceRequest.metadata === 'string' 
            ? JSON.parse(clearanceRequest.metadata) 
            : (clearanceRequest.metadata || {});

        console.log('📄 [HPG Auto-Verify API] Metadata keys:', Object.keys(metadata));
        console.log('📄 [HPG Auto-Verify API] Documents in metadata:', metadata.documents?.length || 0);

        // Get database module (declare once at function level)
        const dbModule = require('../database/db');

        // Build documents array with REAL hashes/paths from DB
        // Priority order:
        // 1) Use metadata.documents array (contains full document objects from transfer forwarding)
        // 2) Use explicit IDs from metadata (buyerHpgDocId for transfers, hpgClearanceDocId for legacy, ownerIdDocId)
        // 3) Fall back to clearance_request_documents join if needed
        let documents = [];

        try {
            // 1) PRIMARY: Use metadata.documents array (from transfer forwarding - contains buyer HPG clearance)
            if (metadata.documents && Array.isArray(metadata.documents) && metadata.documents.length > 0) {
                console.log('📄 [HPG Auto-Verify API] Using metadata.documents array (from transfer forwarding)');
                console.log('📄 [HPG Auto-Verify API] metadata.documents array:', JSON.stringify(metadata.documents.map(d => ({ id: d.id, type: d.type })), null, 2));
                // Fetch full document records from DB using IDs from metadata.documents
                const docIds = metadata.documents
                    .map(d => d.id)
                    .filter(Boolean);
                
                console.log(`📄 [HPG Auto-Verify API] Extracted ${docIds.length} document ID(s) from metadata.documents:`, docIds);
                
                if (docIds.length > 0) {
                    const docResult = await dbModule.query(
                        `SELECT * FROM documents WHERE id = ANY($1::uuid[])`,
                        [docIds]
                    );
                    documents = docResult.rows || [];
                    console.log(`📄 [HPG Auto-Verify API] Loaded ${documents.length} document(s) from metadata.documents array`);
                    console.log('📄 [HPG Auto-Verify API] Loaded document types:', documents.map(d => d.document_type || d.type));
                } else {
                    console.warn('📄 [HPG Auto-Verify API] metadata.documents array exists but no valid IDs found');
                }
            }

            // 2) FALLBACK: Use explicit document IDs from metadata (for transfers: buyerHpgDocId, for legacy: hpgClearanceDocId)
            if (documents.length === 0) {
                // For transfer requests: buyerHpgDocId (buyer's HPG clearance)
                if (metadata.buyerHpgDocId) {
                    console.log('📄 [HPG Auto-Verify API] Using buyerHpgDocId from metadata (transfer request)');
                    const hpgDocResult = await dbModule.query(
                        `SELECT * FROM documents WHERE id = $1`,
                        [metadata.buyerHpgDocId]
                    );
                    if (hpgDocResult.rows.length > 0) {
                        documents.push(hpgDocResult.rows[0]);
                    } else {
                        console.warn('[HPG Auto-Verify API] buyerHpgDocId set but document not found in documents table:', metadata.buyerHpgDocId);
                    }
                }
                // Legacy: hpgClearanceDocId (for non-transfer requests)
                else if (metadata.hpgClearanceDocId) {
                    console.log('📄 [HPG Auto-Verify API] Using hpgClearanceDocId from metadata (legacy)');
                    const hpgDocResult = await dbModule.query(
                        `SELECT * FROM documents WHERE id = $1`,
                        [metadata.hpgClearanceDocId]
                    );
                    if (hpgDocResult.rows.length > 0) {
                        documents.push(hpgDocResult.rows[0]);
                    } else {
                        console.warn('[HPG Auto-Verify API] hpgClearanceDocId set but document not found in documents table:', metadata.hpgClearanceDocId);
                    }
                }

                // Owner ID document (optional, for completeness)
                if (metadata.ownerIdDocId) {
                    const ownerDocResult = await dbModule.query(
                        `SELECT * FROM documents WHERE id = $1`,
                        [metadata.ownerIdDocId]
                    );
                    if (ownerDocResult.rows.length > 0) {
                        // Only add if not already in documents array
                        const existing = documents.find(d => d.id === ownerDocResult.rows[0].id);
                        if (!existing) {
                            documents.push(ownerDocResult.rows[0]);
                        }
                    } else {
                        console.warn('[HPG Auto-Verify API] ownerIdDocId set but document not found in documents table:', metadata.ownerIdDocId);
                    }
                }
            }

            // 3) FINAL FALLBACK: Use clearance_request_documents join if still empty
            if (documents.length === 0) {
                console.log('📄 [HPG Auto-Verify API] No documents from metadata, fetching from clearance_request_documents join...');
                const docResult = await dbModule.query(
                    `SELECT d.* FROM documents d
                     JOIN clearance_request_documents crd ON d.id = crd.document_id
                     WHERE crd.clearance_request_id = $1`,
                    [requestId]
                );
                documents = docResult.rows || [];
                if (documents.length > 0) {
                    console.log(`📄 [HPG Auto-Verify API] Loaded ${documents.length} document(s) from clearance_request_documents join`);
                }
            }
        } catch (docError) {
            console.error('[HPG Auto-Verify API] Error loading documents for auto-verify:', docError);
            // Last resort: use metadata.documents array as-is (may have incomplete data)
            if (metadata.documents && Array.isArray(metadata.documents)) {
                documents = metadata.documents;
            }
        }

        console.log('📄 [HPG Auto-Verify API] Documents to verify:', documents.map(d => ({
            id: d.id,
            document_type: d.document_type || d.type,
            file_path: d.file_path || d.filePath,
            file_hash: d.file_hash || d.fileHash ? (d.file_hash || d.fileHash).substring(0, 16) + '...' : 'NOT SET',
            mime_type: d.mime_type || d.mimeType
        })));

        // Check issued_certificates table for certificate generator data
        const issuedCertCheck = await dbModule.query(
            `SELECT id, certificate_type, certificate_number, vehicle_vin, 
                    file_hash, composite_hash, issued_at, expires_at, 
                    metadata, created_at
             FROM issued_certificates 
             WHERE certificate_type = 'hpg_clearance' 
             ORDER BY created_at DESC 
             LIMIT 5`,
            []
        );
        console.log('📋 [HPG Auto-Verify API] Certificate Generator Data (issued_certificates):');
        console.log('📋 [HPG Auto-Verify API] Found', issuedCertCheck.rows.length, 'HPG certificates in issued_certificates');
        issuedCertCheck.rows.forEach((cert, idx) => {
            console.log(`📋 [HPG Auto-Verify API] Certificate ${idx + 1}:`, {
                id: cert.id,
                certificate_number: cert.certificate_number,
                vehicle_vin: cert.vehicle_vin,
                file_hash: cert.file_hash ? cert.file_hash.substring(0, 16) + '...' : 'NULL',
                composite_hash: cert.composite_hash ? cert.composite_hash.substring(0, 16) + '...' : 'NULL',
                issued_at: cert.issued_at,
                created_at: cert.created_at
            });
        });

        // Use autoVerificationService to perform auto-verification with hashing
        console.log('🚀 [HPG Auto-Verify API] Calling autoVerificationService.autoVerifyHPG...');
        const autoVerifyResult = await autoVerificationService.autoVerifyHPG(
            clearanceRequest.vehicle_id,
            documents,
            vehicle
        );
        
        console.log('✅ [HPG Auto-Verify API] Auto-verification completed:', {
            status: autoVerifyResult.status,
            score: autoVerifyResult.score,
            confidence: autoVerifyResult.confidence,
            recommendation: autoVerifyResult.recommendation,
            authenticityCheck: autoVerifyResult.authenticityCheck ? {
                authentic: autoVerifyResult.authenticityCheck.authentic,
                originalFound: autoVerifyResult.authenticityCheck.originalCertificateFound,
                reason: autoVerifyResult.authenticityCheck.reason
            } : 'NOT SET'
        });

        // Store auto-verify result in metadata
        const updatedMetadata = {
            ...metadata,
            autoVerify: {
                completed: true,
                completedAt: new Date().toISOString(),
                completedBy: req.user.userId,
                confidenceScore: autoVerifyResult.score || autoVerifyResult.confidence * 100,
                scoreBreakdown: autoVerifyResult.scoreBreakdown || {},
                recommendation: autoVerifyResult.recommendation || 'MANUAL_REVIEW',
                recommendationReason: autoVerifyResult.recommendationReason || '',
                preFilledData: autoVerifyResult.preFilledData || {},
                hashCheck: autoVerifyResult.hashCheck || {},
                compositeHash: autoVerifyResult.compositeHash || null,
                authenticityCheck: autoVerifyResult.authenticityCheck || {}  // NEW: Blockchain authenticity verification
            }
        };

        await dbModule.query(
            `UPDATE clearance_requests SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [JSON.stringify(updatedMetadata), requestId]
        );

        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: 'HPG_AUTO_VERIFY',
            description: `HPG auto-verification completed. Confidence: ${autoVerifyResult.score || 0}%. Recommendation: ${autoVerifyResult.recommendation || 'MANUAL_REVIEW'}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                clearanceRequestId: requestId,
                confidenceScore: autoVerifyResult.score || 0,
                recommendation: autoVerifyResult.recommendation || 'MANUAL_REVIEW',
                scoreBreakdown: autoVerifyResult.scoreBreakdown || {},
                hashCheck: autoVerifyResult.hashCheck || {},
                compositeHash: autoVerifyResult.compositeHash || null,
                authenticityCheck: autoVerifyResult.authenticityCheck || {}  // NEW: Blockchain authenticity verification
            }
        });

        res.json({
            success: true,
            message: 'Auto-verification completed',
            autoVerify: {
                confidenceScore: autoVerifyResult.score || autoVerifyResult.confidence * 100,
                recommendation: autoVerifyResult.recommendation || 'MANUAL_REVIEW',
                recommendationReason: autoVerifyResult.recommendationReason || '',
                scoreBreakdown: autoVerifyResult.scoreBreakdown || {},
                preFilledData: autoVerifyResult.preFilledData || {},
                hashCheck: autoVerifyResult.hashCheck || {},
                compositeHash: autoVerifyResult.compositeHash || null,
                authenticityCheck: autoVerifyResult.authenticityCheck || {},  // NEW: Blockchain authenticity verification
                dataComparison: autoVerifyResult.dataComparison || {},  // NEW: Data comparison results
                ocrData: autoVerifyResult.ocrData || {}
            }
        });

    } catch (error) {
        console.error('Error in auto-verify:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform auto-verification: ' + error.message
        });
    }
});

// Approve HPG verification
router.post('/verify/approve', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId, engineNumber, chassisNumber, macroEtching, photos, stencil, remarks } = req.body;
        
        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: 'Request ID is required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        // Update clearance request status
        const updatedRequest = await db.updateClearanceRequestStatus(requestId, 'APPROVED', {
            engineNumber,
            chassisNumber,
            macroEtching: macroEtching || false,
            photos: photos || [],
            stencil: stencil || null,
            remarks: remarks || null,
            verifiedBy: req.user.userId,
            verifiedAt: new Date().toISOString()
        });

        // Update transfer request approval status if this clearance request is linked to a transfer request
        const dbModule = require('../database/db');
        
        // Assign to current user if not already assigned (update directly to avoid overwriting status)
        if (!clearanceRequest.assigned_to) {
            await dbModule.query(
                `UPDATE clearance_requests 
                 SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [req.user.userId, requestId]
            );
        }
        const transferRequests = await dbModule.query(
            `SELECT id FROM transfer_requests WHERE hpg_clearance_request_id = $1`,
            [requestId]
        );

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                try {
                    // Check if approval status columns exist before updating
                    const colCheck = await dbModule.query(`
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'transfer_requests' 
                        AND column_name IN ('hpg_approval_status', 'hpg_approved_at', 'hpg_approved_by')
                    `);
                    const hasApprovalStatus = colCheck.rows.some(r => r.column_name === 'hpg_approval_status');
                    const hasApprovedAt = colCheck.rows.some(r => r.column_name === 'hpg_approved_at');
                    const hasApprovedBy = colCheck.rows.some(r => r.column_name === 'hpg_approved_by');
                    
                    if (hasApprovalStatus && hasApprovedAt && hasApprovedBy) {
                        await dbModule.query(
                            `UPDATE transfer_requests 
                             SET hpg_approval_status = 'APPROVED',
                                 hpg_approved_at = CURRENT_TIMESTAMP,
                                 hpg_approved_by = $1,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE id = $2`,
                            [req.user.userId, tr.id]
                        );
                        console.log(`✅ Updated transfer request ${tr.id} with HPG approval`);
                    } else {
                        console.warn(`⚠️ Transfer request approval columns missing. Skipping transfer request ${tr.id} update. Run migration: database/verify-verification-columns.sql`);
                    }
                } catch (transferError) {
                    console.error(`[HPG Approve] Error updating transfer request ${tr.id}:`, transferError);
                    // Continue with other operations even if transfer update fails
                }
                
                // Add to vehicle history for the transfer request (always try this)
                try {
                    const transferRequest = await db.getTransferRequestById(tr.id);
                    if (transferRequest) {
                        await db.addVehicleHistory({
                            vehicleId: transferRequest.vehicle_id,
                            action: 'TRANSFER_HPG_APPROVED',
                            description: `HPG approved transfer request ${tr.id} via clearance request ${requestId}`,
                            performedBy: req.user.userId,
                            metadata: { 
                                transferRequestId: tr.id, 
                                clearanceRequestId: requestId,
                                notes: remarks || null 
                            }
                        });
                    }
                } catch (historyError) {
                    console.error(`[HPG Approve] Error adding vehicle history for transfer ${tr.id}:`, historyError);
                }
            }
        }

        // Get vehicle for hash calculation
        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Perform document hashing and duplicate detection (for both auto and manual verification)
        const metadata = typeof clearanceRequest.metadata === 'string' 
            ? JSON.parse(clearanceRequest.metadata) 
            : (clearanceRequest.metadata || {});
        
        const documents = metadata.documents || [];
        const registrationCert = documents.find(d => 
            d.document_type === 'registration_cert' || 
            d.document_type === 'registrationCert' ||
            d.type === 'registration_cert' ||
            d.type === 'registrationCert' ||
            d.type === 'or_cr'
        );

        let hashCheckResult = null;
        let compositeHash = null;
        
        if (registrationCert) {
            try {
                const filePath = registrationCert.file_path || registrationCert.filePath;
                if (filePath) {
                    try {
                        await fs.access(filePath);
                        
                        // Calculate file hash
                        const fileHash = registrationCert.file_hash || 
                            crypto.createHash('sha256')
                                .update(await fs.readFile(filePath))
                                .digest('hex');
                        
                        // Generate composite hash
                        const issueDateISO = new Date().toISOString();
                        const certificateNumberGenerator = require('../utils/certificateNumberGenerator');
                        const hpgCertificateNumber = certificateNumberGenerator.generateHpgNumber();
                        
                        compositeHash = certificateBlockchain.generateCompositeHash(
                            hpgCertificateNumber,
                            vehicle.vin,
                            issueDateISO,
                            fileHash
                        );
                        
                        // Check for duplicate hash
                        hashCheckResult = await certificateBlockchain.checkHashDuplicate(compositeHash);
                        
                        if (hashCheckResult.exists) {
                            return res.status(409).json({
                                success: false,
                                error: 'Document duplicate detected',
                                message: `This certificate has already been used for vehicle ${hashCheckResult.vehicleId}. Certificate reuse is not allowed.`,
                                hashCheck: hashCheckResult
                            });
                        }
                        
                        // Store hash on blockchain
                        try {
                            await certificateBlockchain.storeCertificateHashOnBlockchain(
                                compositeHash,
                                {
                                    certificateType: 'hpg',
                                    vehicleVIN: vehicle.vin,
                                    vehicleId: clearanceRequest.vehicle_id,
                                    certificateNumber: hpgCertificateNumber,
                                    applicationStatus: 'APPROVED',
                                    issuedAt: new Date().toISOString(),
                                    issuedBy: req.user.userId,
                                    fileHash: fileHash
                                }
                            );
                        } catch (blockchainError) {
                            console.error('[HPG Approve] Blockchain storage failed:', blockchainError);
                            // Continue - blockchain storage is optional but logged
                        }
                    } catch (fileError) {
                        console.warn('[HPG Approve] Document file not accessible:', fileError.message);
                        // Continue without hash check if file not accessible
                    }
                }
            } catch (hashError) {
                console.error('[HPG Approve] Hash verification error:', hashError);
                // Continue with approval but log the error
            }
        }

        // PHASE 2: Update vehicle verification status and log to blockchain atomically
        let blockchainTxId = null;
        let blockchainError = null;
        
        try {
            // PHASE 2: Log verification status to blockchain for full traceability
            // This ensures all verification events are recorded on-chain for audit purposes
            const fabricService = require('../services/optimizedFabricService');
            
            // Ensure Fabric service is initialized
            if (!fabricService.isConnected) {
                await fabricService.initialize();
            }
            
            // Prepare notes with officer information for blockchain traceability
            const currentUser = await db.getUserById(req.user.userId);
            const notesWithOfficer = JSON.stringify({
                notes: remarks || '',
                clearanceRequestId: requestId,
                engineNumber: engineNumber || null,
                chassisNumber: chassisNumber || null,
                macroEtching: macroEtching || false,
                officerInfo: {
                    userId: req.user.userId,
                    email: req.user.email,
                    name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                    employeeId: currentUser?.employee_id || null
                },
                verificationMethod: metadata.autoVerify ? 'auto' : 'manual',
                hashCheck: hashCheckResult || null,
                compositeHash: compositeHash || null
            });
            
            // Call chaincode to update verification status on blockchain
            const blockchainResult = await fabricService.updateVerificationStatus(
                vehicle.vin,
                'hpg',
                'APPROVED',
                notesWithOfficer
            );
            
            if (blockchainResult && blockchainResult.transactionId) {
                blockchainTxId = blockchainResult.transactionId;
                console.log(`✅ [Phase 2] HPG verification logged to blockchain. TX ID: ${blockchainTxId}`);
            } else {
                throw new Error('Blockchain update completed but no transaction ID returned');
            }
        } catch (blockchainErr) {
            // PHASE 2: Log blockchain error but don't fail the entire operation
            // Database is source of truth, blockchain is for audit trail
            blockchainError = blockchainErr;
            console.error('⚠️ [Phase 2] Failed to log HPG verification to blockchain:', blockchainErr.message);
            // Continue with database operations - blockchain logging is for audit, not blocking
        }

        // Update vehicle verification status in database
        await db.updateVerificationStatus(
            clearanceRequest.vehicle_id,
            'hpg',
            'APPROVED',
            req.user.userId,
            remarks || null,
            {
                hashCheck: hashCheckResult,
                compositeHash: compositeHash,
                verificationMethod: metadata.autoVerify ? 'auto' : 'manual',
                verifiedAt: new Date().toISOString(),
                blockchainTxId: blockchainTxId || null,
                blockchainError: blockchainError ? blockchainError.message : null
            }
        );

        // PHASE 3: Add to vehicle history with standardized action name
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: HPG_ACTIONS.APPROVED, // PHASE 3: Use standardized action constant
            description: `HPG verification approved by ${req.user.email}. ${remarks || ''}${blockchainTxId ? ` Blockchain TX: ${blockchainTxId}` : ''}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId || null,  // PHASE 2: Include blockchain transaction ID
            metadata: {
                clearanceRequestId: requestId,
                engineNumber,
                chassisNumber,
                macroEtching,
                blockchainTxId: blockchainTxId || null,
                blockchainError: blockchainError ? blockchainError.message : null
            }
        });

        // PHASE 2: Enhanced notifications - notify LTO admin and vehicle owner
        try {
            // Notify LTO admin
            const ltoAdmins = await dbModule.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
            );
            if (ltoAdmins.rows.length > 0) {
                await db.createNotification({
                    userId: ltoAdmins.rows[0].id,
                    title: 'HPG Verification Approved',
                    message: `HPG verification approved for vehicle ${vehicle.plate_number || vehicle.vin}${blockchainTxId ? `. Blockchain TX: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                    type: 'success'
                });
            }
            
            // PHASE 2: Notify vehicle owner about verification approval
            if (vehicle.owner_id) {
                try {
                    await db.createNotification({
                        userId: vehicle.owner_id,
                        title: 'HPG Clearance Approved',
                        message: `Your HPG clearance request for vehicle ${vehicle.plate_number || vehicle.vin} has been approved.${blockchainTxId ? ` Transaction ID: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                        type: 'success'
                    });
                } catch (ownerNotifyError) {
                    console.warn('[Phase 2] Failed to notify vehicle owner:', ownerNotifyError.message);
                    // Continue - owner notification failure shouldn't block approval
                }
            }
        } catch (notificationError) {
            console.warn('[Phase 2] Notification error (non-blocking):', notificationError.message);
            // Continue - notification failures shouldn't block the approval
        }

        res.json({
            success: true,
            message: 'HPG verification approved successfully',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Error approving HPG verification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve HPG verification: ' + error.message
        });
    }
});

// Reject HPG verification
router.post('/verify/reject', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId, reason } = req.body;
        
        if (!requestId || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Request ID and reason are required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        // Update clearance request status
        const updatedRequest = await db.updateClearanceRequestStatus(requestId, 'REJECTED', {
            rejectionReason: reason,
            rejectedBy: req.user.userId,
            rejectedAt: new Date().toISOString()
        });

        // Update transfer request approval status if this clearance request is linked to a transfer request
        const dbModule = require('../database/db');
        
        // Check if hpg_clearance_request_id column exists before querying
        let transferRequests = { rows: [] };
        try {
            const colCheck = await dbModule.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'transfer_requests' 
                AND column_name = 'hpg_clearance_request_id'
            `);
            
            if (colCheck.rows.length > 0) {
                // Column exists, safe to query
                transferRequests = await dbModule.query(
                    `SELECT id FROM transfer_requests WHERE hpg_clearance_request_id = $1`,
                    [requestId]
                );
            } else {
                console.warn('[HPG Reject] hpg_clearance_request_id column does not exist. Skipping transfer request update.');
            }
        } catch (colError) {
            console.error('[HPG Reject] Error checking for hpg_clearance_request_id column:', colError);
            // Continue without transfer request update
        }

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                try {
                    // Check if approval status columns exist before updating
                    const colCheck = await dbModule.query(`
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'transfer_requests' 
                        AND column_name = 'hpg_approval_status'
                    `);
                    
                    if (colCheck.rows.length > 0) {
                        await dbModule.query(
                            `UPDATE transfer_requests 
                             SET hpg_approval_status = 'REJECTED',
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE id = $1`,
                            [tr.id]
                        );
                        console.log(`✅ Updated transfer request ${tr.id} with HPG rejection`);
                    } else {
                        console.warn(`⚠️ Transfer request approval columns missing. Skipping transfer request ${tr.id} update. Run migration: database/verify-verification-columns.sql`);
                    }
                } catch (updateError) {
                    console.error(`[HPG Reject] Error updating transfer request ${tr.id}:`, updateError);
                }
                
                // Add to vehicle history for the transfer request
                const transferRequest = await db.getTransferRequestById(tr.id);
                if (transferRequest) {
                    await db.addVehicleHistory({
                        vehicleId: transferRequest.vehicle_id,
                        action: 'TRANSFER_HPG_REJECTED',
                        description: `HPG rejected transfer request ${tr.id} via clearance request ${requestId}. Reason: ${reason}`,
                        performedBy: req.user.userId,
                        metadata: { 
                            transferRequestId: tr.id, 
                            clearanceRequestId: requestId,
                            reason: reason 
                        }
                    });
                }
            }
            console.log(`✅ Updated ${transferRequests.rows.length} transfer request(s) with HPG rejection`);
        }

        // Get vehicle for blockchain logging and notifications
        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // PHASE 2: Log rejection to blockchain for full traceability
        let blockchainTxId = null;
        let blockchainError = null;
        
        try {
            // PHASE 2: Log verification rejection to blockchain for audit purposes
            const fabricService = require('../services/optimizedFabricService');
            
            // Ensure Fabric service is initialized
            if (!fabricService.isConnected) {
                await fabricService.initialize();
            }
            
            // Prepare notes with officer information and rejection reason
            const currentUser = await db.getUserById(req.user.userId);
            const notesWithOfficer = JSON.stringify({
                notes: reason || '',
                clearanceRequestId: requestId,
                rejectionReason: reason,
                officerInfo: {
                    userId: req.user.userId,
                    email: req.user.email,
                    name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                    employeeId: currentUser?.employee_id || null
                }
            });
            
            // Call chaincode to update verification status on blockchain
            const blockchainResult = await fabricService.updateVerificationStatus(
                vehicle.vin,
                'hpg',
                'REJECTED',
                notesWithOfficer
            );
            
            if (blockchainResult && blockchainResult.transactionId) {
                blockchainTxId = blockchainResult.transactionId;
                console.log(`✅ [Phase 2] HPG verification rejection logged to blockchain. TX ID: ${blockchainTxId}`);
            } else {
                throw new Error('Blockchain update completed but no transaction ID returned');
            }
        } catch (blockchainErr) {
            // PHASE 2: Log blockchain error but don't fail the entire operation
            blockchainError = blockchainErr;
            console.error('⚠️ [Phase 2] Failed to log HPG rejection to blockchain:', blockchainErr.message);
            // Continue with database operations
        }

        // Update vehicle verification status in database
        await db.updateVerificationStatus(
            clearanceRequest.vehicle_id,
            'hpg',
            'REJECTED',
            req.user.userId,
            reason || null,
            {
                rejectionReason: reason,
                blockchainTxId: blockchainTxId || null,
                blockchainError: blockchainError ? blockchainError.message : null
            }
        );

        // PHASE 3: Add to vehicle history with standardized action name
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: HPG_ACTIONS.REJECTED, // PHASE 3: Use standardized action constant
            description: `HPG verification rejected by ${req.user.email}. Reason: ${reason}${blockchainTxId ? ` Blockchain TX: ${blockchainTxId}` : ''}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId || null,  // PHASE 2: Include blockchain transaction ID
            metadata: {
                clearanceRequestId: requestId,
                reason,
                blockchainTxId: blockchainTxId || null,
                blockchainError: blockchainError ? blockchainError.message : null
            }
        });

        // PHASE 2: Enhanced notifications - notify LTO admin and vehicle owner
        try {
            // Notify LTO admin
            const ltoAdmins = await dbModule.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
            );
            if (ltoAdmins.rows.length > 0) {
                await db.createNotification({
                    userId: ltoAdmins.rows[0].id,
                    title: 'HPG Verification Rejected',
                    message: `HPG verification rejected for vehicle ${vehicle.plate_number || vehicle.vin}. Reason: ${reason}${blockchainTxId ? ` Blockchain TX: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                    type: 'warning'
                });
            }
            
            // PHASE 2: Notify vehicle owner about verification rejection
            if (vehicle.owner_id) {
                try {
                    await db.createNotification({
                        userId: vehicle.owner_id,
                        title: 'HPG Clearance Rejected',
                        message: `Your HPG clearance request for vehicle ${vehicle.plate_number || vehicle.vin} has been rejected. Reason: ${reason}${blockchainTxId ? ` Transaction ID: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                        type: 'warning'
                    });
                } catch (ownerNotifyError) {
                    console.warn('[Phase 2] Failed to notify vehicle owner:', ownerNotifyError.message);
                    // Continue - owner notification failure shouldn't block rejection
                }
            }
        } catch (notificationError) {
            console.warn('[Phase 2] Notification error (non-blocking):', notificationError.message);
            // Continue - notification failures shouldn't block the rejection
        }

        res.json({
            success: true,
            message: 'HPG verification rejected',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Error rejecting HPG verification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject HPG verification: ' + error.message
        });
    }
});

// Release certificate
router.post('/certificate/release', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId, certificateNumber, certificateFile } = req.body;
        
        if (!requestId || !certificateNumber) {
            return res.status(400).json({
                success: false,
                error: 'Request ID and certificate number are required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        if (clearanceRequest.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'Cannot release certificate. Verification must be approved first.'
            });
        }

        // Upload certificate file to storage (IPFS or local)
        let filePath = null;
        let ipfsCid = null;
        
        if (certificateFile) {
            try {
                // If it's a base64 file, decode and upload
                if (certificateFile.startsWith('data:')) {
                    const fileBuffer = Buffer.from(certificateFile.split(',')[1], 'base64');
                    const fileName = `hpg_certificate_${certificateNumber}_${Date.now()}.pdf`;
                    
                    // Upload to storage service
                    const uploadResult = await storageService.uploadFile(fileBuffer, fileName, 'application/pdf');
                    filePath = uploadResult.path || uploadResult.filePath;
                    ipfsCid = uploadResult.cid || uploadResult.ipfsCid;
                }
            } catch (uploadError) {
                console.error('Error uploading certificate file:', uploadError);
                // Continue without file path if upload fails
            }
        }

        // Create certificate record
        const certificate = await db.createCertificate({
            clearanceRequestId: requestId,
            vehicleId: clearanceRequest.vehicle_id,
            certificateType: 'hpg_clearance',
            certificateNumber,
            filePath,
            ipfsCid,
            issuedBy: req.user.userId,
            expiresAt: null, // Set expiration if needed
            metadata: {
                certificateNumber,
                issuedAt: new Date().toISOString()
            }
        });

        // Update clearance request status to COMPLETED
        await db.updateClearanceRequestStatus(requestId, 'COMPLETED');

        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: 'HPG_CERTIFICATE_RELEASED',
            description: `HPG clearance certificate released by ${req.user.email}. Certificate #: ${certificateNumber}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                clearanceRequestId: requestId,
                certificateId: certificate.id,
                certificateNumber
            }
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        const dbModule = require('../database/db');
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'HPG Certificate Released',
                message: `HPG clearance certificate released for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'success'
            });
        }

        res.json({
            success: true,
            message: 'Certificate released successfully',
            certificate,
            requestId
        });

    } catch (error) {
        console.error('Error releasing certificate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to release certificate: ' + error.message
        });
    }
});

// Create test HPG request (for testing purposes)
router.post('/test-request', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { 
            ownerName, 
            ownerEmail,
            plateNumber, 
            engineNumber, 
            chassisNumber,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            vehicleType,
            purpose
        } = req.body;

        // Validation
        if (!ownerName || !plateNumber || !engineNumber || !chassisNumber) {
            return res.status(400).json({
                success: false,
                error: 'Owner name, plate number, engine number, and chassis number are required'
            });
        }

        const dbModule = require('../database/db');
        const crypto = require('crypto');

        // Create a test vehicle
        const vehicleId = crypto.randomUUID();
        const vin = 'TEST' + Date.now().toString(36).toUpperCase();
        
        await dbModule.query(`
            INSERT INTO vehicles (id, vin, plate_number, engine_number, chassis_number, make, model, year, vehicle_type, status, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUBMITTED', $10)
            ON CONFLICT (vin) DO UPDATE SET 
                plate_number = EXCLUDED.plate_number,
                engine_number = EXCLUDED.engine_number,
                chassis_number = EXCLUDED.chassis_number
        `, [
            vehicleId,
            vin,
            plateNumber,
            engineNumber,
            chassisNumber,
            vehicleMake || 'Test Make',
            vehicleModel || 'Test Model',
            vehicleYear || 2023,
            vehicleType || 'Sedan',
            req.user.userId
        ]);

        // Create a clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: vehicleId,
            requestType: 'hpg',
            requestedBy: req.user.userId,
            assignedTo: req.user.userId, // Assign to self for testing
            purpose: purpose || 'Vehicle Clearance',
            notes: 'Test request created from HPG admin dashboard',
            metadata: {
                ownerName,
                ownerEmail: ownerEmail || 'test@example.com',
                plateNumber,
                engine_number: engineNumber,
                chassis_number: chassisNumber,
                vehicleMake: vehicleMake || 'Test Make',
                vehicleModel: vehicleModel || 'Test Model',
                vehicleYear: vehicleYear || 2023,
                vehicleType: vehicleType || 'Sedan',
                purpose: purpose || 'Vehicle Clearance',
                isTestRequest: true,
                testCreatedBy: req.user.email,
                testCreatedAt: new Date().toISOString()
            }
        });

        console.log(`[HPG] Test request created: ${clearanceRequest.id} for plate ${plateNumber}`);

        res.json({
            success: true,
            message: 'Test HPG request created successfully',
            requestId: clearanceRequest.id,
            vehicleId: vehicleId,
            vin: vin
        });

    } catch (error) {
        console.error('Error creating test HPG request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create test HPG request: ' + error.message
        });
    }
});

// Check if request qualifies for automatic clearance
async function checkAutoApprovalEligibility(clearanceRequest, vehicle) {
    // Criteria for automatic approval: 
    // 1. Vehicle is brand new (registration, not transfer)
    // 2. Seller/dealer is a trusted partner
    // 3. Vehicle make is from trusted manufacturer
    
    const TRUSTED_MANUFACTURERS = ['TOYOTA', 'HONDA', 'MITSUBISHI', 'NISSAN', 'FORD'];
    
    // Check if new registration
    if (clearanceRequest.request_type !== 'hpg' || clearanceRequest.purpose?.includes('transfer')) {
        return { eligible: false, reason: 'Only new registrations qualify for auto-approval' };
    }
    
    // Check if from trusted manufacturer
    if (!TRUSTED_MANUFACTURERS.includes(vehicle.make?.toUpperCase())) {
        return { eligible: false, reason: 'Manufacturer not in trusted list' };
    }
    
    // Check if seller is trusted partner
    const dbModule = require('../database/db');
    const sellerResult = await dbModule.query(
        'SELECT is_trusted_partner, trusted_partner_type FROM users WHERE id = $1',
        [vehicle.owner_id]
    );
    
    if (sellerResult.rows.length > 0 && sellerResult.rows[0].is_trusted_partner) {
        return { 
            eligible: true, 
            reason: 'Trusted dealer + known manufacturer',
            partnerType: sellerResult.rows[0].trusted_partner_type
        };
    }
    
    return { eligible: false, reason: 'Owner is not a trusted partner' };
}

// Endpoint to process automatic clearances (cron job or manual trigger)
router.post('/process-auto-clearances', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        // Get pending clearance requests marked for automatic processing
        const dbModule = require('../database/db');
        const pendingRequests = await dbModule.query(
            `SELECT cr.*, v.* 
             FROM clearance_requests cr
             JOIN vehicles v ON cr.vehicle_id = v.id
             WHERE cr.status = 'PENDING' 
               AND cr.verification_mode = 'AUTOMATIC'
               AND cr.request_type = 'hpg'`
        );
        
        const results = {
            processed: 0,
            approved: 0,
            rejected: 0,
            errors: []
        };
        
        for (const request of pendingRequests.rows) {
            try {
                const eligibility = await checkAutoApprovalEligibility(request, request);
                
                if (eligibility.eligible) {
                    // Auto-approve
                    await dbModule.query(
                        `UPDATE clearance_requests 
                         SET status = 'APPROVED', 
                             reviewed_at = NOW(),
                             notes = $1
                         WHERE id = $2`,
                        [`Auto-approved: ${eligibility.reason}`, request.id]
                    );
                    results.approved++;
                } else {
                    // Revert to manual processing
                    await dbModule.query(
                        `UPDATE clearance_requests 
                         SET verification_mode = 'MANUAL',
                             notes = $1
                         WHERE id = $2`,
                        [`Auto-approval failed: ${eligibility.reason}. Requires manual review.`, request.id]
                    );
                }
                results.processed++;
                
            } catch (err) {
                results.errors.push({ requestId: request.id, error: err.message });
            }
        }
        
        res.json({
            success: true,
            message: 'Auto-clearance processing complete',
            results
        });
        
    } catch (error) {
        console.error('Auto-clearance processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

