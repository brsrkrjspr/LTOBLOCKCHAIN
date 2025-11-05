// TrustChain Document Management Routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
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

// Mock IPFS service (in production, use real IPFS)
class MockIPFSService {
    static async addFile(filePath) {
        // Simulate IPFS hash generation
        const hash = 'Qm' + Buffer.from(filePath + Date.now()).toString('base64').substring(0, 44);
        return {
            hash,
            size: fs.statSync(filePath).size,
            path: filePath
        };
    }

    static async getFile(hash) {
        // Simulate file retrieval
        return {
            hash,
            exists: true,
            content: 'Mock file content'
        };
    }
}

// Upload document (for registration wizard - no auth required)
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const { type, documentType } = req.body;
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

        // Upload to IPFS (mock)
        const ipfsResult = await MockIPFSService.addFile(req.file.path);

        // Generate mock CID
        const mockCid = 'Qm' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Create document record
        const document = {
            id: 'DOC' + Date.now(),
            documentType: docType,
            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            cid: mockCid,
            ipfsHash: mockCid,
            uploadedBy: 'REGISTRATION_WIZARD',
            uploadedAt: new Date().toISOString(),
            status: 'UPLOADED'
        };

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                id: document.id,
                documentType: document.documentType,
                originalName: document.originalName,
                fileSize: document.fileSize,
                cid: document.cid,
                ipfsHash: document.ipfsHash,
                filename: document.fileName,
                url: `/uploads/${document.fileName}`,
                uploadedAt: document.uploadedAt
            },
            cid: mockCid,
            filename: req.file.filename,
            url: `/uploads/${req.file.filename}`
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

        // Upload to IPFS (mock)
        const ipfsResult = await MockIPFSService.addFile(req.file.path);

        // Create document record
        const document = {
            id: 'DOC' + Date.now(),
            vehicleVin,
            documentType,
            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            ipfsHash: ipfsResult.hash,
            uploadedBy: req.user.userId,
            uploadedAt: new Date().toISOString(),
            status: 'UPLOADED'
        };

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                id: document.id,
                documentType: document.documentType,
                originalName: document.originalName,
                fileSize: document.fileSize,
                ipfsHash: document.ipfsHash,
                uploadedAt: document.uploadedAt
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
router.get('/:documentId', authenticateToken, (req, res) => {
    try {
        const { documentId } = req.params;

        // Mock document retrieval
        const document = {
            id: documentId,
            vehicleVin: 'VIN123456789',
            documentType: 'registrationCert',
            originalName: 'registration_certificate.pdf',
            fileName: 'registrationCert-1234567890.pdf',
            fileSize: 1024000,
            mimeType: 'application/pdf',
            ipfsHash: 'QmXvJ1Z...',
            uploadedBy: req.user.userId,
            uploadedAt: new Date().toISOString(),
            status: 'UPLOADED'
        };

        res.json({
            success: true,
            document
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
router.get('/:documentId/download', authenticateToken, (req, res) => {
    try {
        const { documentId } = req.params;

        // Mock file path (in production, retrieve from IPFS)
        const mockFilePath = './uploads/registrationCert-1234567890.pdf';
        
        if (!fs.existsSync(mockFilePath)) {
            return res.status(404).json({
                success: false,
                error: 'Document file not found'
            });
        }

        res.download(mockFilePath, 'document.pdf', (err) => {
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

// Verify document integrity
router.post('/:documentId/verify', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.params;

        // Mock document verification
        const verification = {
            documentId,
            verified: true,
            hash: 'QmXvJ1Z...',
            timestamp: new Date().toISOString(),
            verifiedBy: req.user.userId,
            details: 'Document integrity verified successfully'
        };

        res.json({
            success: true,
            message: 'Document verified successfully',
            verification
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
router.get('/vehicle/:vin', authenticateToken, (req, res) => {
    try {
        const { vin } = req.params;

        // Mock documents for vehicle
        const documents = [
            {
                id: 'DOC001',
                documentType: 'registrationCert',
                originalName: 'registration_certificate.pdf',
                fileSize: 1024000,
                ipfsHash: 'QmXvJ1Z...',
                uploadedAt: '2024-01-15T10:30:00Z',
                status: 'UPLOADED'
            },
            {
                id: 'DOC002',
                documentType: 'insuranceCert',
                originalName: 'insurance_certificate.pdf',
                fileSize: 512000,
                ipfsHash: 'QmAbC2D...',
                uploadedAt: '2024-01-15T11:00:00Z',
                status: 'UPLOADED'
            },
            {
                id: 'DOC003',
                documentType: 'emissionCert',
                originalName: 'emission_test.pdf',
                fileSize: 256000,
                ipfsHash: 'QmEfG3H...',
                uploadedAt: '2024-01-15T11:30:00Z',
                status: 'UPLOADED'
            }
        ];

        res.json({
            success: true,
            documents,
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

// Delete document
router.delete('/:documentId', authenticateToken, (req, res) => {
    try {
        const { documentId } = req.params;

        // Mock document deletion
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

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

module.exports = router;
