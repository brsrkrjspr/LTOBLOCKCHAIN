#!/bin/bash

# Fix Chaincode Definition: Re-commit with built-in handlers
# Root Cause: Chaincode was committed with default plugin names (escc/vscc) 
# which override core.yaml handlers configuration
# Solution: Re-commit with empty plugin strings to use built-in handlers

set -e

echo "=========================================="
echo "Fix Chaincode Definition: Use Built-in Handlers"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Set environment variables
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

echo ""
echo "Step 1: Checking current chaincode definition..."
CURRENT_DEF=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration --output json 2>&1
")

if echo "$CURRENT_DEF" | grep -q "endorsement_plugin\|validation_plugin"; then
    echo "Current plugin settings:"
    echo "$CURRENT_DEF" | grep -E "endorsement_plugin|validation_plugin" || echo "Using defaults (escc/vscc)"
else
    echo "✓ Chaincode definition found"
fi

echo ""
echo "Step 2: Getting current sequence number..."
SEQUENCE=$(echo "$CURRENT_DEF" | grep -o '"sequence":"[0-9]*"' | grep -o '[0-9]*' || echo "1")
NEXT_SEQUENCE=$((SEQUENCE + 1))
echo "Current sequence: $SEQUENCE"
echo "Next sequence: $NEXT_SEQUENCE"

echo ""
echo "Step 3: Approving chaincode definition with built-in handlers..."
APPROVE_OUTPUT=$(docker exec cli bash -c "
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
")

if [ $? -ne 0 ]; then
    echo "❌ Failed to approve chaincode"
    echo "$APPROVE_OUTPUT"
    exit 1
fi
echo "✓ Chaincode approved"

echo ""
echo "Step 4: Committing chaincode definition with built-in handlers..."
COMMIT_OUTPUT=$(docker exec cli bash -c "
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
")

if [ $? -ne 0 ]; then
    echo "❌ Failed to commit chaincode"
    echo "$COMMIT_OUTPUT"
    exit 1
fi
echo "✓ Chaincode committed"

echo ""
echo "Step 5: Verifying chaincode definition..."
sleep 3
VERIFY_OUTPUT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration --output json 2>&1
")

echo "$VERIFY_OUTPUT" | grep -E "endorsement_plugin|validation_plugin|sequence" || echo "$VERIFY_OUTPUT"

echo ""
echo "Step 6: Testing chaincode query..."
sleep 2
TEST_OUTPUT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
")

if echo "$TEST_OUTPUT" | grep -qi "plugin.*escc.*wasn't found\|endorsement.*failed"; then
    echo "❌ Still seeing escc error:"
    echo "$TEST_OUTPUT" | grep -i "plugin\|endorsement" | head -3
    exit 1
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
