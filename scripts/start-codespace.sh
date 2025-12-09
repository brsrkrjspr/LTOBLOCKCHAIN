#!/bin/bash
# TrustChain LTO - Codespace Startup Script
# Complete setup and startup for Codespace deployment
# Handles all Fabric network, core services, and application setup

set -e

echo "🚀 TrustChain LTO - Codespace Startup"
echo "======================================"
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
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 0: Check prerequisites
print_status "Step 0/9: Checking prerequisites..."

# Check Docker
if ! docker ps > /dev/null 2>&1; then
    print_error "Docker is not running!"
    exit 1
fi
print_success "Docker is running"

# Check if crypto materials exist
if [ ! -d "fabric-network/crypto-config/peerOrganizations" ]; then
    print_warning "Cryptographic materials not found!"
    print_status "Generating crypto materials..."
    bash scripts/generate-crypto.sh
    if [ $? -ne 0 ]; then
        print_error "Failed to generate crypto materials"
        exit 1
    fi
    print_success "Crypto materials generated"
else
    print_success "Crypto materials exist"
fi

# Check if channel artifacts exist
if [ ! -f "fabric-network/channel-artifacts/genesis.block" ] || [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ]; then
    print_warning "Channel artifacts not found!"
    print_status "Generating channel artifacts..."
    bash scripts/generate-channel-artifacts.sh
    if [ $? -ne 0 ]; then
        print_error "Failed to generate channel artifacts"
        exit 1
    fi
    print_success "Channel artifacts generated"
else
    print_success "Channel artifacts exist"
fi

# Step 1: Stop any existing containers (clean start)
print_status "Step 1/9: Cleaning up existing containers..."
docker-compose -f docker-compose.fabric.yml down 2>/dev/null || true
docker-compose -f docker-compose.core.yml down 2>/dev/null || true
sleep 3
print_success "Cleanup complete"

# Step 2: Start Fabric Network
print_status "Step 2/9: Starting Hyperledger Fabric network..."
docker-compose -f docker-compose.fabric.yml up -d

# Wait for containers to start
print_status "Waiting for containers to initialize (30 seconds)..."
sleep 30
print_success "Fabric network started"

# Step 3: Verify all containers are running
print_status "Step 3/9: Verifying containers..."

# Check critical containers
CRITICAL_CONTAINERS=("orderer1.lto.gov.ph" "peer0.lto.gov.ph" "cli" "couchdb0")
FAILED_CONTAINERS=()

for container in "${CRITICAL_CONTAINERS[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        print_success "$container is running"
    else
        print_error "$container is NOT running"
        FAILED_CONTAINERS+=("$container")
    fi
done

