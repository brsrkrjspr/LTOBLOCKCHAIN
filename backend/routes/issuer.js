// TrustChain LTO - External Issuer Routes
// Handles certificate issuance by authorized external organizations
// (Insurance Companies, Emission Testing Centers, HPG Office)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/services');
const fabricService = require('../services/optimizedFabricService');

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Authenticate issuer by API key
 * Verifies issuer is authorized and active
 */
async function authenticateIssuer(req, res, next) {
    try {
        const apiKey = req.headers['x-issuer-api-key'] || req.body.api_key;
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Missing issuer API key'
            });
        }

        // Query for issuer
        const result = await db.query(
            'SELECT * FROM external_issuers WHERE api_key = $1 AND is_active = true',
            [apiKey]
        );

        if (!result.rows || result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or inactive issuer API key'
            });
        }

        const issuer = result.rows[0];

        // Attach issuer to request
        req.issuer = {
            id: issuer.id,
            type: issuer.issuer_type,
            name: issuer.company_name,
            licenseNumber: issuer.license_number,
            email: issuer.contact_email
        };

        next();
    } catch (error) {
        console.error('Issuer authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
}

/**
 * Verify issuer type matches requested operation
 */
function authorizeIssuerType(allowedTypes) {
    return (req, res, next) => {
        if (!allowedTypes.includes(req.issuer.type)) {
            return res.status(403).json({
                success: false,
                error: `This API key belongs to ${req.issuer.type} issuer. Not authorized for this operation.`
            });
        }
        next();
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate file hash
 */
function calculateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate composite hash for certificate verification
 */
function generateCompositeHash(certificateNumber, vehicleVIN, expiryDate, fileHash) {
    const compositeData = `${certificateNumber}|${vehicleVIN}|${expiryDate}|${fileHash}`;
    return crypto.createHash('sha256').update(compositeData).digest('hex');
}

/**
 * Generate certificate number based on type
 */
function generateCertificateNumber(issuerType) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    switch (issuerType) {
        case 'insurance':
            return `CTPL-${year}-${random}`;
        case 'hpg':
            return `HPG-${year}-${random}`;
        default:
            throw new Error(`Unknown issuer type: ${issuerType}`);
    }
}

/**
 * Store certificate hash on blockchain
 */
async function storeCertificateHashOnBlockchain(compositeHash, metadata) {
    try {
        if (!fabricService.isConnected) {
            await fabricService.initialize();
        }

        // Check vehicle status - only store on blockchain if vehicle is REGISTERED
        // Vehicles in SUBMITTED/APPROVED status are not yet on blockchain
        if (metadata.vehicleVIN) {
            try {
                const vehicle = await db.getVehicleByVin(metadata.vehicleVIN);
                if (vehicle && vehicle.status !== 'REGISTERED') {
                    console.log(`[Issuer Blockchain] Storage deferred - vehicle ${metadata.vehicleVIN} is ${vehicle.status}, not yet registered on blockchain. Hash will be stored when vehicle is registered during approval.`);
                    return {
                        success: true,
                        transactionId: null,
                        hash: compositeHash,
                        deferred: true,
                        reason: `Vehicle status is ${vehicle.status}, not yet registered on blockchain`
                    };
                }
            } catch (vehicleLookupError) {
                console.warn(`[Issuer Blockchain] Could not lookup vehicle ${metadata.vehicleVIN} for status check:`, vehicleLookupError.message);
                // Continue with blockchain storage attempt - if it fails, error handling will catch it
            }
        }

        const notes = JSON.stringify({
            type: 'certificate_hash',
            hash: compositeHash,
            certificateNumber: metadata.certificateNumber,
            issuer: metadata.issuer,
            issuedAt: metadata.issuedAt,
            fileHash: metadata.fileHash
        });

        const result = await fabricService.updateVerificationStatus(
            metadata.vehicleVIN,
            metadata.certificateType,
            'APPROVED',
            notes
        );

        return {
            success: true,
            transactionId: result.transactionId,
            hash: compositeHash
        };
    } catch (error) {
        console.error('Blockchain storage error:', error);
        throw new Error(`Blockchain storage failed: ${error.message}`);
    }
}

// ============================================
// INSURANCE CERTIFICATE ISSUANCE
// ============================================

/**
 * Issue Insurance Certificate
 * POST /api/issuer/insurance/issue-certificate
 * 
 * Body:
 * {
 *   "vehicleVIN": "XXXXX",
 *   "ownerName": "John Doe",
 *   "policyNumber": "CTPL-2024-0001",
 *   "coverage": {
 *     "bodily_injury": "PHP 100,000",
 *     "property_damage": "PHP 50,000"
 *   },
 *   "effectiveDate": "2026-01-17",
 *   "expiryDate": "2027-01-17",
 *   "certificateFile": <PDF Buffer>
 * }
 */
router.post('/insurance/issue-certificate',
    authenticateIssuer,
    authorizeIssuerType(['insurance']),
    async (req, res) => {
        try {
            const {
                vehicleVIN,
                ownerName,
                policyNumber,
                coverage,
                effectiveDate,
                expiryDate,
                certificateFile
            } = req.body;

            // Validation
            if (!vehicleVIN || !ownerName || !policyNumber || !certificateFile) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: vehicleVIN, ownerName, policyNumber, certificateFile'
                });
            }

            // Check if certificate already exists
            const existingCert = await db.query(
                'SELECT id FROM issued_certificates WHERE certificate_number = $1 AND issuer_id = $2',
                [policyNumber, req.issuer.id]
            );

            if (existingCert.rows && existingCert.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Certificate with this policy number already exists'
                });
            }

            // Calculate hashes
            const buffer = Buffer.from(certificateFile, 'base64');
            const fileHash = calculateFileHash(buffer);
            const compositeHash = generateCompositeHash(
                policyNumber,
                vehicleVIN,
                expiryDate,
                fileHash
            );

            // Check for duplicate hash
            const duplicateCheck = await db.query(
                'SELECT id, certificate_number FROM issued_certificates WHERE file_hash = $1',
                [fileHash]
            );

            if (duplicateCheck.rows && duplicateCheck.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'This certificate file has already been issued',
                    reason: 'Duplicate hash detected - certificate may have been reused'
                });
            }

            // Store certificate on blockchain
            let blockchainTxId = null;
            try {
                const blockchainResult = await storeCertificateHashOnBlockchain(compositeHash, {
                    certificateNumber: policyNumber,
                    vehicleVIN,
                    certificateType: 'insurance',
                    issuer: req.issuer.name,
                    issuedAt: new Date().toISOString(),
                    fileHash
                });
                blockchainTxId = blockchainResult.transactionId;
            } catch (blockchainError) {
                console.error('Blockchain storage failed:', blockchainError);
                // Continue - blockchain storage is optional but logged
            }

            // Store in database
            const certificate = await db.query(
                `INSERT INTO issued_certificates 
                (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                 file_hash, composite_hash, issued_at, expires_at, blockchain_tx_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    req.issuer.id,
                    'insurance',
                    policyNumber,
                    vehicleVIN,
                    ownerName,
                    fileHash,
                    compositeHash,
                    new Date(effectiveDate),
                    new Date(expiryDate),
                    blockchainTxId,
                    JSON.stringify({
                        coverage,
                        issued_by: req.issuer.name,
                        issued_at: new Date().toISOString()
                    })
                ]
            );

            res.json({
                success: true,
                message: 'Insurance certificate issued successfully',
                certificate: {
                    id: certificate.rows[0].id,
                    policyNumber: certificate.rows[0].certificate_number,
                    vehicleVIN: certificate.rows[0].vehicle_vin,
                    ownerName: certificate.rows[0].owner_name,
                    fileHash: certificate.rows[0].file_hash,
                    compositeHash: certificate.rows[0].composite_hash,
                    issuedAt: certificate.rows[0].issued_at,
                    expiresAt: certificate.rows[0].expires_at,
                    blockchainTxId: blockchainTxId,
                    verificationCode: compositeHash.substring(0, 16).toUpperCase()
                }
            });

        } catch (error) {
            console.error('Insurance certificate issuance error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to issue insurance certificate',
                details: error.message
            });
        }
    }
);

// ============================================
// HPG CLEARANCE ISSUANCE
// ============================================

/**
 * Issue HPG Motor Vehicle Clearance
 * POST /api/issuer/hpg/issue-clearance
 */
router.post('/hpg/issue-clearance',
    authenticateIssuer,
    authorizeIssuerType(['hpg']),
    async (req, res) => {
        try {
            const {
                vehicleVIN,
                ownerName,
                engineNumber,
                chassisNumber,
                inspectionDetails,
                clearanceFile
            } = req.body;

            // Validation
            if (!vehicleVIN || !ownerName || !clearanceFile) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            // Generate certificate number
            const certificateNumber = generateCertificateNumber('hpg');

            // No expiry for HPG clearance (valid indefinitely until revoked)
            const expiryDate = null;

            // Calculate hashes
            const buffer = Buffer.from(clearanceFile, 'base64');
            const fileHash = calculateFileHash(buffer);
            const compositeHash = generateCompositeHash(
                certificateNumber,
                vehicleVIN,
                new Date().toISOString(),
                fileHash
            );

            // Check for duplicate
            const duplicateCheck = await db.query(
                'SELECT id FROM issued_certificates WHERE file_hash = $1',
                [fileHash]
            );

            if (duplicateCheck.rows && duplicateCheck.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Duplicate clearance detected'
                });
            }

            // Store on blockchain
            let blockchainTxId = null;
            try {
                const blockchainResult = await storeCertificateHashOnBlockchain(compositeHash, {
                    certificateNumber,
                    vehicleVIN,
                    certificateType: 'hpg_clearance',
                    issuer: req.issuer.name,
                    issuedAt: new Date().toISOString(),
                    fileHash
                });
                blockchainTxId = blockchainResult.transactionId;
            } catch (blockchainError) {
                console.error('Blockchain storage failed:', blockchainError);
            }

            // Store in database
            const certificate = await db.query(
                `INSERT INTO issued_certificates 
                (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                 file_hash, composite_hash, issued_at, expires_at, blockchain_tx_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    req.issuer.id,
                    'hpg_clearance',
                    certificateNumber,
                    vehicleVIN,
                    ownerName,
                    fileHash,
                    compositeHash,
                    new Date(),
                    expiryDate,
                    blockchainTxId,
                    JSON.stringify({
                        engineNumber,
                        chassisNumber,
                        inspectionDetails,
                        issued_by: req.issuer.name,
                        issued_at: new Date().toISOString()
                    })
                ]
            );

            res.json({
                success: true,
                message: 'HPG motor vehicle clearance issued successfully',
                certificate: {
                    id: certificate.rows[0].id,
                    certificateNumber: certificate.rows[0].certificate_number,
                    vehicleVIN: certificate.rows[0].vehicle_vin,
                    ownerName: certificate.rows[0].owner_name,
                    fileHash: certificate.rows[0].file_hash,
                    compositeHash: certificate.rows[0].composite_hash,
                    issuedAt: certificate.rows[0].issued_at,
                    blockchainTxId: blockchainTxId,
                    verificationCode: compositeHash.substring(0, 16).toUpperCase()
                }
            });

        } catch (error) {
            console.error('HPG clearance issuance error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to issue HPG clearance',
                details: error.message
            });
        }
    }
);

