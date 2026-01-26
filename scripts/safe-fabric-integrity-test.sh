#!/bin/bash

# Safe Fabric Integrity Testing Script
# Step-by-step interactive guide for testing Fabric integrity

set -e

echo "=========================================="
echo "Safe Fabric Integrity Testing"
echo "=========================================="
echo ""
echo "This script guides you through safe integrity testing."
echo "Starting with read-only queries, then safe writes."
echo ""

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Check prerequisites
echo "Step 0: Checking prerequisites..."
if ! docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "  ✗ Peer container is not running!"
    echo "  Start it with: docker-compose -f docker-compose.unified.yml up -d"
    exit 1
fi
echo "  ✓ Peer container is running"

if ! docker ps | grep -q "cli.*Up"; then
    echo "  ✗ CLI container is not running!"
    echo "  Start it with: docker-compose -f docker-compose.unified.yml up -d"
    exit 1
fi
echo "  ✓ CLI container is running"

echo ""
echo "=========================================="
echo "PHASE 1: Safe Read-Only Queries"
echo "=========================================="
echo ""

echo "Test 1.1: Query All Vehicles (Safe - Read Only)"
echo "Press Enter to continue..."
read

docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

echo 'Executing query...'
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
"

echo ""
echo "✅ Did the query succeed? (y/n)"
read -r response
if [ "$response" != "y" ]; then
    echo "⚠️  Query failed. Check peer logs: docker logs peer0.lto.gov.ph --tail=30"
    exit 1
fi

echo ""
echo "Test 1.2: Query Specific Vehicle"
echo "Enter a VIN to query (or press Enter to skip):"
read -r test_vin

if [ -n "$test_vin" ]; then
    docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetVehicle\",\"Args\":[\"'"$test_vin"'\"]}'
"
fi

echo ""
echo "=========================================="
echo "PHASE 2: Safe Write Operations"
echo "=========================================="
echo ""

echo "Test 2.1: Register a Test Vehicle"
echo "This will create a test vehicle with a unique VIN."
echo "Press Enter to continue..."
read

# Generate unique test VIN
TEST_VIN="TEST_$(date +%s)_INTEGRITY"
echo "Using test VIN: $TEST_VIN"
echo "$TEST_VIN" > /tmp/test_vin.txt

# Create vehicle data
VEHICLE_JSON='{"vin":"'"$TEST_VIN"'","make":"Toyota","model":"Camry","year":2024,"color":"White","owner":{"name":"Test Owner","email":"test@example.com","address":"123 Test St"},"plateNumber":"TEST-1234","vehicleType":"Car"}'

echo ""
echo "Registering test vehicle..."
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode invoke -C ltochannel -n vehicle-registration -c '{\"function\":\"RegisterVehicle\",\"Args\":[\"'"$VEHICLE_JSON"'\"]}'
"

echo ""
echo "✅ Did registration succeed? (y/n)"
read -r response
if [ "$response" != "y" ]; then
    echo "⚠️  Registration failed. Check logs."
    exit 1
fi

echo ""
echo "Verifying vehicle was registered..."
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetVehicle\",\"Args\":[\"'"$TEST_VIN"'\"]}'
"

echo ""
echo "=========================================="
echo "PHASE 3: Integrity Protection Tests"
echo "=========================================="
echo ""

echo "Test 3.1: Attempt Duplicate Registration (Should Fail)"
echo "This test verifies that duplicate VINs are rejected."
echo "Press Enter to continue..."
read

DUPLICATE_JSON='{"vin":"'"$TEST_VIN"'","make":"Honda","model":"Civic","year":2023,"owner":{"name":"Different Owner","email":"different@example.com"},"plateNumber":"DUPL-5678"}'

echo ""
echo "Attempting to register duplicate VIN (should fail)..."
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode invoke -C ltochannel -n vehicle-registration -c '{\"function\":\"RegisterVehicle\",\"Args\":[\"'"$DUPLICATE_JSON"'\"]}'
" 2>&1 || echo "✅ Transaction was rejected (expected behavior)"

echo ""
echo "Verifying original vehicle data was NOT changed..."
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetVehicle\",\"Args\":[\"'"$TEST_VIN"'\"]}'
"

echo ""
echo "✅ Does the vehicle still show Toyota Camry? (y/n)"
read -r response
if [ "$response" != "y" ]; then
    echo "⚠️  WARNING: Vehicle data may have been modified!"
fi

echo ""
echo "Test 3.2: Query Ownership History"
echo "Press Enter to continue..."
read

docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetOwnershipHistory\",\"Args\":[\"'"$TEST_VIN"'\"]}'
"

echo ""
echo "=========================================="
echo "Testing Complete!"
echo "=========================================="
echo ""
echo "Test VIN used: $TEST_VIN"
echo "Saved to: /tmp/test_vin.txt"
echo ""
echo "Summary:"
echo "  ✓ Read-only queries tested"
echo "  ✓ Safe write operation tested"
echo "  ✓ Integrity protection tested (duplicate prevention)"
echo ""
echo "Next steps:"
echo "  1. Review test results"
echo "  2. Check peer logs: docker logs peer0.lto.gov.ph --tail=50"
echo "  3. Document findings"
echo ""
