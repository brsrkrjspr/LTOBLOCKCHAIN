// TrustChain Document Management Routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const db = require('../database/services');
const storageService = require('../services/storageService');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try {
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        } catch (error) {
            console.error('Error creating upload directory:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,jpg,jpeg,png').split(',');
        const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
        
        if (allowedTypes.includes(fileExt)) {
            cb(null, true);
        } else {
            cb(new Error(`File type .${fileExt} is not allowed`), false);
        }
    }
});

// Helper function to calculate file hash
function calculateFileHash(filePath) {
    try {
        if (!filePath || !fs.existsSync(filePath)) {
            console.warn('File path does not exist for hash calculation:', filePath);
            return null; // Return null instead of throwing
        }
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
        console.error('Error calculating file hash:', error);
        return null; // Return null instead of throwing
    }
}

// Map document type names to database enum values
function mapDocumentType(type) {
    const mapping = {
        'registrationCert': 'registration_cert',
        'insuranceCert': 'insurance_cert',
        'emissionCert': 'emission_cert',
        'ownerId': 'owner_id',
        'general': 'registration_cert' // Default
    };
    return mapping[type] || 'registration_cert';
}

// Upload document (requires authentication)
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        console.log('📤 Document upload request received');
        console.log('File info:', req.file ? {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
            mimetype: req.file.mimetype
        } : 'No file');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const { type, documentType, vehicleId } = req.body;
        const docType = type || documentType || 'general';

        // Validate document type
        const validTypes = ['registrationCert', 'insuranceCert', 'emissionCert', 'ownerId', 'general'];
        if (!validTypes.includes(docType)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Invalid document type'
            });
        }

        // Store document using unified storage service (IPFS or local)
        let storageResult;
        const requiredStorageMode = process.env.STORAGE_MODE || 'auto';
        
        try {
            console.log(`📦 Storing document: ${docType}, file: ${req.file.filename}`);
            console.log(`📦 Storage mode requirement: ${requiredStorageMode}`);
            
            storageResult = await storageService.storeDocument(
                req.file,
                docType,
                null, // vehicleVin - not available yet
                null  // ownerEmail - not available yet
            );
            console.log('✅ Storage result:', {
                success: storageResult?.success,
                storageMode: storageResult?.storageMode,
                cid: storageResult?.cid,
                filename: storageResult?.filename
            });
            
            // If STORAGE_MODE=ipfs is required, verify it was used
            if (requiredStorageMode === 'ipfs' && storageResult?.storageMode !== 'ipfs') {
                console.error('❌ CRITICAL: STORAGE_MODE=ipfs required but document stored in:', storageResult?.storageMode);
                throw new Error(`Document storage failed: IPFS mode required but storage returned '${storageResult?.storageMode}'. Check IPFS service and configuration.`);
            }
            
            // Ensure storageResult has required fields
            if (!storageResult || !storageResult.success) {
                // If STORAGE_MODE=ipfs, fail instead of falling back
                if (requiredStorageMode === 'ipfs') {
                    throw new Error('Document storage failed: IPFS storage is required but storage service returned failure.');
                }
                
                // STORAGE_MODE=ipfs is required - NO FALLBACKS
                // This code should never execute if STORAGE_MODE=ipfs because storageService will throw
                // But keeping as safety check
                if (requiredStorageMode === 'ipfs') {
                    throw new Error('Document storage failed: IPFS storage is required but storage service returned failure. This should not happen - check storageService implementation.');
                }
                
                // Only fallback to local if not in strict IPFS mode (should not happen in production)
                let fileHash = null;
                try {
                    fileHash = calculateFileHash(req.file.path);
                } catch (hashError) {
                    console.warn('Could not calculate file hash:', hashError);
                }
                
                storageResult = {
                    success: true, // Mark as success so upload can continue
                    documentId: 'TEMP_' + Date.now(),
                    filename: req.file.filename,
                    hash: fileHash,
                    size: req.file.size,
                    uploadDate: new Date().toISOString(),
                    storageMode: 'local',
                    cid: null,
                    gatewayUrl: `/uploads/${req.file.filename}`
                };
            }
        } catch (storageError) {
            console.error('Storage service error:', storageError);
            console.error('Storage error stack:', storageError.stack);
            
            // If STORAGE_MODE=ipfs is required, fail the upload instead of falling back
            if (requiredStorageMode === 'ipfs') {
                // Clean up uploaded file
                try {
                    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                } catch (cleanupError) {
                    console.error('Error cleaning up file:', cleanupError);
                }
                
                return res.status(503).json({
                    success: false,
                    error: 'Document storage failed',
                    message: `IPFS storage is required (STORAGE_MODE=ipfs) but IPFS service is unavailable. Please ensure IPFS is running and accessible.`,
                    details: storageError.message,
                    troubleshooting: {
                        checkIPFS: 'Verify IPFS container is running: docker ps | findstr ipfs',
                        checkAPI: 'Test IPFS API: Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST',
                        checkConfig: 'Verify IPFS API address: docker exec ipfs ipfs config Addresses.API',
                        restartIPFS: 'Restart IPFS: docker restart ipfs'
                    }
                });
            }
            
            // Only fallback to local if not in strict IPFS mode
            let fileHash = null;
            try {
                fileHash = calculateFileHash(req.file.path);
            } catch (hashError) {
                console.warn('Could not calculate file hash:', hashError);
            }
            
            storageResult = {
                success: true, // Mark as success so upload can continue
                documentId: 'TEMP_' + Date.now(),
                filename: req.file.filename,
                hash: fileHash,
                size: req.file.size,
                uploadDate: new Date().toISOString(),
                storageMode: 'local',
                cid: null,
                gatewayUrl: `/uploads/${req.file.filename}`,
                warning: storageError.message // Include warning but don't fail
            };
        }

        // Save document to database even without vehicleId (for registration wizard)
        // vehicleId will be linked later during vehicle registration
        let documentRecord = null;
        try {
            documentRecord = await db.createDocument({
                vehicleId: vehicleId || null, // Allow null for registration wizard
                documentType: mapDocumentType(docType),
                filename: req.file.filename,
                originalName: req.file.originalname,
                filePath: req.file.path,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                fileHash: storageResult.hash,
                uploadedBy: null, // No user for registration wizard
                ipfsCid: storageResult.cid || null // Store CID if available
            });
            console.log(`✅ Document saved to database: ${documentRecord.id} (CID: ${storageResult.cid || 'none'})`);
        } catch (dbError) {
            console.error('Database error:', dbError);
            // Continue even if database save fails, but log warning
            console.warn('⚠️ Document uploaded to storage but not saved to database. It may not be linkable to vehicle later.');
        }

        // Build response - ensure all required fields are present
        const response = {
            success: true,
            message: 'Document uploaded successfully',
            document: {
                id: documentRecord?.id || storageResult.documentId || 'TEMP_' + Date.now(),
                documentType: docType,
                originalName: req.file.originalname,
                fileSize: req.file.size,
                cid: storageResult.cid || null,
                ipfsHash: storageResult.cid || null,
                filename: req.file.filename,
                url: storageResult.gatewayUrl || storageResult.url || `/uploads/${req.file.filename}`,
                uploadedAt: storageResult.uploadDate || new Date().toISOString(),
                fileHash: storageResult.hash || (() => {
                    try {
                        return calculateFileHash(req.file.path);
                    } catch (e) {
                        return null;
                    }
                })(),
                storageMode: storageResult.storageMode || (process.env.STORAGE_MODE === 'ipfs' ? 'ipfs' : 'local')
            },
            cid: storageResult.cid || null,
            filename: req.file.filename,
            url: storageResult.gatewayUrl || storageResult.url || `/uploads/${req.file.filename}`,
            storageMode: storageResult.storageMode || 'local'
        };
        
        // Include warning if storage had issues but upload succeeded
        if (storageResult.warning) {
            response.warning = storageResult.warning;
        }

        res.json(response);

    } catch (error) {
        console.error('❌ Upload error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        // Clean up uploaded file if it exists
        if (req.file && req.file.path) {
            try {
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                    console.log('✅ Cleaned up uploaded file');
                }
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }

        // Provide more detailed error message
        const errorMessage = error.message || 'Failed to upload document';
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
        
        // Ensure response hasn't been sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: errorMessage,
                details: isDevelopment ? error.stack : undefined,
                errorType: error.name || 'UnknownError'
            });
        } else {
            console.error('⚠️ Response already sent, cannot send error response');
        }
    }
});

