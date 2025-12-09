#!/bin/bash
# Complete Fabric Setup Script for Codespace
# Handles chaincode deployment with proper error handling

set -e

echo "📦 Completing Fabric Chaincode Deployment"
echo "=========================================="
echo ""

# Check if chaincode is already installed
if docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration"; then
    echo "✅ Chaincode already installed"
    exit 0
fi

echo "📦 Step 1: Packaging chaincode..."
docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

if [ $? -ne 0 ]; then
    echo "❌ Failed to package chaincode"
    exit 1
fi

echo "✅ Chaincode packaged"

echo "📤 Step 2: Installing chaincode..."
docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz

# Wait a bit for installation to complete
sleep 5

echo "🔍 Step 3: Getting package ID..."
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0" | \
    sed -n 's/.*vehicle-registration_1.0:\([a-f0-9]*\).*/\1/p')

if [ -z "$PACKAGE_ID" ]; then
    echo "⚠️  Package ID not found. Installation may have failed."
    echo "💡 Check peer logs: docker logs peer0.lto.gov.ph"
    exit 1
fi

echo "📋 Package ID: $PACKAGE_ID"

echo "✅ Step 4: Approving chaincode..."
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer1.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    echo "❌ Failed to approve chaincode"
    exit 1
fi

echo "✅ Chaincode approved"

echo "🚀 Step 5: Committing chaincode to channel..."
docker exec cli peer lifecycle chaincode commit \
    -o orderer1.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    echo "❌ Failed to commit chaincode"
    exit 1
fi

echo "✅ Chaincode committed"

echo "🧪 Step 6: Testing chaincode..."
docker exec cli peer chaincode query \
    -C ltochannel \
    -n vehicle-registration \
    -c '{"function":"GetSystemStats","Args":[]}' 2>&1 || echo "⚠️  Chaincode test failed (may need initialization)"

echo ""
echo "🎉 Chaincode deployment complete!"