// ============================================
// CERTIFICATE REVOCATION
// ============================================

/**
 * Revoke previously issued certificate
 * POST /api/issuer/certificates/:certificateId/revoke
 */
router.post('/certificates/:certificateId/revoke',
    authenticateIssuer,
    async (req, res) => {
        try {
            const { certificateId } = req.params;
            const { reason } = req.body;

            // Verify certificate belongs to this issuer
            const certificate = await db.query(
                'SELECT * FROM issued_certificates WHERE id = $1',
                [certificateId]
            );

            if (!certificate.rows || certificate.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Certificate not found'
                });
            }

            const cert = certificate.rows[0];

            if (cert.issuer_id !== req.issuer.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only revoke certificates issued by your organization'
                });
            }

            // Revoke certificate
            const result = await db.query(
                `UPDATE issued_certificates 
                 SET is_revoked = true, 
                     revocation_reason = $1, 
                     revoked_at = CURRENT_TIMESTAMP 
                 WHERE id = $2 
                 RETURNING *`,
                [reason || 'No reason provided', certificateId]
            );

            res.json({
                success: true,
                message: 'Certificate revoked successfully',
                certificate: {
                    id: result.rows[0].id,
                    certificateNumber: result.rows[0].certificate_number,
                    revokedAt: result.rows[0].revoked_at,
                    revocationReason: result.rows[0].revocation_reason
                }
            });

        } catch (error) {
            console.error('Certificate revocation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to revoke certificate',
                details: error.message
            });
        }
    }
);

