// Script to fix vehicles with TRANSFER_COMPLETED status
// This reverts them to REGISTERED status so they appear in "My Vehicles" section

const db = require('../database/db');
const { VEHICLE_STATUS } = require('../config/statusConstants');

async function fixTransferCompletedStatus() {
    try {
        console.log('🔍 Checking for vehicles with TRANSFER_COMPLETED status...');
        
        // Find vehicles with TRANSFER_COMPLETED status
        const result = await db.query(
            `SELECT id, vin, plate_number, status, owner_id 
             FROM vehicles 
             WHERE status = $1 OR status = $2`,
            [VEHICLE_STATUS.TRANSFER_COMPLETED, 'TRANSFER_COMPLETED']
        );
        
        if (result.rows.length === 0) {
            console.log('✅ No vehicles found with TRANSFER_COMPLETED status');
            return { fixed: 0, vehicles: [] };
        }
        
        console.log(`📋 Found ${result.rows.length} vehicle(s) with TRANSFER_COMPLETED status`);
        
        const fixedVehicles = [];
        
        for (const vehicle of result.rows) {
            try {
                // Update status to REGISTERED
                await db.query(
                    `UPDATE vehicles 
                     SET status = $1, 
                         last_updated = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [VEHICLE_STATUS.REGISTERED, vehicle.id]
                );
                
                fixedVehicles.push({
                    id: vehicle.id,
                    vin: vehicle.vin,
                    plate_number: vehicle.plate_number
                });
                
                console.log(`✅ Fixed vehicle ${vehicle.vin || vehicle.id}: TRANSFER_COMPLETED → REGISTERED`);
            } catch (error) {
                console.error(`❌ Failed to fix vehicle ${vehicle.vin || vehicle.id}:`, error.message);
            }
        }
        
        console.log(`\n✅ Successfully fixed ${fixedVehicles.length} vehicle(s)`);
        return { fixed: fixedVehicles.length, vehicles: fixedVehicles };
        
    } catch (error) {
        console.error('❌ Error fixing TRANSFER_COMPLETED status:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    fixTransferCompletedStatus()
        .then(result => {
            console.log('\n📊 Summary:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { fixTransferCompletedStatus };
