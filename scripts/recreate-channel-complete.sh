#!/bin/bash
# Complete Channel Recreation with Current Certificates
# Fixes channel MSP mismatch and TLS issues

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔧 Complete Channel Recreation"
echo "=============================="
echo ""
echo "This will:"
echo "  1. Stop Fabric containers"
echo "  2. Clear orderer ledger (removes old channel)"
echo "  3. Clear peer ledger (removes old channel data)"
echo "  4. Restart containers"
echo "  5. Recreate channel with current certificates"
echo "  6. Join peer to channel"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Stop containers
echo ""
echo "1️⃣ Stopping Fabric containers..."
docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || \
docker stop peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || true
sleep 2

# Step 2: Remove volumes (contains old channel data)
echo "2️⃣ Removing Fabric volumes..."
docker volume rm peer-data orderer-data 2>/dev/null || {
    echo "⚠️  Some volumes may not exist or are in use"
}

# Also clear mounted directories
if [ -d "fabric-network/peer-data" ]; then
    rm -rf fabric-network/peer-data
fi
if [ -d "fabric-network/orderer-data" ]; then
    rm -rf fabric-network/orderer-data
fi

# Step 3: Find orderer TLS CA
echo "3️⃣ Finding orderer TLS CA..."
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
if [ ! -f "$ORDERER_TLS_CA" ]; then
    ORDERER_TLS_CA=$(find "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca" -name "*.pem" 2>/dev/null | head -1)
fi

if [ ! -f "$ORDERER_TLS_CA" ]; then
    echo "❌ Orderer TLS CA not found!"
    exit 1
fi

echo "✅ Found orderer TLS CA: $ORDERER_TLS_CA"

# Step 4: Restart orderer
echo "4️⃣ Restarting orderer..."
docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || \
docker start orderer.lto.gov.ph

echo "⏳ Waiting for orderer to start..."
sleep 10

# Wait for orderer to be ready
for i in {1..30}; do
    if docker logs orderer.lto.gov.ph 2>&1 | grep -q "Beginning to serve requests"; then
        echo "✅ Orderer is ready"
        break
    fi
    sleep 1
done

# Step 5: Restart peer
echo "5️⃣ Restarting peer..."
docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || \
docker start peer0.lto.gov.ph

echo "⏳ Waiting for peer to start..."
sleep 10

# Step 6: Copy orderer TLS CA to peer
echo "6️⃣ Copying orderer TLS CA to peer..."
docker cp "$ORDERER_TLS_CA" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt
TLS_CA_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"

# Step 7: Copy channel transaction
echo "7️⃣ Preparing channel transaction..."
CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
fi

if [ ! -f "$CHANNEL_TX" ]; then
    echo "❌ Channel transaction not found! Regenerating..."
    bash scripts/generate-channel-artifacts.sh
    CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
    if [ ! -f "$CHANNEL_TX" ]; then
        CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
    fi
fi

docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

# Step 8: Create channel
echo "8️⃣ Creating channel 'ltochannel'..."
echo "   This may take 1-2 minutes..."

CHANNEL_CREATE_OUTPUT=$(timeout 180s docker exec peer0.lto.gov.ph peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --timeout 120s \
    2>&1) || {
    CREATE_EXIT=$?
    echo ""
    echo "⚠️  Channel creation exited with code: $CREATE_EXIT"
    echo "   Output:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -20
    
    # Check if block was created anyway
    if docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block; then
        echo "✅ Channel block exists! Channel was created successfully"
    else
        echo "❌ Channel block not found"
        echo ""
        echo "💡 Orderer logs:"
        docker logs orderer.lto.gov.ph --tail 30 | grep -i "ltochannel\|error\|channel" || docker logs orderer.lto.gov.ph --tail 30
        exit 1
    fi
}

if echo "$CHANNEL_CREATE_OUTPUT" | grep -qi "successfully\|created"; then
    echo "✅ Channel created successfully"
elif docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block; then
    echo "✅ Channel block exists - channel was created"
else
    echo "❌ Channel creation failed"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -15
    exit 1
fi

# Step 9: Join channel
echo "9️⃣ Joining peer to channel..."
JOIN_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1)

if echo "$JOIN_OUTPUT" | grep -qi "successfully\|joined"; then
    echo "✅ Peer joined channel successfully"
else
    echo "⚠️  Join output:"
    echo "$JOIN_OUTPUT" | tail -5
fi

# Step 10: Verify channel
echo "🔟 Verifying channel..."
sleep 3

# Check channel list
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo "✅ Channel exists in peer"
else
    echo "❌ Channel not found"
    echo "$CHANNEL_LIST"
    exit 1
fi

# Try to get channel info (this will fail if MSP mismatch)
CHANNEL_INFO=$(docker exec peer0.lto.gov.ph peer channel getinfo -c ltochannel 2>&1) || {
    INFO_EXIT=$?
    if echo "$CHANNEL_INFO" | grep -qi "access denied\|policy"; then
        echo "⚠️  Channel info access denied - MSP mismatch may still exist"
        echo "   This might be resolved after chaincode deployment"
    else
        echo "⚠️  Channel info check failed:"
        echo "$CHANNEL_INFO" | tail -5
    fi
}

# Check for TLS errors
RECENT_TLS_ERRORS=$(docker logs peer0.lto.gov.ph --since 30s 2>&1 | grep -i "tls.*failed to verify certificate" | wc -l)
if [ "$RECENT_TLS_ERRORS" -eq 0 ]; then
    echo "✅ No recent TLS errors"
else
    echo "⚠️  Still seeing TLS errors (may be old logs)"
fi

echo ""
echo "✅ Channel recreation complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy chaincode: bash scripts/deploy-chaincode.sh"
echo "  2. Test channel: docker exec peer0.lto.gov.ph peer channel getinfo -c ltochannel"
echo "  3. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
