#!/bin/bash
# Verify Fabric Connection After CA Chain Fix
# Tests if Fabric is fully operational

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔍 Verifying Fabric Connection"
echo "=============================="
echo ""

# 1. Check peer status
echo "1️⃣ Peer Status..."
if docker exec peer0.lto.gov.ph peer version > /dev/null 2>&1; then
    echo "✅ Peer is running"
    PEER_VERSION=$(docker exec peer0.lto.gov.ph peer version 2>&1 | grep "Version:" | head -1)
    echo "   $PEER_VERSION"
else
    echo "❌ Peer is not responding"
    exit 1
fi
echo ""

# 2. Check channel
echo "2️⃣ Channel Status..."
CHANNEL_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_OUTPUT" | grep -q "ltochannel"; then
    echo "✅ Channel 'ltochannel' exists"
    echo "$CHANNEL_OUTPUT" | grep "ltochannel"
else
    echo "❌ Channel 'ltochannel' not found"
    echo "$CHANNEL_OUTPUT"
fi
echo ""

# 3. Check chaincode
echo "3️⃣ Chaincode Status..."
CHAINCODE_OUTPUT=$(docker exec peer0.lto.gov.ph peer chaincode list --instantiated -C ltochannel 2>&1)
if echo "$CHAINCODE_OUTPUT" | grep -q "vehicle-registration"; then
    echo "✅ Chaincode is deployed"
    echo "$CHAINCODE_OUTPUT" | grep "vehicle-registration"
elif echo "$CHAINCODE_OUTPUT" | grep -q "error\|denied\|malformed"; then
    echo "⚠️  Chaincode query failed (may indicate certificate/auth issue)"
    echo "$CHAINCODE_OUTPUT" | head -3
else
    echo "⚠️  No chaincode found (may need deployment)"
    echo "$CHAINCODE_OUTPUT"
fi
echo ""

# 4. Check for recent certificate errors
echo "4️⃣ Recent Certificate Errors..."
sleep 2  # Wait a moment for any new errors
RECENT_ERRORS=$(docker logs peer0.lto.gov.ph --since 30s 2>&1 | grep -i "certificate signed by unknown authority\|access denied\|creator org unknown" | wc -l)
if [ "$RECENT_ERRORS" -eq 0 ]; then
    echo "✅ No recent certificate errors"
else
    echo "⚠️  Found $RECENT_ERRORS recent certificate/auth errors:"
    docker logs peer0.lto.gov.ph --since 30s 2>&1 | grep -i "certificate signed by unknown authority\|access denied\|creator org unknown" | tail -5
fi
echo ""

# 5. Check orderer connection
echo "5️⃣ Orderer Connection..."
ORDERER_ERRORS=$(docker logs peer0.lto.gov.ph --since 30s 2>&1 | grep -i "FORBIDDEN\|disconnected from ordering service" | wc -l)
if [ "$ORDERER_ERRORS" -eq 0 ]; then
    echo "✅ No orderer connection errors"
else
    echo "⚠️  Orderer connection issues detected:"
    docker logs peer0.lto.gov.ph --since 30s 2>&1 | grep -i "FORBIDDEN\|disconnected from ordering service" | tail -3
fi
echo ""

# 6. Check wallet
echo "6️⃣ Application Wallet..."
if [ -f "wallet/admin.id" ] || [ -f "wallet/admin.json" ]; then
    echo "✅ Wallet exists with admin identity"
    ls -lh wallet/admin.* 2>/dev/null || ls -lh wallet/admin.id 2>/dev/null || echo "   (wallet files present)"
else
    echo "❌ Wallet missing or incomplete"
fi
echo ""

# 7. Check application connection (if lto-app is running)
echo "7️⃣ Application Connection..."
if docker ps | grep -q "lto-app"; then
    APP_FABRIC_LOGS=$(docker logs lto-app --since 2m 2>&1 | grep -i "fabric\|blockchain" | tail -10)
    if echo "$APP_FABRIC_LOGS" | grep -q -i "connected\|initialized\|ready"; then
        echo "✅ Application appears connected to Fabric"
        echo "$APP_FABRIC_LOGS" | grep -i "connected\|initialized\|ready" | head -3
    elif echo "$APP_FABRIC_LOGS" | grep -q -i "error\|failed\|timeout"; then
        echo "⚠️  Application connection issues detected:"
        echo "$APP_FABRIC_LOGS" | grep -i "error\|failed\|timeout" | tail -5
    else
        echo "ℹ️  No recent Fabric logs from application"
    fi
else
    echo "ℹ️  Application container (lto-app) not running"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=========="
if [ "$RECENT_ERRORS" -eq 0 ] && [ "$ORDERER_ERRORS" -eq 0 ]; then
    echo "✅ Fabric network appears healthy"
    echo ""
    echo "Next: Test application registration/transfer functionality"
else
    echo "⚠️  Some issues detected - review errors above"
    echo ""
    echo "If chaincode is not deployed, run:"
    echo "  bash scripts/deploy-chaincode.sh"
fi
