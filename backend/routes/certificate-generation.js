/**
 * Certificate Generation Routes
 * Endpoints for external organizations to generate and send certificates
 */

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const dbRaw = require('../database/db'); // Raw DB module for direct SQL queries
const certificatePdfGenerator = require('../services/certificatePdfGenerator');
const certificateEmailService = require('../services/certificateEmailService');
const storageService = require('../services/storageService');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fs = require('fs');
const path = require('path');

/**
 * Helper function to lookup and validate owner from database
 * @param {string} ownerId - Owner UUID (optional)
 * @param {string} ownerEmail - Owner email (optional)
 * @returns {Promise<Object>} Owner object with validated data
 * @throws {Error} If owner not found or inactive
 */
async function lookupAndValidateOwner(ownerId, ownerEmail) {
    // Validate that at least one identifier is provided
    if (!ownerId && !ownerEmail) {
        throw new Error('Missing required field: ownerId or ownerEmail is required');
    }

    // Lookup owner from database
    let owner = null;
    if (ownerId) {
        owner = await db.getUserById(ownerId);
    } else {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(ownerEmail)) {
            throw new Error('Invalid email format');
        }
        owner = await db.getUserByEmail(ownerEmail, true); // checkActive = true
    }

    // Verify owner exists
    if (!owner) {
        throw new Error('Owner not found. User must be registered in the system.');
    }

    // Verify owner is active
    if (!owner.is_active) {
        throw new Error('Owner account is inactive. Cannot generate certificates.');
    }

    // Construct owner data from database
    const ownerName = `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
    if (!ownerName) {
        throw new Error('Owner name is missing in database. Please update user profile.');
    }

    return {
        id: owner.id,
        email: owner.email,
        firstName: owner.first_name,
        lastName: owner.last_name,
        name: ownerName,
        address: owner.address || '',
        phone: owner.phone || '',
        organization: owner.organization || ''
    };
}

/**
 * POST /api/certificate-generation/insurance/generate-and-send
 * Generate insurance certificate and send via email
 */
router.post('/insurance/generate-and-send', authenticateToken, authorizeRole(['insurance_verifier', 'admin']), async (req, res) => {
    try {
        const {
            ownerId,
            ownerEmail,
            vehicleVIN,
            policyNumber,
            coverageType,
            coverageAmount,
            effectiveDate,
            expiryDate,
            additionalCoverage
        } = req.body;

        // Lookup and validate owner from database
        let owner;
        try {
            owner = await lookupAndValidateOwner(ownerId, ownerEmail);
        } catch (error) {
            if (error.message.includes('Missing required field')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Invalid email format')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('inactive')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
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

        console.log(`[Insurance Certificate] Generating for owner: ${owner.name} (${owner.email}), VIN: ${finalVIN}, Policy: ${finalPolicyNumber}`);

        // Generate PDF certificate
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateInsuranceCertificate({
            ownerName: owner.name,
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
            const issuerQuery = await dbRaw.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'insurance' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                const issuerId = issuerQuery.rows[0].id;

                await dbRaw.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, issued_at, expires_at, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerId,
                        'insurance',
                        certificateNumber,
                        vehicleVIN,
                        owner.name,
                        fileHash,
                        compositeHash,
                        effectiveDate,
                        expiryDate,
                        JSON.stringify({
                            coverageType,
                            coverageAmount,
                            additionalCoverage
                        })
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
            to: owner.email,
            ownerName: owner.name,
            policyNumber: certificateNumber,
            vehicleVIN: finalVIN,
            pdfBuffer,
            expiryDate: finalExpiryDate
        });

        console.log(`[Insurance Certificate] Email sent to ${owner.email}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Insurance certificate generated and sent successfully',
            certificate: {
                certificateNumber,
                vehicleVIN: finalVIN,
                ownerName: owner.name,
                ownerEmail: owner.email,
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
            ownerId,
            ownerEmail,
            vehicleVIN,
            vehiclePlate,
            certificateNumber,
            testDate,
            expiryDate,
            testResults
        } = req.body;

        // Lookup and validate owner from database
        let owner;
        try {
            owner = await lookupAndValidateOwner(ownerId, ownerEmail);
        } catch (error) {
            if (error.message.includes('Missing required field')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Invalid email format')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('inactive')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
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

        console.log(`[Emission Certificate] Generating for owner: ${owner.name} (${owner.email}), VIN: ${finalVIN}, Cert: ${finalCertificateNumber}`);

        // Generate PDF
        const { pdfBuffer, fileHash } = await certificatePdfGenerator.generateEmissionCertificate({
            ownerName: owner.name,
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
            const issuerQuery = await dbRaw.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'emission' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await dbRaw.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, issued_at, expires_at, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerQuery.rows[0].id,
                        'emission',
                        finalCertificateNumber,
                        finalVIN,
                        ownerName,
                        fileHash,
                        compositeHash,
                        finalTestDate,
                        finalExpiryDate,
                        JSON.stringify({ testResults, vehiclePlate })
                    ]
                );
            }
        } catch (dbError) {
            console.error(`[Emission Certificate] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendEmissionCertificate({
            to: owner.email,
            ownerName: owner.name,
            certificateNumber: finalCertificateNumber,
            vehicleVIN: finalVIN,
            pdfBuffer,
            expiryDate: finalExpiryDate
        });

        console.log(`[Emission Certificate] Email sent to ${owner.email}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Emission certificate generated and sent successfully',
            certificate: {
                certificateNumber: finalCertificateNumber,
                vehicleVIN: finalVIN,
                ownerName: owner.name,
                ownerEmail: owner.email,
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
            ownerId,
            ownerEmail,
            vehicleVIN,
            vehiclePlate,
            clearanceNumber,
            issueDate,
            verificationDetails
        } = req.body;

        // Lookup and validate owner from database
        let owner;
        try {
            owner = await lookupAndValidateOwner(ownerId, ownerEmail);
        } catch (error) {
            if (error.message.includes('Missing required field')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Invalid email format')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('inactive')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
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

        console.log(`[HPG Clearance] Generating for owner: ${owner.name} (${owner.email}), VIN: ${finalVIN}, Clearance: ${finalClearanceNumber}`);

        // Generate PDF
        const { pdfBuffer, fileHash } = await certificatePdfGenerator.generateHpgClearance({
            ownerName: owner.name,
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
            const issuerQuery = await dbRaw.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'hpg' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await dbRaw.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, issued_at, expires_at, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerQuery.rows[0].id,
                        'hpg_clearance',
                        finalClearanceNumber,
                        finalVIN,
                        owner.name,
                        fileHash,
                        compositeHash,
                        finalIssueDate,
                        null,
                        JSON.stringify({ verificationDetails, vehiclePlate })
                    ]
                );
            }
        } catch (dbError) {
            console.error(`[HPG Clearance] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendHpgClearance({
            to: owner.email,
            ownerName: owner.name,
            clearanceNumber: finalClearanceNumber,
            vehicleVIN: finalVIN,
            pdfBuffer
        });

        console.log(`[HPG Clearance] Email sent to ${owner.email}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'HPG clearance generated and sent successfully',
            certificate: {
                clearanceNumber: finalClearanceNumber,
                vehicleVIN: finalVIN,
                ownerName: owner.name,
                ownerEmail: owner.email,
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
            ownerId,
            ownerEmail,
            dealerId, // Backward compatibility - maps to ownerId
            dealerEmail, // Backward compatibility - maps to ownerEmail
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

        // Use ownerId/ownerEmail (preferred) or fallback to dealerId/dealerEmail for backward compatibility
        const finalOwnerId = ownerId || dealerId;
        const finalOwnerEmail = ownerEmail || dealerEmail;

        // Lookup and validate owner/dealer from database (dealer is also a user account)
        let owner;
        try {
            owner = await lookupAndValidateOwner(finalOwnerId, finalOwnerEmail);
        } catch (error) {
            if (error.message.includes('Missing required field')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Invalid email format')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('inactive')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
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

        console.log(`[CSR Certificate] Generating for owner: ${owner.name} (${owner.email}), VIN: ${finalVIN}, Make: ${finalVehicleMake}`);

        // Generate PDF certificate (use owner name from database)
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateCsrCertificate({
            dealerName: owner.name, // Use owner name from database
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
            const issuerQuery = await dbRaw.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'csr' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await dbRaw.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, issued_at, expires_at, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerQuery.rows[0].id,
                        'csr',
                        certificateNumber,
                        finalVIN,
                        owner.name,
                        fileHash,
                        compositeHash,
                        finalIssuanceDate.split('T')[0],
                        null,
                        JSON.stringify({ 
                            vehicleMake: finalVehicleMake, 
                            vehicleModel: finalVehicleModel || vehicleModel, 
                            vehicleVariant, 
                            vehicleYear: finalVehicleYear, 
                            bodyType, 
                            color, 
                            fuelType, 
                            engineNumber: finalEngineNumber 
                        })
                    ]
                );
            }
        } catch (dbError) {
            console.error(`[CSR Certificate] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendCsrCertificate({
            to: owner.email,
            dealerName: owner.name,
            csrNumber: certificateNumber,
            vehicleVIN: finalVIN,
            vehicleMake: finalVehicleMake,
            vehicleModel: finalVehicleModel || vehicleModel,
            pdfBuffer
        });

        console.log(`[CSR Certificate] Email sent to ${dealer.email}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'CSR certificate generated and sent successfully',
            certificate: {
                csrNumber: certificateNumber,
                vehicleVIN: finalVIN,
                dealerName: dealer.name,
                dealerEmail: dealer.email,
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

/**
 * POST /api/certificate-generation/sales-invoice/generate-and-send
 * Generate sales invoice and send via email
 */
router.post('/sales-invoice/generate-and-send', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const {
            ownerId,
            ownerEmail,
            vehicleVIN,
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber,
            invoiceNumber,
            dateOfSale,
            purchasePrice,
            sellerName,
            sellerPosition,
            dealerName,
            dealerTin,
            dealerAccreditationNo
        } = req.body;

        // Lookup and validate owner from database
        let owner;
        try {
            owner = await lookupAndValidateOwner(ownerId, ownerEmail);
        } catch (error) {
            if (error.message.includes('Missing required field')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Invalid email format')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('inactive')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        }

        // Validate VIN format if provided (must be 17 characters)
        if (vehicleVIN && vehicleVIN.length !== 17) {
            return res.status(400).json({
                success: false,
                error: 'VIN must be exactly 17 characters'
            });
        }

        const finalVIN = vehicleVIN || certificatePdfGenerator.generateRandomVIN();
        const finalDateOfSale = dateOfSale || new Date().toISOString();

        console.log(`[Sales Invoice] Generating for owner: ${owner.name} (${owner.email}), VIN: ${finalVIN}`);

        // Generate PDF certificate
        const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateSalesInvoice({
            ownerName: owner.name,
            vehicleVIN: finalVIN,
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            bodyType,
            color,
            fuelType,
            engineNumber,
            invoiceNumber,
            dateOfSale: finalDateOfSale,
            purchasePrice,
            sellerName,
            sellerPosition,
            dealerName,
            dealerTin,
            dealerAccreditationNo
        });

        console.log(`[Sales Invoice] PDF generated, hash: ${fileHash}`);

        // Generate composite hash for blockchain
        const compositeHash = certificatePdfGenerator.generateCompositeHash(
            certificateNumber,
            finalVIN,
            finalDateOfSale.split('T')[0],
            fileHash
        );

        // Store in issued_certificates table (if table exists)
        try {
            const issuerQuery = await dbRaw.query(
                `SELECT id FROM external_issuers WHERE issuer_type = 'sales_invoice' AND is_active = true LIMIT 1`
            );

            if (issuerQuery.rows.length > 0) {
                await dbRaw.query(
                    `INSERT INTO issued_certificates 
                    (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                     file_hash, composite_hash, issued_at, expires_at, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        issuerQuery.rows[0].id,
                        'sales_invoice',
                        certificateNumber,
                        finalVIN,
                        owner.name,
                        fileHash,
                        compositeHash,
                        finalDateOfSale.split('T')[0],
                        null,
                        JSON.stringify({
                            purchasePrice,
                            dealerName,
                            dealerTin,
                            dealerAccreditationNo,
                            sellerName,
                            sellerPosition
                        })
                    ]
                );

                console.log(`[Sales Invoice] Stored in database`);
            } else {
                console.warn(`[Sales Invoice] No active issuer found, skipping database storage`);
            }
        } catch (dbError) {
            console.error(`[Sales Invoice] Database error:`, dbError);
        }

        // Send email
        const emailResult = await certificateEmailService.sendSalesInvoice({
            to: owner.email,
            ownerName: owner.name,
            invoiceNumber: certificateNumber,
            vehicleVIN: finalVIN,
            vehicleMake: vehicleMake || 'Toyota',
            vehicleModel: vehicleModel || 'Vios',
            pdfBuffer
        });

        console.log(`[Sales Invoice] Email sent to ${owner.email}, messageId: ${emailResult.id}`);

        res.json({
            success: true,
            message: 'Sales invoice generated and sent successfully',
            certificate: {
                invoiceNumber: certificateNumber,
                vehicleVIN: finalVIN,
                ownerName: owner.name,
                ownerEmail: owner.email,
                fileHash,
                compositeHash,
                emailSent: true
            }
        });

    } catch (error) {
        console.error('[Sales Invoice] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate or send sales invoice',
            details: error.message
        });
    }
});

/**
 * POST /api/certificate-generation/batch/generate-all
 * Generate all 5 certificates (Insurance, Emission, HPG, CSR, Sales Invoice) at once with shared vehicle data
 * Authorization: Admin only
 */
router.post('/batch/generate-all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const {
            ownerId,
            ownerEmail,
            // Optional vehicle details (for manual form)
            vehicleVIN,
            vehiclePlate,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            engineNumber,
            chassisNumber,
            bodyType,
            vehicleType,
            color,
            fuelType,
            fuelType: bodyFuelType, // alias/backward-compatibility
            // Optional certificate-specific overrides
            insurance,
            emission,
            hpg,
            csr,
            salesInvoice
        } = req.body;

        // Lookup and validate owner from database
        let owner;
        try {
            owner = await lookupAndValidateOwner(ownerId, ownerEmail);
        } catch (error) {
            if (error.message.includes('Missing required field')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('Invalid email format')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            } else if (error.message.includes('inactive')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        }

        // Validate VIN format if provided
        if (vehicleVIN && vehicleVIN.length !== 17) {
            return res.status(400).json({
                success: false,
                error: 'VIN must be exactly 17 characters'
            });
        }

        console.log(`[Batch Certificate Generation] Starting for owner: ${owner.name} (${owner.email})`);

        // Generate shared vehicle data (same for all certificates)
        // If VIN/plate not provided, generate random ones and ensure they don't exist
        let finalVIN = vehicleVIN;
        let finalPlate = vehiclePlate;

        // Check for duplicate VIN if provided, or generate unique one
        if (!finalVIN) {
            // Generate random VIN and check for duplicates (max 10 attempts)
            let attempts = 0;
            let existingVehicle = null;
            do {
                finalVIN = certificatePdfGenerator.generateRandomVIN();
                existingVehicle = await db.getVehicleByVin(finalVIN);
                attempts++;
                if (attempts >= 10) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to generate unique VIN after multiple attempts. Please provide a VIN manually.'
                    });
                }
            } while (existingVehicle);
            console.log(`[Batch] Generated unique VIN: ${finalVIN} (attempts: ${attempts})`);
        } else {
            // Check if provided VIN already exists
            const existingVehicle = await db.getVehicleByVin(finalVIN);
            if (existingVehicle) {
                return res.status(409).json({
                    success: false,
                    error: `Vehicle with VIN ${finalVIN} already exists in the system`
                });
            }
            console.log(`[Batch] Using provided VIN: ${finalVIN}`);
        }

        // Check for duplicate plate if provided, or generate unique one (only check active vehicles)
        if (!finalPlate) {
            // Generate random plate and check for duplicates (max 10 attempts)
            // Only consider plates from active vehicles as duplicates
            let attempts = 0;
            let existingVehicle = null;
            do {
                finalPlate = certificatePdfGenerator.generateRandomPlateNumber();
                existingVehicle = await db.getVehicleByPlate(finalPlate);
                // Only treat as duplicate if vehicle is in active state
                if (existingVehicle) {
                    const blockingStatuses = ['SUBMITTED', 'PENDING_BLOCKCHAIN', 'REGISTERED', 'APPROVED'];
                    if (!blockingStatuses.includes(existingVehicle.status)) {
                        // Vehicle exists but is inactive - allow reuse
                        existingVehicle = null;
                    }
                }
                attempts++;
                if (attempts >= 10) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to generate unique plate number after multiple attempts. Please provide a plate number manually.'
                    });
                }
            } while (existingVehicle);
            console.log(`[Batch] Generated unique plate: ${finalPlate} (attempts: ${attempts})`);
        } else {
            // Check if provided plate already exists (only block active vehicles)
            const existingVehicle = await db.getVehicleByPlate(finalPlate);
            if (existingVehicle) {
                const blockingStatuses = ['SUBMITTED', 'PENDING_BLOCKCHAIN', 'REGISTERED', 'APPROVED'];
                if (blockingStatuses.includes(existingVehicle.status)) {
                    return res.status(409).json({
                        success: false,
                        error: `Vehicle with plate number ${finalPlate} already exists and is currently registered or pending`,
                        existingStatus: existingVehicle.status
                    });
                } else {
                    // Plate exists but vehicle is inactive - allow reuse
                    console.log(`⚠️ Plate ${finalPlate} exists with status ${existingVehicle.status} - allowing reuse for certificate generation`);
                }
            }
            console.log(`[Batch] Using provided plate: ${finalPlate}`);
        }

        const sharedVehicleData = {
            vin: finalVIN,
            plate: finalPlate,
            ownerName: owner.name,
            ownerEmail: owner.email,
            ownerAddress: owner.address,
            make: vehicleMake || 'Toyota',
            model: vehicleModel || 'Vios',
            year: vehicleYear || new Date().getFullYear(),
            engineNumber: engineNumber || certificatePdfGenerator.generateRandomEngineNumber(),
            chassisNumber: chassisNumber || certificatePdfGenerator.generateRandomChassisNumber(),
            bodyType: bodyType || vehicleType || 'Sedan',
            color: color || 'White',
            fuelType: fuelType || bodyFuelType || 'Gasoline'
        };

        // Common issuance date (same for all certificates)
        const issuanceDate = new Date().toISOString();
        const issuanceDateOnly = issuanceDate.split('T')[0];

        // Type-specific expiry dates (based on citizen's charter)
        const insuranceExpiryDate = insurance?.expiryDate || (() => {
            const date = new Date();
            date.setFullYear(date.getFullYear() + 1); // Insurance: 1 year
            return date.toISOString();
        })();

        const emissionExpiryDate = emission?.expiryDate || (() => {
            const date = new Date();
            date.setFullYear(date.getFullYear() + 1); // Emission: 1 year
            return date.toISOString();
        })();

        // HPG and CSR don't have expiry dates, use issuance date
        const hpgIssueDate = hpg?.issueDate || issuanceDate;
        const csrIssuanceDate = csr?.issuanceDate || issuanceDate;

        // Generate certificate numbers with same timestamp (to ensure same date prefix)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const randomSuffix = () => Math.random().toString(36).substring(2, 8).toUpperCase();

        const certificateNumbers = {
            insurance: insurance?.policyNumber || `CTPL-${year}-${randomSuffix()}`,
            emission: emission?.certificateNumber || `ETC-${year}${month}${day}-${randomSuffix()}`,
            hpg: hpg?.clearanceNumber || `HPG-${year}-${randomSuffix()}`,
            csr: csr?.csrNumber || `CSR-${year}-${randomSuffix()}`,
            salesInvoice: salesInvoice?.invoiceNumber || `INV-${year}${month}${day}-${randomSuffix()}`
        };

        const results = {
            vehicleData: sharedVehicleData,
            certificates: {},
            errors: []
        };

        // Generate Insurance Certificate
        try {
            console.log(`[Batch] Generating Insurance Certificate: ${certificateNumbers.insurance}`);
            const insuranceData = {
                ownerName: sharedVehicleData.ownerName,
                vehicleVIN: sharedVehicleData.vin,
                vehiclePlate: sharedVehicleData.plate,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                engineNumber: sharedVehicleData.engineNumber,
                chassisNumber: sharedVehicleData.chassisNumber,
                bodyType: sharedVehicleData.bodyType,
                policyNumber: certificateNumbers.insurance,
                coverageType: insurance?.coverageType || 'CTPL',
                coverageAmount: insurance?.coverageAmount || 'PHP 200,000 / PHP 50,000',
                effectiveDate: insurance?.effectiveDate || issuanceDate,
                expiryDate: insuranceExpiryDate,
                additionalCoverage: insurance?.additionalCoverage
            };

            const insuranceResult = await certificatePdfGenerator.generateInsuranceCertificate(insuranceData);
            const insuranceCompositeHash = certificatePdfGenerator.generateCompositeHash(
                certificateNumbers.insurance,
                sharedVehicleData.vin,
                insuranceExpiryDate,
                insuranceResult.fileHash
            );

            // Store in database
            try {
                const issuerQuery = await dbRaw.query(
                    `SELECT id FROM external_issuers WHERE issuer_type = 'insurance' AND is_active = true LIMIT 1`
                );
                if (issuerQuery.rows.length > 0) {
                    await dbRaw.query(
                        `INSERT INTO issued_certificates 
                        (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                         file_hash, composite_hash, issued_at, expires_at, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            issuerQuery.rows[0].id,
                            'insurance',
                            certificateNumbers.insurance,
                            sharedVehicleData.vin,
                            sharedVehicleData.ownerName,
                            insuranceResult.fileHash,
                            insuranceCompositeHash,
                            insuranceData.effectiveDate.split('T')[0],
                            insuranceExpiryDate.split('T')[0],
                            JSON.stringify({ coverageType: insuranceData.coverageType, coverageAmount: insuranceData.coverageAmount, additionalCoverage: insuranceData.additionalCoverage })
                        ]
                    );
                }
            } catch (dbError) {
                console.error(`[Batch] Insurance database error:`, dbError);
            }

            // Send email
            await certificateEmailService.sendInsuranceCertificate({
                to: sharedVehicleData.ownerEmail,
                ownerName: sharedVehicleData.ownerName,
                policyNumber: certificateNumbers.insurance,
                vehicleVIN: sharedVehicleData.vin,
                pdfBuffer: insuranceResult.pdfBuffer,
                expiryDate: insuranceExpiryDate
            });

            results.certificates.insurance = {
                certificateNumber: certificateNumbers.insurance,
                fileHash: insuranceResult.fileHash,
                compositeHash: insuranceCompositeHash,
                emailSent: true
            };
            console.log(`[Batch] Insurance Certificate generated and sent`);
        } catch (error) {
            console.error('[Batch] Insurance Certificate error:', error);
            results.errors.push({ type: 'insurance', error: error.message });
        }

        // Generate Emission Certificate
        try {
            console.log(`[Batch] Generating Emission Certificate: ${certificateNumbers.emission}`);
            const emissionData = {
                ownerName: sharedVehicleData.ownerName,
                vehicleVIN: sharedVehicleData.vin,
                vehiclePlate: sharedVehicleData.plate,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                vehicleYear: sharedVehicleData.year,
                bodyType: sharedVehicleData.bodyType,
                color: sharedVehicleData.color,
                engineNumber: sharedVehicleData.engineNumber,
                fuelType: sharedVehicleData.fuelType,
                certificateNumber: certificateNumbers.emission,
                testDate: emission?.testDate || issuanceDate,
                expiryDate: emissionExpiryDate,
                testResults: emission?.testResults || {
                    co: '0.20',
                    hc: '120',
                    nox: '0.25',
                    smoke: '18'
                }
            };

            const emissionResult = await certificatePdfGenerator.generateEmissionCertificate(emissionData);
            const emissionCompositeHash = certificatePdfGenerator.generateCompositeHash(
                certificateNumbers.emission,
                sharedVehicleData.vin,
                emissionExpiryDate,
                emissionResult.fileHash
            );

            // Store in database
            try {
                const issuerQuery = await dbRaw.query(
                    `SELECT id FROM external_issuers WHERE issuer_type = 'emission' AND is_active = true LIMIT 1`
                );
                if (issuerQuery.rows.length > 0) {
                    await dbRaw.query(
                        `INSERT INTO issued_certificates 
                        (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                         file_hash, composite_hash, issued_at, expires_at, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            issuerQuery.rows[0].id,
                            'emission',
                            certificateNumbers.emission,
                            sharedVehicleData.vin,
                            sharedVehicleData.ownerName,
                            emissionResult.fileHash,
                            emissionCompositeHash,
                            emissionData.testDate.split('T')[0],
                            emissionExpiryDate.split('T')[0],
                            JSON.stringify({ testResults: emissionData.testResults, vehiclePlate: sharedVehicleData.plate })
                        ]
                    );
                }
            } catch (dbError) {
                console.error(`[Batch] Emission database error:`, dbError);
            }

            // Send email
            await certificateEmailService.sendEmissionCertificate({
                to: sharedVehicleData.ownerEmail,
                ownerName: sharedVehicleData.ownerName,
                certificateNumber: certificateNumbers.emission,
                vehicleVIN: sharedVehicleData.vin,
                pdfBuffer: emissionResult.pdfBuffer,
                expiryDate: emissionExpiryDate
            });

            results.certificates.emission = {
                certificateNumber: certificateNumbers.emission,
                fileHash: emissionResult.fileHash,
                compositeHash: emissionCompositeHash,
                emailSent: true
            };
            console.log(`[Batch] Emission Certificate generated and sent`);
        } catch (error) {
            console.error('[Batch] Emission Certificate error:', error);
            results.errors.push({ type: 'emission', error: error.message });
        }

        // Generate HPG Clearance
        try {
            console.log(`[Batch] Generating HPG Clearance: ${certificateNumbers.hpg}`);
            const hpgData = {
                ownerName: sharedVehicleData.ownerName,
                vehicleVIN: sharedVehicleData.vin,
                vehiclePlate: sharedVehicleData.plate,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                vehicleYear: sharedVehicleData.year,
                bodyType: sharedVehicleData.bodyType,
                color: sharedVehicleData.color,
                engineNumber: sharedVehicleData.engineNumber,
                clearanceNumber: certificateNumbers.hpg,
                issueDate: hpgIssueDate,
                verificationDetails: hpg?.verificationDetails || {
                    engine_condition: 'Good',
                    chassis_condition: 'Good'
                }
            };

            const hpgResult = await certificatePdfGenerator.generateHpgClearance(hpgData);
            const hpgCompositeHash = certificatePdfGenerator.generateCompositeHash(
                certificateNumbers.hpg,
                sharedVehicleData.vin,
                hpgIssueDate.split('T')[0],
                hpgResult.fileHash
            );

            // Store in database
            try {
                const issuerQuery = await dbRaw.query(
                    `SELECT id FROM external_issuers WHERE issuer_type = 'hpg' AND is_active = true LIMIT 1`
                );
                if (issuerQuery.rows.length > 0) {
                    await dbRaw.query(
                        `INSERT INTO issued_certificates 
                        (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                         file_hash, composite_hash, issued_at, expires_at, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            issuerQuery.rows[0].id,
                            'hpg_clearance',
                            certificateNumbers.hpg,
                            sharedVehicleData.vin,
                            sharedVehicleData.ownerName,
                            hpgResult.fileHash,
                            hpgCompositeHash,
                            hpgIssueDate.split('T')[0],
                            null,
                            JSON.stringify({ verificationDetails: hpgData.verificationDetails, vehiclePlate: sharedVehicleData.plate })
                        ]
                    );
                }
            } catch (dbError) {
                console.error(`[Batch] HPG database error:`, dbError);
            }

            // Send email
            await certificateEmailService.sendHpgClearance({
                to: sharedVehicleData.ownerEmail,
                ownerName: sharedVehicleData.ownerName,
                clearanceNumber: certificateNumbers.hpg,
                vehicleVIN: sharedVehicleData.vin,
                pdfBuffer: hpgResult.pdfBuffer
            });

            results.certificates.hpg = {
                clearanceNumber: certificateNumbers.hpg,
                fileHash: hpgResult.fileHash,
                compositeHash: hpgCompositeHash,
                emailSent: true
            };
            console.log(`[Batch] HPG Clearance generated and sent`);
        } catch (error) {
            console.error('[Batch] HPG Clearance error:', error);
            results.errors.push({ type: 'hpg', error: error.message });
        }

        // Generate CSR Certificate
        try {
            console.log(`[Batch] Generating CSR Certificate: ${certificateNumbers.csr}`);
            const csrData = {
                dealerName: csr?.dealerName || sharedVehicleData.ownerName,
                dealerLtoNumber: csr?.dealerLtoNumber || `LTO-${Math.floor(1000 + Math.random() * 9000)}`,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                vehicleVariant: csr?.vehicleVariant,
                vehicleYear: sharedVehicleData.year,
                bodyType: sharedVehicleData.bodyType,
                color: sharedVehicleData.color,
                fuelType: sharedVehicleData.fuelType,
                engineNumber: sharedVehicleData.engineNumber,
                vehicleVIN: sharedVehicleData.vin,
                issuanceDate: csrIssuanceDate
            };

            const csrResult = await certificatePdfGenerator.generateCsrCertificate(csrData);
            const csrCompositeHash = certificatePdfGenerator.generateCompositeHash(
                certificateNumbers.csr,
                sharedVehicleData.vin,
                csrIssuanceDate.split('T')[0],
                csrResult.fileHash
            );

            // Store in database
            try {
                const issuerQuery = await dbRaw.query(
                    `SELECT id FROM external_issuers WHERE issuer_type = 'csr' AND is_active = true LIMIT 1`
                );
                if (issuerQuery.rows.length > 0) {
                    await dbRaw.query(
                        `INSERT INTO issued_certificates 
                        (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                         file_hash, composite_hash, issued_at, expires_at, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            issuerQuery.rows[0].id,
                            'csr',
                            certificateNumbers.csr,
                            sharedVehicleData.vin,
                            csrData.dealerName,
                            csrResult.fileHash,
                            csrCompositeHash,
                            csrIssuanceDate.split('T')[0],
                            null,
                            JSON.stringify({
                                vehicleMake: sharedVehicleData.make,
                                vehicleModel: sharedVehicleData.model,
                                vehicleVariant: csrData.vehicleVariant,
                                vehicleYear: sharedVehicleData.year,
                                bodyType: csrData.bodyType,
                                color: csrData.color,
                                fuelType: csrData.fuelType,
                                engineNumber: sharedVehicleData.engineNumber
                            })
                        ]
                    );
                }
            } catch (dbError) {
                console.error(`[Batch] CSR database error:`, dbError);
            }

            // Send email
            // For CSR, use owner as dealer (or allow separate dealer lookup if needed)
            await certificateEmailService.sendCsrCertificate({
                to: sharedVehicleData.ownerEmail,
                dealerName: csrData.dealerName,
                csrNumber: certificateNumbers.csr,
                vehicleVIN: sharedVehicleData.vin,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                pdfBuffer: csrResult.pdfBuffer
            });

            results.certificates.csr = {
                csrNumber: certificateNumbers.csr,
                fileHash: csrResult.fileHash,
                compositeHash: csrCompositeHash,
                emailSent: true
            };
            console.log(`[Batch] CSR Certificate generated and sent`);
        } catch (error) {
            console.error('[Batch] CSR Certificate error:', error);
            results.errors.push({ type: 'csr', error: error.message });
        }

        // Generate Sales Invoice
        try {
            console.log(`[Batch] Generating Sales Invoice: ${certificateNumbers.salesInvoice}`);
            const salesInvoiceData = {
                ownerName: sharedVehicleData.ownerName,
                vehicleVIN: sharedVehicleData.vin,
                vehiclePlate: sharedVehicleData.plate,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                vehicleYear: sharedVehicleData.year,
                bodyType: sharedVehicleData.bodyType,
                color: sharedVehicleData.color,
                fuelType: sharedVehicleData.fuelType,
                engineNumber: sharedVehicleData.engineNumber,
                invoiceNumber: certificateNumbers.salesInvoice,
                dateOfSale: salesInvoice?.dateOfSale || issuanceDate,
                purchasePrice: salesInvoice?.purchasePrice,
                sellerName: salesInvoice?.sellerName,
                sellerPosition: salesInvoice?.sellerPosition,
                dealerName: salesInvoice?.dealerName,
                dealerTin: salesInvoice?.dealerTin,
                dealerAccreditationNo: salesInvoice?.dealerAccreditationNo
            };

            const salesInvoiceResult = await certificatePdfGenerator.generateSalesInvoice(salesInvoiceData);
            const salesInvoiceCompositeHash = certificatePdfGenerator.generateCompositeHash(
                certificateNumbers.salesInvoice,
                sharedVehicleData.vin,
                salesInvoiceData.dateOfSale.split('T')[0],
                salesInvoiceResult.fileHash
            );

            // Store in database
            try {
                const issuerQuery = await dbRaw.query(
                    `SELECT id FROM external_issuers WHERE issuer_type = 'sales_invoice' AND is_active = true LIMIT 1`
                );
                if (issuerQuery.rows.length > 0) {
                    await dbRaw.query(
                        `INSERT INTO issued_certificates 
                        (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                         file_hash, composite_hash, issued_at, expires_at, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            issuerQuery.rows[0].id,
                            'sales_invoice',
                            certificateNumbers.salesInvoice,
                            sharedVehicleData.vin,
                            sharedVehicleData.ownerName,
                            salesInvoiceResult.fileHash,
                            salesInvoiceCompositeHash,
                            salesInvoiceData.dateOfSale.split('T')[0],
                            null,
                            JSON.stringify({
                                purchasePrice: salesInvoiceData.purchasePrice,
                                dealerName: salesInvoiceData.dealerName,
                                dealerTin: salesInvoiceData.dealerTin,
                                dealerAccreditationNo: salesInvoiceData.dealerAccreditationNo,
                                sellerName: salesInvoiceData.sellerName,
                                sellerPosition: salesInvoiceData.sellerPosition
                            })
                        ]
                    );
                }
            } catch (dbError) {
                console.error(`[Batch] Sales Invoice database error:`, dbError);
            }

            // Send email
            await certificateEmailService.sendSalesInvoice({
                to: sharedVehicleData.ownerEmail,
                ownerName: sharedVehicleData.ownerName,
                invoiceNumber: certificateNumbers.salesInvoice,
                vehicleVIN: sharedVehicleData.vin,
                vehicleMake: sharedVehicleData.make,
                vehicleModel: sharedVehicleData.model,
                pdfBuffer: salesInvoiceResult.pdfBuffer
            });

            results.certificates.salesInvoice = {
                invoiceNumber: certificateNumbers.salesInvoice,
                fileHash: salesInvoiceResult.fileHash,
                compositeHash: salesInvoiceCompositeHash,
                emailSent: true
            };
            console.log(`[Batch] Sales Invoice generated and sent`);
        } catch (error) {
            console.error('[Batch] Sales Invoice error:', error);
            results.errors.push({ type: 'salesInvoice', error: error.message });
        }

        // Determine response status
        const successCount = Object.keys(results.certificates).length;
        const hasErrors = results.errors.length > 0;
        const allSuccess = successCount === 5 && !hasErrors;

        console.log(`[Batch Certificate Generation] Completed: ${successCount}/5 certificates generated`);

        res.status(allSuccess ? 200 : 207).json({
            success: allSuccess,
            message: allSuccess 
                ? 'All certificates generated and sent successfully' 
                : `${successCount} certificate(s) generated successfully, ${results.errors.length} failed`,
            vehicleData: sharedVehicleData,
            certificates: results.certificates,
            errors: results.errors.length > 0 ? results.errors : undefined
        });

    } catch (error) {
        console.error('[Batch Certificate Generation] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate certificates',
            details: error.message
        });
    }
});

/**
 * GET /api/certificate-generation/transfer/context/:transferRequestId
 * Get transfer request context for autofill
 */
router.get('/transfer/context/:transferRequestId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { transferRequestId } = req.params;
        const request = await db.getTransferRequestById(transferRequestId);
        
        if (!request) {
            return res.status(404).json({ 
                success: false, 
                error: 'Transfer request not found' 
            });
        }
        
        // Load vehicle with full details
        const vehicle = await db.getVehicleById(request.vehicle_id);
        
        // Seller and buyer are already in request object
        const seller = request.seller;
        const buyer = request.buyer || request.buyer_info;
        
        res.json({
            success: true,
            context: {
                transferRequest: {
                    id: request.id,
                    status: request.status,
                    createdAt: request.created_at
                },
                vehicle: {
                    id: vehicle.id,
                    vin: vehicle.vin,
                    plateNumber: vehicle.plate_number,
                    engineNumber: vehicle.engine_number,
                    chassisNumber: vehicle.chassis_number,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: vehicle.year,
                    color: vehicle.color,
                    vehicleType: vehicle.vehicle_type
                },
                seller: seller ? {
                    id: seller.id,
                    name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email,
                    email: seller.email,
                    address: seller.address || '',
                    phone: seller.phone || ''
                } : null,
                buyer: buyer ? {
                    id: buyer.id || null,
                    name: buyer.first_name && buyer.last_name 
                        ? `${buyer.first_name} ${buyer.last_name}`.trim()
                        : buyer.name || buyer.email || 'N/A',
                    email: buyer.email,
                    address: buyer.address || '',
                    phone: buyer.phone || ''
                } : null
            }
        });
    } catch (error) {
        console.error('[Transfer Context] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load transfer context',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/certificate-generation/transfer/requests
 * Get list of transfer requests for dropdown
 */
router.get('/transfer/requests', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const requests = await db.getTransferRequests({ 
            page: 1, 
            limit: 1000 // Get all for dropdown
        });
        
        res.json({
            success: true,
            requests: requests.map(r => ({
                id: r.id,
                display: `${r.plate_number || r.vin} - ${r.make} ${r.model} (${r.year}) | Seller: ${r.seller_name || r.seller_email} | Buyer: ${r.buyer_name || r.buyer_email || 'Pending'}`,
                plateNumber: r.plate_number,
                vin: r.vin,
                make: r.make,
                model: r.model,
                year: r.year,
                sellerName: r.seller_name,
                sellerEmail: r.seller_email,
                buyerName: r.buyer_name,
                buyerEmail: r.buyer_email,
                status: r.status
            }))
        });
    } catch (error) {
        console.error('[Transfer Requests List] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load transfer requests',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/certificate-generation/transfer/generate-compliance-documents
 * Generate all transfer compliance documents and send via email
 */
router.post('/transfer/generate-compliance-documents', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const {
            transferRequestId,
            sellerDocuments,
            buyerDocuments
        } = req.body;

        // Load transfer request context
        const request = await db.getTransferRequestById(transferRequestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        const vehicle = await db.getVehicleById(request.vehicle_id);
        const seller = request.seller;
        const buyer = request.buyer || request.buyer_info;

        if (!seller) {
            return res.status(400).json({
                success: false,
                error: 'Seller information not found'
            });
        }

        if (!buyer) {
            return res.status(400).json({
                success: false,
                error: 'Buyer information not found'
            });
        }

        const sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email;
        const buyerName = buyer.first_name && buyer.last_name 
            ? `${buyer.first_name} ${buyer.last_name}`.trim()
            : buyer.name || buyer.email || 'N/A';

        const results = {
            sellerDocuments: {},
            buyerDocuments: {},
            errors: []
        };

        const docTypes = require('../config/documentTypes');
        const dbModule = require('../database/db');

        // Helper function to store PDF and create document record
        async function storePdfAndCreateDocument(pdfBuffer, fileHash, fileName, documentType, vehicleId) {
            // Create temp directory if it doesn't exist
            const tempDir = path.join(process.cwd(), 'uploads', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Save PDF buffer to temporary file
            const tempFilePath = path.join(tempDir, `transfer-cert-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
            fs.writeFileSync(tempFilePath, pdfBuffer);

            try {
                // Create file-like object for storage service
                const fileObj = {
                    path: tempFilePath,
                    originalname: fileName,
                    filename: path.basename(tempFilePath),
                    size: pdfBuffer.length,
                    mimetype: 'application/pdf'
                };

                // Store document using storage service
                const storageResult = await storageService.storeDocument(
                    fileObj,
                    documentType,
                    vehicle.vin,
                    seller.email
                );

                // Create document record in database
                const documentRecord = await db.createDocument({
                    vehicleId: vehicleId,
                    documentType: documentType,
                    filename: fileName,
                    originalName: fileName,
                    filePath: storageResult.filePath || tempFilePath,
                    fileSize: pdfBuffer.length,
                    mimeType: 'application/pdf',
                    fileHash: fileHash,
                    uploadedBy: req.user.userId,
                    ipfsCid: storageResult.cid || null
                });

                // Clean up temp file after storage
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }

                return documentRecord.id;
            } catch (storageError) {
                // Clean up temp file on error
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                throw storageError;
            }
        }

        // Helper function to link document to transfer request
        async function linkDocumentToTransfer(documentId, transferRole) {
            await dbModule.query(
                `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [transferRequestId, transferRole, documentId, req.user.userId]
            );
        }

        // Generate Seller Documents
        try {
            // Deed of Sale
            if (sellerDocuments?.deedOfSale) {
                const deedResult = await certificatePdfGenerator.generateDeedOfSale({
                    sellerName,
                    sellerAddress: seller.address || '',
                    buyerName,
                    buyerAddress: buyer.address || '',
                    vehicleVIN: vehicle.vin,
                    vehiclePlate: vehicle.plate_number,
                    vehicleMake: vehicle.make,
                    vehicleModel: vehicle.model,
                    vehicleYear: vehicle.year,
                    engineNumber: vehicle.engine_number,
                    chassisNumber: vehicle.chassis_number,
                    purchasePrice: sellerDocuments.deedOfSale.purchasePrice || 'PHP 0.00',
                    saleDate: sellerDocuments.deedOfSale.saleDate || new Date().toISOString(),
                    odometerReading: sellerDocuments.deedOfSale.odometerReading,
                    notaryName: sellerDocuments.deedOfSale.notaryName,
                    notaryCommission: sellerDocuments.deedOfSale.notaryCommission
                });

                const docId = await storePdfAndCreateDocument(
                    deedResult.pdfBuffer,
                    deedResult.fileHash,
                    `Deed_of_Sale_${transferRequestId}.pdf`,
                    'OTHER',
                    vehicle.id
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.DEED_OF_SALE);
                results.sellerDocuments.deedOfSale = { documentId: docId, fileHash: deedResult.fileHash };
            }

            // Seller ID
            if (sellerDocuments?.sellerId) {
                const sellerIdResult = await certificatePdfGenerator.generateGovernmentId({
                    holderName: sellerName,
                    holderAddress: seller.address || '',
                    idType: sellerDocuments.sellerId.idType || 'Driver\'s License',
                    idNumber: sellerDocuments.sellerId.idNumber,
                    dateOfBirth: sellerDocuments.sellerId.dateOfBirth,
                    isSeller: true
                });

                const docId = await storePdfAndCreateDocument(
                    sellerIdResult.pdfBuffer,
                    sellerIdResult.fileHash,
                    `Seller_ID_${transferRequestId}.pdf`,
                    'ID',
                    vehicle.id
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.SELLER_ID);
                results.sellerDocuments.sellerId = { documentId: docId, fileHash: sellerIdResult.fileHash };
            }
        } catch (error) {
            console.error('[Seller Documents] Error:', error);
            results.errors.push({ type: 'sellerDocuments', error: error.message });
        }

        // Generate Buyer Documents
        try {
            // Buyer ID
            if (buyerDocuments?.buyerId) {
                const buyerIdResult = await certificatePdfGenerator.generateGovernmentId({
                    holderName: buyerName,
                    holderAddress: buyer.address || '',
                    idType: buyerDocuments.buyerId.idType || 'National ID',
                    idNumber: buyerDocuments.buyerId.idNumber,
                    dateOfBirth: buyerDocuments.buyerId.dateOfBirth,
                    isSeller: false
                });

                const docId = await storePdfAndCreateDocument(
                    buyerIdResult.pdfBuffer,
                    buyerIdResult.fileHash,
                    `Buyer_ID_${transferRequestId}.pdf`,
                    'ID',
                    vehicle.id
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_ID);
                results.buyerDocuments.buyerId = { documentId: docId, fileHash: buyerIdResult.fileHash };
            }

            // Buyer TIN
            if (buyerDocuments?.buyerTin) {
                const tinResult = await certificatePdfGenerator.generateTinDocument({
                    holderName: buyerName,
                    holderAddress: buyer.address || '',
                    tinNumber: buyerDocuments.buyerTin.tinNumber
                });

                const docId = await storePdfAndCreateDocument(
                    tinResult.pdfBuffer,
                    tinResult.fileHash,
                    `Buyer_TIN_${transferRequestId}.pdf`,
                    'OTHER',
                    vehicle.id
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_TIN);
                results.buyerDocuments.buyerTin = { documentId: docId, fileHash: tinResult.fileHash };
            }

            // HPG Clearance
            if (buyerDocuments?.hpgClearance) {
                const hpgResult = await certificatePdfGenerator.generateHpgClearance({
                    ownerName: buyerName,
                    vehicleVIN: vehicle.vin,
                    vehiclePlate: vehicle.plate_number,
                    vehicleMake: vehicle.make,
                    vehicleModel: vehicle.model,
                    vehicleYear: vehicle.year,
                    engineNumber: vehicle.engine_number,
                    clearanceNumber: buyerDocuments.hpgClearance.clearanceNumber || `HPG-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    issueDate: new Date().toISOString(),
                    verificationDetails: 'No adverse record found. Vehicle cleared for registration.'
                });

                const docId = await createDocumentRecord(
                    hpgResult.pdfBuffer,
                    hpgResult.fileHash,
                    `HPG_Clearance_${transferRequestId}.pdf`,
                    'HPG_CLEARANCE'
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE);
                results.buyerDocuments.hpgClearance = { documentId: docId, fileHash: hpgResult.fileHash };
            }

            // CTPL Insurance
            if (buyerDocuments?.ctplInsurance) {
                const effectiveDate = new Date();
                const expiryDate = new Date();
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);

                const ctplResult = await certificatePdfGenerator.generateInsuranceCertificate({
                    ownerName: buyerName,
                    vehicleVIN: vehicle.vin,
                    vehiclePlate: vehicle.plate_number,
                    vehicleMake: vehicle.make,
                    vehicleModel: vehicle.model,
                    engineNumber: vehicle.engine_number,
                    chassisNumber: vehicle.chassis_number,
                    policyNumber: buyerDocuments.ctplInsurance.policyNumber || `CTPL-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    coverageType: 'CTPL',
                    coverageAmount: buyerDocuments.ctplInsurance.coverageAmount || 'PHP 200,000 / PHP 50,000',
                    effectiveDate: effectiveDate.toISOString(),
                    expiryDate: expiryDate.toISOString()
                });

                const docId = await storePdfAndCreateDocument(
                    ctplResult.pdfBuffer,
                    ctplResult.fileHash,
                    `CTPL_Insurance_${transferRequestId}.pdf`,
                    'INSURANCE',
                    vehicle.id
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_CTPL);
                results.buyerDocuments.ctplInsurance = { documentId: docId, fileHash: ctplResult.fileHash };
            }

            // MVIR
            if (buyerDocuments?.mvir) {
                const mvirResult = await certificatePdfGenerator.generateMvir({
                    vehicleVIN: vehicle.vin,
                    vehiclePlate: vehicle.plate_number,
                    vehicleMake: vehicle.make,
                    vehicleModel: vehicle.model,
                    vehicleYear: vehicle.year,
                    engineNumber: vehicle.engine_number,
                    chassisNumber: vehicle.chassis_number,
                    inspectionDate: vehicle.inspection_date || new Date().toISOString(),
                    mvirNumber: buyerDocuments.mvir.mvirNumber || `MVIR-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    inspectionResult: buyerDocuments.mvir.inspectionResult || 'PASS',
                    inspectorName: buyerDocuments.mvir.inspectorName || 'LTO Inspector'
                });

                const docId = await storePdfAndCreateDocument(
                    mvirResult.pdfBuffer,
                    mvirResult.fileHash,
                    `MVIR_${transferRequestId}.pdf`,
                    'MVIR',
                    vehicle.id
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_MVIR);
                results.buyerDocuments.mvir = { documentId: docId, fileHash: mvirResult.fileHash };
            }
        } catch (error) {
            console.error('[Buyer Documents] Error:', error);
            results.errors.push({ type: 'buyerDocuments', error: error.message });
        }

        // Send emails with documents
        try {
            // Seller email
            const sellerDocs = [];
            if (results.sellerDocuments.deedOfSale) {
                const deedDoc = await dbModule.query('SELECT file_name, file_hash FROM documents WHERE id = $1', [results.sellerDocuments.deedOfSale.documentId]);
                if (deedDoc.rows[0]) {
                    // Note: In production, you'd need to retrieve the PDF buffer from storage
                    // For now, we'll just send the email notification
                    sellerDocs.push({ type: 'deed_of_sale', filename: deedDoc.rows[0].file_name });
                }
            }
            if (results.sellerDocuments.sellerId) {
                const sellerIdDoc = await dbModule.query('SELECT file_name, file_hash FROM documents WHERE id = $1', [results.sellerDocuments.sellerId.documentId]);
                if (sellerIdDoc.rows[0]) {
                    sellerDocs.push({ type: 'seller_id', filename: sellerIdDoc.rows[0].file_name });
                }
            }

            // Buyer email
            const buyerDocs = [];
            if (results.buyerDocuments.buyerId) {
                buyerDocs.push({ type: 'buyer_id', filename: `Buyer_ID_${transferRequestId}.pdf` });
            }
            if (results.buyerDocuments.buyerTin) {
                buyerDocs.push({ type: 'buyer_tin', filename: `Buyer_TIN_${transferRequestId}.pdf` });
            }
            if (results.buyerDocuments.hpgClearance) {
                buyerDocs.push({ type: 'buyer_hpg_clearance', filename: `HPG_Clearance_${transferRequestId}.pdf` });
            }
            if (results.buyerDocuments.ctplInsurance) {
                buyerDocs.push({ type: 'buyer_ctpl', filename: `CTPL_Insurance_${transferRequestId}.pdf` });
            }
            if (results.buyerDocuments.mvir) {
                buyerDocs.push({ type: 'buyer_mvir', filename: `MVIR_${transferRequestId}.pdf` });
            }

            // Note: For full email with attachments, you'd need to retrieve PDF buffers from storage
            // This is a simplified version - in production, implement proper file storage retrieval
            console.log(`[Transfer Certificates] Documents generated. Seller: ${sellerDocs.length} docs, Buyer: ${buyerDocs.length} docs`);

        } catch (emailError) {
            console.error('[Email Sending] Error:', emailError);
            results.errors.push({ type: 'email', error: emailError.message });
        }

        const hasErrors = results.errors.length > 0;
        res.status(hasErrors ? 207 : 200).json({
            success: !hasErrors,
            message: hasErrors 
                ? 'Documents generated with some errors' 
                : 'All compliance documents generated successfully',
            results,
            transferRequestId
        });

    } catch (error) {
        console.error('[Transfer Compliance Documents] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate compliance documents',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
