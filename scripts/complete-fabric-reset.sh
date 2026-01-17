#!/bin/bash
# Complete Fabric Network Reset - Fixes Certificate Trust Chain Issues
# This ensures ALL certificates, wallet, and artifacts are from the SAME generation

set -e

echo "======================================================"
echo "  COMPLETE FABRIC NETWORK RESET"
echo "======================================================"
echo ""

cd ~/LTOBLOCKCHAIN

# ============================================
# STEP 1: STOP ALL CONTAINERS AND CLEAN VOLUMES
# ============================================
echo "Step 1: Stopping all containers and cleaning volumes..."
docker compose -f docker-compose.unified.yml down -v 2>/dev/null || true
docker compose -f docker-compose.fabric.yml down -v 2>/dev/null || true

# Remove ALL crypto materials, artifacts, and wallet
echo "Removing old crypto materials, artifacts, and wallet..."
sudo rm -rf fabric-network/crypto-config 2>/dev/null || rm -rf fabric-network/crypto-config
sudo rm -rf fabric-network/channel-artifacts 2>/dev/null || rm -rf fabric-network/channel-artifacts
rm -rf wallet 2>/dev/null || true

# Create fresh directories
mkdir -p fabric-network/crypto-config
mkdir -p fabric-network/channel-artifacts
mkdir -p wallet

echo "✅ Cleanup complete"
echo ""

# ============================================
# STEP 2: GENERATE FRESH CRYPTO MATERIALS
# ============================================
echo "Step 2: Generating fresh cryptographic materials..."
docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config

if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph" ] || \
   [ ! -d "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph" ]; then
    echo "❌ Failed to generate crypto materials"
    exit 1
fi

echo "✅ Crypto materials generated"
echo ""

# ============================================
# STEP 3: SETUP ADMINCERTS (User, Peer, and Organization Level)
# ============================================
echo "Step 3: Setting up admin certificates at all levels..."

ADMIN_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/Admin@lto.gov.ph-cert.pem"

# User-level admincerts
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
mkdir -p "${ADMIN_MSP}/admincerts"
cp "${ADMIN_CERT}" "${ADMIN_MSP}/admincerts/"

# Peer-level admincerts
PEER_ADMINCERTS="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts"
mkdir -p "$PEER_ADMINCERTS"
cp "${ADMIN_CERT}" "$PEER_ADMINCERTS/"

# Organization-level admincerts (CRITICAL for orderer validation)
ORG_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp"
mkdir -p "${ORG_MSP}/admincerts"
cp "${ADMIN_CERT}" "${ORG_MSP}/admincerts/"

# Also ensure organization MSP has signcerts (some Fabric versions need this)
mkdir -p "${ORG_MSP}/signcerts"
cp "${ADMIN_CERT}" "${ORG_MSP}/signcerts/"

echo "✅ Admin certificates configured at all levels"
echo ""

# ============================================
# STEP 4: GENERATE GENESIS BLOCK
# ============================================
echo "Step 4: Generating genesis block..."
mkdir -p config/crypto-config
cp -r fabric-network/crypto-config/* config/crypto-config/ 2>/dev/null || true

docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel -outputBlock /fabric-network/channel-artifacts/genesis.block

if [ ! -f "fabric-network/channel-artifacts/genesis.block" ]; then
    echo "❌ Failed to generate genesis block"
    exit 1
fi

echo "✅ Genesis block generated"
echo ""

# ============================================
# STEP 5: GENERATE CHANNEL TRANSACTION
# ============================================
echo "Step 5: Generating channel transaction..."
docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -outputCreateChannelTx /fabric-network/channel-artifacts/channel.tx -channelID ltochannel

if [ ! -f "fabric-network/channel-artifacts/channel.tx" ]; then
    echo "❌ Failed to generate channel transaction"
    exit 1
fi

echo "✅ Channel transaction generated"
echo ""

# Clean up temporary config copy
rm -rf config/crypto-config

# ============================================
# STEP 6: START CONTAINERS
# ============================================
echo "Step 6: Starting containers..."
docker compose -f docker-compose.unified.yml up -d

echo "Waiting for containers to initialize (30 seconds)..."
sleep 30

# Verify containers are running
if ! docker ps | grep -q "orderer.lto.gov.ph"; then
    echo "❌ Orderer failed to start"
    exit 1
fi
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "❌ Peer failed to start"
    exit 1
fi

echo "✅ Containers started"
echo ""

# ============================================
# STEP 7: CREATE CHANNEL
# ============================================
echo "Step 7: Creating channel..."
docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    echo "❌ Channel creation failed"
    docker logs orderer.lto.gov.ph --tail 30
    exit 1
fi

echo "✅ Channel created"
echo ""

# ============================================
# STEP 8: JOIN PEER TO CHANNEL
# ============================================
echo "Step 8: Joining peer to channel..."
docker exec cli peer channel join -b ltochannel.block

if ! docker exec cli peer channel list 2>&1 | grep -q "ltochannel"; then
    echo "❌ Failed to join channel"
    exit 1
fi

echo "✅ Peer joined channel"
echo ""

# ============================================
# STEP 9: REGENERATE WALLET (CRITICAL!)
# ============================================
echo "Step 9: Regenerating wallet with NEW admin identity..."
node scripts/setup-fabric-wallet.js

if [ ! -d "wallet" ] || [ ! -f "wallet/admin.id" ]; then
    echo "❌ Wallet generation failed"
    exit 1
fi

echo "✅ Wallet regenerated with new admin identity"
echo ""

# ============================================
# COMPLETE
# ============================================
echo "======================================================"
echo "  ✅ COMPLETE RESET SUCCESSFUL!"
echo "======================================================"
echo ""
echo "All components are now using matching certificates:"
echo "  - Crypto materials: Fresh generation"
echo "  - Genesis block: Regenerated with new MSP"
echo "  - Channel transaction: Regenerated"
echo "  - Wallet: Regenerated with new admin identity"
echo ""
echo "Next steps:"
echo "  1. Deploy chaincode (if needed)"
echo "  2. Restart lto-app: docker compose -f docker-compose.unified.yml restart lto-app"
echo ""
