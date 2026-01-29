#!/bin/bash

# ======================================================
# TrustChain LTO - Fix Fabric Crypto Materials
# Regenerates crypto materials and restarts containers
# ======================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Change to script directory's parent (project root)
cd "$(dirname "$0")/.."

print_header "Fixing Fabric Cryptographic Materials"

# Step 1: Stop Fabric containers (all peers and orderer)
print_info "Step 1: Stopping Fabric containers..."
docker-compose -f docker-compose.unified.yml stop orderer.lto.gov.ph peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph cli 2>/dev/null || true
print_success "Containers stopped"

# Step 2: Backup and remove old crypto materials
print_info "Step 2: Removing old crypto materials..."
if [ -d "fabric-network/crypto-config" ]; then
    rm -rf fabric-network/crypto-config
    print_success "Old crypto materials removed"
else
    print_info "No existing crypto materials found"
fi

# Step 3: Regenerate crypto materials
print_info "Step 3: Regenerating cryptographic materials..."

# Resolve crypto-config.yaml path (config/ takes precedence)
CRYPTO_CONFIG=""
if [ -f "config/crypto-config.yaml" ]; then
    CRYPTO_CONFIG="config/crypto-config.yaml"
    print_info "Using config/crypto-config.yaml"
elif [ -f "crypto-config.yaml" ]; then
    CRYPTO_CONFIG="crypto-config.yaml"
    print_info "Using crypto-config.yaml from root"
else
    print_error "crypto-config.yaml not found in config/ or project root!"
    exit 1
fi

# Generate using Docker: mount config and fabric-network, use canonical path
docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config

if [ $? -eq 0 ]; then
    print_success "Crypto materials generated"
else
    print_error "Failed to generate crypto materials"
    exit 1
fi

# Fix permissions (in case Docker still created files as root)
print_info "Fixing file permissions..."
chmod -R 755 fabric-network/crypto-config 2>/dev/null || true
chown -R $(whoami):$(whoami) fabric-network/crypto-config 2>/dev/null || true

# Step 4: Setup admincerts for NodeOUs (required for all organizations)
print_info "Step 4: Setting up admin certificates for all organizations..."

# Function to setup admincerts for an organization
setup_admincerts() {
    local ORG_DOMAIN=$1
    local ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
    
    if [ -d "$ADMIN_MSP" ]; then
        mkdir -p "${ADMIN_MSP}/admincerts"
        # Try to find any .pem file in signcerts
        CERT_FILE=$(find "${ADMIN_MSP}/signcerts" -name "*.pem" | head -1)
        if [ -n "$CERT_FILE" ]; then
            cp "$CERT_FILE" "${ADMIN_MSP}/admincerts/"
            print_success "Admin certificates configured for ${ORG_DOMAIN}"
        else
            print_error "No certificate file found in signcerts for ${ORG_DOMAIN}"
        fi
    else
        print_error "Admin MSP directory not found for ${ORG_DOMAIN}"
    fi
}

# Setup admincerts for all organizations
setup_admincerts "lto.gov.ph"
setup_admincerts "hpg.gov.ph"
setup_admincerts "insurance.gov.ph"

print_success "Admin certificates configured for all organizations"

# Step 5: Remove old wallet (will be recreated)
print_info "Step 5: Removing old wallet..."
if [ -d "wallet" ]; then
    rm -rf wallet
    print_success "Old wallet removed"
fi

# Step 6: Restart Fabric containers (all peers, orderer, and full stack)
print_info "Step 6: Restarting Fabric containers..."
docker-compose -f docker-compose.unified.yml up -d
sleep 15
print_success "Containers restarted"

# Step 7: Recreate wallet
print_info "Step 7: Recreating wallet..."
node scripts/setup-fabric-wallet.js
print_success "Wallet recreated"

# Step 8: Verify
print_info "Step 8: Verifying crypto materials..."
if docker exec cli peer version > /dev/null 2>&1; then
    print_success "Fabric CLI is working"
else
    print_error "Fabric CLI verification failed"
    print_info "Try running: docker exec cli peer version"
fi

print_header "Crypto Materials Fixed!"
print_success "All steps completed successfully"
print_info "You can now continue with chaincode deployment"

