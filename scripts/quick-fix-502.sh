#!/bin/bash

# Quick Fix for 502 Bad Gateway
# Fixes Fabric Discovery and escc handlers issues

set -e

echo "=========================================="
echo "Quick Fix: 502 Bad Gateway"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || exit 1

echo ""
echo "Step 1: Checking lto-app status..."
if docker ps | grep -q "lto-app.*Up"; then
    echo "  ✓ lto-app is running"
else
    echo "  ✗ lto-app is NOT running (this is why you get 502)"
    echo "  Checking logs..."
    docker logs lto-app --tail=30 2>&1 | tail -30
fi

echo ""
echo "Step 2: Updating core.yaml with handlers and discovery..."

# Ensure core.yaml exists
if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "  ✗ core.yaml not found! Run final-fix-create-minimal-core-yaml.sh first"
    exit 1
fi

# Add handlers section if missing
if ! grep -q "^handlers:" fabric-network/config/core.yaml; then
    echo "  Adding handlers section..."
    sed -i '/^metrics:/i\
handlers:\
  endorsers:\
    escc:\
      name: DefaultEndorsement\
  validators:\
    vscc:\
      name: DefaultValidation\
' fabric-network/config/core.yaml
    echo "  ✓ Handlers added"
else
    echo "  ✓ Handlers already exist"
fi

# Add discovery section if missing
if ! grep -q "^  discovery:" fabric-network/config/core.yaml; then
    echo "  Adding discovery section..."
    sed -i '/^  events:/i\
  discovery:\
    enabled: true\
    authCacheEnabled: true\
    authCacheMaxSize: 1000\
    authCachePurgeRetentionRatio: 0.75\
    orgMembersAllowedAccess: false\
' fabric-network/config/core.yaml
    echo "  ✓ Discovery added"
else
    echo "  ✓ Discovery already exists"
fi

echo ""
echo "Step 3: Restarting peer..."
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph
sleep 15

echo ""
echo "Step 4: Restarting lto-app..."
docker-compose -f docker-compose.unified.yml restart lto-app
sleep 30

echo ""
echo "Step 5: Checking lto-app logs..."
if docker logs lto-app 2>&1 | tail -20 | grep -qi "Failed to connect\|CRITICAL\|Error"; then
    echo "  ⚠ Still seeing errors:"
    docker logs lto-app 2>&1 | tail -20 | grep -i "Failed\|CRITICAL\|Error" | head -5
else
    echo "  ✓ No critical errors in recent logs"
fi

echo ""
echo "Step 6: Testing backend..."
if docker exec lto-app curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "  ✓ Backend is responding!"
else
    echo "  ✗ Backend is NOT responding"
    echo "  Full logs:"
    docker logs lto-app --tail=50
fi

echo ""
echo "=========================================="
echo "Done! Check if website works now."
echo "=========================================="
