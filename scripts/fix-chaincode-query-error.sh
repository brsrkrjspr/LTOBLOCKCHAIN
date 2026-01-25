#!/bin/bash

# Fix Chaincode Query Error
# Updates core.yaml to use dev mode instead of net mode

set -e

echo "=========================================="
echo "Fixing Chaincode Query Error"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Check if core.yaml exists
if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "✗ ERROR: core.yaml not found!"
    echo "Run fix-peer-fabric-cfg-path.sh first"
    exit 1
fi

echo ""
echo "Step 1: Updating core.yaml chaincode mode..."
# Change mode from 'net' to 'dev' to allow built-in system chaincodes
sed -i 's/mode: net/mode: dev/' fabric-network/config/core.yaml

if grep -q "mode: dev" fabric-network/config/core.yaml; then
    echo "✓ core.yaml updated successfully (mode: dev)"
else
    echo "⚠ WARNING: Could not verify mode change"
fi

echo ""
echo "Step 2: Restarting peer container..."
docker restart peer0.lto.gov.ph

echo ""
echo "Step 3: Waiting for peer to restart (15 seconds)..."
sleep 15

echo ""
echo "Step 4: Checking peer logs..."
docker logs peer0.lto.gov.ph 2>&1 | tail -20

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Now test the query:"
echo "  docker exec -it cli bash"
echo "  peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'"
echo ""
