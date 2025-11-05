// TrustChain LTO - Chaincode Deployment Script
// Deploys the vehicle registration chaincode to Hyperledger Fabric

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function deployChaincode() {
    try {
        console.log('🚀 Starting chaincode deployment...');

        // Load connection profile
        const ccpPath = path.resolve(__dirname, '../network-config.yaml');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📁 Wallet path: ${walletPath}`);

        // Check if admin user exists in wallet
        const adminExists = await wallet.get('admin');
        if (!adminExists) {
            console.log('❌ Admin user not found in wallet. Please run setup first.');
            process.exit(1);
        }

        // Create gateway
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: false }
        });

        // Get network and contract
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('vehicle-registration');

        console.log('📦 Packaging chaincode...');
        
        // Package chaincode
        const chaincodePath = path.resolve(__dirname, '../chaincode/vehicle-registration-production');
        const packagePath = path.resolve(__dirname, '../chaincode-packages/vehicle-registration.tgz');
        
        // Create package directory if it doesn't exist
        const packageDir = path.dirname(packagePath);
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
        }

        // Package the chaincode
        const { execSync } = require('child_process');
        execSync(`cd ${chaincodePath} && npm pack && mv vehicle-registration-chaincode-1.0.0.tgz ${packagePath}`, { stdio: 'inherit' });

        console.log('📤 Installing chaincode...');

        // Install chaincode on peer
        const installRequest = {
            targets: ['peer0.lto.gov.ph'],
            chaincodePath: packagePath,
            chaincodeId: 'vehicle-registration',
            chaincodeVersion: '1.0',
            chaincodeType: 'node'
        };

        await contract.submitTransaction('install', JSON.stringify(installRequest));

        console.log('✅ Chaincode installed successfully');

        // Instantiate chaincode
        console.log('🔧 Instantiating chaincode...');
        
        const instantiateRequest = {
            chaincodeId: 'vehicle-registration',
            chaincodeVersion: '1.0',
            chaincodeType: 'node',
            args: ['init'],
            policy: {
                identities: [
                    { role: { name: 'member', mspId: 'LTOMSP' } }
                ],
                policy: {
                    '1-of': [{ 'signed-by': 0 }]
                }
            }
        };

        await contract.submitTransaction('instantiate', JSON.stringify(instantiateRequest));

        console.log('✅ Chaincode instantiated successfully');

        // Test chaincode
        console.log('🧪 Testing chaincode...');
        
        const testResult = await contract.evaluateTransaction('GetSystemStats');
        console.log('📊 System stats:', testResult.toString());

        console.log('🎉 Chaincode deployment completed successfully!');

        // Disconnect
        await gateway.disconnect();

    } catch (error) {
        console.error('❌ Chaincode deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment
if (require.main === module) {
    deployChaincode();
}

module.exports = { deployChaincode };
