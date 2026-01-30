#!/bin/bash
set -e

echo "=========================================="
echo "Start Chaincode Container (CCAAS)"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.." || exit 1

CHAINCODE_SERVICE="chaincode-vehicle-reg"

echo "Step 1: Querying installed chaincode package ID..."

QUERY_OUTPUT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled 2>&1
" 2>&1)

# Format: Package ID: vehicle-registration_1.0:abc123..., Label: vehicle-registration_1.0
PACKAGE_ID=$(echo "$QUERY_OUTPUT" | grep "Package ID" | grep "vehicle-registration" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    echo "⚠ Could not find 'vehicle-registration' package in installed chaincodes."
    echo "Output from peer:"
    echo "$QUERY_OUTPUT"
    echo ""
    echo "Possible reasons:"
    echo "1. Chaincode is not installed. Run 'scripts/install-chaincode-ccaas.sh' first."
    echo "2. Peer is not running."
    exit 1
fi

echo "✓ Found Package ID: $PACKAGE_ID"
echo ""

echo "Step 2: Starting chaincode container..."

# Start with the environment variable
CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f docker-compose.unified.yml up -d "$CHAINCODE_SERVICE"

echo ""
echo "✅ Chaincode container started successfully!"
echo "   ID: $PACKAGE_ID"
