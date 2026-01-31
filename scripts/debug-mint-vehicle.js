
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

// Force Fabric mode
process.env.BLOCKCHAIN_MODE = 'fabric';
process.env.FABRIC_AS_LOCALHOST = 'true'; // Assume running outside docker for this script

const fabricService = require('../backend/services/optimizedFabricService');
const crypto = require('crypto');

async function main() {
    console.log('🚀 Starting Debug Mint Vehicle Script...');

    try {
        // 1. Initialize Fabric
        console.log('1️⃣  Initializing Fabric connection...');
        await fabricService.initialize();
        console.log('✅ Fabric Service Initialized');

        // 2. Query existing to see baseline
        console.log('\n2️⃣  Checking pre-existing vehicles...');
        try {
            const existing = await fabricService.getPreMintedVehicles();
            console.log(`ℹ️  Found ${existing.vehicles.length} pre-minted vehicles.`);
        } catch (e) {
            console.warn('⚠️  Could not query existing vehicles (might be first run):', e.message);
        }

        // 3. GENERATE TEST DATA
        const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const testVin = `TESTVIN${Date.now().toString().slice(-6)}${randomSuffix}`; // 17 chars approx

        const vehicleData = {
            vin: testVin,
            make: 'TOYOTA',
            model: 'VIOS_TEST_UNIT',
            year: '2025',
            color: 'RED',
            vehicleType: 'SEDAN',
            engineNumber: `ENG${randomSuffix}`,
            chassisNumber: `CHAS${randomSuffix}`,
            plateNumber: `TEMP${randomSuffix}`, // Optional for pre-minted
            description: 'Debug Script Minted Vehicle'
        };

        console.log('\n3️⃣  Minting New Vehicle:', vehicleData.vin);

        // 4. MINT
        const result = await fabricService.mintVehicle(vehicleData);
        console.log('✅ Mint Result:', JSON.stringify(result, null, 2));

        if (!result.success) {
            throw new Error('Minting failed!');
        }

        // 5. WAIT & VERIFY
        console.log('\n4️⃣  Waiting 3s for propagation...');
        await new Promise(r => setTimeout(r, 3000));

        console.log('5️⃣  Verifying vehicle presence...');
        const verifyResult = await fabricService.getPreMintedVehicles();
        const found = verifyResult.vehicles.find(v => v.vin === testVin);

        if (found) {
            console.log('🎉 SUCCESS! Vehicle found in Pre-Minted list.');
            console.log('   VIN:', found.vin);
            console.log('   Status:', found.status);
        } else {
            console.error('❌ ERROR: Vehicle was minted but not found in list!');
            console.log('   Full List VINs:', verifyResult.vehicles.map(v => v.vin));
        }

    } catch (error) {
        console.error('\n❌ SCRIPT FAILED:', error);
    } finally {
        // Disconnect
        try {
            await fabricService.disconnect();
            console.log('\nConnection closed.');
        } catch (e) { }
    }
}

main();
