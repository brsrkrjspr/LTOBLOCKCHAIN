#!/usr/bin/env node
/**
 * Fabric Connection Diagnostic Script
 * Checks actual Fabric connection state and attempts reconnection if needed
 */

const fabricService = require('../backend/services/optimizedFabricService');

async function diagnoseConnection() {
    console.log('🔍 Fabric Connection Diagnostic\n');
    console.log('='.repeat(50));
    
    // Check current status
    const status = fabricService.getStatus();
    console.log('\n📊 Current Status:');
    console.log(JSON.stringify(status, null, 2));
    
    if (!status.isConnected) {
        console.log('\n⚠️  Connection Status: DISCONNECTED');
        console.log('Attempting to reinitialize connection...\n');
        
        try {
            const result = await fabricService.initialize();
            console.log('✅ Reinitialization Result:', result);
            
            // Check status again
            const newStatus = fabricService.getStatus();
            console.log('\n📊 Status After Reinitialization:');
            console.log(JSON.stringify(newStatus, null, 2));
            
            if (newStatus.isConnected) {
                console.log('\n✅ Connection restored successfully!');
                
                // Test a simple query to verify connection works
                try {
                    console.log('\n🧪 Testing connection with a simple query...');
                    const chainInfo = await fabricService.getChainInfo();
                    console.log('✅ Chain Info Query Successful:');
                    console.log(JSON.stringify(chainInfo, null, 2));
                } catch (queryError) {
                    console.error('❌ Query test failed:', queryError.message);
                    console.error('   This suggests connection is not fully functional');
                }
            } else {
                console.log('\n❌ Reinitialization failed - connection still disconnected');
            }
        } catch (initError) {
            console.error('\n❌ Reinitialization Error:', initError.message);
            console.error('\nPossible causes:');
            console.error('  1. Fabric network containers not running');
            console.error('  2. Network configuration file missing or invalid');
            console.error('  3. Admin user not enrolled in wallet');
            console.error('  4. Network connectivity issues');
        }
    } else {
        console.log('\n✅ Connection Status: CONNECTED');
        
        // Test connection with a simple query
        try {
            console.log('\n🧪 Testing connection with a simple query...');
            const chainInfo = await fabricService.getChainInfo();
            console.log('✅ Chain Info Query Successful:');
            console.log(JSON.stringify(chainInfo, null, 2));
        } catch (queryError) {
            console.error('❌ Query test failed:', queryError.message);
            console.error('   Connection flag is true but queries fail - connection may be stale');
        }
    }
    
    console.log('\n' + '='.repeat(50));
}

// Run diagnostic
diagnoseConnection().catch(error => {
    console.error('❌ Diagnostic script error:', error);
    process.exit(1);
});
