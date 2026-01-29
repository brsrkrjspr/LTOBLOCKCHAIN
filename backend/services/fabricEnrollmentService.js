// TrustChain LTO - Fabric CA Enrollment Service
// Handles dynamic enrollment of application users into Fabric CA

const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');

class FabricEnrollmentService {
  constructor() {
    this.walletPath = path.join(__dirname, '../../wallet');
  }

  // Map application role to Fabric MSP
  getMSPForRole(userRole, userEmail) {
    // LTO roles -> LTOMSP
    if (['lto_admin', 'lto_supervisor', 'lto_officer', 'admin'].includes(userRole)) {
      return 'LTOMSP';
    }
    // HPG roles -> HPGMSP
    if (['hpg_admin', 'hpg_officer'].includes(userRole) || 
        (userRole === 'admin' && userEmail && userEmail.toLowerCase().includes('hpg'))) {
      return 'HPGMSP';
    }
    // Insurance roles -> InsuranceMSP
    if (['insurance_verifier', 'insurance_admin'].includes(userRole)) {
      return 'InsuranceMSP';
    }
    // Default: vehicle_owner -> LTOMSP (for registration)
    return 'LTOMSP';
  }

  // Get CA URL for MSP
  getCAUrlForMSP(mspId) {
    const caMap = {
      'LTOMSP': process.env.FABRIC_CA_LTO_URL || 'https://ca-lto:7054',
      'HPGMSP': process.env.FABRIC_CA_HPG_URL || 'https://ca-hpg:7054',
      'InsuranceMSP': process.env.FABRIC_CA_INSURANCE_URL || 'https://ca-insurance:7054'
    };
    return caMap[mspId];
  }

  // Enroll user when they register in the application
  // NOTE: Only enrolls staff/org accounts, NOT vehicle_owner public signups
  async enrollUser(userEmail, userRole) {
    try {
      const wallet = await Wallets.newFileSystemWallet(this.walletPath);
      
      // Check if user already enrolled
      const userExists = await wallet.get(userEmail);
      if (userExists) {
        console.log(`✅ User ${userEmail} already enrolled`);
        return { success: true, identity: userExists };
      }

      // Get MSP and CA URL
      const mspId = this.getMSPForRole(userRole, userEmail);
      const caUrl = this.getCAUrlForMSP(mspId);
      const caName = `ca-${mspId.replace('MSP', '').toLowerCase()}`;

      // Create CA client
      const ca = new FabricCAServices(caUrl, {
        trustedRoots: [],
        verify: false // In production, set to true and provide proper TLS certs
      });

      // Get admin identity for registration
      const adminUsername = `admin-${mspId.replace('MSP', '').toLowerCase()}`;
      const adminIdentity = await wallet.get(adminUsername);
      if (!adminIdentity) {
        throw new Error(`Admin identity ${adminUsername} not found in wallet. Please run CA setup scripts first.`);
      }

      // Create admin user context for registration
      const adminUser = {
        username: adminUsername,
        mspid: mspId,
        cryptoContent: {
          privateKeyPEM: adminIdentity.credentials.privateKey,
          signedCertPEM: adminIdentity.credentials.certificate
        }
      };

      // Register user with CA
      const secret = await ca.register({
        enrollmentID: userEmail,
        enrollmentSecret: userEmail, // Use email as secret (change in production)
        role: 'client',
        attrs: [
          { name: 'role', value: userRole, ecert: true },
          { name: 'email', value: userEmail, ecert: true }
        ]
      }, adminUser);

      // Enroll user
      const enrollment = await ca.enroll({
        enrollmentID: userEmail,
        enrollmentSecret: secret
      });

      // Create identity
      const identity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes()
        },
        mspId: mspId,
        type: 'X.509'
      };

      // Store in wallet
      await wallet.put(userEmail, identity);
      console.log(`✅ User ${userEmail} enrolled with ${mspId}`);

      return { success: true, identity, mspId };

    } catch (error) {
      console.error(`❌ Failed to enroll user ${userEmail}:`, error);
      throw error;
    }
  }
}

module.exports = new FabricEnrollmentService();