// ============================================
// CERTIFICATE VERIFICATION (Public)
// ============================================

/**
 * Public endpoint to verify certificate authenticity
 * GET /api/issuer/certificates/verify/:compositeHash
 */
router.get('/certificates/verify/:compositeHash', async (req, res) => {
    try {
        const { compositeHash } = req.params;

        const certificate = await db.query(
            `SELECT ic.*, ei.company_name, ei.issuer_type
             FROM issued_certificates ic
             LEFT JOIN external_issuers ei ON ic.issuer_id = ei.id
             WHERE ic.composite_hash = $1`,
            [compositeHash]
        );

        if (!certificate.rows || certificate.rows.length === 0) {
            return res.status(404).json({
                success: false,
                valid: false,
                reason: 'Certificate not found in blockchain records'
            });
        }

        const cert = certificate.rows[0];

        // Check certificate status
        let validity = {
            valid: true,
            status: 'VALID'
        };

        if (cert.is_revoked) {
            validity = {
                valid: false,
                status: 'REVOKED',
                reason: cert.revocation_reason,
                revokedAt: cert.revoked_at
            };
        } else if (cert.expires_at && new Date(cert.expires_at) < new Date()) {
            validity = {
                valid: false,
                status: 'EXPIRED',
                expiryDate: cert.expires_at
            };
        }

        res.json({
            success: true,
            valid: validity.valid,
            certificate: {
                certificateNumber: cert.certificate_number,
                certificateType: cert.certificate_type,
                vehicleVIN: cert.vehicle_vin,
                ownerName: cert.owner_name,
                issuer: cert.company_name,
                issuerType: cert.issuer_type,
                issuedAt: cert.issued_at,
                expiresAt: cert.expires_at,
                blockchainTxId: cert.blockchain_tx_id
            },
            validity
        });

    } catch (error) {
        console.error('Certificate verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Verification failed'
        });
    }
});

module.exports = router;
