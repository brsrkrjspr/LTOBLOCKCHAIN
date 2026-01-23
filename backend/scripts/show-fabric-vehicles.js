// Script to display all vehicles stored on Hyperledger Fabric blockchain
// Shows what's actually on the blockchain vs what's in PostgreSQL

const fabricService = require('../services/optimizedFabricService');
const path = require('path');

async function showFabricVehicles() {
    try {
        console.log('🔍 Querying Hyperledger Fabric blockchain for vehicles...\n');
        
        // Load environment variables
        const envPath = path.join(__dirname, '../../.env');
        try {
            require('dotenv').config({ path: envPath });
            console.log(`📋 Loaded environment variables from: ${envPath}`);
        } catch (error) {
            require('dotenv').config();
        }
        
        // Check blockchain mode
        const blockchainMode = process.env.BLOCKCHAIN_MODE || 'fabric';
        if (blockchainMode !== 'fabric') {
            console.error('❌ BLOCKCHAIN_MODE must be "fabric" to query Fabric blockchain');
            console.log(`   Current mode: ${blockchainMode}`);
            process.exit(1);
        }
        
        // Connect to Fabric
        if (!fabricService.isConnected) {
            console.log('🔗 Connecting to Fabric network...');
            try {
                await fabricService.initialize();
            } catch (error) {
                console.error('❌ Failed to connect to Fabric:', error.message);
                console.log('\n💡 Make sure Fabric network is running:');
                console.log('   docker-compose -f docker-compose.unified.yml ps | grep -E "peer0|orderer|couchdb"');
                process.exit(1);
            }
        }
        
        console.log('✅ Connected to Fabric network\n');
        
        // Query all vehicles from Fabric
        console.log('📡 Querying GetAllVehicles from chaincode...\n');
        
        try {
            const vehiclesResult = await fabricService.contract.evaluateTransaction('GetAllVehicles');
            
            if (!vehiclesResult || vehiclesResult.length === 0) {
                console.log('📭 No vehicles found on Fabric blockchain.');
                console.log('   The blockchain is empty.\n');
                return;
            }
            
            const vehiclesJson = vehiclesResult.toString();
            let vehicles;
            
            try {
                vehicles = JSON.parse(vehiclesJson);
            } catch (parseError) {
                console.error('❌ Failed to parse vehicles JSON:', parseError);
                console.error('Raw response (first 500 chars):', vehiclesJson.substring(0, 500));
                throw new Error(`Invalid JSON response from chaincode: ${parseError.message}`);
            }
            
            // Ensure vehicles is an array
            if (!Array.isArray(vehicles)) {
                console.warn('⚠️  GetAllVehicles did not return an array, got:', typeof vehicles);
                vehicles = [];
            }
            
            if (vehicles.length === 0) {
                console.log('📭 No vehicles found on Fabric blockchain.');
                console.log('   The blockchain is empty.\n');
                return;
            }
            
            console.log(`✅ Found ${vehicles.length} vehicle(s) on Fabric blockchain:\n`);
            console.log('═'.repeat(100));
            
            vehicles.forEach((vehicle, index) => {
                console.log(`\n${index + 1}. VIN: ${vehicle.vin}`);
                console.log(`   Plate Number: ${vehicle.plateNumber || 'N/A'}`);
                console.log(`   CR Number: ${vehicle.crNumber || 'N/A'}`);
                console.log(`   Make/Model: ${vehicle.make} ${vehicle.model} (${vehicle.year})`);
                console.log(`   Color: ${vehicle.color || 'N/A'}`);
                console.log(`   Status: ${vehicle.status || 'N/A'}`);
                console.log(`   Owner: ${vehicle.owner?.email || 'N/A'} (${vehicle.owner?.firstName || ''} ${vehicle.owner?.lastName || ''})`.trim());
                console.log(`   Registration Date: ${vehicle.registrationDate || vehicle.dateOfRegistration || 'N/A'}`);
                console.log(`   Blockchain TX ID: ${vehicle.blockchainTxId || 'N/A'}`);
                
                // Show verification status
                if (vehicle.verificationStatus) {
                    console.log(`   Verification Status:`);
                    console.log(`     - Insurance: ${vehicle.verificationStatus.insurance || 'N/A'}`);
                    console.log(`     - Emission: ${vehicle.verificationStatus.emission || 'N/A'}`);
                    console.log(`     - Admin: ${vehicle.verificationStatus.admin || 'N/A'}`);
                }
                
                // Show history count
                if (vehicle.history && Array.isArray(vehicle.history)) {
                    console.log(`   History Entries: ${vehicle.history.length}`);
                    if (vehicle.history.length > 0) {
                        const lastAction = vehicle.history[vehicle.history.length - 1];
                        console.log(`   Last Action: ${lastAction.action} at ${lastAction.timestamp}`);
                        if (lastAction.transactionId) {
                            console.log(`   Last TX ID: ${lastAction.transactionId}`);
                        }
                    }
                }
                
                console.log('─'.repeat(100));
            });
            
            console.log(`\n📊 Summary:`);
            console.log(`   Total vehicles on Fabric: ${vehicles.length}`);
            
            // Count by status
            const statusCounts = {};
            vehicles.forEach(v => {
                const status = v.status || 'UNKNOWN';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            
            console.log(`\n   By Status:`);
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`     - ${status}: ${count}`);
            });
            
            // Count by owner
            const ownerCounts = {};
            vehicles.forEach(v => {
                const ownerEmail = v.owner?.email || 'UNKNOWN';
                ownerCounts[ownerEmail] = (ownerCounts[ownerEmail] || 0) + 1;
            });
            
            console.log(`\n   By Owner (top 5):`);
            Object.entries(ownerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([email, count]) => {
                    console.log(`     - ${email}: ${count} vehicle(s)`);
                });
            
            console.log('\n');
            
        } catch (error) {
            console.error('❌ Failed to query vehicles from Fabric:', error.message);
            console.error('   Error details:', error);
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run the script
showFabricVehicles().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
