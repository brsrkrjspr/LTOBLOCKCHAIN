// TrustChain LTO - Fraud Detection Service
// Analyzes documents for fraud indicators and calculates fraud scores

class FraudDetectionService {
    /**
     * Analyze document for fraud indicators
     * @param {Object} documentData - Extracted document data from OCR
     * @param {Object} databaseCheck - Database verification result
     * @returns {Object} Fraud analysis result with score (0.0 to 1.0)
     */
    analyzeDocument(documentData, databaseCheck) {
        const fraudIndicators = [];
        let fraudScore = 0.0;
        const maxScore = 1.0;

        // Check 1: Policy/Certificate Number Format Validation (0.2 points)
        if (documentData.policyNumber || documentData.certificateNumber) {
            const policyNumber = (documentData.policyNumber || documentData.certificateNumber).toUpperCase();
            const validFormat = /^[A-Z0-9\-]{6,20}$/.test(policyNumber);
            
            if (!validFormat) {
                fraudIndicators.push({
                    type: 'INVALID_FORMAT',
                    severity: 'medium',
                    message: 'Policy/Certificate number format is suspicious',
                    score: 0.2
                });
                fraudScore += 0.2;
            }
        }

        // Check 2: Date Consistency (0.15 points)
        if (documentData.issueDate && documentData.expiryDate) {
            try {
                const issue = this.parseDate(documentData.issueDate);
                const expiry = this.parseDate(documentData.expiryDate);
                
                if (issue && expiry) {
                    // Issue date should be before expiry date
                    if (issue >= expiry) {
                        fraudIndicators.push({
                            type: 'DATE_INCONSISTENCY',
                            severity: 'high',
                            message: 'Issue date is after or equal to expiry date',
                            score: 0.15
                        });
                        fraudScore += 0.15;
                    }
                    
                    // Expiry date should not be too far in the future (more than 2 years)
                    const twoYearsFromNow = new Date();
                    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
                    if (expiry > twoYearsFromNow) {
                        fraudIndicators.push({
                            type: 'SUSPICIOUS_EXPIRY',
                            severity: 'medium',
                            message: 'Expiry date is unusually far in the future',
                            score: 0.1
                        });
                        fraudScore += 0.1;
                    }
                }
            } catch (error) {
                fraudIndicators.push({
                    type: 'DATE_PARSE_ERROR',
                    severity: 'low',
                    message: 'Could not parse dates for validation',
                    score: 0.05
                });
                fraudScore += 0.05;
            }
        }

        // Check 3: Database Mismatch (0.3 points)
        if (databaseCheck) {
            if (databaseCheck.status === 'FLAGGED' || databaseCheck.status === 'FRAUDULENT') {
                fraudIndicators.push({
                    type: 'DATABASE_FLAGGED',
                    severity: 'high',
                    message: databaseCheck.message || 'Document flagged in database',
                    score: 0.3
                });
                fraudScore += 0.3;
            }
            
            // Check if policy number matches database
            if (documentData.policyNumber && databaseCheck.record) {
                const docPolicy = documentData.policyNumber.toUpperCase().replace(/\s+/g, '').trim();
                const dbPolicy = (databaseCheck.record.policyNumber || '').toUpperCase().replace(/\s+/g, '').trim();
                
                if (dbPolicy && docPolicy !== dbPolicy) {
                    fraudIndicators.push({
                        type: 'POLICY_MISMATCH',
                        severity: 'high',
                        message: 'Policy number does not match database record',
                        score: 0.25
                    });
                    fraudScore += 0.25;
                }
            }
        }

        // Check 4: Missing Critical Fields (0.1 points per missing field)
        const criticalFields = {
            insurance: ['policyNumber', 'expiryDate', 'insuranceCompany']
        };
        
        if (documentData.documentType === 'insurance') {
            for (const field of criticalFields.insurance) {
                if (!documentData[field] && !documentData[`insurance${field.charAt(0).toUpperCase() + field.slice(1)}`]) {
                    fraudIndicators.push({
                        type: 'MISSING_FIELD',
                        severity: 'medium',
                        message: `Missing critical field: ${field}`,
                        score: 0.1
                    });
                    fraudScore += 0.1;
                }
            }
        }

        // Check 5: Suspicious Values (0.15 points)
        // (Emission-related suspicious value checks removed)

        // Check 6: Known Fraud Patterns (0.2 points)
        const knownFraudPatterns = [
            { pattern: /TEST|FAKE|SAMPLE/i, field: 'insuranceCompany', message: 'Contains test/fake keywords' },
            { pattern: /12345|00000|XXXXX/i, field: 'policyNumber', message: 'Contains suspicious number patterns' }
        ];
        
        for (const fraudPattern of knownFraudPatterns) {
            const fieldValue = documentData[fraudPattern.field] || '';
            if (fraudPattern.pattern.test(fieldValue)) {
                fraudIndicators.push({
                    type: 'KNOWN_FRAUD_PATTERN',
                    severity: 'high',
                    message: fraudPattern.message,
                    score: 0.2
                });
                fraudScore += 0.2;
            }
        }

        // Cap fraud score at 1.0
        fraudScore = Math.min(fraudScore, maxScore);

        return {
            fraudScore: fraudScore,
            riskLevel: this.getRiskLevel(fraudScore),
            indicators: fraudIndicators,
            passed: fraudScore < 0.3 // Pass if score is below 0.3 (30%)
        };
    }

    /**
     * Get risk level based on fraud score
     * @param {number} score - Fraud score (0.0 to 1.0)
     * @returns {string} Risk level
     */
    getRiskLevel(score) {
        if (score < 0.2) return 'LOW';
        if (score < 0.5) return 'MEDIUM';
        if (score < 0.8) return 'HIGH';
        return 'CRITICAL';
    }

    /**
     * Parse date string in various formats
     * @param {string} dateString - Date string to parse
     * @returns {Date|null} Parsed date or null
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        // Try common date formats
        const formats = [
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/   // MM/DD/YY or DD/MM/YY
        ];
        
        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                const month = parseInt(match[1]);
                const day = parseInt(match[2]);
                let year = parseInt(match[3]);
                
                // Handle 2-digit years
                if (year < 100) {
                    year += year < 50 ? 2000 : 1900;
                }
                
                // Try MM/DD/YYYY first, then DD/MM/YYYY
                const date1 = new Date(year, month - 1, day);
                const date2 = new Date(year, day - 1, month);
                
                // Return the one that makes sense (not invalid)
                if (date1.getMonth() === month - 1 && date1.getDate() === day) {
                    return date1;
                }
                if (date2.getMonth() === day - 1 && date2.getDate() === month) {
                    return date2;
                }
            }
        }
        
        // Try ISO format
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
        
        return null;
    }
}

module.exports = new FraudDetectionService();
