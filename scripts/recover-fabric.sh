#!/bin/bash
# Recover Fabric Network Connectivity
# Fixes "REQUEST TIMEOUT" and "Endorsement has failed" by ensuring
# the Chaincode-as-a-Service (CCAAS) container has the correct Package ID.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Get Installed Package ID from Peer
log_info "Querying peer for installed chaincode package ID..."

# We use the CLI container to query peer0.lto.gov.ph
QUERY_OUTPUT=$(docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer lifecycle chaincode queryinstalled" 2>&1)

# Extract Package ID (format: "Package ID: label:hash, Label: label")
PACKAGE_ID=$(echo "$QUERY_OUTPUT" | grep "Package ID" | grep "vehicle-registration" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    log_error "Could not find installed vehicle-registration chaincode on peer."
    echo "Output: $QUERY_OUTPUT"
    echo "Make sure chaincode is installed first."
    exit 1
fi

log_success "Found installed Package ID: $PACKAGE_ID"

# 2. Check Running Chaincode Container
CC_CONTAINER="chaincode-vehicle-reg"
RUNNING_CC=$(docker ps --format '{{.Names}}' | grep "^${CC_CONTAINER}$" || true)

NEED_RESTART=false

if [ -z "$RUNNING_CC" ]; then
    log_warn "Chaincode container '$CC_CONTAINER' is NOT running."
    NEED_RESTART=true
else
    # Check if the environment variable matches
    RUNNING_ID=$(docker inspect $CC_CONTAINER --format '{{range .Config.Env}}{{if (index (split . "=") 0 | eq "CORE_CHAINCODE_ID")}}{{index (split . "=") 1}}{{end}}{{end}}')
    
    if [ "$RUNNING_ID" == "$PACKAGE_ID" ]; then
        log_success "Chaincode container is running with CORRECT ID."
        
        # Optional: Check connectivity?
        # Check if port 9999 is open?
        log_info "Chaincode configuration looks correct."
    else
        log_warn "Chaincode container is running with WRONG ID."
        echo "  Current:  ${RUNNING_ID:-<empty>}"
        echo "  Expected: $PACKAGE_ID"
        NEED_RESTART=true
    fi
fi

# 3. Restart if needed
if [ "$NEED_RESTART" = true ]; then
    log_info "Restarting chaincode container with correct ID..."
    
    # Stop and remove existing
    if [ ! -z "$RUNNING_CC" ]; then
        docker rm -f $CC_CONTAINER >/dev/null 2>&1 || true
    fi
    
    # Start new
    # We use docker compose but assume we are in the project root or can find the file
    if [ -f "docker-compose.unified.yml" ]; then
        CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f docker-compose.unified.yml up -d $CC_CONTAINER
    elif [ -f "../docker-compose.unified.yml" ]; then
        # Handle if script is run from scripts/ dir
        CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f ../docker-compose.unified.yml up -d $CC_CONTAINER
    else
        log_error "Cannot find docker-compose.unified.yml"
        exit 1
    fi
    
    # Verify restart
    sleep 5
    NEW_ID=$(docker inspect $CC_CONTAINER --format '{{range .Config.Env}}{{if (index (split . "=") 0 | eq "CORE_CHAINCODE_ID")}}{{index (split . "=") 1}}{{end}}{{end}}' || echo "")
    
    if [ "$NEW_ID" == "$PACKAGE_ID" ]; then
        log_success "Successfully restarted chaincode container with correct ID."
    else
        log_error "Failed to set correct ID. Result was: $NEW_ID"
        exit 1
    fi
else
    log_info "No changes needed."
fi

# 4. Final Diagnostics
echo ""
echo "Diagnostics:"
echo "----------------------------------------"
echo "Package ID: $PACKAGE_ID"
echo "Container:  $CC_CONTAINER"
echo "Status:     $(docker ps --filter name=$CC_CONTAINER --format '{{.Status}}')"
echo "----------------------------------------"
echo "To test manually:"
echo "docker exec cli peer chaincode query -C ltochannel -n vehicle-registration -c '{\"Args\":[\"org.hyperledger.fabric:GetMetadata\"]}'"
echo ""
