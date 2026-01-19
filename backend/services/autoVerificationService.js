// TrustChain LTO - Auto-Verification Service
// Automatically verifies insurance, emission, and HPG documents upon registration submission

const ocrService = require('./ocrService');
const insuranceDatabase = require('./insuranceDatabaseService');
const emissionDatabase = require('./emissionDatabaseService');
const fraudDetectionService = require('./fraudDetectionService');
const certificateBlockchain = require('./certificateBlockchainService');
const db = require('../database/services');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AutoVerificationService {
    constructor() {
        this.enabled = process.env.AUTO_VERIFICATION_ENABLED !== 'false';
        this.minScore = parseInt(process.env.AUTO_VERIFICATION_MIN_SCORE || '90');
    }

    /**
     * Automatically verify insurance document
     * @param {string} vehicleId - Vehicle ID
     * @param {Object} insuranceDoc - Insurance document record
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Verification result
     */
    async autoVerifyInsurance(vehicleId, insuranceDoc, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify] Starting insurance verification for vehicle ${vehicleId}`);

            // Get document file path
            const filePath = insuranceDoc.file_path || insuranceDoc.filePath;
            if (!filePath || !await this.fileExists(filePath)) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'Insurance document file not found',
                    confidence: 0
                };
            }

            // Extract data via OCR
            const ocrData = await ocrService.extractInsuranceInfo(filePath, insuranceDoc.mime_type || insuranceDoc.mimeType);
            console.log(`[Auto-Verify] OCR extracted:`, ocrData);

            const policyNumber = ocrData.insurancePolicyNumber || ocrData.policyNumber;
            if (!policyNumber) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'Policy number not found in document',
                    confidence: 0
                };
            }

            // Pattern validation
            const patternCheck = this.validateDocumentNumberFormat(policyNumber, 'insurance');
            console.log(`[Auto-Verify] Pattern check:`, patternCheck);

            if (!patternCheck.valid) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: `Invalid policy number format: ${patternCheck.reason}`,
                    confidence: 0,
                    patternCheck
                };
            }

            // Check expiry date
            const expiryCheck = this.checkExpiry(ocrData.insuranceExpiry || ocrData.expiryDate);
            
            // Calculate file hash
            const fileHash = insuranceDoc.file_hash || crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
            
            // Generate composite hash
            const expiryDateISO = expiryCheck.expiryDate || new Date().toISOString();
            const compositeHash = certificateBlockchain.generateCompositeHash(
                policyNumber,
                vehicle.vin,
                expiryDateISO,
                fileHash
            );
            console.log(`[Auto-Verify] Composite hash: ${compositeHash.substring(0, 16)}...`);

            // Check for duplicate hash (document reuse)
            const hashCheck = await certificateBlockchain.checkHashDuplicate(compositeHash);
            console.log(`[Auto-Verify] Hash duplicate check:`, hashCheck);

            if (hashCheck.exists) {
                return {
                    status: 'REJECTED',
                    automated: false,
                    reason: `Document already used for vehicle ${hashCheck.vehicleId}. Duplicate detected.`,
                    confidence: 0,
                    hashCheck
                };
            }

            // Calculate pattern-based score
            const verificationScore = this.calculatePatternBasedScore(
                policyNumber,
                'insurance',
                !hashCheck.exists,
                expiryCheck.isValid
            );
            console.log(`[Auto-Verify] Verification score: ${verificationScore.percentage}%`);

            // Decision logic: Pattern valid + Hash unique + Not expired
            const shouldApprove = verificationScore.percentage >= 80 &&
                                  patternCheck.valid &&
                                  !hashCheck.exists &&
                                  expiryCheck.isValid;

            if (shouldApprove) {
                // Store hash on blockchain
                let blockchainTxId = null;
                try {
                    const blockchainResult = await certificateBlockchain.storeCertificateHashOnBlockchain(
                        compositeHash,
                        {
                            certificateType: 'insurance',
                            vehicleVIN: vehicle.vin,
                            vehicleId: vehicleId,
                            certificateNumber: policyNumber,
                            applicationStatus: 'PENDING', // Will update when application approved
                            issuedAt: new Date().toISOString(),
                            issuedBy: 'system',
                            fileHash: fileHash
                        }
                    );
                    blockchainTxId = blockchainResult.transactionId;
                    console.log(`[Auto-Verify] Hash stored on blockchain: ${blockchainTxId}`);
                } catch (blockchainError) {
                    console.error('[Auto-Verify] Blockchain storage failed:', blockchainError);
                    // Continue with approval even if blockchain storage fails
                }

                // Auto-approve
                const systemUserId = 'system';
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'APPROVED',
                    systemUserId,
                    `Auto-verified: Pattern valid, Hash unique, Score ${verificationScore.percentage}%, Policy: ${policyNumber}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            patternCheck,
                            hashCheck,
                            expiryCheck,
                            compositeHash,
                            blockchainTxId,
                            verificationScore,
                            verifiedAt: new Date().toISOString()
                        }
                    }
                );

                return {
                    status: 'APPROVED',
                    automated: true,
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: verificationScore.checks,
                    ocrData,
                    patternCheck,
                    hashCheck,
                    compositeHash,
                    blockchainTxId
                };
            } else {
                // Flag for manual review
                const reasons = [];
                if (!patternCheck.valid) reasons.push(`Invalid format: ${patternCheck.reason}`);
                if (hashCheck.exists) reasons.push('Document already used (duplicate)');
                if (!expiryCheck.isValid) reasons.push('Document expired');
                if (verificationScore.percentage < 80) reasons.push(`Low score: ${verificationScore.percentage}%`);

                // Update verification status with metadata
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'PENDING',
                    null,
                    `Auto-verification flagged: ${reasons.join(', ')}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            patternCheck,
                            hashCheck,
                            expiryCheck,
                            verificationScore,
                            flaggedAt: new Date().toISOString(),
                            flagReasons: reasons
                        }
                    }
                );

                return {
                    status: 'PENDING',
                    automated: false,
                    reason: reasons.join(', '),
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: verificationScore.checks,
                    ocrData,
                    patternCheck,
                    hashCheck
                };
            }
        } catch (error) {
            console.error('[Auto-Verify] Insurance verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Verification error: ${error.message}`,
                confidence: 0
            };
        }
    }

    /**
     * Automatically verify emission document
     * @param {string} vehicleId - Vehicle ID
     * @param {Object} emissionDoc - Emission document record
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Verification result
     */
    async autoVerifyEmission(vehicleId, emissionDoc, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify] Starting emission verification for vehicle ${vehicleId}`);

            // Get document file path
            const filePath = emissionDoc.file_path || emissionDoc.filePath;
            if (!filePath || !await this.fileExists(filePath)) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'Emission document file not found',
                    confidence: 0
                };
            }

            // Extract data via OCR
            const ocrData = await ocrService.extractEmissionInfo(filePath, emissionDoc.mime_type || emissionDoc.mimeType);
            console.log(`[Auto-Verify] OCR extracted:`, ocrData);

            const certificateNumber = ocrData.certificateNumber || ocrData.certificateRefNumber || ocrData.certRefNumber;
            if (!certificateNumber) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'Certificate number not found in document',
                    confidence: 0
                };
            }

            // Pattern validation
            const patternCheck = this.validateDocumentNumberFormat(certificateNumber, 'emission');
            console.log(`[Auto-Verify] Pattern check:`, patternCheck);

            if (!patternCheck.valid) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: `Invalid certificate number format: ${patternCheck.reason}`,
                    confidence: 0,
                    patternCheck
                };
            }

            // Check expiry date
            const expiryCheck = this.checkExpiry(ocrData.expiryDate);
            
            // Check compliance (CO ≤ 4.5%, HC ≤ 600ppm, Smoke ≤ 50%)
            const complianceCheck = {
                coCompliant: ocrData.co === undefined || ocrData.co <= 4.5,
                hcCompliant: ocrData.hc === undefined || ocrData.hc <= 600,
                smokeCompliant: ocrData.smoke === undefined || ocrData.smoke <= 50,
                allCompliant: (ocrData.co === undefined || ocrData.co <= 4.5) &&
                             (ocrData.hc === undefined || ocrData.hc <= 600) &&
                             (ocrData.smoke === undefined || ocrData.smoke <= 50)
            };

            // Calculate file hash
            const fileHash = emissionDoc.file_hash || crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
            
            // Generate composite hash
            const expiryDateISO = expiryCheck.expiryDate || new Date().toISOString();
            const compositeHash = certificateBlockchain.generateCompositeHash(
                certificateNumber,
                vehicle.vin,
                expiryDateISO,
                fileHash
            );
            console.log(`[Auto-Verify] Composite hash: ${compositeHash.substring(0, 16)}...`);

            // Check for duplicate hash (document reuse)
            const hashCheck = await certificateBlockchain.checkHashDuplicate(compositeHash);
            console.log(`[Auto-Verify] Hash duplicate check:`, hashCheck);

            if (hashCheck.exists) {
                return {
                    status: 'REJECTED',
                    automated: false,
                    reason: `Document already used for vehicle ${hashCheck.vehicleId}. Duplicate detected.`,
                    confidence: 0,
                    hashCheck
                };
            }

            // Calculate pattern-based score
            const verificationScore = this.calculatePatternBasedScore(
                certificateNumber,
                'emission',
                !hashCheck.exists,
                expiryCheck.isValid
            );
            console.log(`[Auto-Verify] Verification score: ${verificationScore.percentage}%`);

            // Decision logic: Pattern valid + Hash unique + Not expired + Compliant
            const shouldApprove = verificationScore.percentage >= 80 &&
                                  patternCheck.valid &&
                                  !hashCheck.exists &&
                                  expiryCheck.isValid &&
                                  complianceCheck.allCompliant;

            if (shouldApprove) {
                // Store hash on blockchain
                let blockchainTxId = null;
                try {
                    const blockchainResult = await certificateBlockchain.storeCertificateHashOnBlockchain(
                        compositeHash,
                        {
                            certificateType: 'emission',
                            vehicleVIN: vehicle.vin,
                            vehicleId: vehicleId,
                            certificateNumber: certificateNumber,
                            applicationStatus: 'PENDING',
                            issuedAt: new Date().toISOString(),
                            issuedBy: 'system',
                            fileHash: fileHash
                        }
                    );
                    blockchainTxId = blockchainResult.transactionId;
                    console.log(`[Auto-Verify] Hash stored on blockchain: ${blockchainTxId}`);
                } catch (blockchainError) {
                    console.error('[Auto-Verify] Blockchain storage failed:', blockchainError);
                    // Continue with approval even if blockchain storage fails
                }

                // Auto-approve
                const systemUserId = 'system';
                await db.updateVerificationStatus(
                    vehicleId,
                    'emission',
                    'APPROVED',
                    systemUserId,
                    `Auto-verified: Pattern valid, Hash unique, Score ${verificationScore.percentage}%, Certificate: ${certificateNumber}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            patternCheck,
                            hashCheck,
                            expiryCheck,
                            complianceCheck,
                            compositeHash,
                            blockchainTxId,
                            verificationScore,
                            verifiedAt: new Date().toISOString()
                        }
                    }
                );

                return {
                    status: 'APPROVED',
                    automated: true,
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: verificationScore.checks,
                    ocrData,
                    patternCheck,
                    hashCheck,
                    compositeHash,
                    blockchainTxId
                };
            } else {
                // Flag for manual review
                const reasons = [];
                if (!patternCheck.valid) reasons.push(`Invalid format: ${patternCheck.reason}`);
                if (hashCheck.exists) reasons.push('Document already used (duplicate)');
                if (!expiryCheck.isValid) reasons.push('Certificate expired');
                if (!complianceCheck.allCompliant) reasons.push('Test results non-compliant');
                if (verificationScore.percentage < 80) reasons.push(`Low score: ${verificationScore.percentage}%`);

                // Update verification status with metadata
                await db.updateVerificationStatus(
                    vehicleId,
                    'emission',
                    'PENDING',
                    null,
                    `Auto-verification flagged: ${reasons.join(', ')}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            patternCheck,
                            hashCheck,
                            expiryCheck,
                            complianceCheck,
                            verificationScore,
                            flaggedAt: new Date().toISOString(),
                            flagReasons: reasons
                        }
                    }
                );

                return {
                    status: 'PENDING',
                    automated: false,
                    reason: reasons.join(', '),
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: verificationScore.checks,
                    ocrData,
                    patternCheck,
                    hashCheck
                };
            }
        } catch (error) {
            console.error('[Auto-Verify] Emission verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Verification error: ${error.message}`,
                confidence: 0
            };
        }
    }

    /**
     * Auto-verify HPG documents with hashing and duplicate detection
     * Similar to Insurance/Emission but always requires manual final approval
     * @param {string} vehicleId - Vehicle ID
     * @param {Array} documents - Array of document records
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Auto-verification result with confidence score
     */
    async autoVerifyHPG(vehicleId, documents, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify] Starting HPG auto-verification for vehicle ${vehicleId}`);

            // Find HPG Clearance document (HPG receives hpg_clearance, not OR/CR)
            const hpgClearanceDoc = documents.find(d => 
                d.document_type === 'hpg_clearance' || 
                d.document_type === 'hpgClearance' ||
                d.document_type === 'pnp_hpg_clearance' ||
                d.type === 'hpg_clearance' ||
                d.type === 'hpgClearance' ||
                d.type === 'pnp_hpg_clearance'
            );

            // Fallback: Also check for OR/CR (for transfer cases where OR/CR is submitted)
            const clearanceDoc = hpgClearanceDoc || documents.find(d => 
                d.document_type === 'registration_cert' || 
                d.document_type === 'registrationCert' ||
                d.type === 'registration_cert' ||
                d.type === 'registrationCert' ||
                d.type === 'or_cr'
            );

            if (!clearanceDoc) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'HPG Clearance document not found',
                    confidence: 0
                };
            }

            const filePath = clearanceDoc.file_path || clearanceDoc.filePath;
            if (!filePath || !await this.fileExists(filePath)) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'HPG Clearance document file not found',
                    confidence: 0
                };
            }

            // Extract data via OCR - use correct document type for parsing
            const docMimeType = clearanceDoc.mime_type || clearanceDoc.mimeType || 'application/pdf';
            const docType = hpgClearanceDoc ? 'hpg_clearance' : 'registration_cert';
            
            // Extract text and parse with correct document type
            const extractedText = await ocrService.extractText(filePath, docMimeType);
            const ocrData = ocrService.parseVehicleInfo(extractedText, docType);
            console.log(`[Auto-Verify] OCR extracted from ${docType}:`, ocrData);

            const engineNumber = ocrData.engineNumber || vehicle.engine_number;
            const chassisNumber = ocrData.chassisNumber || ocrData.vin || vehicle.chassis_number;

            if (!engineNumber || !chassisNumber) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'Engine number or chassis number not found in document',
                    confidence: 0
                };
            }

            // Calculate file hash
            const fileHash = clearanceDoc.file_hash || crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
            
            // Generate composite hash (HPG clearance doesn't have expiry, use issue date)
            const issueDateISO = new Date().toISOString();
            const compositeHash = certificateBlockchain.generateCompositeHash(
                `HPG-${vehicle.vin}-${Date.now()}`, // HPG clearance number format
                vehicle.vin,
                issueDateISO,
                fileHash
            );
            console.log(`[Auto-Verify] Composite hash: ${compositeHash.substring(0, 16)}...`);

            // Check for duplicate hash (document reuse)
            const hashCheck = await certificateBlockchain.checkHashDuplicate(compositeHash);
            console.log(`[Auto-Verify] Hash duplicate check:`, hashCheck);

            if (hashCheck.exists) {
                return {
                    status: 'REJECTED',
                    automated: false,
                    reason: `Document already used for vehicle ${hashCheck.vehicleId}. Duplicate detected.`,
                    confidence: 0,
                    hashCheck,
                    compositeHash
                };
            }

            // Calculate confidence score based on:
            // - Data extraction quality (40 points)
            // - Hash uniqueness (30 points)
            // - Document completeness (20 points)
            // - Data match with vehicle record (10 points)
            let confidenceScore = 0;
            const scoreBreakdown = {
                dataExtraction: 0,
                hashUniqueness: 0,
                documentCompleteness: 0,
                dataMatch: 0,
                total: 0
            };

            // Data extraction quality (40 points)
            if (engineNumber && chassisNumber) {
                scoreBreakdown.dataExtraction = 40;
            } else if (engineNumber || chassisNumber) {
                scoreBreakdown.dataExtraction = 20;
            }

            // Hash uniqueness (30 points)
            if (!hashCheck.exists) {
                scoreBreakdown.hashUniqueness = 30;
            }

            // Document completeness (20 points)
            const hasHPGClearance = !!clearanceDoc;
            const hasOwnerID = documents.some(d => 
                d.document_type === 'owner_id' || 
                d.document_type === 'ownerId' ||
                d.type === 'owner_id' ||
                d.type === 'ownerId'
            );
            if (hasHPGClearance && hasOwnerID) {
                scoreBreakdown.documentCompleteness = 20;
            } else if (hasHPGClearance) {
                scoreBreakdown.documentCompleteness = 10;
            }

            // Data match with vehicle record (10 points)
            const engineMatch = engineNumber && vehicle.engine_number && 
                               engineNumber.toUpperCase().trim() === vehicle.engine_number.toUpperCase().trim();
            const chassisMatch = chassisNumber && vehicle.chassis_number && 
                                chassisNumber.toUpperCase().trim() === vehicle.chassis_number.toUpperCase().trim();
            if (engineMatch && chassisMatch) {
                scoreBreakdown.dataMatch = 10;
            } else if (engineMatch || chassisMatch) {
                scoreBreakdown.dataMatch = 5;
            }

            confidenceScore = Math.min(100, 
                scoreBreakdown.dataExtraction + 
                scoreBreakdown.hashUniqueness + 
                scoreBreakdown.documentCompleteness + 
                scoreBreakdown.dataMatch
            );
            scoreBreakdown.total = confidenceScore;

            // Determine recommendation
            let recommendation = 'MANUAL_REVIEW';
            let recommendationReason = '';

            if (hashCheck.exists) {
                recommendation = 'AUTO_REJECT';
                recommendationReason = 'Document duplicate detected. Certificate already used.';
            } else if (confidenceScore >= 80) {
                recommendation = 'AUTO_APPROVE';
                recommendationReason = 'High confidence score. All checks passed. Manual physical inspection still required.';
            } else if (confidenceScore >= 60) {
                recommendation = 'REVIEW';
                recommendationReason = 'Moderate confidence. Review recommended before approval.';
            } else {
                recommendation = 'MANUAL_REVIEW';
                recommendationReason = 'Low confidence score. Manual verification required.';
            }

            // Store verification metadata (but don't auto-approve - HPG always requires manual approval)
            await db.updateVerificationStatus(
                vehicleId,
                'hpg',
                'PENDING',
                null,
                `HPG auto-verified. Confidence: ${confidenceScore}%. ${recommendationReason}`,
                {
                    automated: true,
                    verificationScore: confidenceScore,
                    verificationMetadata: {
                        ocrData,
                        hashCheck,
                        compositeHash,
                        scoreBreakdown,
                        recommendation,
                        recommendationReason,
                        autoVerifiedAt: new Date().toISOString(),
                        note: 'HPG always requires manual physical inspection and final approval'
                    }
                }
            );

            return {
                status: 'PENDING', // Always PENDING - HPG requires manual approval
                automated: true,
                confidence: confidenceScore / 100,
                score: confidenceScore,
                recommendation,
                recommendationReason,
                scoreBreakdown,
                hashCheck,
                compositeHash,
                ocrData,
                preFilledData: {
                    engineNumber,
                    chassisNumber
                }
            };
        } catch (error) {
            console.error('[Auto-Verify] HPG auto-verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Auto-verification error: ${error.message}`,
                confidence: 0
            };
        }
    }

    /**
     * Pre-verify HPG documents (extract data, but always requires manual physical inspection)
     * @param {string} vehicleId - Vehicle ID
     * @param {Array} documents - Array of document records
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Pre-verification result with extracted data
     */
    async preVerifyHPG(vehicleId, documents, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify] Starting HPG pre-verification for vehicle ${vehicleId}`);

            // Find registration cert and owner ID documents
            const registrationCert = documents.find(d => 
                d.document_type === 'registration_cert' || d.document_type === 'registrationCert'
            );
            const ownerId = documents.find(d => 
                d.document_type === 'owner_id' || d.document_type === 'ownerId'
            );

            let extractedData = {};

            // Extract from registration certificate
            if (registrationCert) {
                const regPath = registrationCert.file_path || registrationCert.filePath;
                if (regPath && await this.fileExists(regPath)) {
                    const regMimeType = registrationCert.mime_type || registrationCert.mimeType || 'application/pdf';
                    const hpgData = await ocrService.extractHPGInfo(
                        regPath,
                        null,
                        regMimeType,
                        null
                    );
                    extractedData = { ...extractedData, ...hpgData };
                }
            }

            // Extract from owner ID
            if (ownerId) {
                const ownerPath = ownerId.file_path || ownerId.filePath;
                if (ownerPath && await this.fileExists(ownerPath)) {
                    const ownerMimeType = ownerId.mime_type || ownerId.mimeType || 'application/pdf';
                    const ownerData = await ocrService.extractHPGInfo(
                        null,
                        ownerPath,
                        null,
                        ownerMimeType
                    );
                    extractedData = { ...extractedData, ...ownerData };
                }
            }

            console.log(`[Auto-Verify] HPG extracted data:`, extractedData);

            // Always keep status as PENDING (requires manual physical inspection)
            // But store extracted data for pre-filling HPG form
            await db.updateVerificationStatus(
                vehicleId,
                'hpg',
                'PENDING',
                null,
                'HPG pre-verified: Data extracted, manual physical inspection required',
                {
                    automated: true,
                    verificationScore: extractedData.engineNumber && extractedData.chassisNumber ? 50 : 0,
                    verificationMetadata: {
                        extractedData,
                        preVerifiedAt: new Date().toISOString(),
                        note: 'HPG always requires manual physical inspection'
                    }
                }
            );

            return {
                status: 'PENDING',
                automated: false,
                reason: 'HPG requires manual physical inspection',
                extractedData,
                canPreFill: !!(extractedData.engineNumber && extractedData.chassisNumber)
            };
        } catch (error) {
            console.error('[Auto-Verify] HPG pre-verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Pre-verification error: ${error.message}`,
                extractedData: {}
            };
        }
    }

    /**
     * Calculate verification score from checks
     * @param {Object} checks - Verification checks object
     * @returns {Object} Score result
     */
    calculateVerificationScore(checks) {
        let score = 0;
        let maxScore = 0;

        // Database match (40 points)
        maxScore += 40;
        if (checks.databaseMatch) score += 40;

        // Expiry check (20 points)
        maxScore += 20;
        if (checks.notExpired) score += 20;

        // Data consistency (20 points)
        maxScore += 20;
        if (checks.dataConsistent) score += 20;

        // Document quality (10 points)
        maxScore += 10;
        score += checks.documentQuality * 10;

        // Fraud detection (10 points) - inverse (lower fraud = higher score)
        maxScore += 10;
        score += (1 - checks.fraudScore) * 10;

        // Compliance (for emission only, 10 points)
        if (checks.compliance !== undefined) {
            maxScore += 10;
            if (checks.compliance) score += 10;
        }

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        return {
            score,
            maxScore,
            percentage,
            decision: percentage >= 90 ? 'APPROVE' : percentage >= 70 ? 'REVIEW' : 'REJECT'
        };
    }

    /**
     * Check if document is expired
     * @param {string} expiryDate - Expiry date string
     * @returns {Object} Expiry check result
     */
    checkExpiry(expiryDate) {
        if (!expiryDate) {
            return { isValid: false, reason: 'Expiry date not found' };
        }

        try {
            const expiry = this.parseDate(expiryDate);
            if (!expiry) {
                return { isValid: false, reason: 'Could not parse expiry date' };
            }

            const now = new Date();
            const isValid = expiry > now;
            
            return {
                isValid,
                expiryDate: expiry.toISOString(),
                daysUntilExpiry: isValid ? Math.floor((expiry - now) / (1000 * 60 * 60 * 24)) : 0,
                reason: isValid ? 'Valid' : 'Expired'
            };
        } catch (error) {
            return { isValid: false, reason: `Error checking expiry: ${error.message}` };
        }
    }

    /**
     * Check data consistency between OCR data, database, and vehicle
     * @param {Object} ocrData - OCR extracted data
     * @param {Object} databaseCheck - Database verification result
     * @param {Object} vehicle - Vehicle data
     * @returns {boolean} True if data is consistent
     */
    checkDataConsistency(ocrData, databaseCheck, vehicle) {
        // If database check found a record, verify consistency
        if (databaseCheck.found && databaseCheck.record) {
            // Check vehicle details match
            const plateMatch = !vehicle.plate_number || !databaseCheck.record.plateNumber ||
                             vehicle.plate_number.toUpperCase().replace(/\s+/g, ' ') === 
                             databaseCheck.record.plateNumber.toUpperCase().replace(/\s+/g, ' ');

            // For insurance: check policy number matches
            if (ocrData.insurancePolicyNumber || ocrData.policyNumber) {
                const policyMatch = databaseCheck.record.policyNumber &&
                    (ocrData.insurancePolicyNumber || ocrData.policyNumber).toUpperCase().replace(/\s+/g, '') ===
                    databaseCheck.record.policyNumber.toUpperCase().replace(/\s+/g, '');
                return plateMatch && policyMatch;
            }

            return plateMatch;
        }

        // If no database record, consider it consistent (manual verification will handle)
        return true;
    }

    /**
     * Parse date string
     * @param {string} dateString - Date string
     * @returns {Date|null} Parsed date
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        // Try common formats
        const formats = [
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/
        ];
        
        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                const month = parseInt(match[1]);
                const day = parseInt(match[2]);
                let year = parseInt(match[3]);
                
                if (year < 100) {
                    year += year < 50 ? 2000 : 1900;
                }
                
                const date = new Date(year, month - 1, day);
                if (date.getMonth() === month - 1 && date.getDate() === day) {
                    return date;
                }
            }
        }
        
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
        
        return null;
    }

    /**
     * Check if file exists
     * @param {string} filePath - File path
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get document number patterns for validation
     * @param {string} documentType - Document type: 'insurance', 'emission', 'hpg'
     * @returns {Object} Pattern object with regex and description
     */
    getDocumentNumberPatterns(documentType) {
        const patterns = {
            insurance: {
                regex: /^CTPL-\d{4}-\d{6}$/,
                description: 'CTPL-YYYY-NNNNNN (e.g., CTPL-2026-000123)',
                example: 'CTPL-2026-000123'
            },
            emission: {
                regex: /^ETC-\d{8}-\d{3}$/,
                description: 'ETC-YYYYMMDD-NNN (e.g., ETC-20260113-001)',
                example: 'ETC-20260113-001'
            },
            hpg: {
                regex: /^HPG-\d{4}-\d{6}$/,
                description: 'HPG-YYYY-NNNNNN (e.g., HPG-2026-000123)',
                example: 'HPG-2026-000123'
            }
        };

        return patterns[documentType] || null;
    }

    /**
     * Validate document number format
     * @param {string} documentNumber - Document number to validate
     * @param {string} documentType - Document type: 'insurance', 'emission', 'hpg'
     * @returns {Object} Validation result
     */
    validateDocumentNumberFormat(documentNumber, documentType) {
        if (!documentNumber || !documentType) {
            return {
                valid: false,
                confidence: 0,
                reason: 'Document number or type is missing'
            };
        }

        const pattern = this.getDocumentNumberPatterns(documentType);
        if (!pattern) {
            return {
                valid: false,
                confidence: 0,
                reason: `Unknown document type: ${documentType}`
            };
        }

        const normalized = documentNumber.trim().toUpperCase();
        const matches = pattern.regex.test(normalized);

        if (matches) {
            return {
                valid: true,
                confidence: 100,
                normalized,
                pattern: pattern.description,
                reason: 'Format matches expected pattern'
            };
        } else {
            return {
                valid: false,
                confidence: 0,
                normalized,
                expectedPattern: pattern.description,
                example: pattern.example,
                reason: `Format does not match expected pattern: ${pattern.description}`
            };
        }
    }

    /**
     * Calculate pattern-based score for verification
     * @param {string} documentNumber - Document number
     * @param {string} documentType - Document type
     * @param {boolean} hashUnique - Whether hash is unique (not duplicate)
     * @param {boolean} notExpired - Whether document is not expired
     * @returns {Object} Score result
     */
    calculatePatternBasedScore(documentNumber, documentType, hashUnique, notExpired) {
        const patternCheck = this.validateDocumentNumberFormat(documentNumber, documentType);
        
        let score = 0;
        let maxScore = 0;
        const checks = {};

        // Pattern validation (50 points)
        maxScore += 50;
        if (patternCheck.valid) {
            score += 50;
            checks.patternValid = true;
        } else {
            checks.patternValid = false;
            checks.patternReason = patternCheck.reason;
        }

        // Hash uniqueness (30 points)
        maxScore += 30;
        if (hashUnique) {
            score += 30;
            checks.hashUnique = true;
        } else {
            checks.hashUnique = false;
            checks.hashReason = 'Hash already exists (duplicate document)';
        }

        // Expiry check (20 points)
        maxScore += 20;
        if (notExpired) {
            score += 20;
            checks.notExpired = true;
        } else {
            checks.notExpired = false;
            checks.expiryReason = 'Document has expired';
        }

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        return {
            score,
            maxScore,
            percentage,
            checks,
            patternCheck,
            decision: percentage >= 80 ? 'APPROVE' : percentage >= 60 ? 'REVIEW' : 'REJECT'
        };
    }

}

module.exports = new AutoVerificationService();