// Upload document (authenticated endpoint)
router.post('/upload-auth', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const { documentType, vehicleVin } = req.body;

        if (!documentType || !vehicleVin) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Document type and vehicle VIN are required'
            });
        }

        // Validate document type
        const validTypes = ['registrationCert', 'insuranceCert', 'emissionCert', 'ownerId'];
        if (!validTypes.includes(documentType)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Invalid document type'
            });
        }

        // Get vehicle by VIN
        const vehicle = await db.getVehicleByVin(vehicleVin);
        if (!vehicle) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Only vehicle owners can upload documents (admins have read-only access)
        if (vehicle.owner_id !== req.user.userId) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({
                success: false,
                error: 'Access denied. Only vehicle owners can upload documents.'
            });
        }

        // Store document using unified storage service (IPFS or local)
        const storageResult = await storageService.storeDocument(
            req.file,
            documentType,
            vehicleVin,
            req.user.email || null
        );

        // Create document record in database with CID
        const document = await db.createDocument({
            vehicleId: vehicle.id,
            documentType: mapDocumentType(documentType),
            filename: req.file.filename,
            originalName: req.file.originalname,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            fileHash: storageResult.hash,
            uploadedBy: req.user.userId,
            ipfsCid: storageResult.cid || null // Store CID if available
        });

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                id: document.id,
                documentType: documentType,
                originalName: document.original_name,
                fileSize: document.file_size,
                fileHash: document.file_hash,
                uploadedAt: document.uploaded_at,
                filename: document.filename,
                url: storageResult.gatewayUrl || `/uploads/${document.filename}`,
                cid: storageResult.cid || null,
                storageMode: storageResult.storageMode || (process.env.STORAGE_MODE === 'ipfs' ? 'ipfs' : 'local')
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            error: 'Failed to upload document'
        });
    }
});

