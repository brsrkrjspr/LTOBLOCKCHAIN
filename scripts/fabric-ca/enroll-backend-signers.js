/**
 * TrustChain LTO - Fabric CA Backend Signer Enrollment Script
 * Enrolls backend signer identities (admin-lto, admin-hpg, admin-insurance) via Fabric CA
 * 
 * This script should be run AFTER:
 * 1. Fabric CA services are running
 * 2. CA bootstrap admins are enrolled (via enroll-ca-admins.sh/ps1)
 * 
 * Usage: node scripts/fabric-ca/enroll-backend-signers.js
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const walletPath = path.join(process.cwd(), 'wallet');

// CA Configuration
const caConfig = {
    lto: {
        url: process.env.FABRIC_CA_LTO_URL || 'https://127.0.0.1:7054', // Changed to 127.0.0.1
        caName: 'ca-lto',
        mspId: 'LTOMSP',
        adminUsername: 'admin-lto'
    },
    hpg: {
        url: process.env.FABRIC_CA_HPG_URL || 'https://127.0.0.1:8054', // Changed to 127.0.0.1
        caName: 'ca-hpg',
        mspId: 'HPGMSP',
        adminUsername: 'admin-hpg'
    },
    insurance: {
        url: process.env.FABRIC_CA_INSURANCE_URL || 'https://127.0.0.1:9054', // Changed to 127.0.0.1
        caName: 'ca-insurance',
        mspId: 'InsuranceMSP',
        adminUsername: 'admin-insurance'
    }
};

const caAdminUser = process.env.FABRIC_CA_ADMIN_USERNAME || 'admin';
const caAdminPass = process.env.FABRIC_CA_ADMIN_PASSWORD || 'adminpw';

async function enrollBackendSigner(orgName, config) {
    try {
        console.log(`\n🔐 Enrolling backend signer for ${orgName.toUpperCase()}...`);
        console.log(`   CA URL: ${config.url}`);
        console.log(`   CA Name: ${config.caName}`);
        console.log(`   MSP ID: ${config.mspId}`);
        console.log(`   Identity: ${config.adminUsername}`);

        // Create wallet
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if identity already exists
        const identityExists = await wallet.get(config.adminUsername);
        if (identityExists) {
            console.log(`   ✅ Identity ${config.adminUsername} already exists in wallet`);
            return { success: true, skipped: true };
        }

        // Create CA client
        const ca = new FabricCAServices(config.url, {
            trustedRoots: [],
            verify: false // In production, set to true and provide proper TLS certs
        });

        // Step 1: Enroll CA admin (bootstrap admin)
        console.log(`   📝 Enrolling CA admin (${caAdminUser})...`);
        const caAdminEnrollment = await ca.enroll({
            enrollmentID: caAdminUser,
            enrollmentSecret: caAdminPass
        });

        // Step 2: Register backend signer identity
        console.log(`   📝 Registering backend signer identity (${config.adminUsername})...`);
        const adminUser = {
            username: caAdminUser,
            mspid: config.mspId,
            cryptoContent: {
                privateKeyPEM: caAdminEnrollment.key.toBytes(),
                signedCertPEM: caAdminEnrollment.certificate
            }
        };

        const secret = await ca.register({
            enrollmentID: config.adminUsername,
            enrollmentSecret: config.adminUsername, // Use username as secret (change in production)
            role: 'client',
            attrs: [
                { name: 'role', value: 'admin', ecert: true },
                { name: 'org', value: orgName, ecert: true }
            ]
        }, adminUser);

        // Step 3: Enroll backend signer identity
        console.log(`   📝 Enrolling backend signer identity...`);
        const enrollment = await ca.enroll({
            enrollmentID: config.adminUsername,
            enrollmentSecret: secret
        });

        // Step 4: Create identity and store in wallet
        const identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes()
            },
            mspId: config.mspId,
            type: 'X.509'
        };

        await wallet.put(config.adminUsername, identity);
        console.log(`   ✅ Backend signer ${config.adminUsername} enrolled successfully`);

        return { success: true, identity };

    } catch (error) {
        console.error(`   ❌ Failed to enroll backend signer for ${orgName}:`, error.message);
        throw error;
    }
}

async function main() {
    try {
        console.log('🔐 Fabric CA Backend Signer Enrollment');
        console.log('=====================================');
        console.log(`📁 Wallet path: ${walletPath}`);

        // Ensure wallet directory exists
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
            console.log(`✅ Created wallet directory: ${walletPath}`);
        }

        // Enroll backend signers for all organizations
        const results = {};

        for (const [orgName, config] of Object.entries(caConfig)) {
            try {
                results[orgName] = await enrollBackendSigner(orgName, config);
            } catch (error) {
                console.error(`❌ Failed to enroll ${orgName} backend signer:`, error.message);
                if (error.code) console.error(`   Error Code: ${error.code}`);
                results[orgName] = { success: false, error: error.message };
            }
        }

        // Summary
        console.log('\n📊 Enrollment Summary:');
        console.log('=====================');
        for (const [orgName, result] of Object.entries(results)) {
            if (result.success) {
                if (result.skipped) {
                    console.log(`   ✅ ${orgName.toUpperCase()}: Already enrolled (skipped)`);
                } else {
                    console.log(`   ✅ ${orgName.toUpperCase()}: Enrolled successfully`);
                }
            } else {
                console.log(`   ❌ ${orgName.toUpperCase()}: Failed - ${result.error}`);
            }
        }

        console.log('\n✅ Backend signer enrollment completed');
        console.log('\n📝 Next steps:');
        console.log('   1. Verify identities in wallet: ls wallet/');
        console.log('   2. Test Fabric connection: node scripts/test-fabric-network.js');
        console.log('   3. Start backend application');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { enrollBackendSigner };
