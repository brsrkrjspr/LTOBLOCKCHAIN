// TrustChain LTO - Migration Runner
// Runs database migrations to create required tables

const fs = require('fs');
const path = require('path');
const db = require('../database/db');
require('dotenv').config();

async function runMigration(migrationFile) {
    try {
        console.log(`\n📄 Running migration: ${migrationFile}`);
        
        const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
        
        if (!fs.existsSync(migrationPath)) {
            console.error(`❌ Migration file not found: ${migrationPath}`);
            return false;
        }
        
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await db.query(statement);
                    console.log('✅ Executed statement');
                } catch (error) {
                    // Ignore "already exists" errors
                    if (error.message.includes('already exists') || error.code === '42P07') {
                        console.log('ℹ️  Already exists, skipping...');
                    } else {
                        throw error;
                    }
                }
            }
        }
        
        console.log(`✅ Migration completed: ${migrationFile}\n`);
        return true;
    } catch (error) {
        console.error(`❌ Migration failed: ${migrationFile}`);
        console.error('Error:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting database migrations...\n');
    
    // Test database connection first
    console.log('🔌 Testing database connection...');
    try {
        const result = await db.query('SELECT NOW()');
        console.log('✅ Database connection successful');
        console.log(`📅 Database time: ${result.rows[0].now}\n`);
    } catch (error) {
        console.error('❌ Database connection failed. Please check your database configuration.');
        console.error('   Error:', error.message);
        console.error('   Make sure PostgreSQL is running and credentials are correct.');
        console.error('   Check your .env file for DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
        process.exit(1);
    }
    
    // Run migrations in order
    const migrations = [
        'add_refresh_tokens.sql'
    ];
    
    let allSuccess = true;
    for (const migration of migrations) {
        const success = await runMigration(migration);
        if (!success) {
            allSuccess = false;
        }
    }
    
    if (allSuccess) {
        console.log('✅ All migrations completed successfully!');
        process.exit(0);
    } else {
        console.error('❌ Some migrations failed. Please check the errors above.');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };

