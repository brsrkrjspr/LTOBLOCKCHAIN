// TrustChain LTO - Unified Storage Service
// Automatically uses IPFS when available, falls back to local storage
// Provides a consistent interface for document storage

const ipfsService = require('./ipfsService');
const localStorageService = require('./localStorageService');
const fs = require('fs');
const path = require('path');

class StorageService {
    constructor() {
        this.storageMode = process.env.STORAGE_MODE; // Must be 'ipfs' or 'local' - no auto mode
        this.currentMode = 'local'; // Will be set after initialization
        this.initialized = false;
    }

    // Initialize storage service
    async initialize() {
        if (this.initialized) {
            return { success: true, mode: this.currentMode };
        }

        // Require explicit mode - no auto fallback
        if (!this.storageMode || (this.storageMode !== 'ipfs' && this.storageMode !== 'local')) {
            throw new Error('STORAGE_MODE must be set to either "ipfs" or "local" in .env file. Auto mode removed.');
        }

        // If mode is 'local', use local storage only
        if (this.storageMode === 'local') {
            this.currentMode = 'local';
            this.initialized = true;
            console.log('📁 Using local storage mode');
            return { success: true, mode: 'local' };
        }

        // If mode is 'ipfs', try IPFS only
        if (this.storageMode === 'ipfs') {
            console.log('🔗 Initializing IPFS storage (STORAGE_MODE=ipfs)...');
            const ipfsResult = await ipfsService.initialize();
            if (ipfsResult.success && ipfsService.isAvailable()) {
                this.currentMode = 'ipfs';
                this.initialized = true;
                console.log('🌐 Using IPFS storage mode');
                return { success: true, mode: 'ipfs' };
            } else {
                const errorMsg = ipfsResult.error || 'IPFS service not available';
                throw new Error(`IPFS mode requested (STORAGE_MODE=ipfs) but IPFS is not available: ${errorMsg}`);
            }
        }
    }

    // Store document
    async storeDocument(file, documentType, vehicleVin, ownerEmail) {
        try {
            // Ensure file object is valid
            if (!file || !file.path) {
                throw new Error('Invalid file object: file or file.path is missing');
            }
            
            // Check if file exists
            if (!fs.existsSync(file.path)) {
                throw new Error(`File does not exist at path: ${file.path}`);
            }
            
            await this.initialize();
        } catch (initError) {
            console.error('❌ Storage initialization error:', initError.message);
            throw initError; // Always throw - no fallback
        }

        if (this.currentMode === 'ipfs' && ipfsService.isAvailable()) {
            try {
                // Store on IPFS
                const metadata = {
                    originalName: file.originalname,
                    documentType: documentType,
                    vehicleVin: vehicleVin,
                    ownerEmail: ownerEmail,
                    uploadDate: new Date().toISOString()
                };

                const ipfsResult = await ipfsService.storeDocument(file.path, metadata);

                // Also save metadata locally for quick access
                const documentId = this.generateDocumentId();
                const localMetadata = {
                    id: documentId,
                    cid: ipfsResult.cid,
                    originalName: file.originalname,
                    filename: file.filename,
                    path: file.path, // Keep local copy temporarily
                    size: file.size,
                    mimetype: file.mimetype,
                    documentType: documentType,
                    vehicleVin: vehicleVin,
                    ownerEmail: ownerEmail,
                    uploadDate: metadata.uploadDate,
                    hash: await this.calculateFileHash(file.path),
                    storageMode: 'ipfs',
                    ipfsUrl: ipfsResult.ipfsUrl,
                    gatewayUrl: ipfsResult.gatewayUrl
                };

                // Save metadata using local storage service
                await localStorageService.saveMetadata(localMetadata);

                console.log(`✅ Document stored on IPFS: ${ipfsResult.cid}`);

                return {
                    success: true,
                    documentId: documentId,
                    cid: ipfsResult.cid,
                    filename: file.filename,
                    hash: localMetadata.hash,
                    size: file.size,
                    uploadDate: metadata.uploadDate,
                    storageMode: 'ipfs',
                    ipfsUrl: ipfsResult.ipfsUrl,
                    gatewayUrl: ipfsResult.gatewayUrl
                };

            } catch (error) {
                console.error('❌ IPFS storage failed:', error.message);
                
                // STORAGE_MODE=ipfs is required - NO FALLBACKS
                // Fail immediately if IPFS is unavailable
                throw new Error(`IPFS storage is required (STORAGE_MODE=ipfs) but storage failed: ${error.message}. Ensure IPFS service is running and accessible.`);
            }
        } else {
            // Use local storage
            try {
                return await localStorageService.storeDocument(file, documentType, vehicleVin, ownerEmail);
            } catch (error) {
                console.error('❌ Local storage failed:', error.message);
                throw new Error(`Document storage failed: ${error.message}`);
            }
        }
    }

