#!/bin/bash
# TrustChain LTO - Setup Fabric Channel
# Creates channel and joins peer without CLI container
# Uses docker exec on peer container directly

set -e

echo "🔗 Setting up Fabric channel..."

# Check if channel artifacts exist
CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    # Try alternative name
    CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
    if [ ! -f "$CHANNEL_TX" ]; then
        echo "❌ Channel transaction file not found!"
        echo "💡 Expected: fabric-network/channel-artifacts/ltochannel.tx or channel.tx"
        echo "💡 Run: bash scripts/generate-channel-artifacts.sh first"
        exit 1
    fi
fi

# Check if peer is running
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "❌ Peer container is not running!"
    echo "💡 Start Fabric network first: docker compose -f docker-compose.unified.yml up -d"
    exit 1
fi

# Check if orderer is running
if ! docker ps | grep -q "orderer.lto.gov.ph"; then
    echo "❌ Orderer container is not running!"
    echo "💡 Start Fabric network first: docker compose -f docker-compose.unified.yml up -d"
    exit 1
fi

echo "📦 Step 1: Creating channel..."

# Copy channel transaction to peer container
TX_FILENAME=$(basename "$CHANNEL_TX")
docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/

# Copy orderer TLS CA cert to peer container for channel creation
docker cp fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt \
  peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt

# Create channel using peer container
# Use orderer's TLS CA cert (not peer's) for connecting to orderer
docker exec peer0.lto.gov.ph peer channel create \
  -o orderer.lto.gov.ph:7050 \
  -c ltochannel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/$TX_FILENAME \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt \
  --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
  --timeout 60s

if [ $? -eq 0 ]; then
    echo "✅ Channel created successfully"
else
    echo "❌ Failed to create channel"
    echo "💡 Check peer and orderer logs for details"
    exit 1
fi

echo ""
echo "🔗 Step 2: Joining peer to channel..."

# Join peer to channel
docker exec peer0.lto.gov.ph peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block

if [ $? -eq 0 ]; then
    echo "✅ Peer joined channel successfully"
else
    echo "❌ Failed to join peer to channel"
    echo "💡 Check peer logs for details"
    exit 1
fi

echo ""
echo "📋 Step 3: Verifying channel..."

# Verify peer is in channel
docker exec peer0.lto.gov.ph peer channel list

echo ""
echo "🎉 Channel setup complete!"
echo ""
echo "Next steps:"
echo "  1. Install chaincode: bash scripts/install-chaincode.sh"
echo "  2. Instantiate chaincode: bash scripts/instantiate-chaincode.sh"
echo "  3. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"

