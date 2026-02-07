#!/bin/bash
# ==========================================================
# TrustChain LTO - Fabric Network Reset Script
# ==========================================================
# Regenerates crypto materials, recreates the channel, and
# reinstalls chaincode. Preserves PostgreSQL data.
#
# WHY: The crypto material in git was corrupted (mixed files
# from different cryptogen runs). This script regenerates
# everything consistently on the server.
# ==========================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()    { echo -e "${YELLOW}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ==========================================================
# PHASE 1: STOP FABRIC CONTAINERS (preserve postgres, ipfs)
# ==========================================================
log_info "Phase 1: Stopping Fabric containers..."

# Stop only Fabric-related containers, preserve data services
docker compose -f docker-compose.unified.yml stop \
    peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph \
    orderer.lto.gov.ph cli chaincode-vehicle-reg \
    ca-lto ca-hpg ca-insurance lto-app nginx 2>/dev/null || true

# Remove stopped Fabric containers so they get fresh state
docker compose -f docker-compose.unified.yml rm -f \
    peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph \
    orderer.lto.gov.ph cli chaincode-vehicle-reg \
    ca-lto ca-hpg ca-insurance 2>/dev/null || true

# Clean CouchDB
docker compose -f docker-compose.unified.yml stop couchdb 2>/dev/null || true
docker compose -f docker-compose.unified.yml rm -f couchdb 2>/dev/null || true

# Remove ALL Fabric-related Docker volumes (orderer ledger, peer ledgers, CouchDB, CAs)
# This is critical: orderer-data stores old channel config and will reject new channel creation
log_info "Removing Fabric Docker volumes..."
COMPOSE_PROJECT=$(basename "$PROJECT_ROOT" | tr '[:upper:]' '[:lower:]')
for vol in orderer-data peer-data peer-hpg-data peer-insurance-data couchdb-data ca-lto-data ca-hpg-data ca-insurance-data; do
    docker volume rm "${COMPOSE_PROJECT}_${vol}" 2>/dev/null || \
    docker volume rm "$(docker volume ls -q | grep "${vol}$")" 2>/dev/null || true
done

log_success "Fabric containers stopped and volumes cleaned"

# ==========================================================
# PHASE 2: CLEAN OLD CRYPTO & ARTIFACTS
# ==========================================================
log_info "Phase 2: Cleaning old crypto materials..."

sudo rm -rf fabric-network/crypto-config 2>/dev/null || rm -rf fabric-network/crypto-config
sudo rm -rf fabric-network/channel-artifacts 2>/dev/null || rm -rf fabric-network/channel-artifacts
rm -rf wallet 2>/dev/null || true

mkdir -p fabric-network/crypto-config
mkdir -p fabric-network/channel-artifacts
mkdir -p wallet

log_success "Old materials cleaned"

# ==========================================================
# PHASE 3: GENERATE FRESH CRYPTO
# ==========================================================
log_info "Phase 3: Generating fresh cryptographic materials..."

docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config

# Verify generation
for ORG in lto.gov.ph hpg.gov.ph insurance.gov.ph; do
    if [ ! -d "fabric-network/crypto-config/peerOrganizations/${ORG}" ]; then
        log_error "Failed to generate crypto for ${ORG}"
    fi
done

# Setup admincerts (required for Fabric interactions)
for ORG in lto hpg insurance; do
    ORG_DOMAIN="${ORG}.gov.ph"

    # User admincerts
    ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
    mkdir -p "${ADMIN_MSP}/admincerts"
    cp "${ADMIN_MSP}/signcerts/"*.pem "${ADMIN_MSP}/admincerts/" 2>/dev/null || true

    # Peer admincerts
    PEER_MSP="fabric-network/crypto-config/peerOrganizations/${ORG_DOMAIN}/peers/peer0.${ORG_DOMAIN}/msp"
    mkdir -p "${PEER_MSP}/admincerts"
    cp "${ADMIN_MSP}/signcerts/"*.pem "${PEER_MSP}/admincerts/" 2>/dev/null || true

    # Org-level admincerts
    ORG_MSP="fabric-network/crypto-config/peerOrganizations/${ORG_DOMAIN}/msp"
    mkdir -p "${ORG_MSP}/admincerts"
    cp "${ADMIN_MSP}/signcerts/"*.pem "${ORG_MSP}/admincerts/" 2>/dev/null || true
done

# Orderer admincerts
ORDERER_ADMIN="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
ORDERER_MSP="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp"
ORDERER_ORG_MSP="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/msp"
mkdir -p "${ORDERER_ADMIN}/admincerts" "${ORDERER_MSP}/admincerts" "${ORDERER_ORG_MSP}/admincerts"
cp "${ORDERER_ADMIN}/signcerts/"*.pem "${ORDERER_ADMIN}/admincerts/" 2>/dev/null || true
cp "${ORDERER_ADMIN}/signcerts/"*.pem "${ORDERER_MSP}/admincerts/" 2>/dev/null || true
cp "${ORDERER_ADMIN}/signcerts/"*.pem "${ORDERER_ORG_MSP}/admincerts/" 2>/dev/null || true

