// TrustChain LTO - Blockchain Integrity Monitor Service
// Cross-checks data between PostgreSQL and Hyperledger Fabric World State

const db = require('../database/services');
const fabricService = require('./optimizedFabricService');

class IntegrityService {
    constructor() {
        // Field mapping: Database (snake_case) → Blockchain (camelCase)
        this.fieldMap = [
            {
                dbKey: 'engine_number',
                blockchainKey: 'engineNumber',
                label: 'Engine Number',
                critical: true
            },
            {
                dbKey: 'chassis_number',
                blockchainKey: 'chassisNumber',
                label: 'Chassis Number',
                critical: true
            },
            {
                dbKey: 'plate_number',
                blockchainKey: 'plateNumber',
                label: 'Plate Number',
                critical: true
            },
            {
                dbKey: 'make',
                blockchainKey: 'make',
                label: 'Make',
                critical: false
            },
            {
                dbKey: 'model',
                blockchainKey: 'model',
                label: 'Model',
                critical: false
            },
            {
                dbKey: 'year',
                blockchainKey: 'year',
                label: 'Year',
                critical: false
            },
            {
                dbKey: 'owner_email',
                blockchainKey: 'owner.email',
                label: 'Owner Identity',
                critical: true
            }
        ];
    }

    // Helper to get nested value from object using dot notation
    getNestedValue(obj, key) {
        if (!obj || !key) return null;
        if (!key.includes('.')) return obj[key];

        return key.split('.').reduce((o, i) => (o ? o[i] : null), obj);
    }

    // Normalize value for comparison
    normalize(value) {
        if (value === null || value === undefined || value === '') {
            return '';
        }
        return String(value).trim();
    }

    // Compare two values (case-insensitive for critical fields)
    compareValues(dbValue, blockchainValue, isCritical) {
        const normalized = {
            db: this.normalize(dbValue),
            blockchain: this.normalize(blockchainValue)
        };

        if (isCritical) {
            // Critical fields: case-insensitive comparison
            return normalized.db.toUpperCase() === normalized.blockchain.toUpperCase();
        }

        // Non-critical fields: case-sensitive comparison
        return normalized.db === normalized.blockchain;
    }

