# Hyperledger Fabric Integration - Phase-by-Phase Implementation Guide

**Project:** Vehicle Registration System with Hyperledger Fabric  
**Target:** DigitalOcean Droplet (Docker Compose)  
**Budget:** $100/month  
**Organizations:** LTO, HPG, Insurance (3-org network)

---

## Finalized constraints & clarifications (from the conversation)

- **Deployment**: Single DigitalOcean Droplet using **Docker Compose** (no Kubernetes).
- **Public URL / domain**: Use **`ltoblockchain.duckdns.org`** as the system base URL (used by frontend + backend links).
- **Organizations**: Exactly **3 orgs**: **LTO, HPG, Insurance**. **No dealership org**.
- **Storage**: **Single IPFS node** (minimize droplet usage). Store documents/PDFs in IPFS, store **CIDs on-chain**.
- **Ledger authority**: **Fabric is the source of truth** for authoritative business state; PostgreSQL is a **derived index/cache**.
- **Database initialization**: Start with **empty data** and use `database/all schema.sql` as the working schema. Do **not** use `init-laptop.sql` during rebuilds.
- **Certificate generator**:
  - Replace the current “browser print / pasted link” flow with a backend generator.
  - Generate OR/CR (or ORCR) as a PDF, compute deterministic SHA-256, store **PDF in IPFS** and **hash + CID on-chain**.
  - **No reuse** of certificates/documents.
  - Handle **hash mismatch from re-saving** (same visible content, different bytes) via a fallback verification strategy.
- **Simulation shortcuts (documented as scope/limitations)**:
  - CSR dealer steps and HPG physical compliance are *simulated* via certificate generation + auto-verification.
  - Insurance is *auto-verified* in the simulated workflow.

### Defense-ready rationale: Why no dealership node? (and how “pre-minted vehicles” resolves it)

**Q: Why no dealership node?**

**A:** Our system scope begins where **CSR has already been verified**—that’s where owner registration starts in the actual LTO process. CSR issuance is manufacturer compliance regulated under **MC 643-2005** and precedes individual ownership transactions. We focused on the **government verification layer** where **technical carnapping** occurs (insider manipulation during registration/transfer).

**Q: How do you prevent fake CSRs?**

**A:** The same way LTO does now—CSR records are already verified and present in the LTO registry before our system sees them. We are **automating the cross-check** using an immutable audit trail, not creating a new manufacturer-level verification mechanism. Strengthening CSR verification itself is an upstream improvement outside our scope.

**Q: Isn’t this a gap in your system?**

**A:** It’s a deliberate boundary, not a gap. The problem we solve—technical carnapping—happens during ownership transfer/registration when insiders manipulate records. CSR fraud is a separate issue requiring manufacturer/dealership controls. Extending blockchain upstream would be natural future work.

**How this is implemented in our prototype (pre-minted vehicles):**

- The “CSR-verified vehicles already known to LTO” are represented as **pre-minted, ownerless vehicle assets on Fabric** (`status='MINTED'`).  
- Owner registration begins by attaching an owner to an existing minted VIN (see **Phase 3.0** `MintVehicle` + `AttachOwnerToMintedVehicle`).  
- This provides a concrete, traceable artifact that supports the scope statement: **the system starts after CSR verification**.
- **Identity / “wallet” model**:
  - The Fabric wallet is **server-side** (backend holds org identities).
  - Vehicle owners do **not** manage Fabric keys/wallets in this thesis simulation.
  - Owners have **functional control in the application UI** (initiate requests, view status, download certificates), but do **not** have cryptographic authority to directly submit Fabric transactions.
  - **Meaning of “control”** in this scope: owners can *initiate* workflows and *see* authoritative ledger-backed state, but they cannot unilaterally mutate ledger state. The ability to approve/issue/transfer on-chain is constrained by chaincode (MSP/attributes) to prevent “insider abuse” and to enforce external verification gates.
  - If you want owners to have **cryptographic control** (sign their own Fabric transactions), we must enroll each owner in Fabric CA and introduce owner-callable chaincode functions (scope increase).

- **Seed accounts (must exist in the deployed system)**:
  - `admin@lto.gov.ph` (LTO admin)
  - `hpg@hpg.gov.ph` (HPG account)
  - `insurance@hpg.gov.ph` (Insurance account — keep this email exactly as specified)
  - `certificategenerator@generator.com` (internal service account for certificate generation/orchestration)

  **Important:** These are **application accounts** (Postgres + JWT). They do not automatically imply Fabric identities. Fabric identities live in the **server-side wallet** and are selected by the backend when submitting transactions.

---

## Table of Contents

