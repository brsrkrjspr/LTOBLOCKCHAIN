#!/bin/bash

# Fix Chaincode Query Error - Remove core.yaml
# The core.yaml is interfering with plugin loading
# Since we use environment variables, we don't need it

set -e

echo "=========================================="
echo "Fixing Chaincode Query Error (Remove core.yaml)"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Removing core.yaml (using environment variables instead)..."
if [ -f "fabric-network/config/core.yaml" ]; then
    rm fabric-network/config/core.yaml
    echo "✓ core.yaml removed"
else
    echo "⚠ core.yaml not found (already removed?)"
fi

# Remove config directory mount from docker-compose (if needed)
echo ""
echo "Step 2: Updating docker-compose to remove config mount..."
# Note: docker-compose.unified.yml should already have FABRIC_CFG_PATH= set
# and config mount removed

echo ""
echo "Step 3: Restarting peer container..."
docker restart peer0.lto.gov.ph

echo ""
echo "Step 4: Waiting for peer to restart (20 seconds)..."
sleep 20

echo ""
echo "Step 5: Checking peer logs..."
docker logs peer0.lto.gov.ph 2>&1 | tail -30

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Now test the query:"
echo "  docker exec -it cli bash"
echo "  peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'"
echo ""
