#!/bin/bash
# Fetch Channel Genesis Block and Join Channel
# Use this when channel exists but block file is missing

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔧 Fetching Channel Genesis Block and Joining Channel"
echo "====================================================="
echo ""

# Step 1: Verify channel exists
echo "1️⃣ Checking if channel exists..."
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo "✅ Channel 'ltochannel' already exists"
    echo "$CHANNEL_LIST" | grep "ltochannel"
    echo ""
    echo "💡 Channel already joined. If you need to rejoin, use:"
    echo "   docker exec peer0.lto.gov.ph peer channel fetch 0 ltochannel.block -c ltochannel -o orderer.lto.gov.ph:7050 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"
    exit 0
fi

# Step 2: Find orderer TLS CA
echo "2️⃣ Finding orderer TLS CA..."
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
if [ ! -f "$ORDERER_TLS_CA" ]; then
    ORDERER_TLS_CA=$(find "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca" -name "*.pem" 2>/dev/null | head -1)
fi

if [ ! -f "$ORDERER_TLS_CA" ]; then
    echo "❌ Orderer TLS CA not found!"
    exit 1
fi

echo "✅ Found orderer TLS CA: $ORDERER_TLS_CA"

# Step 3: Copy TLS CA to peer
echo "3️⃣ Copying orderer TLS CA to peer..."
docker cp "$ORDERER_TLS_CA" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt
TLS_CA_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"

# Step 4: Fetch genesis block (block 0) from orderer
echo "4️⃣ Fetching genesis block from orderer..."
FETCH_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel fetch 0 ltochannel.block \
    -c ltochannel \
    -o orderer.lto.gov.ph:7050 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1)

if echo "$FETCH_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Failed to fetch genesis block:"
    echo "$FETCH_OUTPUT" | tail -10
    exit 1
else
    echo "✅ Genesis block fetched"
    echo "$FETCH_OUTPUT" | tail -5
fi

# Step 5: Verify block file exists
if docker exec peer0.lto.gov.ph test -f ltochannel.block; then
    echo "✅ Block file exists: ltochannel.block"
else
    echo "❌ Block file not found after fetch"
    exit 1
fi

# Step 6: Join channel
echo "5️⃣ Joining peer to channel..."
JOIN_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel join \
    -b ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1)

if echo "$JOIN_OUTPUT" | grep -qi "successfully\|joined"; then
    echo "✅ Peer joined channel successfully"
elif echo "$JOIN_OUTPUT" | grep -qi "already exists\|already a member"; then
    echo "✅ Peer is already a member of the channel"
else
    echo "⚠️  Join output:"
    echo "$JOIN_OUTPUT" | tail -5
fi

# Step 7: Verify
echo "6️⃣ Verifying channel membership..."
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo ""
    echo "✅ SUCCESS! Channel 'ltochannel' is joined"
    echo "$CHANNEL_LIST" | grep "ltochannel"
else
    echo "⚠️  Channel not found in peer's channel list"
    echo "$CHANNEL_LIST"
fi
