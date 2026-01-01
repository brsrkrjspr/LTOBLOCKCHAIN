/**
 * Backfill missing blockchain transaction IDs from Fabric ledger
 * Run once to fix data integrity issues for existing registered vehicles
 * 
 * Usage: node backend/scripts/backfill-blockchain-tx-ids.js
 */

const db = require('../database/db');
const dbServices = require('../database/services');
const fabricService = require('../services/optimizedFabricService');

async function backfillTransactionIds() {
    console.log('🔧 Starting blockchain transaction ID backfill...');
    
    // Ensure we're using real Fabric
    if (fabricService.mode !== 'fabric') {
        console.error('❌ ABORT: Real Hyperledger Fabric connection required. Mock service detected.');
        process.exit(1);
    }
    
    // Ensure Fabric is connected
    if (!fabricService.isConnected) {
        console.log('🔗 Connecting to Fabric network...');
        try {
            await fabricService.initialize();
        } catch (error) {
            console.error('❌ Failed to connect to Fabric:', error.message);
            process.exit(1);
        }
    }
    
    // Find all REGISTERED/APPROVED vehicles without blockchain transaction IDs in history
    const query = `
        SELECT v.id, v.vin, v.plate_number, v.status, v.created_at
        FROM vehicles v 
        WHERE v.status IN ('REGISTERED', 'APPROVED')
        AND NOT EXISTS (
            SELECT 1 FROM vehicle_history vh 
            WHERE vh.vehicle_id = v.id 
            AND vh.action = 'BLOCKCHAIN_REGISTERED' 
            AND vh.transaction_id IS NOT NULL
        )
        ORDER BY v.created_at DESC
    `;
    
    const result = await db.query(query);
    console.log(`📋 Found ${result.rows.length} vehicles needing backfill`);
    
    if (result.rows.length === 0) {
        console.log('✅ No vehicles need backfilling. All registered vehicles have transaction IDs.');
        process.exit(0);
    }
    
    let successCount = 0;
    let failCount = 0;
    let notFoundCount = 0;
    
    for (const vehicle of result.rows) {
        try {
            console.log(`\n🔍 Processing ${vehicle.vin} (${vehicle.plate_number || 'N/A'})...`);
            
            // Query Fabric for this vehicle
            const blockchainResult = await fabricService.getVehicle(vehicle.vin);
            
            if (blockchainResult && blockchainResult.success && blockchainResult.vehicle) {
                const fabricVehicle = blockchainResult.vehicle;
                // Try to get transaction ID from various possible fields
                const transactionId = fabricVehicle.lastTxId || 
                                    fabricVehicle.transactionId || 
                                    fabricVehicle.blockchainTxId ||
                                    null;
                
                if (transactionId) {
                    // Found on blockchain - backfill the history
                    await dbServices.addVehicleHistory({
                        vehicleId: vehicle.id,
                        action: 'BLOCKCHAIN_REGISTERED',
                        description: 'Transaction ID backfilled from blockchain ledger',
                        performedBy: null,
                        transactionId: transactionId,
                        metadata: JSON.stringify({ 
                            backfilled: true, 
                            backfilledAt: new Date().toISOString(),
                            source: 'backfill_script',
                            vin: vehicle.vin
                        })
                    });
                    
                    console.log(`  ✅ Backfilled: ${transactionId}`);
                    successCount++;
                } else {
                    console.log(`  ⚠️ Vehicle found on blockchain but no transaction ID in response`);
                    notFoundCount++;
                }
            } else {
                console.log(`  ⚠️ Not found on blockchain - may need manual investigation`);
                notFoundCount++;
            }
            
            // Small delay to avoid overwhelming Fabric
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (err) {
            if (err.message && err.message.includes('not found')) {
                console.log(`  ⚠️ Vehicle not found on blockchain: ${err.message}`);
                notFoundCount++;
            } else {
                console.error(`  ❌ Error processing ${vehicle.vin}:`, err.message);
                failCount++;
            }
        }
    }
    
    console.log(`\n📊 Backfill complete:`);
    console.log(`   ✅ Successfully backfilled: ${successCount}`);
    console.log(`   ⚠️  Not found on blockchain: ${notFoundCount}`);
    console.log(`   ❌ Errors: ${failCount}`);
    console.log(`   📝 Total processed: ${result.rows.length}`);
}

// Run if executed directly
if (require.main === module) {
    backfillTransactionIds()
        .then(() => {
            console.log('\n✅ Backfill script completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { backfillTransactionIds };

