#!/bin/bash
# TrustChain LTO - Service Verification Script
# Verifies all services are running correctly

set -e

echo "🔍 TrustChain LTO - Service Verification"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Track overall status
ALL_OK=true

# Check PostgreSQL
print_status "Checking PostgreSQL..."
if docker exec postgres pg_isready -U lto_user > /dev/null 2>&1; then
    print_success "PostgreSQL is ready and accepting connections"
else
    print_error "PostgreSQL is not ready"
    ALL_OK=false
fi

# Check IPFS
print_status "Checking IPFS..."
if curl -s http://localhost:5001/api/v0/version > /dev/null 2>&1; then
    IPFS_VERSION=$(curl -s http://localhost:5001/api/v0/version | grep -o '"Version":"[^"]*"' | cut -d'"' -f4)
    print_success "IPFS is running (Version: $IPFS_VERSION)"
else
    print_error "IPFS is not accessible"
    ALL_OK=false
fi

# Check Fabric Peer
print_status "Checking Fabric Peer..."
if docker exec peer0.lto.gov.ph peer node status > /dev/null 2>&1; then
    print_success "Fabric peer is running"
else
    print_warning "Fabric peer status check failed (may still be starting)"
fi

# Check Fabric Channel
print_status "Checking Fabric Channel..."
if docker exec cli peer channel list 2>&1 | grep -q "ltochannel"; then
    print_success "Peer is joined to channel 'ltochannel'"
else
    print_error "Peer is not joined to channel"
    ALL_OK=false
fi

# Check Chaincode
print_status "Checking Chaincode..."
if docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration"; then
    PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
        grep "vehicle-registration" | \
        sed -n 's/.*vehicle-registration[^:]*:\([a-f0-9]*\).*/\1/p' | head -1)
    if [ -n "$PACKAGE_ID" ]; then
        print_success "Chaincode is installed (Package ID: ${PACKAGE_ID:0:20}...)"
    else
        print_warning "Chaincode appears installed but package ID not found"
    fi
else
    print_warning "Chaincode is not installed"
fi

# Check Wallet
print_status "Checking Application Wallet..."
if [ -f "wallet/admin.id" ]; then
    print_success "Application wallet exists with admin identity"
else
    print_warning "Application wallet not found (run: node scripts/setup-fabric-wallet.js)"
fi

# Check Docker Containers
print_status "Checking Docker Containers..."
REQUIRED_CONTAINERS=("postgres" "ipfs" "peer0.lto.gov.ph" "orderer1.lto.gov.ph" "cli")
MISSING_CONTAINERS=()

for container in "${REQUIRED_CONTAINERS[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        STATUS=$(docker ps --filter "name=^${container}$" --format "{{.Status}}")
        print_success "$container is running ($STATUS)"
    else
        print_error "$container is not running"
        MISSING_CONTAINERS+=("$container")
        ALL_OK=false
    fi
done

echo ""
echo "========================================"
if [ "$ALL_OK" = true ] && [ ${#MISSING_CONTAINERS[@]} -eq 0 ]; then
    print_success "All critical services are running correctly!"
    echo ""
    echo "Services Summary:"
    echo "  ✓ PostgreSQL: Ready"
    echo "  ✓ IPFS: Running"
    echo "  ✓ Fabric Peer: Running"
    echo "  ✓ Fabric Channel: Joined"
    echo "  ✓ Docker Containers: All running"
    echo ""
    echo "You can now start the application with: npm start"
    exit 0
else
    print_error "Some services are not running correctly"
    echo ""
    if [ ${#MISSING_CONTAINERS[@]} -gt 0 ]; then
        echo "Missing containers:"
        for container in "${MISSING_CONTAINERS[@]}"; do
            echo "  - $container"
        done
        echo ""
    fi
    echo "Please check the errors above and fix them before starting the application."
    exit 1
fi

