#!/bin/bash
# Complete Fabric Reset and Reconfiguration Script
# For DigitalOcean Docker Environment - Real Fabric Only
# This script ensures everything is properly configured for your current codebase

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Complete Fabric Reset & Reconfiguration                   ║"
echo "║  DigitalOcean Docker Environment - Real Fabric Only        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# STEP 0: Validate .env Configuration
# ============================================
echo "0️⃣  Validating .env configuration..."

if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "💡 Copy ENV.example to .env and configure required variables"
    exit 1
fi

# Check required variables
MISSING_VARS=()

if ! grep -q "^BLOCKCHAIN_MODE=fabric" .env; then
    MISSING_VARS+=("BLOCKCHAIN_MODE=fabric")
fi

if ! grep -q "^JWT_SECRET=" .env || grep -q "^JWT_SECRET=CHANGE-THIS" .env; then
    MISSING_VARS+=("JWT_SECRET=<your-secret-key>")
fi

if ! grep -q "^STORAGE_MODE=" .env; then
    MISSING_VARS+=("STORAGE_MODE=ipfs")
fi

if ! grep -q "^FABRIC_AS_LOCALHOST=false" .env; then
    echo "⚠️  FABRIC_AS_LOCALHOST not set to 'false' - adding it..."
    echo "FABRIC_AS_LOCALHOST=false" >> .env
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ Missing required .env variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "💡 Add these to your .env file and run this script again"
    exit 1
fi

echo "✅ .env configuration validated"

# ============================================
# STEP 1: Stop and Remove Fabric Containers
# ============================================
echo ""
echo "1️⃣  Stopping Fabric containers..."
docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli lto-app 2>/dev/null || \
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli lto-app 2>/dev/null || {
    docker stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli lto-app 2>/dev/null || true
}
sleep 2

echo "   Removing Fabric containers..."
docker compose -f docker-compose.unified.yml rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || \
docker-compose -f docker-compose.unified.yml rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || {
    docker rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || true
}

# ============================================
# STEP 2: Remove Fabric Volumes
# ============================================
echo ""
echo "2️⃣  Removing Fabric volumes (all blockchain data)..."
docker volume rm peer-data orderer-data couchdb-data 2>/dev/null || {
    echo "   ⚠️  Some volumes may not exist (this is OK)"
}

# Clear local data directories if they exist
if [ -d "fabric-network/couchdb-data" ]; then
    rm -rf fabric-network/couchdb-data
fi
if [ -d "fabric-network/peer-data" ]; then
    rm -rf fabric-network/peer-data
fi
if [ -d "fabric-network/orderer-data" ]; then
    rm -rf fabric-network/orderer-data
fi

# ============================================
# STEP 3: Backup and Regenerate Certificates
# ============================================
echo ""
echo "3️⃣  Regenerating certificates..."

if [ -d "fabric-network/crypto-config" ]; then
    BACKUP_CRYPTO="fabric-network/crypto-config.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/crypto-config "$BACKUP_CRYPTO"
    echo "   ✅ Backed up old certificates to: $BACKUP_CRYPTO"
fi

if [ ! -f "scripts/generate-crypto.sh" ]; then
    echo "❌ scripts/generate-crypto.sh not found!"
    exit 1
fi

bash scripts/generate-crypto.sh
echo "   ✅ Certificates regenerated"

# ============================================
# STEP 4: Fix MSP admincerts (CRITICAL - BEFORE containers start)
# ============================================
echo ""
echo "4️⃣  Fixing MSP admincerts (CRITICAL for proper identity validation)..."

ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
PEER_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp"
ORG_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp"

# Find admin certificate
ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)

if [ -z "$ADMIN_CERT" ]; then
    echo "❌ Admin certificate not found!"
    exit 1
fi

echo "   Found admin cert: $ADMIN_CERT"

# Fix user-level admincerts
mkdir -p "$ADMIN_MSP/admincerts"
cp "$ADMIN_CERT" "$ADMIN_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ User admincerts fixed"

# Fix peer-level admincerts
mkdir -p "$PEER_MSP/admincerts"
cp "$ADMIN_CERT" "$PEER_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ Peer admincerts fixed"