log_success "Crypto materials generated with consistent admincerts"

# ==========================================================
# PHASE 4: GENERATE CHANNEL ARTIFACTS
# ==========================================================
log_info "Phase 4: Generating channel artifacts..."

# Genesis Block
docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -v "${PROJECT_ROOT}/fabric-network/crypto-config:/config/crypto-config" \
    -u $(id -u):$(id -g) \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel -outputBlock /fabric-network/channel-artifacts/genesis.block

# Channel Tx
docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -v "${PROJECT_ROOT}/fabric-network/crypto-config:/config/crypto-config" \
    -u $(id -u):$(id -g) \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -outputCreateChannelTx /fabric-network/channel-artifacts/channel.tx -channelID ltochannel

log_success "Channel artifacts generated"

# ==========================================================
# PHASE 5: BUILD CHAINCODE IMAGE (v1.3)
# ==========================================================
log_info "Phase 5: Building Chaincode Docker image (v1.3)..."

docker build -t vehicle-registration-cc:latest ./chaincode/vehicle-registration-production/

log_success "Chaincode image built"

# ==========================================================
# PHASE 6: START CONTAINERS
# ==========================================================
log_info "Phase 6: Starting all containers..."

docker compose -f docker-compose.unified.yml up -d

log_info "Waiting for containers to initialize (25s)..."
sleep 25

# Verify critical containers
for container in orderer.lto.gov.ph peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph cli; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        log_error "$container failed to start. Check: docker logs $container"
    fi
done

log_success "All containers running"

# ==========================================================
# PHASE 7: CREATE & JOIN CHANNEL
# ==========================================================
log_info "Phase 7: Creating and joining channel 'ltochannel'..."

# Create Channel
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer channel create -o orderer.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem"

log_success "Channel created"

# Join all peers
join_channel() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    log_info "Joining $ORG (peer0.${ORG}.gov.ph:${PORT})..."
    docker exec cli bash -c "export CORE_PEER_LOCALMSPID=$MSP && \
    export CORE_PEER_TLS_ENABLED=true && \
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/peer0.${ORG}.gov.ph/tls/ca.crt && \
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp && \
    export CORE_PEER_ADDRESS=peer0.${ORG}.gov.ph:${PORT} && \
    peer channel join -b ltochannel.block"
}

join_channel "lto" "LTOMSP" "7051"
join_channel "hpg" "HPGMSP" "8051"
join_channel "insurance" "InsuranceMSP" "9051"

log_success "All peers joined channel"

# ==========================================================
# PHASE 8: ADD ANCHOR PEERS
# ==========================================================
log_info "Phase 8: Adding anchor peers..."

add_anchor_peer() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    local PEER_HOST="peer0.${ORG}.gov.ph"

    log_info "Generating anchor peer update for ${MSP}..."

    # Generate anchor peer update tx
    docker run --rm \
        -v "${PROJECT_ROOT}/config:/config" \
        -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
        -v "${PROJECT_ROOT}/fabric-network/crypto-config:/config/crypto-config" \
        -u $(id -u):$(id -g) \
        -e FABRIC_CFG_PATH=/config \
        hyperledger/fabric-tools:2.5 \
        configtxgen -profile Channel -outputAnchorPeersUpdate /fabric-network/channel-artifacts/${MSP}anchors.tx -channelID ltochannel -asOrg ${MSP%MSP}

    # Apply anchor peer update
    docker exec cli bash -c "export CORE_PEER_LOCALMSPID=${MSP} && \
    export CORE_PEER_TLS_ENABLED=true && \
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/${PEER_HOST}/tls/ca.crt && \
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp && \
    export CORE_PEER_ADDRESS=${PEER_HOST}:${PORT} && \
    peer channel update -o orderer.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${MSP}anchors.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem"
}

add_anchor_peer "lto" "LTOMSP" "7051"
add_anchor_peer "hpg" "HPGMSP" "8051"
add_anchor_peer "insurance" "InsuranceMSP" "9051"

log_success "Anchor peers added for all organizations"

# ==========================================================
# PHASE 9: INSTALL CHAINCODE (v1.3, CCAAS)
# ==========================================================
log_info "Phase 9: Installing Chaincode v1.3 (CCAAS)..."

# Build CCAAS package
CCAAS_DIR="${PROJECT_ROOT}/scripts/ccaas-package"
mkdir -p "$CCAAS_DIR"
cat > "$CCAAS_DIR/connection.json" << EOF
{ "address": "chaincode-vehicle-reg:9999", "dial_timeout": "10s", "tls_required": false }
EOF
cat > "$CCAAS_DIR/metadata.json" << EOF
{"path":"","type":"ccaas","label":"vehicle-registration_1.3"}
EOF
(cd "$CCAAS_DIR" && tar czf code.tar.gz connection.json)
(cd "$CCAAS_DIR" && tar czf "${PROJECT_ROOT}/vehicle-registration-ccaas.tar.gz" metadata.json code.tar.gz)

