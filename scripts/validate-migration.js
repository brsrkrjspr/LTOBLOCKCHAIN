#!/usr/bin/env node

/**
 * TrustChain LTO - Migration Validation Script
 * Purpose: Validate data integrity before and after LTO compliance migration
 * Usage: node scripts/validate-migration.js [pre|post]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load database configuration
// Defaults match docker-compose.unified.yml configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'lto_blockchain',
    user: process.env.DB_USER || 'lto_user',
    password: process.env.DB_PASSWORD || 'lto_password',
};

const pool = new Pool(dbConfig);

// Validation results
const results = {
    passed: [],
    failed: [],
    warnings: [],
    summary: {}
};

/**
 * Run a query and return results
 */
async function runQuery(query, description) {
    try {
        const result = await pool.query(query);
        return { success: true, data: result.rows, description };
    } catch (error) {
        return { success: false, error: error.message, description };
    }
}

/**
 * Pre-migration validation
 */
async function preMigrationValidation() {
    console.log('\n=== PRE-MIGRATION VALIDATION ===\n');

    // Check total vehicles
    const totalVehicles = await runQuery(
        'SELECT COUNT(*) as count FROM vehicles',
        'Total vehicles'
    );
    if (totalVehicles.success) {
        results.summary.totalVehicles = totalVehicles.data[0].count;
        console.log(`✓ Total vehicles: ${totalVehicles.data[0].count}`);
    }

    // Check vehicles with NULL vehicle_type
    const nullTypes = await runQuery(
        'SELECT COUNT(*) as count FROM vehicles WHERE vehicle_type IS NULL',
        'Vehicles with NULL vehicle_type'
    );
    if (nullTypes.success) {
        const count = parseInt(nullTypes.data[0].count);
        if (count > 0) {
            results.warnings.push(`Found ${count} vehicles with NULL vehicle_type`);
            console.log(`⚠ Warning: ${count} vehicles with NULL vehicle_type`);
        } else {
            console.log(`✓ No vehicles with NULL vehicle_type`);
        }
    }

    // Check distinct vehicle types
    const distinctTypes = await runQuery(
        'SELECT DISTINCT vehicle_type FROM vehicles ORDER BY vehicle_type',
        'Distinct vehicle types'
    );
    if (distinctTypes.success) {
        const types = distinctTypes.data.map(r => r.vehicle_type).filter(Boolean);
        console.log(`✓ Distinct vehicle types: ${types.join(', ')}`);
        results.summary.vehicleTypes = types;
    }

    // Check vehicles needing migration
    const needingMigration = await runQuery(
        `SELECT COUNT(*) as count FROM vehicles 
         WHERE vehicle_category IS NULL 
            OR passenger_capacity IS NULL 
            OR gross_vehicle_weight IS NULL`,
        'Vehicles needing migration'
    );
    if (needingMigration.success) {
        const count = parseInt(needingMigration.data[0].count);
        results.summary.vehiclesNeedingMigration = count;
        console.log(`✓ Vehicles needing migration: ${count}`);
    }

    // Check existing constraints
    const constraints = await runQuery(
        `SELECT conname, contype 
         FROM pg_constraint 
         WHERE conrelid = 'vehicles'::regclass 
         ORDER BY conname`,
        'Existing constraints'
    );
    if (constraints.success) {
        console.log(`✓ Existing constraints: ${constraints.data.length}`);
        results.summary.existingConstraints = constraints.data.length;
    }

    return results;
}

/**
 * Post-migration validation
 */
