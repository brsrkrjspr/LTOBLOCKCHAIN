// Enhanced diagnostic script to check why transferred vehicle has no blockchain TX ID
// Checks: vehicle_history, transfer_requests, and provides actionable fixes

const db = require('../database/db');
const path = require('path');

function isValidFabricTxId(txId) {
    return typeof txId === 'string' && /^[a-f0-9]{64}$/i.test(txId);
}

async function diagnoseTransferredVehicleDetailed() {
    try {
        console.log('🔍 Detailed diagnosis of transferred vehicle QR code issue...\n');
        
        // Load environment variables
        const envPath = path.join(__dirname, '../../.env');
        try {
            require('dotenv').config({ path: envPath });
            console.log(`📋 Loaded environment variables from: ${envPath}`);
        } catch (error) {
            require('dotenv').config();
        }
        
        // Find the transferred vehicle
        const vehicle = await db.query(
            `SELECT v.id, v.vin, v.plate_number, v.status, v.origin_type, 
                    v.blockchain_tx_id, v.owner_id, v.last_updated
             FROM vehicles v
             WHERE v.origin_type = 'TRANSFER'
             ORDER BY v.last_updated DESC
             LIMIT 1`
        );
        
        if (vehicle.rows.length === 0) {
            console.log('❌ No transferred vehicles found');
            return;
        }
        
        const v = vehicle.rows[0];
        console.log(`\n🚗 Vehicle Details:`);
        console.log(`   VIN: ${v.vin}`);
        console.log(`   Plate: ${v.plate_number || 'N/A'}`);
        console.log(`   Status: ${v.status}`);
        console.log(`   blockchain_tx_id: ${v.blockchain_tx_id || 'NULL'}`);
        console.log(`   Last Updated: ${v.last_updated}`);
        
        // Check vehicle_history for OWNERSHIP_TRANSFERRED
        console.log(`\n📜 Checking vehicle_history...`);
        const history = await db.query(
            `SELECT action, transaction_id, performed_at, performed_by, description, metadata
             FROM vehicle_history
             WHERE vehicle_id = $1
               AND action = 'OWNERSHIP_TRANSFERRED'
             ORDER BY performed_at DESC`,
            [v.id]
        );
        
        if (history.rows.length > 0) {
            console.log(`   ✅ Found ${history.rows.length} OWNERSHIP_TRANSFERRED entry(ies):`);
            history.rows.forEach((h, idx) => {
                console.log(`\n   Entry ${idx + 1}:`);
                console.log(`     Action: ${h.action}`);
                console.log(`     Transaction ID: ${h.transaction_id || 'NULL'}`);
                console.log(`     Performed At: ${h.performed_at}`);
                console.log(`     Performed By: ${h.performed_by || 'NULL'}`);
                console.log(`     Description: ${h.description || 'N/A'}`);
                
                if (h.transaction_id) {
                    const txId = h.transaction_id;
                    const isValid = isValidFabricTxId(txId);
                    console.log(`     Format: ${isValid ? '✅ Valid' : '❌ Invalid'} (length: ${txId.length}, has hyphens: ${txId.includes('-')})`);
                    
                    if (isValid && !v.blockchain_tx_id) {
                        console.log(`     💡 This transaction ID can be copied to vehicles.blockchain_tx_id`);
                    }
                }
                
                if (h.metadata) {
                    try {
                        const meta = typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata;
                        if (meta.blockchainTxId || meta.blockchain_tx_id) {
                            console.log(`     Metadata blockchainTxId: ${meta.blockchainTxId || meta.blockchain_tx_id}`);
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            });
        } else {
            console.log(`   ❌ No OWNERSHIP_TRANSFERRED history entry found`);
        }
        
        // Check transfer_requests
        console.log(`\n📋 Checking transfer_requests...`);
        const transferRequest = await db.query(
            `SELECT id, status, seller_id, buyer_id, metadata, updated_at, reviewed_by
             FROM transfer_requests
             WHERE vehicle_id = $1
             ORDER BY updated_at DESC
             LIMIT 1`,
            [v.id]
        );
        
        if (transferRequest.rows.length > 0) {
            const tr = transferRequest.rows[0];
            console.log(`   ✅ Found transfer request:`);
            console.log(`     ID: ${tr.id}`);
            console.log(`     Status: ${tr.status}`);
            console.log(`     Updated At: ${tr.updated_at}`);
            console.log(`     Reviewed By: ${tr.reviewed_by || 'NULL'}`);
            
            if (tr.metadata) {
                try {
                    const meta = typeof tr.metadata === 'string' ? JSON.parse(tr.metadata) : tr.metadata;
                    console.log(`     Metadata keys: ${Object.keys(meta).join(', ')}`);
                    
                    if (meta.blockchainTxId || meta.blockchain_tx_id) {
                        const txId = meta.blockchainTxId || meta.blockchain_tx_id;
                        console.log(`     ✅ Found blockchainTxId in metadata: ${txId}`);
                        const isValid = isValidFabricTxId(txId);
                        console.log(`     Format: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
                        
                        if (isValid && !v.blockchain_tx_id) {
                            console.log(`     💡 This transaction ID can be copied to vehicles.blockchain_tx_id`);
                        }
                    } else {
                        console.log(`     ❌ No blockchainTxId in metadata`);
                    }
                } catch (e) {
                    console.log(`     ⚠️  Could not parse metadata: ${e.message}`);
                }
            } else {
                console.log(`     ❌ No metadata in transfer request`);
            }
        } else {
            console.log(`   ❌ No transfer request found for this vehicle`);
        }
        
        // Check if Fabric is configured
        console.log(`\n🔗 Checking Fabric configuration...`);
        const fabricMode = process.env.BLOCKCHAIN_MODE;
        console.log(`   BLOCKCHAIN_MODE: ${fabricMode || 'NOT SET'}`);
        
        if (fabricMode !== 'fabric') {
            console.log(`   ⚠️  BLOCKCHAIN_MODE is not 'fabric' - blockchain transfers may not have occurred`);
        }
        
        // Summary and recommendations
        console.log(`\n\n📊 Summary & Recommendations:`);
        
        const hasHistoryTxId = history.rows.some(h => isValidFabricTxId(h.transaction_id));
        const hasTransferTxId = transferRequest.rows.length > 0 && transferRequest.rows[0].metadata && 
            (() => {
                try {
                    const meta = typeof transferRequest.rows[0].metadata === 'string' 
                        ? JSON.parse(transferRequest.rows[0].metadata) 
                        : transferRequest.rows[0].metadata;
                    const txId = meta.blockchainTxId || meta.blockchain_tx_id;
                    return isValidFabricTxId(txId);
                } catch { return false; }
            })();
        
        if (v.blockchain_tx_id) {
            console.log(`   ✅ Vehicle has blockchain_tx_id: ${v.blockchain_tx_id}`);
            const isValid = isValidFabricTxId(v.blockchain_tx_id);
            if (isValid) {
                console.log(`   ✅ Format is valid - QR code should work`);
            } else {
                console.log(`   ❌ Format is invalid - QR code will not generate`);
            }
        } else if (hasHistoryTxId || hasTransferTxId) {
            console.log(`   ⚠️  Vehicle missing blockchain_tx_id but transaction ID found in history/metadata`);
            console.log(`   💡 Run: node backend/scripts/check-transferred-vehicle-txids.js`);
            console.log(`      This will copy the transaction ID to vehicles.blockchain_tx_id`);
        } else {
            console.log(`   ❌ No blockchain transaction ID found anywhere`);
            console.log(`   💡 Possible reasons:`);
            console.log(`      1. Transfer happened before blockchain integration`);
            console.log(`      2. Fabric was not connected during transfer`);
            console.log(`      3. Blockchain transfer failed silently`);
            console.log(`   💡 To fix:`);
            console.log(`      - Check server logs for blockchain transfer errors`);
            console.log(`      - Verify Fabric network is running and connected`);
            console.log(`      - Re-transfer the vehicle if needed`);
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
    diagnoseTransferredVehicleDetailed()
        .then(() => {
            console.log('\n✅ Diagnosis complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { diagnoseTransferredVehicleDetailed };
