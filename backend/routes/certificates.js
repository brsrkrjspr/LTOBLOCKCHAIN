// TrustChain LTO - Certificate Routes
// Handles certificate generation, download, and verification

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const certificateGenerator = require('../services/certificateGeneratorService');
const certificateBlockchain = require('../services/certificateBlockchainService');
const storageService = require('../services/storageService');

/**
 * DEPRECATED: Generate certificates for a vehicle
 * POST /api/certificates/generate
 * 
 * ⚠️ DEPRECATION NOTICE:
 * This endpoint is DEPRECATED as of 2026-01-17.
 * 
 * REASON: LTO cannot generate insurance or HPG certificates.
 * These must be issued by the authorized external organizations:
 * - Insurance: Insurance Companies
 * - Emission: Emission Testing Centers
 * - HPG: Philippine National Police - Highway Patrol Group
 * 
 * MIGRATION PATH:
 * 1. External organizations issue certificates using:
 *    POST /api/issuer/insurance/issue-certificate
 *    (Emission issuer endpoints removed)
 *    POST /api/issuer/hpg/issue-clearance
 * 
 * 2. Vehicle owners upload certificates using:
 *    POST /api/certificate-uploads/submit
 * 
 * 3. System automatically verifies certificate authenticity by hash matching
 *    against blockchain records.
 * 
 * This endpoint will be REMOVED on 2026-02-17.
 * Please update your code immediately.
 */
router.post('/generate', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    console.warn('⚠️  DEPRECATED ENDPOINT: POST /api/certificates/generate');
    console.warn('   Use external issuer APIs instead');
    console.warn('   This endpoint will be removed on 2026-02-17');
    
    return res.status(410).json({
        success: false,
        error: 'This endpoint is deprecated and no longer supported',
        deprecation: {
            status: 'DEPRECATED',
            deprecatedSince: '2026-01-17',
            removedOn: '2026-02-17',
            reason: 'LTO cannot generate third-party certificates. These must be issued by authorized external organizations.',
            migrationGuide: {
                step1: 'External organizations issue certificates using POST /api/issuer/{type}/issue-certificate',
                step2: 'Vehicle owners submit certificates using POST /api/certificate-uploads/submit',
                step3: 'System verifies authenticity by hash matching against blockchain'
            },
            documentation: 'See /backend/routes/issuer.js and /backend/routes/certificate-upload.js for new endpoints'
        }
    });
});

/**
 * OLD IMPLEMENTATION (ARCHIVED - DO NOT USE)
 * This is the deprecated certificate generation logic.
 * Kept for reference only during migration period.
 * 
 * router.post('/generate', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, types } = req.body;

        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        const certificateTypes = types || ['insurance', 'hpg'];
        const results = [];

        // Get vehicle and owner data
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        const owner = await db.getUserById(vehicle.owner_id);
        if (!owner) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle owner not found'
            });
        }

        // Generate each certificate type
        for (const certType of certificateTypes) {
            try {
                let certificateResult;
                let certificateNumber = null;

                // Check if certificate already exists
                const existingCerts = await db.getCertificatesByVehicle(vehicleId);
                const existingCert = existingCerts.find(c => {
                    if (certType === 'insurance') return c.certificate_type === 'insurance';
                    if (certType === 'hpg') return c.certificate_type === 'hpg_clearance';
                    return false;
                });

                if (existingCert && existingCert.status !== 'REVOKED') {
                    results.push({
                        type: certType,
                        success: false,
                        error: 'Certificate already exists',
                        certificateId: existingCert.id
                    });
                    continue;
                }

                // Generate certificate
                if (certType === 'insurance') {
                    certificateResult = await certificateGenerator.generateInsuranceCertificate(
                        vehicle,
                        owner,
                        certificateNumber
                    );
                } else if (certType === 'hpg') {
                    certificateResult = await certificateGenerator.generateHPGClearance(
                        vehicle,
                        owner,
                        certificateNumber
                    );
                } else {
                    results.push({
                        type: certType,
                        success: false,
                        error: `Unknown certificate type: ${certType}`
                    });
                    continue;
                }

                // Save PDF to file system first
                const filename = `${certType}-${vehicle.vin}-${Date.now()}.pdf`;
                const filePath = await certificateGenerator.savePDF(
                    certificateResult.pdfBuffer,
                    filename
                );

                // Store in IPFS/local storage using the saved file
                let storageResult = { cid: null, hash: certificateResult.fileHash };
                try {
                    storageResult = await storageService.storeDocument(
                        {
                            path: filePath,
                            filename: filename,
                            originalname: filename,
                            mimetype: 'application/pdf',
                            size: certificateResult.pdfBuffer.length
                        },
                        certType === 'insurance' ? 'insurance_cert' : 
                        'hpg_clearance',
                        vehicle.vin,
                        req.user.email
                    );
                } catch (storageError) {
                    console.error(`[Certificate Generation] Storage failed for ${certType}:`, storageError);
                    // Continue even if storage fails - file is already saved locally
                }

                // Create document record
                const document = await db.createDocument({
                    vehicleId: vehicleId,
                    documentType: certType === 'insurance' ? 'insurance_cert' : 
                                  'hpg_clearance',
                    filename: filename,
                    originalName: filename,
                    filePath: filePath,
                    fileSize: certificateResult.pdfBuffer.length,
                    mimeType: 'application/pdf',
                    fileHash: certificateResult.fileHash,
                    uploadedBy: req.user.userId,
                    ipfsCid: storageResult.cid || null
                });

                // Generate composite hash
                const expiryDate = certType === 'insurance'
                    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
                    : new Date().toISOString();

                const compositeHash = certificateBlockchain.generateCompositeHash(
                    certificateResult.certificateNumber,
                    vehicle.vin,
                    expiryDate,
                    certificateResult.fileHash
                );

                // Store certificate in database
                const certificate = await db.createCertificate({
                    vehicleId: vehicleId,
                    certificateType: certType === 'hpg' ? 'hpg_clearance' : certType,
                    certificateNumber: certificateResult.certificateNumber,
                    filePath: filePath,
                    ipfsCid: storageResult.cid || null,
                    issuedBy: req.user.userId,
                    expiresAt: certType === 'insurance'
                        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) 
                        : null,
                    status: 'ISSUED',
                    fileHash: certificateResult.fileHash,
                    compositeHash: compositeHash,
                    documentId: document.id,
                    applicationStatus: 'PENDING'
                });

                // Store hash on blockchain
                let blockchainTxId = null;
                try {
                    const blockchainResult = await certificateBlockchain.storeCertificateHashOnBlockchain(
                        compositeHash,
                        {
                            certificateType: certType === 'hpg' ? 'hpg_clearance' : certType,
                            vehicleVIN: vehicle.vin,
                            vehicleId: vehicleId,
                            certificateNumber: certificateResult.certificateNumber,
                            applicationStatus: 'PENDING',
                            issuedAt: new Date().toISOString(),
                            issuedBy: req.user.userId,
                            fileHash: certificateResult.fileHash
                        }
                    );
                    blockchainTxId = blockchainResult.transactionId;

                    // Update certificate with blockchain transaction ID
                    await db.query(
                        'UPDATE certificates SET blockchain_tx_id = $1 WHERE id = $2',
                        [blockchainTxId, certificate.id]
                    );
                } catch (blockchainError) {
                    console.error(`[Certificate Generation] Blockchain storage failed for ${certType}:`, blockchainError);
                    // Continue even if blockchain storage fails
                }

                results.push({
                    type: certType,
                    success: true,
                    certificateId: certificate.id,
                    certificateNumber: certificateResult.certificateNumber,
                    fileHash: certificateResult.fileHash,
                    compositeHash: compositeHash,
                    blockchainTxId: blockchainTxId,
                    documentId: document.id
                });

            } catch (error) {
                console.error(`Error generating ${certType} certificate:`, error);
                results.push({
                    type: certType,
                    success: false,
                    error: error.message
                });
            }
        }

        const allSuccess = results.every(r => r.success);
        res.status(allSuccess ? 200 : 207).json({
            success: allSuccess,
            message: allSuccess 
                ? 'All certificates generated successfully' 
                : 'Some certificates failed to generate',
            results
        });

    } catch (error) {
        console.error('Certificate generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Get certificates for a vehicle
 * GET /api/certificates/vehicle/:vehicleId
 */
