#!/bin/bash
# Fabric Connection Diagnostic Script
# Run this inside the lto-app container to diagnose Fabric connection issues

echo "🔍 Fabric Connection Diagnostic"
echo "================================"
echo ""

# 1. Check if certificates exist
echo "1️⃣ Checking TLS certificates..."
PEER_CERT="/app/fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt"
ORDERER_CERT="/app/fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"

if [ -f "$PEER_CERT" ]; then
    echo "✅ Peer certificate exists: $PEER_CERT"
    ls -lh "$PEER_CERT"
else
    echo "❌ Peer certificate MISSING: $PEER_CERT"
fi

if [ -f "$ORDERER_CERT" ]; then
    echo "✅ Orderer certificate exists: $ORDERER_CERT"
    ls -lh "$ORDERER_CERT"
else
    echo "❌ Orderer certificate MISSING: $ORDERER_CERT"
fi

echo ""

# 2. Check network-config.json
echo "2️⃣ Checking network-config.json..."
if [ -f "/app/network-config.json" ]; then
    echo "✅ network-config.json exists"
    echo "Certificate paths in config:"
    grep -A 2 "tlsCACerts" /app/network-config.json || echo "No tlsCACerts found"
else
    echo "❌ network-config.json MISSING"
fi

echo ""

# 3. Check wallet
echo "3️⃣ Checking wallet..."
WALLET_PATH="/app/wallet"
if [ -d "$WALLET_PATH" ]; then
    echo "✅ Wallet directory exists: $WALLET_PATH"
    ADMIN_EXISTS=$(ls "$WALLET_PATH/admin" 2>/dev/null)
    if [ -n "$ADMIN_EXISTS" ]; then
        echo "✅ Admin identity found in wallet"
        ls -la "$WALLET_PATH/admin"
    else
        echo "❌ Admin identity MISSING in wallet"
        echo "Contents of wallet directory:"
        ls -la "$WALLET_PATH" 2>/dev/null || echo "Wallet directory is empty"
    fi
else
    echo "❌ Wallet directory MISSING: $WALLET_PATH"
fi

echo ""

# 4. Check network connectivity
echo "4️⃣ Checking network connectivity..."
if command -v nc &> /dev/null; then
    echo "Testing peer connection..."
    nc -zv peer0.lto.gov.ph 7051 2>&1 | head -1
    echo "Testing orderer connection..."
    nc -zv orderer.lto.gov.ph 7050 2>&1 | head -1
else
    echo "⚠️  nc (netcat) not available, skipping connectivity test"
fi

echo ""

# 5. Check if Fabric peer/orderer are actually running
echo "5️⃣ Checking Fabric service status..."
echo "Peer logs (last 5 lines):"
docker logs peer0.lto.gov.ph 2>&1 | tail -5 || echo "Cannot access peer logs"
echo ""
echo "Orderer logs (last 5 lines):"
docker logs orderer.lto.gov.ph 2>&1 | tail -5 || echo "Cannot access orderer logs"

echo ""

# 6. Check environment variables
echo "6️⃣ Checking environment variables..."
echo "BLOCKCHAIN_MODE: ${BLOCKCHAIN_MODE:-NOT SET}"
echo "FABRIC_AS_LOCALHOST: ${FABRIC_AS_LOCALHOST:-NOT SET}"

echo ""
echo "✅ Diagnostic complete"
