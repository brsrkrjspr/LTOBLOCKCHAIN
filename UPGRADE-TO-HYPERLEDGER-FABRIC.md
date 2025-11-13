# 🔗 Upgrade Guide: Mock Blockchain → Hyperledger Fabric

This guide will help you upgrade your TrustChain LTO system from mock blockchain to real Hyperledger Fabric.

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ Docker Desktop installed and running
- ✅ Docker Compose v2.0+
- ✅ At least 16GB RAM (8GB minimum)
- ✅ 50GB free disk space
- ✅ Basic understanding of Hyperledger Fabric
- ✅ Current system running in mock mode

## 🎯 Overview

The upgrade process involves:
1. **Setting up Hyperledger Fabric network**
2. **Generating certificates and network configuration**
3. **Creating wallet with admin identity**
4. **Deploying chaincode (smart contract)**
5. **Updating environment configuration**
6. **Testing the connection**
7. **Migrating existing data (optional)**

## 📦 Step 1: Install Hyperledger Fabric Binaries

### Option A: Using Official Script (Recommended)

```powershell
# Download Fabric binaries
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.2

# Add to PATH (Windows PowerShell)
$env:PATH += ";C:\Users\$env:USERNAME\fabric-samples\bin"
```

### Option B: Using Docker Images

```powershell
# Pull required Fabric images
docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-ca:1.5
docker pull hyperledger/fabric-tools:2.5
docker pull couchdb:3.2
```

## 🏗️ Step 2: Set Up Fabric Network

### 2.1 Create Network Structure

```powershell
# Create directories
New-Item -ItemType Directory -Path "fabric-network" -Force
New-Item -ItemType Directory -Path "fabric-network/crypto-config" -Force
New-Item -ItemType Directory -Path "fabric-network/channel-artifacts" -Force
New-Item -ItemType Directory -Path "fabric-network/chaincode" -Force
```

### 2.2 Generate Crypto Material

Create `fabric-network/crypto-config.yaml`:

```yaml
OrdererOrgs:
  - Name: Orderer
    Domain: lto.gov.ph
    Specs:
      - Hostname: orderer1
      - Hostname: orderer2
      - Hostname: orderer3

PeerOrgs:
  - Name: LTO
    Domain: lto.gov.ph
    EnableNodeOUs: true
    Template:
      Count: 1
    Users:
      Count: 1
```

Generate certificates:

```powershell
# Navigate to fabric-network
cd fabric-network

# Generate crypto material (if you have cryptogen)
../bin/cryptogen generate --config=./crypto-config.yaml

# Or use Fabric CA (recommended for production)
# See Step 3 for CA setup
```

### 2.3 Generate Genesis Block

Create `fabric-network/configtx.yaml`:

```yaml
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/lto.gov.ph/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Writers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Admins:
        Type: Signature
        Rule: "OR('OrdererMSP.admin')"

  - &LTOOrg
    Name: LTOOrg
    ID: LTOMSP
    MSPDir: crypto-config/peerOrganizations/lto.gov.ph/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('LTOMSP.admin', 'LTOMSP.peer', 'LTOMSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('LTOMSP.admin', 'LTOMSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('LTOMSP.admin')"
    AnchorPeers:
      - Host: peer0.lto.gov.ph
        Port: 7051

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_0: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"

Orderer: &OrdererDefaults
  OrdererType: etcdraft
  EtcdRaft:
    Consenters:
      - Host: orderer1.lto.gov.ph
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/server.crt
      - Host: orderer2.lto.gov.ph
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer2.lto.gov.ph/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer2.lto.gov.ph/tls/server.crt
      - Host: orderer3.lto.gov.ph
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer3.lto.gov.ph/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer3.lto.gov.ph/tls/server.crt
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ChannelCapabilities

Profiles:
  TrustChainOrdererGenesis:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
      Capabilities:
        <<: *OrdererCapabilities
    Consortiums:
      TrustChainConsortium:
        Organizations:
          - *LTOOrg

  TrustChainChannel:
    <<: *ChannelDefaults
    Consortium: TrustChainConsortium
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *LTOOrg
      Capabilities:
        <<: *ApplicationCapabilities
```

Generate genesis block:

```powershell
# Generate genesis block
configtxgen -profile TrustChainOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block

# Generate channel creation transaction
configtxgen -profile TrustChainChannel -channelID ltochannel -outputCreateChannelTx ./channel-artifacts/channel.tx

# Generate anchor peer update
configtxgen -profile TrustChainChannel -channelID ltochannel -outputAnchorPeersUpdate ./channel-artifacts/LTOanchors.tx -asOrg LTOOrg
```

## 🐳 Step 3: Start Fabric Network with Docker Compose

Create `fabric-network/docker-compose.fabric.yml`:

