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
        // Try to find the certificate file (name may vary)
        const signcertsDir = path.join(
            process.cwd(),
            'fabric-network',
            'crypto-config',
            'peerOrganizations',
            'lto.gov.ph',
            'users',
            'Admin@lto.gov.ph',
            'msp',
            'signcerts'
        );
        
        if (!fs.existsSync(signcertsDir)) {
            throw new Error(`Certificate directory not found: ${signcertsDir}`);
        }
        
        // Find any .pem file in signcerts directory
        const certFiles = fs.readdirSync(signcertsDir).filter(f => f.endsWith('.pem'));
        if (certFiles.length === 0) {
            throw new Error(`No certificate files found in: ${signcertsDir}`);
        }
        
        const certPath = path.join(signcertsDir, certFiles[0]);

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
        
        if (!fs.existsSync(keyDir)) {
            throw new Error(`Key directory not found: ${keyDir}`);
        }
        
        // Find any key file (usually priv_sk or .pem)
        const keyFiles = fs.readdirSync(keyDir).filter(f => f.endsWith('_sk') || f.endsWith('.pem'));
        if (keyFiles.length === 0) {
            throw new Error(`No key files found in: ${keyDir}`);
        }
        
        const keyPath = path.join(keyDir, keyFiles[0]);

        // Check if certificate file exists
        if (!fs.existsSync(certPath)) {
            console.error('❌ Certificate file not found:', certPath);
            console.error('💡 Make sure you have generated crypto material first');
            process.exit(1);
        }

        // Read certificate
        console.log('📄 Reading certificate from:', certPath);
        let cert;
        try {
            cert = fs.readFileSync(certPath).toString();
        } catch (error) {
            if (error.code === 'EACCES') {
                console.error('❌ Permission denied reading certificate file');
                console.error('💡 Run: sudo chmod -R 755 fabric-network/crypto-config');
                console.error('💡 Or run: sudo chown -R $(whoami):$(whoami) fabric-network/crypto-config');
                throw new Error('Permission denied. Please fix file permissions on crypto-config directory.');
            }
            throw error;
        }
        
        // Read private key
        console.log('🔑 Reading private key from:', keyPath);
        let key;
        try {
            key = fs.readFileSync(keyPath).toString();
        } catch (error) {
            if (error.code === 'EACCES') {
                console.error('❌ Permission denied reading private key file');
                console.error('💡 Run: sudo chmod -R 755 fabric-network/crypto-config');
                console.error('💡 Or run: sudo chown -R $(whoami):$(whoami) fabric-network/crypto-config');
                throw new Error('Permission denied. Please fix file permissions on crypto-config directory.');
            }
            throw error;
        }

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
        await wallet.put('admin-lto', identity); // Multi-org support: admin-lto identity
        console.log('✅ Admin identity added to wallet successfully');
        
        // Ensure admincerts directory exists and has the certificate
        const admincertsDir = path.join(
            process.cwd(),
            'fabric-network',
            'crypto-config',
            'peerOrganizations',
            'lto.gov.ph',
            'users',
            'Admin@lto.gov.ph',
            'msp',
            'admincerts'
        );
        
        if (!fs.existsSync(admincertsDir)) {
            fs.mkdirSync(admincertsDir, { recursive: true });
        }
        
        const admincertsFile = path.join(admincertsDir, 'Admin@lto.gov.ph-cert.pem');
        if (!fs.existsSync(admincertsFile)) {
            fs.copyFileSync(certPath, admincertsFile);
            console.log('✅ Admin certificate copied to admincerts directory');
        }
        
        // Also ensure peer's admincerts has it
        const peerAdmincertsDir = path.join(
            process.cwd(),
            'fabric-network',
            'crypto-config',
            'peerOrganizations',
            'lto.gov.ph',
            'peers',
            'peer0.lto.gov.ph',
            'msp',
            'admincerts'
        );
        
        if (!fs.existsSync(peerAdmincertsDir)) {
            fs.mkdirSync(peerAdmincertsDir, { recursive: true });
        }
        
        const peerAdmincertsFile = path.join(peerAdmincertsDir, 'Admin@lto.gov.ph-cert.pem');
        if (!fs.existsSync(peerAdmincertsFile)) {
            fs.copyFileSync(certPath, peerAdmincertsFile);
            console.log('✅ Admin certificate copied to peer admincerts directory');
        }
        
        // Multi-org support: Setup HPG and Insurance admin identities
        // Note: These will be populated via Fabric CA enrollment scripts
        // For now, we just ensure the wallet structure supports them
        console.log('💡 Note: HPG and Insurance admin identities (admin-hpg, admin-insurance)');
        console.log('   will be created via Fabric CA enrollment scripts (scripts/fabric-ca/)');
        console.log('   after Fabric CA services are running.');
        
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

