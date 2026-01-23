#!/bin/bash
# Fix Fabric MSP Certificate and Wallet Issues
# Run this on the SSH server to fix the certificate and wallet problems

set -e

echo "🔧 Fixing Fabric MSP Certificate and Wallet Issues"
echo "===================================================="
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

# Step 1: Check MSP structure
echo "1️⃣ Checking MSP certificate structure..."
PEER_MSP_DIR="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp"
PEER_TLSCACERTS="$PEER_MSP_DIR/tlscacerts"
PEER_CACERTS="$PEER_MSP_DIR/cacerts"
PEER_ADMINCERTS="$PEER_MSP_DIR/admincerts"
PEER_SIGNCERTS="$PEER_MSP_DIR/signcerts"

if [ ! -d "$PEER_MSP_DIR" ]; then
    echo "❌ Peer MSP directory not found: $PEER_MSP_DIR"
    echo "💡 Need to regenerate certificates"
    REGEN_NEEDED=true
else
    echo "✅ Peer MSP directory exists"
    
    # Check for required certificate files
    if [ ! -d "$PEER_TLSCACERTS" ] || [ -z "$(ls -A $PEER_TLSCACERTS 2>/dev/null)" ]; then
        echo "❌ TLS CA certificates missing"
        REGEN_NEEDED=true
    else
        echo "✅ TLS CA certificates exist"
    fi
    
    if [ ! -d "$PEER_CACERTS" ] || [ -z "$(ls -A $PEER_CACERTS 2>/dev/null)" ]; then
        echo "❌ CA certificates missing"
        REGEN_NEEDED=true
    else
        echo "✅ CA certificates exist"
    fi
    
    if [ ! -d "$PEER_ADMINCERTS" ] || [ -z "$(ls -A $PEER_ADMINCERTS 2>/dev/null)" ]; then
        echo "⚠️  Admin certificates missing (will fix)"
    else
        echo "✅ Admin certificates exist"
    fi
fi

echo ""

# Step 2: Check Admin user certificates
echo "2️⃣ Checking Admin user certificates..."
ADMIN_DIR="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
if [ ! -d "$ADMIN_DIR" ]; then
    echo "❌ Admin user directory not found"
    REGEN_NEEDED=true
else
    echo "✅ Admin user directory exists"
fi

echo ""

# Step 3: Regenerate certificates if needed
if [ "$REGEN_NEEDED" = true ]; then
    echo "3️⃣ Regenerating certificates..."
    echo "⚠️  This will remove existing certificates. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    # Stop Fabric containers
    echo "🛑 Stopping Fabric containers..."
    docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph 2>/dev/null || true
    
    # Backup existing certificates
    if [ -d "fabric-network/crypto-config" ]; then
        BACKUP_DIR="fabric-network/crypto-config-backup-$(date +%Y%m%d-%H%M%S)"
        echo "📦 Backing up to: $BACKUP_DIR"
        mv fabric-network/crypto-config "$BACKUP_DIR" 2>/dev/null || true
    fi
    
    # Regenerate
    echo "🔐 Regenerating certificates..."
    bash scripts/generate-crypto.sh
    
    echo "✅ Certificates regenerated"
else
    echo "3️⃣ Skipping certificate regeneration (not needed)"
fi

echo ""

# Step 4: Fix admincerts
echo "4️⃣ Fixing admincerts..."
ADMIN_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts"
if [ -d "$ADMIN_CERT" ]; then
    ADMIN_CERT_FILE=$(find "$ADMIN_CERT" -name "*.pem" | head -1)
    if [ -n "$ADMIN_CERT_FILE" ]; then
        echo "✅ Found admin certificate: $ADMIN_CERT_FILE"
        
        # Copy to peer admincerts
        mkdir -p "$PEER_ADMINCERTS"
        cp "$ADMIN_CERT_FILE" "$PEER_ADMINCERTS/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
        echo "✅ Copied admin cert to peer admincerts"
        
        # Copy to admin user admincerts
        ADMIN_USER_ADMINCERTS="$ADMIN_DIR/admincerts"
        mkdir -p "$ADMIN_USER_ADMINCERTS"
        cp "$ADMIN_CERT_FILE" "$ADMIN_USER_ADMINCERTS/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
        echo "✅ Copied admin cert to user admincerts"
    else
        echo "❌ No admin certificate file found"
    fi
else
    echo "❌ Admin certificate directory not found"
fi

echo ""

# Step 5: Set up wallet
echo "5️⃣ Setting up wallet..."
if [ -d "wallet" ]; then
    echo "⚠️  Wallet directory exists. Backing up..."
    mv wallet "wallet-backup-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
fi

mkdir -p wallet
echo "✅ Created wallet directory"

# Check if setup script exists
if [ -f "scripts/setup-fabric-wallet.js" ]; then
    echo "🔧 Running wallet setup script..."
    node scripts/setup-fabric-wallet.js
    if [ $? -eq 0 ]; then
        echo "✅ Wallet setup complete"
    else
        echo "❌ Wallet setup failed"
        echo "💡 Trying manual wallet setup..."
        
        # Manual wallet setup
        ADMIN_CERT_PATH="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts"
        ADMIN_KEY_PATH="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/keystore"
        
        if [ -d "$ADMIN_CERT_PATH" ] && [ -d "$ADMIN_KEY_PATH" ]; then
            CERT_FILE=$(find "$ADMIN_CERT_PATH" -name "*.pem" | head -1)
            KEY_FILE=$(find "$ADMIN_KEY_PATH" -name "*_sk" | head -1)
            
            if [ -n "$CERT_FILE" ] && [ -n "$KEY_FILE" ]; then
                mkdir -p wallet/admin
                cp "$CERT_FILE" wallet/admin/cert.pem
                cp "$KEY_FILE" wallet/admin/key.pem
                echo "✅ Manual wallet setup complete"
            else
                echo "❌ Could not find certificate or key files"
            fi
        fi
    fi
else
    echo "⚠️  Wallet setup script not found, skipping"
fi

echo ""

# Step 6: Restart Fabric containers
echo "6️⃣ Restarting Fabric containers..."
docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph orderer.lto.gov.ph

echo "⏳ Waiting for containers to start..."
sleep 5

# Step 7: Verify peer can run commands
echo "7️⃣ Verifying peer..."
if docker exec peer0.lto.gov.ph peer version > /dev/null 2>&1; then
    echo "✅ Peer is working!"
else
    echo "❌ Peer still has issues"
    echo "💡 Check logs: docker logs peer0.lto.gov.ph"
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "Next steps:"
echo "  1. Check if channel exists: docker exec peer0.lto.gov.ph peer channel list"
echo "  2. If channel missing, create it"
echo "  3. Check if chaincode deployed: docker exec peer0.lto.gov.ph peer chaincode list --instantiated -C ltochannel"
echo "  4. Restart lto-app: docker compose -f docker-compose.unified.yml restart lto-app"
