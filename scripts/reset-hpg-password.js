// Script to directly reset HPG admin password in the database
// Usage: node scripts/reset-hpg-password.js <new_password>
// Example: node scripts/reset-hpg-password.js SecurePass123!

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'lto_blockchain',
    user: process.env.DB_USER || 'lto_user',
    password: process.env.DB_PASSWORD || 'lto_password',
};

const pool = new Pool(dbConfig);

async function resetHpgPassword() {
    let client;
    
    try {
        const newPassword = process.argv[2];
        
        if (!newPassword) {
            console.error('❌ Error: Please provide a new password as an argument');
            console.log('Usage: node scripts/reset-hpg-password.js <new_password>');
            console.log('Example: node scripts/reset-hpg-password.js SecurePass123!');
            process.exit(1);
        }
        
        if (newPassword.length < 8) {
            console.error('❌ Error: Password must be at least 8 characters long');
            process.exit(1);
        }
        
        console.log('🔄 Starting HPG password reset...');
        console.log('📋 Database Configuration:');
        console.log(`   Host: ${dbConfig.host}`);
        console.log(`   Database: ${dbConfig.database}`);
        console.log(`   User: ${dbConfig.user}`);
        console.log(`📧 Email: hpgadmin@hpg.gov.ph`);
        console.log(`🔑 New Password: ${newPassword}`);
        console.log('');
        
        // Get database connection
        client = await pool.connect();
        console.log('✅ Database connection established');
        
        // Check if user exists
        const checkUser = await client.query(
            'SELECT id, email, role, organization, is_active FROM users WHERE email = $1',
            ['hpgadmin@hpg.gov.ph']
        );
        
        if (checkUser.rows.length === 0) {
            console.error('❌ Error: HPG admin user not found in database');
            console.log('   Email: hpgadmin@hpg.gov.ph');
            process.exit(1);
        }
        
        const user = checkUser.rows[0];
        console.log('✅ User found:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Organization: ${user.organization}`);
        console.log(`   Active: ${user.is_active}`);
        console.log('');
        
        // Generate password hash
        console.log('🔐 Generating password hash...');
        const passwordHash = await bcrypt.hash(newPassword, 12);
        console.log(`✅ Password hash generated (length: ${passwordHash.length})`);
        
        // Verify hash is valid
        const testCompare = await bcrypt.compare(newPassword, passwordHash);
        if (!testCompare) {
            throw new Error('Password hash verification failed');
        }
        console.log('✅ Password hash verification passed');
        console.log('');
        
        // First, ensure hpg_admin role exists in enum
        console.log('🔄 Checking if hpg_admin role exists in enum...');
        try {
            await client.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum 
                        WHERE enumlabel = 'hpg_admin' 
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
                    ) THEN
                        ALTER TYPE user_role ADD VALUE 'hpg_admin';
                        RAISE NOTICE 'Added hpg_admin to user_role enum';
                    ELSE
                        RAISE NOTICE 'hpg_admin already exists in user_role enum';
                    END IF;
                END $$;
            `);
            console.log('✅ hpg_admin role verified/added to enum');
        } catch (enumError) {
            console.warn('⚠️ Could not add hpg_admin to enum (may already exist):', enumError.message);
            // Continue anyway - role might already exist
        }
        console.log('');
        
        // Update password and role
        console.log('🔄 Updating password and role...');
        const updateQuery = `
            UPDATE users 
            SET password_hash = $1,
                role = 'hpg_admin',
                updated_at = CURRENT_TIMESTAMP
            WHERE email = 'hpgadmin@hpg.gov.ph'
            RETURNING id, email, first_name, last_name, role, organization, is_active, updated_at;
        `;
        
        const result = await client.query(updateQuery, [passwordHash]);
        
        if (result.rows.length === 0) {
            throw new Error('Failed to update user');
        }
        
        const updatedUser = result.rows[0];
        console.log('✅ Password and role updated successfully!');
        console.log('');
        console.log('📋 Updated User Details:');
        console.log(`   ID: ${updatedUser.id}`);
        console.log(`   Email: ${updatedUser.email}`);
        console.log(`   Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
        console.log(`   Role: ${updatedUser.role}`);
        console.log(`   Organization: ${updatedUser.organization}`);
        console.log(`   Active: ${updatedUser.is_active}`);
        console.log(`   Updated At: ${updatedUser.updated_at}`);
        console.log('');
        
        // Verify the password works
        console.log('🔍 Verifying password in database...');
        const verifyUser = await client.query(
            'SELECT password_hash FROM users WHERE email = $1',
            ['hpgadmin@hpg.gov.ph']
        );
        
        if (verifyUser.rows.length === 0) {
            throw new Error('User not found after update');
        }
        
        const verifyHash = await bcrypt.compare(newPassword, verifyUser.rows[0].password_hash);
        if (!verifyHash) {
            throw new Error('Password verification failed after update');
        }
        
        console.log('✅ Password verification successful!');
        console.log('');
        console.log('🎉 Password reset complete!');
        console.log('');
        console.log('📝 Login Credentials:');
        console.log(`   Email: hpgadmin@hpg.gov.ph`);
        console.log(`   Password: ${newPassword}`);
        console.log('');
        console.log('✅ You can now login with these credentials.');
        
    } catch (error) {
        console.error('❌ Error resetting password:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

resetHpgPassword();
