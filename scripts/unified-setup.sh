#!/bin/bash
# TrustChain LTO - Unified Setup Script
# Single script to set up everything from scratch for 3 Orgs + CCAAS Chaincode

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
echo "  TrustChain LTO - Unified Setup (Multi-Org + CCAAS)"
echo "======================================================"
echo ""

# ============================================
# PHASE 1: CLEANUP
# ============================================
log_info "Phase 1: Cleaning up..."

docker compose -f docker-compose.unified.yml down --volumes --remove-orphans 2>/dev/null || true

# Force cleanup of crypto-config if it exists to ensure fresh keys
if [ "${FORCE_CLEANUP:-true}" = "true" ]; then
    log_info "Removing existing crypto materials..."
    sudo rm -rf fabric-network/crypto-config 2>/dev/null || rm -rf fabric-network/crypto-config
    sudo rm -rf fabric-network/channel-artifacts 2>/dev/null || rm -rf fabric-network/channel-artifacts
    rm -rf wallet 2>/dev/null || true
fi

mkdir -p fabric-network/crypto-config
mkdir -p fabric-network/channel-artifacts
mkdir -p wallet

log_success "Cleanup complete"

# ============================================
# PHASE 2: GENERATE CRYPTO MATERIALS
# ============================================
log_info "Phase 2: Generating cryptographic materials..."

# Run cryptogen
docker run --rm \
    -v "${PROJECT_ROOT}/config:/config" \
    -v "${PROJECT_ROOT}/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config

# Verify generation
if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph" ] || \
   [ ! -d "fabric-network/crypto-config/peerOrganizations/hpg.gov.ph" ] || \
   [ ! -d "fabric-network/crypto-config/peerOrganizations/insurance.gov.ph" ]; then
    log_error "Failed to generate crypto materials for all organizations"
    exit 1
fi

# Setup admincerts for NodeOUs (required for some Fabric interactions)
for ORG in lto hpg insurance; do
    ORG_DOMAIN="${ORG}.gov.ph"
    ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
    mkdir -p "${ADMIN_MSP}/admincerts"
    cp "${ADMIN_MSP}/signcerts/"*.pem "${ADMIN_MSP}/admincerts/" 2>/dev/null || true
done

log_success "Crypto materials generated"

# ============================================
# PHASE 3: GENERATE CHANNEL ARTIFACTS
# ============================================
log_info "Phase 3: Generating channel artifacts..."

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

# ============================================
# PHASE 4: START CONTAINERS
# ============================================
log_info "Phase 4: Starting containers..."

docker compose -f docker-compose.unified.yml up -d

log_info "Waiting for containers to initialize (20s)..."
sleep 20

# Check critical containers
for container in orderer.lto.gov.ph peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph cli; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        log_error "$container failed to start"
        exit 1
    fi
done

log_success "Containers running"

# ============================================
# PHASE 5: CREATE & JOIN CHANNEL
# ============================================
log_info "Phase 5: Creating and joining channel 'ltochannel'..."

# Create Channel (by LTO)
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer channel create -o orderer.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem"

log_success "Channel created"

# Join Helper Function
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

# ============================================
# PHASE 6: INSTALL CHAINCODE (CCAAS)
# ============================================
log_info "Phase 6: Installing Chaincode (CCAAS)..."

# 1. Build Package (Once)
# We assume vehicle-registration-ccaas.tar.gz exists or we create it
# Simplified: We'll construct it here to be safe
CCAAS_DIR="${PROJECT_ROOT}/scripts/ccaas-package"
mkdir -p "$CCAAS_DIR"
cat > "$CCAAS_DIR/connection.json" << EOF
{ "address": "chaincode-vehicle-reg:9999", "dial_timeout": "10s", "tls_required": false }
EOF
cat > "$CCAAS_DIR/metadata.json" << EOF
{"path":"","type":"ccaas","label":"vehicle-registration_1.0"}
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
peer lifecycle chaincode queryinstalled" | grep "vehicle-registration_1.0" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    log_error "Failed to retrieve Package ID"
    exit 1
fi
log_success "Package ID: $PACKAGE_ID"

# Start Chaincode Container
log_info "Starting Chaincode Container..."
CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f docker-compose.unified.yml up -d chaincode-vehicle-reg

# ============================================
# PHASE 7: APPROVE & COMMIT
# ============================================
log_info "Phase 7: Approving and Committing Chaincode..."

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
    peer lifecycle chaincode approveformyorg -o orderer.lto.gov.ph:7050 --ordererTLSHostnameOverride orderer.lto.gov.ph --channelID ltochannel --name vehicle-registration --version 1.0 --package-id $PACKAGE_ID --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem --signature-policy \"AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))\""
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
peer lifecycle chaincode commit -o orderer.lto.gov.ph:7050 --ordererTLSHostnameOverride orderer.lto.gov.ph --channelID ltochannel --name vehicle-registration --version 1.0 --sequence 1 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem --signature-policy \"AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))\" --peerAddresses peer0.lto.gov.ph:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt --peerAddresses peer0.hpg.gov.ph:8051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt --peerAddresses peer0.insurance.gov.ph:9051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt"

log_success "Chaincode committed"

# ============================================
# PHASE 8: SETUP WALLET
# ============================================
log_info "Phase 8: Setting up wallet..."

cp config/network-config.json network-config.json || true
node scripts/setup-fabric-wallet.js

log_success "Wallet setup complete"

echo ""
echo "======================================================"
echo -e "${GREEN}  SETUP COMPLETE!${NC}"
echo "======================================================"
