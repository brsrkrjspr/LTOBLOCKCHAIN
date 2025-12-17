/**
 * Insurance Mock Database
 * Simulates Insurance Company's internal database for policy verification
 * In production, this would connect to the actual insurance database
 */

const InsuranceDatabase = {
    // Mock problematic insurance records
    problemRecords: [
        {
            plateNumber: 'ABC 123',
            engineNumber: 'ENG123456789',
            chassisNumber: 'CHS987654321',
            policyNumber: 'POL-2024-FAKE001',
            status: 'FRAUDULENT',
            issueDate: '2024-01-15',
            expiryDate: '2025-01-15',
            insuranceCompany: 'Unknown Insurance Co.',
            policyType: 'Comprehensive',
            flagReason: 'Policy number does not exist in insurance registry',
            reportedBy: 'Insurance Commission'
        },
        {
            plateNumber: 'XYZ 789',
            engineNumber: 'ENG999888777',
            chassisNumber: 'CHS111222333',
            policyNumber: 'POL-2023-EXP456',
            status: 'EXPIRED',
            issueDate: '2022-06-20',
            expiryDate: '2023-06-20',
            insuranceCompany: 'SafeDrive Insurance',
            policyType: 'CTPL',
            flagReason: 'Insurance policy has expired',
            reportedBy: 'System'
        },
        {
            plateNumber: 'DEF 456',
            engineNumber: 'ENG444555666',
            chassisNumber: 'CHS777888999',
            policyNumber: 'POL-2024-CAN789',
            status: 'CANCELLED',
            issueDate: '2024-01-01',
            expiryDate: '2025-01-01',
            insuranceCompany: 'SecureAuto Insurance',
            policyType: 'Comprehensive',
            flagReason: 'Policy cancelled due to non-payment of premium',
            reportedBy: 'SecureAuto Insurance'
        },
        {
            plateNumber: 'TEST 999',
            engineNumber: 'TESTENGINE123',
            chassisNumber: 'TESTCHASSIS456',
            policyNumber: 'POL-TEST-FRAUD',
            status: 'FRAUDULENT',
            issueDate: '2024-06-01',
            expiryDate: '2025-06-01',
            insuranceCompany: 'Fake Insurance Inc.',
            policyType: 'CTPL',
            flagReason: 'Test entry - Fraudulent insurance document',
            reportedBy: 'Test System'
        }
    ],

    // Valid insurance records
    validRecords: [
        {
            plateNumber: 'NCR 1234',
            engineNumber: 'CLEANENG001',
            chassisNumber: 'CLEANCHS001',
            policyNumber: 'POL-2024-VALID001',
            status: 'ACTIVE',
            issueDate: '2024-10-01',
            expiryDate: '2025-10-01',
            insuranceCompany: 'PhilAm Insurance',
            policyType: 'Comprehensive',
            coverage: 500000,
            premium: 15000
        },
        {
            plateNumber: 'CLEAN 001',
            engineNumber: 'VALIDENG001',
            chassisNumber: 'VALIDCHS001',
            policyNumber: 'POL-2024-VALID002',
            status: 'ACTIVE',
            issueDate: '2024-11-15',
            expiryDate: '2025-11-15',
            insuranceCompany: 'Malayan Insurance',
            policyType: 'CTPL',
            coverage: 100000,
            premium: 5000
        }
    ],

    /**
     * Look up vehicle in Insurance database
     * @param {Object} vehicleData - Vehicle details to check
     * @returns {Object} Lookup result with status and details
     */
    lookupVehicle: function(vehicleData) {
        const { plateNumber, engineNumber, chassisNumber, policyNumber } = vehicleData;
        
        // Normalize inputs for comparison
        const normalizedPlate = (plateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
        const normalizedEngine = (engineNumber || '').toUpperCase().replace(/\s+/g, '').trim();
        const normalizedChassis = (chassisNumber || '').toUpperCase().replace(/\s+/g, '').trim();
        const normalizedPolicy = (policyNumber || '').toUpperCase().replace(/\s+/g, '').trim();

        console.log('🛡️ Insurance Database Lookup:', { normalizedPlate, normalizedEngine, normalizedChassis, normalizedPolicy });

        // Check problem records first
        const problemMatch = this.problemRecords.find(record => {
            const recordPlate = record.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();
            const recordEngine = record.engineNumber.toUpperCase().replace(/\s+/g, '').trim();
            const recordChassis = record.chassisNumber.toUpperCase().replace(/\s+/g, '').trim();
            const recordPolicy = record.policyNumber.toUpperCase().replace(/\s+/g, '').trim();

            return (normalizedPlate && recordPlate === normalizedPlate) ||
                   (normalizedEngine && recordEngine === normalizedEngine) ||
                   (normalizedChassis && recordChassis === normalizedChassis) ||
                   (normalizedPolicy && recordPolicy === normalizedPolicy);
        });

        if (problemMatch) {
            const statusMessages = {
                'FRAUDULENT': '🚨 ALERT: Fraudulent insurance document detected',
                'EXPIRED': '⚠️ EXPIRED: Insurance policy has expired',
                'CANCELLED': '❌ CANCELLED: Insurance policy has been cancelled'
            };

            return {
                found: true,
                status: 'FLAGGED',
                statusType: problemMatch.status,
                record: problemMatch,
                message: statusMessages[problemMatch.status] || 'Insurance has issues',
                canApprove: false,
                details: {
                    policyNumber: problemMatch.policyNumber,
                    issueDate: problemMatch.issueDate,
                    expiryDate: problemMatch.expiryDate,
                    insuranceCompany: problemMatch.insuranceCompany,
                    policyType: problemMatch.policyType,
                    flagReason: problemMatch.flagReason,
                    reportedBy: problemMatch.reportedBy
                }
            };
        }

        // Check valid records
        const validMatch = this.validRecords.find(record => {
            const recordPlate = record.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();
            const recordPolicy = record.policyNumber.toUpperCase().replace(/\s+/g, '').trim();
            
            return (normalizedPlate && recordPlate === normalizedPlate) ||
                   (normalizedPolicy && recordPolicy === normalizedPolicy);
        });

        if (validMatch) {
            // Check if still valid (not expired)
            const expiryDate = new Date(validMatch.expiryDate);
            const isExpired = expiryDate < new Date();

            if (isExpired) {
                return {
                    found: true,
                    status: 'EXPIRED',
                    statusType: 'POLICY_EXPIRED',
                    record: validMatch,
                    message: '⚠️ Insurance policy has EXPIRED - Renewal required',
                    canApprove: false,
                    details: {
                        policyNumber: validMatch.policyNumber,
                        issueDate: validMatch.issueDate,
                        expiryDate: validMatch.expiryDate,
                        insuranceCompany: validMatch.insuranceCompany,
                        policyType: validMatch.policyType
                    }
                };
            }

            return {
                found: true,
                status: 'VALID',
                statusType: 'ACTIVE',
                record: validMatch,
                message: '✅ VALID: Insurance policy is active and verified',
                canApprove: true,
                details: {
                    policyNumber: validMatch.policyNumber,
                    issueDate: validMatch.issueDate,
                    expiryDate: validMatch.expiryDate,
                    insuranceCompany: validMatch.insuranceCompany,
                    policyType: validMatch.policyType,
                    coverage: validMatch.coverage,
                    premium: validMatch.premium
                }
            };
        }

        // Vehicle not found in any database
        return {
            found: false,
            status: 'NOT_FOUND',
            statusType: 'NO_RECORD',
            record: null,
            message: '📋 No insurance record found - Manual verification of submitted certificate required',
            canApprove: true, // Can approve if manual verification passes
            details: {
                note: 'Vehicle has no prior records in insurance database. Verify the submitted insurance certificate manually.'
            }
        };
    },

    /**
     * Add insurance record (for admin use)
     */
    addRecord: function(recordData) {
        const record = {
            plateNumber: recordData.plateNumber || '',
            engineNumber: recordData.engineNumber || '',
            chassisNumber: recordData.chassisNumber || '',
            policyNumber: recordData.policyNumber || `POL-${Date.now()}`,
            status: recordData.status || 'ACTIVE',
            issueDate: recordData.issueDate || new Date().toISOString().split('T')[0],
            expiryDate: recordData.expiryDate || null,
            insuranceCompany: recordData.insuranceCompany || 'Unknown',
            policyType: recordData.policyType || 'CTPL',
            flagReason: recordData.flagReason || '',
            reportedBy: recordData.reportedBy || 'Admin'
        };

        if (['FRAUDULENT', 'EXPIRED', 'CANCELLED'].includes(record.status)) {
            this.problemRecords.push(record);
        } else {
            this.validRecords.push(record);
        }
        this.saveToStorage();
        return record;
    },

    /**
     * Remove record (for admin use)
     */
    removeRecord: function(plateNumber) {
        let removed = false;
        
        let index = this.problemRecords.findIndex(r => 
            r.plateNumber.toUpperCase() === plateNumber.toUpperCase()
        );
        if (index > -1) {
            this.problemRecords.splice(index, 1);
            removed = true;
        }

        index = this.validRecords.findIndex(r => 
            r.plateNumber.toUpperCase() === plateNumber.toUpperCase()
        );
        if (index > -1) {
            this.validRecords.splice(index, 1);
            removed = true;
        }

        if (removed) this.saveToStorage();
        return removed;
    },

    /**
     * Get all records
     */
    getAllRecords: function() {
        return {
            problem: [...this.problemRecords],
            valid: [...this.validRecords]
        };
    },

    /**
     * Save to localStorage (for persistence in demo)
     */
    saveToStorage: function() {
        localStorage.setItem('insuranceProblemRecords', JSON.stringify(this.problemRecords));
        localStorage.setItem('insuranceValidRecords', JSON.stringify(this.validRecords));
    },

    /**
     * Load from localStorage
     */
    loadFromStorage: function() {
        const savedProblem = localStorage.getItem('insuranceProblemRecords');
        const savedValid = localStorage.getItem('insuranceValidRecords');
        
        if (savedProblem) {
            try {
                const parsed = JSON.parse(savedProblem);
                if (Array.isArray(parsed)) {
                    this.problemRecords = parsed;
                }
            } catch (e) {
                console.error('Error loading insurance problem records:', e);
            }
        }
        
        if (savedValid) {
            try {
                const parsed = JSON.parse(savedValid);
                if (Array.isArray(parsed)) {
                    this.validRecords = parsed;
                }
            } catch (e) {
                console.error('Error loading insurance valid records:', e);
            }
        }
    },

    /**
     * Reset to default mock data
     */
    resetToDefault: function() {
        localStorage.removeItem('insuranceProblemRecords');
        localStorage.removeItem('insuranceValidRecords');
        location.reload();
    },

    /**
     * Initialize database
     */
    init: function() {
        this.loadFromStorage();
        console.log('🛡️ Insurance Database initialized with', 
            this.problemRecords.length, 'problem records and',
            this.validRecords.length, 'valid records');
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    InsuranceDatabase.init();
}

