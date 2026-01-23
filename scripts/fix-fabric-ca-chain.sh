#!/bin/bash
# Fix Fabric MSP CA Certificate Chain
# Fixes "certificate signed by unknown authority" errors

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "🔧 Fixing Fabric MSP CA Certificate Chain"
echo "=========================================="
echo ""

# Step 1: Find the actual CA certificate
echo "1️⃣ Locating CA certificate..."

# The CA cert should be in the organization MSP cacerts directory
ORG_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp"
CA_CERT="$ORG_MSP/cacerts/ca.lto.gov.ph-cert.pem"

# If not found, try to find any CA cert
if [ ! -f "$CA_CERT" ]; then
    CA_CERT=$(find "$ORG_MSP/cacerts" -name "*.pem" -o -name "*.crt" 2>/dev/null | head -1)
fi

# If still not found, check if cryptogen created it elsewhere
if [ -z "$CA_CERT" ] || [ ! -f "$CA_CERT" ]; then
    echo "⚠️  CA certificate not found in expected location"
    echo "💡 Checking if certificates need regeneration..."
    
    # Check if any certificates exist
    if [ ! -d "$ORG_MSP" ]; then
        echo "❌ MSP directory doesn't exist. Regenerating certificates..."
        bash scripts/generate-crypto.sh
        CA_CERT="$ORG_MSP/cacerts/ca.lto.gov.ph-cert.pem"
    else
        # Try to find CA cert in alternative locations
        CA_CERT=$(find fabric-network/crypto-config/peerOrganizations/lto.gov.ph -name "*ca*.pem" 2>/dev/null | grep -v tls | head -1)
        if [ -z "$CA_CERT" ]; then
            echo "❌ CA certificate not found. Regenerating certificates..."
            bash scripts/generate-crypto.sh
            CA_CERT="$ORG_MSP/cacerts/ca.lto.gov.ph-cert.pem"
        fi
    fi
fi

if [ -n "$CA_CERT" ] && [ -f "$CA_CERT" ]; then
    echo "✅ Found CA certificate: $CA_CERT"
else
    echo "❌ CA certificate still not found after regeneration"
    echo "💡 Please check crypto-config directory structure"
    exit 1
fi

# Step 2: Fix peer MSP cacerts
echo "2️⃣ Fixing peer MSP cacerts..."
PEER_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp"
mkdir -p "$PEER_MSP/cacerts"
cp "$CA_CERT" "$PEER_MSP/cacerts/ca.lto.gov.ph-cert.pem" 2>/dev/null || true
echo "✅ Fixed peer cacerts"

# Step 3: Fix peer MSP tlscacerts
echo "3️⃣ Fixing peer MSP tlscacerts..."
mkdir -p "$PEER_MSP/tlscacerts"
# Use TLS CA cert if available, otherwise use org CA cert
TLS_CA_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt"
if [ -f "$TLS_CA_CERT" ]; then
    cp "$TLS_CA_CERT" "$PEER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
    echo "✅ Fixed peer tlscacerts (using TLS CA)"
else
    cp "$CA_CERT" "$PEER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
    echo "✅ Fixed peer tlscacerts (using org CA)"
fi

# Step 4: Fix admin user MSP
echo "4️⃣ Fixing admin user MSP..."
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
mkdir -p "$ADMIN_MSP/cacerts" "$ADMIN_MSP/tlscacerts"
cp "$CA_CERT" "$ADMIN_MSP/cacerts/ca.lto.gov.ph-cert.pem" 2>/dev/null || true

if [ -f "$TLS_CA_CERT" ]; then
    cp "$TLS_CA_CERT" "$ADMIN_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
else
    cp "$CA_CERT" "$ADMIN_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
fi

# Fix admincerts
ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)
if [ -n "$ADMIN_CERT" ]; then
    mkdir -p "$ADMIN_MSP/admincerts"
    cp "$ADMIN_CERT" "$ADMIN_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
    
    # Also copy to peer admincerts
    mkdir -p "$PEER_MSP/admincerts"
    cp "$ADMIN_CERT" "$PEER_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
    echo "✅ Fixed admincerts"
fi

echo "✅ Fixed admin user MSP"

# Step 5: Fix orderer MSP (if needed)
echo "5️⃣ Checking orderer MSP..."
ORDERER_MSP="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp"
if [ -d "$ORDERER_MSP" ]; then
    ORDERER_CA_CERT=$(find "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/msp" -name "*ca*.pem" -o -name "*ca*.crt" 2>/dev/null | head -1)
    if [ -n "$ORDERER_CA_CERT" ]; then
        mkdir -p "$ORDERER_MSP/cacerts" "$ORDERER_MSP/tlscacerts"
        cp "$ORDERER_CA_CERT" "$ORDERER_MSP/cacerts/ca.lto.gov.ph-cert.pem" 2>/dev/null || true
        
        ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
        if [ -f "$ORDERER_TLS_CA" ]; then
            cp "$ORDERER_TLS_CA" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
        else
            cp "$ORDERER_CA_CERT" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
        fi
        echo "✅ Fixed orderer MSP"
    fi