// Get document by ID
router.get('/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Get vehicle to check permissions
        const vehicle = await db.getVehicleById(document.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Allow: admins, vehicle owners, and verifiers (for verification purposes)
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier';
        
        // Debug logging (temporary)
        if (process.env.NODE_ENV === 'development') {
            console.log('Document permission check:', {
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

        // Build document URL
        let documentUrl = null;
        if (document.ipfs_cid) {
            // Try IPFS gateway first
            const ipfsService = require('../services/ipfsService');
            if (ipfsService.isAvailable()) {
                documentUrl = ipfsService.getGatewayUrl(document.ipfs_cid);
            }
        }
        // Fallback to local file
        if (!documentUrl && document.file_path && fs.existsSync(document.file_path)) {
            documentUrl = `/uploads/${document.filename}`;
        } else if (!documentUrl && document.filename) {
            documentUrl = `/uploads/${document.filename}`;
        }

        res.json({
            success: true,
            document: {
                id: document.id,
                vehicleId: document.vehicle_id,
                documentType: document.document_type,
                originalName: document.original_name,
                filename: document.filename,
                fileSize: document.file_size,
                mimeType: document.mime_type,
                fileHash: document.file_hash,
                uploadedBy: document.uploaded_by,
                uploadedAt: document.uploaded_at,
                verified: document.verified,
                verifiedAt: document.verified_at,
                verifiedBy: document.verified_by,
                ipfs_cid: document.ipfs_cid,
                cid: document.ipfs_cid,
                url: documentUrl,
                file_path: document.file_path
            }
        });

    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve document'
        });
    }
});

