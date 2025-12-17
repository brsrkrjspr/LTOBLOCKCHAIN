/**
 * HPG Mock Database
 * Simulates HPG's internal database for vehicle verification
 * In production, this would connect to HPG's actual database
 */

const HPGDatabase = {
    // Mock "Hot List" - Vehicles flagged as carnapped, stolen, or with issues
    hotList: [
        {
            plateNumber: 'ABC 123',
            engineNumber: 'ENG123456789',
            chassisNumber: 'CHS987654321',
            status: 'CARNAPPED',
            reportDate: '2024-01-15',
            reportedBy: 'Manila Police District',
            caseNumber: 'MPD-2024-00123',
            description: 'Reported stolen from Makati City parking lot'
        },
        {
            plateNumber: 'XYZ 789',
            engineNumber: 'ENG999888777',
            chassisNumber: 'CHS111222333',
            status: 'STOLEN',
            reportDate: '2023-11-20',
            reportedBy: 'Quezon City Police',
            caseNumber: 'QCPD-2023-04567',
            description: 'Armed robbery - vehicle taken at gunpoint'
        },
        {
            plateNumber: 'DEF 456',
            engineNumber: 'ENG444555666',
            chassisNumber: 'CHS777888999',
            status: 'UNDER_INVESTIGATION',
            reportDate: '2024-03-01',
            reportedBy: 'HPG Regional Office',
            caseNumber: 'HPG-2024-00089',
            description: 'Suspected tampered engine number - under verification'
        },
        {
            plateNumber: 'TEST 999',
            engineNumber: 'TESTENGINE123',
            chassisNumber: 'TESTCHASSIS456',
            status: 'CARNAPPED',
            reportDate: '2024-06-01',
            reportedBy: 'Test Police Station',
            caseNumber: 'TEST-2024-001',
            description: 'Test entry for demonstration purposes'
        }
    ],

    // Clean vehicles (known good records)
    cleanRecords: [
        {
            plateNumber: 'NCR 1234',
            engineNumber: 'CLEANENG001',
            chassisNumber: 'CLEANCHS001',
            lastVerified: '2024-10-01',
            verifiedBy: 'HPG NCR'
        }
    ],

    /**
     * Look up vehicle in HPG database
     * @param {Object} vehicleData - Vehicle details to check
     * @returns {Object} Lookup result with status and details
     */
    lookupVehicle: function(vehicleData) {
        const { plateNumber, engineNumber, chassisNumber } = vehicleData;
        
        // Normalize inputs for comparison
        const normalizedPlate = (plateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
        const normalizedEngine = (engineNumber || '').toUpperCase().replace(/\s+/g, '').trim();
        const normalizedChassis = (chassisNumber || '').toUpperCase().replace(/\s+/g, '').trim();

        console.log('🔍 HPG Database Lookup:', { normalizedPlate, normalizedEngine, normalizedChassis });

        // Check hot list first
        const hotListMatch = this.hotList.find(record => {
            const recordPlate = record.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();
            const recordEngine = record.engineNumber.toUpperCase().replace(/\s+/g, '').trim();
            const recordChassis = record.chassisNumber.toUpperCase().replace(/\s+/g, '').trim();

            // Match by any identifier
            return (normalizedPlate && recordPlate === normalizedPlate) ||
                   (normalizedEngine && recordEngine === normalizedEngine) ||
                   (normalizedChassis && recordChassis === normalizedChassis);
        });

        if (hotListMatch) {
            return {
                found: true,
                status: 'FLAGGED',
                statusType: hotListMatch.status,
                record: hotListMatch,
                message: `⚠️ ALERT: Vehicle found in HPG Hot List - ${hotListMatch.status}`,
                canIssueClearance: false,
                details: {
                    caseNumber: hotListMatch.caseNumber,
                    reportDate: hotListMatch.reportDate,
                    reportedBy: hotListMatch.reportedBy,
                    description: hotListMatch.description
                }
            };
        }

        // Check clean records
        const cleanMatch = this.cleanRecords.find(record => {
            const recordPlate = record.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();
            return normalizedPlate && recordPlate === normalizedPlate;
        });

        if (cleanMatch) {
            return {
                found: true,
                status: 'CLEAN',
                statusType: 'VERIFIED_CLEAN',
                record: cleanMatch,
                message: '✅ Vehicle verified CLEAN - No records in hot list',
                canIssueClearance: true,
                details: {
                    lastVerified: cleanMatch.lastVerified,
                    verifiedBy: cleanMatch.verifiedBy
                }
            };
        }

        // Vehicle not found in any database
        return {
            found: false,
            status: 'NOT_FOUND',
            statusType: 'NO_RECORD',
            record: null,
            message: '📋 Vehicle not found in HPG database - Manual verification required',
            canIssueClearance: true, // Can issue if manual verification passes
            details: {
                note: 'Vehicle has no prior records in HPG database. Proceed with standard verification.'
            }
        };
    },

    /**
     * Add vehicle to hot list (for admin use)
     */
    addToHotList: function(vehicleData) {
        const record = {
            plateNumber: vehicleData.plateNumber || '',
            engineNumber: vehicleData.engineNumber || '',
            chassisNumber: vehicleData.chassisNumber || '',
            status: vehicleData.status || 'UNDER_INVESTIGATION',
            reportDate: new Date().toISOString().split('T')[0],
            reportedBy: vehicleData.reportedBy || 'HPG System',
            caseNumber: vehicleData.caseNumber || `HPG-${Date.now()}`,
            description: vehicleData.description || ''
        };

        this.hotList.push(record);
        this.saveToStorage();
        return record;
    },

    /**
     * Remove from hot list (for admin use)
     */
    removeFromHotList: function(plateNumber) {
        const index = this.hotList.findIndex(r => 
            r.plateNumber.toUpperCase() === plateNumber.toUpperCase()
        );
        if (index > -1) {
            this.hotList.splice(index, 1);
            this.saveToStorage();
            return true;
        }
        return false;
    },

    /**
     * Get all hot list entries
     */
    getHotList: function() {
        return [...this.hotList];
    },

    /**
     * Save to localStorage (for persistence in demo)
     */
    saveToStorage: function() {
        localStorage.setItem('hpgHotList', JSON.stringify(this.hotList));
    },

    /**
     * Load from localStorage
     */
    loadFromStorage: function() {
        const saved = localStorage.getItem('hpgHotList');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    this.hotList = parsed;
                }
            } catch (e) {
                console.error('Error loading HPG hot list from storage:', e);
            }
        }
    },

    /**
     * Reset to default mock data
     */
    resetToDefault: function() {
        localStorage.removeItem('hpgHotList');
        // Reload page to reset
        location.reload();
    },

    /**
     * Initialize database
     */
    init: function() {
        this.loadFromStorage();
        console.log('🚔 HPG Database initialized with', this.hotList.length, 'hot list entries');
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    HPGDatabase.init();
}

