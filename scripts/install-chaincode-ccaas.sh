#!/bin/bash
# Install vehicle-registration chaincode as CCAAS (Chaincode as a Service).
# Bypasses the peer's Docker build (avoids "FROM requires either one or three arguments").
# Run on the host (same dir as docker-compose.unified.yml).

set -e

echo "=========================================="
echo "Install Chaincode (CCAAS)"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# Chaincode container name (must match connection.json and docker-compose)
CHAINCODE_SERVICE="chaincode-vehicle-reg"
CHAINCODE_PORT="9999"
LABEL="vehicle-registration_1.0"
PACKAGE_NAME="vehicle-registration-ccaas.tar.gz"
CCAAS_DIR="${ROOT}/scripts/ccaas-package"
mkdir -p "$CCAAS_DIR"

# 1. Build chaincode Docker image
echo "Step 1: Building chaincode Docker image..."
docker build -t vehicle-registration-cc:latest -f chaincode/vehicle-registration-production/Dockerfile chaincode/vehicle-registration-production || {
    echo "❌ Docker build failed"
    exit 1
}
echo "✓ Image built: vehicle-registration-cc:latest"
echo ""

# 2. Create CCAAS package (metadata.json + code.tar.gz with connection.json)
echo "Step 2: Creating CCAAS package..."
# connection.json: address must be reachable from the peer (same Docker network)
CONN_ADDRESS="${CHAINCODE_SERVICE}:${CHAINCODE_PORT}"
cat > "$CCAAS_DIR/connection.json" << EOF
{
  "address": "${CONN_ADDRESS}",
  "dial_timeout": "10s",
  "tls_required": false
}
EOF
# Peer's built-in ccaas_builder expects type "ccaas" (not "external") to avoid "Unknown chaincodeType: EXTERNAL"
cat > "$CCAAS_DIR/metadata.json" << EOF
{"path":"","type":"ccaas","label":"${LABEL}"}
EOF
(cd "$CCAAS_DIR" && tar czf code.tar.gz connection.json)
(cd "$CCAAS_DIR" && tar czf "$ROOT/$PACKAGE_NAME" metadata.json code.tar.gz)
echo "✓ Package created: $PACKAGE_NAME"
echo ""

# 3. Copy package into CLI and install on peer
echo "Step 3: Installing CCAAS package on peer..."
docker cp "$ROOT/$PACKAGE_NAME" cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/
INSTALL_OUTPUT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
cd /opt/gopath/src/github.com/hyperledger/fabric/peer
peer lifecycle chaincode install $PACKAGE_NAME 2>&1
" 2>&1)

if echo "$INSTALL_OUTPUT" | grep -qi "error\|failed"; then
    if echo "$INSTALL_OUTPUT" | grep -qi "already successfully installed"; then
        echo "✓ Package already installed"
    else
        echo "❌ Install failed:"
        echo "$INSTALL_OUTPUT" | tail -15
        exit 1
    fi
else
    echo "✓ Package installed"
fi
echo "$INSTALL_OUTPUT"
echo ""

# 4. Get package ID
echo "Step 4: Getting package ID..."
QUERY_OUTPUT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled 2>&1
" 2>&1)
# Parse "Package ID: vehicle-registration_1.0:abc123..., Label: vehicle-registration_1.0"
PACKAGE_ID=$(echo "$QUERY_OUTPUT" | grep "Package ID" | grep "vehicle-registration" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')
if [ -z "$PACKAGE_ID" ]; then
    echo "⚠ Could not parse package ID. Query output:"
    echo "$QUERY_OUTPUT"
    echo ""
    echo "Start the chaincode container manually after getting PACKAGE_ID from: docker exec cli peer lifecycle chaincode queryinstalled"
else
    echo "✓ Package ID: $PACKAGE_ID"
fi
echo ""

# 5. Start chaincode container with package ID (so peer can connect)
echo "Step 5: Starting chaincode container..."
if [ -n "$PACKAGE_ID" ]; then
    CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker compose -f docker-compose.unified.yml up -d "$CHAINCODE_SERVICE" 2>&1 && echo "✓ Chaincode container started" || echo "⚠ Start manually: CHAINCODE_PACKAGE_ID=$PACKAGE_ID docker compose -f docker-compose.unified.yml up -d $CHAINCODE_SERVICE"
else
    echo "  Skipped (no package ID). Install succeeded; get package ID from queryinstalled and run:"
    echo "  CHAINCODE_PACKAGE_ID=<id> docker compose -f docker-compose.unified.yml up -d $CHAINCODE_SERVICE"
fi
echo ""
echo "=========================================="
echo "✅ CCAAS install complete"
echo "=========================================="
echo "Next: approve and commit the chaincode definition (see complete-fix-restore-working-state.sh or Fabric lifecycle docs)."
