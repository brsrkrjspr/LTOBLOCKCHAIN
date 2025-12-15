#!/bin/bash
# TrustChain LTO - Instantiate Chaincode
# Instantiates vehicle-registration chaincode on channel

set -e

echo "🚀 Instantiating chaincode..."

# Check if peer is running
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "❌ Peer container is not running!"
    exit 1
fi

# Check if peer is in channel
if ! docker exec peer0.lto.gov.ph peer channel list | grep -q "ltochannel"; then
    echo "❌ Peer is not in channel 'ltochannel'!"
    echo "💡 Run: bash scripts/setup-fabric-channel.sh first"
    exit 1
fi

# Copy orderer TLS CA cert to peer container (if not already there)
docker cp fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt \
  peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt 2>/dev/null || true

# Instantiate chaincode
echo "🚀 Instantiating chaincode on channel..."
docker exec peer0.lto.gov.ph peer chaincode instantiate \
  -o orderer.lto.gov.ph:7050 \
  -C ltochannel \
  -n vehicle-registration \
  -v 1.0 \
  -c '{"Args":[]}' \
  -P "OR('LTOMSP.member')" \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt \
  --timeout 60s

if [ $? -eq 0 ]; then
    echo "✅ Chaincode instantiated successfully"
    echo ""
    echo "⏳ Waiting for chaincode to be ready (this may take 30-60 seconds)..."
    sleep 10
    
    echo ""
    echo "🎉 Chaincode instantiation complete!"
    echo ""
    echo "Next step:"
    echo "  Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
else
    echo "❌ Failed to instantiate chaincode"
    echo "💡 Check peer logs for details"
    exit 1
fi