async function postMigrationValidation() {
    console.log('\n=== POST-MIGRATION VALIDATION ===\n');

    // Verify constraints exist
    const constraints = await runQuery(
        `SELECT conname, contype 
         FROM pg_constraint 
         WHERE conrelid = 'vehicles'::regclass 
           AND conname LIKE 'chk_%'
         ORDER BY conname`,
        'LTO compliance constraints'
    );
    if (constraints.success) {
        const expectedConstraints = [
            'chk_vehicle_category',
            'chk_passenger_capacity',
            'chk_gross_vehicle_weight',
            'chk_net_weight',
            'chk_registration_type'
        ];
        const foundConstraints = constraints.data.map(c => c.conname);
        const missing = expectedConstraints.filter(c => !foundConstraints.includes(c));
        
        if (missing.length === 0) {
            console.log(`✓ All required constraints exist`);
            results.passed.push('All constraints exist');
        } else {
            console.log(`✗ Missing constraints: ${missing.join(', ')}`);
            results.failed.push(`Missing constraints: ${missing.join(', ')}`);
        }
    }

    // Validate vehicle categories
    const validCategories = await runQuery(
        `SELECT COUNT(*) as count 
         FROM vehicles 
         WHERE vehicle_category IN ('L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4')`,
        'Vehicles with valid category'
    );
    if (validCategories.success) {
        const count = parseInt(validCategories.data[0].count);
        const total = results.summary.totalVehicles || 0;
        if (count === total) {
            console.log(`✓ All vehicles have valid category (${count}/${total})`);
            results.passed.push('All vehicles have valid category');
        } else {
            console.log(`✗ Only ${count}/${total} vehicles have valid category`);
            results.failed.push(`Only ${count}/${total} vehicles have valid category`);
        }
    }

    // Validate passenger capacity
    const validCapacity = await runQuery(
        `SELECT COUNT(*) as count 
         FROM vehicles 
         WHERE passenger_capacity >= 1 AND passenger_capacity <= 100`,
        'Vehicles with valid capacity'
    );
    if (validCapacity.success) {
        const count = parseInt(validCapacity.data[0].count);
        const total = results.summary.totalVehicles || 0;
        if (count === total) {
            console.log(`✓ All vehicles have valid capacity (${count}/${total})`);
            results.passed.push('All vehicles have valid capacity');
        } else {
            console.log(`✗ Only ${count}/${total} vehicles have valid capacity`);
            results.failed.push(`Only ${count}/${total} vehicles have valid capacity`);
        }
    }

    // Validate weights
    const validWeights = await runQuery(
        `SELECT COUNT(*) as count 
         FROM vehicles 
         WHERE gross_vehicle_weight > 0 
           AND net_weight > 0 
           AND net_weight < gross_vehicle_weight`,
        'Vehicles with valid weights'
    );
    if (validWeights.success) {
        const count = parseInt(validWeights.data[0].count);
        const total = results.summary.totalVehicles || 0;
        if (count === total) {
            console.log(`✓ All vehicles have valid weights (${count}/${total})`);
            results.passed.push('All vehicles have valid weights');
        } else {
            console.log(`✗ Only ${count}/${total} vehicles have valid weights`);
            results.failed.push(`Only ${count}/${total} vehicles have valid weights`);
        }
    }

    // Check for NULL values
    const nullCategories = await runQuery(
        'SELECT COUNT(*) as count FROM vehicles WHERE vehicle_category IS NULL',
        'NULL categories'
    );
    if (nullCategories.success) {
        const count = parseInt(nullCategories.data[0].count);
        if (count === 0) {
            console.log(`✓ No NULL categories`);
            results.passed.push('No NULL categories');
        } else {
            console.log(`✗ Found ${count} NULL categories`);
            results.failed.push(`Found ${count} NULL categories`);
        }
    }

    const nullCapacities = await runQuery(
        'SELECT COUNT(*) as count FROM vehicles WHERE passenger_capacity IS NULL',
        'NULL capacities'
    );
    if (nullCapacities.success) {
        const count = parseInt(nullCapacities.data[0].count);
        if (count === 0) {
            console.log(`✓ No NULL capacities`);
            results.passed.push('No NULL capacities');
        } else {
            console.log(`✗ Found ${count} NULL capacities`);
            results.failed.push(`Found ${count} NULL capacities`);
        }
    }

    const nullGVW = await runQuery(
        'SELECT COUNT(*) as count FROM vehicles WHERE gross_vehicle_weight IS NULL',
        'NULL GVW'
    );
    if (nullGVW.success) {
        const count = parseInt(nullGVW.data[0].count);
        if (count === 0) {
            console.log(`✓ No NULL GVW`);
            results.passed.push('No NULL GVW');
        } else {
            console.log(`✗ Found ${count} NULL GVW`);
            results.failed.push(`Found ${count} NULL GVW`);
        }
    }

    return results;
}

/**
 * Generate validation report
 */
function generateReport() {
    console.log('\n=== VALIDATION REPORT ===\n');
    console.log(`Passed: ${results.passed.length}`);
    console.log(`Failed: ${results.failed.length}`);
    console.log(`Warnings: ${results.warnings.length}\n`);

    if (results.passed.length > 0) {
        console.log('✓ Passed checks:');
        results.passed.forEach(check => console.log(`  - ${check}`));
    }

    if (results.failed.length > 0) {
        console.log('\n✗ Failed checks:');
        results.failed.forEach(check => console.log(`  - ${check}`));
    }

    if (results.warnings.length > 0) {
        console.log('\n⚠ Warnings:');
        results.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    // Save report to file
    const reportPath = path.join(__dirname, '..', 'logs', 'validation-report.json');
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    return results.failed.length === 0;
}

/**
 * Main function
 */
async function main() {
    const mode = process.argv[2] || 'post';

    try {
        if (mode === 'pre') {
            await preMigrationValidation();
        } else if (mode === 'post') {
            await postMigrationValidation();
        } else {
            console.error('Usage: node validate-migration.js [pre|post]');
            process.exit(1);
        }

        const success = generateReport();
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('Validation error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
