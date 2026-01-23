// Query Fabric vehicles via application connection
const fabricService = require('../services/optimizedFabricService');

(async () => {
  try {
    console.log('🔍 Checking Fabric connection...');
    
    // Check if already connected
    if (!fabricService.isConnected) {
      console.log('🔗 Connecting to Fabric...');
      await fabricService.initialize();
    } else {
      console.log('✅ Already connected');
    }
    
    // Ensure contract is available
    if (!fabricService.contract) {
      throw new Error('Contract not available - connection may have failed');
    }
    
    console.log('📡 Querying GetAllVehicles from chaincode...\n');
    const result = await fabricService.contract.evaluateTransaction('GetAllVehicles');
    
    if (!result || result.length === 0) {
      console.log('📭 No vehicles found on Fabric blockchain.');
      return;
    }
    
    const vehiclesJson = result.toString();
    let vehicles;
    
    try {
      vehicles = JSON.parse(vehiclesJson);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError.message);
      console.log('Raw response (first 500 chars):', vehiclesJson.substring(0, 500));
      return;
    }
    
    if (!Array.isArray(vehicles)) {
      console.warn('⚠️  Response is not an array:', typeof vehicles);
      vehicles = [];
    }
    
    console.log(`✅ Found ${vehicles.length} vehicle(s) on Fabric blockchain:\n`);
    console.log('═'.repeat(80));
    
    vehicles.forEach((vehicle, index) => {
      console.log(`\n${index + 1}. VIN: ${vehicle.vin}`);
      console.log(`   Plate: ${vehicle.plateNumber || 'N/A'}`);
      console.log(`   Status: ${vehicle.status || 'N/A'}`);
      console.log(`   TX ID: ${vehicle.blockchainTxId || 'N/A'}`);
      console.log('─'.repeat(80));
    });
    
    console.log(`\n📊 Summary: ${vehicles.length} total vehicles on Fabric\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    process.exit(1);
  }
})();