router.get('/vehicle/:vehicleId', authenticateToken, async (req, res) => {
    try {
        const { vehicleId } = req.params;

        // Check permissions
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        if (req.user.role !== 'admin' && vehicle.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const certificates = await db.getCertificatesByVehicle(vehicleId);

        res.json({
            success: true,
            certificates: certificates.map(cert => ({
                id: cert.id,
                certificateType: cert.certificate_type,
                certificateNumber: cert.certificate_number,
                status: cert.status,
                applicationStatus: cert.application_status,
                issuedAt: cert.issued_at,
                expiresAt: cert.expires_at,
                fileHash: cert.file_hash,
                compositeHash: cert.composite_hash,
                blockchainTxId: cert.blockchain_tx_id,
                documentId: cert.document_id
            }))
        });

    } catch (error) {
        console.error('Get certificates error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Verify certificate on blockchain
 * POST /api/certificates/:certificateId/verify
 */
router.post('/:certificateId/verify', authenticateToken, async (req, res) => {
    try {
        const { certificateId } = req.params;

        // Get certificate
        const certResult = await db.query(
            'SELECT c.*, v.vin FROM certificates c JOIN vehicles v ON c.vehicle_id = v.id WHERE c.id = $1',
            [certificateId]
        );

        if (!certResult.rows || certResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Certificate not found'
            });
        }

        const certificate = certResult.rows[0];

        if (!certificate.composite_hash) {
            return res.status(400).json({
                success: false,
                error: 'Certificate hash not available'
            });
        }

        // Verify on blockchain
        const verification = await certificateBlockchain.verifyCertificate(
            certificate.composite_hash,
            certificate.vin
        );

        res.json({
            success: true,
            valid: verification.valid,
            reason: verification.reason || 'Certificate verified',
            certificate: verification.certificate || null,
            verification
        });

    } catch (error) {
        console.error('Certificate verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * Download certificate PDF
 * GET /api/certificates/:certificateId/download
 */
router.get('/:certificateId/download', authenticateToken, async (req, res) => {
    try {
        const { certificateId } = req.params;

        // Get certificate
        const certResult = await db.query(
            `SELECT c.*, v.vin, v.owner_id 
             FROM certificates c 
             JOIN vehicles v ON c.vehicle_id = v.id 
             WHERE c.id = $1`,
            [certificateId]
        );

        if (!certResult.rows || certResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Certificate not found'
            });
        }

        const certificate = certResult.rows[0];

        // Check permissions
        if (req.user.role !== 'admin' && certificate.owner_id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get document file path
        if (!certificate.file_path) {
            return res.status(404).json({
                success: false,
                error: 'Certificate file not found'
            });
        }

        // Check if file exists
        try {
            await fs.access(certificate.file_path);
        } catch {
            return res.status(404).json({
                success: false,
                error: 'Certificate file not found on disk'
            });
        }

        // Send file
        res.download(certificate.file_path, `${certificate.certificate_type}-${certificate.certificate_number}.pdf`, (err) => {
            if (err) {
                console.error('Certificate download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to download certificate'
                    });
                }
            }
        });

    } catch (error) {
        console.error('Certificate download error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
