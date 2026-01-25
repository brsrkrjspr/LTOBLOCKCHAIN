#!/bin/bash

# Fix: Enable Discovery Service in core.yaml
# Fabric SDK requires Discovery service to be enabled

set -e

echo "=========================================="
echo "Enabling Discovery Service in core.yaml"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "✗ ERROR: core.yaml not found!"
    echo "Run final-fix-create-minimal-core-yaml.sh first"
    exit 1
fi

echo ""
echo "Step 1: Checking if discovery section exists..."
if grep -q "^  discovery:" fabric-network/config/core.yaml; then
    echo "✓ discovery section already exists"
    echo "Current discovery config:"
    grep -A 10 "^  discovery:" fabric-network/config/core.yaml
else
    echo "⚠ discovery section not found - adding it..."
    
    # Add discovery section after gossip section
    if grep -q "^  events:" fabric-network/config/core.yaml; then
        # Insert before events
        sed -i '/^  events:/i\
  discovery:\
    enabled: true\
    authCacheEnabled: true\
    authCacheMaxSize: 1000\
    authCachePurgeRetentionRatio: 0.75\
    orgMembersAllowedAccess: false\
' fabric-network/config/core.yaml
    else
        # Append after gossip if events not found
        sed -i '/^  gossip:/a\
  discovery:\
    enabled: true\
    authCacheEnabled: true\
    authCacheMaxSize: 1000\
    authCachePurgeRetentionRatio: 0.75\
    orgMembersAllowedAccess: false\
' fabric-network/config/core.yaml
    fi
    
    echo "✓ discovery section added"
fi

echo ""
echo "Step 2: Verifying discovery configuration..."
if grep -q "discovery:" fabric-network/config/core.yaml && grep -q "enabled: true" fabric-network/config/core.yaml; then
    echo "✓ discovery section verified"
else
    echo "✗ ERROR: discovery section not properly added"
    exit 1
fi

echo ""
echo "Step 3: Restarting peer container..."
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph

echo ""
echo "Step 4: Waiting for peer to restart (20 seconds)..."
sleep 20

echo ""
echo "Step 5: Checking peer logs for discovery service..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "discovery.*enabled\|Discovery service"; then
    echo "✓ Discovery service mentioned in logs"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "discovery" | tail -3
else
    echo "⚠ Discovery service not mentioned in logs (might be enabled by default)"
fi

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Now restart the application and test:"
echo "  docker-compose -f docker-compose.unified.yml restart lto-app"
echo "  docker logs -f lto-app"
echo ""
