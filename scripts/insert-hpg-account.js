// TrustChain LTO - Insert/Update HPG Admin Account
// Script to insert or update HPG admin account with proper password hash
// Can be run multiple times safely (idempotent)

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration from environment variables (matches backend/database/db.js pattern)
const dbConfig = {
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'lto_blockchain',
    user: process.env.DB_USER || 'lto_user',
    password: process.env.DB_PASSWORD || 'lto_password',
};

const pool = new Pool(dbConfig);

async function insertHpgAccount() {
    let client;
    
    try {
        console.log('🔄 Starting HPG account insertion/update...');
        console.log('📋 Database Configuration:');
        console.log(`   Host: ${dbConfig.host}`);
        console.log(`   Database: ${dbConfig.database}`);
        console.log(`   User: ${dbConfig.user}`);
        
        // Get database connection
        client = await pool.connect();
        console.log('✅ Database connection established');
        
        // Generate proper password hash for SecurePass123!
        const password = 'SecurePass123!';
        console.log('🔐 Generating password hash...');
        const passwordHash = await bcrypt.hash(password, 12);
        console.log(`✅ Password hash generated (length: ${passwordHash.length})`);
        
        // Verify hash is valid
        const testCompare = await bcrypt.compare(password, passwordHash);
        if (!testCompare) {
            throw new Error('Password hash verification failed');
        }
        console.log('✅ Password hash verification passed');
        
        // Insert or update HPG admin account (idempotent operation)
        const query = `
            INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                organization = EXCLUDED.organization,
                is_active = EXCLUDED.is_active,
                email_verified = EXCLUDED.email_verified,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, email, first_name, last_name, role, organization, phone, is_active, email_verified, created_at, updated_at;
        `;
        
        const values = [
            'hpgadmin@hpg.gov.ph',
            passwordHash,
            'HPG',
            'Administrator',
            'admin',
            'Highway Patrol Group',
            '+63 2 2345 6789',
            true,
            true
        ];
        
        console.log('📝 Inserting/updating HPG account...');
        const result = await client.query(query, values);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('\n✅ HPG account inserted/updated successfully!');
            console.log('📋 Account Details:');
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Name: ${user.first_name} ${user.last_name}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Organization: ${user.organization}`);
            console.log(`   Phone: ${user.phone}`);
            console.log(`   Active: ${user.is_active}`);
            console.log(`   Email Verified: ${user.email_verified}`);
            console.log(`   Created At: ${user.created_at}`);
            console.log(`   Updated At: ${user.updated_at}`);
            console.log('\n🔑 Login Credentials:');
            console.log(`   Email: hpgadmin@hpg.gov.ph`);
            console.log(`   Password: SecurePass123!`);
            console.log('\n✅ Script completed successfully!');
        } else {
            throw new Error('Failed to insert/update HPG account - no rows returned');
        }
        
        await client.release();
        await pool.end();
        process.exit(0);
        
    } catch (error) {
        if (client) {
            await client.release();
        }
        await pool.end();
        
        console.error('\n❌ Error inserting/updating HPG account:');
        console.error(`   Message: ${error.message}`);
        if (error.code) {
            console.error(`   Code: ${error.code}`);
        }
        if (error.detail) {
            console.error(`   Detail: ${error.detail}`);
        }
        if (error.hint) {
            console.error(`   Hint: ${error.hint}`);
        }
        if (error.stack && process.env.NODE_ENV === 'development') {
            console.error(`   Stack: ${error.stack}`);
        }
        
        process.exit(1);
    }
}

// Run the script
insertHpgAccount();