// Download document
router.get('/:documentId/download', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Get vehicle to check permissions
        const vehicle = await db.getVehicleById(document.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Allow: admins (read-only), vehicle owners, and verifiers
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier';
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get document from storage service (handles IPFS or local)
        let filePath = null;

        // Use storage service to get document (will query database and retrieve from IPFS if needed)
        if (document.ipfs_cid || document.file_path) {
            try {
                const storageResult = await storageService.getDocument(document.id);
                filePath = storageResult.filePath;
            } catch (storageError) {
                console.error('Storage service error:', storageError);
                // Try direct file path as last resort
                if (document.file_path && fs.existsSync(document.file_path)) {
                    filePath = document.file_path;
                } else {
                    return res.status(404).json({
                        success: false,
                        error: 'Document file not found',
                        details: storageError.message
                    });
                }
            }
        } else {
            return res.status(404).json({
                success: false,
                error: 'Document has no storage location (no IPFS CID or file path)'
            });
        }

        // Check if file exists
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Document file not found on storage system'
            });
        }

        res.download(filePath, document.original_name, (err) => {
            if (err) {
                console.error('Download error:', err);
                res.status(500).json({
                    success: false,
                    error: 'Failed to download document'
                });
            }
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download document'
        });
    }
});

// View document (inline, for iframe display)
router.get('/:documentId/view', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Get vehicle to check permissions
        const vehicle = await db.getVehicleById(document.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Allow: admins, vehicle owners, and verifiers
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier';
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get document from storage service (handles IPFS or local)
        let filePath = null;
        let mimeType = document.mime_type || 'application/pdf';

        // Use storage service to get document (will query database and retrieve from IPFS if needed)
        if (document.ipfs_cid || document.file_path) {
            try {
                const storageResult = await storageService.getDocument(document.id);
                filePath = storageResult.filePath;
                if (storageResult.mimeType) {
                    mimeType = storageResult.mimeType;
                }
            } catch (storageError) {
                console.error('Storage service error:', storageError);
                // Try direct file path as last resort
                if (document.file_path && fs.existsSync(document.file_path)) {
                    filePath = document.file_path;
                } else {
                    return res.status(404).json({
                        success: false,
                        error: 'Document file not found',
                        details: storageError.message
                    });
                }
            }
        } else {
            return res.status(404).json({
                success: false,
                error: 'Document has no storage location (no IPFS CID or file path)'
            });
        }

        // Check if file exists
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Document file not found on storage system'
            });
        }

        // Set headers for inline viewing
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.original_name}"`);
        
        // Send file
        res.sendFile(path.resolve(filePath), (err) => {
            if (err) {
                console.error('View error:', err);
                res.status(500).json({
                    success: false,
                    error: 'Failed to view document'
                });
            }
        });

    } catch (error) {
        console.error('View error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to view document'
        });
    }
});

