// Script to remove vehicles that are missing blockchain records
// This allows starting fresh with proper blockchain integration

const db = require('../database/db');
const path = require('path');
const readline = require('readline');

// Security: Require admin confirmation
function requireAdminConfirmation() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('\n⚠️  SECURITY WARNING:');
        console.log('   This script will DELETE vehicles from the database.');
        console.log('   Only authorized administrators should run this script.\n');
        
        rl.question('Are you an authorized administrator? Type "YES" to continue: ', (answer) => {
            rl.close();
            
            if (answer.trim() !== 'YES') {
                console.log('\n❌ Operation cancelled. Only authorized administrators can run this script.');
                process.exit(1);
            }
            
            console.log('✅ Admin confirmation received\n');
            resolve();
        });
    });
}

async function removeVehiclesMissingBlockchain() {
    const currentUser = process.env.USER || process.env.USERNAME || 'unknown';
    const hostname = require('os').hostname();
    
    try {
        // SECURITY: Require admin confirmation
        await requireAdminConfirmation();
        
        console.log('🔧 Removing vehicles missing blockchain records...\n');
        
        // Load environment variables
        const envPath = path.join(__dirname, '../../.env');
        try {
            require('dotenv').config({ path: envPath });
            console.log(`📋 Loaded environment variables from: ${envPath}`);
        } catch (error) {
            require('dotenv').config();
        }
        
        console.log(`👤 Running as: ${currentUser} on ${hostname}`);
        console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
        
        // Check if Fabric is available (optional - script works without it)
        let fabricAvailable = false;
        if (process.env.BLOCKCHAIN_MODE === 'fabric') {
            try {
                if (!fabricService.isConnected) {
                    console.log('🔗 Connecting to Fabric network...');
                    await fabricService.initialize();
                }
                fabricAvailable = true;
                console.log('✅ Fabric network available - will check/delete vehicles on blockchain\n');
            } catch (error) {
                console.log('⚠️  Fabric network not available - will only delete from PostgreSQL');
                console.log(`   Error: ${error.message}\n`);
            }
        } else {
            console.log('ℹ️  BLOCKCHAIN_MODE is not "fabric" - will only delete from PostgreSQL\n');
        }
        
        // Find vehicles that are REGISTERED but missing blockchain_tx_id
        const missingBlockchainVehicles = await db.query(
            `SELECT v.id, v.vin, v.plate_number, v.status, v.origin_type,
                    v.make, v.model, v.year, v.owner_id,
                    v.blockchain_tx_id,
                    (SELECT COUNT(*) FROM vehicle_history vh 
                     WHERE vh.vehicle_id = v.id 
                     AND vh.action = 'BLOCKCHAIN_REGISTERED') as blockchain_history_count
             FROM vehicles v
             WHERE v.status = 'REGISTERED'
             AND (v.blockchain_tx_id IS NULL 
                  OR v.blockchain_tx_id = ''
                  OR NOT EXISTS (
                      SELECT 1 FROM vehicle_history vh 
                      WHERE vh.vehicle_id = v.id 
                      AND vh.action = 'BLOCKCHAIN_REGISTERED'
                  ))
             ORDER BY v.registration_date DESC`
        );
        
        if (missingBlockchainVehicles.rows.length === 0) {
            console.log('✅ No vehicles found that are missing blockchain records.');
            console.log('   All REGISTERED vehicles have blockchain_tx_id.\n');
            return;
        }
        
        console.log(`📋 Found ${missingBlockchainVehicles.rows.length} vehicle(s) missing blockchain records:\n`);
        
        missingBlockchainVehicles.rows.forEach((vehicle, index) => {
            console.log(`${index + 1}. VIN: ${vehicle.vin}`);
            console.log(`   Plate: ${vehicle.plate_number || 'N/A'}`);
            console.log(`   Make/Model: ${vehicle.make} ${vehicle.model} (${vehicle.year})`);
            console.log(`   Status: ${vehicle.status}`);
            console.log(`   Origin: ${vehicle.origin_type}`);
            console.log(`   Blockchain TX ID: ${vehicle.blockchain_tx_id || 'MISSING'}`);
            console.log(`   Blockchain History: ${vehicle.blockchain_history_count} entries\n`);
        });
        
        // Confirm deletion
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('⚠️  WARNING: This will DELETE the above vehicles and all related data:');
        console.log('   - Vehicle records');
        console.log('   - Related documents');
        console.log('   - Vehicle history');
        console.log('   - Transfer requests');
        console.log('   - Certificates');
        console.log('   - Verifications\n');
        
        rl.question(`Type "DELETE" to confirm deletion of ${missingBlockchainVehicles.rows.length} vehicle(s): `, async (answer) => {
            rl.close();
            
            if (answer.trim() !== 'DELETE') {
                console.log('\n❌ Deletion cancelled.');
                await db.close();
                process.exit(0);
            }
            
            console.log('\n🗑️  Deleting vehicles...\n');
            
            let deletedCount = 0;
            let errorCount = 0;
            let fabricDeletedCount = 0;
            let fabricErrorCount = 0;
            
            for (const vehicle of missingBlockchainVehicles.rows) {
                try {
                    // Step 1: Try to delete from Fabric if available and vehicle exists there
                    if (fabricAvailable) {
                        try {
                            // Check if vehicle exists on Fabric
                            const fabricVehicle = await fabricService.contract.evaluateTransaction('GetVehicle', vehicle.vin);
                            if (fabricVehicle && fabricVehicle.length > 0) {
                                // Vehicle exists on Fabric - delete it
                                console.log(`🔗 Deleting ${vehicle.vin} from Fabric...`);
                                const deleteResult = await fabricService.deleteVehicle(vehicle.vin);
                                console.log(`   ✅ Deleted from Fabric (TX: ${deleteResult.transactionId})`);
                                fabricDeletedCount++;
                            } else {
                                console.log(`   ℹ️  Vehicle ${vehicle.vin} not found on Fabric (expected for missing blockchain records)`);
                            }
                        } catch (fabricError) {
                            // Vehicle might not exist on Fabric (expected for missing blockchain records)
                            if (fabricError.message.includes('not found') || fabricError.message.includes('does not exist')) {
                                console.log(`   ℹ️  Vehicle ${vehicle.vin} not found on Fabric (expected)`);
                            } else {
                                console.error(`   ⚠️  Failed to delete ${vehicle.vin} from Fabric:`, fabricError.message);
                                fabricErrorCount++;
                                // Continue with PostgreSQL deletion anyway
                            }
                        }
                    }
                    
                    // Step 2: Delete from PostgreSQL (cascade will handle related records)
                    await db.query('DELETE FROM vehicles WHERE id = $1', [vehicle.id]);
                    console.log(`✅ Deleted from PostgreSQL: ${vehicle.vin} (${vehicle.plate_number || 'No plate'})\n`);
                    deletedCount++;
                } catch (error) {
                    console.error(`❌ Failed to delete ${vehicle.vin} from PostgreSQL:`, error.message);
                    errorCount++;
                }
            }
            
            console.log(`\n📊 Summary:`);
            console.log(`   ✅ Successfully deleted from PostgreSQL: ${deletedCount}`);
            if (fabricAvailable) {
                console.log(`   ✅ Successfully deleted from Fabric: ${fabricDeletedCount}`);
                if (fabricErrorCount > 0) {
                    console.log(`   ⚠️  Fabric deletion errors: ${fabricErrorCount}`);
                }
            }
            if (errorCount > 0) {
                console.log(`   ❌ PostgreSQL deletion failed: ${errorCount}`);
            }
            console.log(`\n📝 Script completed by: ${currentUser} on ${hostname}`);
            console.log(`⏰ Completed at: ${new Date().toISOString()}`);
            
            await db.close();
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.error(`\n📝 Script failed - User: ${currentUser}, Host: ${hostname}`);
        await db.close();
        throw error;
    }
}

// Run the script
removeVehiclesMissingBlockchain().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
