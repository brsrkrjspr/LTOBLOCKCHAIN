#!/bin/bash
# Fix channel configuration to include orderer endpoints
# This recreates the channel with proper orderer configuration

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
echo "  Fix Channel Orderer Configuration"
echo "======================================================"
echo ""

# Step 1: Regenerate channel transaction with fixed config
log_info "Step 1: Regenerating channel transaction with orderer config..."

# Copy configtx.yaml to fabric-network
cp config/configtx.yaml fabric-network/configtx.yaml

# Generate new channel transaction
docker run --rm \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    -e FABRIC_CFG_PATH=/fabric-network \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -outputCreateChannelTx /fabric-network/channel-artifacts/channel.tx -channelID ltochannel

if [ ! -f "fabric-network/channel-artifacts/channel.tx" ]; then
    log_error "Failed to regenerate channel transaction"
    exit 1
fi
log_success "Channel transaction regenerated"

# Step 2: Stop all containers
log_info "Step 2: Stopping all containers..."
docker-compose -f docker-compose.unified.yml down

# Step 3: Remove volumes to delete channel data
log_info "Step 3: Removing volumes to delete channel data..."
docker volume rm ltoblockchain_peer-data ltoblockchain_orderer-data 2>/dev/null || log_warn "Some volumes may not exist (this is OK)"

# Step 4: Restart all containers
log_info "Step 4: Restarting all containers..."
docker-compose -f docker-compose.unified.yml up -d

log_info "Waiting for containers to start (30 seconds)..."
sleep 30

# Verify containers are running
if ! docker ps | grep -q "orderer.lto.gov.ph"; then
    log_error "Orderer is not running!"
    exit 1
fi
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    log_error "Peer is not running!"
    exit 1
fi
log_success "All containers are running"

# Step 5: Delete old channel block if exists
log_info "Step 5: Cleaning up old channel artifacts..."
rm -f ltochannel.block 2>/dev/null || true

# Step 6: Create channel with new config
log_info "Step 6: Creating channel with proper orderer configuration..."
docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    log_error "Failed to create channel"
    exit 1
fi
log_success "Channel created"

# Step 7: Join peer to channel
log_info "Step 7: Joining peer to channel..."
docker exec cli peer channel join -b ltochannel.block

if [ $? -ne 0 ]; then
    log_error "Failed to join channel"
    exit 1
fi

# Step 8: Verify peer can discover orderer
log_info "Step 8: Verifying orderer discovery..."
sleep 10

# Check peer logs for orderer connection
if docker logs peer0.lto.gov.ph --tail 30 2>&1 | grep -q "no endpoints currently defined"; then
    log_error "Peer still cannot discover orderer endpoints"
    log_warn "This might require additional channel configuration update"
else
    log_success "Orderer discovery appears to be working"
fi

# Step 9: Check channel info
log_info "Step 9: Checking channel info..."
docker exec cli peer channel getinfo -c ltochannel

echo ""
echo "======================================================"
log_success "Channel configuration fix complete!"
echo "======================================================"
echo ""
echo "Next steps:"
echo "  1. Redeploy chaincode (package, install, approve, commit)"
echo "  2. Setup wallet: node scripts/setup-fabric-wallet.js"
echo "  3. Start application: npm start"
echo ""