// Verify document integrity
router.post('/:documentId/verify', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Check permission (admin or verifier only)
        if (!['admin', 'insurance_verifier', 'emission_verifier'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Verify document using storage service (handles IPFS or local)
        let verificationResult;
        try {
            verificationResult = await storageService.verifyDocument(documentId);
        } catch (verifyError) {
            console.error('Verification error:', verifyError);
            // Fallback to basic hash check
            let currentHash = null;
            if (fs.existsSync(document.file_path)) {
                currentHash = calculateFileHash(document.file_path);
            }
            const hashMatches = currentHash === document.file_hash;
            
            if (hashMatches) {
                await db.verifyDocument(documentId, req.user.userId);
            }

            return res.json({
                success: true,
                message: hashMatches ? 'Document verified successfully' : 'Document hash mismatch',
                verification: {
                    documentId: document.id,
                    verified: hashMatches,
                    hash: document.file_hash,
                    currentHash: currentHash,
                    hashMatches: hashMatches,
                    timestamp: new Date().toISOString(),
                    verifiedBy: hashMatches ? req.user.userId : null,
                    details: hashMatches ? 'Document integrity verified successfully' : 'Document file may have been modified'
                }
            });
        }

        // Update verification status if verified
        if (verificationResult.integrityValid) {
            await db.verifyDocument(documentId, req.user.userId);
        }

        res.json({
            success: true,
            message: verificationResult.integrityValid ? 'Document verified successfully' : 'Document verification failed',
            verification: {
                documentId: document.id,
                verified: verificationResult.integrityValid,
                hash: document.file_hash,
                currentHash: verificationResult.storedHash,
                hashMatches: verificationResult.integrityValid,
                timestamp: verificationResult.verifiedAt || new Date().toISOString(),
                verifiedBy: verificationResult.integrityValid ? req.user.userId : null,
                storageMode: verificationResult.storageMode || 'local',
                ipfsExists: verificationResult.ipfsExists || null,
                ipfsPinned: verificationResult.ipfsPinned || null,
                details: verificationResult.integrityValid ? 'Document integrity verified successfully' : 'Document verification failed'
            }
        });

    } catch (error) {
        console.error('Verify document error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify document'
        });
    }
});

// Get documents by vehicle VIN
router.get('/vehicle/:vin', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;

        const vehicle = await db.getVehicleByVin(vin);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Allow: admins (read-only), vehicle owners, and verifiers
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier';
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const documents = await db.getDocumentsByVehicle(vehicle.id);

        res.json({
            success: true,
            documents: documents.map(doc => ({
                id: doc.id,
                vehicleId: doc.vehicle_id,
                documentType: doc.document_type,
                document_type: doc.document_type, // Keep both for compatibility
                originalName: doc.original_name,
                original_name: doc.original_name,
                filename: doc.filename,
                fileSize: doc.file_size,
                file_size: doc.file_size,
                fileHash: doc.file_hash,
                file_hash: doc.file_hash,
                mimeType: doc.mime_type,
                mime_type: doc.mime_type,
                uploadedBy: doc.uploaded_by,
                uploaded_by: doc.uploaded_by,
                uploadedAt: doc.uploaded_at,
                uploaded_at: doc.uploaded_at,
                verified: doc.verified,
                verifiedAt: doc.verified_at,
                verified_at: doc.verified_at,
                uploaderName: doc.uploader_name,
                ipfs_cid: doc.ipfs_cid,
                cid: doc.ipfs_cid,
                url: doc.url || `/uploads/${doc.filename}`,
                file_path: doc.file_path
            })),
            count: documents.length
        });

    } catch (error) {
        console.error('Get documents by vehicle error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve documents'
        });
    }
});

// Get documents by vehicle ID
router.get('/vehicle-id/:vehicleId', authenticateToken, async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Allow: admins (read-only), vehicle owners, and verifiers
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'emission_verifier';
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const documents = await db.getDocumentsByVehicle(vehicle.id);

        res.json({
            success: true,
            vehicle: {
                id: vehicle.id,
                vin: vehicle.vin,
                plate_number: vehicle.plate_number,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year
            },
            documents: documents.map(doc => ({
                id: doc.id,
                vehicleId: doc.vehicle_id,
                documentType: doc.document_type,
                document_type: doc.document_type,
                originalName: doc.original_name,
                original_name: doc.original_name,
                filename: doc.filename,
                fileSize: doc.file_size,
                file_size: doc.file_size,
                fileHash: doc.file_hash,
                file_hash: doc.file_hash,
                mimeType: doc.mime_type,
                mime_type: doc.mime_type,
                uploadedBy: doc.uploaded_by,
                uploaded_by: doc.uploaded_by,
                uploadedAt: doc.uploaded_at,
                uploaded_at: doc.uploaded_at,
                verified: doc.verified,
                verifiedAt: doc.verified_at,
                verified_at: doc.verified_at,
                uploaderName: doc.uploader_name,
                ipfs_cid: doc.ipfs_cid,
                cid: doc.ipfs_cid,
                url: doc.url || `/uploads/${doc.filename}`,
                file_path: doc.file_path
            }))
        });

    } catch (error) {
        console.error('Get documents by vehicle ID error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve documents'
        });
    }
});