    // Get document
    async getDocument(documentId) {
        await this.initialize();
        
        // Get document metadata from DATABASE (not file-based storage)
        const db = require('../database/services');
        const document = await db.getDocumentById(documentId);
        
        if (!document) {
            throw new Error(`Document ${documentId} not found in database`);
        }
        
        // If stored on IPFS, retrieve from IPFS
        if (document.ipfs_cid && ipfsService.isAvailable()) {
            try {
                const ipfsResult = await ipfsService.getDocument(document.ipfs_cid);
                return {
                    success: true,
                    filePath: ipfsResult.filePath,
                    cid: document.ipfs_cid,
                    storageMode: 'ipfs',
                    mimeType: document.mime_type
                };
            } catch (error) {
                console.error('❌ IPFS retrieval failed:', error);
                throw new Error(`IPFS storage is required (STORAGE_MODE=ipfs) but document retrieval from IPFS failed: ${error.message}`);
            }
                throw new Error(`Document retrieval failed: ${error.message}`);
            }
        } else {
            // Use local file path from database
            if (document.file_path && fs.existsSync(document.file_path)) {
                return {
                    success: true,
                    filePath: document.file_path,
                    storageMode: 'local',
                    mimeType: document.mime_type
                };
            }
            throw new Error(`Document file not found at path: ${document.file_path}`);
        }
    }

    // Verify document
    async verifyDocument(documentId) {
        await this.initialize();

        const metadata = await localStorageService.getMetadata(documentId);
        if (!metadata) {
            throw new Error(`Document ${documentId} not found`);
        }

        // If stored on IPFS, verify on IPFS
        if (metadata.storageMode === 'ipfs' && metadata.cid && ipfsService.isAvailable()) {
            try {
                const ipfsResult = await ipfsService.verifyDocument(metadata.cid);
                
                // Also verify local hash if file exists
                let localHashValid = null;
                if (fs.existsSync(metadata.path)) {
                    const currentHash = await this.calculateFileHash(metadata.path);
                    localHashValid = currentHash === metadata.hash;
                }

                return {
                    success: true,
                    documentId: documentId,
                    integrityValid: ipfsResult.exists && (localHashValid === null || localHashValid),
                    storedHash: metadata.hash,
                    cid: metadata.cid,
                    ipfsExists: ipfsResult.exists,
                    ipfsPinned: ipfsResult.pinned,
                    localHashValid: localHashValid,
                    verifiedAt: ipfsResult.verifiedAt,
                    storageMode: 'ipfs'
                };
            } catch (error) {
                console.error('❌ IPFS verification failed:', error);
                throw new Error(`IPFS storage is required (STORAGE_MODE=ipfs) but document verification from IPFS failed: ${error.message}`);
            }
        } else {
            // Use local storage
            return await localStorageService.verifyDocument(documentId);
        }
    }

    // Get documents by vehicle VIN
    async getDocumentsByVehicle(vehicleVin) {
        await this.initialize();
        return await localStorageService.getDocumentsByVehicle(vehicleVin);
    }

    // Get documents by owner email
    async getDocumentsByOwner(ownerEmail) {
        await this.initialize();
        return await localStorageService.getDocumentsByOwner(ownerEmail);
    }

    // Delete document
    async deleteDocument(documentId) {
        await this.initialize();

        const metadata = await localStorageService.getMetadata(documentId);
        if (!metadata) {
            throw new Error(`Document ${documentId} not found`);
        }

        // If stored on IPFS, unpin it
        if (metadata.storageMode === 'ipfs' && metadata.cid && ipfsService.isAvailable()) {
            try {
                await ipfsService.unpinDocument(metadata.cid);
            } catch (error) {
                console.error('⚠️ Failed to unpin document from IPFS:', error);
                // Continue with deletion even if unpin fails
            }
        }

        // Delete from local storage (metadata and file)
        return await localStorageService.deleteDocument(documentId);
    }

    // Get storage statistics
    async getStorageStats() {
        await this.initialize();

        const localStats = await localStorageService.getStorageStats();
        
        if (this.currentMode === 'ipfs' && ipfsService.isAvailable()) {
            try {
                const ipfsInfo = await ipfsService.getNodeInfo();
                return {
                    success: true,
                    mode: 'ipfs',
                    localStats: localStats.stats,
                    ipfsInfo: ipfsInfo,
                    stats: {
                        ...localStats.stats,
                        ipfsRepoSize: ipfsInfo.repoSize,
                        ipfsNumObjects: ipfsInfo.numObjects,
                        ipfsStorageMax: ipfsInfo.storageMax
                    }
                };
            } catch (error) {
                console.error('❌ Failed to get IPFS stats:', error);
                return localStats;
            }
        } else {
            return {
                ...localStats,
                mode: 'local'
            };
        }
    }

    // Get multer upload middleware
    getUploadMiddleware() {
        return localStorageService.getUploadMiddleware();
    }

    // Helper: Generate document ID
    generateDocumentId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Helper: Calculate file hash
    async calculateFileHash(filePath) {
        return await localStorageService.calculateFileHash(filePath);
    }

    // Get current storage mode
    getStorageMode() {
        return this.currentMode;
    }
}

// Create singleton instance
const storageService = new StorageService();

module.exports = storageService;

