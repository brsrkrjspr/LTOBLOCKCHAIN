#!/bin/bash
# Strict Paper Alignment - 3-Org Consortium Setup Script
# Organizations: LTO, HPG, Insurance
# Usage: ./scripts/setup-strict-network.sh

set -e

# Directory checks
ROOT_DIR=$(pwd)
CONFIG_DIR="${ROOT_DIR}/config"
FABRIC_NETWORK_DIR="${ROOT_DIR}/fabric-network"
CRYPTO_CONFIG_DIR="${FABRIC_NETWORK_DIR}/crypto-config"
CHANNEL_ARTIFACTS_DIR="${FABRIC_NETWORK_DIR}/channel-artifacts"

echo "========================================================="
echo "   STRICT PAPER ALIGNMENT: 3-ORG CONSORTIUM SETUP"
echo "========================================================="
echo "Organizations: LTO, HPG, Insurance"
echo "Network:       TrustChain LTO"
echo "========================================================="

# 1. Clean previous artifacts
echo "[-] Cleaning up previous artifacts..."
docker-compose -f docker-compose.unified.yml down --volumes --remove-orphans
sudo rm -rf "${CRYPTO_CONFIG_DIR}"
sudo rm -rf "${CHANNEL_ARTIFACTS_DIR}"
mkdir -p "${CRYPTO_CONFIG_DIR}"
mkdir -p "${CHANNEL_ARTIFACTS_DIR}"

# 2. Generate Crypto Material (using dockerized cryptogen)
echo "[+] Generating crypto material for LTO, HPG, Insurance..."
docker run --rm -v "${ROOT_DIR}:/data" hyperledger/fabric-tools:2.5 cryptogen generate --config=/data/config/crypto-config.yaml --output=/data/fabric-network/crypto-config

# 3. Generate Genesis Block
echo "[+] Generating Genesis Block..."
docker run --rm -v "${ROOT_DIR}:/data" -e FABRIC_CFG_PATH=/data/config hyperledger/fabric-tools:2.5 configtxgen -profile Genesis -outputBlock /data/fabric-network/channel-artifacts/genesis.block -channelID system-channel

# 4. Generate Channel Transaction
echo "[+] Generating Channel Transaction (ltochannel)..."
docker run --rm -v "${ROOT_DIR}:/data" -e FABRIC_CFG_PATH=/data/config hyperledger/fabric-tools:2.5 configtxgen -profile Channel -outputCreateChannelTx /data/fabric-network/channel-artifacts/ltochannel.tx -channelID ltochannel

# 5. Generate Anchor Peer Transactions
for org in LTO HPG Insurance; do
    echo "[+] Generating Anchor Peer Update for ${org}..."
    docker run --rm -v "${ROOT_DIR}:/data" -e FABRIC_CFG_PATH=/data/config hyperledger/fabric-tools:2.5 configtxgen -profile Channel -outputAnchorPeersUpdate /data/fabric-network/channel-artifacts/${org}MSPanchors.tx -channelID ltochannel -asOrg ${org}MSP
done

# 6. Start the Network
echo "[+] Starting Network (3 Peers, Orderer, CAs, DB, IPFS)..."
docker-compose -f docker-compose.unified.yml up -d
echo "Waiting 60s for containers to stabilize..."
sleep 60

# 7. Create and Join Channel
echo "[+] Creating and Joining Channel..."

# LTO creates channel
docker exec cli peer channel create -o orderer.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.block --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Define helper to join channel
join_channel() {
    PEER_HOST=$1
    MSP_ID=$2
    ORG_DOMAIN=$3
    PORT=$4
    
    echo "--- Joining ${MSP_ID} (${PEER_HOST}) to ltochannel ---"
    docker exec \
        -e CORE_PEER_ADDRESS=${PEER_HOST}:${PORT} \
        -e CORE_PEER_LOCALMSPID=${MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \
        cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.block
}

join_channel "peer0.lto.gov.ph" "LTOMSP" "lto.gov.ph" "7051"
join_channel "peer0.hpg.gov.ph" "HPGMSP" "hpg.gov.ph" "8051"
join_channel "peer0.insurance.gov.ph" "InsuranceMSP" "insurance.gov.ph" "9051"

# 8. Update Anchor Peers
update_anchor_peers() {
    PEER_HOST=$1
    MSP_ID=$2
    ORG_DOMAIN=$3
    PORT=$4
    
    echo "--- Updating Anchor Peers for ${MSP_ID} ---"
    docker exec \
        -e CORE_PEER_ADDRESS=${PEER_HOST}:${PORT} \
        -e CORE_PEER_LOCALMSPID=${MSP_ID} \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/peers/${PEER_HOST}/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \
        cli peer channel update -o orderer.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${2}anchors.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
}

update_anchor_peers "peer0.lto.gov.ph" "LTOMSP" "lto.gov.ph" "7051"
update_anchor_peers "peer0.hpg.gov.ph" "HPGMSP" "hpg.gov.ph" "8051"
update_anchor_peers "peer0.insurance.gov.ph" "InsuranceMSP" "insurance.gov.ph" "9051"

echo "========================================================="
echo "   SETUP COMPLETE"
echo "========================================================="
