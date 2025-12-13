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

cd /workspaces/LTOBLOCKCHAIN

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

# Step 3: Clean wallet
print_header "Step 3: Cleaning Wallet"
if [ -d "wallet" ]; then
    rm -rf wallet/*
    print_success "Wallet cleaned"
fi

# Step 4: Run full restart
print_header "Step 4: Running Full Setup"
bash scripts/codespace-restart.sh

print_header "Fresh Start Complete!"
print_success "Fabric network has been completely reset"
print_info "You can now run: npm start"

