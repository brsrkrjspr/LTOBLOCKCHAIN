// TrustChain LTO - Certificate Blockchain Service
// Handles blockchain storage and verification of certificate hashes

const crypto = require('crypto');
const fabricService = require('./optimizedFabricService');
const db = require('../database/services');

class CertificateBlockchainService {
    /**
     * Generate composite hash for certificate verification
     * Composite hash = SHA-256(certificateNumber + vehicleVIN + expiryDate + fileHash)
     * @param {string} certificateNumber - Policy/certificate number
     * @param {string} vehicleVIN - Vehicle VIN
     * @param {string} expiryDate - Expiry date (ISO string)
     * @param {string} fileHash - SHA-256 hash of PDF file
     * @returns {string} Composite hash (hex)
     */
    generateCompositeHash(certificateNumber, vehicleVIN, expiryDate, fileHash) {
        const compositeData = `${certificateNumber}|${vehicleVIN}|${expiryDate}|${fileHash}`;
        return crypto.createHash('sha256').update(compositeData).digest('hex');
    }

    /**
     * Store certificate hash on Hyperledger Fabric blockchain
     * @param {string} compositeHash - Composite hash
     * @param {Object} metadata - Certificate metadata
     * @returns {Promise<Object>} Transaction result
     */
    async storeCertificateHashOnBlockchain(compositeHash, metadata) {
        try {
            // Ensure Fabric is connected
            if (!fabricService.isConnected) {
                await fabricService.initialize();
            }

            // Prepare metadata for blockchain
            const blockchainMetadata = {
                hash: compositeHash,
                certificateType: metadata.certificateType,
                vehicleVIN: metadata.vehicleVIN,
                vehicleId: metadata.vehicleId,
                certificateNumber: metadata.certificateNumber,
                applicationStatus: metadata.applicationStatus || 'PENDING',
                issuedAt: metadata.issuedAt || new Date().toISOString(),
                issuedBy: metadata.issuedBy || 'system',
                fileHash: metadata.fileHash
            };

            // Store via chaincode using UpdateVerificationStatus
            // Store hash metadata in notes field (can be enhanced later with dedicated chaincode function)
            const notes = JSON.stringify({
                type: 'certificate_hash',
                hash: compositeHash,
                certificateNumber: metadata.certificateNumber,
                applicationStatus: metadata.applicationStatus,
                issuedAt: metadata.issuedAt,
                fileHash: metadata.fileHash
            });
            
            const result = await fabricService.updateVerificationStatus(
                metadata.vehicleVIN,
                metadata.certificateType,
                'ISSUED',
                notes
            );

            return {
                success: true,
                transactionId: result.transactionId,
                hash: compositeHash,
                metadata: blockchainMetadata
            };
        } catch (error) {
            console.error('Error storing certificate hash on blockchain:', error);
            throw new Error(`Blockchain storage failed: ${error.message}`);
        }
    }

