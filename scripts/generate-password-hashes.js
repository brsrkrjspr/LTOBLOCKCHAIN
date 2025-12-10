// Script to generate bcrypt password hashes for real accounts
const bcrypt = require('bcryptjs');

const passwords = {
    'admin@lto.gov.ph': 'admin123',
    'hpgadmin@hpg.gov.ph': 'SecurePass123!',
    'insurance@insurance.gov.ph': 'SecurePass123!',
    'emission@emission.gov.ph': 'SecurePass123!',
    'owner@example.com': 'SecurePass123!'
};

async function generateHashes() {
    console.log('Generating password hashes...\n');
    const hashes = {};
    
    for (const [email, password] of Object.entries(passwords)) {
        const hash = await bcrypt.hash(password, 12);
        hashes[email] = hash;
        console.log(`${email}: ${hash}`);
    }
    
    console.log('\n✅ All hashes generated!');
    return hashes;
}

generateHashes().catch(console.error);

