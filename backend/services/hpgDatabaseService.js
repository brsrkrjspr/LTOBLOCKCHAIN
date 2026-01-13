// TrustChain LTO - HPG Database Service
// Provides automated checking against HPG hot list database

const db = require('../database/db');

class HPGDatabaseService {
    /**
     * Check vehicle against HPG hot list database
     * @param {Object} vehicleData - Vehicle details to check
     * @param {string} vehicleData.plateNumber - Plate number
     * @param {string} vehicleData.engineNumber - Engine number
     * @param {string} vehicleData.chassisNumber - Chassis number
     * @param {string} vehicleData.vin - VIN number
     * @returns {Promise<Object>} Check result with status and details
     */
    async checkVehicle(vehicleData) {
        try {
            const { plateNumber, engineNumber, chassisNumber, vin } = vehicleData;
            
            // Normalize inputs for comparison
            const normalizedPlate = (plateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
            const normalizedEngine = (engineNumber || '').toUpperCase().replace(/\s+/g, '').trim();
            const normalizedChassis = (chassisNumber || '').toUpperCase().replace(/\s+/g, '').trim();
            const normalizedVin = (vin || '').toUpperCase().replace(/\s+/g, '').trim();

            console.log(`[HPG DB] Checking vehicle:`, { normalizedPlate, normalizedEngine, normalizedChassis, normalizedVin });

            // Check against HPG hot list (stolen/carnapped vehicles)
            // In production, this would connect to actual HPG database API
            // For now, we'll use a mock check that can be replaced with real API call
            
            const hotListResult = await this.checkHotList({
                plateNumber: normalizedPlate,
                engineNumber: normalizedEngine,
                chassisNumber: normalizedChassis,
                vin: normalizedVin
            });

            // Store check result
            const checkResult = {
                checkedAt: new Date().toISOString(),
                status: hotListResult.status, // 'CLEAN', 'FLAGGED', 'ERROR'
                details: hotListResult.details,
                matchedRecords: hotListResult.matchedRecords || [],
                recommendation: hotListResult.recommendation || 'MANUAL_REVIEW'
            };

            // Auto-reject if vehicle is flagged
            if (hotListResult.status === 'FLAGGED') {
                checkResult.recommendation = 'AUTO_REJECT';
                checkResult.rejectionReason = hotListResult.reason || 'Vehicle found in HPG hot list';
            } else if (hotListResult.status === 'CLEAN') {
                // For clean vehicles, can proceed with auto-approval if other criteria met
                checkResult.recommendation = 'PROCEED';
            }

            console.log(`[HPG DB] Check result:`, checkResult);

            return checkResult;
        } catch (error) {
            console.error('[HPG DB] Error checking vehicle:', error);
            return {
                checkedAt: new Date().toISOString(),
                status: 'ERROR',
                details: 'Database check failed',
                error: error.message,
                recommendation: 'MANUAL_REVIEW'
            };
        }
    }

    /**
     * Check vehicle against HPG hot list
     * This is a mock implementation - replace with actual HPG API call in production
     * @param {Object} vehicleData - Normalized vehicle data
     * @returns {Promise<Object>} Hot list check result
     */
    async checkHotList(vehicleData) {
        // TODO: Replace with actual HPG API call
        // Example: await fetch('https://hpg-api.gov.ph/hotlist/check', { ... })
        
        // For now, use mock data from hpg-database.js logic
        // In production, this would be an HTTP call to HPG's database API
        
        const mockHotList = [
            {
                plateNumber: 'ABC-1234',
                engineNumber: 'STOLEN001',
                chassisNumber: 'STOLENCHS001',
                reason: 'Stolen vehicle',
                reportedDate: '2024-01-15',
                reportedBy: 'PNP NCR'
            },
            {
                plateNumber: 'XYZ-5678',
                engineNumber: 'CARN001',
                chassisNumber: 'CARNCHS001',
                reason: 'Carnapped vehicle',
                reportedDate: '2024-02-20',
                reportedBy: 'HPG NCR'
            }
        ];

        // Check for matches
        const matchedRecords = mockHotList.filter(record => {
            const recordPlate = (record.plateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim();
            const recordEngine = (record.engineNumber || '').toUpperCase().replace(/\s+/g, '').trim();
            const recordChassis = (record.chassisNumber || '').toUpperCase().replace(/\s+/g, '').trim();

            return (vehicleData.plateNumber && recordPlate === vehicleData.plateNumber) ||
                   (vehicleData.engineNumber && recordEngine === vehicleData.engineNumber) ||
                   (vehicleData.chassisNumber && recordChassis === vehicleData.chassisNumber);
        });

        if (matchedRecords.length > 0) {
            return {
                status: 'FLAGGED',
                details: `Vehicle found in HPG hot list. ${matchedRecords.length} matching record(s) found.`,
                matchedRecords: matchedRecords,
                reason: matchedRecords.map(r => r.reason).join('; ')
            };
        }

        return {
            status: 'CLEAN',
            details: 'Vehicle not found in HPG hot list',
            matchedRecords: []
        };
    }

    /**
     * Store database check result in clearance request metadata
     * @param {string} clearanceRequestId - Clearance request ID
     * @param {Object} checkResult - Check result
     */
    async storeCheckResult(clearanceRequestId, checkResult) {
        try {
            // Get current metadata
            const result = await db.query(
                'SELECT metadata FROM clearance_requests WHERE id = $1',
                [clearanceRequestId]
            );

            if (result.rows.length === 0) {
                throw new Error('Clearance request not found');
            }

            const currentMetadata = result.rows[0].metadata || {};
            const updatedMetadata = {
                ...currentMetadata,
                hpgDatabaseCheck: checkResult,
                hpgDatabaseCheckedAt: new Date().toISOString()
            };

            // Update metadata
            await db.query(
                'UPDATE clearance_requests SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [JSON.stringify(updatedMetadata), clearanceRequestId]
            );

            console.log(`[HPG DB] Stored check result for clearance request ${clearanceRequestId}`);
        } catch (error) {
            console.error('[HPG DB] Error storing check result:', error);
            throw error;
        }
    }
}

module.exports = new HPGDatabaseService();
