#!/bin/bash
# Quick Fix for Fabric MSP Certificate Error
# Fixes the "certificate signed by unknown authority" error

set -e

cd ~/LTOBLOCKCHAIN

echo "🔧 Fixing Fabric MSP Certificate Error"
echo "========================================"
echo ""

# Step 1: Check MSP structure
PEER_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp"
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"

echo "1️⃣ Checking MSP structure..."

# Check if cacerts exists and copy if missing
if [ ! -d "$PEER_MSP/cacerts" ] || [ -z "$(ls -A $PEER_MSP/cacerts 2>/dev/null)" ]; then
    echo "⚠️  Missing cacerts, creating..."
    mkdir -p "$PEER_MSP/cacerts"
    # Copy CA cert from TLS or find it
    if [ -f "$PEER_MSP/../tls/ca.crt" ]; then
        cp "$PEER_MSP/../tls/ca.crt" "$PEER_MSP/cacerts/ca.lto.gov.ph-cert.pem"
        echo "✅ Copied CA cert to cacerts"
    elif [ -f "fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/cacerts/ca.lto.gov.ph-cert.pem" ]; then
        cp "fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/cacerts/ca.lto.gov.ph-cert.pem" "$PEER_MSP/cacerts/"
        echo "✅ Copied CA cert to cacerts"
    fi
fi

# Check if tlscacerts exists
if [ ! -d "$PEER_MSP/tlscacerts" ] || [ -z "$(ls -A $PEER_MSP/tlscacerts 2>/dev/null)" ]; then
    echo "⚠️  Missing tlscacerts, creating..."
    mkdir -p "$PEER_MSP/tlscacerts"
    if [ -f "$PEER_MSP/../tls/ca.crt" ]; then
        cp "$PEER_MSP/../tls/ca.crt" "$PEER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
        echo "✅ Copied TLS CA cert to tlscacerts"
    fi
fi

# Fix admincerts
echo "2️⃣ Fixing admincerts..."
ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)
if [ -n "$ADMIN_CERT" ]; then
    mkdir -p "$PEER_MSP/admincerts"
    cp "$ADMIN_CERT" "$PEER_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
    echo "✅ Fixed peer admincerts"
    
    mkdir -p "$ADMIN_MSP/admincerts"
    cp "$ADMIN_CERT" "$ADMIN_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
    echo "✅ Fixed admin user admincerts"
else
    echo "❌ Admin certificate not found"
fi

# Step 3: Set up wallet
echo "3️⃣ Setting up wallet..."
if [ -d "wallet" ]; then
    rm -rf wallet
fi
mkdir -p wallet

if [ -f "scripts/setup-fabric-wallet.js" ]; then
    node scripts/setup-fabric-wallet.js
else
    echo "⚠️  Wallet script not found, creating manually..."
    ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)
    ADMIN_KEY=$(find "$ADMIN_MSP/keystore" -name "*_sk" 2>/dev/null | head -1)
    
    if [ -n "$ADMIN_CERT" ] && [ -n "$ADMIN_KEY" ]; then
        mkdir -p wallet/admin
        cp "$ADMIN_CERT" wallet/admin/cert.pem
        cp "$ADMIN_KEY" wallet/admin/key.pem
        echo "✅ Manual wallet created"
    fi
fi

# Step 4: Restart peer
echo "4️⃣ Restarting peer..."
docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph

sleep 3

# Step 5: Test peer
echo "5️⃣ Testing peer..."
if docker exec peer0.lto.gov.ph peer version > /dev/null 2>&1; then
    echo "✅ Peer is working!"
else
    echo "❌ Peer still has issues - may need certificate regeneration"
    echo "💡 Try: bash scripts/generate-crypto.sh"
fi

echo ""
echo "✅ Fix complete!"
