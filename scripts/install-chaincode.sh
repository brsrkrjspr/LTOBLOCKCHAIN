#!/bin/bash
# TrustChain LTO - Install Chaincode
# Installs vehicle-registration chaincode on peer

set -e

echo "📦 Installing chaincode..."

# Check if peer is running
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "❌ Peer container is not running!"
    exit 1
fi

# Check if chaincode directory exists
if [ ! -d "chaincode/vehicle-registration-production" ]; then
    echo "❌ Chaincode directory not found!"
    echo "💡 Expected: chaincode/vehicle-registration-production"
    exit 1
fi

# Copy chaincode to peer container
echo "📋 Copying chaincode to peer..."
docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/

# Install chaincode
echo "📦 Installing chaincode..."
docker exec peer0.lto.gov.ph peer chaincode install \
  -n vehicle-registration \
  -v 1.0 \
  -p github.com/chaincode/vehicle-registration-production \
  -l node

if [ $? -eq 0 ]; then
    echo "✅ Chaincode installed successfully"
else
    echo "❌ Failed to install chaincode"
    exit 1
fi

echo ""
echo "🎉 Chaincode installation complete!"

