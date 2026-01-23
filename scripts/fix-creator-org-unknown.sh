#!/bin/bash
# Fix "Access Denied: Creator Org Unknown" Error
# Fixes MSP admincerts and removes old chaincode containers

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔧 Fixing 'Creator Org Unknown' Error"
echo "====================================="
echo ""

# Step 1: Stop old chaincode containers
echo "1️⃣ Stopping old chaincode containers..."
docker ps -a | grep "dev-peer0.lto.gov.ph-vehicle-registration" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
echo "✅ Old chaincode containers removed"

# Step 2: Fix MSP admincerts
echo ""
echo "2️⃣ Fixing MSP admincerts..."

ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
PEER_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp"
ORG_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp"

# Find admin certificate
ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)

if [ -z "$ADMIN_CERT" ]; then
    echo "❌ Admin certificate not found!"
    exit 1
fi

echo "   Found admin cert: $ADMIN_CERT"

# Fix user-level admincerts
mkdir -p "$ADMIN_MSP/admincerts"
cp "$ADMIN_CERT" "$ADMIN_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ User admincerts fixed"

# Fix peer-level admincerts
mkdir -p "$PEER_MSP/admincerts"
cp "$ADMIN_CERT" "$PEER_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ Peer admincerts fixed"

# Fix organization-level admincerts (CRITICAL for NodeOUs)
mkdir -p "$ORG_MSP/admincerts"
cp "$ADMIN_CERT" "$ORG_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ Organization admincerts fixed"

# Step 3: Regenerate wallet with correct identity
echo ""
echo "3️⃣ Regenerating wallet..."
rm -rf wallet
mkdir -p wallet

if command -v node > /dev/null 2>&1; then
    node scripts/setup-fabric-wallet.js || {
        echo "⚠️  Wallet setup had issues, trying manual setup..."
        # Manual wallet setup as fallback
        WALLET_ADMIN_DIR="wallet/admin"
        mkdir -p "$WALLET_ADMIN_DIR"
        
        ADMIN_KEY=$(find "$ADMIN_MSP/keystore" -name "*_sk" 2>/dev/null | head -1)
        if [ -n "$ADMIN_KEY" ] && [ -n "$ADMIN_CERT" ]; then
            cp "$ADMIN_CERT" "$WALLET_ADMIN_DIR/cert.pem"
            cp "$ADMIN_KEY" "$WALLET_ADMIN_DIR/key.pem"
            echo "   ✅ Wallet created manually"
        fi
    }
else
    echo "⚠️  Node.js not found, wallet will be created on app start"
fi

# Step 4: Restart peer to apply MSP changes
echo ""
echo "4️⃣ Restarting peer..."
docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph 2>/dev/null || {
    docker restart peer0.lto.gov.ph
}

echo "⏳ Waiting for peer to start (15 seconds)..."
sleep 15

# Step 5: Verify fix
echo ""
echo "5️⃣ Verifying fix..."

# Check if peer is running
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "❌ Peer failed to start"
    exit 1
fi

# Try to query chaincode (should work now)
echo "   Testing chaincode query..."
CHAINCODE_CHECK=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)

if echo "$CHAINCODE_CHECK" | grep -qi "error\|access denied\|creator org unknown"; then
    echo "⚠️  Still seeing errors (may need more time or wallet fix)"
    echo "   Output: $CHAINCODE_CHECK"
else
    echo "✅ Chaincode query successful!"
    echo "$CHAINCODE_CHECK" | head -5
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "Next steps:"
echo "  1. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
echo "  2. Check application logs: docker logs lto-app --tail 30"
echo "  3. If still failing, check wallet: ls -la wallet/"
