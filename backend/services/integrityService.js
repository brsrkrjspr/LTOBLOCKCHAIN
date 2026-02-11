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

            let peerConsensus = null;
            let peerDiscrepancies = [];

            if (dbVehicle.status === 'REGISTERED') {
                try {
                    const multiPeerEnabled = String(process.env.INTEGRITY_MULTI_PEER || 'false').toLowerCase() === 'true';
                    if (multiPeerEnabled) {
                        const blockchainResult = await fabricService.getVehicleFromAllPeers(vin);
                        if (blockchainResult.success && blockchainResult.vehicle) {
                            blockchainVehicle = blockchainResult.vehicle;
                            peerConsensus = blockchainResult.consensus;
                            peerDiscrepancies = blockchainResult.discrepancies;
                        }
                    } else {
                        const blockchainResult = await fabricService.getVehicle(vin);
                        if (blockchainResult.success && blockchainResult.vehicle) {
                            blockchainVehicle = blockchainResult.vehicle;
                        }
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
                const dbValue = dbVehicle[field.dbKey];
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
                peerConsensus: peerConsensus,
                peerDiscrepancies: peerDiscrepancies,
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

    // New: Batch check for all registered vehicles (The "Watchdog" Logic)
    async runForensicAudit(autoHeal = false) {
        console.log(`🕵️ Integrity Watchdog: Starting global forensic audit (Auto-Heal: ${autoHeal})...`);
        const startTime = Date.now();

        try {
            // 1. Get all registered vehicles from DB
            const vehicles = await db.getAllVehicles();
            const registeredVehicles = vehicles.filter(v => v.status === 'REGISTERED');

            console.log(`🕵️ Auditing ${registeredVehicles.length} vehicles...`);

            const results = {
                totalChecked: registeredVehicles.length,
                verified: 0,
                tampered: [],
                restored: 0,
                errors: 0,
                duration: 0
            };

            for (const vehicle of registeredVehicles) {
                const audit = await this.checkIntegrityByVin(vehicle.vin);

                if (audit.status === 'VERIFIED') {
                    results.verified++;
                } else if (audit.status === 'TAMPERED') {
                    console.error(`🚨 ALERT: Tampering detected for VIN: ${vehicle.vin}`);

                    if (autoHeal) {
                        console.log(`🛠️ Watchdog: Attempting auto-healing for ${vehicle.vin}...`);
                        const restored = await this.restoreVehicleFromBlockchain(vehicle.vin, audit.blockchainVehicle);
                        if (restored) {
                            results.restored++;
                            console.log(`✅ Watchdog: SUCCESSFULLY restored ${vehicle.vin} to on-chain truth.`);
                        }
                    }

                    results.tampered.push({
                        vin: vehicle.vin,
                        owner: vehicle.owner_email,
                        mismatches: audit.comparisons.filter(c => !c.matches).map(c => c.label),
                        restored: autoHeal && results.restored > 0
                    });
                } else if (audit.status === 'ERROR') {
                    results.errors++;
                }
            }

            results.duration = (Date.now() - startTime) / 1000;
            console.log(`🕵️ Global audit complete in ${results.duration}s. [Verified: ${results.verified}, Tampered: ${results.tampered.length}, Restored: ${results.restored}]`);

            return results;
        } catch (error) {
            console.error('❌ Global forensic audit failed:', error);
            throw error;
        }
    }

    // New: Restore Database record from Blockchain Truth
    async restoreVehicleFromBlockchain(vin, blockchainVehicle) {
        try {
            const dbModule = require('../database/db');

            return await dbModule.transaction(async (client) => {
                // 1. Get owner ID from email (since blockchain stores email)
                let ownerId = null;

                if (blockchainVehicle.ownerEmail) {
                    const userResult = await client.query(
                        'SELECT id FROM users WHERE email = $1',
                        [blockchainVehicle.ownerEmail]
                    );

                    if (userResult.rows.length === 0) {
                        console.warn(`⚠️ Restoration: Owner ${blockchainVehicle.ownerEmail} not found in DB. Keeping existing owner_id.`);
                    } else {
                        ownerId = userResult.rows[0].id;
                    }
                } else {
                    console.warn('⚠️ Restoration: Blockchain owner email missing. Keeping existing owner_id.');
                }

                // 2. Perform the restoration (Update DB to match Blockchain)
                await client.query(
                    `UPDATE vehicles 
                     SET owner_id = COALESCE($1, owner_id), 
                         plate_number = $2, 
                         engine_number = $3, 
                         chassis_number = $4,
                         make = $5,
                         model = $6,
                         year = $7,
                         last_updated = NOW()
                     WHERE vin = $8`,
                    [
                        ownerId,
                        blockchainVehicle.plateNumber,
                        blockchainVehicle.engineNumber,
                        blockchainVehicle.chassisNumber,
                        blockchainVehicle.make,
                        blockchainVehicle.model,
                        blockchainVehicle.year,
                        vin
                    ]
                );

                // 3. Log the restoration event in history
                await client.query(
                    `INSERT INTO vehicle_history (vehicle_id, action, performed_by, description, performed_at)
                     SELECT id, 'SELF_HEAL_RESTORED', 'SYSTEM', 'Automated watchdog restored record from blockchain truth.', NOW()
                     FROM vehicles WHERE vin = $1`,
                    [vin]
                );

                return true;
            });
        } catch (error) {
            console.error(`❌ Failed to restore vehicle ${vin}:`, error);
            return false;
        }
    }

    // Get status message

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
