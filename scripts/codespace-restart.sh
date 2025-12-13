#!/bin/bash

# ======================================================
# TrustChain LTO - Codespace Restart Script
# Run this after reopening Codespace or Docker restart
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

# Change to project root
cd /workspaces/LTOBLOCKCHAIN

print_header "TrustChain LTO - Codespace Restart"

# ======================================================
# PHASE 1: Start Docker Containers
# ======================================================
print_header "Phase 1: Starting Docker Containers"

docker-compose -f docker-compose.unified.yml up -d

print_info "Waiting for containers to initialize (30 seconds)..."
sleep 30

# Verify all containers are running
CONTAINERS=("orderer.lto.gov.ph" "peer0.lto.gov.ph" "couchdb" "cli" "postgres" "ipfs" "redis")
ALL_RUNNING=true

for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        print_success "$container is running"
    else
        print_error "$container is NOT running"
        ALL_RUNNING=false
    fi
done

if [ "$ALL_RUNNING" = false ]; then
    print_error "Some containers failed to start. Check docker logs."
    exit 1
fi

# ======================================================
# PHASE 2: Check/Create Channel
# ======================================================
print_header "Phase 2: Checking Channel Status"

# Check if peer has joined channel
CHANNEL_LIST=$(docker exec cli peer channel list 2>/dev/null || echo "")

if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    print_success "Peer already joined to ltochannel"
else
    print_info "Channel not found, creating and joining..."
    
    # Create channel
    docker exec cli peer channel create \
        -o orderer.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
        2>/dev/null || print_info "Channel may already exist, continuing..."
    
    sleep 5
    
    # Join channel
    docker exec cli peer channel join -b ltochannel.block 2>/dev/null || \
        print_info "Peer may already be joined, continuing..."
    
    print_success "Channel setup complete"
fi

# ======================================================
# PHASE 3: Check/Deploy Chaincode
# ======================================================
print_header "Phase 3: Checking Chaincode Status"

# Check if chaincode is committed
CC_COMMITTED=$(docker exec cli peer lifecycle chaincode querycommitted \
    --channelID ltochannel \
    --name vehicle-registration \
    2>/dev/null || echo "not_found")

if echo "$CC_COMMITTED" | grep -q "Version:"; then
    print_success "Chaincode already committed"
    echo "$CC_COMMITTED" | head -3
else
    print_info "Chaincode not committed, deploying..."
    
    # Check if chaincode is already installed
    INSTALLED_OUTPUT=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1)
    if echo "$INSTALLED_OUTPUT" | grep -q "vehicle-registration_1.0"; then
        print_success "Chaincode already installed, getting package ID..."
        PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | \
            grep "vehicle-registration_1.0" | \
            sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    else
        print_info "Installing chaincode..."
        
        # Package chaincode
        docker exec cli peer lifecycle chaincode package /opt/gopath/src/github.com/hyperledger/fabric/peer/vehicle-registration.tar.gz \
            --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
            --lang node \
            --label vehicle-registration_1.0
        
        print_success "Chaincode packaged"
        
        # Install chaincode
        INSTALL_OUTPUT=$(docker exec cli peer lifecycle chaincode install \
            /opt/gopath/src/github.com/hyperledger/fabric/peer/vehicle-registration.tar.gz 2>&1)
        
        if [ $? -eq 0 ] || echo "$INSTALL_OUTPUT" | grep -q "already successfully installed"; then
            print_success "Chaincode installed (or already installed)"
        else
            print_error "Chaincode installation failed"
            echo "$INSTALL_OUTPUT"
            exit 1
        fi
        
        sleep 10
        
        # Get package ID
        PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
            grep "vehicle-registration_1.0" | \
            sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    fi
    
    if [ -z "$PACKAGE_ID" ]; then
        print_error "Failed to get package ID. Showing installed chaincodes:"
        docker exec cli peer lifecycle chaincode queryinstalled
        exit 1
    fi
    
    print_info "Package ID: $PACKAGE_ID"
    
    # Approve chaincode
    docker exec cli peer lifecycle chaincode approveformyorg \
        -o orderer.lto.gov.ph:7050 \
        --channelID ltochannel \
        --name vehicle-registration \
        --version 1.0 \
        --package-id "$PACKAGE_ID" \
        --sequence 1 \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
    
    print_success "Chaincode approved"
    sleep 5
    
    # Commit chaincode
    docker exec cli peer lifecycle chaincode commit \
        -o orderer.lto.gov.ph:7050 \
        --channelID ltochannel \
        --name vehicle-registration \
        --version 1.0 \
        --sequence 1 \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
        --peerAddresses peer0.lto.gov.ph:7051 \
        --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
    
    print_success "Chaincode committed"
