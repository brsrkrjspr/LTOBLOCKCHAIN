// TrustChain LTO - IPFS Storage Service
// Real IPFS implementation using ipfs-http-client
// Provides document storage on IPFS network

// Use dynamic import for ESM module compatibility
let ipfsClient = null;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dynamically import ipfs-http-client (ESM module)
// ipfs-http-client v60+ is ESM-only and exports 'create' as named export
async function getIPFSClient() {
    if (!ipfsClient) {
        try {
            // Use dynamic import for ESM modules
            const ipfsHttpClient = await import('ipfs-http-client');
            // 'create' is exported directly as named export
            ipfsClient = ipfsHttpClient.create;
            if (!ipfsClient || typeof ipfsClient !== 'function') {
                throw new Error('IPFS create function not found in module');
            }
        } catch (error) {
            console.error('❌ Failed to load IPFS client:', error.message);
            return null;
        }
    }
    return ipfsClient;
}

class IPFSService {
    constructor() {
        this.ipfsHost = process.env.IPFS_HOST || 'localhost';
        this.ipfsPort = process.env.IPFS_PORT || '5001';
        this.ipfsProtocol = process.env.IPFS_PROTOCOL || 'http';
        this.ipfs = null;
        this.isConnected = false;
        this.initialized = false;
    }

    // Initialize IPFS connection
    async initialize() {
        if (this.initialized) {
            return { success: this.isConnected, mode: this.isConnected ? 'ipfs' : 'offline' };
        }

        try {
            const ipfsUrl = `${this.ipfsProtocol}://${this.ipfsHost}:${this.ipfsPort}`;
            console.log(`🔗 Connecting to IPFS at ${ipfsUrl}...`);

            // Get IPFS client using dynamic import
            const create = await getIPFSClient();
            if (!create) {
                throw new Error('IPFS client not available');
            }

            // Create IPFS client instance with proper configuration
            this.ipfs = create({
                host: this.ipfsHost,
                port: this.ipfsPort,
                protocol: this.ipfsProtocol,
                timeout: 30000, // 30 second timeout for uploads
                apiPath: '/api/v0'
            });

            // Test connection by getting version
            const version = await this.ipfs.version();
            console.log(`✅ Connected to IPFS version ${version.version}`);

            this.isConnected = true;
            this.initialized = true;

            return { success: true, mode: 'ipfs', version: version.version };

        } catch (error) {
            // Always log error details for debugging
            console.error('❌ Failed to connect to IPFS:', error.message);
            console.error('   IPFS URL:', `${this.ipfsProtocol}://${this.ipfsHost}:${this.ipfsPort}`);
            console.error('   Error type:', error.name);
            if (error.stack) {
                console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
            }
            
            this.isConnected = false;
            this.initialized = true;
            return { success: false, mode: 'offline', error: error.message };
        }
    }