# Copy to CLI
docker cp "${PROJECT_ROOT}/vehicle-registration-ccaas.tar.gz" cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/

# Install on all peers
install_chaincode() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    log_info "Installing on $ORG..."
    docker exec cli bash -c "export CORE_PEER_LOCALMSPID=$MSP && \
    export CORE_PEER_TLS_ENABLED=true && \
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/peer0.${ORG}.gov.ph/tls/ca.crt && \
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp && \
    export CORE_PEER_ADDRESS=peer0.${ORG}.gov.ph:${PORT} && \
    peer lifecycle chaincode install vehicle-registration-ccaas.tar.gz"
}

install_chaincode "lto" "LTOMSP" "7051"
install_chaincode "hpg" "HPGMSP" "8051"
install_chaincode "insurance" "InsuranceMSP" "9051"

log_success "Chaincode installed on all peers"

# Get Package ID
PACKAGE_ID=$(docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer lifecycle chaincode queryinstalled" | grep "vehicle-registration_1.3" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    log_error "Failed to retrieve Package ID"
fi
log_success "Package ID: $PACKAGE_ID"

# Restart chaincode container with new package ID
log_info "Starting chaincode container..."
docker compose -f docker-compose.unified.yml stop chaincode-vehicle-reg 2>/dev/null || true
docker compose -f docker-compose.unified.yml rm -f chaincode-vehicle-reg 2>/dev/null || true
CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f docker-compose.unified.yml up -d chaincode-vehicle-reg
sleep 5

# ==========================================================
# PHASE 10: APPROVE & COMMIT CHAINCODE
# ==========================================================
log_info "Phase 10: Approving and committing chaincode..."

ENDORSEMENT_POLICY="AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))"

approve_org() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    log_info "Approving for $ORG..."
    docker exec cli bash -c "export CORE_PEER_LOCALMSPID=$MSP && \
    export CORE_PEER_TLS_ENABLED=true && \
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/peer0.${ORG}.gov.ph/tls/ca.crt && \
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp && \
    export CORE_PEER_ADDRESS=peer0.${ORG}.gov.ph:${PORT} && \
    peer lifecycle chaincode approveformyorg -o orderer.lto.gov.ph:7050 --ordererTLSHostnameOverride orderer.lto.gov.ph --channelID ltochannel --name vehicle-registration --version 1.3 --package-id $PACKAGE_ID --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem --signature-policy \"${ENDORSEMENT_POLICY}\""
}

approve_org "lto" "LTOMSP" "7051"
approve_org "hpg" "HPGMSP" "8051"
approve_org "insurance" "InsuranceMSP" "9051"

log_info "Committing chaincode..."
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer lifecycle chaincode commit -o orderer.lto.gov.ph:7050 --ordererTLSHostnameOverride orderer.lto.gov.ph --channelID ltochannel --name vehicle-registration --version 1.3 --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem --signature-policy \"${ENDORSEMENT_POLICY}\" --peerAddresses peer0.lto.gov.ph:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt --peerAddresses peer0.hpg.gov.ph:8051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt --peerAddresses peer0.insurance.gov.ph:9051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt"

log_success "Chaincode v1.3 committed"

# ==========================================================
# PHASE 11: SETUP WALLET & RESTART BACKEND
# ==========================================================
log_info "Phase 11: Setting up wallet and restarting backend..."

cp config/network-config.json network-config.json 2>/dev/null || true
node scripts/setup-fabric-wallet.js

log_info "Rebuilding and restarting backend..."
docker compose -f docker-compose.unified.yml up -d --build lto-app

log_info "Waiting for backend to initialize (20s)..."
sleep 20

log_success "Backend restarted"

# ==========================================================
# VERIFICATION
# ==========================================================
log_info "Verifying deployment..."

echo ""
echo "Checking peer0.lto.gov.ph..."
docker logs peer0.lto.gov.ph --tail 3 2>&1 | tail -1

echo ""
echo "Checking lto-app..."
docker logs lto-app --tail 5 2>&1 | tail -3

echo ""
echo "======================================================"
echo -e "${GREEN}  FABRIC NETWORK RESET COMPLETE${NC}"
echo "======================================================"
echo ""
echo "  Channel:     ltochannel"
echo "  Chaincode:   vehicle-registration v1.3 (sequence 1)"
echo "  Policy:      AND(LTOMSP.peer, OR(HPGMSP.peer, InsuranceMSP.peer))"
echo "  Anchor Peers: All 3 organizations"
echo ""
echo "  NOTE: Blockchain ledger has been reset (fresh channel)."
echo "  PostgreSQL data is preserved."
echo ""
