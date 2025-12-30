/**
 * TrustChain LTO - Separate OR/CR Migration Script
 * 
 * This script migrates existing combined OR/CR numbers to separate OR and CR numbers.
 * It handles:
 * 1. Vehicles with existing OR/CR numbers (6 vehicles) - splits them
 * 2. Vehicles without OR/CR numbers (13 vehicles) - generates new separate numbers
 * 
 * Usage:
 *   node scripts/migrate-separate-or-cr.js
 * 
 * Prerequisites:
 *   - Database migration (database/separate-or-cr.sql) must be run first
 *   - Database connection configured in backend/database/db.js
 */

const db = require('../backend/database/services');
const dbModule = require('../backend/database/db'); // Use existing DB connection
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrateSeparateOrCr() {
    console.log('🚀 Starting OR/CR separation migration...\n');
    
    let migratedCount = 0;
    let generatedCount = 0;
    let errorCount = 0;
    
    try {
        // Test database connection first
        const connected = await dbModule.testConnection();
        if (!connected) {
            throw new Error('Failed to connect to database. Please check your .env file or environment variables.');
        }
        
        // Step 1: Get all vehicles
        const vehiclesResult = await dbModule.query(`
            SELECT id, vin, plate_number, or_cr_number, or_number, cr_number, 
                   or_cr_issued_at, registration_date, status
            FROM vehicles
            ORDER BY registration_date ASC, id ASC
        `);
        
        const vehicles = vehiclesResult.rows;
        console.log(`📊 Found ${vehicles.length} vehicles to process\n`);
        
        // Step 2: Process each vehicle
        for (const vehicle of vehicles) {
            try {
                // Check if vehicle already has separate OR/CR numbers
                if (vehicle.or_number && vehicle.cr_number) {
                    console.log(`⏭️  Vehicle ${vehicle.vin} already has separate OR/CR numbers. Skipping.`);
                    continue;
                }
                
                // Case 1: Vehicle has existing combined OR/CR number
                if (vehicle.or_cr_number) {
                    // Split ORCR-YYYY-XXXXXX into OR-YYYY-XXXXXX and CR-YYYY-XXXXXX
                    const orNumber = vehicle.or_cr_number.replace('ORCR-', 'OR-');
                    const crNumber = vehicle.or_cr_number.replace('ORCR-', 'CR-');
                    const issuedAt = vehicle.or_cr_issued_at || vehicle.registration_date || new Date();
                    
                    await dbModule.query(`
                        UPDATE vehicles 
                        SET or_number = $1,
                            cr_number = $2,
                            or_issued_at = $3,
                            cr_issued_at = $3,
                            date_of_registration = COALESCE(date_of_registration, registration_date, $3)
                        WHERE id = $4
                    `, [orNumber, crNumber, issuedAt, vehicle.id]);
                    
                    console.log(`✅ Migrated: ${vehicle.vin}`);
                    console.log(`   ${vehicle.or_cr_number} → OR: ${orNumber}, CR: ${crNumber}`);
                    migratedCount++;
                    
                } else {
                    // Case 2: Vehicle has no OR/CR number - generate new separate numbers
                    const orNumber = await db.generateOrNumber();
                    const crNumber = await db.generateCrNumber();
                    const issuedAt = vehicle.registration_date || new Date();
                    
                    await dbModule.query(`
                        UPDATE vehicles 
                        SET or_number = $1,
                            cr_number = $2,
                            or_issued_at = $3,
                            cr_issued_at = $3,
                            date_of_registration = COALESCE(date_of_registration, registration_date, $3)
                        WHERE id = $4
                    `, [orNumber, crNumber, issuedAt, vehicle.id]);
                    
                    console.log(`✨ Generated: ${vehicle.vin}`);
                    console.log(`   OR: ${orNumber}, CR: ${crNumber}`);
                    generatedCount++;
                }
                
            } catch (error) {
                console.error(`❌ Error processing vehicle ${vehicle.vin}:`, error.message);
                errorCount++;
            }
        }
        
        // Step 3: Summary
        console.log('\n' + '='.repeat(60));
        console.log('📈 Migration Summary:');
        console.log(`   ✅ Migrated (split existing): ${migratedCount} vehicles`);
        console.log(`   ✨ Generated (new numbers): ${generatedCount} vehicles`);
        console.log(`   ❌ Errors: ${errorCount} vehicles`);
        console.log(`   📊 Total processed: ${migratedCount + generatedCount} vehicles`);
        console.log('='.repeat(60) + '\n');
        
        // Step 4: Verification
        console.log('🔍 Verifying migration...\n');
        const verificationResult = await dbModule.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(or_number) as with_or,
                COUNT(cr_number) as with_cr,
                COUNT(CASE WHEN or_number IS NOT NULL AND cr_number IS NOT NULL THEN 1 END) as with_both
            FROM vehicles
        `);
        
        const stats = verificationResult.rows[0];
        console.log('📊 Current Database State:');
        console.log(`   Total vehicles: ${stats.total}`);
        console.log(`   Vehicles with OR number: ${stats.with_or}`);
        console.log(`   Vehicles with CR number: ${stats.with_cr}`);
        console.log(`   Vehicles with both OR and CR: ${stats.with_both}`);
        
        if (parseInt(stats.with_both) === parseInt(stats.total)) {
            console.log('\n✅ Migration completed successfully! All vehicles have separate OR and CR numbers.');
        } else {
            console.log('\n⚠️  Warning: Some vehicles may still be missing OR or CR numbers.');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await dbModule.close();
    }
}

// Run migration
if (require.main === module) {
    migrateSeparateOrCr()
        .then(() => {
            console.log('\n✅ Migration script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateSeparateOrCr };