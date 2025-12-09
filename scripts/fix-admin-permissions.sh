#!/bin/bash
# Fix Admin Permissions for Fabric
# Ensures admin certificate is in admincerts directory

set -e

echo "🔧 Fixing Admin Permissions for Fabric..."
echo "=========================================="
echo ""

# Paths
ADMIN_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/Admin@lto.gov.ph-cert.pem"
ADMINCERTS_DIR="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/admincerts"

# Check if admin certificate exists
if [ ! -f "$ADMIN_CERT" ]; then
    echo "❌ Admin certificate not found: $ADMIN_CERT"
    exit 1
fi

# Create admincerts directory if it doesn't exist
mkdir -p "$ADMINCERTS_DIR"

# Copy admin certificate to admincerts
cp "$ADMIN_CERT" "$ADMINCERTS_DIR/Admin@lto.gov.ph-cert.pem"

echo "✅ Admin certificate copied to admincerts directory"

# Also ensure peer's admincerts has it
PEER_ADMINCERTS="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts"
mkdir -p "$PEER_ADMINCERTS"
cp "$ADMIN_CERT" "$PEER_ADMINCERTS/Admin@lto.gov.ph-cert.pem"

echo "✅ Admin certificate copied to peer admincerts directory"

# Verify
if [ -f "$ADMINCERTS_DIR/Admin@lto.gov.ph-cert.pem" ] && [ -f "$PEER_ADMINCERTS/Admin@lto.gov.ph-cert.pem" ]; then
    echo "✅ Admin permissions fixed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart the peer container: docker restart peer0.lto.gov.ph"
    echo "  2. Recreate wallet: node scripts/setup-fabric-wallet.js"
    echo "  3. Restart application: npm start"
else
    echo "❌ Failed to fix admin permissions"
    exit 1
fi