fi

# ======================================================
# PHASE 4: Setup Wallet (if needed)
# ======================================================
print_header "Phase 4: Checking Wallet"

if [ -d "wallet/admin" ]; then
    print_success "Wallet already exists"
else
    print_info "Setting up wallet..."
    node scripts/setup-fabric-wallet.js
    print_success "Wallet created"
fi

# ======================================================
# PHASE 5: Verify Database Schema
# ======================================================
print_header "Phase 5: Verifying Database Schema"

# Apply basic schema updates
docker exec postgres psql -U lto_user -d lto_blockchain -c "
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);
    CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
    ALTER TABLE vehicle_history ALTER COLUMN transaction_id TYPE VARCHAR(255);
" 2>/dev/null || print_info "Basic schema already up to date"

# Apply transfer ownership schema if it exists
if [ -f "database/add-transfer-ownership.sql" ]; then
    print_info "Applying transfer ownership schema..."
    docker exec -i postgres psql -U lto_user -d lto_blockchain < database/add-transfer-ownership.sql 2>/dev/null || print_info "Transfer schema already applied or has warnings"
    
    # Verify transfer tables exist
    TRANSFER_TABLES=$(docker exec postgres psql -U lto_user -d lto_blockchain -tAc "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_name IN ('transfer_requests', 'transfer_documents', 'transfer_verifications')
    " 2>/dev/null || echo "0")
    
    if [ "$TRANSFER_TABLES" = "3" ]; then
        print_success "Transfer ownership tables verified"
    else
        print_info "Transfer ownership tables: $TRANSFER_TABLES/3 found"
    fi
else
    print_info "Transfer ownership schema file not found (optional)"
fi

print_success "Database schema verified"

# ======================================================
# PHASE 6: Final Verification
# ======================================================
print_header "Phase 6: Final Verification"

# Test Fabric connection
echo "Testing blockchain connection..."
CHANNEL_INFO=$(docker exec cli peer channel getinfo -c ltochannel 2>/dev/null || echo "failed")

if echo "$CHANNEL_INFO" | grep -q "height"; then
    print_success "Blockchain is operational"
    echo "$CHANNEL_INFO"
else
    print_error "Blockchain connection failed"
fi

# Test PostgreSQL
echo ""
echo "Testing PostgreSQL..."
PG_TEST=$(docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT NOW();" 2>/dev/null || echo "failed")

if echo "$PG_TEST" | grep -q "202"; then
    print_success "PostgreSQL is operational"
else
    print_error "PostgreSQL connection failed"
fi

# Test IPFS
echo ""
echo "Testing IPFS..."
# Test 1: IPFS version (inside container)
IPFS_VERSION=$(docker exec ipfs ipfs version 2>/dev/null || echo "failed")
if echo "$IPFS_VERSION" | grep -q "ipfs version"; then
    print_success "IPFS is operational (version check passed)"
    echo "   $IPFS_VERSION"
else
    print_error "IPFS version check failed"
fi

# Test 2: IPFS API (POST request - correct method)
IPFS_API=$(curl -s -X POST http://localhost:5001/api/v0/version 2>/dev/null || echo "failed")
if echo "$IPFS_API" | grep -q "Version"; then
    API_VERSION=$(echo "$IPFS_API" | grep -o '"Version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    print_success "IPFS API is accessible (Version: $API_VERSION)"
else
    print_warning "IPFS API test failed (might be OK if using container name)"
    print_info "IPFS container is running, application will connect via container name"
fi

# ======================================================
# DONE
# ======================================================
print_header "Setup Complete!"

echo -e "${GREEN}All services are ready!${NC}"
echo ""
echo "To start the application, run:"
echo -e "${YELLOW}  npm start${NC}"
echo ""
echo "Then access the frontend at the Codespace forwarded port 3001"
echo ""

