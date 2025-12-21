#!/usr/bin/env node

/**
 * Backfill OR/CR Numbers for Existing Vehicles
 * 
 * This script assigns OR/CR numbers to vehicles that were approved/registered
 * before the OR/CR generation feature was implemented.
 * 
 * Usage:
 *   node scripts/backfill-or-cr-numbers.js
 *   node scripts/backfill-or-cr-numbers.js --dry-run  (preview only)
 */

const db = require('../backend/database/db');
const services = require('../backend/database/services');

const DRY_RUN = process.argv.includes('--dry-run');

async function backfillOrCrNumbers() {
    console.log('🔄 Starting OR/CR number backfill...');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (will update database)'}\n`);

    try {
        // Find vehicles that are APPROVED or REGISTERED but don't have OR/CR numbers
        const result = await db.query(
            `SELECT id, vin, plate_number, status, registration_date, last_updated, or_cr_number
             FROM vehicles
             WHERE status IN ('APPROVED', 'REGISTERED')
             AND (or_cr_number IS NULL OR or_cr_number = '')
             ORDER BY COALESCE(registration_date, last_updated) ASC`
        );

        const vehiclesToUpdate = result.rows;
        console.log(`📊 Found ${vehiclesToUpdate.length} vehicles without OR/CR numbers\n`);

        if (vehiclesToUpdate.length === 0) {
            console.log('✅ All approved/registered vehicles already have OR/CR numbers!');
            process.exit(0);
        }

        let successCount = 0;
        let errorCount = 0;

        for (const vehicle of vehiclesToUpdate) {
            try {
                console.log(`Processing vehicle: ${vehicle.plate_number || vehicle.vin} (${vehicle.id.substring(0, 8)}...)`);
                
                if (DRY_RUN) {
                    console.log(`  [DRY RUN] Would assign OR/CR number to this vehicle`);
                    successCount++;
                } else {
                    // Assign OR/CR number
                    const orCrResult = await services.assignOrCrNumber(vehicle.id);
                    console.log(`  ✅ Assigned OR/CR: ${orCrResult.orCrNumber}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`  ❌ Error processing vehicle ${vehicle.id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Backfill Summary:');
        console.log(`   Total vehicles processed: ${vehiclesToUpdate.length}`);
        console.log(`   ✅ Successfully processed: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log('='.repeat(50));

        if (!DRY_RUN && successCount > 0) {
            console.log('\n✅ OR/CR numbers have been assigned to existing vehicles!');
        }

    } catch (error) {
        console.error('❌ Fatal error during backfill:', error);
        process.exit(1);
    } finally {
        // Close database connection pool
        await db.close();
    }
}

// Run the backfill
backfillOrCrNumbers()
    .then(() => {
        console.log('\n✅ Backfill completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Backfill failed:', error);
        process.exit(1);
    });