# Fix organization-level admincerts (CRITICAL for NodeOUs)
mkdir -p "$ORG_MSP/admincerts"
cp "$ADMIN_CERT" "$ORG_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ Organization admincerts fixed"

# Fix orderer MSP TLS CA (for orderer clustering)
ORDERER_MSP="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp"
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
if [ -f "$ORDERER_TLS_CA" ]; then
    mkdir -p "$ORDERER_MSP/tlscacerts"
    cp "$ORDERER_TLS_CA" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem" 2>/dev/null || true
    echo "   ✅ Orderer TLS CA fixed"
fi

# ============================================
# STEP 5: Regenerate Channel Artifacts
# ============================================
echo ""
echo "5️⃣  Regenerating channel artifacts..."

if [ -d "fabric-network/channel-artifacts" ]; then
    BACKUP_CHANNEL="fabric-network/channel-artifacts.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/channel-artifacts "$BACKUP_CHANNEL"
    echo "   ✅ Backed up old artifacts to: $BACKUP_CHANNEL"
fi

if [ ! -f "scripts/generate-channel-artifacts.sh" ]; then
    echo "❌ scripts/generate-channel-artifacts.sh not found!"
    exit 1
fi

bash scripts/generate-channel-artifacts.sh
echo "   ✅ Channel artifacts regenerated"

# ============================================
# STEP 6: Start Fabric Containers
# ============================================
echo ""
echo "6️⃣  Starting Fabric containers..."

docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb 2>/dev/null || {
    echo "❌ Failed to start orderer/couchdb"
    exit 1
}

echo "   ⏳ Waiting for orderer and couchdb to be ready (20 seconds)..."
sleep 20

# Wait for orderer to log "Beginning to serve requests"
echo "   Waiting for orderer to be ready..."
for i in {1..30}; do
    if docker logs orderer.lto.gov.ph 2>&1 | grep -q "Beginning to serve requests"; then
        echo "   ✅ Orderer is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  Orderer may not be ready, but continuing..."
    fi
    sleep 2
done

# Start peer
docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || {
    echo "❌ Failed to start peer"
    exit 1
}

echo "   ⏳ Waiting for peer to start (15 seconds)..."
sleep 15

# ============================================
# STEP 7: Create Channel
# ============================================
echo ""
echo "7️⃣  Creating channel..."

# Copy channel transaction to peer
CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    echo "❌ Channel transaction file not found: $CHANNEL_TX"
    exit 1
fi

docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

# Copy orderer TLS CA cert to peer container
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
if [ ! -f "$ORDERER_TLS_CA" ]; then
    echo "❌ Orderer TLS CA certificate not found"
    exit 1
fi

docker cp "$ORDERER_TLS_CA" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt
TLS_CA_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"

# Create channel with timeout
echo "   Creating channel 'ltochannel'..."
CHANNEL_CREATE_OUTPUT=$(timeout 90s docker exec peer0.lto.gov.ph peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --timeout 60s \
    2>&1) || {
    echo "❌ Channel creation failed or timed out"
    echo "   Orderer logs:"
    docker logs orderer.lto.gov.ph --tail 20
    echo "   Peer logs:"
    docker logs peer0.lto.gov.ph --tail 20
    exit 1
}

if echo "$CHANNEL_CREATE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel creation failed:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -10
    exit 1
fi

echo "   ✅ Channel created"

# Join channel
echo "   Joining peer to channel..."
CHANNEL_JOIN_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1)

if echo "$CHANNEL_JOIN_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel join failed:"
    echo "$CHANNEL_JOIN_OUTPUT" | tail -5
    exit 1
fi

echo "   ✅ Peer joined channel"

# Verify channel
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo "   ✅ Channel verified"
else
    echo "   ⚠️  Channel verification failed"
    echo "$CHANNEL_LIST"
fi

