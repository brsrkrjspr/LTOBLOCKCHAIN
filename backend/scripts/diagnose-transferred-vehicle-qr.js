// Script to diagnose why QR code is not showing for transferred vehicle
// Checks: 1) Column exists, 2) Vehicle has blockchain_tx_id, 3) Transaction ID format

const db = require('../database/db');
const path = require('path');

function isValidFabricTxId(txId) {
    return typeof txId === 'string' && /^[a-f0-9]{64}$/i.test(txId);
}

async function diagnoseTransferredVehicle() {
    try {
        console.log('🔍 Diagnosing transferred vehicle QR code issue...\n');
        
        // Load environment variables
        const envPath = path.join(__dirname, '../../.env');
        try {
            require('dotenv').config({ path: envPath });
            console.log(`📋 Loaded environment variables from: ${envPath}`);
        } catch (error) {
            console.warn(`⚠️ Could not load .env file, using system environment variables`);
            require('dotenv').config();
        }
        
        // Step 1: Check if blockchain_tx_id column exists
        console.log('\n📊 Step 1: Checking if blockchain_tx_id column exists...');
        const columnCheck = await db.query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'vehicles' 
               AND column_name = 'blockchain_tx_id'`
        );
        
        if (columnCheck.rows.length === 0) {
            console.log('❌ Column blockchain_tx_id does NOT exist in vehicles table');
            console.log('   → Need to run migration: database/migrations/add-blockchain-tx-id-to-vehicles.sql');
            console.log('   → Or run: node backend/scripts/check-transferred-vehicle-txids.js (it will add the column)');
            return;
        } else {
            console.log(`✅ Column exists: ${columnCheck.rows[0].column_name} (${columnCheck.rows[0].data_type})`);
        }
        
        // Step 2: Find transferred vehicles
        console.log('\n📊 Step 2: Finding transferred vehicles...');
        const transferredVehicles = await db.query(
            `SELECT v.id, v.vin, v.plate_number, v.status, v.origin_type, 
                    v.blockchain_tx_id,
                    COUNT(vh.id) as history_count
             FROM vehicles v
             LEFT JOIN vehicle_history vh ON v.id = vh.vehicle_id
             WHERE v.origin_type = 'TRANSFER'
             GROUP BY v.id, v.vin, v.plate_number, v.status, v.origin_type, v.blockchain_tx_id
             ORDER BY v.last_updated DESC`
        );
        
        if (transferredVehicles.rows.length === 0) {
            console.log('⚠️  No transferred vehicles found (origin_type = TRANSFER)');
            return;
        }
        
        console.log(`\n📋 Found ${transferredVehicles.rows.length} transferred vehicle(s):\n`);
        
        // Step 3: Check each vehicle
        for (const vehicle of transferredVehicles.rows) {
            console.log(`\n🚗 Vehicle: ${vehicle.vin || vehicle.id}`);
            console.log(`   Plate: ${vehicle.plate_number || 'N/A'}`);
            console.log(`   Status: ${vehicle.status}`);
            console.log(`   blockchain_tx_id: ${vehicle.blockchain_tx_id || 'NULL'}`);
            
            // Check transaction ID format
            if (vehicle.blockchain_tx_id) {
                const txId = vehicle.blockchain_tx_id;
                const hasHyphens = txId.includes('-');
                const length = txId.length;
                const isValidFormat = isValidFabricTxId(txId);
                
                console.log(`   Format check:`);
                console.log(`     - Has hyphens: ${hasHyphens} ${hasHyphens ? '❌ (Invalid - looks like UUID)' : '✅'}`);
                console.log(`     - Length: ${length} ${length === 64 ? '✅' : '❌ (Must be 64)'}`);
                console.log(`     - Valid for QR: ${isValidFormat ? '✅' : '❌'}`);
                
                if (!isValidFormat) {
                    console.log(`   ⚠️  Transaction ID format is invalid for QR code generation`);
                }
            } else {
                console.log(`   ❌ No blockchain_tx_id found`);
                
                // Check vehicle_history
                console.log(`   🔍 Checking vehicle_history...`);
                const history = await db.query(
                    `SELECT action, transaction_id, performed_at
                     FROM vehicle_history
                     WHERE vehicle_id = $1
                       AND action = 'OWNERSHIP_TRANSFERRED'
                     ORDER BY performed_at DESC
                     LIMIT 1`,
                    [vehicle.id]
                );
                
                if (history.rows.length > 0 && history.rows[0].transaction_id) {
                    const txId = history.rows[0].transaction_id;
                    console.log(`   ✅ Found transaction_id in history: ${txId.substring(0, 20)}...`);
                    console.log(`   → Need to copy this to vehicles.blockchain_tx_id`);
                    
                    // Check format
                    const hasHyphens = txId.includes('-');
                    const length = txId.length;
                    const isValidFormat = isValidFabricTxId(txId);
                    
                    if (isValidFormat) {
                        console.log(`   ✅ Format is valid - can be used for QR code`);
                        console.log(`   💡 Run: node backend/scripts/check-transferred-vehicle-txids.js to fix`);
                    } else {
                        console.log(`   ⚠️  Format is invalid (has hyphens: ${hasHyphens}, length: ${length})`);
                    }
                } else {
                    console.log(`   ❌ No OWNERSHIP_TRANSFERRED history entry found`);
                }
                
                // Check transfer_requests metadata
                console.log(`   🔍 Checking transfer_requests metadata...`);
                const transfer = await db.query(
                    `SELECT metadata, status
                     FROM transfer_requests
                     WHERE vehicle_id = $1
                       AND status = 'COMPLETED'
                     ORDER BY updated_at DESC
                     LIMIT 1`,
                    [vehicle.id]
                );
                
                if (transfer.rows.length > 0 && transfer.rows[0].metadata) {
                    try {
                        const metadata = typeof transfer.rows[0].metadata === 'string' 
                            ? JSON.parse(transfer.rows[0].metadata) 
                            : transfer.rows[0].metadata;
                        
                        if (metadata.blockchainTxId || metadata.blockchain_tx_id) {
                            const txId = metadata.blockchainTxId || metadata.blockchain_tx_id;
                            console.log(`   ✅ Found blockchainTxId in metadata: ${txId.substring(0, 20)}...`);
                            console.log(`   → Need to copy this to vehicles.blockchain_tx_id`);
                            console.log(`   💡 Run: node backend/scripts/check-transferred-vehicle-txids.js to fix`);
                        } else {
                            console.log(`   ❌ No blockchainTxId in transfer_requests metadata`);
                        }
                    } catch (e) {
                        console.log(`   ⚠️  Could not parse metadata: ${e.message}`);
                    }
                } else {
                    console.log(`   ❌ No COMPLETED transfer request found`);
                }
            }
        }
        
        console.log(`\n\n📊 Summary:`);
        console.log(`   Total transferred vehicles: ${transferredVehicles.rows.length}`);
        const withTxId = transferredVehicles.rows.filter(v => v.blockchain_tx_id).length;
        const validTxId = transferredVehicles.rows.filter(v => {
            if (!v.blockchain_tx_id) return false;
            const txId = v.blockchain_tx_id;
            return isValidFabricTxId(txId);
        }).length;
        
        console.log(`   Vehicles with blockchain_tx_id: ${withTxId}`);
        console.log(`   Vehicles with valid format: ${validTxId}`);
        console.log(`   Vehicles missing/invalid: ${transferredVehicles.rows.length - validTxId}`);
        
        if (validTxId < transferredVehicles.rows.length) {
            console.log(`\n💡 To fix missing transaction IDs:`);
            console.log(`   Run: node backend/scripts/check-transferred-vehicle-txids.js`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    diagnoseTransferredVehicle()
        .then(() => {
            console.log('\n✅ Diagnosis complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { diagnoseTransferredVehicle };
