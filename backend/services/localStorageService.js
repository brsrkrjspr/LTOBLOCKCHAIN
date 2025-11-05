// TrustChain LTO - Local File Storage Service
// Replaces IPFS cluster with local file storage for laptop deployment
// Provides document storage, encryption, and verification capabilities

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

class LocalStorageService {
    constructor() {
        this.uploadsPath = path.join(process.cwd(), 'uploads');
        this.documentsPath = path.join(this.uploadsPath, 'documents');
        this.metadataPath = path.join(this.uploadsPath, 'metadata');
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars';
        
        this.initializeStorage();
        this.setupMulter();
    }

    // Initialize storage directories
    initializeStorage() {
        try {
            // Create necessary directories
            const directories = [
                this.uploadsPath,
                this.documentsPath,
                this.metadataPath,
                path.join(this.documentsPath, 'registration'),
                path.join(this.documentsPath, 'insurance'),
                path.join(this.documentsPath, 'emission'),
                path.join(this.documentsPath, 'identity')
            ];

            directories.forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            });

            console.log('✅ Local storage service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize local storage:', error);
        }
    }

    // Setup multer for file uploads
    setupMulter() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = this.getUploadPath(file.fieldname);
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const extension = path.extname(file.originalname);
                const filename = file.fieldname + '-' + uniqueSuffix + extension;
                cb(null, filename);
            }
        });

        this.upload = multer({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024 // 10MB limit
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only PDF, JPEG, and PNG files are allowed.'));
                }
            }
        });
    }

    // Get upload path based on document type
    getUploadPath(fieldname) {
        const pathMap = {
            'registrationCert': path.join(this.documentsPath, 'registration'),
            'insuranceCert': path.join(this.documentsPath, 'insurance'),
            'emissionCert': path.join(this.documentsPath, 'emission'),
            'ownerId': path.join(this.documentsPath, 'identity')
        };

        return pathMap[fieldname] || this.documentsPath;
    }

    // Store document with metadata
    async storeDocument(file, documentType, vehicleVin, ownerEmail) {
        try {
            const documentId = this.generateDocumentId();
            const timestamp = new Date().toISOString();

            // Create document metadata
            const metadata = {
                id: documentId,
                originalName: file.originalname,
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype,
                documentType: documentType,
                vehicleVin: vehicleVin,
                ownerEmail: ownerEmail,
                uploadDate: timestamp,
                hash: await this.calculateFileHash(file.path),
                encrypted: false,
                verified: false
            };

            // Encrypt file if needed
            if (process.env.ENCRYPT_FILES === 'true') {
                await this.encryptFile(file.path);
                metadata.encrypted = true;
            }

            // Save metadata
            await this.saveMetadata(metadata);

            console.log(`✅ Document stored: ${documentId}`);

            return {
                success: true,
                documentId: documentId,
                filename: file.filename,
                hash: metadata.hash,
                size: file.size,
                uploadDate: timestamp
            };

        } catch (error) {
            console.error('❌ Failed to store document:', error);
            throw new Error(`Document storage failed: ${error.message}`);
        }
    }

    // Retrieve document
    async getDocument(documentId) {
        try {
            const metadata = await this.getMetadata(documentId);
            if (!metadata) {
                throw new Error(`Document ${documentId} not found`);
            }

            // Check if file exists
            if (!fs.existsSync(metadata.path)) {
                throw new Error(`Document file not found: ${metadata.path}`);
            }

            // Decrypt file if needed
            let filePath = metadata.path;
            if (metadata.encrypted) {
                filePath = await this.decryptFile(metadata.path);
            }

            return {
                success: true,
                metadata: metadata,
                filePath: filePath
            };

        } catch (error) {
            console.error('❌ Failed to get document:', error);
            throw new Error(`Document retrieval failed: ${error.message}`);
        }
    }

    // Verify document integrity
    async verifyDocument(documentId) {
        try {
            const metadata = await this.getMetadata(documentId);
            if (!metadata) {
                throw new Error(`Document ${documentId} not found`);
            }

            // Check if file exists
            if (!fs.existsSync(metadata.path)) {
                throw new Error(`Document file not found: ${metadata.path}`);
            }

            // Calculate current hash
            const currentHash = await this.calculateFileHash(metadata.path);

            // Compare hashes
            const isIntegrityValid = currentHash === metadata.hash;

            // Update verification status
            metadata.verified = isIntegrityValid;
            metadata.lastVerified = new Date().toISOString();

            await this.saveMetadata(metadata);

            return {
                success: true,
                documentId: documentId,
                integrityValid: isIntegrityValid,
                storedHash: metadata.hash,
                currentHash: currentHash,
                verifiedAt: metadata.lastVerified
            };

        } catch (error) {
            console.error('❌ Failed to verify document:', error);
            throw new Error(`Document verification failed: ${error.message}`);
        }
    }

    // Get documents by vehicle VIN
    async getDocumentsByVehicle(vehicleVin) {
        try {
            const metadataFiles = fs.readdirSync(this.metadataPath);
            const documents = [];

            for (const file of metadataFiles) {
                if (file.endsWith('.json')) {
                    const metadata = JSON.parse(
                        fs.readFileSync(path.join(this.metadataPath, file), 'utf8')
                    );

                    if (metadata.vehicleVin === vehicleVin) {
                        documents.push(metadata);
                    }
                }
            }

            return {
                success: true,
                documents: documents,
                count: documents.length
            };

        } catch (error) {
            console.error('❌ Failed to get documents by vehicle:', error);
            throw new Error(`Document query failed: ${error.message}`);
        }
    }

    // Get documents by owner email
    async getDocumentsByOwner(ownerEmail) {
        try {
            const metadataFiles = fs.readdirSync(this.metadataPath);
            const documents = [];

            for (const file of metadataFiles) {
                if (file.endsWith('.json')) {
                    const metadata = JSON.parse(
                        fs.readFileSync(path.join(this.metadataPath, file), 'utf8')
                    );

                    if (metadata.ownerEmail === ownerEmail) {
                        documents.push(metadata);
                    }
                }
            }

            return {
                success: true,
                documents: documents,
                count: documents.length
            };

        } catch (error) {
            console.error('❌ Failed to get documents by owner:', error);
            throw new Error(`Document query failed: ${error.message}`);
        }
    }

    // Delete document
    async deleteDocument(documentId) {
        try {
            const metadata = await this.getMetadata(documentId);
            if (!metadata) {
                throw new Error(`Document ${documentId} not found`);
            }

            // Delete file
            if (fs.existsSync(metadata.path)) {
                fs.unlinkSync(metadata.path);
            }

            // Delete metadata
            const metadataPath = path.join(this.metadataPath, `${documentId}.json`);
            if (fs.existsSync(metadataPath)) {
                fs.unlinkSync(metadataPath);
            }

            console.log(`✅ Document deleted: ${documentId}`);

            return {
                success: true,
                message: 'Document deleted successfully',
                documentId: documentId
            };

        } catch (error) {
            console.error('❌ Failed to delete document:', error);
            throw new Error(`Document deletion failed: ${error.message}`);
        }
    }

    // Calculate file hash
    async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    // Encrypt file
    async encryptFile(filePath) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const iv = crypto.randomBytes(16);

            const cipher = crypto.createCipher(algorithm, key);
            const input = fs.createReadStream(filePath);
            const output = fs.createWriteStream(filePath + '.enc');

            input.pipe(cipher).pipe(output);

            return new Promise((resolve, reject) => {
                output.on('finish', () => {
                    // Replace original file with encrypted version
                    fs.renameSync(filePath + '.enc', filePath);
                    resolve();
                });
                output.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Failed to encrypt file:', error);
            throw error;
        }
    }

    // Decrypt file
    async decryptFile(filePath) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);

            const decipher = crypto.createDecipher(algorithm, key);
            const input = fs.createReadStream(filePath);
            const output = fs.createWriteStream(filePath + '.dec');

            input.pipe(decipher).pipe(output);

            return new Promise((resolve, reject) => {
                output.on('finish', () => {
                    const decryptedPath = filePath + '.dec';
                    resolve(decryptedPath);
                });
                output.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Failed to decrypt file:', error);
            throw error;
        }
    }

    // Generate document ID
    generateDocumentId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Save metadata
    async saveMetadata(metadata) {
        try {
            const metadataPath = path.join(this.metadataPath, `${metadata.id}.json`);
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error('❌ Failed to save metadata:', error);
            throw error;
        }
    }

    // Get metadata
    async getMetadata(documentId) {
        try {
            const metadataPath = path.join(this.metadataPath, `${documentId}.json`);
            if (fs.existsSync(metadataPath)) {
                return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            }
            return null;
        } catch (error) {
            console.error('❌ Failed to get metadata:', error);
            throw error;
        }
    }

    // Get storage statistics
    async getStorageStats() {
        try {
            const stats = {
                totalDocuments: 0,
                totalSize: 0,
                documentsByType: {},
                verifiedDocuments: 0,
                encryptedDocuments: 0
            };

            const metadataFiles = fs.readdirSync(this.metadataPath);
            
            for (const file of metadataFiles) {
                if (file.endsWith('.json')) {
                    const metadata = JSON.parse(
                        fs.readFileSync(path.join(this.metadataPath, file), 'utf8')
                    );

                    stats.totalDocuments++;
                    stats.totalSize += metadata.size;

                    // Count by type
                    stats.documentsByType[metadata.documentType] = 
                        (stats.documentsByType[metadata.documentType] || 0) + 1;

                    // Count verified documents
                    if (metadata.verified) {
                        stats.verifiedDocuments++;
                    }

                    // Count encrypted documents
                    if (metadata.encrypted) {
                        stats.encryptedDocuments++;
                    }
                }
            }

            return {
                success: true,
                stats: stats
            };

        } catch (error) {
            console.error('❌ Failed to get storage stats:', error);
            throw new Error(`Storage stats failed: ${error.message}`);
        }
    }

    // Cleanup old files
    async cleanupOldFiles(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const metadataFiles = fs.readdirSync(this.metadataPath);
            let cleanedCount = 0;

            for (const file of metadataFiles) {
                if (file.endsWith('.json')) {
                    const metadata = JSON.parse(
                        fs.readFileSync(path.join(this.metadataPath, file), 'utf8')
                    );

                    const uploadDate = new Date(metadata.uploadDate);
                    if (uploadDate < cutoffDate) {
                        await this.deleteDocument(metadata.id);
                        cleanedCount++;
                    }
                }
            }

            console.log(`✅ Cleaned up ${cleanedCount} old documents`);

            return {
                success: true,
                cleanedCount: cleanedCount
            };

        } catch (error) {
            console.error('❌ Failed to cleanup old files:', error);
            throw new Error(`Cleanup failed: ${error.message}`);
        }
    }

    // Get multer upload middleware
    getUploadMiddleware() {
        return this.upload;
    }
}

// Create singleton instance
const localStorageService = new LocalStorageService();

module.exports = localStorageService;
