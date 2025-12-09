#!/bin/bash
# TrustChain LTO - Unified Setup Script
# Single script to set up everything from scratch
# Handles permissions properly using Docker user mapping

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo ""
echo "======================================================"
echo "  TrustChain LTO - Unified Setup"
echo "======================================================"
echo ""

# ============================================
# PHASE 1: CLEANUP
# ============================================
log_info "Phase 1: Cleaning up..."

# Stop all containers
docker-compose -f docker-compose.unified.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.fabric.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.fabric-simple.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.core.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.services.yml down -v 2>/dev/null || true

# Remove old data (with sudo if needed)
if [ -d "fabric-network/crypto-config" ]; then
    sudo rm -rf fabric-network/crypto-config 2>/dev/null || rm -rf fabric-network/crypto-config
fi
if [ -d "fabric-network/channel-artifacts" ]; then
    sudo rm -rf fabric-network/channel-artifacts 2>/dev/null || rm -rf fabric-network/channel-artifacts
fi
rm -rf wallet 2>/dev/null || true

# Create directories
mkdir -p fabric-network/crypto-config
mkdir -p fabric-network/channel-artifacts
mkdir -p wallet

log_success "Cleanup complete"

# ============================================
# PHASE 2: GENERATE CRYPTO MATERIALS
# ============================================
log_info "Phase 2: Generating cryptographic materials..."

# Run cryptogen with proper user mapping to avoid permission issues
docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config

# Verify generation
if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph" ]; then
    log_error "Failed to generate peer crypto materials"
    exit 1
fi

if [ ! -d "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph" ]; then
    log_error "Failed to generate orderer crypto materials"
    exit 1
fi

# Setup admincerts for NodeOUs
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
mkdir -p "${ADMIN_MSP}/admincerts"
cp "${ADMIN_MSP}/signcerts/"*.pem "${ADMIN_MSP}/admincerts/"

log_success "Crypto materials generated"

# ============================================
# PHASE 3: GENERATE CHANNEL ARTIFACTS
# ============================================
log_info "Phase 3: Generating channel artifacts..."

# Generate genesis block
docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel -outputBlock /fabric-network/channel-artifacts/genesis.block

if [ ! -f "fabric-network/channel-artifacts/genesis.block" ]; then
    log_error "Failed to generate genesis block"
    exit 1
fi
log_success "Genesis block generated"

# Generate channel transaction
docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -outputCreateChannelTx /fabric-network/channel-artifacts/channel.tx -channelID ltochannel

if [ ! -f "fabric-network/channel-artifacts/channel.tx" ]; then
    log_error "Failed to generate channel transaction"
    exit 1
fi
log_success "Channel transaction generated"

# ============================================
# PHASE 4: START CONTAINERS
# ============================================
log_info "Phase 4: Starting containers..."

docker-compose -f docker-compose.unified.yml up -d

log_info "Waiting for containers to initialize (30s)..."
sleep 30

# Check containers
CONTAINERS=("orderer.lto.gov.ph" "peer0.lto.gov.ph" "couchdb" "cli" "postgres" "ipfs" "redis")
for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        log_success "$container is running"
    else
        log_error "$container failed to start"
        docker logs "$container" --tail 20 2>/dev/null || true
        exit 1
    fi
done

# ============================================
# PHASE 5: CREATE CHANNEL
# ============================================
log_info "Phase 5: Creating channel..."

docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

log_success "Channel created"

# ============================================
# PHASE 6: JOIN CHANNEL
# ============================================
log_info "Phase 6: Joining peer to channel..."

docker exec cli peer channel join -b ltochannel.block

# Verify
if docker exec cli peer channel list 2>&1 | grep -q "ltochannel"; then
    log_success "Peer joined channel"
else
    log_error "Failed to join channel"
    exit 1
fi

# ============================================
# PHASE 7: DEPLOY CHAINCODE
# ============================================
log_info "Phase 7: Deploying chaincode..."

# Package
docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

log_success "Chaincode packaged"

# Install
docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz
log_info "Waiting for chaincode installation (15s)..."
sleep 15

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0:" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    log_error "Failed to get package ID"
    docker exec cli peer lifecycle chaincode queryinstalled
    exit 1
fi
log_success "Package ID: ${PACKAGE_ID:0:40}..."

# Approve
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

log_info "Waiting for approval to propagate (10s)..."
sleep 10
log_success "Chaincode approved"

# Commit
docker exec cli peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

log_info "Waiting for commit (10s)..."
sleep 10

# Verify
if docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration 2>/dev/null; then
    log_success "Chaincode committed"
else
    log_error "Chaincode commit verification failed"
    exit 1
fi

# ============================================
# PHASE 8: SETUP WALLET
# ============================================
log_info "Phase 8: Setting up wallet..."

# Copy network config
cp config/network-config.json network-config.json

# Run wallet setup
node scripts/setup-fabric-wallet.js

log_success "Wallet setup complete"

# ============================================
# COMPLETE
# ============================================
echo ""
echo "======================================================"
echo -e "${GREEN}  SETUP COMPLETE!${NC}"
echo "======================================================"
echo ""
echo "Services running:"
echo "  - Orderer: localhost:7050"
echo "  - Peer: localhost:7051"
echo "  - CouchDB: localhost:5984"
echo "  - PostgreSQL: localhost:5432"
echo "  - IPFS: localhost:5001 (API), localhost:8080 (Gateway)"
echo "  - Redis: localhost:6379"
echo ""
echo "Chaincode: vehicle-registration v1.0 on ltochannel"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""

