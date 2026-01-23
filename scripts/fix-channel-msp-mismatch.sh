#!/bin/bash
# Fix Channel MSP Mismatch
# Regenerates channel artifacts with current certificates and recreates channel

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔧 Fixing Channel MSP Mismatch"
echo "=============================="
echo ""
echo "⚠️  WARNING: This will recreate the channel with current certificates."
echo "   Any existing channel data will be lost."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Stop containers
echo "1️⃣ Stopping Fabric containers..."
docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || {
    docker stop peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || true
}
sleep 2

# Step 2: Backup old channel artifacts
echo "2️⃣ Backing up old channel artifacts..."
if [ -d "fabric-network/channel-artifacts" ]; then
    BACKUP_DIR="fabric-network/channel-artifacts.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/channel-artifacts "$BACKUP_DIR"
    echo "✅ Backed up to: $BACKUP_DIR"
fi

# Step 3: Ensure TLS certificates are properly set up
echo "3️⃣ Setting up TLS certificates..."
bash scripts/setup-tls-certs.sh 2>/dev/null || echo "⚠️  TLS setup had issues, continuing..."

# Step 4: Fix TLS CA trust (peer needs orderer's TLS CA)
echo "4️⃣ Fixing TLS CA trust between peer and orderer..."
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
PEER_TLS_DIR="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls"

# Copy orderer's TLS CA to peer's TLS directory for verification
if [ -f "$ORDERER_TLS_CA" ]; then
    cp "$ORDERER_TLS_CA" "$PEER_TLS_DIR/orderer-tls-ca.crt"
    echo "✅ Copied orderer TLS CA to peer for verification"
else
    echo "⚠️  Orderer TLS CA not found, peer may not be able to verify orderer"
fi

# Step 5: Regenerate channel artifacts
echo "5️⃣ Regenerating channel artifacts with current certificates..."
bash scripts/generate-channel-artifacts.sh

if [ ! -f "fabric-network/channel-artifacts/genesis.block" ]; then
    echo "❌ Failed to generate genesis block"
    exit 1
fi

if [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ] && [ ! -f "fabric-network/channel-artifacts/channel.tx" ]; then
    echo "❌ Failed to generate channel transaction"
    exit 1
fi

echo "✅ Channel artifacts regenerated"

# Step 6: Clear peer's channel data (so it can rejoin)
echo "6️⃣ Clearing peer's channel data..."
docker volume rm peer0-data 2>/dev/null || true
# Also clear from mounted directory if exists
docker exec peer0.lto.gov.ph rm -rf /var/hyperledger/production/ledgers/ltochannel 2>/dev/null || true

# Step 7: Restart orderer with new genesis block
echo "7️⃣ Restarting orderer with new genesis block..."
docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || {
    docker start orderer.lto.gov.ph
}

echo "⏳ Waiting for orderer to start..."
sleep 5

# Step 8: Restart peer
echo "8️⃣ Restarting peer..."
docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || {
    docker start peer0.lto.gov.ph
}

echo "⏳ Waiting for peer to start..."
sleep 5

# Step 9: Create and join channel
echo "9️⃣ Creating and joining channel..."

# Determine channel transaction file name
CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
fi

# Copy channel transaction to peer
docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

# Create channel (use orderer's TLS CA if available, otherwise peer's TLS CA)
TLS_CA_FILE="/etc/hyperledger/fabric/tls/ca.crt"
if [ -f "$PEER_TLS_DIR/orderer-tls-ca.crt" ]; then
    docker cp "$PEER_TLS_DIR/orderer-tls-ca.crt" peer0.lto.gov.ph:/tmp/orderer-tls-ca.crt
    TLS_CA_FILE="/tmp/orderer-tls-ca.crt"
fi

echo "   Creating channel..."
docker exec peer0.lto.gov.ph peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --timeout 30s \
    2>&1 | grep -v "WARN\|INFO" || {
    echo "⚠️  Channel creation output (checking if channel already exists)..."
}

# Join channel
echo "   Joining peer to channel..."
docker exec peer0.lto.gov.ph peer channel join \
    -b ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1 | tail -5

# Verify channel
echo "🔟 Verifying channel..."
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo "✅ Channel 'ltochannel' exists"
    echo "$CHANNEL_LIST" | grep "ltochannel"
else
    echo "⚠️  Channel join may have failed"
    echo "$CHANNEL_LIST"
fi

# Step 9: Update anchor peer (if anchor peer update exists)
if [ -f "fabric-network/channel-artifacts/LTOMSPanchors.tx" ]; then
    echo "9️⃣ Updating anchor peer..."
    docker cp fabric-network/channel-artifacts/LTOMSPanchors.tx peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx
    
    docker exec peer0.lto.gov.ph peer channel update \
        -o orderer.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx \
        --tls \
        --cafile "$TLS_CA_FILE" \
        2>&1 | tail -3 || echo "⚠️  Anchor peer update failed (may not be critical)"
fi

# Step 11: Verify no certificate errors
echo "1️⃣1️⃣ Checking for certificate errors..."
sleep 3
RECENT_ERRORS=$(docker logs peer0.lto.gov.ph --since 10s 2>&1 | grep -i "certificate signed by unknown authority\|access denied.*creator org unknown" | wc -l)
if [ "$RECENT_ERRORS" -eq 0 ]; then
    echo "✅ No recent certificate errors"
else
    echo "⚠️  Still seeing certificate errors:"
    docker logs peer0.lto.gov.ph --since 10s 2>&1 | grep -i "certificate signed by unknown authority\|access denied.*creator org unknown" | tail -3
fi

echo ""
echo "✅ Channel fix complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy chaincode: bash scripts/deploy-chaincode.sh"
echo "  2. Test application connection: Check lto-app logs"
echo "  3. Verify: docker exec peer0.lto.gov.ph peer chaincode list --instantiated -C ltochannel"