// Delete document
router.delete('/:documentId', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Get vehicle to check permissions
        const vehicle = await db.getVehicleById(document.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check permission - Only vehicle owners can delete documents (admins have read-only access)
        if (vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Only vehicle owners can delete documents.'
            });
        }

        // Delete file from filesystem
        if (fs.existsSync(document.file_path)) {
            fs.unlinkSync(document.file_path);
        }

        // Delete from database
        const dbModule = require('../database/db');
        await dbModule.query('DELETE FROM documents WHERE id = $1', [documentId]);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete document'
        });
    }
});

// Search documents
router.get('/search', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vin, applicationId, vehicleId, documentType, page = 1, limit = 50 } = req.query;
        
        let query = `
            SELECT d.*,
                   v.id as vehicle_id, v.vin, v.plate_number, v.make, v.model, v.year,
                   u.first_name || ' ' || u.last_name as uploader_name
            FROM documents d
            JOIN vehicles v ON d.vehicle_id = v.id
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;
        
        if (vin) {
            paramCount++;
            query += ` AND v.vin = $${paramCount}`;
            params.push(vin);
        }
        
        if (vehicleId) {
            paramCount++;
            query += ` AND v.id = $${paramCount}`;
            params.push(vehicleId);
        }
        
        if (applicationId) {
            // applicationId is typically the vehicle ID
            paramCount++;
            query += ` AND v.id = $${paramCount}`;
            params.push(applicationId);
        }
        
        if (documentType) {
            paramCount++;
            query += ` AND d.document_type = $${paramCount}`;
            params.push(documentType);
        }
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` ORDER BY d.uploaded_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit), offset);
        
        const result = await db.query(query, params);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(*) 
            FROM documents d
            JOIN vehicles v ON d.vehicle_id = v.id
            WHERE 1=1
        `;
        const countParams = [];
        paramCount = 0;
        
        if (vin) {
            paramCount++;
            countQuery += ` AND v.vin = $${paramCount}`;
            countParams.push(vin);
        }
        
        if (vehicleId) {
            paramCount++;
            countQuery += ` AND v.id = $${paramCount}`;
            countParams.push(vehicleId);
        }
        
        if (applicationId) {
            paramCount++;
            countQuery += ` AND v.id = $${paramCount}`;
            countParams.push(applicationId);
        }
        
        if (documentType) {
            paramCount++;
            countQuery += ` AND d.document_type = $${paramCount}`;
            countParams.push(documentType);
        }
        
        const countResult = await db.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        
        const documents = result.rows.map(doc => ({
            id: doc.id,
            vehicleId: doc.vehicle_id,
            vin: doc.vin,
            plateNumber: doc.plate_number,
            vehicle: {
                id: doc.vehicle_id,
                vin: doc.vin,
                plateNumber: doc.plate_number,
                make: doc.make,
                model: doc.model,
                year: doc.year
            },
            documentType: doc.document_type,
            document_type: doc.document_type,
            originalName: doc.original_name,
            filename: doc.filename,
            fileSize: doc.file_size,
            mimeType: doc.mime_type,
            uploadedBy: doc.uploaded_by,
            uploaderName: doc.uploader_name,
            uploadedAt: doc.uploaded_at,
            verified: doc.verified,
            verifiedAt: doc.verified_at,
            ipfs_cid: doc.ipfs_cid,
            cid: doc.ipfs_cid,
            url: `/api/documents/${doc.id}/view`
        }));
        
        res.json({
            success: true,
            documents,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalDocuments: totalCount,
                hasNext: offset + documents.length < totalCount,
                hasPrev: parseInt(page) > 1
            }
        });
        
    } catch (error) {
        console.error('Search documents error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
