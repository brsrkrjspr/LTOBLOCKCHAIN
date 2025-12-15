#!/bin/bash
# Complete fresh start for Fabric network
# Removes ALL volumes and starts from scratch
# Use this when you have persistent certificate/blockchain state conflicts

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Change to script directory's parent (project root)
cd "$(dirname "$0")/.."

print_header "Fresh Start - Fabric Network"
print_warning "This will remove ALL Docker volumes and start from scratch!"
print_warning "Database and IPFS data will be preserved (not Fabric volumes)"
echo ""

# Confirm
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cancelled"
    exit 0
fi

# Step 1: Stop and remove everything
print_header "Step 1: Stopping Containers and Removing Volumes"
docker-compose -f docker-compose.unified.yml down -v 2>/dev/null || true
print_success "Containers stopped and volumes removed"

# Step 2: Remove Fabric-specific volumes explicitly
print_header "Step 2: Removing Fabric Volumes"
# Remove volumes by pattern (handles different Docker Compose naming conventions)
docker volume ls -q | grep -E "(orderer-data|peer-data|couchdb-data)$" | xargs -r docker volume rm 2>/dev/null || true
print_success "Fabric volumes removed"

# Step 3: Clean wallet and old artifacts
print_header "Step 3: Cleaning Wallet and Old Artifacts"
if [ -d "wallet" ]; then
    rm -rf wallet/*
    print_success "Wallet cleaned"
fi

# Remove old crypto and channel artifacts to force regeneration
if [ -d "fabric-network/crypto-config" ]; then
    print_info "Removing old crypto materials..."
    rm -rf fabric-network/crypto-config
    print_success "Old crypto materials removed"
fi

if [ -d "fabric-network/channel-artifacts" ]; then
    print_info "Removing old channel artifacts..."
    rm -rf fabric-network/channel-artifacts
    print_success "Old channel artifacts removed"
fi

# Step 4: Regenerate Crypto Materials
print_header "Step 4: Regenerating Cryptographic Materials"
if [ ! -f "config/crypto-config.yaml" ] && [ ! -f "crypto-config.yaml" ]; then
    print_error "crypto-config.yaml not found in config/ or root directory"
    exit 1
fi

bash scripts/generate-crypto.sh
if [ $? -ne 0 ]; then
    print_error "Failed to generate crypto materials"
    exit 1
fi
print_success "Crypto materials regenerated"

# Step 5: Regenerate Channel Artifacts
print_header "Step 5: Regenerating Channel Artifacts"
if [ ! -f "config/configtx.yaml" ] && [ ! -f "configtx.yaml" ]; then
    print_error "configtx.yaml not found in config/ or root directory"
    exit 1
fi

bash scripts/generate-channel-artifacts.sh
if [ $? -ne 0 ]; then
    print_error "Failed to generate channel artifacts"
    exit 1
fi
print_success "Channel artifacts regenerated"

# Step 6: Start Docker services
print_header "Step 6: Starting Docker Services"
docker-compose -f docker-compose.unified.yml up -d

# Wait for services to be ready
print_info "Waiting for services to start..."
sleep 10

# Step 7: Setup wallet
print_header "Step 7: Setting Up Fabric Wallet"
if [ -f "scripts/setup-fabric-wallet.js" ]; then
    node scripts/setup-fabric-wallet.js
else
    print_warning "Wallet setup script not found, skipping..."
fi

print_header "Fresh Start Complete!"
print_success "Fabric network has been completely reset"
print_info "You can now run: npm start"

