/**
 * Backfill BLOCKCHAIN_REGISTERED history entries from existing CLEARANCE_APPROVED entries
 * Run once: node backend/scripts/backfill-blockchain-registered.js
 * 
 * Environment variables required:
 * - DB_HOST (default: localhost)
 * - DB_PORT (default: 5432)
 * - DB_NAME (default: lto_blockchain)
 * - DB_USER (default: lto_user)
 * - DB_PASSWORD or POSTGRES_PASSWORD
 */

// Load environment variables first (try .env file, but don't fail if it doesn't exist)
const path = require('path');
const envPath = path.join(__dirname, '../../.env');
try {
    require('dotenv').config({ path: envPath });
} catch (err) {
    // .env file not found - that's okay if env vars are set directly (Docker/container)
    console.log('ℹ️  .env file not found, using environment variables directly');
}

// Map POSTGRES_PASSWORD to DB_PASSWORD if needed
if (process.env.POSTGRES_PASSWORD && !process.env.DB_PASSWORD) {
    process.env.DB_PASSWORD = process.env.POSTGRES_PASSWORD;
}

// Validate required environment variables
const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('   Please set these variables or create a .env file');
    process.exit(1);
}

const db = require('../database/db');
const dbServices = require('../database/services');

async function backfillBlockchainRegistered() {
    console.log('🔧 Starting BLOCKCHAIN_REGISTERED backfill...');
    console.log(`📊 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'lto_blockchain'}`);
    console.log(`   User: ${process.env.DB_USER || 'lto_user'}`);
    
    // Test database connection first
    try {
        const testResult = await db.query('SELECT NOW()');
        console.log(`✅ Database connection successful (${testResult.rows[0].now})`);
    } catch (connError) {
        console.error('❌ Database connection failed:', connError.message);
        console.error('   Please check your database credentials and connection settings.');
        if (connError.code === 'EAI_AGAIN' && process.env.DB_HOST === 'postgres') {
            console.error('\n💡 TIP: The hostname "postgres" only works inside Docker containers.');
            console.error('   If running on host machine, use: DB_HOST=localhost');
            console.error('   Or run inside container: docker exec -it lto-app node backend/scripts/backfill-blockchain-registered.js');
        }
        throw connError;
    }
    
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
    } finally {
        // Close database connection pool
        try {
            await db.close();
            console.log('✅ Database connection closed');
        } catch (closeError) {
            console.warn('⚠️ Error closing database connection:', closeError.message);
        }
    }
}

if (require.main === module) {
    backfillBlockchainRegistered()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { backfillBlockchainRegistered };

