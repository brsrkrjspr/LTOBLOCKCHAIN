// Script to check and fix missing blockchain transaction IDs for transferred vehicles
// This checks vehicle_history and transfer_requests for blockchain_tx_id and updates vehicles table

const db = require('../database/db');
const { VEHICLE_STATUS } = require('../config/statusConstants');

function isValidFabricTxId(txId) {
    return typeof txId === 'string' && /^[a-f0-9]{64}$/i.test(txId);
}

async function checkAndFixTransferredVehicleTxIds() {
    try {
        console.log('🔍 Checking transferred vehicles for blockchain transaction IDs...\n');
        
        // First, check if blockchain_tx_id column exists, add it if missing
        try {
            const columnCheck = await db.query(
                `SELECT column_name 
                 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' 
                   AND column_name = 'blockchain_tx_id'`
            );
            
            if (columnCheck.rows.length === 0) {
                console.log('⚠️  Column blockchain_tx_id does not exist. Adding it...');
                await db.query(
                    `ALTER TABLE vehicles 
                     ADD COLUMN IF NOT EXISTS blockchain_tx_id VARCHAR(255)`
                );
                console.log('✅ Added blockchain_tx_id column to vehicles table\n');
            }
        } catch (alterError) {
            console.warn('⚠️  Could not add blockchain_tx_id column:', alterError.message);
            // Continue anyway - we'll handle missing column gracefully
        }
        
        // Find vehicles that were transferred (have OWNERSHIP_TRANSFERRED history or origin_type = TRANSFER)
        // Check if column exists first, then query accordingly
        let vehiclesResult;
        try {
            vehiclesResult = await db.query(
                `SELECT v.id, v.vin, v.plate_number, v.status, 
                        v.blockchain_tx_id, 
                        v.origin_type
                 FROM vehicles v
                 WHERE v.origin_type = 'TRANSFER' 
                    OR v.id IN (
                        SELECT DISTINCT vehicle_id 
                        FROM vehicle_history 
                        WHERE action = 'OWNERSHIP_TRANSFERRED'
                    )
                 ORDER BY v.last_updated DESC`
            );
        } catch (columnError) {
            // Column doesn't exist - query without it
            console.log('⚠️  Column blockchain_tx_id not found, querying without it...');
            vehiclesResult = await db.query(
                `SELECT v.id, v.vin, v.plate_number, v.status, 
                        NULL as blockchain_tx_id, 
                        v.origin_type
                 FROM vehicles v
                 WHERE v.origin_type = 'TRANSFER' 
                    OR v.id IN (
                        SELECT DISTINCT vehicle_id 
                        FROM vehicle_history 
                        WHERE action = 'OWNERSHIP_TRANSFERRED'
                    )
                 ORDER BY v.last_updated DESC`
            );
        }
        
        if (vehiclesResult.rows.length === 0) {
            console.log('✅ No transferred vehicles found');
            return { checked: 0, fixed: 0, vehicles: [] };
        }
        
        console.log(`📋 Found ${vehiclesResult.rows.length} transferred vehicle(s)\n`);
        
        const results = [];
        let fixedCount = 0;
        
        for (const vehicle of vehiclesResult.rows) {
            console.log(`\n🔍 Checking vehicle: ${vehicle.vin || vehicle.id}`);
            console.log(`   Plate: ${vehicle.plate_number || 'N/A'}`);
            console.log(`   Current blockchain_tx_id: ${vehicle.blockchain_tx_id || 'NULL'}`);
            
            let foundTxId = vehicle.blockchain_tx_id;
            let source = 'vehicles table';

            // Ignore legacy/non-Fabric IDs stored in vehicles table
            if (foundTxId && !isValidFabricTxId(foundTxId)) {
                foundTxId = null;
                source = null;
            }
            
            // If not in vehicles table, check vehicle_history
            if (!foundTxId) {
                const historyResult = await db.query(
                    `SELECT transaction_id, metadata
                     FROM vehicle_history
                     WHERE vehicle_id = $1 
                       AND action = 'OWNERSHIP_TRANSFERRED'
                     ORDER BY performed_at DESC
                     LIMIT 1`,
                    [vehicle.id]
                );
                
                if (historyResult.rows.length > 0) {
                    const history = historyResult.rows[0];
                    foundTxId = history.transaction_id;
                    
                    // Also check metadata
                    if (!foundTxId && history.metadata) {
                        try {
                            const metadata = typeof history.metadata === 'string' 
                                ? JSON.parse(history.metadata) 
                                : history.metadata;
                            foundTxId = metadata.blockchainTxId || metadata.blockchain_tx_id;
                        } catch (e) {
                            // Metadata parse error - ignore
                        }
                    }

                    if (foundTxId && !isValidFabricTxId(foundTxId)) {
                        foundTxId = null;
                    }
                    
                    if (foundTxId) {
                        source = 'vehicle_history';
                    }
                }
            }
            
            // If still not found, check transfer_requests metadata
            if (!foundTxId) {
                const transferResult = await db.query(
                    `SELECT metadata
                     FROM transfer_requests
                     WHERE vehicle_id = $1 
                       AND status = 'COMPLETED'
                     ORDER BY updated_at DESC
                     LIMIT 1`,
                    [vehicle.id]
                );
                
                if (transferResult.rows.length > 0) {
                    const transfer = transferResult.rows[0];
                    if (transfer.metadata) {
                        try {
                            const metadata = typeof transfer.metadata === 'string' 
                                ? JSON.parse(transfer.metadata) 
                                : transfer.metadata;
                            foundTxId = metadata.blockchainTxId || metadata.blockchain_tx_id;
                            if (foundTxId && !isValidFabricTxId(foundTxId)) {
                                foundTxId = null;
                            }
                            if (foundTxId) {
                                source = 'transfer_requests metadata';
                            }
                        } catch (e) {
                            // Metadata parse error - ignore
                        }
                    }
                }
            }
            
            if (foundTxId) {
                const isValid = isValidFabricTxId(foundTxId);
                if (!isValid) {
                    console.log(`   Skipping non-Fabric TX ID: ${foundTxId} (from ${source})`);
                    results.push({
                        vehicleId: vehicle.id,
                        vin: vehicle.vin,
                        plateNumber: vehicle.plate_number,
                        blockchainTxId: foundTxId,
                        source: source,
                        wasMissing: !vehicle.blockchain_tx_id,
                        fixed: false,
                        skipped: true,
                        reason: 'invalid_format'
                    });
                    continue;
                }

                console.log(`   ✅ Found TX ID: ${foundTxId} (from ${source})`);
                
                // Update vehicles table if missing
                if (!vehicle.blockchain_tx_id) {
                    try {
                        // Ensure column exists before updating
                        const columnExists = await db.query(
                            `SELECT column_name 
                             FROM information_schema.columns 
                             WHERE table_name = 'vehicles' 
                               AND column_name = 'blockchain_tx_id'`
                        );
                        
                        if (columnExists.rows.length === 0) {
                            await db.query(
                                `ALTER TABLE vehicles 
                                 ADD COLUMN IF NOT EXISTS blockchain_tx_id VARCHAR(255)`
                            );
                            console.log(`   ✅ Added blockchain_tx_id column`);
                        }
                        
                        await db.query(
                            `UPDATE vehicles 
                             SET blockchain_tx_id = $1, 
                                 last_updated = CURRENT_TIMESTAMP
                             WHERE id = $2`,
                            [foundTxId, vehicle.id]
                        );
                        console.log(`   ✅ Updated vehicles.blockchain_tx_id`);
                        fixedCount++;
                    } catch (error) {
                        console.error(`   ❌ Failed to update: ${error.message}`);
                    }
                } else {
                    console.log(`   ℹ️  Already in vehicles table - no update needed`);
                }
                
                results.push({
                    vehicleId: vehicle.id,
                    vin: vehicle.vin,
                    plateNumber: vehicle.plate_number,
                    blockchainTxId: foundTxId,
                    source: source,
                    wasMissing: !vehicle.blockchain_tx_id,
                    fixed: !vehicle.blockchain_tx_id
                });
            } else {
                console.log(`   ⚠️  No blockchain transaction ID found`);
                console.log(`   ℹ️  This vehicle may have been transferred before blockchain integration`);
                
                results.push({
                    vehicleId: vehicle.id,
                    vin: vehicle.vin,
                    plateNumber: vehicle.plate_number,
                    blockchainTxId: null,
                    source: null,
                    wasMissing: true,
                    fixed: false
                });
            }
        }
        
        console.log(`\n\n📊 Summary:`);
        console.log(`   Total vehicles checked: ${vehiclesResult.rows.length}`);
        console.log(`   Vehicles with TX ID: ${results.filter(r => r.blockchainTxId).length}`);
        console.log(`   Vehicles fixed: ${fixedCount}`);
        console.log(`   Vehicles still missing TX ID: ${results.filter(r => !r.blockchainTxId).length}`);
        
        return {
            checked: vehiclesResult.rows.length,
            fixed: fixedCount,
            vehicles: results
        };
        
    } catch (error) {
        console.error('❌ Error checking transferred vehicles:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    // Load environment variables
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env');
    try {
        require('dotenv').config({ path: envPath });
        console.log(`📋 Loaded environment variables from: ${envPath}`);
    } catch (error) {
        console.warn(`⚠️ Could not load .env file from ${envPath}, using system environment variables`);
        require('dotenv').config();
    }
    
    checkAndFixTransferredVehicleTxIds()
        .then(result => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { checkAndFixTransferredVehicleTxIds };
