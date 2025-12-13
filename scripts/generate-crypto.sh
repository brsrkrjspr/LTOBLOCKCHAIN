#!/bin/bash
# TrustChain LTO - Generate Fabric Cryptographic Materials
# Bash version for Codespace deployment
# Uses Docker to avoid installing Fabric binaries

set -e

echo "🔐 Generating Hyperledger Fabric cryptographic materials..."

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi

# Create directories
CRYPTO_DIR="fabric-network/crypto-config"
if [ -d "$CRYPTO_DIR" ]; then
    echo "⚠️  Crypto directory exists. Removing old materials..."
    rm -rf "$CRYPTO_DIR"
fi

mkdir -p "$CRYPTO_DIR"
echo "✅ Created crypto-config directory"

# Copy crypto-config.yaml to fabric-network directory
# Check multiple possible locations
if [ -f "crypto-config.yaml" ]; then
    cp crypto-config.yaml fabric-network/crypto-config.yaml
    echo "✅ Copied crypto-config.yaml from root"
elif [ -f "config/crypto-config.yaml" ]; then
    cp config/crypto-config.yaml fabric-network/crypto-config.yaml
    echo "✅ Copied crypto-config.yaml from config/"
elif [ -f "fabric-network/crypto-config-simple.yaml" ]; then
    cp fabric-network/crypto-config-simple.yaml fabric-network/crypto-config.yaml
    echo "✅ Copied crypto-config-simple.yaml"
else
    echo "❌ crypto-config.yaml not found in root, config/, or fabric-network/"
    exit 1
fi

# Get absolute path for Docker volume mount
WORKSPACE_PATH=$(pwd)/fabric-network

echo "🔧 Generating certificates using Docker..."

# Run cryptogen in Docker container
docker run --rm \
    -v "$WORKSPACE_PATH:/workspace" \
    -w /workspace \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

if [ $? -eq 0 ]; then
    echo "✅ Cryptographic materials generated successfully!"
    echo "📁 Materials saved to: fabric-network/crypto-config"
else
    echo "❌ Failed to generate cryptographic materials"
    exit 1
fi

# Clean up temporary file
rm -f fabric-network/crypto-config.yaml

echo "🎉 Crypto generation complete!"

