#!/bin/bash
# Upgrade chaincode to allow LTOMSP to write all verification types
# Follows unified-setup.sh pattern for compatibility

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
echo "  Upgrading Chaincode - Authorization Fix"
echo "======================================================"
echo ""

NEW_VERSION="1.3"
NEW_SEQUENCE="2"
CHAINCODE_NAME="vehicle-registration"

# ============================================
# PHASE 1: BUILD NEW CHAINCODE IMAGE
# ============================================
log_info "Phase 1: Building new chaincode Docker image..."

docker build -t vehicle-registration-cc:latest ./chaincode/vehicle-registration-production/

log_success "Chaincode image built (version ${NEW_VERSION})"

# ============================================
# PHASE 2: STOP OLD CHAINCODE CONTAINER
# ============================================
log_info "Phase 2: Stopping old chaincode container..."

docker compose -f docker-compose.unified.yml stop chaincode-vehicle-reg
docker compose -f docker-compose.unified.yml rm -f chaincode-vehicle-reg

log_success "Old chaincode container stopped"

# ============================================
# PHASE 3: PACKAGE NEW CHAINCODE (CCAAS)
# ============================================
log_info "Phase 3: Packaging new chaincode..."

CCAAS_DIR="${PROJECT_ROOT}/scripts/ccaas-package"
mkdir -p "$CCAAS_DIR"

cat > "$CCAAS_DIR/connection.json" << EOF
{ "address": "chaincode-vehicle-reg:9999", "dial_timeout": "10s", "tls_required": false }
EOF

cat > "$CCAAS_DIR/metadata.json" << EOF
{"path":"","type":"ccaas","label":"${CHAINCODE_NAME}_${NEW_VERSION}"}
EOF

(cd "$CCAAS_DIR" && tar czf code.tar.gz connection.json)
(cd "$CCAAS_DIR" && tar czf "${PROJECT_ROOT}/vehicle-registration-ccaas.tar.gz" metadata.json code.tar.gz)

docker cp "${PROJECT_ROOT}/vehicle-registration-ccaas.tar.gz" cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/

log_success "Chaincode packaged"

# ============================================
# PHASE 4: INSTALL ON ALL PEERS
# ============================================
log_info "Phase 4: Installing chaincode on all peers..."

install_chaincode() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    log_info "Installing on ${ORG}..."

    docker exec cli bash -c "
        export CORE_PEER_LOCALMSPID=${MSP}
        export CORE_PEER_TLS_ENABLED=true
        export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/peer0.${ORG}.gov.ph/tls/ca.crt
        export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp
        export CORE_PEER_ADDRESS=peer0.${ORG}.gov.ph:${PORT}

        peer lifecycle chaincode install vehicle-registration-ccaas.tar.gz
    "
}

install_chaincode "lto" "LTOMSP" "7051"
install_chaincode "hpg" "HPGMSP" "8051"
install_chaincode "insurance" "InsuranceMSP" "9051"

log_success "Chaincode installed on all peers"

# ============================================
# PHASE 5: GET PACKAGE ID
# ============================================
log_info "Phase 5: Getting Package ID..."

PACKAGE_ID=$(docker exec cli bash -c "
    export CORE_PEER_LOCALMSPID=LTOMSP
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
    export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

    peer lifecycle chaincode queryinstalled
" | grep "${CHAINCODE_NAME}_${NEW_VERSION}" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    log_error "Failed to retrieve Package ID"
    exit 1
fi

log_success "Package ID: $PACKAGE_ID"

# ============================================
# PHASE 6: START NEW CHAINCODE CONTAINER
# ============================================
log_info "Phase 6: Starting new chaincode container..."

CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f docker-compose.unified.yml up -d chaincode-vehicle-reg

log_info "Waiting for chaincode to initialize (10s)..."
sleep 10

log_success "Chaincode container started"

# ============================================
# PHASE 7: APPROVE FOR ALL ORGS
# ============================================
log_info "Phase 7: Approving chaincode for all organizations..."

approve_org() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    log_info "Approving for ${ORG}..."

    docker exec cli bash -c "
        export CORE_PEER_LOCALMSPID=${MSP}
        export CORE_PEER_TLS_ENABLED=true
        export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/peer0.${ORG}.gov.ph/tls/ca.crt
        export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp
        export CORE_PEER_ADDRESS=peer0.${ORG}.gov.ph:${PORT}

        peer lifecycle chaincode approveformyorg \
            -o orderer.lto.gov.ph:7050 \
            --ordererTLSHostnameOverride orderer.lto.gov.ph \
            --channelID ltochannel \
            --name ${CHAINCODE_NAME} \
            --version ${NEW_VERSION} \
            --package-id ${PACKAGE_ID} \
            --sequence ${NEW_SEQUENCE} \
            --tls \
            --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
            --signature-policy \"AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))\"
    "
}

approve_org "lto" "LTOMSP" "7051"
approve_org "hpg" "HPGMSP" "8051"
approve_org "insurance" "InsuranceMSP" "9051"

log_success "Chaincode approved by all organizations"

# ============================================
# PHASE 8: COMMIT UPGRADE
# ============================================
log_info "Phase 8: Committing chaincode upgrade..."

docker exec cli bash -c "
    export CORE_PEER_LOCALMSPID=LTOMSP
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
    export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

    peer lifecycle chaincode commit \
        -o orderer.lto.gov.ph:7050 \
        --ordererTLSHostnameOverride orderer.lto.gov.ph \
        --channelID ltochannel \
        --name ${CHAINCODE_NAME} \
        --version ${NEW_VERSION} \
        --sequence ${NEW_SEQUENCE} \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
        --signature-policy \"AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))\" \
        --peerAddresses peer0.lto.gov.ph:7051 \
        --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
        --peerAddresses peer0.hpg.gov.ph:8051 \
        --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt \
        --peerAddresses peer0.insurance.gov.ph:9051 \
        --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt
"

log_success "Chaincode upgrade committed"

# ============================================
# PHASE 9: RESTART BACKEND
# ============================================
log_info "Phase 9: Restarting backend to reconnect..."

docker compose -f docker-compose.unified.yml restart backend

log_info "Waiting for backend to initialize (5s)..."
sleep 5

log_success "Backend restarted"

# ============================================
# VERIFICATION
# ============================================
log_info "Verifying chaincode upgrade..."

docker exec cli bash -c "
    export CORE_PEER_LOCALMSPID=LTOMSP
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
    export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

    peer lifecycle chaincode querycommitted --channelID ltochannel --name ${CHAINCODE_NAME}
"

echo ""
log_success "✅ Chaincode upgrade complete!"
echo ""
echo "Changes:"
echo "  - Version: 1.0 → ${NEW_VERSION}"
echo "  - Sequence: 1 → ${NEW_SEQUENCE}"
echo "  - Authorization: LTOMSP can now update ALL verification types"
echo ""
echo "Next step:"
echo "  Test blockchain audit trail with a new vehicle registration"
echo ""