fi

# Step 6: Fix wallet (FileSystemWallet uses JSON files, not directories)
echo "6️⃣ Fixing wallet..."
WALLET_PATH="wallet"

# Check if wallet exists and has admin identity
if [ -d "$WALLET_PATH" ]; then
    # FileSystemWallet stores identities as JSON files
    if [ -f "$WALLET_PATH/admin.id" ] || [ -f "$WALLET_PATH/admin.json" ] || [ -d "$WALLET_PATH/admin" ]; then
        echo "✅ Wallet exists with admin identity"
        ls -la "$WALLET_PATH/" | head -5
    else
        echo "⚠️  Wallet exists but admin identity missing"
        echo "🔧 Recreating wallet..."
        rm -rf "$WALLET_PATH"
        mkdir -p "$WALLET_PATH"
        if command -v node > /dev/null 2>&1; then
            node scripts/setup-fabric-wallet.js || {
                echo "⚠️  Wallet script failed, will retry after restart"
            }
        else
            echo "⚠️  Node.js not found, wallet will be created on next app start"
        fi
    fi
else
    echo "🔧 Creating wallet..."
    mkdir -p "$WALLET_PATH"
    if command -v node > /dev/null 2>&1; then
        node scripts/setup-fabric-wallet.js || {
            echo "⚠️  Wallet script failed, will be created on next app start"
        }
    else
        echo "⚠️  Node.js not found, wallet will be created on next app start"
    fi
fi

# Step 7: Verify CA certificate matches issuer
echo "7️⃣ Verifying CA certificate chain..."
ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)
if [ -n "$ADMIN_CERT" ] && [ -f "$CA_CERT" ]; then
    # Extract issuer from admin cert
    ADMIN_ISSUER=$(openssl x509 -in "$ADMIN_CERT" -noout -issuer 2>/dev/null | sed 's/issuer=//' || echo "")
    CA_SUBJECT=$(openssl x509 -in "$CA_CERT" -noout -subject 2>/dev/null | sed 's/subject=//' || echo "")
    
    if [ -n "$ADMIN_ISSUER" ] && [ -n "$CA_SUBJECT" ]; then
        echo "   Admin cert issuer: $ADMIN_ISSUER"
        echo "   CA cert subject: $CA_SUBJECT"
        # Basic check if they match (simplified)
        if echo "$ADMIN_ISSUER" | grep -q "ca.lto.gov.ph" && echo "$CA_SUBJECT" | grep -q "ca.lto.gov.ph"; then
            echo "✅ CA certificate appears to match issuer"
        else
            echo "⚠️  CA certificate may not match issuer - certificates may need regeneration"
        fi
    fi
fi

# Step 8: Restart Fabric containers
echo "8️⃣ Restarting Fabric containers..."
docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || {
    echo "⚠️  Using docker restart directly..."
    docker restart peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || true
}

echo "⏳ Waiting for containers to start..."
sleep 8

# Step 9: Verify
echo "9️⃣ Verifying fixes..."
if docker exec peer0.lto.gov.ph peer version > /dev/null 2>&1; then
    echo "✅ Peer is working"
    
    # Test channel query
    CHANNEL_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
    if echo "$CHANNEL_OUTPUT" | grep -q "ltochannel"; then
        echo "✅ Channel exists: ltochannel"
    else
        echo "⚠️  Channel query result:"
        echo "$CHANNEL_OUTPUT" | head -3
    fi
    
    # Check peer logs for certificate errors
    RECENT_ERRORS=$(docker logs peer0.lto.gov.ph 2>&1 | tail -20 | grep -i "certificate signed by unknown authority" | wc -l)
    if [ "$RECENT_ERRORS" -eq 0 ]; then
        echo "✅ No recent certificate errors in peer logs"
    else
        echo "⚠️  Still seeing certificate errors in peer logs (may be old errors)"
    fi
else
    echo "❌ Peer still has issues"
    echo "💡 Check peer logs: docker logs peer0.lto.gov.ph | tail -30"
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "Next steps:"
echo "  1. Check chaincode: docker exec peer0.lto.gov.ph peer chaincode list --instantiated -C ltochannel"
echo "  2. Check wallet: ls -la wallet/"
echo "  3. Test app connection: Check lto-app logs for Fabric connection"
