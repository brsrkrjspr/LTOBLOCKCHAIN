/**
 * Backfill BLOCKCHAIN_REGISTERED history entries from existing CLEARANCE_APPROVED entries
 * Run once: node backend/scripts/backfill-blockchain-registered.js
 */

const db = require('../database/db');
const dbServices = require('../database/services');

async function backfillBlockchainRegistered() {
    console.log('🔧 Starting BLOCKCHAIN_REGISTERED backfill...');
    
    try {
        // Find CLEARANCE_APPROVED entries with transaction_id that don't have BLOCKCHAIN_REGISTERED
        const query = `
            SELECT vh.vehicle_id, vh.transaction_id, vh.performed_by, vh.metadata, 
                   v.vin, v.plate_number, v.status
            FROM vehicle_history vh
            JOIN vehicles v ON vh.vehicle_id = v.id
            WHERE vh.action = 'CLEARANCE_APPROVED'
            AND vh.transaction_id IS NOT NULL
            AND vh.transaction_id != ''
            AND vh.transaction_id NOT LIKE '%-%'
            AND NOT EXISTS (
                SELECT 1 FROM vehicle_history vh2 
                WHERE vh2.vehicle_id = vh.vehicle_id 
                AND vh2.action = 'BLOCKCHAIN_REGISTERED'
                AND vh2.transaction_id IS NOT NULL
            )
            ORDER BY vh.performed_at DESC
        `;
        
        const result = await db.query(query);
        console.log(`📋 Found ${result.rows.length} vehicles needing backfill`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const row of result.rows) {
            try {
                console.log(`\n🔍 Processing ${row.vin || row.vehicle_id} (${row.plate_number || 'no plate'})...`);
                console.log(`   Status: ${row.status}, TX: ${row.transaction_id}`);
                
                await dbServices.addVehicleHistory({
                    vehicleId: row.vehicle_id,
                    action: 'BLOCKCHAIN_REGISTERED',
                    description: `Transaction ID backfilled from CLEARANCE_APPROVED. TX: ${row.transaction_id}`,
                    performedBy: row.performed_by || null,
                    transactionId: row.transaction_id,
                    metadata: JSON.stringify({
                        backfilled: true,
                        backfilledAt: new Date().toISOString(),
                        source: 'clearance_approved_backfill',
                        originalMetadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
                    })
                });
                
                console.log(`   ✅ Backfilled successfully`);
                successCount++;
                
            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
                failCount++;
            }
        }
        
        console.log(`\n📊 Backfill complete: ${successCount} success, ${failCount} failed`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        throw error;
    }
}

if (require.main === module) {
    backfillBlockchainRegistered()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { backfillBlockchainRegistered };

