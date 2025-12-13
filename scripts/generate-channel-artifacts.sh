#!/bin/bash
# TrustChain LTO - Generate Fabric Channel Artifacts
# Bash version for Codespace deployment
# Uses Docker to avoid installing Fabric binaries

set -e

echo "📦 Generating Hyperledger Fabric channel artifacts..."

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi

# Check if crypto materials exist
if [ ! -d "fabric-network/crypto-config" ]; then
    echo "❌ Cryptographic materials not found!"
    echo "💡 Please run generate-crypto.sh first"
    exit 1
fi

# Create channel-artifacts directory
CHANNEL_DIR="fabric-network/channel-artifacts"
if [ -d "$CHANNEL_DIR" ]; then
    echo "⚠️  Channel artifacts directory exists. Removing old artifacts..."
    rm -rf "$CHANNEL_DIR"
fi

mkdir -p "$CHANNEL_DIR"
echo "✅ Created channel-artifacts directory"

# Copy configtx.yaml to fabric-network directory
# Check multiple possible locations
if [ -f "configtx.yaml" ]; then
    cp configtx.yaml fabric-network/configtx.yaml
    echo "✅ Copied configtx.yaml from root"
elif [ -f "config/configtx.yaml" ]; then
    cp config/configtx.yaml fabric-network/configtx.yaml
    echo "✅ Copied configtx.yaml from config/"
else
    echo "❌ configtx.yaml not found in root or config/"
    exit 1
fi

# Get absolute path for Docker volume mount
WORKSPACE_PATH=$(pwd)/fabric-network

echo "🔧 Generating genesis block..."

# Generate genesis block using Docker
docker run --rm \
    -v "$WORKSPACE_PATH:/workspace" \
    -w /workspace \
    -e FABRIC_CFG_PATH=/workspace \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate genesis block"
    exit 1
fi

echo "✅ Genesis block generated"

echo "🔧 Generating channel creation transaction..."

# Generate channel creation transaction
docker run --rm \
    -v "$WORKSPACE_PATH:/workspace" \
    -w /workspace \
    -e FABRIC_CFG_PATH=/workspace \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOChannel -channelID ltochannel -outputCreateChannelTx ./channel-artifacts/ltochannel.tx

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate channel transaction"
    exit 1
fi

echo "✅ Channel transaction generated"

echo "🔧 Generating anchor peer update..."

# Generate anchor peer update
docker run --rm \
    -v "$WORKSPACE_PATH:/workspace" \
    -w /workspace \
    -e FABRIC_CFG_PATH=/workspace \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOChannel -channelID ltochannel -outputAnchorPeersUpdate ./channel-artifacts/LTOMSPanchors.tx -asOrg LTO

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate anchor peer update"
    exit 1
fi

echo "✅ Anchor peer update generated"

# Clean up temporary file
rm -f fabric-network/configtx.yaml

echo "🎉 Channel artifacts generation complete!"
echo "📁 Artifacts saved to: fabric-network/channel-artifacts"