    // Check integrity for a vehicle by VIN
    async checkIntegrityByVin(vin) {
        try {
            // Step 1: Get vehicle from database
            const dbVehicle = await db.getVehicleByVin(vin);

            if (!dbVehicle) {
                return {
                    status: 'ERROR',
                    message: 'Vehicle not found in database',
                    vin: vin,
                    comparisons: [],
                    dbVehicle: null,
                    blockchainVehicle: null
                };
            }

            // Step 2: Get vehicle from blockchain (only if vehicle is REGISTERED)
            // Vehicles in SUBMITTED/APPROVED status are not yet on blockchain
            let blockchainVehicle = null;
            let blockchainError = null;

            if (dbVehicle.status === 'REGISTERED') {
                try {
                    const blockchainResult = await fabricService.getVehicle(vin);
                    if (blockchainResult.success && blockchainResult.vehicle) {
                        blockchainVehicle = blockchainResult.vehicle;
                    }
                } catch (error) {
                    blockchainError = error.message;
                    console.warn(`⚠️ Blockchain query failed for VIN ${vin}:`, error.message);
                }
            } else {
                // Vehicle is not REGISTERED yet - skip blockchain query
                blockchainError = `Vehicle status is ${dbVehicle.status}, not yet registered on blockchain`;
            }

            // Step 3: Compare fields
            const comparisons = [];
            let allMatch = true;
            let criticalMismatch = false;

            if (!blockchainVehicle) {
                const hasOwner = !!dbVehicle.owner_id;
                return {
                    status: hasOwner ? 'PENDING_BLOCKCHAIN' : 'NOT_REGISTERED',
                    message: hasOwner
                        ? 'Vehicle has an owner but is not yet registered on blockchain'
                        : 'Vehicle not registered on blockchain',
                    vin: vin,
                    comparisons: [],
                    dbVehicle: {
                        vin: dbVehicle.vin,
                        plateNumber: dbVehicle.plate_number,
                        engineNumber: dbVehicle.engine_number,
                        chassisNumber: dbVehicle.chassis_number,
                        make: dbVehicle.make,
                        model: dbVehicle.model,
                        year: dbVehicle.year,
                        ownerId: dbVehicle.owner_id || null
                    },
                    blockchainVehicle: null,
                    error: blockchainError
                };
            }

            // Compare each field
            for (const field of this.fieldMap) {
                const blockchainValue = this.getNestedValue(blockchainVehicle, field.blockchainKey);
                const matches = this.compareValues(dbValue, blockchainValue, field.critical);

                if (!matches) {
                    allMatch = false;
                    if (field.critical) {
                        criticalMismatch = true;
                    }
                }

                comparisons.push({
                    field: field.dbKey,
                    label: field.label,
                    dbValue: this.normalize(dbValue),
                    blockchainValue: this.normalize(blockchainValue),
                    matches: matches,
                    isCritical: field.critical,
                    status: matches ? 'MATCH' : (field.critical ? 'TAMPERED' : 'MISMATCH')
                });
            }

            // Determine overall status
            let overallStatus;
            if (allMatch) {
                overallStatus = 'VERIFIED';
            } else if (criticalMismatch) {
                overallStatus = 'TAMPERED';
            } else {
                overallStatus = 'MISMATCH';
            }

            // Get blockchain transaction ID from history
            let transactionId = null;
            try {
                const dbModule = require('../database/db');
                const historyResult = await dbModule.query(
                    `SELECT transaction_id, performed_at 
                     FROM vehicle_history 
                     WHERE vehicle_id = $1 
                     AND transaction_id IS NOT NULL 
                     AND action = 'BLOCKCHAIN_REGISTERED'
                     ORDER BY performed_at DESC 
                     LIMIT 1`,
                    [dbVehicle.id]
                );
                if (historyResult.rows.length > 0) {
                    transactionId = historyResult.rows[0].transaction_id;
                }
            } catch (error) {
                console.warn('Could not fetch transaction ID from history:', error);
            }

            return {
                status: overallStatus,
                message: this.getStatusMessage(overallStatus),
                vin: vin,
                vehicleId: dbVehicle.id,
                transactionId: transactionId,
                comparisons: comparisons,
                dbVehicle: {
                    vin: dbVehicle.vin,
                    plateNumber: dbVehicle.plate_number,
                    engineNumber: dbVehicle.engine_number,
                    chassisNumber: dbVehicle.chassis_number,
                    make: dbVehicle.make,
                    model: dbVehicle.model,
                    year: dbVehicle.year,
                    ownerEmail: dbVehicle.owner_email
                },
                blockchainVehicle: {
                    vin: blockchainVehicle.vin,
                    plateNumber: blockchainVehicle.plateNumber,
                    engineNumber: blockchainVehicle.engineNumber,
                    chassisNumber: blockchainVehicle.chassisNumber,
                    make: blockchainVehicle.make,
                    model: blockchainVehicle.model,
                    year: blockchainVehicle.year,
                    ownerEmail: blockchainVehicle.owner ? blockchainVehicle.owner.email : null
                },
                checkedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Integrity check error:', error);
            return {
                status: 'ERROR',
                message: `Integrity check failed: ${error.message}`,
                vin: vin,
                comparisons: [],
                dbVehicle: null,
                blockchainVehicle: null,
                error: error.message
            };
        }
    }

    // Check integrity for a vehicle by ID
    async checkIntegrityById(vehicleId) {
        try {
            const dbVehicle = await db.getVehicleById(vehicleId);

            if (!dbVehicle) {
                return {
                    status: 'ERROR',
                    message: 'Vehicle not found in database',
                    vehicleId: vehicleId,
                    comparisons: [],
                    dbVehicle: null,
                    blockchainVehicle: null
                };
            }

            return await this.checkIntegrityByVin(dbVehicle.vin);
        } catch (error) {
            console.error('❌ Integrity check by ID error:', error);
            return {
                status: 'ERROR',
                message: `Integrity check failed: ${error.message}`,
                vehicleId: vehicleId,
                comparisons: [],
                dbVehicle: null,
                blockchainVehicle: null,
                error: error.message
            };
        }
    }

    // Get status message
    getStatusMessage(status) {
        const messages = {
            'VERIFIED': 'All fields match between database and blockchain',
            'TAMPERED': 'Critical fields mismatch detected - potential data tampering',
            'MISMATCH': 'Non-critical fields differ, but critical fields match',
            'NOT_REGISTERED': 'Vehicle not registered on blockchain',
            'ERROR': 'Error during integrity check'
        };
        return messages[status] || 'Unknown status';
    }
}

// Export singleton instance
const integrityService = new IntegrityService();
module.exports = integrityService;
