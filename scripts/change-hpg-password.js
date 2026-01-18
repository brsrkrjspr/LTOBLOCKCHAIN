// Script to generate a new password hash for HPG admin account
// Usage: node scripts/change-hpg-password.js <new_password>
// Example: node scripts/change-hpg-password.js MyNewPassword123!

const bcrypt = require('bcryptjs');

const newPassword = process.argv[2];

if (!newPassword) {
    console.error('❌ Error: Please provide a new password as an argument');
    console.log('Usage: node scripts/change-hpg-password.js <new_password>');
    console.log('Example: node scripts/change-hpg-password.js MyNewPassword123!');
    process.exit(1);
}

if (newPassword.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long');
    process.exit(1);
}

async function generatePasswordHash() {
    try {
        console.log('🔐 Generating password hash for HPG admin account...');
        console.log(`📧 Email: hpgadmin@hpg.gov.ph`);
        console.log(`🔑 New Password: ${newPassword}`);
        console.log('');
        
        // Generate bcrypt hash with cost factor 12
        const passwordHash = await bcrypt.hash(newPassword, 12);
        
        console.log('✅ Password hash generated successfully!');
        console.log('');
        console.log('📋 SQL Command to update password:');
        console.log('─'.repeat(80));
        console.log(`docker exec postgres psql -U lto_user -d lto_blockchain -c "UPDATE users SET password_hash = '${passwordHash}', updated_at = CURRENT_TIMESTAMP WHERE email = 'hpgadmin@hpg.gov.ph'; SELECT email, first_name, last_name, role, organization, is_active FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"`);
        console.log('─'.repeat(80));
        console.log('');
        console.log('📋 Or use this SQL directly in psql:');
        console.log('─'.repeat(80));
        console.log(`UPDATE users SET password_hash = '${passwordHash}', updated_at = CURRENT_TIMESTAMP WHERE email = 'hpgadmin@hpg.gov.ph';`);
        console.log(`SELECT email, first_name, last_name, role, organization, is_active FROM users WHERE email = 'hpgadmin@hpg.gov.ph';`);
        console.log('─'.repeat(80));
        console.log('');
        console.log('✅ After running the SQL command, you can login with:');
        console.log(`   Email: hpgadmin@hpg.gov.ph`);
        console.log(`   Password: ${newPassword}`);
        
    } catch (error) {
        console.error('❌ Error generating password hash:', error);
        process.exit(1);
    }
}

generatePasswordHash();
