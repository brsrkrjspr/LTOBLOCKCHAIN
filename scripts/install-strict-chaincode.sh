#!/bin/bash
# Strict Paper Alignment - 3-Org Chaincode Installation
# Installs vehicle-registration on LTO, HPG, Insurance
# Starts the CCaaS container
# Approves and Commits definition with Endorsement Policy

set -e

echo "========================================================="
echo "   STRICT 3-ORG CHAINCODE INSTALLATION"
echo "========================================================="

# Directories
ROOT_DIR=$(pwd)
CCAAS_DIR="${ROOT_DIR}/scripts/ccaas-package"
PACKAGE_NAME="vehicle-registration-ccaas.tar.gz"
CC_LABEL="vehicle-registration_1.0"
CHAINCODE_SERVICE="chaincode-vehicle-reg"
CHAINCODE_PORT="9999"

# 1. Prepare CCaaS Package
echo "[+] Step 1: Preparing CCaaS Package..."
mkdir -p "$CCAAS_DIR"

# connection.json (Chaincode Service Address)
cat > "$CCAAS_DIR/connection.json" << EOF
{
  "address": "${CHAINCODE_SERVICE}:${CHAINCODE_PORT}",
  "dial_timeout": "10s",
  "tls_required": false
}
EOF

# metadata.json
cat > "$CCAAS_DIR/metadata.json" << EOF
{"path":"","type":"ccaas","label":"${CC_LABEL}"}
EOF

# Create tarballs
(cd "$CCAAS_DIR" && tar czf code.tar.gz connection.json)
(cd "$CCAAS_DIR" && tar czf "$ROOT_DIR/$PACKAGE_NAME" metadata.json code.tar.gz)
echo "   Package created at $ROOT_DIR/$PACKAGE_NAME"

# Copy package to CLI
docker cp "$ROOT_DIR/$PACKAGE_NAME" cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/

# Helper function to install on a peer
install_on_peer() {
    PEER_HOST=$1
    MSP_ID=$2
    ORG_DOMAIN=$3
    PORT=$4
    
    echo "--- Installing on ${MSP_ID} (${PEER_HOST}) ---"
    docker exec \
        -e CORE_PEER_ADDRESS=${PEER_HOST}:${PORT} \
        -e CORE_PEER_LOCALMSPID=${MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \
        cli peer lifecycle chaincode install $PACKAGE_NAME 
}

# 2. Install on All Peers
echo "[+] Step 2: Installing Chaincode on all Peers..."
install_on_peer "peer0.lto.gov.ph" "LTOMSP" "lto.gov.ph" "7051"
install_on_peer "peer0.hpg.gov.ph" "HPGMSP" "hpg.gov.ph" "8051"
install_on_peer "peer0.insurance.gov.ph" "InsuranceMSP" "insurance.gov.ph" "9051"

# 3. Get Package ID
echo "[+] Step 3: Getting Package ID..."
QUERY_OUTPUT=$(docker exec \
    -e CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 \
    -e CORE_PEER_LOCALMSPID=LTOMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp \
    cli peer lifecycle chaincode queryinstalled)

PACKAGE_ID=$(echo "$QUERY_OUTPUT" | grep "Package ID" | grep "vehicle-registration" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    echo "❌ Failed to get Package ID"
    echo "$QUERY_OUTPUT"
    exit 1
fi
echo "   Package ID: $PACKAGE_ID"

# 4. Start Chaincode Container
echo "[+] Step 4: Starting Chaincode Container..."
CHAINCODE_PACKAGE_ID="$PACKAGE_ID" docker-compose -f docker-compose.unified.yml up -d "$CHAINCODE_SERVICE"
sleep 5 # Wait for container

# Helper function to approve
approve_for_org() {
    PEER_HOST=$1
    MSP_ID=$2
    ORG_DOMAIN=$3
    PORT=$4
    
    echo "--- Approving for ${MSP_ID} ---"
    docker exec \
        -e CORE_PEER_ADDRESS=${PEER_HOST}:${PORT} \
        -e CORE_PEER_LOCALMSPID=${MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \
        cli peer lifecycle chaincode approveformyorg \
        -o orderer.lto.gov.ph:7050 \
        --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
        --channelID ltochannel \
        --name vehicle-registration \
        --version 1.0 \
        --package-id $PACKAGE_ID \
        --sequence 1 \
        --signature-policy "AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))"
}

# 5. Approve for All Orgs
echo "[+] Step 5: Approving Chaincode Definition..."
approve_for_org "peer0.lto.gov.ph" "LTOMSP" "lto.gov.ph" "7051"
approve_for_org "peer0.hpg.gov.ph" "HPGMSP" "hpg.gov.ph" "8051"
approve_for_org "peer0.insurance.gov.ph" "InsuranceMSP" "insurance.gov.ph" "9051"

# 6. Check Commit Readiness (Optional check, skipping for speed)

# 7. Commit Definition
echo "[+] Step 7: Committing Chaincode Definition..."
docker exec \
    -e CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 \
    -e CORE_PEER_LOCALMSPID=LTOMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp \
    cli peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --signature-policy "AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))" \
    --peerAddresses peer0.lto.gov.ph:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    --peerAddresses peer0.hpg.gov.ph:8051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt \
    --peerAddresses peer0.insurance.gov.ph:9051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt

echo "========================================================="
echo "   CHAINCODE INSTALLATION COMPLETE"
echo "========================================================="