```yaml
version: '3.8'

networks:
  fabric-network:
    driver: bridge

services:
  # Orderer Services
  orderer1.lto.gov.ph:
    image: hyperledger/fabric-orderer:2.5
    container_name: orderer1.lto.gov.ph
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=7050
      - ORDERER_GENERAL_GENESISMETHOD=file
      - ORDERER_GENERAL_GENESISFILE=/var/hyperledger/orderer/orderer.genesis.block
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_CLUSTER_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric
    command: orderer
    volumes:
      - ./crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp:/var/hyperledger/orderer/msp
      - ./crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/:/var/hyperledger/orderer/tls
      - ./channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block
      - orderer1-data:/var/hyperledger/production/orderer
    ports:
      - "7050:7050"
    networks:
      - fabric-network

  # Peer Service
  peer0.lto.gov.ph:
    image: hyperledger/fabric-peer:2.5
    container_name: peer0.lto.gov.ph
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric-network
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_PEER_ID=peer0.lto.gov.ph
      - CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.lto.gov.ph:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.lto.gov.ph:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.lto.gov.ph:7051
      - CORE_PEER_LOCALMSPID=LTOMSP
    volumes:
      - /var/run/:/host/var/run/
      - ./crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp:/etc/hyperledger/fabric/msp
      - ./crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls:/etc/hyperledger/fabric/tls
      - peer0-data:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - "7051:7051"
    depends_on:
      - orderer1.lto.gov.ph
    networks:
      - fabric-network

  # CouchDB
  couchdb0:
    image: couchdb:3.2
    container_name: couchdb0
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "5984:5984"
    volumes:
      - couchdb0-data:/opt/couchdb/data
    networks:
      - fabric-network

volumes:
  orderer1-data:
  peer0-data:
  couchdb0-data:
```

Start the network:

```powershell
cd fabric-network
docker-compose -f docker-compose.fabric.yml up -d
```

## 🔐 Step 4: Create Network Configuration and Wallet

### 4.1 Create Network Configuration File

Create `network-config.yaml` in project root:

```yaml
name: TrustChainNetwork
version: 1.0.0
client:
  organization: LTO
  connection:
    timeout:
      peer:
        endorser: 300
organizations:
  LTO:
    mspid: LTOMSP
    peers:
      - peer0.lto.gov.ph
    certificateAuthorities:
      - ca.lto.gov.ph
peers:
  peer0.lto.gov.ph:
    url: grpcs://localhost:7051
    grpcOptions:
      ssl-target-name-override: peer0.lto.gov.ph
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
certificateAuthorities:
  ca.lto.gov.ph:
    url: https://localhost:7054
    caName: ca.lto.gov.ph
    tlsCACerts:
      path: fabric-network/crypto-config/peerOrganizations/lto.gov.ph/ca/ca.lto.gov.ph-cert.pem
    httpOptions:
      verify: false
orderers:
  orderer1.lto.gov.ph:
    url: grpcs://localhost:7050
    grpcOptions:
      ssl-target-name-override: orderer1.lto.gov.ph
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/ca.crt
channels:
  ltochannel:
    orderers:
      - orderer1.lto.gov.ph
    peers:
      peer0.lto.gov.ph:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true
```

### 4.2 Create Wallet with Admin Identity

Create `scripts/setup-fabric-wallet.js`:

```javascript
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function setupWallet() {
    try {
        // Create wallet directory
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Check if admin already exists
        const adminExists = await wallet.get('admin');
        if (adminExists) {
            console.log('✅ Admin identity already exists in wallet');
            return;
        }

        // Read admin certificate and key
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

        const keyPath = path.join(
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

        // Read certificate
        const cert = fs.readFileSync(certPath).toString();
        
        // Read private key (find the key file)
        const keyFiles = fs.readdirSync(keyPath);
        const keyFile = keyFiles.find(f => f.endsWith('_sk'));
        const key = fs.readFileSync(path.join(keyPath, keyFile)).toString();

        // Create identity
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

    } catch (error) {
        console.error('❌ Failed to setup wallet:', error);
        throw error;
    }
}

setupWallet();
```

Run the script:

```powershell
node scripts/setup-fabric-wallet.js
```

## 📦 Step 5: Deploy Chaincode

### 5.1 Create Channel

```powershell
# Create channel
docker exec -it peer0.lto.gov.ph peer channel create -o orderer1.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Join channel
docker exec -it peer0.lto.gov.ph peer channel join -b ltochannel.block

# Update anchor peers
docker exec -it peer0.lto.gov.ph peer channel update -o orderer1.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/LTOanchors.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

### 5.2 Package and Install Chaincode

```powershell
# Package chaincode
cd chaincode/vehicle-registration-production
npm install
cd ../..

# Install chaincode
docker exec -it peer0.lto.gov.ph peer lifecycle chaincode package vehicle-registration.tar.gz --path /opt/gopath/src/github.com/hyperledger/fabric/chaincode/vehicle-registration-production --lang node --label vehicle-registration_1.0

