// Environment Variable Validation Script
// Run this before starting the server to check for missing required variables

const requiredVars = {
    'JWT_SECRET': 'Required for JWT token signing and verification',
    'STORAGE_MODE': 'Must be either "ipfs" or "local" (no auto mode)',
    'BLOCKCHAIN_MODE': 'Must be set to "fabric"',
};

const optionalVars = {
    'SMTP_HOST': 'Required if using email notifications',
    'SMTP_USER': 'Required if using email notifications',
    'SMTP_PASS': 'Required if using email notifications',
    'SMTP_PORT': 'Optional (defaults to 587)',
    'SMTP_SECURE': 'Optional (defaults to false)',
    'SMTP_FROM': 'Optional (defaults to SMTP_USER)',
};

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;
const missing = [];
const invalid = [];

// Check required variables
for (const [varName, description] of Object.entries(requiredVars)) {
    const value = process.env[varName];
    if (!value) {
        missing.push({ name: varName, description });
        hasErrors = true;
        console.error(`❌ Missing: ${varName}`);
        console.error(`   ${description}`);
    } else {
        // Validate STORAGE_MODE
        if (varName === 'STORAGE_MODE' && value !== 'ipfs' && value !== 'local') {
            invalid.push({ name: varName, value, expected: 'either "ipfs" or "local"' });
            hasErrors = true;
            console.error(`❌ Invalid: ${varName}=${value}`);
            console.error(`   Expected: either "ipfs" or "local"`);
        }
        // Validate BLOCKCHAIN_MODE
        else if (varName === 'BLOCKCHAIN_MODE' && value !== 'fabric') {
            invalid.push({ name: varName, value, expected: '"fabric"' });
            hasErrors = true;
            console.error(`❌ Invalid: ${varName}=${value}`);
            console.error(`   Expected: "fabric"`);
        } else {
            console.log(`✅ ${varName} is set`);
        }
    }
}

// Check optional but recommended variables
console.log('\n📋 Optional variables (for email notifications):');
let emailConfigured = true;
for (const [varName, description] of Object.entries(optionalVars)) {
    if (varName.startsWith('SMTP_')) {
        const value = process.env[varName];
        if (!value && ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].includes(varName)) {
            emailConfigured = false;
            console.warn(`⚠️  ${varName} not set - email notifications will fail`);
        } else if (value) {
            console.log(`✅ ${varName} is set`);
        }
    }
}

if (!emailConfigured) {
    console.warn('\n⚠️  Email notifications are not fully configured.');
    console.warn('   Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email notifications.');
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
    console.error('\n❌ VALIDATION FAILED');
    console.error('\nMissing or invalid required environment variables:');
    missing.forEach(({ name, description }) => {
        console.error(`  - ${name}: ${description}`);
    });
    invalid.forEach(({ name, value, expected }) => {
        console.error(`  - ${name}=${value} (expected: ${expected})`);
    });
    console.error('\n💡 Fix: Add these variables to your .env file and restart the server.');
    console.error('\nExample .env file:');
    console.error('  JWT_SECRET=your-secret-key-here');
    console.error('  STORAGE_MODE=local  # or "ipfs"');
    console.error('  BLOCKCHAIN_MODE=fabric');
    console.error('  SMTP_HOST=smtp.gmail.com');
    console.error('  SMTP_USER=your-email@gmail.com');
    console.error('  SMTP_PASS=your-app-password');
    process.exit(1);
} else {
    console.log('\n✅ VALIDATION PASSED');
    console.log('   All required environment variables are set correctly.');
    console.log('   Server should start successfully.');
    process.exit(0);
}

