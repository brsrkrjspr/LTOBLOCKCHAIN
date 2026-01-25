#!/bin/bash

# Debug: Check Peer Configuration and escc Plugin Issue
# This script checks if the peer is actually using mode: dev

set -e

echo "=========================================="
echo "Debugging Peer Configuration"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Checking if core.yaml exists..."
if [ -f "fabric-network/config/core.yaml" ]; then
    echo "✓ core.yaml exists"
    echo ""
    echo "Checking mode setting..."
    if grep -q "mode: dev" fabric-network/config/core.yaml; then
        echo "✓ mode: dev found in core.yaml"
    else
        echo "✗ mode: dev NOT found in core.yaml!"
        echo "Current mode setting:"
        grep -i "mode:" fabric-network/config/core.yaml || echo "No mode setting found"
    fi
else
    echo "✗ core.yaml does not exist!"
    exit 1
fi

echo ""
echo "Step 2: Checking docker-compose config mount..."
if docker inspect peer0.lto.gov.ph 2>/dev/null | grep -q "fabric-network/config"; then
    echo "✓ Config mount found in container"
else
    echo "⚠ Config mount might not be present"
fi

echo ""
echo "Step 3: Checking FABRIC_CFG_PATH in container..."
FABRIC_CFG=$(docker exec peer0.lto.gov.ph env | grep FABRIC_CFG_PATH || echo "NOT SET")
echo "FABRIC_CFG_PATH: $FABRIC_CFG"

echo ""
echo "Step 4: Checking peer logs for mode setting..."
echo "Looking for 'mode:' in peer startup logs..."
docker logs peer0.lto.gov.ph 2>&1 | grep -i "mode:" | head -5

echo ""
echo "Step 5: Checking peer logs for escc errors..."
echo "Recent escc-related errors:"
docker logs peer0.lto.gov.ph 2>&1 | grep -i "escc" | tail -10

echo ""
echo "Step 6: Checking if core.yaml is accessible inside container..."
if docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml; then
    echo "✓ core.yaml is accessible in container"
    echo ""
    echo "Checking mode in container's core.yaml:"
    docker exec peer0.lto.gov.ph grep -i "mode:" /var/hyperledger/fabric/config/core.yaml || echo "No mode found"
else
    echo "✗ core.yaml is NOT accessible in container at /var/hyperledger/fabric/config/core.yaml"
fi

echo ""
echo "Step 7: Full peer config dump (looking for chaincode.mode)..."
docker logs peer0.lto.gov.ph 2>&1 | grep -A 20 "Peer config with combined core.yaml" | grep -A 10 "chaincode:" | head -15

echo ""
echo "=========================================="
echo "Debugging Complete"
echo "=========================================="
