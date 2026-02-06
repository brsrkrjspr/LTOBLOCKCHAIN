#!/bin/bash
# Add anchor peers for all three organizations to ltochannel
# This enables cross-organization peer discovery for endorsement policies

set -e

echo "=================================="
echo "Adding Anchor Peers to ltochannel"
echo "=================================="

CHANNEL_NAME="ltochannel"
ORDERER_ADDRESS="orderer.lto.gov.ph:7050"
ORDERER_TLS_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem"

# 1. Generate anchor peer update transactions for each org
echo ""
echo "Step 1: Generating anchor peer update transactions..."
echo "-----------------------------------------------------"

for ORG in LTOMSP HPGMSP InsuranceMSP; do
    echo "Generating anchor peer update for ${ORG}..."
    docker exec \
        -e FABRIC_CFG_PATH=/etc/hyperledger/fabric \
        cli configtxgen \
        -profile Channel \
        -outputAnchorPeersUpdate /opt/gopath/src/github.com/hyperledger/fabric/peer/${ORG}anchors.tx \
        -channelID ${CHANNEL_NAME} \
        -asOrg ${ORG}

    if [ $? -eq 0 ]; then
        echo "✅ ${ORG}anchors.tx generated successfully"
    else
        echo "❌ Failed to generate ${ORG}anchors.tx"
        exit 1
    fi
done

# 2. Submit anchor peer updates to the channel
echo ""
echo "Step 2: Submitting anchor peer updates to channel..."
echo "----------------------------------------------------"

# Update LTOMSP anchor peer
echo "Updating LTOMSP anchor peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=LTOMSP \
    -e CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp \
    cli peer channel update \
    -o ${ORDERER_ADDRESS} \
    -c ${CHANNEL_NAME} \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/LTOMSPanchors.tx \
    --tls --cafile ${ORDERER_TLS_CA}

if [ $? -eq 0 ]; then
    echo "✅ LTOMSP anchor peer updated successfully"
else
    echo "❌ Failed to update LTOMSP anchor peer"
    exit 1
fi

# Update HPGMSP anchor peer
echo ""
echo "Updating HPGMSP anchor peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=HPGMSP \
    -e CORE_PEER_ADDRESS=peer0.hpg.gov.ph:7051 \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/users/Admin@hpg.gov.ph/msp \
    cli peer channel update \
    -o ${ORDERER_ADDRESS} \
    -c ${CHANNEL_NAME} \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/HPGMSPanchors.tx \
    --tls --cafile ${ORDERER_TLS_CA}

if [ $? -eq 0 ]; then
    echo "✅ HPGMSP anchor peer updated successfully"
else
    echo "❌ Failed to update HPGMSP anchor peer"
    exit 1
fi

# Update InsuranceMSP anchor peer
echo ""
echo "Updating InsuranceMSP anchor peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=InsuranceMSP \
    -e CORE_PEER_ADDRESS=peer0.insurance.gov.ph:7051 \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/users/Admin@insurance.gov.ph/msp \
    cli peer channel update \
    -o ${ORDERER_ADDRESS} \
    -c ${CHANNEL_NAME} \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/InsuranceMSPanchors.tx \
    --tls --cafile ${ORDERER_TLS_CA}

if [ $? -eq 0 ]; then
    echo "✅ InsuranceMSP anchor peer updated successfully"
else
    echo "❌ Failed to update InsuranceMSP anchor peer"
    exit 1
fi

# 3. Verify anchor peers were added
echo ""
echo "Step 3: Verifying anchor peer configuration..."
echo "----------------------------------------------"
docker exec cli peer channel fetch config config_block.pb -c ${CHANNEL_NAME}
docker exec cli sh -c "configtxlator proto_decode --input config_block.pb --type common.Block | jq -r '.data.data[0].payload.data.config.channel_group.groups.Application.groups | to_entries[] | select(.value.values.AnchorPeers != null) | \"\(.key): \(.value.values.AnchorPeers.value.anchor_peers)\"'"

echo ""
echo "=================================="
echo "✅ Anchor peers added successfully!"
echo "=================================="
echo ""
echo "Next step: Restart backend container to reconnect with discovery enabled:"
echo "  docker-compose restart backend"
