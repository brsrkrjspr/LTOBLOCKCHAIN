#!/bin/bash
# Quick fix for Fabric "access denied" error
# Sets up admincerts and restarts peer
# 
# NOTE: If this doesn't work, the issue may be persistent volume conflicts.
# Run: bash scripts/codespace-restart.sh (which now cleans volumes)

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

echo "🔧 Fixing Fabric Access Denied Error..."
echo ""

# Find admin certificate
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
ADMIN_CERT=$(find "${ADMIN_MSP}/signcerts" -name "*.pem" | head -1)

if [ -z "$ADMIN_CERT" ]; then
    print_error "Admin certificate not found in ${ADMIN_MSP}/signcerts"
    exit 1
fi

print_info "Found admin certificate: $ADMIN_CERT"

# Setup user admincerts
print_info "Setting up user admincerts..."
mkdir -p "${ADMIN_MSP}/admincerts"
cp "$ADMIN_CERT" "${ADMIN_MSP}/admincerts/"
print_success "User admincerts configured"

# Setup peer admincerts
print_info "Setting up peer admincerts..."
PEER_ADMINCERTS="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts"
mkdir -p "$PEER_ADMINCERTS"
cp "$ADMIN_CERT" "$PEER_ADMINCERTS/"
print_success "Peer admincerts configured"

# Restart peer to apply changes
print_info "Restarting peer container..."
docker restart peer0.lto.gov.ph > /dev/null 2>&1
sleep 10
print_success "Peer restarted"

# Verify peer is running
if docker ps | grep -q "peer0.lto.gov.ph"; then
    print_success "Peer is running"
else
    print_error "Peer failed to start"
    exit 1
fi

echo ""
print_success "Fabric access fix complete!"
print_info "You can now try: npm start"