if [ ${#FAILED_CONTAINERS[@]} -gt 0 ]; then
    print_error "Some critical containers failed to start!"
    print_status "Checking logs for failed containers..."
    for container in "${FAILED_CONTAINERS[@]}"; do
        echo "=== Logs for $container ==="
        docker logs $container --tail 20 2>&1 || echo "Container not found"
    done
    print_error "Please check the logs and fix any issues"
    exit 1
fi

# Step 4: Wait for orderers to be ready
print_status "Step 4/9: Waiting for orderers to be ready..."
for i in {1..30}; do
    if docker logs orderer1.lto.gov.ph 2>&1 | grep -q "Starting orderer"; then
        print_success "Orderers are ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Orderers failed to start properly"
        docker logs orderer1.lto.gov.ph --tail 20
        exit 1
    fi
    sleep 2
done

# Step 5: Create/join channel
print_status "Step 5/9: Setting up channel..."

# Check if peer is already joined to channel
if docker exec cli peer channel list 2>&1 | grep -q "ltochannel"; then
    print_success "Peer is already joined to channel 'ltochannel'"
else
    # Try to create channel first
    print_status "Creating channel 'ltochannel'..."
    
    CREATE_RESULT=$(docker exec cli peer channel create \
        -o orderer1.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem 2>&1) || true
    
    # Check if channel was created or already exists
    if echo "$CREATE_RESULT" | grep -q "Received block: 0"; then
        print_success "Channel created successfully"
    elif echo "$CREATE_RESULT" | grep -qiE "already exists|version.*currently at version"; then
        print_warning "Channel already exists, fetching genesis block..."
        docker exec cli peer channel fetch 0 ltochannel.block \
            -o orderer1.lto.gov.ph:7050 \
            -c ltochannel \
            --tls \
            --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
        if [ $? -ne 0 ]; then
            print_error "Failed to fetch channel block"
            exit 1
        fi
        print_success "Channel block fetched"
    else
        print_error "Failed to create channel"
        echo "$CREATE_RESULT"
        exit 1
    fi
    
    # Join peer to channel
    print_status "Joining peer to channel..."
    JOIN_RESULT=$(docker exec cli peer channel join -b ltochannel.block 2>&1) || true
    
    if echo "$JOIN_RESULT" | grep -q "Successfully submitted proposal"; then
        print_success "Peer joined to channel"
    elif echo "$JOIN_RESULT" | grep -qi "already"; then
        print_success "Peer is already joined to channel"
    else
        print_error "Failed to join peer to channel"
        echo "$JOIN_RESULT"
        exit 1
    fi
fi

# Verify channel membership
docker exec cli peer channel list

# Step 6: Setup wallet
print_status "Step 6/9: Setting up application wallet..."
if [ -f "wallet/admin.id" ]; then
    print_success "Wallet already exists"
else
    if [ -f "scripts/setup-fabric-wallet.js" ]; then
        node scripts/setup-fabric-wallet.js
        if [ $? -eq 0 ]; then
            print_success "Wallet created"
        else
            print_warning "Wallet creation failed (may need npm install first)"
        fi
    else
        print_warning "Wallet setup script not found"
    fi
fi

# Step 7: Start Core Services (PostgreSQL, IPFS, Redis)
print_status "Step 7/9: Starting core services (PostgreSQL, IPFS, Redis)..."

# Ensure lto-network exists for core services
if ! docker network ls | grep -q "lto-network"; then
    print_warning "lto-network not found, creating..."
    docker network create lto-network 2>/dev/null || true
fi

docker-compose -f docker-compose.core.yml up -d postgres ipfs redis
sleep 10
print_success "Core services started"

# Step 8: Verify all services
print_status "Step 8/9: Verifying services..."

# Check PostgreSQL
if docker exec postgres pg_isready -U lto_user > /dev/null 2>&1; then
    print_success "PostgreSQL is ready"
else
    print_warning "PostgreSQL may not be ready yet"
fi

# Check IPFS
if curl -s http://localhost:5001/api/v0/version > /dev/null 2>&1; then
    print_success "IPFS is ready"
else
    print_warning "IPFS may not be ready yet (try again in a few seconds)"
fi

# Check Redis
if docker exec redis redis-cli -a redis_password ping 2>/dev/null | grep -q "PONG"; then
    print_success "Redis is ready"
else
    print_warning "Redis may not be ready yet"
fi

# Step 9: Display summary
print_status "Step 9/9: Deployment summary..."

echo ""
echo "======================================"
print_success "TrustChain LTO Codespace Startup Complete!"
echo ""
echo "📋 Services Running:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "peer|orderer|cli|postgres|ipfs|redis|couchdb" | head -15
echo ""
echo "📋 Channel Status:"
docker exec cli peer channel list 2>/dev/null || echo "  (Unable to query channels)"
echo ""
echo "📋 Next Steps:"
echo "  1. Deploy chaincode (if not deployed):"
echo "     bash scripts/complete-fabric-setup.sh"
echo ""
echo "  2. Install npm dependencies (if not done):"
echo "     npm install"
echo ""
echo "  3. Start the application:"
echo "     npm start"
echo ""
echo "  4. Access the application:"
echo "     http://localhost:3001"
echo ""
echo "======================================"
