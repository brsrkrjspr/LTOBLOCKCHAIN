// TrustChain Document Management Routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const router = express.Router();
const db = require('../database/services');
const storageService = require('../services/storageService');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const docTypes = require('../config/documentTypes');

// ============================================
// Temporary Token Store for Document Viewing
// ============================================
const tempViewTokens = new Map();
const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
let lastCleanup = Date.now();

/**
 * Generate secure random token for temporary document viewing
 */
function generateViewToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Cleanup expired tokens (run periodically)
 * Rate-limited to max once per minute
 */
function cleanupExpiredTokens() {
    const now = Date.now();
    if (now - lastCleanup < 60000) return; // Skip if cleanup ran less than 1 min ago
    
    let removed = 0;
    for (const [token, data] of tempViewTokens.entries()) {
        if (now - data.createdAt > TOKEN_EXPIRY_MS) {
            tempViewTokens.delete(token);
            removed++;
        }
    }
    
    if (removed > 0) {
        console.log(`[ViewTokens] Cleanup: removed ${removed} expired tokens`);
    }
    lastCleanup = now;
}

/**
 * Middleware: Authenticate via JWT token OR temporary view token
 * Supports both Authorization header and ?token= query parameter
 */
async function authenticateTokenOrTemp(req, res, next) {
    const tempToken = req.query.token;
    
    // If temporary token provided, validate it
    if (tempToken) {
        cleanupExpiredTokens();
        
        const tokenData = tempViewTokens.get(tempToken);
        if (!tokenData) {
            return res.status(401).json({
                success: false,
                error: 'View token invalid or expired'
            });
        }
        
        const isExpired = Date.now() - tokenData.createdAt > TOKEN_EXPIRY_MS;
        if (isExpired) {
            tempViewTokens.delete(tempToken);
            return res.status(401).json({
                success: false,
                error: 'View token expired'
            });
        }
        
        // Verify document ID matches
        if (req.params.documentId !== tokenData.documentId) {
            return res.status(403).json({
                success: false,
                error: 'Token not valid for this document'
            });
        }
        
        // Set user context from token data
        req.user = {
            userId: tokenData.userId,
            role: tokenData.role,
            email: tokenData.email
        };
        req.tokenType = 'temp-view';
        next();
    } else {
        // Fall back to JWT authentication
        authenticateToken(req, res, next);
    }
}

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
// LEGACY: Kept for backward compatibility, now uses centralized config
function mapDocumentType(type) {
    // First try legacy mapping for backward compatibility
    const legacyType = docTypes.mapLegacyType(type);
    
    // Then map to database type using centralized config
    return docTypes.mapToDbType(legacyType);
}