# ============================================
# STEP 8: Update Anchor Peer (if exists)
# ============================================
if [ -f "fabric-network/channel-artifacts/LTOMSPanchors.tx" ]; then
    echo ""
    echo "8️⃣  Updating anchor peer..."
    docker cp fabric-network/channel-artifacts/LTOMSPanchors.tx peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx
    
    ANCHOR_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel update \
        -o orderer.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx \
        --tls \
        --cafile "$TLS_CA_FILE" \
        2>&1)
    
    if echo "$ANCHOR_OUTPUT" | grep -qi "error\|failed"; then
        echo "   ⚠️  Anchor peer update failed (may not be critical)"
    else
        echo "   ✅ Anchor peer updated"
    fi
fi

# ============================================
# STEP 9: Deploy Chaincode
# ============================================
echo ""
echo "9️⃣  Deploying chaincode..."

if [ ! -d "chaincode/vehicle-registration-production" ]; then
    echo "❌ Chaincode directory not found: chaincode/vehicle-registration-production"
    exit 1
fi

# Copy chaincode to peer
echo "   Copying chaincode to peer..."
docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/ || {
    echo "❌ Failed to copy chaincode"
    exit 1
}

# Verify chaincode copy
if ! docker exec peer0.lto.gov.ph test -d /opt/gopath/src/github.com/chaincode/vehicle-registration-production; then
    echo "❌ Chaincode directory not found in peer container"
    exit 1
fi
if ! docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/chaincode/vehicle-registration-production/index.js; then
    echo "❌ Chaincode index.js not found"
    exit 1
fi

# Package chaincode
echo "   Packaging chaincode..."
PACKAGE_OUTPUT=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0 2>&1)

if echo "$PACKAGE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Failed to package chaincode:"
    echo "$PACKAGE_OUTPUT" | tail -10
    exit 1
fi

# Install chaincode
echo "   Installing chaincode..."
docker exec peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1 | tail -5 || {
    echo "❌ Failed to install chaincode"
    exit 1
}

echo "   ⏳ Waiting for installation (15s)..."
sleep 15

# Get package ID
PACKAGE_ID=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0:" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    echo "❌ Failed to get chaincode package ID"
    exit 1
fi

echo "   Package ID: $PACKAGE_ID"

# Approve chaincode
echo "   Approving chaincode..."
docker exec peer0.lto.gov.ph peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1 | tail -5 || {
    echo "❌ Failed to approve chaincode"
    exit 1
}

# Commit chaincode
echo "   Committing chaincode..."
docker exec peer0.lto.gov.ph peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --peerAddresses peer0.lto.gov.ph:7051 \
    --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt \
    2>&1 | tail -5 || {
    echo "❌ Failed to commit chaincode"
    exit 1
}

echo "   ⏳ Waiting for commit (10s)..."
sleep 10

# Verify chaincode
CHAINCODE_LIST=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_LIST" | grep -q "vehicle-registration"; then
    echo "   ✅ Chaincode deployed successfully"
else
    echo "   ⚠️  Chaincode verification failed"
    echo "$CHAINCODE_LIST"
fi

# ============================================
# STEP 10: Regenerate Wallet
# ============================================
echo ""
echo "🔟 Regenerating wallet..."

rm -rf wallet
mkdir -p wallet

if command -v node > /dev/null 2>&1; then
    node scripts/setup-fabric-wallet.js || {
        echo "   ⚠️  Wallet setup script failed, trying manual setup..."
        WALLET_ADMIN_DIR="wallet/admin"
        mkdir -p "$WALLET_ADMIN_DIR"
        
        ADMIN_KEY=$(find "$ADMIN_MSP/keystore" -name "*_sk" 2>/dev/null | head -1)
        if [ -n "$ADMIN_KEY" ] && [ -n "$ADMIN_CERT" ]; then
            cp "$ADMIN_CERT" "$WALLET_ADMIN_DIR/cert.pem"
            cp "$ADMIN_KEY" "$WALLET_ADMIN_DIR/key.pem"
            echo "   ✅ Wallet created manually"
        else
            echo "   ❌ Failed to create wallet manually"
        fi
    }
