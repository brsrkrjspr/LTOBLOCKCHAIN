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
 * Generate all certificates (Insurance, HPG, CSR, Sales Invoice) at once with shared vehicle data
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
                    const blockingStatuses = ['SUBMITTED', 'REGISTERED', 'APPROVED'];
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
                const blockingStatuses = ['SUBMITTED', 'REGISTERED', 'APPROVED'];
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

        const randomVehicleProfile = certificatePdfGenerator.getRandomVehicleProfile();

        const sharedVehicleData = {
            vin: finalVIN,
            plate: finalPlate,
            ownerName: owner.name,
            ownerEmail: owner.email,
            ownerAddress: owner.address,
            make: vehicleMake || randomVehicleProfile.make,
            model: vehicleModel || randomVehicleProfile.model,
            year: vehicleYear || new Date().getFullYear(),
            engineNumber: engineNumber || certificatePdfGenerator.generateRandomEngineNumber(),
            chassisNumber: chassisNumber || certificatePdfGenerator.generateRandomChassisNumber(),
            bodyType: bodyType || vehicleType || randomVehicleProfile.bodyType,
            vehicleType: vehicleType || randomVehicleProfile.vehicleType,
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
 * GET /api/certificate-generation/transfer/vehicles
 * Get list of registered vehicles for dropdown
 */
router.get('/transfer/vehicles', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        // Get all APPROVED or REGISTERED vehicles
        const result = await dbModule.query(
            `SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
             FROM vehicles v
             LEFT JOIN users u ON v.owner_id = u.id
             WHERE v.status IN ('APPROVED', 'REGISTERED')
             ORDER BY v.registration_date DESC, v.last_updated DESC
             LIMIT 1000`,
            []
        );
        
        res.json({
            success: true,
            vehicles: result.rows.map(v => ({
                id: v.id,
                display: `${v.plate_number || v.vin || 'N/A'} - ${v.make || ''} ${v.model || ''} (${v.year || ''}) | Owner: ${v.owner_name || v.owner_email || 'N/A'}`,
                plateNumber: v.plate_number,
                vin: v.vin,
                make: v.make,
                model: v.model,
                year: v.year,
                ownerName: v.owner_name,
                ownerEmail: v.owner_email,
                ownerId: v.owner_id,
                status: v.status,
                orNumber: v.or_number,
                crNumber: v.cr_number
            }))
        });
    } catch (error) {
        console.error('[Vehicles List] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load vehicles',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/certificate-generation/transfer/vehicle/:vehicleId
 * Get vehicle context for autofill
 */
router.get('/transfer/vehicle/:vehicleId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const vehicle = await db.getVehicleById(vehicleId);
        
        if (!vehicle) {
            return res.status(404).json({ 
                success: false, 
                error: 'Vehicle not found' 
            });
        }
        
        // Get owner information
        let owner = null;
        if (vehicle.owner_id) {
            owner = await db.getUserById(vehicle.owner_id);
        }
        
        res.json({
            success: true,
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
                vehicleType: vehicle.vehicle_type,
                orNumber: vehicle.or_number,
                crNumber: vehicle.cr_number,
                owner: owner ? {
                    id: owner.id,
                    name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email,
                    email: owner.email,
                    address: owner.address || '',
                    phone: owner.phone || ''
                } : null
            }
        });
    } catch (error) {
        console.error('[Vehicle Context] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load vehicle context',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/certificate-generation/transfer/requests
 * Get list of transfer requests for dropdown (optional)
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
            vehicleId,           // NEW: Direct vehicle selection
            transferRequestId,   // Optional: Link to transfer request
            sellerDocuments,
            buyerDocuments
        } = req.body;

        let vehicle, seller, buyer, sellerName, buyerName;

        // Option 1: Direct vehicle selection (NEW - allows any registered vehicle)
        if (vehicleId) {
            vehicle = await db.getVehicleById(vehicleId);
            if (!vehicle) {
                return res.status(404).json({
                    success: false,
                    error: 'Vehicle not found'
                });
            }

            // Get seller from vehicle owner
            if (vehicle.owner_id) {
                const owner = await db.getUserById(vehicle.owner_id);
                if (owner) {
                    seller = {
                        id: owner.id,
                        first_name: owner.first_name,
                        last_name: owner.last_name,
                        email: owner.email,
                        address: owner.address,
                        phone: owner.phone
                    };
                    sellerName = `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email;
                }
            }

            // Buyer must be provided in buyerDocuments or form
            // Use lookupAndValidateOwner for consistent owner lookup (same as registration certificates)
            // FIX: Validate that buyerId is a valid UUID before using it (prevents error when ID document object is accidentally sent)
            if (buyerDocuments && buyerDocuments.buyerId) {
                // Check if buyerId is a valid UUID format (not an ID document object)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const buyerIdValue = typeof buyerDocuments.buyerId === 'string' ? buyerDocuments.buyerId : 
                                     (buyerDocuments.buyerId && typeof buyerDocuments.buyerId === 'object' ? JSON.stringify(buyerDocuments.buyerId) : buyerDocuments.buyerId);
                
                // If it's not a valid UUID, it might be an ID document object - skip and use email instead
                if (typeof buyerIdValue === 'string' && uuidRegex.test(buyerIdValue)) {
                    try {
                        const buyerData = await lookupAndValidateOwner(buyerIdValue, null);
                        buyer = {
                            id: buyerData.id,
                            first_name: buyerData.firstName,
                            last_name: buyerData.lastName,
                            email: buyerData.email,
                            address: buyerData.address,
                            phone: buyerData.phone
                        };
                        buyerName = buyerData.name;
                    } catch (error) {
                        // If UUID lookup fails, fall back to email if available
                        if (buyerDocuments && buyerDocuments.email) {
                            console.warn(`Buyer UUID lookup failed (${error.message}), falling back to email lookup`);
                        } else {
                            return res.status(400).json({
                                success: false,
                                error: `Buyer lookup failed: ${error.message}`
                            });
                        }
                    }
                } else {
                    // buyerId is not a valid UUID (likely an ID document object) - skip and use email instead
                    console.warn(`buyerId is not a valid UUID (received: ${typeof buyerIdValue === 'string' ? buyerIdValue.substring(0, 100) : typeof buyerIdValue}), falling back to email lookup`);
                }
            }
            
            // Use email lookup if buyerId wasn't used or wasn't a valid UUID
            if (!buyer && buyerDocuments && buyerDocuments.email) {
                try {
                    // Use lookupAndValidateOwner to fetch full buyer details from DB
                    const buyerData = await lookupAndValidateOwner(null, buyerDocuments.email);
                    buyer = {
                        id: buyerData.id,
                        first_name: buyerData.firstName,
                        last_name: buyerData.lastName,
                        email: buyerData.email,
                        address: buyerData.address,
                        phone: buyerData.phone
                    };
                    buyerName = buyerData.name;
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        error: `Buyer lookup failed: ${error.message}`
                    });
                }
            }

            if (!seller) {
                return res.status(400).json({
                    success: false,
                    error: 'Seller information not found. Vehicle must have an owner.'
                });
            }

            if (!buyer) {
                return res.status(400).json({
                    success: false,
                    error: 'Buyer information is required. Please provide buyer details in the form.'
                });
            }
        }
        // Option 2: Transfer request selection (existing flow)
        else if (transferRequestId) {
            const request = await db.getTransferRequestById(transferRequestId);
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Transfer request not found'
                });
            }

            vehicle = await db.getVehicleById(request.vehicle_id);
            if (!vehicle) {
                return res.status(404).json({
                    success: false,
                    error: 'Vehicle not found for transfer request'
                });
            }

            seller = request.seller;
            buyer = request.buyer || request.buyer_info;

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

            sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email;
            buyerName = buyer.first_name && buyer.last_name 
                ? `${buyer.first_name} ${buyer.last_name}`.trim()
                : buyer.name || buyer.email || 'N/A';
        } else {
            return res.status(400).json({
                success: false,
                error: 'Either vehicleId or transferRequestId is required'
            });
        }

        // ============================================
        // 5-DAY SELLER REPORTING RULE ENFORCEMENT
        // ============================================
        if (sellerDocuments?.deedOfSale?.saleDate) {
            const saleDate = new Date(sellerDocuments.deedOfSale.saleDate);
            const now = new Date();
            const daysSinceSale = Math.floor((now - saleDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceSale > 5) {
                console.warn(`[Transfer Certificates] ⚠️ Sale reported ${daysSinceSale} days after notarization (exceeds 5-day limit)`);
                // Allow generation but flag in metadata for audit trail
                // In production, you might want to require admin override flag here
            }
        }

        const results = {
            sellerDocuments: {},
            buyerDocuments: {},
            errors: []
        };

        const docTypes = require('../config/documentTypes');
        const dbModule = require('../database/db');

        // Helper function to store PDF and create document record
        async function storePdfAndCreateDocument(pdfBuffer, fileHash, fileName, documentType, vehicleId, uploaderEmail = seller.email) {
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
                    uploaderEmail
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

        // Helper function to link document to transfer request (skip when no transferRequestId in standalone mode)
        async function linkDocumentToTransfer(documentId, transferRole) {
            if (!transferRequestId) {
                console.warn('[Transfer Certificates] Skipping transfer_documents link: no transferRequestId (standalone generation)');
                return;
            }

            await dbModule.query(
                `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [transferRequestId, transferRole, documentId, req.user.userId]
            );
        }

        // Helper function to write issued certificate for auto-verification
        async function writeIssuedCertificate(certificateType, certificateNumber, vehicleVIN, ownerName, fileHash, compositeHash, issuedAt, expiresAt, metadata) {
            try {
                // Map certificate type to issuer_type for external_issuers lookup
                // Note: issued_certificates table only allows: 'insurance', 'hpg_clearance', 'csr', 'sales_invoice'
                // For MVIR and Deed of Sale, we'll use compatible types or skip
                const issuerTypeMap = {
                    'hpg_clearance': 'hpg',
                    'insurance': 'insurance',
                    'ctpl_cert': 'insurance', // CTPL uses insurance issuer
                    'mvir_cert': 'hpg', // MVIR issued by LTO, use HPG issuer as fallback
                    'deed_of_sale': 'csr' // Deed of sale issued by LTO, use CSR issuer as fallback
                };

                // Map certificate type to what's allowed in issued_certificates table
                const dbCertificateTypeMap = {
                    'hpg_clearance': 'hpg_clearance',
                    'insurance': 'insurance',
                    'ctpl_cert': 'insurance', // CTPL stored as 'insurance' type
                    'mvir_cert': 'hpg_clearance', // MVIR stored as 'hpg_clearance' type (both are vehicle clearance docs)
                    'deed_of_sale': 'csr' // Deed stored as 'csr' type (both are LTO-issued documents)
                };

                const issuerType = issuerTypeMap[certificateType];
                const dbCertificateType = dbCertificateTypeMap[certificateType];
                
                if (!issuerType || !dbCertificateType) {
                    console.warn(`[Transfer Certificates] ⚠️ Certificate type ${certificateType} not mapped for issued_certificates, skipping`);
                    return false;
                }
                
                // Lookup issuer
                const issuerQuery = await dbModule.query(
                    `SELECT id FROM external_issuers WHERE issuer_type = $1 AND is_active = true LIMIT 1`,
                    [issuerType]
                );

                if (issuerQuery.rows.length > 0) {
                    const issuerId = issuerQuery.rows[0].id;
                    
                    // Include original certificate type in metadata for traceability
                    const enrichedMetadata = {
                        ...(metadata || {}),
                        originalCertificateType: certificateType, // Store original type in metadata
                        transferRequestId: transferRequestId
                    };
                    
                    await dbModule.query(
                        `INSERT INTO issued_certificates 
                        (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                         file_hash, composite_hash, issued_at, expires_at, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            issuerId,
                            dbCertificateType, // Use mapped type that's allowed in DB
                            certificateNumber,
                            vehicleVIN,
                            ownerName,
                            fileHash,
                            compositeHash,
                            issuedAt,
                            expiresAt,
                            JSON.stringify(enrichedMetadata)
                        ]
                    );
                    console.log(`[Transfer Certificates] ✅ Written to issued_certificates: ${dbCertificateType} (original: ${certificateType}) - ${certificateNumber}`);
                    return true;
                } else {
                    console.warn(`[Transfer Certificates] ⚠️ No active issuer found for type: ${issuerType}, skipping issued_certificates write`);
                    return false;
                }
            } catch (error) {
                console.error(`[Transfer Certificates] ❌ Error writing to issued_certificates:`, error);
                // Don't throw - allow document generation to continue even if issued_certificates write fails
                return false;
            }
        }

        // Generate Seller Documents
        try {
            // Deed of Sale
            // NOTE: Deed of Sale generation is kept for potential thesis demo purposes (frontend "just for show")
            // In production, Deed of Sale should be upload-only (not auto-generated) since LTO is not the issuer
            // Dealers/Notaries issue Deed of Sale documents, not LTO
            // This generation does NOT represent authoritative certificates - they are supporting documents for review
            if (sellerDocuments?.deedOfSale) {
                const saleDate = sellerDocuments.deedOfSale.saleDate || new Date().toISOString();
                const deedResult = await certificatePdfGenerator.generateDeedOfSale({
                    sellerName,
                    sellerAddress: seller.address || '',
                    buyerName,
                    buyerAddress: buyer.address || '',
                    vehicleVIN: vehicle.vin, // Use DB vehicle data - no randomization
                    vehiclePlate: vehicle.plate_number, // Use DB vehicle data
                    vehicleMake: vehicle.make, // Use DB vehicle data
                    vehicleModel: vehicle.model, // Use DB vehicle data
                    vehicleYear: vehicle.year, // Use DB vehicle data
                    engineNumber: vehicle.engine_number, // Use DB vehicle data
                    chassisNumber: vehicle.chassis_number, // Use DB vehicle data
                    purchasePrice: sellerDocuments.deedOfSale.purchasePrice || 'PHP 0.00',
                    saleDate: saleDate,
                    odometerReading: sellerDocuments.deedOfSale.odometerReading,
                    notaryName: sellerDocuments.deedOfSale.notaryName,
                    notaryCommission: sellerDocuments.deedOfSale.notaryCommission
                });

                // Store PDF document with correct enum type
                const deedCertNum = transferRequestId
                    ? `DEED-${transferRequestId}`
                    : `DEED-standalone-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const docId = await storePdfAndCreateDocument(
                    deedResult.pdfBuffer,
                    deedResult.fileHash,
                    `Deed_of_Sale_${transferRequestId || vehicle.id}.pdf`,
                    docTypes.DB_TYPES.DEED_OF_SALE, // Use proper enum: 'deed_of_sale'
                    vehicle.id,
                    seller.email
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.DEED_OF_SALE);

                // Write to issued_certificates for auto-verification
                const deedCompositeHash = certificatePdfGenerator.generateCompositeHash(
                    deedCertNum,
                    vehicle.vin,
                    saleDate.split('T')[0],
                    deedResult.fileHash
                );
                await writeIssuedCertificate(
                    'deed_of_sale',
                    deedCertNum,
                    vehicle.vin,
                    sellerName,
                    deedResult.fileHash,
                    deedCompositeHash,
                    saleDate.split('T')[0],
                    null, // Deed of sale doesn't expire
                    {
                        transferRequestId,
                        buyerName,
                        purchasePrice: sellerDocuments.deedOfSale.purchasePrice,
                        notaryName: sellerDocuments.deedOfSale.notaryName
                    }
                );

                results.sellerDocuments.deedOfSale = { documentId: docId, fileHash: deedResult.fileHash };
            }

            // Seller ID - REMOVED: IDs should not be generated as certificates
            // IDs (Owner ID, Seller ID, Buyer ID) require no backend validation and should only be uploaded by users
            // The system stores uploaded ID documents but does not generate "ID certificates"
            // if (sellerDocuments?.sellerId) {
            //     // ID generation removed per validator model: IDs are upload-only, no certificate generation
            // }
        } catch (error) {
            console.error('[Seller Documents] Error:', error);
            results.errors.push({ type: 'sellerDocuments', error: error.message });
        }

        // Generate Buyer Documents
        try {
            // Buyer ID - REMOVED: IDs should not be generated as certificates
            // IDs (Owner ID, Seller ID, Buyer ID) require no backend validation and should only be uploaded by users
            // The system stores uploaded ID documents but does not generate "ID certificates"
            // if (buyerDocuments?.buyerId) {
            //     // ID generation removed per validator model: IDs are upload-only, no certificate generation
            // }

            // Buyer TIN removed: TIN is not required for certificate generation
            // TIN documents should be uploaded by users, not generated as certificates
            // if (buyerDocuments?.buyerTin) {
            //     // TIN generation removed - TIN is not generated as a certificate
            // }

            // HPG Clearance
            if (buyerDocuments?.hpgClearance) {
                const issueDate = new Date().toISOString();
                const clearanceNumber = buyerDocuments.hpgClearance.clearanceNumber || `HPG-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                
                const hpgResult = await certificatePdfGenerator.generateHpgClearance({
                    ownerName: buyerName,
                    vehicleVIN: vehicle.vin, // Use DB vehicle data - no randomization
                    vehiclePlate: vehicle.plate_number, // Use DB vehicle data
                    vehicleMake: vehicle.make, // Use DB vehicle data
                    vehicleModel: vehicle.model, // Use DB vehicle data
                    vehicleYear: vehicle.year, // Use DB vehicle data
                    engineNumber: vehicle.engine_number, // Use DB vehicle data
                    clearanceNumber: clearanceNumber,
                    issueDate: issueDate,
                    verificationDetails: buyerDocuments.hpgClearance?.verificationDetails || 'No adverse record found. Vehicle cleared for registration.'
                });

                // Store PDF document with correct enum type
                const docId = await storePdfAndCreateDocument(
                    hpgResult.pdfBuffer,
                    hpgResult.fileHash,
                    `HPG_Clearance_${transferRequestId || vehicle.id}.pdf`,
                    docTypes.DB_TYPES.HPG_CLEARANCE, // Use proper enum: 'hpg_clearance'
                    vehicle.id,
                    buyer.email
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE);

                // Write to issued_certificates for auto-verification
                const hpgCompositeHash = certificatePdfGenerator.generateCompositeHash(
                    clearanceNumber,
                    vehicle.vin,
                    issueDate.split('T')[0],
                    hpgResult.fileHash
                );
                await writeIssuedCertificate(
                    'hpg_clearance',
                    clearanceNumber,
                    vehicle.vin,
                    buyerName,
                    hpgResult.fileHash,
                    hpgCompositeHash,
                    issueDate.split('T')[0],
                    null, // HPG clearance doesn't expire
                    {
                        transferRequestId,
                        vehiclePlate: vehicle.plate_number,
                        verificationDetails: buyerDocuments.hpgClearance?.verificationDetails || 'No adverse record found. Vehicle cleared for registration.'
                    }
                );

                results.buyerDocuments.hpgClearance = { documentId: docId, fileHash: hpgResult.fileHash, clearanceNumber };
            }

            // CTPL Insurance
            if (buyerDocuments?.ctplInsurance) {
                const effectiveDate = new Date();
                const expiryDate = new Date();
                expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                const policyNumber = buyerDocuments.ctplInsurance.policyNumber || `CTPL-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                const ctplResult = await certificatePdfGenerator.generateInsuranceCertificate({
                    ownerName: buyerName,
                    vehicleVIN: vehicle.vin, // Use DB vehicle data - no randomization
                    vehiclePlate: vehicle.plate_number, // Use DB vehicle data
                    vehicleMake: vehicle.make, // Use DB vehicle data
                    vehicleModel: vehicle.model, // Use DB vehicle data
                    engineNumber: vehicle.engine_number, // Use DB vehicle data
                    chassisNumber: vehicle.chassis_number, // Use DB vehicle data
                    policyNumber: policyNumber,
                    coverageType: 'CTPL',
                    coverageAmount: buyerDocuments.ctplInsurance.coverageAmount || 'PHP 200,000 / PHP 50,000',
                    effectiveDate: effectiveDate.toISOString(),
                    expiryDate: expiryDate.toISOString()
                });

                // Store PDF document with correct enum type
                const docId = await storePdfAndCreateDocument(
                    ctplResult.pdfBuffer,
                    ctplResult.fileHash,
                    `CTPL_Insurance_${transferRequestId || vehicle.id}.pdf`,
                    docTypes.DB_TYPES.CTPL, // Use proper enum: 'ctpl_cert'
                    vehicle.id,
                    buyer.email
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_CTPL);

                // Write to issued_certificates for auto-verification
                const ctplCompositeHash = certificatePdfGenerator.generateCompositeHash(
                    policyNumber,
                    vehicle.vin,
                    expiryDate.toISOString().split('T')[0],
                    ctplResult.fileHash
                );
                await writeIssuedCertificate(
                    'insurance', // Use 'insurance' type for issued_certificates (CTPL is a subtype)
                    policyNumber,
                    vehicle.vin,
                    buyerName,
                    ctplResult.fileHash,
                    ctplCompositeHash,
                    effectiveDate.toISOString().split('T')[0],
                    expiryDate.toISOString().split('T')[0],
                    {
                        transferRequestId,
                        coverageType: 'CTPL',
                        coverageAmount: buyerDocuments.ctplInsurance.coverageAmount
                    }
                );

                results.buyerDocuments.ctplInsurance = { documentId: docId, fileHash: ctplResult.fileHash, policyNumber };
            }

            // MVIR
            if (buyerDocuments?.mvir) {
                const inspectionDate = vehicle.inspection_date || new Date().toISOString();
                const mvirNumber = buyerDocuments.mvir.mvirNumber || `MVIR-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

                const mvirResult = await certificatePdfGenerator.generateMvir({
                    vehicleVIN: vehicle.vin, // Use DB vehicle data - no randomization
                    vehiclePlate: vehicle.plate_number, // Use DB vehicle data
                    vehicleMake: vehicle.make, // Use DB vehicle data
                    vehicleModel: vehicle.model, // Use DB vehicle data
                    vehicleYear: vehicle.year, // Use DB vehicle data
                    engineNumber: vehicle.engine_number, // Use DB vehicle data
                    chassisNumber: vehicle.chassis_number, // Use DB vehicle data
                    inspectionDate: inspectionDate,
                    mvirNumber: mvirNumber,
                    inspectionResult: buyerDocuments.mvir.inspectionResult || 'PASS',
                    inspectorName: buyerDocuments.mvir.inspectorName || 'LTO Inspector'
                });

                // Store PDF document with correct enum type
                const docId = await storePdfAndCreateDocument(
                    mvirResult.pdfBuffer,
                    mvirResult.fileHash,
                    `MVIR_${transferRequestId || vehicle.id}.pdf`,
                    docTypes.DB_TYPES.MVIR, // Use proper enum: 'mvir_cert'
                    vehicle.id,
                    buyer.email
                );
                await linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_MVIR);

                // Write to issued_certificates for auto-verification
                const mvirCompositeHash = certificatePdfGenerator.generateCompositeHash(
                    mvirNumber,
                    vehicle.vin,
                    inspectionDate.split('T')[0],
                    mvirResult.fileHash
                );
                await writeIssuedCertificate(
                    'mvir_cert',
                    mvirNumber,
                    vehicle.vin,
                    buyerName,
                    mvirResult.fileHash,
                    mvirCompositeHash,
                    inspectionDate.split('T')[0],
                    null, // MVIR doesn't expire
                    {
                        transferRequestId,
                        inspectionResult: buyerDocuments.mvir.inspectionResult,
                        inspectorName: buyerDocuments.mvir.inspectorName
                    }
                );

                results.buyerDocuments.mvir = { documentId: docId, fileHash: mvirResult.fileHash, mvirNumber };
            }
        } catch (error) {
            console.error('[Buyer Documents] Error:', error);
            results.errors.push({ type: 'buyerDocuments', error: error.message });
        }

        // Send emails with documents
        try {
            // Helper: get PDF buffer for email. Uses storageService.getDocument so IPFS and local storage both work.
            async function getPdfBufferFromDocument(documentId) {
                try {
                    const doc = await storageService.getDocument(documentId);
                    if (!doc || !doc.filePath) return null;
                    if (!fs.existsSync(doc.filePath)) return null;
                    const buf = fs.readFileSync(doc.filePath);
                    // If from IPFS, getDocument created a temp file; clean up after read
                    if (doc.storageMode === 'ipfs') {
                        try { fs.unlinkSync(doc.filePath); } catch (_) {}
                    }
                    return buf;
                } catch (error) {
                    console.error(`[Email] Error retrieving PDF for document ${documentId}:`, error.message);
                    return null;
                }
            }

            // Seller email - Deed of Sale and Seller ID
            const sellerEmailDocs = [];
            if (results.sellerDocuments.deedOfSale) {
                const deedPdfBuffer = await getPdfBufferFromDocument(results.sellerDocuments.deedOfSale.documentId);
                if (deedPdfBuffer) {
                    sellerEmailDocs.push({
                        filename: `Deed_of_Sale_${transferRequestId || vehicle.id}.pdf`,
                        buffer: deedPdfBuffer
                    });
                }
            }
            // Seller ID removed: IDs should not be generated as certificates
            // IDs (Owner ID, Seller ID, Buyer ID) require no backend validation and should only be uploaded by users
            // if (results.sellerDocuments.sellerId) { ... } // REMOVED - IDs are upload-only, not generated

            if (sellerEmailDocs.length > 0 && seller.email) {
                try {
                    // Send seller email with attachments
                    const sellerSubject = `Transfer Documents - Deed of Sale and Seller Documents`;
                    const sellerHtml = `
                        <h2>Transfer Documents Generated</h2>
                        <p>Dear ${sellerName},</p>
                        <p>Your transfer documents have been generated and are attached to this email.</p>
                        <p><strong>Vehicle:</strong> ${vehicle.plate_number || vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})</p>
                        <p><strong>Buyer:</strong> ${buyerName}</p>
                        <p>Please review the attached documents and ensure all information is correct.</p>
                        <p>Note: Under the new AO, sellers must report the sale to LTO within 5 days of notarization.</p>
                    `;
                    
                    // Use Gmail API service to send email with attachments
                    const gmailApiService = require('../services/gmailApiService');
                    await gmailApiService.sendMail({
                        to: seller.email,
                        subject: sellerSubject,
                        html: sellerHtml,
                        text: `Transfer Documents Generated\n\nDear ${sellerName},\n\nYour transfer documents have been generated and are attached.\n\nVehicle: ${vehicle.plate_number || vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})\nBuyer: ${buyerName}`,
                        attachments: sellerEmailDocs.map(doc => ({
                            filename: doc.filename,
                            content: doc.buffer,
                            contentType: 'application/pdf'
                        }))
                    });
                    console.log(`[Transfer Certificates] ✅ Email sent to seller: ${seller.email}`);
                } catch (sellerEmailError) {
                    console.error('[Email] Error sending seller email:', sellerEmailError);
                    results.errors.push({ type: 'sellerEmail', error: sellerEmailError.message });
                }
            }

            // Buyer email - HPG, CTPL, MVIR
            // Note: Buyer ID and Buyer TIN removed - IDs and TIN should not be generated as certificates
            // IDs (Owner ID, Seller ID, Buyer ID) require no backend validation and should only be uploaded by users
            // TIN documents should be uploaded by users, not generated as certificates
            const buyerEmailDocs = [];
            // Buyer ID removed: IDs are upload-only, not generated
            // if (results.buyerDocuments.buyerId) { ... } // REMOVED - IDs are upload-only, not generated
            // Buyer TIN removed: TIN is not generated as a certificate
            // if (results.buyerDocuments.buyerTin) { ... } // REMOVED - TIN is not generated as a certificate
            if (results.buyerDocuments.hpgClearance) {
                const hpgPdfBuffer = await getPdfBufferFromDocument(results.buyerDocuments.hpgClearance.documentId);
                if (hpgPdfBuffer) {
                    buyerEmailDocs.push({
                        filename: `HPG_Clearance_${transferRequestId || vehicle.id}.pdf`,
                        buffer: hpgPdfBuffer
                    });
                }
            }
            if (results.buyerDocuments.ctplInsurance) {
                const ctplPdfBuffer = await getPdfBufferFromDocument(results.buyerDocuments.ctplInsurance.documentId);
                if (ctplPdfBuffer) {
                    buyerEmailDocs.push({
                        filename: `CTPL_Insurance_${transferRequestId || vehicle.id}.pdf`,
                        buffer: ctplPdfBuffer
                    });
                }
            }
            if (results.buyerDocuments.mvir) {
                const mvirPdfBuffer = await getPdfBufferFromDocument(results.buyerDocuments.mvir.documentId);
                if (mvirPdfBuffer) {
                    buyerEmailDocs.push({
                        filename: `MVIR_${transferRequestId || vehicle.id}.pdf`,
                        buffer: mvirPdfBuffer
                    });
                }
            }

            if (buyerEmailDocs.length > 0 && buyer.email) {
                try {
                    // Send buyer email with attachments
                    const buyerSubject = `Transfer Documents - Compliance Certificates`;
                    const buyerHtml = `
                        <h2>Transfer Compliance Documents Generated</h2>
                        <p>Dear ${buyerName},</p>
                        <p>Your transfer compliance documents have been generated and are attached to this email.</p>
                        <p><strong>Vehicle:</strong> ${vehicle.plate_number || vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})</p>
                        <p><strong>Seller:</strong> ${sellerName}</p>
                        <p>Please review the attached documents:</p>
                        <ul>
                            ${results.buyerDocuments.hpgClearance ? '<li>HPG Clearance Certificate</li>' : ''}
                            ${results.buyerDocuments.ctplInsurance ? '<li>CTPL Insurance Certificate</li>' : ''}
                            ${results.buyerDocuments.mvir ? '<li>Motor Vehicle Inspection Report (MVIR)</li>' : ''}
                        </ul>
                        <p><strong>Note:</strong> Buyer ID and Buyer TIN must be uploaded separately. IDs and TIN are not generated as certificates.</p>
                        <p>These documents are required for completing the transfer of ownership process.</p>
                    `;
                    
                    // Use Gmail API service to send email with attachments
                    const gmailApiService = require('../services/gmailApiService');
                    await gmailApiService.sendMail({
                        to: buyer.email,
                        subject: buyerSubject,
                        html: buyerHtml,
                        text: `Transfer Compliance Documents Generated\n\nDear ${buyerName},\n\nYour transfer compliance documents have been generated and are attached.\n\nVehicle: ${vehicle.plate_number || vehicle.vin} - ${vehicle.make} ${vehicle.model} (${vehicle.year})\nSeller: ${sellerName}`,
                        attachments: buyerEmailDocs.map(doc => ({
                            filename: doc.filename,
                            content: doc.buffer,
                            contentType: 'application/pdf'
                        }))
                    });
                    console.log(`[Transfer Certificates] ✅ Email sent to buyer: ${buyer.email}`);
                } catch (buyerEmailError) {
                    console.error('[Email] Error sending buyer email:', buyerEmailError);
                    results.errors.push({ type: 'buyerEmail', error: buyerEmailError.message });
                }
            }

            console.log(`[Transfer Certificates] Documents generated. Seller: ${sellerEmailDocs.length} docs, Buyer: ${buyerEmailDocs.length} docs`);

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
        console.error('[Transfer Compliance Documents] CRITICAL ERROR:', error);
        console.error('[Transfer Compliance Documents] Error stack:', error.stack);
        console.error('[Transfer Compliance Documents] Request body:', JSON.stringify(req.body, null, 2));
        
        res.status(500).json({
            success: false,
            error: 'Failed to generate compliance documents',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            errorType: error.name,
            // Include stack trace in development for debugging
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Export lookupAndValidateOwner for use in other routes
module.exports = router;
module.exports.lookupAndValidateOwner = lookupAndValidateOwner;