    // Store document on IPFS with timeout protection
    async storeDocument(filePath, metadata = {}) {
        if (!this.isConnected) {
            throw new Error('IPFS is not connected');
        }

        // Timeout wrapper to prevent hanging requests (25 seconds to allow proxy timeout buffer)
        const uploadTimeout = parseInt(process.env.IPFS_UPLOAD_TIMEOUT) || 25000;
        
        return Promise.race([
            // Actual upload operation
            (async () => {
                try {
                    // Read file
                    const fileBuffer = fs.readFileSync(filePath);
                    const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
                    console.log(`📤 Uploading to IPFS: ${fileSizeMB}MB file`);
                    
                    // Add file to IPFS
                    const result = await this.ipfs.add({
                        path: metadata.originalName || path.basename(filePath),
                        content: fileBuffer
                    }, {
                        pin: true, // Pin the file to prevent garbage collection
                        cidVersion: 1 // Use CIDv1 for better compatibility
                    });

                    const cid = result.cid.toString();
                    const size = result.size || fileBuffer.length;

                    console.log(`✅ Document stored on IPFS: ${cid}`);

                    return {
                        success: true,
                        cid: cid,
                        size: size,
                        ipfsUrl: `ipfs://${cid}`,
                        gatewayUrl: `${this.ipfsProtocol}://${this.ipfsHost}:8080/ipfs/${cid}`,
                        metadata: metadata
                    };
                } catch (error) {
                    console.error('❌ Failed to store document on IPFS:', error);
                    // Check for specific error types
                    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                        throw new Error(`IPFS connection failed: ${error.message}. Check if IPFS service is running at ${this.ipfsProtocol}://${this.ipfsHost}:${this.ipfsPort}`);
                    }
                    throw new Error(`IPFS storage failed: ${error.message}`);
                }
            })(),
            // Timeout promise
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`IPFS upload timeout after ${uploadTimeout}ms. IPFS service may be slow or unresponsive. Check IPFS status.`));
                }, uploadTimeout);
            })
        ]);
    }

    /**
     * Store a buffer (e.g. in-memory PDF) on IPFS. Used for LTO-issued certs (CSR, Sales Invoice) bound to minted vehicles.
     * @param {Buffer} buffer - PDF or document buffer
     * @param {Object} metadata - { originalName } for filename
     * @returns {Promise<{ success, cid, size, ipfsUrl, gatewayUrl }>}
     */
    async storeBuffer(buffer, metadata = {}) {
        if (!this.isConnected) {
            throw new Error('IPFS is not connected');
        }
        const uploadTimeout = parseInt(process.env.IPFS_UPLOAD_TIMEOUT) || 25000;
        const filename = metadata.originalName || 'document.pdf';
        return Promise.race([
            (async () => {
                const result = await this.ipfs.add(
                    { path: filename, content: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer) },
                    { pin: true, cidVersion: 1 }
                );
                const cid = result.cid.toString();
                const size = result.size || buffer.length;
                console.log(`✅ Document stored on IPFS (buffer): ${cid}`);
                return {
                    success: true,
                    cid,
                    size,
                    ipfsUrl: `ipfs://${cid}`,
                    gatewayUrl: `${this.ipfsProtocol}://${this.ipfsHost}:8080/ipfs/${cid}`,
                    metadata
                };
            })(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`IPFS upload timeout after ${uploadTimeout}ms`)), uploadTimeout);
            })
        ]);
    }

    // Retrieve document from IPFS
    async getDocument(cid) {
        if (!this.isConnected) {
            throw new Error('IPFS is not connected');
        }

        try {
            // Get file from IPFS
            const chunks = [];
            for await (const chunk of this.ipfs.cat(cid)) {
                chunks.push(chunk);
            }

            // Combine chunks into buffer
            const fileBuffer = Buffer.concat(chunks);

            // Create temporary file path
            const tempDir = path.join(process.cwd(), 'uploads', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFilePath = path.join(tempDir, `ipfs-${cid.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`);

            // Write to temporary file
            fs.writeFileSync(tempFilePath, fileBuffer);

            console.log(`✅ Document retrieved from IPFS: ${cid}`);

            return {
                success: true,
                cid: cid,
                filePath: tempFilePath,
                size: fileBuffer.length
            };

        } catch (error) {
            // Enhanced error logging for debugging
            console.error('❌ Failed to get document from IPFS:', error.message);
            console.error('   CID:', cid);
            console.error('   IPFS Status:', this.isConnected ? 'Connected' : 'Not Connected');
            console.error('   IPFS URL:', `${this.ipfsProtocol}://${this.ipfsHost}:${this.ipfsPort}`);
            if (error.stack) {
                console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
            }
            throw new Error(`IPFS retrieval failed: ${error.message}. Check IPFS service availability and CID validity.`);
        }
    }

    // Verify document on IPFS (check if CID exists and is pinned)
    async verifyDocument(cid) {
        if (!this.isConnected) {
            throw new Error('IPFS is not connected');
        }

        try {
            // Check if CID is pinned
            const pins = await this.ipfs.pin.ls();
            const isPinned = pins.some(pin => pin.cid.toString() === cid);

            // Try to retrieve a small portion to verify it exists
            let exists = false;
            try {
                const chunks = [];
                for await (const chunk of this.ipfs.cat(cid, { length: 1 })) {
                    chunks.push(chunk);
                    exists = true;
                    break; // Just check if it exists
                }
            } catch (e) {
                exists = false;
            }

            return {
                success: true,
                cid: cid,
                exists: exists,
                pinned: isPinned,
                verifiedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to verify document on IPFS:', error);
            throw new Error(`IPFS verification failed: ${error.message}`);
        }
    }

    // Pin document (ensure it's not garbage collected)
    async pinDocument(cid) {
        if (!this.isConnected) {
            throw new Error('IPFS is not connected');
        }

        try {
            await this.ipfs.pin.add(cid);
            console.log(`✅ Document pinned: ${cid}`);
            return { success: true, cid: cid, pinned: true };
        } catch (error) {
            console.error('❌ Failed to pin document:', error);
            throw new Error(`IPFS pinning failed: ${error.message}`);
        }
    }

    // Unpin document (allow garbage collection)
    async unpinDocument(cid) {
        if (!this.isConnected) {
            throw new Error('IPFS is not connected');
        }

        try {
            await this.ipfs.pin.rm(cid);
            console.log(`✅ Document unpinned: ${cid}`);
            return { success: true, cid: cid, pinned: false };
        } catch (error) {
            console.error('❌ Failed to unpin document:', error);
            throw new Error(`IPFS unpinning failed: ${error.message}`);
        }
    }

    // Get IPFS node information
    async getNodeInfo() {
        if (!this.isConnected) {
            return { success: false, error: 'IPFS is not connected' };
        }

        try {
            const id = await this.ipfs.id();
            const version = await this.ipfs.version();
            const stats = await this.ipfs.stats.repo();

            return {
                success: true,
                id: id.id,
                addresses: id.addresses,
                version: version.version,
                repoSize: stats.repoSize,
                numObjects: stats.numObjects,
                storageMax: stats.storageMax
            };
        } catch (error) {
            console.error('❌ Failed to get IPFS node info:', error);
            return { success: false, error: error.message };
        }
    }

    // Get connection status
    isAvailable() {
        return this.isConnected;
    }

    // Get gateway URL for a CID
    getGatewayUrl(cid) {
        if (!cid) return null;
        return `${this.ipfsProtocol}://${this.ipfsHost}:8080/ipfs/${cid}`;
    }

    // Get IPFS URL (ipfs:// protocol)
    getIPFSUrl(cid) {
        if (!cid) return null;
        return `ipfs://${cid}`;
    }
}

// Create singleton instance
const ipfsService = new IPFSService();

// Auto-initialize on module load (silent, non-blocking)
ipfsService.initialize().catch(() => {
    // Silently fail - IPFS is optional and will use fallback storage
    // Connection will be retried when actually needed
});

module.exports = ipfsService;

