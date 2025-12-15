#!/bin/bash
# TrustChain LTO - Simplified Fabric Network Setup
# This script sets up a single-orderer Fabric network that is more reliable
# for development and testing environments

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${CYAN}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo ""
echo "=========================================="
echo "TrustChain LTO - Simplified Fabric Setup"
echo "=========================================="
echo ""

# Change to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Step 1: Clean up any existing containers and volumes
print_status "Step 1/9: Cleaning up existing containers and volumes..."
docker-compose -f docker-compose.fabric.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.fabric-simple.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.core.yml down -v 2>/dev/null || true

# Remove old crypto materials
rm -rf fabric-network/crypto-config
rm -rf fabric-network/channel-artifacts
rm -rf wallet

# Create directories
mkdir -p fabric-network/crypto-config
mkdir -p fabric-network/channel-artifacts
mkdir -p wallet

print_success "Cleanup complete"

# Step 2: Generate crypto materials
print_status "Step 2/9: Generating cryptographic materials..."
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -w /fabric-network \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=crypto-config-simple.yaml --output=crypto-config

if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph" ]; then
    print_error "Failed to generate crypto materials"
    exit 1
fi
print_success "Crypto materials generated"

# Step 3: Copy admin cert to admincerts (required for NodeOUs)
print_status "Step 3/9: Setting up admin certificates..."
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
mkdir -p "${ADMIN_MSP}/admincerts"
cp "${ADMIN_MSP}/signcerts/Admin@lto.gov.ph-cert.pem" "${ADMIN_MSP}/admincerts/"
print_success "Admin certificates configured"

# Step 4: Generate genesis block
print_status "Step 4/9: Generating genesis block..."
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOGenesis -channelID system-channel -outputBlock channel-artifacts/genesis.block -configPath /fabric-network -outputBlock channel-artifacts/genesis.block

if [ ! -f "fabric-network/channel-artifacts/genesis.block" ]; then
    print_error "Failed to generate genesis block"
    exit 1
fi
print_success "Genesis block generated"

# Step 5: Generate channel transaction
print_status "Step 5/9: Generating channel transaction..."
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -w /fabric-network \
    -e FABRIC_CFG_PATH=/fabric-network \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile LTOChannel -outputCreateChannelTx channel-artifacts/ltochannel.tx -channelID ltochannel -configPath /fabric-network

if [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ]; then
    print_error "Failed to generate channel transaction"
    exit 1
fi
print_success "Channel transaction generated"

# Step 6: Start Fabric network
print_status "Step 6/9: Starting Fabric network..."
docker-compose -f docker-compose.fabric-simple.yml up -d

# Wait for services to be ready
print_status "Waiting for services to be ready (30 seconds)..."
sleep 30

# Check if services are running
if ! docker ps | grep -q "orderer.lto.gov.ph"; then
    print_error "Orderer failed to start"
    docker logs orderer.lto.gov.ph --tail 50
    exit 1
fi

if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    print_error "Peer failed to start"
    docker logs peer0.lto.gov.ph --tail 50
    exit 1
fi
print_success "Fabric network started"

# Step 7: Create and join channel
print_status "Step 7/9: Creating channel and joining peer..."

# Create channel
docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    print_error "Failed to create channel"
    exit 1
fi

# Join channel
docker exec cli peer channel join -b ltochannel.block

if [ $? -ne 0 ]; then
    print_error "Failed to join channel"
    exit 1
fi

# Verify
if docker exec cli peer channel list | grep -q "ltochannel"; then
    print_success "Channel created and peer joined"
else
    print_error "Channel join verification failed"
    exit 1
fi

# Step 8: Deploy chaincode
print_status "Step 8/9: Deploying chaincode..."

# Package chaincode
docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

# Install chaincode
docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz

# Wait for installation
sleep 10

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0:" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    print_error "Failed to get package ID"
    docker exec cli peer lifecycle chaincode queryinstalled
    exit 1
fi
print_status "Package ID: $PACKAGE_ID"

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

# Wait for approval to be processed
sleep 5

# Check commit readiness
print_status "Checking commit readiness..."
docker exec cli peer lifecycle chaincode checkcommitreadiness \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1

# Commit chaincode
docker exec cli peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Verify chaincode
sleep 5
if docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration 2>/dev/null; then
    print_success "Chaincode deployed and committed"
else
    print_error "Chaincode deployment failed"
    exit 1
fi

# Step 9: Start additional services
print_status "Step 9/9: Starting additional services (PostgreSQL, IPFS, Redis)..."
docker-compose -f docker-compose.core.yml up -d postgres ipfs redis

# Wait for services
sleep 10

print_success "Additional services started"

echo ""
echo "=========================================="
print_success "SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  ✓ Orderer: orderer.lto.gov.ph:7050"
echo "  ✓ Peer: peer0.lto.gov.ph:7051"
echo "  ✓ CouchDB: localhost:5984"
echo "  ✓ PostgreSQL: localhost:5432"
echo "  ✓ IPFS: localhost:5001 (API), localhost:8080 (Gateway)"
echo "  ✓ Redis: localhost:6379"
echo ""
echo "Next steps:"
echo "  1. Set up the wallet: node scripts/setup-fabric-wallet.js"
echo "  2. Start the application: npm start"
echo ""

