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

        // Validate required fields (ownerEmail and ownerName are required, others can be auto-generated)
        if (!ownerEmail || !ownerName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: ownerEmail and ownerName are required'
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

        // Auto-generate certificate number if not provided
        const generateCertificateNumber = (type) => {
            const year = new Date().getFullYear();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            switch (type) {
                case 'insurance':
                    return `CTPL-${year}-${random}`;
                case 'emission':
                    const month = String(new Date().getMonth() + 1).padStart(2, '0');
                    const day = String(new Date().getDate()).padStart(2, '0');
                    return `ETC-${year}${month}${day}-${random}`;
                case 'hpg':
                    return `HPG-${year}-${random}`;
                default:
                    return `CERT-${year}-${random}`;
            }
        };

        const finalPolicyNumber = policyNumber || generateCertificateNumber('insurance');
        const finalVIN = vehicleVIN || certificatePdfGenerator.generateRandomVIN();
        
        // Validate VIN format if provided (must be 17 characters)
        if (vehicleVIN && vehicleVIN.length !== 17) {
            return res.status(400).json({
                success: false,
                error: 'VIN must be exactly 17 characters'
            });
        }

        // Set defaults for optional fields
        const finalCoverageType = coverageType || 'CTPL';
        const finalCoverageAmount = coverageAmount || 'PHP 200,000 / PHP 50,000';
        const finalEffectiveDate = effectiveDate || new Date().toISOString();
        const finalExpiryDate = expiryDate || (() => {
            const date = new Date();
            date.setFullYear(date.getFullYear() + 1);
            return date.toISOString();
        })();

        // Validate dates
        const effective = new Date(effectiveDate);
        const expiry = new Date(expiryDate);
        if (expiry <= effective) {
            return res.status(400).json({
                success: false,
                error: 'Expiry date must be after effective date'
            });
        }

        console.log(`[Insurance Certificate] Generating for VIN: ${finalVIN}, Policy: ${finalPolicyNumber}`);

        // Generate PDF certificate
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateInsuranceCertificate({
            ownerName,
            vehicleVIN: finalVIN,
            policyNumber: finalPolicyNumber,
            coverageType: finalCoverageType,
            coverageAmount: finalCoverageAmount,
            effectiveDate: finalEffectiveDate,
            expiryDate: finalExpiryDate,
            additionalCoverage
        });

        console.log(`[Insurance Certificate] PDF generated, hash: ${fileHash}`);

        // Generate composite hash for blockchain
        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            certificateNumber,
            finalVIN,
            finalExpiryDate,
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
            vehicleVIN: finalVIN,
            pdfBuffer,
            expiryDate: finalExpiryDate
        });

        console.log(`[Insurance Certificate] Email sent to ${ownerEmail}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Insurance certificate generated and sent successfully',
            certificate: {
                certificateNumber,
                vehicleVIN: finalVIN,
                ownerName,
                fileHash,
                compositeHash,
                expiryDate: finalExpiryDate,
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

        // Validate required fields (ownerEmail and ownerName are required, others can be auto-generated)
        if (!ownerEmail || !ownerName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: ownerEmail and ownerName are required'
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

        // Auto-generate certificate number if not provided
        const generateCertificateNumber = (type) => {
            const year = new Date().getFullYear();
            const month = String(new Date().getMonth() + 1).padStart(2, '0');
            const day = String(new Date().getDate()).padStart(2, '0');
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            switch (type) {
                case 'insurance':
                    return `CTPL-${year}-${random}`;
                case 'emission':
                    return `ETC-${year}${month}${day}-${random}`;
                case 'hpg':
                    return `HPG-${year}-${random}`;
                default:
                    return `CERT-${year}-${random}`;
            }
        };

        const finalCertificateNumber = certificateNumber || generateCertificateNumber('emission');
        const finalVIN = vehicleVIN || certificatePdfGenerator.generateRandomVIN();
        const finalTestDate = testDate || new Date().toISOString();
        const finalExpiryDate = expiryDate || (() => {
            const date = new Date();
            date.setFullYear(date.getFullYear() + 1);
            return date.toISOString();
        })();

        console.log(`[Emission Certificate] Generating for VIN: ${finalVIN}, Cert: ${finalCertificateNumber}`);

        // Generate PDF
        const { pdfBuffer, fileHash } = await certificatePdfGenerator.generateEmissionCertificate({
            ownerName,
            vehicleVIN: finalVIN,
            vehiclePlate,
            certificateNumber: finalCertificateNumber,
            testDate: finalTestDate,
            expiryDate: finalExpiryDate,
            testResults
        });

        console.log(`[Emission Certificate] PDF generated, hash: ${fileHash}, size: ${pdfBuffer.length} bytes`);

        // Additional validation before sending
        if (!Buffer.isBuffer(pdfBuffer)) {
            throw new Error('PDF buffer is not a valid Buffer instance');
        }

        if (pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty');
        }

        // Verify PDF header
        const pdfHeader = pdfBuffer.toString('ascii', 0, Math.min(4, pdfBuffer.length));
        if (pdfHeader !== '%PDF') {
            console.error(`[Emission Certificate] Invalid PDF header before sending: ${pdfHeader}`);
            throw new Error(`Invalid PDF format detected: ${pdfHeader}`);
        }

        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            finalCertificateNumber,
            finalVIN,
            finalExpiryDate,
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
                        finalCertificateNumber,
                        finalVIN,
                        ownerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({ testResults, vehiclePlate }),
                        finalTestDate,
                        finalExpiryDate
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
            certificateNumber: finalCertificateNumber,
            vehicleVIN: finalVIN,
            pdfBuffer,
            expiryDate: finalExpiryDate
        });

        console.log(`[Emission Certificate] Email sent, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Emission certificate generated and sent successfully',
            certificate: {
                certificateNumber: finalCertificateNumber,
                vehicleVIN: finalVIN,
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

        // Validate required fields (ownerEmail and ownerName are required, others can be auto-generated)
        if (!ownerEmail || !ownerName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: ownerEmail and ownerName are required'
            });
        }

        // Auto-generate certificate number if not provided
        const generateCertificateNumber = (type) => {
            const year = new Date().getFullYear();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            switch (type) {
                case 'insurance':
                    return `CTPL-${year}-${random}`;
                case 'emission':
                    const month = String(new Date().getMonth() + 1).padStart(2, '0');
                    const day = String(new Date().getDate()).padStart(2, '0');
                    return `ETC-${year}${month}${day}-${random}`;
                case 'hpg':
                    return `HPG-${year}-${random}`;
                default:
                    return `CERT-${year}-${random}`;
            }
        };

        const finalClearanceNumber = clearanceNumber || generateCertificateNumber('hpg');
        const finalVIN = vehicleVIN || certificatePdfGenerator.generateRandomVIN();
        const finalIssueDate = issueDate || new Date().toISOString();

        console.log(`[HPG Clearance] Generating for VIN: ${finalVIN}, Clearance: ${finalClearanceNumber}`);

        // Generate PDF
        const { pdfBuffer, fileHash } = await certificatePdfGenerator.generateHpgClearance({
            ownerName,
            vehicleVIN: finalVIN,
            vehiclePlate,
            clearanceNumber: finalClearanceNumber,
            issueDate: finalIssueDate,
            verificationDetails
        });

        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            finalClearanceNumber,
            finalVIN,
            finalIssueDate,
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
                        finalClearanceNumber,
                        finalVIN,
                        ownerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({ verificationDetails, vehiclePlate }),
                        finalIssueDate
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
            clearanceNumber: finalClearanceNumber,
            vehicleVIN: finalVIN,
            pdfBuffer
        });

        console.log(`[HPG Clearance] Email sent, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'HPG clearance generated and sent successfully',
            certificate: {
                clearanceNumber: finalClearanceNumber,
                vehicleVIN: finalVIN,
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
 * 
 * Authorization: Admin, Staff, or users with organization matching dealer requirements
 */
router.post('/csr/generate-and-send', authenticateToken, async (req, res) => {
    // Custom authorization: Allow admin, staff, or organization-based access
    const allowedRoles = ['admin', 'staff'];
    const userRole = req.user?.role;
    
    // Fetch user from database to get organization (JWT doesn't include organization)
    let userOrg = '';
    if (!allowedRoles.includes(userRole)) {
        try {
            const user = await db.getUserById(req.user.userId);
            if (user) {
                userOrg = user.organization || '';
            }
        } catch (dbError) {
            console.error('[CSR Certificate] Error fetching user:', dbError);
        }
    }
    
    // Check if user has allowed role
    if (!allowedRoles.includes(userRole)) {
        // Additional check: Allow if user's organization indicates they're a dealer
        // This allows organizations like "ABC Motor Dealer" to generate CSR
        const isDealerOrg = userOrg.toLowerCase().includes('dealer') || 
                           userOrg.toLowerCase().includes('motor') ||
                           userOrg.toLowerCase().includes('vehicle');
        
        if (!isDealerOrg) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `CSR generation requires admin/staff role or dealer organization. Your role: ${userRole || 'none'}, Organization: ${userOrg || 'none'}`
            });
        }
    }
    
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

        // Validate required fields (dealerEmail and dealerName are required, others can be auto-generated)
        if (!dealerEmail || !dealerName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: dealerEmail and dealerName are required'
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

        // Auto-generate values if not provided
        const generateCertificateNumber = (type) => {
            const year = new Date().getFullYear();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            return `CSR-${year}-${random}`;
        };

        const finalVIN = vehicleVIN || certificatePdfGenerator.generateRandomVIN();
        const finalEngineNumber = engineNumber || certificatePdfGenerator.generateRandomEngineNumber();
        const finalDealerLtoNumber = dealerLtoNumber || `LTO-${Math.floor(1000 + Math.random() * 9000)}`;
        const finalVehicleMake = vehicleMake || 'Toyota';
        const finalVehicleModel = vehicleModel || 'Vios';
        const finalVehicleYear = vehicleYear || new Date().getFullYear();
        const finalIssuanceDate = issuanceDate || new Date().toISOString();

        // Validate VIN format if provided (must be 17 characters)
        if (vehicleVIN && vehicleVIN.length !== 17) {
            return res.status(400).json({
                success: false,
                error: 'VIN must be exactly 17 characters'
            });
        }

        console.log(`[CSR Certificate] Generating for VIN: ${finalVIN}, Make: ${finalVehicleMake}`);

        // Generate PDF certificate
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateCsrCertificate({
            dealerName,
            dealerLtoNumber: finalDealerLtoNumber,
            vehicleMake: finalVehicleMake,
            vehicleModel: finalVehicleModel || vehicleModel,
            vehicleVariant,
            vehicleYear: finalVehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber: finalEngineNumber,
            vehicleVIN: finalVIN,
            issuanceDate: finalIssuanceDate
        });

        console.log(`[CSR Certificate] PDF generated, hash: ${fileHash}`);

        // Generate composite hash for blockchain
        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            certificateNumber,
            finalVIN,
            finalIssuanceDate.split('T')[0],
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
                        finalVIN,
                        dealerName,
                        fileHash,
                        compositeHash,
                        JSON.stringify({ 
                            vehicleMake: finalVehicleMake, 
                            vehicleModel: finalVehicleModel || vehicleModel, 
                            vehicleVariant, 
                            vehicleYear: finalVehicleYear, 
                            bodyType, 
                            color, 
                            fuelType, 
                            engineNumber: finalEngineNumber 
                        }),
                        finalIssuanceDate.split('T')[0]
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
            vehicleVIN: finalVIN,
            vehicleMake: finalVehicleMake,
            vehicleModel: finalVehicleModel || vehicleModel,
            pdfBuffer
        });

        console.log(`[CSR Certificate] Email sent, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'CSR certificate generated and sent successfully',
            certificate: {
                csrNumber: certificateNumber,
                vehicleVIN: finalVIN,
                vehicleMake: finalVehicleMake,
                vehicleModel: finalVehicleModel || vehicleModel,
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
