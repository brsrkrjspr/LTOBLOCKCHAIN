#!/bin/bash

# Final Fix: Remove FABRIC_CFG_PATH entirely (don't set it at all)
# Setting FABRIC_CFG_PATH= (empty) still makes Fabric look for config file
# Solution: Don't set FABRIC_CFG_PATH at all, like docker-compose.fabric.yml

set -e

echo "=========================================="
echo "Final Fix: Remove FABRIC_CFG_PATH"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Verifying docker-compose changes..."
if grep -q "FABRIC_CFG_PATH" docker-compose.unified.yml; then
    echo "⚠ WARNING: FABRIC_CFG_PATH still found in docker-compose.unified.yml"
    echo "  It should be removed (not set to empty, but removed entirely)"
else
    echo "✓ FABRIC_CFG_PATH is not set (correct)"
fi

echo ""
echo "Step 2: Restarting peer container with updated config..."
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph

echo ""
echo "Step 3: Waiting for peer to restart (25 seconds)..."
sleep 25

echo ""
echo "Step 4: Checking peer status..."
if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "✓ Peer container is running"
else
    echo "✗ Peer container is not running!"
    echo "Checking logs..."
    docker logs peer0.lto.gov.ph 2>&1 | tail -20
    exit 1
fi

echo ""
echo "Step 5: Checking peer logs for errors..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "FABRIC_CFG_PATH\|config file\|core.*not found"; then
    echo "⚠ WARNING: Still seeing config file errors"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "FABRIC_CFG_PATH\|config file\|core.*not found" | tail -5
else
    echo "✓ No config file errors found"
fi

echo ""
echo "Step 6: Checking chaincode mode..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -q "mode: dev"; then
    echo "✓ Chaincode mode is 'dev' (correct)"
else
    echo "⚠ WARNING: Chaincode mode might not be 'dev'"
fi

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Now test the query:"
echo "  docker exec -it cli bash"
echo "  peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'"
echo ""