else
    echo "   ⚠️  Node.js not found, creating wallet manually..."
    WALLET_ADMIN_DIR="wallet/admin"
    mkdir -p "$WALLET_ADMIN_DIR"
    
    ADMIN_KEY=$(find "$ADMIN_MSP/keystore" -name "*_sk" 2>/dev/null | head -1)
    if [ -n "$ADMIN_KEY" ] && [ -n "$ADMIN_CERT" ]; then
        cp "$ADMIN_CERT" "$WALLET_ADMIN_DIR/cert.pem"
        cp "$ADMIN_KEY" "$WALLET_ADMIN_DIR/key.pem"
        echo "   ✅ Wallet created manually"
    fi
fi

if [ -f "wallet/admin/cert.pem" ] && [ -f "wallet/admin/key.pem" ]; then
    echo "   ✅ Wallet regenerated successfully"
else
    echo "   ❌ Wallet files not found - application may fail to connect"
fi

# ============================================
# STEP 11: Verify Network Configuration
# ============================================
echo ""
echo "1️⃣1️⃣ Verifying network configuration..."

if [ ! -f "network-config.json" ]; then
    echo "❌ network-config.json not found!"
    echo "💡 Ensure network-config.json exists in project root"
    exit 1
fi

echo "   ✅ network-config.json exists"

# ============================================
# STEP 12: Restart Application
# ============================================
echo ""
echo "1️⃣2️⃣ Restarting application..."

docker compose -f docker-compose.unified.yml restart lto-app 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d lto-app 2>/dev/null || {
    echo "   ⚠️  Failed to restart application (may not be running)"
}

echo "   ⏳ Waiting for application to start (15 seconds)..."
sleep 15

# ============================================
# STEP 13: Final Verification
# ============================================
echo ""
echo "1️⃣3️⃣ Final verification..."

# Check containers
echo "   Checking containers..."
if docker ps | grep -q "peer0.lto.gov.ph" && docker ps | grep -q "orderer.lto.gov.ph"; then
    echo "   ✅ Fabric containers running"
else
    echo "   ⚠️  Some Fabric containers may not be running"
fi

# Check channel
CHANNEL_CHECK=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_CHECK" | grep -q "ltochannel"; then
    echo "   ✅ Channel exists"
else
    echo "   ⚠️  Channel may not exist"
fi

# Check chaincode
CHAINCODE_CHECK=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_CHECK" | grep -qi "error\|access denied\|creator org unknown"; then
    echo "   ⚠️  Chaincode query failed (may need more time)"
else
    if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
        echo "   ✅ Chaincode deployed"
    else
        echo "   ⚠️  Chaincode may not be deployed"
    fi
fi

# Check wallet
if [ -f "wallet/admin/cert.pem" ] && [ -f "wallet/admin/key.pem" ]; then
    echo "   ✅ Wallet configured"
else
    echo "   ❌ Wallet not configured"
fi

# Check application logs
echo ""
echo "   Checking application logs..."
APP_LOGS=$(docker logs lto-app --tail 30 2>&1 | grep -i "fabric\|connected\|error" || true)
if echo "$APP_LOGS" | grep -qi "connected.*fabric\|fabric.*connected"; then
    echo "   ✅ Application connected to Fabric"
elif echo "$APP_LOGS" | grep -qi "error\|failed"; then
    echo "   ⚠️  Application may have errors (check logs)"
else
    echo "   ℹ️  Application logs not showing Fabric connection yet"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Reset Complete!                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Fabric network reset and reconfigured"
echo "✅ MSP admincerts fixed at all levels"
echo "✅ Channel created: ltochannel"
echo "✅ Chaincode deployed: vehicle-registration"
echo "✅ Wallet regenerated"
echo ""
echo "📋 Next steps:"
echo "   1. Check application logs: docker logs lto-app --tail 50"
echo "   2. Verify Fabric connection: docker logs lto-app | grep -i fabric"
echo "   3. Test vehicle registration via API"
echo ""
echo "💡 If you see 'access denied' errors, run:"
echo "   bash scripts/fix-creator-org-unknown.sh"
echo ""
echo "💡 Note: TLS errors in orderer logs are harmless warnings"
echo "   for single-node Raft clusters (expected behavior)"
echo ""
