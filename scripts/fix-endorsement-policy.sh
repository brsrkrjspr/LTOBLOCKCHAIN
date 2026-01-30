#!/bin/bash
# Re-commit chaincode with simpler endorsement policy
# This fixes the "failed constructing descriptor" error

set -e

echo "========================================================"
echo "  Re-committing Chaincode with Simpler Endorsement Policy"
echo "========================================================"
echo ""

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN

# Get current package ID
echo "[INFO] Getting installed chaincode package ID..."
PACKAGE_ID=$(docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer lifecycle chaincode queryinstalled" | grep "vehicle-registration_1.0" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    echo "[ERROR] Failed to get Package ID. Is chaincode installed?"
    exit 1
fi

echo "[OK] Package ID: $PACKAGE_ID"

# Get current sequence number
echo "[INFO] Detecting current sequence number..."
CURRENT_SEQUENCE=$(docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer lifecycle chaincode querycommitted -C ltochannel --name vehicle-registration" | grep "Sequence:" | sed 's/.*Sequence: //;s/,.*//')

if [ -z "$CURRENT_SEQUENCE" ]; then
    echo "[WARN] Could not detect sequence. Defaulting to 2."
    SEQUENCE=2
else
    SEQUENCE=$((CURRENT_SEQUENCE + 1))
fi

echo "[INFO] Using sequence: $SEQUENCE (Previous: ${CURRENT_SEQUENCE:-None})"

# Function to approve for an org
approve_org() {
    local ORG=$1
    local MSP=$2
    local PORT=$3
    echo "[INFO] Approving for $ORG..."
    docker exec cli bash -c "export CORE_PEER_LOCALMSPID=$MSP && \
    export CORE_PEER_TLS_ENABLED=true && \
    export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/peers/peer0.${ORG}.gov.ph/tls/ca.crt && \
    export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG}.gov.ph/users/Admin@${ORG}.gov.ph/msp && \
    export CORE_PEER_ADDRESS=peer0.${ORG}.gov.ph:${PORT} && \
    peer lifecycle chaincode approveformyorg -o orderer.lto.gov.ph:7050 \
        --ordererTLSHostnameOverride orderer.lto.gov.ph \
        --channelID ltochannel \
        --name vehicle-registration \
        --version 1.0 \
        --package-id $PACKAGE_ID \
        --sequence $SEQUENCE \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
        --signature-policy \"OR('LTOMSP.peer', 'HPGMSP.peer', 'InsuranceMSP.peer')\""
}

echo ""
echo "[INFO] Approving with new policy: OR('LTOMSP.peer', 'HPGMSP.peer', 'InsuranceMSP.peer')"
echo "       This allows ANY single org to endorse (simpler than AND)"
echo ""

approve_org "lto" "LTOMSP" "7051"
approve_org "hpg" "HPGMSP" "8051"
approve_org "insurance" "InsuranceMSP" "9051"

echo ""
echo "[INFO] Committing chaincode with new policy..."
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP && \
export CORE_PEER_TLS_ENABLED=true && \
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt && \
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp && \
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 && \
peer lifecycle chaincode commit -o orderer.lto.gov.ph:7050 \
    --ordererTLSHostnameOverride orderer.lto.gov.ph \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence $SEQUENCE \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem \
    --signature-policy \"OR('LTOMSP.peer', 'HPGMSP.peer', 'InsuranceMSP.peer')\" \
    --peerAddresses peer0.lto.gov.ph:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    --peerAddresses peer0.hpg.gov.ph:8051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt \
    --peerAddresses peer0.insurance.gov.ph:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt"

echo ""
echo "[OK] Chaincode re-committed with OR policy!"
echo ""
echo "[INFO] Verifying..."
docker exec cli peer lifecycle chaincode querycommitted -C ltochannel --name vehicle-registration

echo ""
echo "========================================================"
echo "  COMPLETE! Now restart the app:"
echo "  docker compose -f docker-compose.unified.yml restart lto-app"
echo "========================================================"