// View document by IPFS CID (wrapper that reuses existing view logic)
// This supports existing frontend URLs like /api/documents/ipfs/:cid
router.get('/ipfs/:cid', authenticateToken, async (req, res) => {
    try {
        const { cid } = req.params;

        // Find document by IPFS CID
        console.log(`[Documents/IPFS] Looking up document by CID: ${cid}`);
        const document = await db.getDocumentByCid(cid);
        if (!document) {
            console.log(`[Documents/IPFS] Document not found for CID: ${cid}`);
            return res.status(404).json({
                success: false,
                error: 'Document not found for this CID'
            });
        }
        console.log(`[Documents/IPFS] Found document:`, {
            id: document.id,
            vehicle_id: document.vehicle_id,
            document_type: document.document_type,
            has_ipfs_cid: !!document.ipfs_cid,
            has_file_path: !!document.file_path
        });

        // Get vehicle to check permissions (same rules as /:documentId/view)
        const vehicle = await db.getVehicleById(document.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier =
            req.user.role === 'insurance_verifier' ||
            req.user.role === 'hpg_admin';
        
        console.log(`[Documents/IPFS] Permission check for CID ${cid}:`, {
            userId: req.user.userId,
            role: req.user.role,
            isAdmin,
            isOwner,
            isVerifier,
            vehicleOwnerId: vehicle.owner_id
        });

        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get document from storage service (IPFS or local)
        let filePath = null;
        let mimeType = document.mime_type || 'application/pdf';

        if (document.ipfs_cid || document.file_path) {
            try {
                const storageResult = await storageService.getDocument(document.id);
                filePath = storageResult.filePath;
                if (storageResult.mimeType) {
                    mimeType = storageResult.mimeType;
                }
            } catch (storageError) {
                console.error('Storage service error (IPFS view):', storageError);
                // Fallback to direct file path if available
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

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Document file not found on storage system'
            });
        }

        // Stream inline
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.original_name}"`);

        res.sendFile(path.resolve(filePath), (err) => {
            if (err) {
                console.error('View error (IPFS route):', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to view document'
                    });
                }
            }
        });
    } catch (error) {
        console.error('View by CID error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Failed to view document by CID'
            });
        }
    }
});

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
        // Support both 'type' and 'documentType' for backward compatibility
        let docType = type || documentType || docTypes.LOGICAL_TYPES.REGISTRATION_CERT;
        
        // Map legacy types to canonical logical types
        docType = docTypes.mapLegacyType(docType);

        // MVIR is not allowed via general document upload route
        // MVIR is only used in transfer of ownership workflow and must be uploaded via LTO inspection route
        // Initial registration does not require MVIR
        if (docType === docTypes.LOGICAL_TYPES.MVIR) {
            try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}
            return res.status(400).json({
                success: false,
                error: 'MVIR documents cannot be uploaded via this route',
                message: 'MVIR (Motor Vehicle Inspection Report) is only used in transfer of ownership workflow and must be uploaded through the LTO inspection process. Initial registration does not require MVIR.',
                alternativeRoute: 'Use POST /api/lto/inspect-documents for MVIR uploads during vehicle inspection'
            });
        }

        // Validate document type with context awareness
        const validation = docTypes.validateDocumentTypeForUpload(docType);

        if (!validation.valid) {
            console.error('❌ Document type validation failed:', {
                received: type || documentType,
                mapped: docType,
                error: validation.error,
                userId: req.user?.userId,
                route: '/api/documents/upload'
            });
            
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: validation.error,
                receivedType: type || documentType,
                validTypes: docTypes.getValidLogicalTypes()
            });
        }

        // Validate document type using centralized config (additional safety check)
        if (!docTypes.isValidLogicalType(docType)) {
            // Log the invalid type for debugging
            console.error('❌ Invalid document type received:', {
                received: type || documentType,
                mapped: docType,
                userId: req.user?.userId,
                route: '/api/documents/upload',
                validTypes: docTypes.getValidLogicalTypes()
            });
            
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Invalid document type',
                message: `Document type '${docType}' is not valid. Valid types: ${docTypes.getValidLogicalTypes().join(', ')}`,
                receivedType: type || documentType,
                validTypes: docTypes.getValidLogicalTypes()
            });
        }
        
        // Log successful validation
        console.log('📄 Document upload:', {
            docType,
            userId: req.user?.userId,
            route: '/api/documents/upload',
            fileName: req.file.originalname,
            fileSize: req.file.size
        });

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
            console.error('Storage error name:', storageError.name);
            console.error('Storage error code:', storageError.code);
            
            // Check for timeout errors specifically
            const isTimeoutError = storageError.message && (
                storageError.message.includes('timeout') || 
                storageError.message.includes('TIMEDOUT') ||
                storageError.code === 'ETIMEDOUT'
            );
            
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
                
                // Return appropriate status code based on error type
                const statusCode = isTimeoutError ? 504 : 503;
                const errorMessage = isTimeoutError 
                    ? `IPFS upload timeout: The IPFS service took too long to respond. This may indicate IPFS is slow, overloaded, or unresponsive.`
                    : `IPFS storage is required (STORAGE_MODE=ipfs) but IPFS service is unavailable. Please ensure IPFS is running and accessible.`;
                
                return res.status(statusCode).json({
                    success: false,
                    error: 'Document storage failed',
                    message: errorMessage,
                    details: storageError.message,
                    errorType: isTimeoutError ? 'timeout' : 'connection',
                    troubleshooting: {
                        checkIPFS: 'Verify IPFS container is running: docker ps | findstr ipfs',
                        checkAPI: 'Test IPFS API: curl -X POST http://localhost:5001/api/v0/version',
                        checkConfig: 'Verify IPFS API address: docker exec ipfs ipfs config Addresses.API',
                        checkLogs: 'Check IPFS logs: docker logs ipfs',
                        restartIPFS: 'Restart IPFS: docker restart ipfs',
                        increaseTimeout: isTimeoutError ? 'Consider increasing IPFS_UPLOAD_TIMEOUT in .env (default: 25000ms)' : undefined
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

        // Map legacy types to canonical logical types
        const mappedType = docTypes.mapLegacyType(documentType);
        
        // Validate document type with context awareness
        const validation = docTypes.validateDocumentTypeForUpload(mappedType);

        if (!validation.valid) {
            console.error('❌ Document type validation failed in /upload-auth:', {
                received: documentType,
                mapped: mappedType,
                error: validation.error,
                userId: req.user?.userId,
                vehicleVin,
                route: '/api/documents/upload-auth'
            });
            
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: validation.error,
                receivedType: documentType,
                validTypes: docTypes.getValidLogicalTypes()
            });
        }
        
        // Validate document type using centralized config (additional safety check)
        if (!docTypes.isValidLogicalType(mappedType)) {
            console.error('❌ Invalid document type in /upload-auth:', {
                received: documentType,
                mapped: mappedType,
                userId: req.user?.userId,
                vehicleVin,
                validTypes: docTypes.getValidLogicalTypes()
            });
            
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Invalid document type',
                message: `Document type '${mappedType}' is not valid. Valid types: ${docTypes.getValidLogicalTypes().join(', ')}`,
                receivedType: documentType,
                validTypes: docTypes.getValidLogicalTypes()
            });
        }
        
        // Use mapped type for storage
        const docType = mappedType;
        
        // Log successful validation
        console.log('📄 Document upload (auth):', {
            docType,
            userId: req.user?.userId,
            vehicleVin,
            route: '/api/documents/upload-auth',
            fileName: req.file.originalname
        });

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
        // Use mapped canonical type
        const storageResult = await storageService.storeDocument(
            req.file,
            docType,
            vehicleVin,
            req.user.email || null
        );

        // Create document record in database with CID
        // Use centralized mapping function
        const document = await db.createDocument({
            vehicleId: vehicle.id,
            documentType: docTypes.mapToDbType(docType),
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
                documentType: docType, // Return canonical logical type
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

// Search documents - MUST be before /:documentId route to avoid route conflict
router.get('/search', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vin, applicationId, vehicleId, documentType, page = 1, limit = 50 } = req.query;
        
        let query = `
            SELECT d.*,
                   v.id as vehicle_id, v.vin, v.plate_number, v.make, v.model, v.year,
                   u.first_name || ' ' || u.last_name as uploader_name
            FROM documents d
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
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
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
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
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'hpg_admin';
        
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
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'hpg_admin';
        
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

// Generate temporary view token for document viewing
// Allows iframe to load document without custom Authorization header
router.post('/:documentId/temp-view-token', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Validate document exists
        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Check permissions (reuse existing logic from view endpoint)
        const vehicle = await db.getVehicleById(document.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'hpg_admin';
        
        if (!isAdmin && !isOwner && !isVerifier) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Generate temporary token
        const token = generateViewToken();
        tempViewTokens.set(token, {
            documentId: documentId,
            userId: req.user.userId,
            role: req.user.role,
            email: req.user.email,
            createdAt: Date.now()
        });

        console.log(`[ViewTokens] Generated token for document ${documentId}, user ${req.user.userId}`);

        res.json({
            success: true,
            token: token,
            expiresIn: TOKEN_EXPIRY_MS / 1000 // in seconds
        });

    } catch (error) {
        console.error('Temp token generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate view token'
        });
    }
});

// View document (inline, for iframe display)
router.get('/:documentId/view', authenticateTokenOrTemp, async (req, res) => {
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
        const isVerifier = req.user.role === 'insurance_verifier' || req.user.role === 'hpg_admin';
        
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
        
        // Chrome-specific headers for PDF embedding in iframes
        // These headers are REQUIRED for Chrome to render PDFs inline instead of showing "Open" button
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        
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
        if (!['admin', 'insurance_verifier'].includes(req.user.role)) {
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
        const isVerifier = req.user.role === 'insurance_verifier';
        
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
        const isVerifier = req.user.role === 'insurance_verifier';
        
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


// OCR Text Extraction Endpoint
// Extracts information from uploaded documents for auto-fill
router.post('/extract-info', authenticateToken, upload.single('document'), async (req, res) => {
    // Declare variables in function scope (accessible in both try and catch)
    let documentType = null;
    let extractionMethod = 'none';
    let finalDocumentType = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Extract documentType from req.body (FormData field)
        // Note: Multer should parse FormData fields into req.body, but sometimes they're undefined
        // Try multiple field name variations for maximum compatibility
        
        // Strategy 1: Check req.body fields (multiple variations)
        if (req.body?.documentType) {
            documentType = req.body.documentType;
            extractionMethod = 'req.body.documentType (camelCase)';
        } else if (req.body?.document_type) {
            documentType = req.body.document_type;
            extractionMethod = 'req.body.document_type (snake_case)';
        } else if (req.body?.type) {
            documentType = req.body.type;
            extractionMethod = 'req.body.type (legacy)';
        }
        
        // #region agent log
        console.log('[OCR API Debug] Request received:', {
            hasFile: !!req.file,
            fileName: req.file?.originalname,
            fileMimeType: req.file?.mimetype,
            bodyKeys: Object.keys(req.body || {}),
            bodyType: typeof req.body,
            bodyIsObject: req.body && typeof req.body === 'object',
            documentTypeFromBody: documentType,
            extractionMethod: extractionMethod
        });
        // #endregion
        
        // Strategy 2: Infer from filename if not found in req.body
        if (!documentType) {
            console.warn('[OCR API Debug] WARNING: documentType is missing from req.body! Attempting filename inference...');
            const fileName = req.file?.originalname?.toLowerCase() || '';
            
            // Enhanced filename-based inference for multiple document types
            if (fileName.includes('driver') || fileName.includes('license') || fileName.includes('dl') || fileName.includes('drivers')) {
                documentType = 'ownerValidId';
                extractionMethod = 'filename inference (driver/license keywords)';
            } else if (fileName.includes('passport') || fileName.includes('pp-') || fileName.includes('_pp')) {
                documentType = 'ownerValidId'; // Passport is also owner ID
                extractionMethod = 'filename inference (passport keywords)';
            } else if (fileName.includes('national') || fileName.includes('nid') || fileName.includes('philid')) {
                documentType = 'ownerValidId'; // National ID is also owner ID
                extractionMethod = 'filename inference (national-id keywords)';
            } else if (fileName.includes('postal') || fileName.includes('postal-id')) {
                documentType = 'ownerValidId'; // Postal ID is also owner ID
                extractionMethod = 'filename inference (postal-id keywords)';
            } else if (fileName.includes('voter') || fileName.includes('voters')) {
                documentType = 'ownerValidId'; // Voter's ID is also owner ID
                extractionMethod = 'filename inference (voter-id keywords)';
            } else if (fileName.includes('sss') || fileName.includes('social')) {
                documentType = 'ownerValidId'; // SSS ID is also owner ID
                extractionMethod = 'filename inference (sss-id keywords)';
            } else if (fileName.includes('sales') || fileName.includes('invoice')) {
                documentType = 'salesInvoice';
                extractionMethod = 'filename inference (sales invoice keywords)';
            } else if (fileName.includes('csr') || fileName.includes('stock') || fileName.includes('certificate-of-stock')) {
                documentType = 'certificateOfStockReport';
                extractionMethod = 'filename inference (csr keywords)';
            } else if (fileName.includes('hpg') || fileName.includes('clearance')) {
                documentType = 'pnpHpgClearance';
                extractionMethod = 'filename inference (hpg clearance keywords)';
            } else if (fileName.includes('insurance') || fileName.includes('ctpl')) {
                documentType = 'insuranceCertificate';
                extractionMethod = 'filename inference (insurance keywords)';
            } else {
                // Default fallback
                documentType = 'registration_cert';
                extractionMethod = 'default fallback (registration_cert)';
            }
            
            console.log('[OCR API Debug] DocumentType inferred from filename:', {
                fileName: req.file?.originalname,
                inferredDocumentType: documentType,
                extractionMethod: extractionMethod
            });
        } else {
            console.log('[OCR API Debug] DocumentType extracted from req.body:', {
                documentType: documentType,
                extractionMethod: extractionMethod
            });
        }
        
        // Validate documentType is valid before processing
        const validDocumentTypes = [
            'ownerValidId', 'owner_id', 'ownerId',
            'registration_cert', 'registrationCert', 'or_cr', 'orCr',
            'salesInvoice', 'sales_invoice',
            'certificateOfStockReport', 'csr',
            'pnpHpgClearance', 'hpg_clearance', 'hpgClearance',
            'insuranceCertificate', 'insurance_cert', 'insuranceCert'
        ];
        
        if (documentType && !validDocumentTypes.includes(documentType)) {
            console.warn('[OCR API Debug] WARNING: documentType may be invalid:', documentType);
            // Continue processing anyway (may be a valid type we haven't listed)
        }
        // #endregion
        
        // Check if OCR is enabled (can be disabled via environment variable)
        const ocrEnabled = process.env.OCR_ENABLED !== 'false';
        if (!ocrEnabled) {
            // Clean up file and return empty result
            await fsPromises.unlink(req.file.path).catch(() => {});
            return res.json({
                success: true,
                extractedData: {},
                message: 'OCR is disabled',
                rawText: ''
            });
        }

        // Import OCR service (lazy load to avoid errors if packages not installed)
        let ocrService;
        try {
            ocrService = require('../services/ocrService');
        } catch (importError) {
            console.warn('OCR service not available:', importError.message);
            // Clean up file
            await fsPromises.unlink(req.file.path).catch(() => {});
            return res.json({
                success: true,
                extractedData: {},
                message: 'OCR service not available',
                rawText: ''
            });
        }

        // Extract text from document
        // #region agent log
        console.log('[OCR API Debug] Starting text extraction:', {
            filePath: req.file.path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            documentType: documentType
        });
        // #endregion
        
        // Wrap extractText in try/catch for extra safety (even though it should never throw now)
        let text = '';
        try {
            text = await ocrService.extractText(req.file.path, req.file.mimetype);
            // Ensure text is always a string
            if (typeof text !== 'string') {
                console.warn('[OCR API Debug] WARNING: extractText returned non-string value. Converting to string.');
                text = String(text || '');
            }
        } catch (extractError) {
            console.error('[OCR API Debug] ERROR calling extractText (should not happen):', {
                error: extractError.message,
                errorName: extractError.name,
                stack: extractError.stack
            });
            text = ''; // Fallback to empty string
        }
        
        // #region agent log
        console.log('[OCR API Debug] Text extraction completed:', {
            documentType: documentType,
            textLength: text ? text.length : 0,
            textPreview: text ? text.substring(0, 500) : 'NO TEXT EXTRACTED',
            hasText: !!text && text.length > 0,
            extractionMethod: text && text.length > 0 ? 'success' : 'failed'
        });
        
        // Validate extracted text before parsing
        if (!text || text.trim().length === 0) {
            console.warn('[OCR API Debug] WARNING: No text extracted from document! This will result in empty extractedData.');
            // Return early with empty result but still success (graceful degradation)
            await fsPromises.unlink(req.file.path).catch(() => {});
            return res.json({
                success: true,
                extractedData: {},
                message: 'No text could be extracted from the document. The document may be image-only or corrupted.',
                rawText: '',
                documentType: documentType,
                warnings: ['Text extraction failed - document may require manual data entry']
            });
        }
        
        // Validate text quality (minimum length check)
        if (text.trim().length < 10) {
            console.warn('[OCR API Debug] WARNING: Extracted text is very short (', text.trim().length, 'chars). Quality may be poor.');
        }
        // #endregion
        
        // Parse vehicle/owner information
        // Use the documentType we determined (with fallback logic above)
        finalDocumentType = documentType || 'registration_cert';
        
        // #region agent log
        console.log('[OCR API Debug] Starting data parsing:', {
            documentType: finalDocumentType,
            textLength: text ? text.length : 0,
            hasText: !!text && text.length > 0
        });
        // #endregion
        
        let extractedData = {};
        try {
            // #region agent log
            console.log('[OCR API Debug] Calling parseVehicleInfo with:', {
                documentType: finalDocumentType,
                textLength: text ? text.length : 0,
                hasText: !!text && text.length > 0
            });
            // #endregion
            
            extractedData = ocrService.parseVehicleInfo(text, finalDocumentType);
            
            // #region agent log
            console.log('[OCR API Debug] parseVehicleInfo completed successfully');
            // #endregion
        } catch (parseError) {
            // #region agent log
            console.error('[OCR API Debug] ERROR in parseVehicleInfo:', {
                error: parseError.message,
                errorName: parseError.name,
                stack: parseError.stack,
                documentType: finalDocumentType,
                textLength: text ? text.length : 0
            });
            // #endregion
            
            // Continue with empty extractedData (graceful degradation)
            extractedData = {};
        }
        
        // #region agent log
        console.log('[OCR API Debug] Data parsing completed:', {
            documentType: finalDocumentType,
            extractedDataKeys: Object.keys(extractedData),
            extractedFieldsCount: Object.keys(extractedData).length,
            hasIdType: !!extractedData.idType,
            hasIdNumber: !!extractedData.idNumber,
            idType: extractedData.idType,
            idNumber: extractedData.idNumber,
            allExtractedFields: extractedData,
            isEmpty: Object.keys(extractedData).length === 0
        });
        
        if (finalDocumentType === 'ownerValidId' || finalDocumentType === 'owner_id' || finalDocumentType === 'ownerId') {
            if (!extractedData.idType || !extractedData.idNumber) {
                console.warn('[OCR API Debug] WARNING: Owner ID document processed but ID Type or ID Number not extracted!', {
                    hasIdType: !!extractedData.idType,
                    hasIdNumber: !!extractedData.idNumber,
                    textPreview: text ? text.substring(0, 300) : 'NO TEXT'
                });
            } else {
                console.log('[OCR API Debug] SUCCESS: Owner ID document processed successfully!', {
                    idType: extractedData.idType,
                    idNumber: extractedData.idNumber
                });
            }
        }
        // #endregion
        
        // Clean up temp file
        try {
            await fsPromises.unlink(req.file.path);
            console.log('[OCR API Debug] Temp file cleaned up successfully');
        } catch (cleanupError) {
            console.warn('[OCR API Debug] Failed to cleanup temp file:', cleanupError);
        }
        
        // Validate extracted data and prepare warnings
        const warnings = [];
        const extractedFieldsCount = Object.keys(extractedData).length;
        
        // Check for expected fields based on document type
        if (finalDocumentType === 'ownerValidId' || finalDocumentType === 'owner_id' || finalDocumentType === 'ownerId') {
            if (!extractedData.idType) {
                warnings.push('ID Type not extracted from document');
            }
            if (!extractedData.idNumber) {
                warnings.push('ID Number not extracted from document');
            }
        }
        
        // Determine confidence level based on extraction results
        let confidence = 'low';
        if (extractedFieldsCount > 0) {
            confidence = extractedFieldsCount >= 3 ? 'high' : 'medium';
        }
        
        // #region agent log
        console.log('[OCR API Debug] Sending response to frontend:', {
            success: true,
            extractedDataKeys: Object.keys(extractedData),
            extractedFieldsCount: extractedFieldsCount,
            documentType: documentType,
            hasIdType: !!extractedData.idType,
            hasIdNumber: !!extractedData.idNumber,
            confidence: confidence,
            warnings: warnings
        });
        // #endregion
        
        // Return response with graceful degradation (partial results if available)
        res.json({
            success: true,
            extractedData,
            confidence: confidence,
            rawText: text ? text.substring(0, 500) : '', // First 500 chars for debugging
            documentType: documentType,
            warnings: warnings.length > 0 ? warnings : undefined,
            extractedFieldsCount: extractedFieldsCount
        });
    } catch (error) {
        // #region agent log
        console.error('[OCR API Debug] ERROR in OCR extraction:', {
            error: error.message,
            errorName: error.name,
            stack: error.stack,
            fileName: req.file?.originalname,
            documentType: documentType || 'unknown',
            finalDocumentType: finalDocumentType || 'unknown',
            filePath: req.file?.path,
            hasFile: !!req.file
        });
        // #endregion
        
        // Clean up file on error
        if (req.file && req.file.path) {
            try {
                await fsPromises.unlink(req.file.path);
                console.log('[OCR API Debug] Temp file cleaned up after error');
            } catch (cleanupError) {
                console.warn('[OCR API Debug] Failed to cleanup file on error:', cleanupError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to extract information from document',
            message: error.message,
            documentType: documentType || 'unknown'
        });
    }
});

// Update document type (admin only)
// Allows admins to correct document types, especially for 'other' type documents
router.patch('/:documentId/type', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { documentId } = req.params;
        const { documentType } = req.body;

        if (!documentType) {
            return res.status(400).json({
                success: false,
                error: 'Document type is required'
            });
        }

        // Map legacy types to canonical logical types
        const mappedType = docTypes.mapLegacyType(documentType);
        
        // Validate the new document type
        const validation = docTypes.validateDocumentTypeForUpload(mappedType);

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error,
                receivedType: documentType
            });
        }

        // Get the document
        const document = await db.getDocumentById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        // Map to database type
        const dbDocType = docTypes.mapToDbType(mappedType);

        // Update document type in database
        const dbModule = require('../database/db');
        const result = await dbModule.query(
            'UPDATE documents SET document_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [dbDocType, documentId]
        );

        if (result.rows.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'Failed to update document type'
            });
        }

        // Log the correction for audit trail
        console.log(`[Admin] Document type corrected:`, {
            documentId,
            oldType: document.document_type,
            newType: dbDocType,
            logicalType: mappedType,
            correctedBy: req.user.userId,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Document type updated successfully',
            document: {
                id: result.rows[0].id,
                documentType: dbDocType,
                logicalType: mappedType,
                previousType: document.document_type
            }
        });

    } catch (error) {
        console.error('Error updating document type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update document type',
            message: error.message
        });
    }
});

module.exports = router;
