/**
 * Backfill blockchain_tx_id for existing REGISTERED vehicles
 * Copies transaction_id from vehicle_history (BLOCKCHAIN_REGISTERED) to vehicles.blockchain_tx_id
 * 
 * This script addresses vehicles that were registered before Phase 1 implementation,
 * ensuring they have blockchain_tx_id populated in the vehicles table for consistency
 * and performance optimization.
 * 
 * Usage: node backend/scripts/backfill-vehicles-blockchain-tx-id.js
 * 
 * Prerequisites:
 * - Database connection configured in .env
 * - Vehicles with status='REGISTERED' and BLOCKCHAIN_REGISTERED history entries
 */

const db = require('../database/db');
const path = require('path');

async function backfillBlockchainTxIds() {
    console.log('🔧 Starting blockchain_tx_id backfill for existing vehicles...\n');
    
    try {
        // Find vehicles needing backfill
        // Uses DISTINCT ON to handle multiple BLOCKCHAIN_REGISTERED entries (takes most recent)
        const query = `
            SELECT DISTINCT ON (v.id)
                v.id,
                v.vin,
                v.plate_number,
                v.status,
                v.blockchain_tx_id as current_tx_id,
                vh.transaction_id as history_tx_id,
                vh.performed_at as blockchain_registered_date
            FROM vehicles v
            JOIN vehicle_history vh ON v.id = vh.vehicle_id
            WHERE v.status = 'REGISTERED'
              AND (v.blockchain_tx_id IS NULL OR v.blockchain_tx_id = '')
              AND vh.action = 'BLOCKCHAIN_REGISTERED'
              AND vh.transaction_id IS NOT NULL
              AND vh.transaction_id != ''
              AND vh.transaction_id NOT LIKE '%-%'  -- Exclude UUIDs (blockchain TX IDs don't have hyphens)
            ORDER BY v.id, vh.performed_at DESC;
        `;
        
        const result = await db.query(query);
        console.log(`📋 Found ${result.rows.length} vehicle(s) needing backfill\n`);
        
        if (result.rows.length === 0) {
            console.log('✅ No vehicles need backfilling. All registered vehicles have blockchain_tx_id.');
            return { updated: 0, skipped: 0, errors: 0, vehicles: [] };
        }
        
        // Show preview of vehicles to be updated
        console.log('📋 Vehicles to be updated:');
        result.rows.slice(0, 10).forEach((vehicle, index) => {
            console.log(`   ${index + 1}. VIN: ${vehicle.vin}, Plate: ${vehicle.plate_number || 'N/A'}, TX ID: ${vehicle.history_tx_id.substring(0, 20)}...`);
        });
        if (result.rows.length > 10) {
            console.log(`   ... and ${result.rows.length - 10} more\n`);
        } else {
            console.log('');
        }
        
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const results = [];
        
        for (const vehicle of result.rows) {
            try {
                // Update vehicles table
                const updateResult = await db.query(
                    `UPDATE vehicles 
                     SET blockchain_tx_id = $1, 
                         last_updated = CURRENT_TIMESTAMP
                     WHERE id = $2
                       AND (blockchain_tx_id IS NULL OR blockchain_tx_id = '')  -- Only update if currently NULL/empty
                     RETURNING id, vin, blockchain_tx_id`,
                    [vehicle.history_tx_id, vehicle.id]
                );
                
                if (updateResult.rows.length > 0) {
                    const updatedVehicle = updateResult.rows[0];
                    console.log(`✅ Updated ${vehicle.vin} (${vehicle.plate_number || 'N/A'}): ${vehicle.history_tx_id.substring(0, 20)}...`);
                    updated++;
                    results.push({
                        vehicleId: vehicle.id,
                        vin: vehicle.vin,
                        plateNumber: vehicle.plate_number,
                        blockchainTxId: vehicle.history_tx_id,
                        status: 'updated'
                    });
                } else {
                    // Vehicle was already updated (race condition or already had value)
                    console.log(`⚠️  Skipped ${vehicle.vin} - already has blockchain_tx_id`);
                    skipped++;
                    results.push({
                        vehicleId: vehicle.id,
                        vin: vehicle.vin,
                        plateNumber: vehicle.plate_number,
                        blockchainTxId: vehicle.current_tx_id || vehicle.history_tx_id,
                        status: 'skipped'
                    });
                }
            } catch (error) {
                console.error(`❌ Error updating ${vehicle.vin}: ${error.message}`);
                errors++;
                results.push({
                    vehicleId: vehicle.id,
                    vin: vehicle.vin,
                    plateNumber: vehicle.plate_number,
                    blockchainTxId: null,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        console.log(`\n📊 Backfill Summary:`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⚠️  Skipped: ${skipped}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   📋 Total processed: ${result.rows.length}`);
        
        // Verification query
        if (updated > 0) {
            console.log('\n🔍 Running verification query...');
            const verifyQuery = `
                SELECT 
                    COUNT(*) as total_registered,
                    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_tx_id,
                    COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as missing_tx_id
                FROM vehicles 
                WHERE status = 'REGISTERED';
            `;
            const verifyResult = await db.query(verifyQuery);
            const stats = verifyResult.rows[0];
            console.log(`   Total REGISTERED vehicles: ${stats.total_registered}`);
            console.log(`   With blockchain_tx_id: ${stats.with_tx_id}`);
            console.log(`   Missing blockchain_tx_id: ${stats.missing_tx_id}`);
            
            if (parseInt(stats.missing_tx_id) === 0) {
                console.log('   ✅ All REGISTERED vehicles now have blockchain_tx_id!');
            } else {
                console.log(`   ⚠️  ${stats.missing_tx_id} vehicles still missing blockchain_tx_id (may need manual investigation)`);
            }
        }
        
        return { updated, skipped, errors, vehicles: results };
        
    } catch (error) {
        console.error('❌ Backfill failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    // Load environment variables
    const envPath = path.join(__dirname, '../../.env');
    try {
        require('dotenv').config({ path: envPath });
        console.log(`📋 Loaded environment variables from: ${envPath}`);
    } catch (error) {
        console.warn(`⚠️  Could not load .env file from ${envPath}, using system environment variables`);
        require('dotenv').config();
    }
    
    backfillBlockchainTxIds()
        .then((result) => {
            console.log('\n✅ Backfill script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Backfill script failed:', error);
            process.exit(1);
        });
}

module.exports = { backfillBlockchainTxIds };