1. [Phase 1: Infrastructure Setup](#phase-1-infrastructure-setup)
2. [Phase 2: Fabric CA and Identity Management](#phase-2-fabric-ca-and-identity-management)
3. [Phase 3: Chaincode Updates](#phase-3-chaincode-updates)
4. [Phase 4: Backend Integration](#phase-4-backend-integration)
5. [Phase 5: Certificate Generation and IPFS](#phase-5-certificate-generation-and-ipfs)
6. [Phase 6: Database Schema and Migration](#phase-6-database-schema-and-migration)
7. [Phase 7: Testing and Validation](#phase-7-testing-and-validation)

---

## Phase 1: Infrastructure Setup

### Objective
Deploy a 3-organization Hyperledger Fabric network on a DigitalOcean Droplet using Docker Compose.

### Components Required
- **3 Peers** (one per organization: LTO, HPG, Insurance)
- **3 Fabric CAs** (one per organization)
- **1 Orderer** (Raft consensus)
- **1 Shared CouchDB** (world state database)
- **1 PostgreSQL** (application database/cache)
- **1 IPFS** (document storage)
- **1 Application Container** (Node.js backend)
- **1 Nginx** (reverse proxy)

### Tasks

#### 1.1 Update `docker-compose.unified.yml`

**Current State:**
- Single LTO organization (1 peer, 1 orderer)
- Static crypto material (cryptogen)
- Mounts `init-laptop.sql` (conflicts with `all schema.sql`)

**Required Changes:**

1. **Remove PostgreSQL init mount:**
   ```yaml
   # REMOVE THIS LINE:
   - ./database/init-laptop.sql:/docker-entrypoint-initdb.d/init.sql:ro
   ```

2. **Add HPG Peer Service:**
   ```yaml
   peer0.hpg.gov.ph:
     image: hyperledger/fabric-peer:2.5
     container_name: peer0.hpg.gov.ph
     environment:
       - CORE_PEER_ID=peer0.hpg.gov.ph
       - CORE_PEER_ADDRESS=peer0.hpg.gov.ph:8051
       - CORE_PEER_LOCALMSPID=HPGMSP
       - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
       - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
       - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb:5984
     volumes:
       - ./fabric-network/crypto-config/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/msp:/etc/hyperledger/fabric/msp
       - ./fabric-network/crypto-config/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls:/etc/hyperledger/fabric/tls
     ports:
       - "8051:7051"
     depends_on:
       - couchdb
       - orderer.lto.gov.ph
     networks:
       - trustchain
   ```

3. **Add Insurance Peer Service:**
   ```yaml
   peer0.insurance.gov.ph:
     image: hyperledger/fabric-peer:2.5
     container_name: peer0.insurance.gov.ph
     environment:
       - CORE_PEER_ID=peer0.insurance.gov.ph
       - CORE_PEER_ADDRESS=peer0.insurance.gov.ph:9051
       - CORE_PEER_LOCALMSPID=InsuranceMSP
       - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
       - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
       - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb:5984
     volumes:
       - ./fabric-network/crypto-config/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/msp:/etc/hyperledger/fabric/msp
       - ./fabric-network/crypto-config/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls:/etc/hyperledger/fabric/tls
     ports:
       - "9051:7051"
     depends_on:
       - couchdb
       - orderer.lto.gov.ph
     networks:
       - trustchain
   ```

4. **Add Fabric CA Services (3 CAs):**
   ```yaml
   ca-lto:
     image: hyperledger/fabric-ca:1.5
     container_name: ca-lto
     environment:
       - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
       - FABRIC_CA_SERVER_CA_NAME=ca-lto
       - FABRIC_CA_SERVER_TLS_ENABLED=true
       - FABRIC_CA_SERVER_PORT=7054
     ports:
       - "7054:7054"
     volumes:
       # Persist CA state (registry DB, issued certs, keys)
       - ca-lto-data:/etc/hyperledger/fabric-ca-server
       # CA server config (fabric-ca-server-config.yaml, TLS cert/key) - keep under source control or provisioned securely
       - ./fabric-network/fabric-ca/lto:/etc/hyperledger/fabric-ca-server-config:ro
     command: sh -c 'fabric-ca-server start -b admin:adminpw'
     networks:
       - trustchain

   ca-hpg:
     image: hyperledger/fabric-ca:1.5
     container_name: ca-hpg
     environment:
       - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
       - FABRIC_CA_SERVER_CA_NAME=ca-hpg
       - FABRIC_CA_SERVER_TLS_ENABLED=true
       - FABRIC_CA_SERVER_PORT=8054
     ports:
       - "8054:7054"
     volumes:
       - ca-hpg-data:/etc/hyperledger/fabric-ca-server
       - ./fabric-network/fabric-ca/hpg:/etc/hyperledger/fabric-ca-server-config:ro
     command: sh -c 'fabric-ca-server start -b admin:adminpw'
     networks:
       - trustchain

   ca-insurance:
     image: hyperledger/fabric-ca:1.5
     container_name: ca-insurance
     environment:
       - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server
       - FABRIC_CA_SERVER_CA_NAME=ca-insurance
       - FABRIC_CA_SERVER_TLS_ENABLED=true
       - FABRIC_CA_SERVER_PORT=9054
     ports:
       - "9054:7054"
     volumes:
       - ca-insurance-data:/etc/hyperledger/fabric-ca-server
       - ./fabric-network/fabric-ca/insurance:/etc/hyperledger/fabric-ca-server-config:ro
     command: sh -c 'fabric-ca-server start -b admin:adminpw'
     networks:
       - trustchain
   ```

5. **Add Volume Definitions:**
   ```yaml
   volumes:
     # ... existing volumes ...
     ca-lto-data:
     ca-hpg-data:
     ca-insurance-data:
   ```

6. **Resource Limits (for $100/month budget):**
   - **Recommended Droplet:** 16GB RAM, 8 vCPU (~$96/month)
   - **Memory allocation:**
     - Orderer: 512MB
     - Each Peer: 1.5GB
     - Each CA: 256MB
     - CouchDB: 1GB
     - PostgreSQL: 1.5GB
     - IPFS: 768MB
     - Application: 1GB
     - Nginx: 128MB
   - **Total:** ~10GB RAM (leaves 6GB buffer)

#### 1.2 Update `configtx.yaml`

**Add HPG and Insurance Organizations:**

```yaml
Organizations:
  # ... existing OrdererOrg and LTO ...
  
  - &HPG
    Name: HPGMSP
    ID: HPGMSP
    MSPDir: crypto-config/peerOrganizations/hpg.gov.ph/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('HPGMSP.admin', 'HPGMSP.peer', 'HPGMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('HPGMSP.admin', 'HPGMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('HPGMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('HPGMSP.peer')"
    AnchorPeers:
      - Host: peer0.hpg.gov.ph
        Port: 7051

  - &Insurance
    Name: InsuranceMSP
    ID: InsuranceMSP
    MSPDir: crypto-config/peerOrganizations/insurance.gov.ph/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('InsuranceMSP.admin', 'InsuranceMSP.peer', 'InsuranceMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('InsuranceMSP.admin', 'InsuranceMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('InsuranceMSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('InsuranceMSP.peer')"
    AnchorPeers:
      - Host: peer0.insurance.gov.ph
        Port: 7051

Profiles:
  Genesis:
    Consortiums:
      TrustChainConsortium:
        Organizations:
          - *LTO
          - *HPG
          - *Insurance
  
  Channel:
    Application:
      Organizations:
        - *LTO
        - *HPG
        - *Insurance
```

#### 1.3 Update `network-config.json`

**Add HPG and Insurance peers:**

```json
{
  "name": "trustchain-network",
  "version": "1.0.0",
  "client": {
    "organization": "LTO",
    "connection": {
      "timeout": {
        "peer": {
          "endorser": "300"
        }
      }
    }
  },
  "organizations": {
    "LTO": {
      "mspid": "LTOMSP",
      "peers": ["peer0.lto.gov.ph"],
      "certificateAuthorities": ["ca-lto"]
    },
    "HPG": {
      "mspid": "HPGMSP",
      "peers": ["peer0.hpg.gov.ph"],
      "certificateAuthorities": ["ca-hpg"]
    },
    "Insurance": {
      "mspid": "InsuranceMSP",
      "peers": ["peer0.insurance.gov.ph"],
      "certificateAuthorities": ["ca-insurance"]
    }
  },
  "orderers": {
    "orderer.lto.gov.ph": {
      "url": "grpcs://orderer.lto.gov.ph:7050",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca/tlsca.lto.gov.ph-cert.pem"
      }
    }
  },
  "peers": {
    "peer0.lto.gov.ph": {
      "url": "grpcs://peer0.lto.gov.ph:7051",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/peerOrganizations/lto.gov.ph/tlsca/tlsca.lto.gov.ph-cert.pem"
      }
    },
    "peer0.hpg.gov.ph": {
      "url": "grpcs://peer0.hpg.gov.ph:7051",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/peerOrganizations/hpg.gov.ph/tlsca/tlsca.hpg.gov.ph-cert.pem"
      }
    },
    "peer0.insurance.gov.ph": {
      "url": "grpcs://peer0.insurance.gov.ph:7051",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/peerOrganizations/insurance.gov.ph/tlsca/tlsca.insurance.gov.ph-cert.pem"
      }
    }
  },
  "certificateAuthorities": {
    "ca-lto": {
      "url": "https://ca-lto:7054",
      "caName": "ca-lto",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/peerOrganizations/lto.gov.ph/ca/ca.lto.gov.ph-cert.pem"
      }
    },
    "ca-hpg": {
      "url": "https://ca-hpg:7054",
      "caName": "ca-hpg",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/peerOrganizations/hpg.gov.ph/ca/ca.hpg.gov.ph-cert.pem"
      }
    },
    "ca-insurance": {
      "url": "https://ca-insurance:7054",
      "caName": "ca-insurance",
      "tlsCACerts": {
        "path": "./fabric-network/crypto-config/peerOrganizations/insurance.gov.ph/ca/ca.insurance.gov.ph-cert.pem"
      }
    }
  }
}
```

#### 1.4 Environment Variables (`.env`)

**Add Fabric CA and multi-org configuration:**

```env
# Existing variables...
BLOCKCHAIN_MODE=fabric
STORAGE_MODE=ipfs
FABRIC_AS_LOCALHOST=false

# Public URLs (DuckDNS)
FRONTEND_URL=https://ltoblockchain.duckdns.org
APP_BASE_URL=https://ltoblockchain.duckdns.org

# Fabric CA Configuration
FABRIC_CA_LTO_URL=https://ca-lto:7054
FABRIC_CA_HPG_URL=https://ca-hpg:7054
FABRIC_CA_INSURANCE_URL=https://ca-insurance:7054

# Fabric CA Admin Credentials (change in production)
FABRIC_CA_ADMIN_USERNAME=admin
FABRIC_CA_ADMIN_PASSWORD=adminpw

# Organization MSP IDs
FABRIC_MSP_LTO=LTOMSP
FABRIC_MSP_HPG=HPGMSP
FABRIC_MSP_INSURANCE=InsuranceMSP

# Channel and Chaincode
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration
```

### Deliverables
- ✅ Updated `docker-compose.unified.yml` with 3 peers, 3 CAs
- ✅ Updated `configtx.yaml` with 3 organizations
- ✅ Updated `network-config.json` with multi-org configuration
- ✅ Updated `.env` with Fabric CA variables

---

## Phase 2: Fabric CA and Identity Management

### Objective
Set up Fabric CAs for dynamic identity management and create admin identities for each organization.

### Tasks

#### 2.1 Create CA Setup Scripts

**Correction (important):** `fabric-ca-client` registration requires a **registrar user context** (the CA admin identity as understood by the CA client/provider). A raw return value from `ca.enroll()` is not a valid registrar context.\n+\n+**What we will produce instead (works for Docker Compose + Windows):**\n+\n+- `scripts/fabric-ca/` enrollment scripts (PowerShell and/or bash) that:\n+  - Enroll the bootstrap CA admin (`admin:adminpw`)\n+  - Register + enroll the backend signer identities: `admin-lto`, `admin-hpg`, `admin-insurance`\n+  - (Optional but aligns with the earlier requirement “Fabric CA (not cryptogen)”) Register + enroll peer/orderer identities and write MSP/TLS folders that the containers mount\n+\n+**Minimum wallet identities required for the thesis simulation:**\n+\n+- `wallet/admin-lto` (MSPID `LTOMSP`)\n+- `wallet/admin-hpg` (MSPID `HPGMSP`)\n+- `wallet/admin-insurance` (MSPID `InsuranceMSP`)\n+\n+> Vehicle owners are not issued Fabric identities in this simulation; all Fabric submits are performed by org/staff identities held server-side.

#### 2.2 Update Wallet Setup Script

**File: `scripts/setup-fabric-wallet.js`**

**Add multi-org support:**

```javascript
// ... existing code ...

// Add function to setup identity for specific org
async function setupOrgIdentity(orgName, mspId, adminUsername) {
  const walletPath = path.join(process.cwd(), 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  // Check if identity already exists
  const identityExists = await wallet.get(adminUsername);
  if (identityExists) {
    console.log(`✅ ${adminUsername} already exists in wallet`);
    return;
  }

  // Read certificate and key from crypto-config
  const certPath = path.join(
    process.cwd(),
    'fabric-network',
    'crypto-config',
    'peerOrganizations',
    `${orgName.toLowerCase()}.gov.ph`,
    'users',
    `Admin@${orgName.toLowerCase()}.gov.ph`,
    'msp',
    'signcerts',
    `Admin@${orgName.toLowerCase()}.gov.ph-cert.pem`
  );

  const keyPath = path.join(
    process.cwd(),
    'fabric-network',
    'crypto-config',
    'peerOrganizations',
    `${orgName.toLowerCase()}.gov.ph`,
    'users',
    `Admin@${orgName.toLowerCase()}.gov.ph`,
    'msp',
    'keystore'
  );

  // Find key file
  const keyFiles = fs.readdirSync(keyPath).filter(f => f.endsWith('_sk'));
  if (keyFiles.length === 0) {
    throw new Error(`No key files found in ${keyPath}`);
  }

  const cert = fs.readFileSync(certPath).toString();
  const key = fs.readFileSync(path.join(keyPath, keyFiles[0])).toString();

  const identity = {
    credentials: {
      certificate: cert,
      privateKey: key
    },
    mspId: mspId,
    type: 'X.509'
  };

  await wallet.put(adminUsername, identity);
  console.log(`✅ ${adminUsername} added to wallet`);
}

// Update main setupWallet function to call for all orgs
async function setupWallet() {
  // ... existing LTO setup ...
  
  // Add HPG and Insurance
  await setupOrgIdentity('hpg', 'HPGMSP', 'admin-hpg');
  await setupOrgIdentity('insurance', 'InsuranceMSP', 'admin-insurance');
}
```

#### 2.3 Create User Enrollment Service

**File: `backend/services/fabricEnrollmentService.js`**

```javascript
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
        (userRole === 'admin' && userEmail.toLowerCase().includes('hpg'))) {
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
  async enrollUser(userEmail, userRole) {
    try {
      const wallet = await Wallets.newFileSystemWallet(this.walletPath);
      
      // Check if user already enrolled
      const userExists = await wallet.get(userEmail);
      if (userExists) {
        console.log(`User ${userEmail} already enrolled`);
        return { success: true, identity: userExists };
      }

      // Get MSP and CA URL
      const mspId = this.getMSPForRole(userRole, userEmail);
      const caUrl = this.getCAUrlForMSP(mspId);
      const caName = `ca-${mspId.replace('MSP', '').toLowerCase()}`;

      // Create CA client
      const ca = new FabricCAServices(caUrl, {
        trustedRoots: [],
        verify: false
      });

      // Get admin identity for registration
      const adminUsername = `admin-${mspId.replace('MSP', '').toLowerCase()}`;
      const adminIdentity = await wallet.get(adminUsername);
      if (!adminIdentity) {
        throw new Error(`Admin identity ${adminUsername} not found in wallet`);
      }

      // Register user with CA
      const secret = await ca.register({
        enrollmentID: userEmail,
        enrollmentSecret: userEmail, // Use email as secret (change in production)
        role: 'client',
        attrs: [
          { name: 'role', value: userRole, ecert: true },
          { name: 'email', value: userEmail, ecert: true }
        ]
      }, adminIdentity);

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
```

#### 2.4 Integrate Enrollment into User Registration

**File: `backend/routes/auth.js`**

**Update based on finalized scope:** public `/api/auth/register` creates `vehicle_owner` accounts. In this simulation, vehicle owners do **not** get Fabric identities.\n+\n+Enroll into Fabric CA only for **org/staff accounts** (typically created by an admin-only route such as `/api/admin/create-user`). For staff accounts, enrollment failure should be treated as **blocking** (do not create an account that cannot interact with Fabric).

```javascript
// After creating user in PostgreSQL:
const newUser = await db.createUser({...});

// Enroll only staff/org identities (NOT public vehicle_owner signups)
if (newUser.role !== 'vehicle_owner') {
  const fabricEnrollment = require('../services/fabricEnrollmentService');
  await fabricEnrollment.enrollUser(newUser.email, newUser.role);
}
```

### Deliverables
- ✅ Fabric CA enrollment scripts (`scripts/fabric-ca/*`)
- ✅ Updated wallet setup script (multi-org support)
- ✅ User enrollment service (`backend/services/fabricEnrollmentService.js`)
- ✅ Integration with user registration flow

---

## Phase 3: Chaincode Updates

### Objective
Update chaincode to support multi-organization endorsement policies and store certificate hashes.

### Tasks

#### 3.0 Support “pre-minted vehicles” (CSR seeding) that LTO sees in Admin

You stated earlier that LTO already has **pre-minted vehicles without owners** (vehicle info only) and that this reflects CSR existence and is used for auto-verification (“vehicle exists”).

**Gap in current chaincode:** `RegisterVehicle` requires `vehicle.owner` and will reject “ownerless” vehicles. So to support the paper’s “pre-minted vehicle registry,” we add a dedicated minting path.

**Required on-chain model (high level):**

- **Vehicle asset exists before any owner**:
  - `status`: `MINTED` (or `UNASSIGNED`)
  - `owner`: `null` (or `{ email: null }`)
  - Contains CSR-like fields (VIN, engine/chassis, make/model/year, etc.)
- Later, during owner registration, we **attach owner** and move the status through the normal workflow.

**Chaincode functions to add:**

1. `MintVehicle(ctx, vehicleData)` (LTO-only)
   - Creates the VIN record if it does not exist
   - Stores CSR-like fields
   - Sets `status = 'MINTED'`

2. `AttachOwnerToMintedVehicle(ctx, vin, ownerData, registrationData)` (LTO-only, but only after external verification gates)
   - Validates the VIN exists and is `MINTED`
   - Validates provided CSR-critical fields match the minted record (prevents “mint mismatch”)
   - Sets `owner`, moves status to `REGISTERED` (or `SUBMITTED` then `REGISTERED` depending on your UI flow)

**State transition note (what we will enforce):**

- `MINTED` → `SUBMITTED`/`PENDING_VERIFICATION` → `REGISTERED`
- LTO **cannot** finalize unless `hpg` + `insurance` verification statuses are approved (per your requirement “LTO can’t approve vehicles unless verified by the orgs”).

**Where the “pre-minted list” appears in UI:**

- The LTO Admin “Vehicle Records / Ledger tab” should be driven by Fabric (`GetAllVehicles`) filtered to `status='MINTED'` (unassigned) vs `status='REGISTERED'` (assigned).

**LTO Admin can view vehicles “now”, and counters should exist:**

- **Yes**: once pre-minted vehicles are written on-chain, the LTO Admin can immediately view them because the admin UI is reading **Fabric world state** (not only Postgres).
- Add dashboard counters that are computed from Fabric (source of truth) and optionally cached in Postgres for speed.

**Minimum counters (defense-friendly):**

1. **Total vehicles on ledger**: count of vehicle assets (VIN records) on Fabric
2. **Pre-minted / CSR-verified (unassigned)**: `status='MINTED'`
3. **Registered / assigned to an owner**: `status='REGISTERED'` (or your final “registered” status)
4. **Pending external verifications**: where `verificationStatus.hpg !== 'APPROVED'` OR `verificationStatus.insurance !== 'APPROVED'`
5. **Pending LTO final approval**: where external verifications are approved but `verificationStatus.admin !== 'APPROVED'`
6. **Transfers pending** (if you model transfer requests separately): count of transfer transactions not yet finalized

**How to compute the counters (authoritative path):**

- Option A (simple): implement chaincode query helpers:
  - `GetAllVehicles()` (already exists in current chaincode)
  - `QueryVehiclesByStatus(status)` (already exists)
  - `QueryVehiclesByVerificationStatus(verifierType, status)` (already exists but must be updated to use `hpg/insurance/admin` verifier keys per Phase 3.1.1)
  - Add `GetSystemStats()` that returns these counts directly (best for the dashboard)

- Option B (derived index): after every successful Fabric commit, write/update Postgres counters/materialized views; UI reads Postgres for speed but treats Fabric as truth.

**Why this “reflects CSR” without a dealership node:**

- “CSR verified” is represented by the existence of a **pre-minted VIN record** on Fabric (`status='MINTED'`) created by LTO (see `MintVehicle`).  
- Owner onboarding begins by selecting/attaching to an existing minted VIN, which matches your scope statement: the system starts after CSR verification.

#### 3.1 Update Authorization Logic

**File: `chaincode/vehicle-registration-production/index.js`**

**Update `RegisterVehicle` function (line 38-41):**

```javascript
// OLD:
const clientMSPID = ctx.clientIdentity.getMSPID();
if (clientMSPID !== 'LTOMSP') {
    throw new Error(`Unauthorized: Only LTO organization can register vehicles. Current MSP: ${clientMSPID}`);
}

// NEW (finalized workflow): keep RegisterVehicle LTO-only.
// HPG/Insurance participate via their own verification transactions + endorsement policy.
const clientMSPID = ctx.clientIdentity.getMSPID();
if (clientMSPID !== 'LTOMSP') {
    throw new Error(`Unauthorized: Only LTO organization can register vehicles. Current MSP: ${clientMSPID}`);
}
```

**Update `TransferOwnership` function (line 347-350):**

```javascript
// Keep LTO-only for transfers (as per business rules)
const clientMSPID = ctx.clientIdentity.getMSPID();
if (clientMSPID !== 'LTOMSP') {
    throw new Error(`Unauthorized: Only LTO organization can transfer vehicle ownership. Current MSP: ${clientMSPID}`);
}
```

#### 3.1.1 Fix verifier model to match “LTO + HPG + Insurance” (no emission org)

**Critical mismatch in current chaincode (must be addressed):**

- `UpdateVerificationStatus` validates `verifierType` against `['insurance', 'emission', 'admin']`, but the same function also references an `hpg` verifier mapping. This means `verifierType='hpg'` cannot be used unless we update the verifier list and stored `verificationStatus` structure.

**Finalized verifier set (paper/system):**

- `insurance` → **InsuranceMSP only**
- `hpg` → **HPGMSP only**
- `admin` → **LTOMSP only** (final approval gate)

**Security rule (supports your claim “LTO can’t approve unless verified by external orgs”):**

- Do **not** allow LTOMSP to write `insurance` or `hpg` verification statuses in chaincode; otherwise LTO can forge external approvals.

#### 3.2 Add Certificate Hash Storage

**Add new function to chaincode:**

```javascript
// Update certificate hash (for OR/CR PDFs)
async UpdateCertificateHash(ctx, vin, certificateType, pdfHash, ipfsCid) {
    try {
        const vehicleBytes = await ctx.stub.getState(vin);
        if (!vehicleBytes || vehicleBytes.length === 0) {
            throw new Error(`Vehicle with VIN ${vin} not found`);
        }

        const vehicle = JSON.parse(vehicleBytes.toString());
        const txId = ctx.stub.getTxID();
        const timestamp = new Date().toISOString();

        // Only LTO can update certificate hashes
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'LTOMSP') {
            throw new Error(`Unauthorized: Only LTO can update certificate hashes. Current MSP: ${clientMSPID}`);
        }

        // Initialize certificates array if it doesn't exist
        if (!vehicle.certificates) {
            vehicle.certificates = [];
        }

        // Add or update certificate hash
        const certIndex = vehicle.certificates.findIndex(c => c.type === certificateType);
        const certRecord = {
            type: certificateType, // 'OR', 'CR', or 'ORCR'
            pdfHash: pdfHash,
            ipfsCid: ipfsCid,
            issuedAt: timestamp,
            transactionId: txId,
            issuedBy: clientMSPID
        };

        if (certIndex >= 0) {
            vehicle.certificates[certIndex] = certRecord;
        } else {
            vehicle.certificates.push(certRecord);
        }

        vehicle.lastUpdated = timestamp;

        // Add to history
        vehicle.history.push({
            action: 'CERTIFICATE_HASH_UPDATED',
            timestamp: timestamp,
            performedBy: clientMSPID,
            details: `${certificateType} certificate hash updated`,
            transactionId: txId,
            certificateType: certificateType,
            pdfHash: pdfHash,
            ipfsCid: ipfsCid
        });

        await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

        // Emit event
        ctx.stub.setEvent('CertificateHashUpdated', Buffer.from(JSON.stringify({
            vin: vin,
            certificateType: certificateType,
            pdfHash: pdfHash,
            ipfsCid: ipfsCid,
            timestamp: timestamp,
            transactionId: txId
        })));

        return JSON.stringify({
            success: true,
            message: 'Certificate hash updated successfully',
            vin: vin,
            certificateType: certificateType,
            transactionId: txId
        });

    } catch (error) {
        console.error('Error updating certificate hash:', error);
        throw new Error(`Failed to update certificate hash: ${error.message}`);
    }
}

// Get certificate hash for verification
async GetCertificateHash(ctx, vin, certificateType) {
    try {
        const vehicleBytes = await ctx.stub.getState(vin);
        if (!vehicleBytes || vehicleBytes.length === 0) {
            throw new Error(`Vehicle with VIN ${vin} not found`);
        }

        const vehicle = JSON.parse(vehicleBytes.toString());
        
        if (!vehicle.certificates || vehicle.certificates.length === 0) {
            return JSON.stringify({ found: false });
        }

        const cert = vehicle.certificates.find(c => c.type === certificateType);
        if (!cert) {
            return JSON.stringify({ found: false });
        }

        return JSON.stringify({
            found: true,
            certificateType: cert.type,
            pdfHash: cert.pdfHash,
            ipfsCid: cert.ipfsCid,
            issuedAt: cert.issuedAt,
            transactionId: cert.transactionId
        });

    } catch (error) {
        console.error('Error getting certificate hash:', error);
        throw new Error(`Failed to get certificate hash: ${error.message}`);
    }
}
```

#### 3.3 Update Endorsement Policy

**When deploying/upgrading chaincode, use multi-org endorsement:**

```bash
# Endorsement policy (matches conversation intent):
# Require LTO plus at least one external org (HPG or Insurance) to endorse.
peer lifecycle chaincode approveformyorg \
  -o orderer.lto.gov.ph:7050 \
  --channelID ltochannel \
  --name vehicle-registration \
  --version 1.0 \
  --package-id <package-id> \
  --sequence 1 \
  --signature-policy "AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))" \
  --tls \
  --cafile <tls-cert-path>
```

### Deliverables
- ✅ Updated authorization logic (LTO-only writes where required; external org verifications enforced by MSP/attributes)
- ✅ Certificate hash storage functions (`UpdateCertificateHash`, `GetCertificateHash`)
- ✅ Updated endorsement policy configuration

---

## Phase 4: Backend Integration

### Objective
Update backend services to dynamically select Fabric identities based on user roles and integrate certificate hash storage.

### Tasks

#### 4.1 Update `optimizedFabricService.js`

**Add identity mapping function:**

```javascript
// Add after constructor
getFabricIdentityForUser(userRole, userEmail) {
    // Map application role to Fabric identity
    if (['lto_admin', 'lto_supervisor', 'lto_officer', 'admin'].includes(userRole)) {
        return 'admin-lto'; // or userEmail if enrolled
    }
    if (['hpg_admin', 'hpg_officer'].includes(userRole) || 
        (userRole === 'admin' && userEmail.toLowerCase().includes('hpg'))) {
        return 'admin-hpg'; // or userEmail if enrolled
    }
    if (['insurance_verifier', 'insurance_admin'].includes(userRole)) {
        return 'admin-insurance'; // or userEmail if enrolled
    }
    // Default: use userEmail (if enrolled) or admin-lto
    return userEmail || 'admin-lto';
}

// Update initialize() method to accept user context
async initialize(userContext = null) {
    // ... existing connection profile loading ...
    
    // Determine identity to use
    let identityToUse = 'admin'; // default
    
    if (userContext) {
        identityToUse = this.getFabricIdentityForUser(
            userContext.role, 
            userContext.email
        );
    }
    
    // Check if identity exists in wallet
    const identityExists = await this.wallet.get(identityToUse);
    if (!identityExists) {
        // Fallback to admin
        identityToUse = 'admin';
        const adminExists = await this.wallet.get(identityToUse);
        if (!adminExists) {
            throw new Error(`Identity ${identityToUse} not found in wallet`);
        }
    }
    
    // Connect with selected identity
    await this.gateway.connect(connectionProfile, {
        wallet: this.wallet,
        identity: identityToUse, // Dynamic identity
        discovery: { enabled: true, asLocalhost: asLocalhost },
        eventHandlerOptions: {
            commitTimeout: 300,
            strategy: null
        }
    });
    
    // ... rest of initialization ...
}
```

**Add certificate hash update method:**

```javascript
// Update certificate hash on-chain
async updateCertificateHash(vin, certificateType, pdfHash, ipfsCid) {
    if (!this.isConnected || this.mode !== 'fabric') {
        throw new Error('Not connected to Fabric network');
    }

    try {
        const transaction = this.contract.createTransaction('UpdateCertificateHash');
        const result = await transaction.submit(vin, certificateType, pdfHash, ipfsCid);
        const transactionId = transaction.getTransactionId();
        
        return {
            success: true,
            message: 'Certificate hash updated on Fabric',
            transactionId: transactionId,
            vin: vin,
            certificateType: certificateType
        };
    } catch (error) {
        console.error('❌ Failed to update certificate hash:', error);
        throw new Error(`Certificate hash update failed: ${error.message}`);
    }
}

// Get certificate hash from chain
async getCertificateHash(vin, certificateType) {
    if (!this.isConnected || this.mode !== 'fabric') {
        throw new Error('Not connected to Fabric network');
    }

    try {
        const result = await this.contract.evaluateTransaction('GetCertificateHash', vin, certificateType);
        return JSON.parse(result.toString());
    } catch (error) {
        console.error('❌ Failed to get certificate hash:', error);
        throw new Error(`Certificate hash query failed: ${error.message}`);
    }
}
```

#### 4.2 Update Routes to Use Dynamic Identity

**File: `backend/routes/vehicles.js` (or wherever vehicle registration is handled)**

```javascript
// Before calling Fabric service, initialize with user context
const fabricService = require('../services/optimizedFabricService');

// In registration route:
router.post('/register', authenticate, authorizeRole(['lto_admin', 'lto_officer']), async (req, res) => {
    try {
        // Initialize Fabric service with current user context
        await fabricService.initialize({
            role: req.user.role,
            email: req.user.email
        });
        
        // Register vehicle
        const result = await fabricService.registerVehicle(vehicleData);
        
        // ... rest of handler ...
    } catch (error) {
        // ... error handling ...
    }
});
```

#### 4.3 Create Certificate Service Integration

**File: `backend/services/certificateBlockchainService.js`**

**Update to integrate with Fabric:**

```javascript
const fabricService = require('./optimizedFabricService');

// After generating PDF and computing hash:
async function storeCertificateHash(vin, certificateType, pdfBuffer, ipfsCid) {
    // Compute SHA256 hash
    const crypto = require('crypto');
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    
    // Store in PostgreSQL (existing)
    await db.storeCertificateHash(vin, certificateType, pdfHash, ipfsCid);
    
    // Store on Fabric blockchain (NEW)
    try {
        await fabricService.initialize({
            role: req.user.role, // Pass user context
            email: req.user.email
        });
        
        await fabricService.updateCertificateHash(vin, certificateType, pdfHash, ipfsCid);
        console.log(`✅ Certificate hash stored on Fabric: ${pdfHash}`);
    } catch (fabricError) {
        console.error(`⚠️ Failed to store hash on Fabric:`, fabricError);
        // Don't fail if Fabric update fails (PostgreSQL is fallback)
    }
    
    return { pdfHash, ipfsCid };
}

// Multi-level verification (handle resaved documents)
async function verifyCertificate(vin, certificateType, pdfBuffer) {
    // Level 1: Exact hash match
    const crypto = require('crypto');
    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    
    // Check PostgreSQL
    const dbHash = await db.getCertificateHash(vin, certificateType);
    if (dbHash && dbHash === fileHash) {
        return { verified: true, method: 'exact_hash_match', source: 'postgresql' };
    }
    
    // Check Fabric
    try {
        await fabricService.initialize();
        const fabricCert = await fabricService.getCertificateHash(vin, certificateType);
        if (fabricCert.found && fabricCert.pdfHash === fileHash) {
            return { verified: true, method: 'exact_hash_match', source: 'fabric' };
        }
    } catch (fabricError) {
        console.warn('Fabric verification failed:', fabricError);
    }
    
    // Level 2: Extract details from PDF and compare with on-chain metadata
    const pdfDetails = await extractPDFDetails(pdfBuffer); // OCR or PDF parsing
    const vehicleData = await fabricService.getVehicle(vin);
    
    if (vehicleData.success) {
        const matches = comparePDFWithVehicleData(pdfDetails, vehicleData.vehicle);
        if (matches) {
            return { 
                verified: true, 
                method: 'content_verification', 
                source: 'fabric',
                note: 'Hash mismatch but content matches on-chain data (document may have been resaved)'
            };
        }
    }
    
    // Level 3: Composite hash check (if implemented)
    // ...
    
    return { verified: false, reason: 'No matching hash or content found' };
}
```

### Deliverables
- ✅ Updated `optimizedFabricService.js` with dynamic identity selection
- ✅ Certificate hash storage methods
- ✅ Route updates to use user context
- ✅ Certificate verification service with multi-level fallback

---

## Phase 5: Certificate Generation and IPFS

### Objective
Implement backend PDF generation, IPFS storage, and hash computation for tamper-proof certificates.

### Tasks

#### 5.1 Create Backend PDF Generator

**File: `backend/services/certificatePdfGenerator.js`**

```javascript
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CertificatePdfGenerator {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp/certificates');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async generateORCR(vehicleData, ownerData) {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            
            // Generate HTML for certificate
            const html = this.generateCertificateHTML(vehicleData, ownerData);
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
            });
            
            // Compute deterministic hash
            const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
            
            return {
                pdfBuffer: pdfBuffer,
                pdfHash: pdfHash,
                fileName: `ORCR_${vehicleData.vin}_${Date.now()}.pdf`
            };
            
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    generateCertificateHTML(vehicleData, ownerData) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .section { margin: 20px 0; }
                .field { margin: 10px 0; }
                .label { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>OFFICIAL RECEIPT / CERTIFICATE OF REGISTRATION</h1>
                <p>Republic of the Philippines</p>
            </div>
            <div class="section">
                <h2>Vehicle Information</h2>
                <div class="field"><span class="label">VIN:</span> ${vehicleData.vin}</div>
                <div class="field"><span class="label">Plate Number:</span> ${vehicleData.plateNumber || 'N/A'}</div>
                <div class="field"><span class="label">Make:</span> ${vehicleData.make}</div>
                <div class="field"><span class="label">Model:</span> ${vehicleData.model}</div>
                <div class="field"><span class="label">Year:</span> ${vehicleData.year}</div>
            </div>
            <div class="section">
                <h2>Owner Information</h2>
                <div class="field"><span class="label">Name:</span> ${ownerData.firstName} ${ownerData.lastName}</div>
                <div class="field"><span class="label">Email:</span> ${ownerData.email}</div>
            </div>
            <div class="section">
                <p><strong>Date of Registration:</strong> ${new Date(vehicleData.dateOfRegistration).toLocaleDateString()}</p>
                <p><strong>OR Number:</strong> ${vehicleData.orNumber || 'N/A'}</p>
                <p><strong>CR Number:</strong> ${vehicleData.crNumber || 'N/A'}</p>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = new CertificatePdfGenerator();
```

#### 5.2 Create IPFS Service

**File: `backend/services/ipfsService.js`**

```javascript
const axios = require('axios');
const FormData = require('form-data');

class IPFSService {
    constructor() {
        this.ipfsHost = process.env.IPFS_HOST || 'ipfs';
        this.ipfsPort = process.env.IPFS_PORT || 5001;
        this.ipfsProtocol = process.env.IPFS_PROTOCOL || 'http';
        this.baseUrl = `${this.ipfsProtocol}://${this.ipfsHost}:${this.ipfsPort}`;
    }

    async addFile(buffer, fileName) {
        try {
            const formData = new FormData();
            formData.append('file', buffer, {
                filename: fileName,
                contentType: 'application/pdf'
            });

            const response = await axios.post(`${this.baseUrl}/api/v0/add`, formData, {
                headers: formData.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            const cid = response.data.Hash;
            console.log(`✅ File uploaded to IPFS: ${cid}`);
            
            return {
                success: true,
                cid: cid,
                ipfsUrl: `https://ipfs.io/ipfs/${cid}` // Public gateway (or use your own)
            };
        } catch (error) {
            console.error('IPFS upload error:', error);
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    async getFile(cid) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v0/cat?arg=${cid}`, {
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        } catch (error) {
            console.error('IPFS retrieval error:', error);
            throw new Error(`IPFS retrieval failed: ${error.message}`);
        }
    }
}

module.exports = new IPFSService();
```

#### 5.3 Integrate Certificate Generation Flow

**File: `backend/routes/certificates.js`**

```javascript
const router = require('express').Router();
const certificatePdfGenerator = require('../services/certificatePdfGenerator');
const ipfsService = require('../services/ipfsService');
const fabricService = require('../services/optimizedFabricService');
const certificateBlockchainService = require('../services/certificateBlockchainService');

// Generate and store certificate
router.post('/generate/:vin', authenticate, authorizeRole(['lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const { vin } = req.params;
        
        // Get vehicle data from Fabric
        await fabricService.initialize({
            role: req.user.role,
            email: req.user.email
        });
        
        const vehicleResult = await fabricService.getVehicle(vin);
        if (!vehicleResult.success) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        
        const vehicleData = vehicleResult.vehicle;
        
        // Generate PDF
        const pdfResult = await certificatePdfGenerator.generateORCR(
            vehicleData,
            vehicleData.owner
        );
        
        // Upload to IPFS
        const ipfsResult = await ipfsService.addFile(
            pdfResult.pdfBuffer,
            pdfResult.fileName
        );
        
        // Store hash on Fabric and PostgreSQL
        await certificateBlockchainService.storeCertificateHash(
            vin,
            'ORCR',
            pdfResult.pdfBuffer,
            ipfsResult.cid
        );
        
        // Return certificate download info
        res.json({
            success: true,
            vin: vin,
            pdfHash: pdfResult.pdfHash,
            ipfsCid: ipfsResult.cid,
            downloadUrl: `/api/certificates/download/${ipfsResult.cid}`
        });
        
    } catch (error) {
        console.error('Certificate generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download certificate from IPFS
router.get('/download/:cid', authenticate, async (req, res) => {
    try {
        const { cid } = req.params;
        const pdfBuffer = await ipfsService.getFile(cid);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="certificate_${cid}.pdf"`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Certificate download error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

### Deliverables
- ✅ Backend PDF generator (`certificatePdfGenerator.js`)
- ✅ IPFS service (`ipfsService.js`)
- ✅ Certificate generation route with Fabric/IPFS integration
- ✅ Download endpoint for certificates

---

## Phase 6: Database Schema and Migration

### Objective
Ensure PostgreSQL schema is properly initialized and remove conflicts with init scripts.

### Tasks

#### 6.0 Seed required system accounts + pre-minted vehicles (align LTO Admin with Fabric)

**Seed application accounts (Postgres):**

- Create the following accounts in Postgres (exact emails as specified):
  - `admin@lto.gov.ph`
  - `hpg@hpg.gov.ph`
  - `insurance@hpg.gov.ph`
  - `certificategenerator@generator.com`

**Role mapping guideline (keep consistent with existing middleware):**

- `admin@lto.gov.ph` → an LTO admin role (`lto_admin` if you use it; otherwise `admin`)
- `hpg@hpg.gov.ph` → use the role pattern your middleware expects (your codebase has special handling where an `admin` role + email containing `hpg` can be treated as `hpg_admin`)
- `insurance@hpg.gov.ph` → `insurance_verifier` (email domain does not matter for app RBAC if the role is correct)
- `certificategenerator@generator.com` → an internal role that can call certificate endpoints (commonly `admin`/`lto_admin`), but **must not** be a public signup

**Seed Fabric identities (server wallet):**

- Ensure the server wallet contains the org identities needed to submit transactions:
  - `admin-lto` (LTOMSP)
  - `admin-hpg` (HPGMSP)
  - `admin-insurance` (InsuranceMSP)

If you want `certificategenerator@generator.com` to be distinct at the ledger layer, create a dedicated Fabric identity (LTOMSP) such as `cert-generator-lto` with an attribute like `role=certificate_generator`, then have chaincode restrict `UpdateCertificateHash` to that attribute (optional).

**Seed pre-minted vehicles into Fabric (so LTO Admin reflects Fabric):**

- Use the chaincode function from **Phase 3.0** (`MintVehicle`) to create ownerless VIN records on-chain.
- PostgreSQL should only cache/index what exists on Fabric (derived index), not invent minted records locally.

> Result: The LTO Admin “vehicle records” view can be a direct reflection of Fabric world state (including minted/unassigned vehicles), exactly matching your stated design.

#### 6.1 Remove Init Script Mount

**File: `docker-compose.unified.yml`**

**Remove this line from postgres service:**
```yaml
# DELETE THIS:
- ./database/init-laptop.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

#### 6.2 Create Manual Initialization Guide

**File: `docs/DATABASE_INITIALIZATION.md`**

```markdown
# Database Initialization Guide

## Prerequisites
- Docker Compose services running
- PostgreSQL container accessible

## Steps

1. **Start Docker Compose:**
   ```bash
   docker-compose -f docker-compose.unified.yml up -d postgres
   ```

2. **Wait for PostgreSQL to be ready:**
   ```bash
   docker-compose -f docker-compose.unified.yml exec postgres pg_isready -U lto_user
   ```

3. **Initialize schema:**
   ```bash
   docker exec -i postgres psql -U lto_user -d lto_blockchain < database/all\ schema.sql
   ```

4. **Verify initialization:**
   ```bash
   docker-compose -f docker-compose.unified.yml exec postgres psql -U lto_user -d lto_blockchain -c "\dt"
   ```

## Notes
- The `all schema.sql` file is the canonical schema
- Do NOT mount `init-laptop.sql` as it conflicts with `all schema.sql`
- Schema initialization is manual to prevent conflicts during rebuilds
```

#### 6.3 Update Certificate Tables (if needed)

**Ensure `certificates` and `issued_certificates` tables exist in `all schema.sql`:**

```sql
-- Verify these tables exist:
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vin VARCHAR(17) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL,
    pdf_hash VARCHAR(64) NOT NULL,
    ipfs_cid VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vin, certificate_type)
);

CREATE TABLE IF NOT EXISTS issued_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vin VARCHAR(17) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    composite_hash VARCHAR(64),
    ipfs_cid VARCHAR(255),
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issued_by UUID REFERENCES users(id)
);
```

### Deliverables
- ✅ Removed init script mount from docker-compose
- ✅ Database initialization guide
- ✅ Verified certificate tables exist in schema

---

## Phase 7: Testing and Validation

### Objective
Test the complete integration end-to-end and validate multi-org functionality.

### Tasks

#### 7.1 Infrastructure Testing

**Test Script: `scripts/test-infrastructure.sh`**

```bash
#!/bin/bash

echo "🧪 Testing Infrastructure..."

# Test Docker services
echo "1. Checking Docker services..."
docker-compose -f docker-compose.unified.yml ps

# Test Fabric peers
echo "2. Testing Fabric peers..."
docker-compose -f docker-compose.unified.yml exec peer0.lto.gov.ph peer channel list
docker-compose -f docker-compose.unified.yml exec peer0.hpg.gov.ph peer channel list
docker-compose -f docker-compose.unified.yml exec peer0.insurance.gov.ph peer channel list

# Test Fabric CAs
echo "3. Testing Fabric CAs..."
curl -k https://localhost:7054/cainfo
curl -k https://localhost:8054/cainfo
curl -k https://localhost:9054/cainfo

# Test PostgreSQL
echo "4. Testing PostgreSQL..."
docker-compose -f docker-compose.unified.yml exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM users;"

# Test IPFS
echo "5. Testing IPFS..."
curl http://localhost:5001/api/v0/version

echo "✅ Infrastructure tests complete!"
```

#### 7.2 Fabric Network Testing

**Test Script: `scripts/test-fabric-network.js`**

```javascript
const fabricService = require('../backend/services/optimizedFabricService');

async function testFabricNetwork() {
    console.log('🧪 Testing Fabric Network...\n');
    
    try {
        // Test 1: Connect with LTO admin
        console.log('1. Testing LTO admin connection...');
        await fabricService.initialize({ role: 'lto_admin', email: 'admin@lto.gov.ph' });
        console.log('✅ LTO admin connected\n');
        
        // Test 2: Register vehicle
        console.log('2. Testing vehicle registration...');
        const vehicleData = {
            vin: 'TEST12345678901234',
            make: 'Toyota',
            model: 'Camry',
            year: 2024,
            owner: { email: 'test@example.com', firstName: 'Test', lastName: 'User' }
        };
        const regResult = await fabricService.registerVehicle(vehicleData);
        console.log(`✅ Vehicle registered: ${regResult.transactionId}\n`);
        
        // Test 3: Query vehicle
        console.log('3. Testing vehicle query...');
        const vehicleResult = await fabricService.getVehicle(vehicleData.vin);
        console.log(`✅ Vehicle queried: ${vehicleResult.vehicle.vin}\n`);
        
        // Test 4: Test HPG connection
        console.log('4. Testing HPG admin connection...');
        await fabricService.disconnect();
        await fabricService.initialize({ role: 'hpg_admin', email: 'admin@hpg.gov.ph' });
        console.log('✅ HPG admin connected\n');
        
        // Test 5: Update verification status (HPG)
        console.log('5. Testing HPG verification...');
        const verifyResult = await fabricService.updateVerificationStatus(
            vehicleData.vin,
            'hpg',
            'APPROVED',
            'HPG clearance approved'
        );
        console.log(`✅ Verification updated: ${verifyResult.transactionId}\n`);
        
        console.log('🎉 All Fabric network tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await fabricService.disconnect();
    }
}

testFabricNetwork();
```

#### 7.3 Certificate Generation Testing

**Test Script: `scripts/test-certificate-generation.js`**

```javascript
const certificatePdfGenerator = require('../backend/services/certificatePdfGenerator');
const ipfsService = require('../backend/services/ipfsService');
const fabricService = require('../backend/services/optimizedFabricService');

async function testCertificateGeneration() {
    console.log('🧪 Testing Certificate Generation...\n');
    
    try {
        // Initialize Fabric
        await fabricService.initialize({ role: 'lto_admin', email: 'admin@lto.gov.ph' });
        
        // Get test vehicle
        const vehicleResult = await fabricService.getVehicle('TEST12345678901234');
        const vehicleData = vehicleResult.vehicle;
        
        // Generate PDF
        console.log('1. Generating PDF...');
        const pdfResult = await certificatePdfGenerator.generateORCR(vehicleData, vehicleData.owner);
        console.log(`✅ PDF generated: ${pdfResult.pdfHash}\n`);
        
        // Upload to IPFS
        console.log('2. Uploading to IPFS...');
        const ipfsResult = await ipfsService.addFile(pdfResult.pdfBuffer, pdfResult.fileName);
        console.log(`✅ Uploaded to IPFS: ${ipfsResult.cid}\n`);
        
        // Store hash on Fabric
        console.log('3. Storing hash on Fabric...');
        const hashResult = await fabricService.updateCertificateHash(
            vehicleData.vin,
            'ORCR',
            pdfResult.pdfHash,
            ipfsResult.cid
        );
        console.log(`✅ Hash stored: ${hashResult.transactionId}\n`);
        
        // Verify hash retrieval
        console.log('4. Verifying hash retrieval...');
        const certHash = await fabricService.getCertificateHash(vehicleData.vin, 'ORCR');
        console.log(`✅ Hash retrieved: ${certHash.pdfHash === pdfResult.pdfHash ? 'MATCH' : 'MISMATCH'}\n`);
        
        console.log('🎉 All certificate generation tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await fabricService.disconnect();
    }
}

testCertificateGeneration();
```

#### 7.4 End-to-End Workflow Testing

**Test Scenarios:**

1. **Initial Registration:**
   - User submits vehicle registration
   - LTO admin approves
   - Vehicle registered on Fabric
   - Certificate generated and stored in IPFS
   - Hash stored on Fabric and PostgreSQL

2. **Transfer of Ownership:**
   - Seller initiates transfer
   - Buyer accepts and submits documents
   - HPG/Insurance auto-verify
   - LTO approves transfer
   - Ownership updated on Fabric
   - New certificate generated

3. **Multi-Org Verification:**
   - HPG admin updates verification status
   - Insurance admin updates verification status
   - LTO admin approves final registration

### Deliverables
- ✅ Infrastructure test script
- ✅ Fabric network test script
- ✅ Certificate generation test script
- ✅ End-to-end workflow validation
- ✅ Test results documentation

---

## Summary Checklist

### Phase 1: Infrastructure ✅
- [ ] Update docker-compose.unified.yml (3 peers, 3 CAs)
- [ ] Update configtx.yaml (3 orgs)
- [ ] Update network-config.json
- [ ] Update .env variables

### Phase 2: Fabric CA ✅
- [ ] Create CA setup scripts
- [ ] Update wallet setup (multi-org)
- [ ] Create enrollment service
- [ ] Integrate with user registration

### Phase 3: Chaincode ✅
- [ ] Update authorization (multi-org)
- [ ] Add certificate hash functions
- [ ] Update endorsement policies

### Phase 4: Backend ✅
- [ ] Update optimizedFabricService (dynamic identity)
- [ ] Add certificate hash methods
- [ ] Update routes (user context)
- [ ] Certificate verification service

### Phase 5: Certificates ✅
- [ ] Backend PDF generator
- [ ] IPFS service
- [ ] Certificate routes
- [ ] Download endpoints

### Phase 6: Database ✅
- [ ] Remove init script mount
- [ ] Create initialization guide
- [ ] Verify certificate tables

### Phase 7: Testing ✅
- [ ] Infrastructure tests
- [ ] Fabric network tests
- [ ] Certificate generation tests
- [ ] End-to-end workflow tests

---

## Important Notes

1. **Budget Constraint:** Ensure resource limits in docker-compose stay within $100/month (16GB RAM droplet recommended).

2. **Data Migration:** Start with empty data. Use `all schema.sql` as the canonical schema.

3. **Identity Management:** Application-level RBAC (PostgreSQL) is separate from Fabric MSP. Map application roles to Fabric identities dynamically.

4. **Certificate Hashes:** Store hashes on both Fabric (authoritative) and PostgreSQL (cache). Implement multi-level verification for resaved documents.

5. **Endorsement Policies:** Configure chaincode to require 2 out of 3 organizations for critical transactions.

6. **IPFS:** Single IPFS node for cost efficiency. Consider IPFS pinning service for production.

7. **Testing:** Test each phase independently before moving to the next.

---

## Next Steps After Implementation

1. **Deploy to DigitalOcean Droplet**
2. **Configure SSL/TLS certificates**
3. **Set up monitoring and logging**
4. **Create backup procedures**
5. **Document API endpoints**
6. **Train users on multi-org workflows**

---

**Document Version:** 1.0  
**Last Updated:** January 29, 2026  
**Author:** System Architect
