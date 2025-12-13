#!/bin/bash
# Fix permissions on Fabric crypto materials
# Use this if files were created by Docker as root

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

echo "🔧 Fixing permissions on Fabric crypto materials..."

CRYPTO_DIR="fabric-network/crypto-config"

if [ ! -d "$CRYPTO_DIR" ]; then
    print_error "Crypto directory not found: $CRYPTO_DIR"
    print_info "Run 'bash scripts/generate-crypto.sh' first"
    exit 1
fi

# Get current user
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

print_info "Fixing permissions for user: $CURRENT_USER:$CURRENT_GROUP"

# Try without sudo first
if chmod -R 755 "$CRYPTO_DIR" 2>/dev/null && chown -R "$CURRENT_USER:$CURRENT_GROUP" "$CRYPTO_DIR" 2>/dev/null; then
    print_success "Permissions fixed (no sudo needed)"
elif sudo chmod -R 755 "$CRYPTO_DIR" 2>/dev/null && sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$CRYPTO_DIR" 2>/dev/null; then
    print_success "Permissions fixed (using sudo)"
else
    print_error "Failed to fix permissions"
    print_info "Try manually: sudo chmod -R 755 $CRYPTO_DIR"
    print_info "Then: sudo chown -R $CURRENT_USER:$CURRENT_GROUP $CRYPTO_DIR"
    exit 1
fi

# Verify key file is readable
KEY_FILE=$(find "$CRYPTO_DIR" -path "*/keystore/*_sk" -o -path "*/keystore/*.pem" | head -1)
if [ -n "$KEY_FILE" ]; then
    if [ -r "$KEY_FILE" ]; then
        print_success "Key file is readable: $KEY_FILE"
    else
        print_error "Key file still not readable: $KEY_FILE"
        exit 1
    fi
fi

print_success "All permissions fixed!"
print_info "You can now run: node scripts/setup-fabric-wallet.js"

