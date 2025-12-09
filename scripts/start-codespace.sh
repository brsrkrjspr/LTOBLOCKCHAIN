#!/bin/bash
# TrustChain LTO - Codespace Startup Script
# Starts all services and completes Fabric setup

set -e  # Exit on error

echo "🚀 TrustChain LTO - Codespace Startup"
echo "===================================="
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

# Step 0: Check and generate channel artifacts if needed
print_status "Step 0/8: Checking channel artifacts..."
if [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ]; then
    print_warning "Channel transaction file not found!"
    if [ ! -d "fabric-network/crypto-config" ]; then
        print_error "Cryptographic materials not found!"
        print_error "Please generate crypto materials first:"
        print_error "  bash scripts/generate-crypto.sh"
        exit 1
    fi
    print_status "Generating channel artifacts..."
    bash scripts/generate-channel-artifacts.sh
    if [ $? -ne 0 ]; then
        print_error "Failed to generate channel artifacts"
        exit 1
    fi
    print_success "Channel artifacts generated"
else
    print_success "Channel artifacts already exist"
fi

# Step 1: Start Fabric Network
print_status "Step 1/8: Starting Hyperledger Fabric network..."
docker-compose -f docker-compose.fabric.yml up -d
sleep 15
print_success "Fabric network started"

# Step 2: Wait for orderers to be ready
print_status "Step 2/8: Waiting for orderers to be ready..."
for i in {1..30}; do
    if docker logs orderer1.lto.gov.ph 2>&1 | grep -q "Starting orderer"; then
        print_success "Orderers are ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Orderers failed to start"
        exit 1
    fi
    sleep 2
done

# Step 3: Create channel and join peer
print_status "Step 3/8: Creating channel and joining peer..."

# Check if channel artifacts exist
if [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ]; then
    print_error "Channel transaction file not found!"
    print_error "Please run: bash scripts/generate-channel-artifacts.sh"
    exit 1
fi

# Check if peer is already joined
if docker exec cli peer channel list 2>&1 | grep -q "ltochannel"; then
    print_success "Peer already joined to channel"
else
    # Create channel (will fail if already exists, that's OK)
    print_status "Creating channel 'ltochannel'..."
    CREATE_OUTPUT=$(docker exec cli peer channel create \
        -o orderer1.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem 2>&1)
    
    CREATE_EXIT_CODE=$?
    
    # If channel already exists, try to fetch it
    if [ $CREATE_EXIT_CODE -ne 0 ] && echo "$CREATE_OUTPUT" | grep -q "already exists"; then
        print_warning "Channel already exists, fetching channel block..."
        docker exec cli peer channel fetch 0 ltochannel.block \
            -o orderer1.lto.gov.ph:7050 \
            -c ltochannel \
            --tls \
            --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
    elif [ $CREATE_EXIT_CODE -eq 0 ]; then
        # Copy created block to working directory if it was created in channel-artifacts
        docker exec cli cp ltochannel.block /opt/gopath/src/github.com/hyperledger/fabric/peer/ 2>/dev/null || true
        print_success "Channel created successfully"
    else
        print_error "Failed to create or fetch channel"
        echo "$CREATE_OUTPUT"
        exit 1
    fi
    
    # Join channel
    print_status "Joining peer to channel..."
    docker exec cli peer channel join -b ltochannel.block
    
    if [ $? -eq 0 ]; then
        print_success "Peer joined to channel"
    else
        print_error "Failed to join peer to channel"
        exit 1
    fi
fi

# Step 4: Setup wallet
print_status "Step 4/8: Setting up Fabric wallet..."
if [ ! -f "wallet/admin.id" ]; then
    node scripts/setup-fabric-wallet.js
    print_success "Wallet created"
else
    print_success "Wallet already exists"
fi

# Step 5: Start Core Services (PostgreSQL, IPFS, Redis)
print_status "Step 5/8: Starting core services (PostgreSQL, IPFS, Redis)..."
docker-compose -f docker-compose.core.yml up -d postgres ipfs redis
sleep 10
print_success "Core services started"

# Step 6: Verify services
print_status "Step 6/8: Verifying services..."

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
    print_warning "IPFS may not be ready yet"
fi

# Check Redis
if docker exec redis redis-cli -a redis_password ping > /dev/null 2>&1; then
    print_success "Redis is ready"
else
    print_warning "Redis may not be ready yet"
fi

# Check Fabric Peer
if docker exec peer0.lto.gov.ph peer node status > /dev/null 2>&1; then
    print_success "Fabric peer is ready"
else
    print_warning "Fabric peer may not be ready yet"
fi

# Step 7: Chaincode deployment (optional - may need manual intervention)
print_status "Step 7/8: Attempting chaincode deployment..."
if docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration"; then
    print_success "Chaincode already installed"
else
    print_warning "Chaincode not installed. You may need to deploy it manually."
    print_warning "Run: docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production --lang node --label vehicle-registration_1.0"
    print_warning "Then: docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz"
fi

echo ""
echo "===================================="
print_success "Startup complete!"
echo ""
echo "Services running:"
echo "  - Hyperledger Fabric: orderers, peers, CLI"
echo "  - PostgreSQL: localhost:5432"
echo "  - IPFS: localhost:5001"
echo "  - Redis: localhost:6379"
echo ""
echo "Next steps:"
echo "  1. Deploy chaincode if not already deployed"
echo "  2. Start application: npm start"
echo "  3. Access application: http://localhost:3001"
echo ""

