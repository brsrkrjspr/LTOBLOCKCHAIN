// TrustChain LTO - Emission Database Service
// Backend wrapper for Emission Testing Center database verification
// In production, this would connect to the actual emission testing database API

class EmissionDatabaseService {
    constructor() {
        // Mock emission test records
        this.testRecords = [
            {
                plateNumber: 'ABC 123',
                engineNumber: 'ENG123456789',
                chassisNumber: 'CHS987654321',
                status: 'FAILED',
                testDate: '2024-01-15',
                expiryDate: '2024-01-15',
                testCenter: 'Metro Manila Emission Testing Center',
                testResult: {
                    co: 8.5,  // Carbon Monoxide (max 4.5%)
                    hc: 650,  // Hydrocarbons (max 600 ppm)
                    smoke: 75 // Smoke opacity (max 50%)
                },
                failureReason: 'CO and HC levels exceeded limits',
                technicianId: 'TECH-001'
            },
            {
                plateNumber: 'XYZ 789',
                engineNumber: 'ENG999888777',
                chassisNumber: 'CHS111222333',
                status: 'EXPIRED',
                testDate: '2023-06-20',
                expiryDate: '2024-06-20',
                testCenter: 'Quezon City Emission Center',
                testResult: {
                    co: 2.1,
                    hc: 450,
                    smoke: 35
                },
                failureReason: null,
                technicianId: 'TECH-042'
            },
            {
                plateNumber: 'DEF 456',
                engineNumber: 'ENG444555666',
                chassisNumber: 'CHS777888999',
                status: 'TAMPERED',
                testDate: '2024-03-01',
                expiryDate: null,
                testCenter: 'Makati Emission Testing',
                testResult: null,
                failureReason: 'Suspected falsified emission certificate',
                technicianId: 'INVESTIGATION'
            },
            {
                plateNumber: 'TEST 999',
                engineNumber: 'TESTENGINE123',
                chassisNumber: 'TESTCHASSIS456',
                status: 'FAILED',
                testDate: '2024-06-01',
                expiryDate: '2024-06-01',
                testCenter: 'Test Emission Center',
                testResult: {
                    co: 10.2,
                    hc: 850,
                    smoke: 85
                },
                failureReason: 'All emission levels exceeded - test entry for demonstration',
                technicianId: 'TEST-TECH'
            }
        ];

        // Valid/passed emission records
        this.validRecords = [
            {
                plateNumber: 'NCR 1234',
                engineNumber: 'CLEANENG001',
                chassisNumber: 'CLEANCHS001',
                status: 'PASSED',
                testDate: '2024-10-01',
                expiryDate: '2025-10-01',
                testCenter: 'LTO Main Emission Center',
                testResult: {
                    co: 1.8,
                    hc: 280,
                    smoke: 25
                },
                technicianId: 'TECH-100'
            },
            {
                plateNumber: 'CLEAN 001',
                engineNumber: 'VALIDENG001',
                chassisNumber: 'VALIDCHS001',
                status: 'PASSED',
                testDate: '2024-11-15',
                expiryDate: '2025-11-15',
                testCenter: 'Pasig Emission Testing',
                testResult: {
                    co: 2.0,
                    hc: 320,
                    smoke: 30
                },
                technicianId: 'TECH-055'
            }
        ];
    }

    /**
     * Look up vehicle in Emission database
     * @param {Object} vehicleData - Vehicle details to check
     * @returns {Object} Lookup result with status and details
     */
    lookupVehicle(vehicleData) {
        const { plateNumber, engineNumber, chassisNumber } = vehicleData;
        
        // Normalize inputs for comparison
        const normalizedPlate = (plateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
        const normalizedEngine = (engineNumber || '').toUpperCase().replace(/\s+/g, '').trim();
        const normalizedChassis = (chassisNumber || '').toUpperCase().replace(/\s+/g, '').trim();

        console.log('[Emission DB] Lookup:', { normalizedPlate, normalizedEngine, normalizedChassis });

        // Check failed/problematic records first
        const problemMatch = this.testRecords.find(record => {
            const recordPlate = record.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();
            const recordEngine = record.engineNumber.toUpperCase().replace(/\s+/g, '').trim();
            const recordChassis = record.chassisNumber.toUpperCase().replace(/\s+/g, '').trim();

            return (normalizedPlate && recordPlate === normalizedPlate) ||
                   (normalizedEngine && recordEngine === normalizedEngine) ||
                   (normalizedChassis && recordChassis === normalizedChassis);
        });

        if (problemMatch) {
            const statusMessages = {
                'FAILED': 'FAILED: Vehicle failed emission test',
                'EXPIRED': 'EXPIRED: Emission test certificate has expired',
                'TAMPERED': 'ALERT: Suspected tampered emission certificate'
            };

            return {
                found: true,
                status: 'FLAGGED',
                statusType: problemMatch.status,
                record: problemMatch,
                message: statusMessages[problemMatch.status] || 'Vehicle has issues',
                canApprove: false,
                details: {
                    testDate: problemMatch.testDate,
                    expiryDate: problemMatch.expiryDate,
                    testCenter: problemMatch.testCenter,
                    testResult: problemMatch.testResult,
                    failureReason: problemMatch.failureReason
                }
            };
        }

        // Check valid records
        const validMatch = this.validRecords.find(record => {
            const recordPlate = record.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();
            return normalizedPlate && recordPlate === normalizedPlate;
        });

        if (validMatch) {
            // Check if still valid (not expired)
            const expiryDate = new Date(validMatch.expiryDate);
            const isExpired = expiryDate < new Date();

            if (isExpired) {
                return {
                    found: true,
                    status: 'EXPIRED',
                    statusType: 'CERTIFICATE_EXPIRED',
                    record: validMatch,
                    message: 'Emission certificate has EXPIRED - Retest required',
                    canApprove: false,
                    details: {
                        testDate: validMatch.testDate,
                        expiryDate: validMatch.expiryDate,
                        testCenter: validMatch.testCenter,
                        testResult: validMatch.testResult
                    }
                };
            }

            return {
                found: true,
                status: 'VALID',
                statusType: 'PASSED',
                record: validMatch,
                message: 'PASSED: Vehicle has valid emission test certificate',
                canApprove: true,
                details: {
                    testDate: validMatch.testDate,
                    expiryDate: validMatch.expiryDate,
                    testCenter: validMatch.testCenter,
                    testResult: validMatch.testResult
                }
            };
        }

        // Vehicle not found in any database
        return {
            found: false,
            status: 'NOT_FOUND',
            statusType: 'NO_RECORD',
            record: null,
            message: 'No emission test record found - Manual verification of submitted certificate required',
            canApprove: true, // Can approve if manual verification of submitted cert passes
            details: {
                note: 'Vehicle has no prior records in emission database. Verify the submitted emission certificate manually.'
            }
        };
    }
}

// Export singleton instance
module.exports = new EmissionDatabaseService();
