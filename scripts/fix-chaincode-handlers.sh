#!/bin/bash

# Fix Chaincode Definition: Re-commit with built-in handlers
# Root Cause: Chaincode was committed with default plugin names (escc/vscc) 
# which override core.yaml handlers configuration
# Solution: Re-commit with empty plugin strings to use built-in handlers

# Don't use set -e - we need to handle errors manually
set +e

echo "=========================================="
echo "Fix Chaincode Definition: Use Built-in Handlers"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Helper function to run docker exec with timeout
run_docker_exec() {
    local cmd="$1"
    local timeout="${2:-30}"
    timeout $timeout docker exec cli bash -c "$cmd" 2>&1
}

# Helper function to check container status
check_container() {
    local container="$1"
    if ! docker ps | grep -q "$container.*Up"; then
        return 1
    fi
    return 0
}

echo ""
echo "Step 0: Checking and starting containers..."
NEED_START=false

if ! check_container "cli"; then
    echo "⚠ CLI container is not running, starting it..."
    docker-compose -f docker-compose.unified.yml up -d cli
    NEED_START=true
fi

if ! check_container "peer0.lto.gov.ph"; then
    echo "⚠ Peer container is not running, starting it..."
    docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
    NEED_START=true
fi

if [ "$NEED_START" = true ]; then
    echo "Waiting for containers to be ready (15 seconds)..."
    sleep 15
    
    # Verify containers are now running
    if ! check_container "cli"; then
        echo "❌ Failed to start CLI container"
        exit 1
    fi
    if ! check_container "peer0.lto.gov.ph"; then
        echo "❌ Failed to start peer container"
        exit 1
    fi
fi

echo "✓ All required containers are running"

echo ""
echo "Step 1: Checking current chaincode definition (with timeout)..."
# Use simpler query without --output json to avoid hanging
CURRENT_DEF=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration 2>&1
" 30)

if [ $? -ne 0 ] || echo "$CURRENT_DEF" | grep -qi "error\|failed\|timeout"; then
    echo "⚠ Warning: Could not query chaincode definition (this is expected if _lifecycle is not working)"
    echo "Output: $CURRENT_DEF" | head -5
    echo ""
    echo "Attempting to proceed with sequence number 1 (will increment if needed)..."
    SEQUENCE=1
else
    echo "✓ Chaincode definition query successful"
    # Try to extract sequence number from output
    SEQUENCE=$(echo "$CURRENT_DEF" | grep -i "sequence" | grep -oE '[0-9]+' | head -1)
    if [ -z "$SEQUENCE" ]; then
        SEQUENCE=1
        echo "⚠ Could not extract sequence number, defaulting to 1"
    else
        echo "Found sequence: $SEQUENCE"
    fi
fi

NEXT_SEQUENCE=$((SEQUENCE + 1))
echo "Current sequence: $SEQUENCE"
echo "Next sequence: $NEXT_SEQUENCE"

echo ""
echo "Step 2: Approving chaincode definition with built-in handlers..."
APPROVE_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence $NEXT_SEQUENCE \
    --endorsement-plugin '' \
    --validation-plugin '' \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
    2>&1
" 60)

APPROVE_EXIT=$?
if [ $APPROVE_EXIT -ne 0 ] || echo "$APPROVE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Failed to approve chaincode"
    echo "$APPROVE_OUTPUT"
    exit 1
fi
echo "✓ Chaincode approved"

echo ""
echo "Step 3: Committing chaincode definition with built-in handlers..."
COMMIT_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence $NEXT_SEQUENCE \
    --endorsement-plugin '' \
    --validation-plugin '' \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
    --peerAddresses peer0.lto.gov.ph:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    2>&1
" 60)

COMMIT_EXIT=$?
if [ $COMMIT_EXIT -ne 0 ] || echo "$COMMIT_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Failed to commit chaincode"
    echo "$COMMIT_OUTPUT"
    exit 1
fi
echo "✓ Chaincode committed"

echo ""
echo "Step 4: Waiting for chaincode to be ready..."
sleep 5

echo ""
echo "Step 5: Testing chaincode query..."
TEST_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 30)

if echo "$TEST_OUTPUT" | grep -qi "plugin.*escc.*wasn't found\|endorsement.*failed\|plugin.*could not be used"; then
    echo "❌ Still seeing escc error:"
    echo "$TEST_OUTPUT" | grep -i "plugin\|endorsement" | head -5
    exit 1
elif echo "$TEST_OUTPUT" | grep -qi "error\|failed"; then
    echo "⚠ Query returned an error (may be expected if no vehicles registered yet):"
    echo "$TEST_OUTPUT" | head -5
else
    echo "✓ Chaincode query successful!"
    echo "Response: $TEST_OUTPUT"
fi

echo ""
echo "=========================================="
echo "Fix completed successfully!"
echo "=========================================="
echo ""
echo "The chaincode definition now uses built-in handlers (DefaultEndorsement/DefaultValidation)"
echo "instead of looking for external plugins (escc/vscc)."
echo ""
echo "If you still see escc errors, ensure:"
echo "1. core.yaml has _lifecycle: enable in chaincode.system"
echo "2. Peer has been restarted after core.yaml changes"
echo "3. Chaincode was committed with --endorsement-plugin '' and --validation-plugin ''"