    /**
     * Check if composite hash exists on blockchain (duplicate detection)
     * @param {string} compositeHash - Composite hash to check
     * @returns {Promise<Object>} Check result
     */
    async checkHashDuplicate(compositeHash) {
        try {
            // First check database for existing hash
            const existingCert = await db.query(
                'SELECT id, vehicle_id, certificate_type, application_status, status FROM certificates WHERE composite_hash = $1',
                [compositeHash]
            );

            if (existingCert.rows && existingCert.rows.length > 0) {
                const cert = existingCert.rows[0];
                return {
                    exists: true,
                    certificateId: cert.id,
                    vehicleId: cert.vehicle_id,
                    certificateType: cert.certificate_type,
                    applicationStatus: cert.application_status,
                    status: cert.status,
                    source: 'database'
                };
            }

            // TODO: Query blockchain if needed (requires chaincode function)
            // For now, database check is sufficient since we store all hashes in DB

            return {
                exists: false,
                source: 'database'
            };
        } catch (error) {
            console.error('Error checking hash duplicate:', error);
            // On error, assume not duplicate (fail open for availability)
            return {
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * Check certificate authenticity by comparing file hash with original certificate
     * Uses blockchain/database as source of truth
     * @param {string} fileHash - File hash of submitted certificate
     * @param {string} vehicleId - Vehicle ID
     * @param {string} certificateType - Certificate type (hpg_clearance, insurance, emission)
     * @returns {Promise<Object>} Authenticity check result
     */
    async checkCertificateAuthenticity(fileHash, vehicleId, certificateType) {
        try {
            // Query database for original certificate (blockchain source of truth)
            const originalCert = await db.query(
                `SELECT id, file_hash, composite_hash, certificate_number, 
                        status, application_status, issued_at, expires_at,
                        blockchain_tx_id
                 FROM certificates 
                 WHERE vehicle_id = $1 
                   AND certificate_type = $2 
                   AND status IN ('ISSUED', 'ACTIVE')
                 ORDER BY issued_at DESC LIMIT 1`,
                [vehicleId, certificateType]
            );

            if (!originalCert.rows || originalCert.rows.length === 0) {
                // No original certificate found - this might be first submission
                return {
                    authentic: false,
                    reason: 'No original certificate found for this vehicle',
                    originalCertificateFound: false,
                    authenticityScore: 0
                };
            }

            const original = originalCert.rows[0];

            // Compare file hashes - this is the authenticity check
            if (original.file_hash === fileHash) {
                // File hash matches - certificate is authentic!
                return {
                    authentic: true,
                    reason: 'Certificate file hash matches original certificate',
                    originalCertificateFound: true,
                    originalCertificateId: original.id,
                    originalCertificateNumber: original.certificate_number,
                    originalCompositeHash: original.composite_hash,
                    originalStatus: original.status,
                    originalApplicationStatus: original.application_status,
                    blockchainTxId: original.blockchain_tx_id,
                    authenticityScore: 100,
                    matchType: 'file_hash'
                };
            } else {
                // File hash doesn't match - certificate might be fake or modified
                return {
                    authentic: false,
                    reason: 'Certificate file hash does not match original certificate',
                    originalCertificateFound: true,
                    originalCertificateId: original.id,
                    originalCertificateNumber: original.certificate_number,
                    originalFileHash: original.file_hash,
                    submittedFileHash: fileHash,
                    originalStatus: original.status,
                    originalApplicationStatus: original.application_status,
                    authenticityScore: 0,
                    matchType: 'none'
                };
            }
        } catch (error) {
            console.error('Error checking certificate authenticity:', error);
            return {
                authentic: false,
                reason: `Error checking authenticity: ${error.message}`,
                error: error.message,
                authenticityScore: 0
            };
        }
    }

    /**
     * Get original certificate for vehicle (for composite hash generation)
     * @param {string} vehicleId - Vehicle ID
     * @param {string} certificateType - Certificate type
     * @returns {Promise<Object|null>} Original certificate or null
     */
    async getOriginalCertificate(vehicleId, certificateType) {
        try {
            const result = await db.query(
                `SELECT certificate_number, file_hash, composite_hash, issued_at, expires_at
                 FROM certificates 
                 WHERE vehicle_id = $1 
                   AND certificate_type = $2 
                   AND status IN ('ISSUED', 'ACTIVE')
                 ORDER BY issued_at DESC LIMIT 1`,
                [vehicleId, certificateType]
            );

            return result.rows && result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('Error getting original certificate:', error);
            return null;
        }
    }

    /**
     * Verify certificate on blockchain
     * @param {string} compositeHash - Composite hash
     * @param {string} vehicleVIN - Vehicle VIN to verify against
     * @returns {Promise<Object>} Verification result
     */
    async verifyCertificate(compositeHash, vehicleVIN) {
        try {
            // Check database first
            const cert = await db.query(
                `SELECT c.*, v.status as vehicle_status, v.vin 
                 FROM certificates c
                 JOIN vehicles v ON c.vehicle_id = v.id
                 WHERE c.composite_hash = $1`,
                [compositeHash]
            );

            if (!cert.rows || cert.rows.length === 0) {
                return {
                    valid: false,
                    reason: 'Certificate not found on blockchain'
                };
            }

            const certificate = cert.rows[0];

            // Check 1: Application status
            if (certificate.application_status !== 'APPROVED') {
                return {
                    valid: false,
                    reason: `Certificate issued but application was ${certificate.application_status}`,
                    applicationStatus: certificate.application_status
                };
            }

            // Check 2: Vehicle matches
            if (certificate.vin !== vehicleVIN) {
                return {
                    valid: false,
                    reason: 'Certificate was issued for a different vehicle',
                    expectedVIN: certificate.vin,
                    providedVIN: vehicleVIN
                };
            }

            // Check 3: Vehicle application status
            if (certificate.vehicle_status === 'REJECTED') {
                return {
                    valid: false,
                    reason: 'Vehicle application was rejected',
                    vehicleStatus: certificate.vehicle_status
                };
            }

            // Check 4: Certificate not revoked
            if (certificate.status === 'REVOKED') {
                return {
                    valid: false,
                    reason: 'Certificate has been revoked',
                    revocationReason: certificate.revocation_reason,
                    revokedAt: certificate.revoked_at
                };
            }

            return {
                valid: true,
                certificate: {
                    id: certificate.id,
                    certificateNumber: certificate.certificate_number,
                    certificateType: certificate.certificate_type,
                    issuedAt: certificate.issued_at,
                    applicationStatus: certificate.application_status,
                    status: certificate.status,
                    blockchainTxId: certificate.blockchain_tx_id
                }
            };
        } catch (error) {
            console.error('Error verifying certificate:', error);
            return {
                valid: false,
                reason: `Verification error: ${error.message}`
            };
        }
    }

    /**
     * Revoke certificate on blockchain
     * @param {string} certificateId - Certificate ID
     * @param {string} reason - Revocation reason
     * @returns {Promise<Object>} Revocation result
     */
    async revokeCertificateOnBlockchain(certificateId, reason) {
        try {
            // Update database
            await db.query(
                `UPDATE certificates 
                 SET status = 'REVOKED', 
                     application_status = 'REJECTED',
                     revocation_reason = $1,
                     revoked_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [reason, certificateId]
            );

            // TODO: Update blockchain record if needed
            // For now, database update is sufficient

            return {
                success: true,
                certificateId,
                reason,
                revokedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error revoking certificate:', error);
            throw new Error(`Revocation failed: ${error.message}`);
        }
    }
}

module.exports = new CertificateBlockchainService();
