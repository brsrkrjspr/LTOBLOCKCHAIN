/**
 * Certificate Generation Routes
 * Endpoints for external organizations to generate and send certificates
 */

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const certificatePdfGenerator = require('../services/certificatePdfGenerator');
const certificateEmailService = require('../services/certificateEmailService');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

/**
 * POST /api/certificate-generation/insurance/generate-and-send
 * Generate insurance certificate and send via email
 */
router.post('/insurance/generate-and-send', authenticateToken, authorizeRole(['insurance_verifier', 'admin']), async (req, res) => {
    try {
        const {
            ownerEmail,
            ownerName,
            vehicleVIN,
            policyNumber,
            coverageType,
            coverageAmount,
            effectiveDate,
            expiryDate,
            additionalCoverage
        } = req.body;

        // Validate required fields
        if (!ownerEmail || !ownerName || !vehicleVIN || !policyNumber || !coverageType || !coverageAmount || !effectiveDate || !expiryDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(ownerEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Validate VIN format (17 characters)
        if (vehicleVIN.length !== 17) {
            return res.status(400).json({
                success: false,
                error: 'VIN must be exactly 17 characters'
            });
        }

        // Validate dates
        const effective = new Date(effectiveDate);
        const expiry = new Date(expiryDate);
        if (expiry <= effective) {
            return res.status(400).json({
                success: false,
                error: 'Expiry date must be after effective date'
            });
        }

        console.log(`[Insurance Certificate] Generating for VIN: ${vehicleVIN}, Policy: ${policyNumber}`);

        // Generate PDF certificate
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateInsuranceCertificate({
            ownerName,
            vehicleVIN,
            policyNumber,
            coverageType,
            coverageAmount,
            effectiveDate,
            expiryDate,
            additionalCoverage
        });

        console.log(`[Insurance Certificate] PDF generated, hash: ${fileHash}`);

        // Generate composite hash for blockchain
        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            certificateNumber,
            vehicleVIN,
            expiryDate,
            fileHash
        );

        // Store in issued_certificates table (if table exists)
        try {
            const issuerQuery = await db.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'insurance' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                const issuerId = issuerQuery.rows[0].id;

                await db.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, certificate_data, effective_date, expiry_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerId,
                        'insurance',
                        certificateNumber,
                        vehicleVIN,
                        ownerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({
                            coverageType,
                            coverageAmount,
                            additionalCoverage
                        }),
                        effectiveDate,
                        expiryDate
                    ]
                );

                console.log(`[Insurance Certificate] Stored in database`);
            } else {
                console.warn(`[Insurance Certificate] No active issuer found, skipping database storage`);
            }
        } catch (dbError) {
            console.error(`[Insurance Certificate] Database storage failed:`, dbError);
            // Continue even if database storage fails
        }

        // Send email with PDF attachment
        const emailResult = await certificateEmailService.sendInsuranceCertificate({
            to: ownerEmail,
            ownerName,
            policyNumber: certificateNumber,
            vehicleVIN,
            pdfBuffer,
            expiryDate
        });

        console.log(`[Insurance Certificate] Email sent to ${ownerEmail}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Insurance certificate generated and sent successfully',
            certificate: {
                certificateNumber,
                vehicleVIN,
                ownerName,
                fileHash,
                compositeHash,
                expiryDate,
                emailSent: true,
                emailId: emailResult.id
            }
        });

    } catch (error) {
        console.error('[Insurance Certificate] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate or send certificate',
            details: error.message
        });
    }
});

/**
 * POST /api/certificate-generation/emission/generate-and-send
 * Generate emission certificate and send via email
 */
router.post('/emission/generate-and-send', authenticateToken, authorizeRole(['emission_verifier', 'admin']), async (req, res) => {
    try {
        const {
            ownerEmail,
            ownerName,
            vehicleVIN,
            vehiclePlate,
            certificateNumber,
            testDate,
            expiryDate,
            testResults
        } = req.body;

        // Validate required fields
        if (!ownerEmail || !ownerName || !vehicleVIN || !certificateNumber || !testDate || !expiryDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(ownerEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        console.log(`[Emission Certificate] Generating for VIN: ${vehicleVIN}, Cert: ${certificateNumber}`);

        // Generate PDF
        const { pdfBuffer, fileHash } = await certificatePdfGenerator.generateEmissionCertificate({
            ownerName,
            vehicleVIN,
            vehiclePlate,
            certificateNumber,
            testDate,
            expiryDate,
            testResults
        });

        console.log(`[Emission Certificate] PDF generated, hash: ${fileHash}`);

        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            certificateNumber,
            vehicleVIN,
            expiryDate,
            fileHash
        );

        // Store in database
        try {
            const issuerQuery = await db.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'emission' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await db.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, certificate_data, effective_date, expiry_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerQuery.rows[0].id,
                        'emission',
                        certificateNumber,
                        vehicleVIN,
                        ownerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({ testResults, vehiclePlate }),
                        testDate,
                        expiryDate
                    ]
                );
            }
        } catch (dbError) {
            console.error(`[Emission Certificate] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendEmissionCertificate({
            to: ownerEmail,
            ownerName,
            certificateNumber,
            vehicleVIN,
            pdfBuffer,
            expiryDate
        });

        console.log(`[Emission Certificate] Email sent, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Emission certificate generated and sent successfully',
            certificate: {
                certificateNumber,
                vehicleVIN,
                fileHash,
                compositeHash,
                emailSent: true
            }
        });

    } catch (error) {
        console.error('[Emission Certificate] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate or send certificate',
            details: error.message
        });
    }
});

/**
 * POST /api/certificate-generation/hpg/generate-and-send
 * Generate HPG clearance and send via email
 */
router.post('/hpg/generate-and-send', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const {
            ownerEmail,
            ownerName,
            vehicleVIN,
            vehiclePlate,
            clearanceNumber,
            issueDate,
            verificationDetails
        } = req.body;

        // Validate
        if (!ownerEmail || !ownerName || !vehicleVIN || !clearanceNumber || !issueDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        console.log(`[HPG Clearance] Generating for VIN: ${vehicleVIN}, Clearance: ${clearanceNumber}`);

        // Generate PDF
        const { pdfBuffer, fileHash } = await certificatePdfGenerator.generateHpgClearance({
            ownerName,
            vehicleVIN,
            vehiclePlate,
            clearanceNumber,
            issueDate,
            verificationDetails
        });

        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            clearanceNumber,
            vehicleVIN,
            issueDate,
            fileHash
        );

        // Store in database
        try {
            const issuerQuery = await db.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'hpg' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await db.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, certificate_data, effective_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        issuerQuery.rows[0].id,
                        'hpg_clearance',
                        clearanceNumber,
                        vehicleVIN,
                        ownerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({ verificationDetails, vehiclePlate }),
                        issueDate
                    ]
                );
            }
        } catch (dbError) {
            console.error(`[HPG Clearance] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendHpgClearance({
            to: ownerEmail,
            ownerName,
            clearanceNumber,
            vehicleVIN,
            pdfBuffer
        });

        console.log(`[HPG Clearance] Email sent, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'HPG clearance generated and sent successfully',
            certificate: {
                clearanceNumber,
                vehicleVIN,
                fileHash,
                compositeHash,
                emailSent: true
            }
        });

    } catch (error) {
        console.error('[HPG Clearance] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate or send clearance',
            details: error.message
        });
    }
});

/**
 * POST /api/certificate-generation/csr/generate-and-send
 * Generate CSR certificate and send via email
 */
router.post('/csr/generate-and-send', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const {
            dealerEmail,
            dealerName,
            dealerLtoNumber,
            vehicleVIN,
            vehicleMake,
            vehicleModel,
            vehicleVariant,
            vehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber,
            issuanceDate
        } = req.body;

        // Validate required fields
        if (!dealerEmail || !dealerName || !dealerLtoNumber || !vehicleVIN || !vehicleMake || !vehicleModel || !vehicleYear) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(dealerEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Validate VIN format (17 characters)
        if (vehicleVIN.length !== 17) {
            return res.status(400).json({
                success: false,
                error: 'VIN must be exactly 17 characters'
            });
        }

        console.log(`[CSR Certificate] Generating for VIN: ${vehicleVIN}, Make: ${vehicleMake}`);

        // Generate PDF certificate
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateCsrCertificate({
            dealerName,
            dealerLtoNumber,
            vehicleMake,
            vehicleModel,
            vehicleVariant,
            vehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber,
            vehicleVIN,
            issuanceDate
        });

        console.log(`[CSR Certificate] PDF generated, hash: ${fileHash}`);

        // Generate composite hash for blockchain
        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            certificateNumber,
            vehicleVIN,
            issuanceDate || new Date().toISOString().split('T')[0],
            fileHash
        );

        // Store in database
        try {
            const issuerQuery = await db.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'csr' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await db.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, certificate_data, effective_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        issuerQuery.rows[0].id,
                        'csr',
                        certificateNumber,
                        vehicleVIN,
                        dealerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({ vehicleMake, vehicleModel, vehicleVariant, vehicleYear, bodyType, color, fuelType, engineNumber }),
                        issuanceDate || new Date().toISOString().split('T')[0]
                    ]
                );
            }
        } catch (dbError) {
            console.error(`[CSR Certificate] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendCsrCertificate({
            to: dealerEmail,
            dealerName,
            csrNumber: certificateNumber,
            vehicleVIN,
            vehicleMake,
            vehicleModel,
            pdfBuffer
        });

        console.log(`[CSR Certificate] Email sent, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'CSR certificate generated and sent successfully',
            certificate: {
                csrNumber: certificateNumber,
                vehicleVIN,
                vehicleMake,
                vehicleModel,
                fileHash,
                compositeHash,
                emailSent: true
            }
        });

    } catch (error) {
        console.error('[CSR Certificate] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate or send CSR certificate',
            details: error.message
        });
    }
});

module.exports = router;
