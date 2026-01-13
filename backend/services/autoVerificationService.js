// TrustChain LTO - Auto-Verification Service
// Automatically verifies insurance, emission, and HPG documents upon registration submission

const ocrService = require('./ocrService');
const insuranceDatabase = require('./insuranceDatabaseService');
const emissionDatabase = require('./emissionDatabaseService');
const fraudDetectionService = require('./fraudDetectionService');
const db = require('../database/services');
const fs = require('fs').promises;
const path = require('path');

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

            // Cross-verify with insurance database
            const databaseCheck = insuranceDatabase.lookupVehicle({
                plateNumber: vehicle.plate_number,
                policyNumber: ocrData.insurancePolicyNumber || ocrData.policyNumber,
                engineNumber: vehicle.engine_number,
                chassisNumber: vehicle.chassis_number
            });
            console.log(`[Auto-Verify] Database check:`, databaseCheck.status);

            // Check expiry date
            const expiryCheck = this.checkExpiry(ocrData.insuranceExpiry || ocrData.expiryDate);
            
            // Fraud detection
            const fraudAnalysis = fraudDetectionService.analyzeDocument({
                ...ocrData,
                documentType: 'insurance'
            }, databaseCheck);
            console.log(`[Auto-Verify] Fraud score:`, fraudAnalysis.fraudScore);

            // Calculate verification score
            const checks = {
                databaseMatch: databaseCheck.status === 'VALID',
                notExpired: expiryCheck.isValid,
                dataConsistent: this.checkDataConsistency(ocrData, databaseCheck, vehicle),
                documentQuality: ocrData.insurancePolicyNumber ? 1.0 : 0.5,
                fraudScore: fraudAnalysis.fraudScore
            };

            const verificationScore = this.calculateVerificationScore(checks);
            console.log(`[Auto-Verify] Verification score: ${verificationScore.percentage}%`);

            // Decision logic
            const shouldApprove = verificationScore.percentage >= this.minScore &&
                                  checks.databaseMatch &&
                                  checks.notExpired &&
                                  checks.dataConsistent &&
                                  fraudAnalysis.passed;

            if (shouldApprove) {
                // Auto-approve
                const systemUserId = 'system'; // Use 'system' as verified_by for automated verifications
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'APPROVED',
                    systemUserId,
                    `Auto-verified: Score ${verificationScore.percentage}%, Policy: ${ocrData.insurancePolicyNumber || 'N/A'}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            databaseCheck,
                            expiryCheck,
                            fraudAnalysis,
                            checks,
                            verifiedAt: new Date().toISOString()
                        }
                    }
                );

                return {
                    status: 'APPROVED',
                    automated: true,
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: checks,
                    ocrData,
                    databaseCheck
                };
            } else {
                // Flag for manual review
                const reasons = [];
                if (!checks.databaseMatch) reasons.push('Database verification failed');
                if (!checks.notExpired) reasons.push('Document expired');
                if (!checks.dataConsistent) reasons.push('Data inconsistency detected');
                if (!fraudAnalysis.passed) reasons.push(`Fraud risk: ${fraudAnalysis.riskLevel}`);

                // Update verification status with metadata
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'PENDING',
                    null,
                    `Auto-verified but flagged: ${reasons.join(', ')}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            databaseCheck,
                            expiryCheck,
                            fraudAnalysis,
                            checks,
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
                    basis: checks,
                    ocrData,
                    databaseCheck
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

            // Cross-verify with emission database
            const databaseCheck = emissionDatabase.lookupVehicle({
                plateNumber: vehicle.plate_number,
                engineNumber: vehicle.engine_number,
                chassisNumber: vehicle.chassis_number
            });
            console.log(`[Auto-Verify] Database check:`, databaseCheck.status);

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

            // Fraud detection
            const fraudAnalysis = fraudDetectionService.analyzeDocument({
                ...ocrData,
                documentType: 'emission'
            }, databaseCheck);

            // Calculate verification score
            const checks = {
                databaseMatch: databaseCheck.status === 'VALID',
                notExpired: expiryCheck.isValid,
                dataConsistent: this.checkDataConsistency(ocrData, databaseCheck, vehicle),
                documentQuality: ocrData.testDate ? 1.0 : 0.5,
                fraudScore: fraudAnalysis.fraudScore,
                compliance: complianceCheck.allCompliant
            };

            const verificationScore = this.calculateVerificationScore(checks);
            console.log(`[Auto-Verify] Verification score: ${verificationScore.percentage}%`);

            // Decision logic
            const shouldApprove = verificationScore.percentage >= this.minScore &&
                                  checks.databaseMatch &&
                                  checks.notExpired &&
                                  checks.compliance &&
                                  fraudAnalysis.passed;

            if (shouldApprove) {
                // Auto-approve
                const systemUserId = 'system';
                await db.updateVerificationStatus(
                    vehicleId,
                    'emission',
                    'APPROVED',
                    systemUserId,
                    `Auto-verified: Score ${verificationScore.percentage}%, Test Date: ${ocrData.testDate || 'N/A'}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            databaseCheck,
                            expiryCheck,
                            complianceCheck,
                            fraudAnalysis,
                            checks,
                            verifiedAt: new Date().toISOString()
                        }
                    }
                );

                return {
                    status: 'APPROVED',
                    automated: true,
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: checks,
                    ocrData,
                    databaseCheck
                };
            } else {
                // Flag for manual review
                const reasons = [];
                if (!checks.databaseMatch) reasons.push('Database verification failed');
                if (!checks.notExpired) reasons.push('Certificate expired');
                if (!checks.compliance) reasons.push('Test results non-compliant');
                if (!fraudAnalysis.passed) reasons.push(`Fraud risk: ${fraudAnalysis.riskLevel}`);

                // Update verification status with metadata
                await db.updateVerificationStatus(
                    vehicleId,
                    'emission',
                    'PENDING',
                    null,
                    `Auto-verified but flagged: ${reasons.join(', ')}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            databaseCheck,
                            expiryCheck,
                            complianceCheck,
                            fraudAnalysis,
                            checks,
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
                    basis: checks,
                    ocrData,
                    databaseCheck
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

}

module.exports = new AutoVerificationService();