# Install on peer
docker exec -it peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz

# Get package ID
docker exec -it peer0.lto.gov.ph peer lifecycle chaincode queryinstalled

# Approve chaincode
docker exec -it peer0.lto.gov.ph peer lifecycle chaincode approveformyorg -o orderer1.lto.gov.ph:7050 --channelID ltochannel --name vehicle-registration --version 1.0 --package-id <PACKAGE_ID> --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Commit chaincode
docker exec -it peer0.lto.gov.ph peer lifecycle chaincode commit -o orderer1.lto.gov.ph:7050 --channelID ltochannel --name vehicle-registration --version 1.0 --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

## ⚙️ Step 6: Update Environment Configuration

Update your `.env` file:

```env
# Change blockchain mode from mock to fabric
BLOCKCHAIN_MODE=fabric

# Add Fabric-specific configuration
FABRIC_NETWORK_CONFIG=./network-config.yaml
FABRIC_WALLET_PATH=./wallet
FABRIC_CHANNEL_NAME=ltochannel
FABRIC_CHAINCODE_NAME=vehicle-registration
FABRIC_MSP_ID=LTOMSP
```

## 🧪 Step 7: Test the Connection

### 7.1 Restart Application

```powershell
# Stop current application
docker-compose -f docker-compose.production-no-ipfs.yml stop lto-app-prod

# Start application
docker-compose -f docker-compose.production-no-ipfs.yml start lto-app-prod

# Check logs
docker-compose -f docker-compose.production-no-ipfs.yml logs -f lto-app-prod
``` 

### 7.2 Verify Connection

```powershell
# Check blockchain status
curl http://localhost:3001/api/blockchain/status

# Should return:
# {
#   "connected": true,
#   "network": "Hyperledger Fabric",
#   "channel": "ltochannel",
#   "contract": "vehicle-registration"
# }
```

### 7.3 Test Vehicle Registration

```powershell
# Register a test vehicle
curl -X POST http://localhost:3001/api/vehicles/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "vin": "TEST123456789",
    "make": "Toyota",
    "model": "Vios",
    "year": 2024,
    "owner": {
      "email": "test@example.com",
      "name": "Test User"
    }
  }'
```

## 📊 Step 8: Migrate Existing Data (Optional)

If you have existing vehicle data in mock blockchain, create a migration script:

```javascript
// scripts/migrate-to-fabric.js
const mockService = require('../backend/services/mockBlockchainService');
const fabricService = require('../backend/services/optimizedFabricService');

async function migrateData() {
    try {
        // Initialize Fabric connection
        await fabricService.initialize();
        
        // Get all vehicles from mock blockchain
        const stats = await mockService.getSystemStats();
        
        // Migrate each vehicle
        for (const vin of Object.keys(mockService.vehicles)) {
            const vehicle = await mockService.getVehicle(vin);
            await fabricService.registerVehicle(vehicle.vehicle);
            console.log(`✅ Migrated vehicle: ${vin}`);
        }
        
        console.log('✅ Migration completed');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

migrateData();
```

Run migration:

```powershell
node scripts/migrate-to-fabric.js
```

## ✅ Verification Checklist

- [ ] Hyperledger Fabric network is running
- [ ] Channel created and peer joined
- [ ] Chaincode deployed and committed
- [ ] Wallet created with admin identity
- [ ] Network configuration file exists
- [ ] Environment variable `BLOCKCHAIN_MODE=fabric`
- [ ] Application connects to Fabric successfully
- [ ] Test vehicle registration works
- [ ] Blockchain status shows "Hyperledger Fabric"

## 🐛 Troubleshooting

### Connection Issues

```powershell
# Check if Fabric network is running
docker ps | findstr fabric

# Check peer logs
docker logs peer0.lto.gov.ph

# Check orderer logs
docker logs orderer1.lto.gov.ph
```

### Wallet Issues

```powershell
# Verify wallet exists
ls wallet

# Recreate wallet
node scripts/setup-fabric-wallet.js
```

### Chaincode Issues

```powershell
# Check chaincode logs
docker logs dev-peer0.lto.gov.ph-vehicle-registration-1.0

# Reinstall chaincode if needed
docker exec -it peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz
```

## 📚 Additional Resources

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Fabric Samples](https://github.com/hyperledger/fabric-samples)
- [Fabric Chaincode Development](https://hyperledger-fabric.readthedocs.io/en/latest/chaincode4ade.html)

## 🎉 Success!

Once you've completed all steps, your system is now running on Hyperledger Fabric! You should see:

```
✅ Connected to Hyperledger Fabric network
✅ Using channel: ltochannel
✅ Contract: vehicle-registration
```

All vehicle registrations and transactions will now be stored on the blockchain with full immutability and auditability.

---

**Need Help?** Check the troubleshooting section or review the logs for specific error messages.

