#!/bin/bash
# Add anchor peers for all three organizations to ltochannel
# Uses the same pattern as unified-setup.sh for safety

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo ""
echo "======================================================"
echo "  Adding Anchor Peers to ltochannel"
echo "======================================================"
echo ""

CHANNEL_NAME="ltochannel"

# ============================================
# STEP 1: Generate Anchor Peer Update Transactions
# ============================================
log_info "Step 1: Generating anchor peer update transactions..."

for ORG in LTOMSP HPGMSP InsuranceMSP; do
    log_info "Generating ${ORG}anchors.tx..."

    docker run --rm \
        -v "${PROJECT_ROOT}/config:/config" \
        -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
        -v "${PROJECT_ROOT}/fabric-network/crypto-config:/config/crypto-config" \
        -u $(id -u):$(id -g) \
        -e FABRIC_CFG_PATH=/config \
        hyperledger/fabric-tools:2.5 \
        configtxgen \
            -profile Channel \
            -outputAnchorPeersUpdate /fabric-network/channel-artifacts/${ORG}anchors.tx \
            -channelID ${CHANNEL_NAME} \
            -asOrg ${ORG}

    if [ ! -f "fabric-network/channel-artifacts/${ORG}anchors.tx" ]; then
        log_error "Failed to generate ${ORG}anchors.tx"
        exit 1
    fi

    log_success "${ORG}anchors.tx generated"
done

# ============================================
# STEP 2: Apply Anchor Peer Updates
# ============================================
log_info "Step 2: Applying anchor peer updates to channel..."

# Helper function to update anchor peers
update_anchor_peer() {
    local ORG_NAME=$1    # e.g., "lto", "hpg", "insurance"
    local MSP_ID=$2      # e.g., "LTOMSP", "HPGMSP", "InsuranceMSP"
    local PORT=$3        # e.g., "7051", "8051", "9051"

    log_info "Updating ${MSP_ID} anchor peer..."

    # Copy anchor tx to CLI container
    docker cp "fabric-network/channel-artifacts/${MSP_ID}anchors.tx" \
        cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/

    # Submit anchor peer update using admin of that org
    docker exec cli bash -c "
        export CORE_PEER_LOCALMSPID=${MSP_ID}
        export CORE_PEER_TLS_ENABLED=true
        export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_NAME}.gov.ph/peers/peer0.${ORG_NAME}.gov.ph/tls/ca.crt
        export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_NAME}.gov.ph/users/Admin@${ORG_NAME}.gov.ph/msp
        export CORE_PEER_ADDRESS=peer0.${ORG_NAME}.gov.ph:${PORT}

        peer channel update \
            -o orderer.lto.gov.ph:7050 \
            -c ${CHANNEL_NAME} \
            -f /opt/gopath/src/github.com/hyperledger/fabric/peer/${MSP_ID}anchors.tx \
            --tls \
            --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
    "

    if [ $? -eq 0 ]; then
        log_success "${MSP_ID} anchor peer updated"
    else
        log_error "Failed to update ${MSP_ID} anchor peer"
        exit 1
    fi
}

# Update anchor peers for all three orgs
update_anchor_peer "lto" "LTOMSP" "7051"
update_anchor_peer "hpg" "HPGMSP" "8051"
update_anchor_peer "insurance" "InsuranceMSP" "9051"

# ============================================
# STEP 3: Verify Anchor Peers
# ============================================
log_info "Step 3: Verifying anchor peer configuration..."

docker exec cli peer channel fetch config config_block.pb -c ${CHANNEL_NAME}

# Extract and check anchor peers
docker exec cli sh -c "
    configtxlator proto_decode --input config_block.pb --type common.Block | \
    jq -r '.data.data[0].payload.data.config.channel_group.groups.Application.groups |
    to_entries[] |
    select(.value.values.AnchorPeers != null) |
    \"\(.key): \(.value.values.AnchorPeers.value.anchor_peers)\"'
" 2>/dev/null || log_info "Verification command completed"

echo ""
log_success "✅ Anchor peers successfully added to channel!"
echo ""
echo "Next steps:"
echo "  1. Restart backend to reconnect with discovery enabled:"
echo "     docker compose -f docker-compose.unified.yml restart backend"
echo ""
echo "  2. Test vehicle registration - blockchain audit trail should now work!"
echo ""
