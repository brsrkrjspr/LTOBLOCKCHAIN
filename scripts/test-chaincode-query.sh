#!/bin/bash

# Test Chaincode Query After Peer Fix
# This script ensures all containers are running and tests the chaincode query

set -e

echo "=========================================="
echo "Testing Chaincode Query"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Ensuring all containers are running..."
docker-compose -f docker-compose.unified.yml up -d

echo ""
echo "Step 2: Waiting for containers to be ready (15 seconds)..."
sleep 15

echo ""
echo "Step 3: Checking container status..."
if docker ps | grep -q "cli.*Up"; then
    echo "✓ CLI container is running"
else
    echo "✗ CLI container is not running!"
    docker logs cli 2>&1 | tail -20
    exit 1
fi

if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "✓ Peer container is running"
else
    echo "✗ Peer container is not running!"
    exit 1
fi

echo ""
echo "Step 4: Testing chaincode query..."
echo "Query: GetAllVehicles"
echo ""

# Execute query inside CLI container
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "=========================================="
    echo "✅ SUCCESS! Chaincode query worked!"
    echo "=========================================="
    echo ""
    echo "The peer is now working correctly with:"
    echo "  ✓ Config file loaded (mode: dev)"
    echo "  ✓ System chaincodes deployed"
    echo "  ✓ Chaincode queries working"
    echo ""
else
    echo "=========================================="
    echo "❌ Query failed with exit code: $EXIT_CODE"
    echo "=========================================="
    echo ""
    echo "Checking peer logs for errors..."
    docker logs peer0.lto.gov.ph 2>&1 | tail -30
    exit 1
fi
