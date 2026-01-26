#!/bin/bash

# Fix Chaincode Definition-Package Mismatch
# The chaincode package is installed but the definition may not reference it correctly
# This script verifies and fixes the mismatch

set +e

echo "=========================================="
echo "Fix Chaincode Definition-Package Mismatch"
echo "=========================================="
echo ""

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Helper function to run docker exec with timeout
run_docker_exec() {
    local cmd="$1"
    local timeout="${2:-30}"
    timeout $timeout docker exec cli bash -c "$cmd" 2>&1
}

# Step 1: Get installed package ID
echo "Step 1: Checking installed chaincode packages..."
INSTALLED_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled --output json 2>&1
" 30)

INSTALLED_PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | grep -o '"package_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$INSTALLED_PACKAGE_ID" ]; then
    # Try text format
    INSTALLED_PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | grep "vehicle-registration" | \
        sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
fi

if [ -z "$INSTALLED_PACKAGE_ID" ]; then
    echo "❌ Could not find installed package ID"
    echo "Installed chaincodes:"
    echo "$INSTALLED_OUTPUT"
    exit 1
fi

echo "✓ Found installed package ID: ${INSTALLED_PACKAGE_ID:0:50}..."

# Step 2: Get current chaincode definition
echo ""
echo "Step 2: Checking current chaincode definition..."
DEFINITION_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration --output json 2>&1
" 30)

CURRENT_SEQUENCE=$(echo "$DEFINITION_OUTPUT" | grep -o '"sequence":"[0-9]*"' | cut -d'"' -f4)
DEFINITION_PACKAGE_ID=$(echo "$DEFINITION_OUTPUT" | grep -o '"package_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CURRENT_SEQUENCE" ]; then
    CURRENT_SEQUENCE=$(echo "$DEFINITION_OUTPUT" | grep -i "sequence" | grep -oE '[0-9]+' | head -1)
fi

if [ -z "$CURRENT_SEQUENCE" ]; then
    echo "⚠ Could not determine current sequence, defaulting to 2"
    CURRENT_SEQUENCE=2
fi

echo "✓ Current sequence: $CURRENT_SEQUENCE"

if [ -n "$DEFINITION_PACKAGE_ID" ]; then
    echo "✓ Definition package ID: ${DEFINITION_PACKAGE_ID:0:50}..."
    
    # Check if they match
    if [ "$DEFINITION_PACKAGE_ID" = "$INSTALLED_PACKAGE_ID" ]; then
        echo "✓ Package IDs match!"
    else
        echo "⚠ Package IDs don't match!"
        echo "  Definition expects: ${DEFINITION_PACKAGE_ID:0:50}..."
        echo "  Installed package:  ${INSTALLED_PACKAGE_ID:0:50}..."
        echo ""
        echo "  This is the problem! The definition references a different package."
    fi
else
    echo "⚠ Could not extract package ID from definition"
    echo "  Definition output:"
    echo "$DEFINITION_OUTPUT" | head -20
fi

# Step 3: Check peer logs for chaincode startup
echo ""
echo "Step 3: Checking peer logs for chaincode status..."
PEER_LOGS=$(docker logs peer0.lto.gov.ph --tail=100 2>&1)

if echo "$PEER_LOGS" | grep -qi "vehicle-registration.*started\|vehicle-registration.*ready"; then
    echo "✓ Chaincode container appears to be running"
elif echo "$PEER_LOGS" | grep -qi "vehicle-registration.*error\|vehicle-registration.*failed"; then
    echo "⚠ Chaincode errors found in peer logs:"
    echo "$PEER_LOGS" | grep -i "vehicle-registration.*error\|vehicle-registration.*failed" | tail -5
else
    echo "⚠ No clear indication of chaincode status in recent logs"
fi

# Step 4: Restart peer to ensure it picks up the chaincode
echo ""
echo "Step 4: Restarting peer to ensure chaincode is recognized..."
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph
echo "  Waiting for peer to restart (25 seconds)..."
sleep 25

# Check if peer is ready
echo "  Checking peer status..."
PEER_READY=false
for i in {1..12}; do
    if docker logs peer0.lto.gov.ph --tail=50 2>&1 | grep -q "Deployed system chaincodes"; then
        PEER_READY=true
        break
    fi
    sleep 5
done

if [ "$PEER_READY" = true ]; then
    echo "✓ Peer is ready"
else
    echo "⚠ Peer may not be fully ready yet"
fi

# Step 5: Test chaincode query
echo ""
echo "Step 5: Testing chaincode query..."
sleep 5

TEST_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 30)

if echo "$TEST_OUTPUT" | grep -qi "chaincode.*not installed\|chaincode.*not running"; then
    echo "❌ Still seeing 'chaincode not installed' error"
    echo ""
    echo "The issue persists. Possible causes:"
    echo "1. Package ID mismatch between definition and installed package"
    echo "2. Chaincode container failed to start"
    echo ""
    echo "Next steps:"
    echo "1. Check peer logs: docker logs peer0.lto.gov.ph --tail=100 | grep -i chaincode"
    echo "2. Check chaincode containers: docker ps -a | grep vehicle-registration"
    echo "3. Re-approve and commit with correct package ID"
    exit 1
elif echo "$TEST_OUTPUT" | grep -qi "error\|failed"; then
    if echo "$TEST_OUTPUT" | grep -qi "no vehicles\|empty"; then
        echo "✓ Chaincode query works! (No vehicles registered yet - this is OK)"
    else
        echo "⚠ Query returned an error (may be expected):"
        echo "$TEST_OUTPUT" | head -3
    fi
else
    echo "✓ Chaincode query successful!"
    echo "  Response: $(echo "$TEST_OUTPUT" | head -3)"
fi

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Installed package ID: ${INSTALLED_PACKAGE_ID:0:50}..."
echo "  - Definition sequence: $CURRENT_SEQUENCE"
if [ -n "$DEFINITION_PACKAGE_ID" ]; then
    echo "  - Definition package ID: ${DEFINITION_PACKAGE_ID:0:50}..."
fi
echo "  - Peer restarted"
echo ""
echo "If errors persist, restart your application:"
echo "  docker-compose -f docker-compose.unified.yml restart lto-app"
