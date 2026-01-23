#!/bin/bash
# Quick Fix: Clear Orderer Ledger and Fix TLS for Channel Creation
# Run this if channel creation fails because orderer thinks channel exists

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔧 Fixing Orderer Ledger and TLS for Channel Creation"
echo "======================================================"
echo ""

# Step 1: Stop orderer
echo "1️⃣ Stopping orderer..."
docker stop orderer.lto.gov.ph 2>/dev/null || true
sleep 2

# Step 2: Remove orderer volume (contains ledger with old channel data)
echo "2️⃣ Removing orderer ledger data..."
docker volume rm orderer-data 2>/dev/null || {
    echo "⚠️  Volume may not exist or is in use"
}

# Also clear from mounted directory if exists
if [ -d "fabric-network/orderer-data" ]; then
    rm -rf fabric-network/orderer-data
    echo "✅ Cleared orderer-data directory"
fi

# Step 3: Find and verify orderer TLS CA
echo "3️⃣ Finding orderer TLS CA certificate..."
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
ORDERER_TLSCA_DIR="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca"

if [ ! -f "$ORDERER_TLS_CA" ]; then
    ORDERER_TLS_CA=$(find "$ORDERER_TLSCA_DIR" -name "*.pem" 2>/dev/null | head -1)
fi

if [ ! -f "$ORDERER_TLS_CA" ]; then
    ORDERER_TLS_CA=$(find "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/msp/cacerts" -name "*.pem" 2>/dev/null | head -1)
fi

if [ ! -f "$ORDERER_TLS_CA" ]; then
    echo "❌ Orderer TLS CA not found!"
    echo "💡 Regenerating certificates..."
    bash scripts/generate-crypto.sh
    ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
fi

if [ -f "$ORDERER_TLS_CA" ]; then
    echo "✅ Found orderer TLS CA: $ORDERER_TLS_CA"
else
    echo "❌ Still cannot find orderer TLS CA after regeneration"
    exit 1
fi

# Step 4: Restart orderer
echo "4️⃣ Restarting orderer..."
docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || {
    docker start orderer.lto.gov.ph
}

echo "⏳ Waiting for orderer to start..."
sleep 10

# Step 5: Verify orderer is ready
echo "5️⃣ Verifying orderer is ready..."
for i in {1..30}; do
    if docker logs orderer.lto.gov.ph 2>&1 | grep -q "Beginning to serve requests\|Raft leader"; then
        echo "✅ Orderer is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Orderer may not be fully ready, but continuing..."
    fi
    sleep 1
done

# Step 6: Copy orderer TLS CA to peer
echo "6️⃣ Copying orderer TLS CA to peer..."
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "⚠️  Peer is not running, starting it..."
    docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || \
    docker start peer0.lto.gov.ph
    sleep 5
fi

docker cp "$ORDERER_TLS_CA" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt

if docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt; then
    echo "✅ Orderer TLS CA copied to peer"
else
    echo "❌ Failed to copy orderer TLS CA"
    exit 1
fi

# Step 7: Create channel
echo "7️⃣ Creating channel..."
CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
fi

if [ ! -f "$CHANNEL_TX" ]; then
    echo "❌ Channel transaction file not found!"
    echo "💡 Regenerating channel artifacts..."
    bash scripts/generate-channel-artifacts.sh
    CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
    if [ ! -f "$CHANNEL_TX" ]; then
        CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
    fi
fi

docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

TLS_CA_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"

echo "   Creating channel 'ltochannel'..."
echo "   This may take up to 2 minutes..."

# Run channel creation in background with timeout, capture output
CHANNEL_CREATE_OUTPUT=$(timeout 120s docker exec peer0.lto.gov.ph peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --timeout 90s \
    2>&1) || {
    CHANNEL_CREATE_EXIT=$?
    echo ""
    echo "⚠️  Channel creation command exited with code: $CHANNEL_CREATE_EXIT"
    echo "   Output:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -20
    echo ""
    echo "💡 Checking if channel block was created anyway..."
    if docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block; then
        echo "✅ Channel block exists! Channel may have been created successfully"
        CHANNEL_CREATE_OUTPUT="Channel created successfully (block file exists)"
    else
        echo "❌ Channel block not found"
        echo ""
        echo "💡 Checking orderer logs..."
        docker logs orderer.lto.gov.ph --tail 30 | grep -i "ltochannel\|error\|channel\|tls" || docker logs orderer.lto.gov.ph --tail 30
        echo ""
        echo "💡 Checking peer logs..."
        docker logs peer0.lto.gov.ph --tail 30 | grep -i "ltochannel\|error\|channel\|tls" || docker logs peer0.lto.gov.ph --tail 30
        exit 1
    fi
}

if echo "$CHANNEL_CREATE_OUTPUT" | grep -qi "successfully\|created"; then
    echo "✅ Channel created successfully"
    echo "$CHANNEL_CREATE_OUTPUT" | grep -i "successfully\|created" | head -3
elif echo "$CHANNEL_CREATE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel creation failed:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -15
    echo ""
    echo "💡 Orderer logs (last 20 lines):"
    docker logs orderer.lto.gov.ph --tail 20 | grep -i "ltochannel\|error\|channel" || docker logs orderer.lto.gov.ph --tail 20
    exit 1
else
    echo "$CHANNEL_CREATE_OUTPUT" | tail -10
fi

# Step 8: Join channel
echo "8️⃣ Joining peer to channel..."
CHANNEL_JOIN_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1)

if echo "$CHANNEL_JOIN_OUTPUT" | grep -qi "successfully\|joined"; then
    echo "✅ Peer joined channel successfully"
elif echo "$CHANNEL_JOIN_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel join failed:"
    echo "$CHANNEL_JOIN_OUTPUT" | tail -5
    exit 1
else
    echo "$CHANNEL_JOIN_OUTPUT" | tail -5
fi

# Verify
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo ""
    echo "✅ SUCCESS! Channel 'ltochannel' created and joined"
    echo "$CHANNEL_LIST" | grep "ltochannel"
else
    echo "⚠️  Channel verification failed"
    echo "$CHANNEL_LIST"
fi
