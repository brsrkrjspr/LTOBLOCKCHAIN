// TrustChain LTO - Fabric Wallet Setup Script
// Creates wallet with admin identity for Hyperledger Fabric connection

const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function setupWallet() {
    try {
        console.log('🔐 Setting up Fabric wallet...');

        // Create wallet directory
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
            console.log(`📁 Created wallet directory: ${walletPath}`);
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`📁 Wallet path: ${walletPath}`);
        
        // Check if admin already exists
        const adminExists = await wallet.get('admin');
        if (adminExists) {
            console.log('✅ Admin identity already exists in wallet');
            console.log('💡 To recreate, delete the wallet directory and run this script again');
            return;
        }

        // Paths to certificate and key files
        const certPath = path.join(
            process.cwd(),
            'fabric-network',
            'crypto-config',
            'peerOrganizations',
            'lto.gov.ph',
            'users',
            'Admin@lto.gov.ph',
            'msp',
            'signcerts',
            'Admin@lto.gov.ph-cert.pem'
        );

        const keyDir = path.join(
            process.cwd(),
            'fabric-network',
            'crypto-config',
            'peerOrganizations',
            'lto.gov.ph',
            'users',
            'Admin@lto.gov.ph',
            'msp',
            'keystore'
        );

        // Check if certificate file exists
        if (!fs.existsSync(certPath)) {
            console.error('❌ Certificate file not found:', certPath);
            console.error('💡 Make sure you have generated crypto material first');
            process.exit(1);
        }

        // Check if key directory exists
        if (!fs.existsSync(keyDir)) {
            console.error('❌ Key directory not found:', keyDir);
            console.error('💡 Make sure you have generated crypto material first');
            process.exit(1);
        }

        // Read certificate
        console.log('📄 Reading certificate...');
        const cert = fs.readFileSync(certPath).toString();
        
        // Read private key (find the key file)
        console.log('🔑 Reading private key...');
        const keyFiles = fs.readdirSync(keyDir);
        const keyFile = keyFiles.find(f => f.endsWith('_sk'));
        
        if (!keyFile) {
            console.error('❌ Private key file not found in:', keyDir);
            process.exit(1);
        }

        const key = fs.readFileSync(path.join(keyDir, keyFile)).toString();

        // Create identity
        console.log('👤 Creating identity...');
        const identity = {
            credentials: {
                certificate: cert,
                privateKey: key
            },
            mspId: 'LTOMSP',
            type: 'X.509'
        };

        await wallet.put('admin', identity);
        console.log('✅ Admin identity added to wallet successfully');
        console.log('🎉 Wallet setup complete!');

    } catch (error) {
        console.error('❌ Failed to setup wallet:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run setup
if (require.main === module) {
    setupWallet().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { setupWallet };

