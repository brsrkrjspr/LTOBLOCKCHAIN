#!/bin/bash
# TrustChain LTO - Complete Codespace Setup
# Single command to set up everything from scratch
# Uses simplified single-orderer configuration for reliability

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_status() { echo -e "${CYAN}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_header() { echo -e "\n${BOLD}${CYAN}=== $1 ===${NC}\n"; }

# Change to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     TrustChain LTO - Complete Codespace Setup            ║${NC}"
echo -e "${BOLD}║     Single-Orderer Fabric Network                        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# PHASE 1: CLEANUP
# ============================================
print_header "PHASE 1: Cleanup"

print_status "Stopping any existing containers..."
docker-compose -f docker-compose.fabric.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.fabric-simple.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.core.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.services.yml down -v 2>/dev/null || true

print_status "Removing old data..."
rm -rf fabric-network/crypto-config 2>/dev/null || true
rm -rf fabric-network/channel-artifacts 2>/dev/null || true
rm -rf wallet 2>/dev/null || true

print_status "Creating directories..."
mkdir -p fabric-network/crypto-config
mkdir -p fabric-network/channel-artifacts
mkdir -p wallet

print_success "Cleanup complete"

# ============================================
# PHASE 2: GENERATE CRYPTO MATERIALS
# ============================================
print_header "PHASE 2: Generate Cryptographic Materials"

print_status "Generating crypto materials with cryptogen..."
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -w /fabric-network \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=crypto-config-simple.yaml --output=crypto-config

# Verify generation
if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph" ]; then
    print_error "Crypto generation failed - peerOrganizations not found"
    exit 1
fi

if [ ! -d "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph" ]; then
    print_error "Crypto generation failed - ordererOrganizations not found"
    exit 1
fi

# Setup admincerts for NodeOUs
print_status "Setting up admin certificates for NodeOUs..."
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
mkdir -p "${ADMIN_MSP}/admincerts"
cp "${ADMIN_MSP}/signcerts/Admin@lto.gov.ph-cert.pem" "${ADMIN_MSP}/admincerts/"

print_success "Cryptographic materials generated"

# ============================================
# PHASE 3: GENERATE CHANNEL ARTIFACTS
# ============================================
print_header "PHASE 3: Generate Channel Artifacts"

# First, copy configtx-simple.yaml to configtx.yaml in fabric-network
print_status "Setting up configtx.yaml..."
cp fabric-network/configtx-simple.yaml fabric-network/configtx.yaml

print_status "Generating genesis block..."
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOGenesis -channelID system-channel -outputBlock channel-artifacts/genesis.block

if [ ! -f "fabric-network/channel-artifacts/genesis.block" ]; then
    print_error "Genesis block generation failed"
    exit 1
fi

print_status "Generating channel transaction..."
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOChannel -outputCreateChannelTx channel-artifacts/ltochannel.tx -channelID ltochannel

if [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ]; then
    print_error "Channel transaction generation failed"
    exit 1
fi

print_success "Channel artifacts generated"

# ============================================
# PHASE 4: START FABRIC NETWORK
# ============================================
print_header "PHASE 4: Start Fabric Network"

print_status "Starting Fabric containers..."
docker-compose -f docker-compose.fabric-simple.yml up -d

print_status "Waiting for containers to initialize (45 seconds)..."
for i in {1..9}; do
    echo -n "."
    sleep 5
done
echo ""

# Check containers
print_status "Checking container status..."
if ! docker ps | grep -q "orderer.lto.gov.ph"; then
    print_error "Orderer is not running!"
    print_status "Orderer logs:"
    docker logs orderer.lto.gov.ph --tail 30 2>&1
    exit 1
fi
print_success "Orderer is running"

if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    print_error "Peer is not running!"
    print_status "Peer logs:"
    docker logs peer0.lto.gov.ph --tail 30 2>&1
    exit 1
fi
print_success "Peer is running"

if ! docker ps | grep -q "cli"; then
    print_error "CLI container is not running!"
    exit 1
fi
print_success "CLI is running"

# ============================================
# PHASE 5: CREATE AND JOIN CHANNEL
# ============================================
print_header "PHASE 5: Create and Join Channel"

print_status "Creating channel 'ltochannel'..."
docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    print_error "Channel creation failed"
    exit 1
fi
print_success "Channel created"

print_status "Joining peer to channel..."
docker exec cli peer channel join -b ltochannel.block

if [ $? -ne 0 ]; then
    print_error "Channel join failed"
    exit 1
fi
print_success "Peer joined channel"

# Verify
print_status "Verifying channel membership..."
CHANNELS=$(docker exec cli peer channel list 2>&1)
if echo "$CHANNELS" | grep -q "ltochannel"; then
    print_success "Channel membership verified"
else
    print_error "Channel membership verification failed"
    echo "$CHANNELS"
    exit 1
fi

# ============================================
# PHASE 6: DEPLOY CHAINCODE
# ============================================
print_header "PHASE 6: Deploy Chaincode"

print_status "Packaging chaincode..."
docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

print_status "Installing chaincode on peer..."
docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1

print_status "Waiting for chaincode installation (15 seconds)..."
sleep 15

print_status "Getting package ID..."
QUERY_OUTPUT=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1)
PACKAGE_ID=$(echo "$QUERY_OUTPUT" | grep "vehicle-registration_1.0:" | sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    print_error "Failed to get package ID"
    echo "Query output: $QUERY_OUTPUT"
    exit 1
fi
print_success "Package ID: ${PACKAGE_ID:0:50}..."

print_status "Approving chaincode for organization..."
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem 2>&1

print_status "Waiting for approval to propagate (10 seconds)..."
sleep 10

print_status "Checking commit readiness..."
docker exec cli peer lifecycle chaincode checkcommitreadiness \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1

print_status "Committing chaincode definition..."
docker exec cli peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem 2>&1

print_status "Waiting for commit to complete (10 seconds)..."
sleep 10

print_status "Verifying chaincode deployment..."
if docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration 2>/dev/null; then
    print_success "Chaincode deployed and committed successfully!"
else
    print_error "Chaincode verification failed"
    exit 1
fi

# ============================================
# PHASE 7: START SUPPORTING SERVICES
# ============================================
print_header "PHASE 7: Start Supporting Services"

print_status "Starting PostgreSQL, IPFS, and Redis..."
docker-compose -f docker-compose.services.yml up -d

print_status "Waiting for services to initialize (15 seconds)..."
sleep 15

# Verify PostgreSQL
if docker exec postgres pg_isready -U lto_user -d lto_blockchain >/dev/null 2>&1; then
    print_success "PostgreSQL is ready"
else
    print_warning "PostgreSQL may still be initializing..."
fi

# Verify IPFS
if curl -s http://localhost:5001/api/v0/version >/dev/null 2>&1; then
    print_success "IPFS is ready"
else
    print_warning "IPFS may still be initializing..."
fi

# ============================================
# PHASE 8: SETUP NETWORK CONFIG
# ============================================
print_header "PHASE 8: Setup Network Configuration"

print_status "Copying network configuration..."
cp network-config-simple.json network-config.json
print_success "Network configuration ready"

# ============================================
# PHASE 9: SETUP WALLET
# ============================================
print_header "PHASE 9: Setup Application Wallet"

print_status "Setting up Fabric wallet with admin identity..."
npm install --prefix . 2>/dev/null || true
node scripts/setup-fabric-wallet.js

if [ -d "wallet/admin.id" ] || [ -f "wallet/admin.id" ]; then
    print_success "Wallet setup complete"
else
    print_warning "Wallet setup may have failed - check output above"
fi

# ============================================
# SETUP COMPLETE
# ============================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              SETUP COMPLETE!                             ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Services Running:${NC}"
echo "  ✓ Fabric Orderer: orderer.lto.gov.ph (localhost:7050)"
echo "  ✓ Fabric Peer: peer0.lto.gov.ph (localhost:7051)"
echo "  ✓ CouchDB: localhost:5984"
echo "  ✓ PostgreSQL: localhost:5432"
echo "  ✓ IPFS API: localhost:5001"
echo "  ✓ IPFS Gateway: localhost:8080"
echo "  ✓ Redis: localhost:6379"
echo ""
echo -e "${GREEN}Chaincode:${NC}"
echo "  ✓ vehicle-registration v1.0 deployed on ltochannel"
echo ""
echo -e "${YELLOW}To start the application:${NC}"
echo "  npm start"
echo ""
echo -e "${YELLOW}To access the application:${NC}"
echo "  Open port 3001 in Codespace (click 'Open in Browser')"
echo ""

