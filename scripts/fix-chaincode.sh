#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Fixing Chaincode-as-a-Service (CCAAS) Identity..."

# 1. Get the Package ID from the peer
echo "   Getting installed package ID..."
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep "vehicle-registration_1.0" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    echo -e "${RED}❌ Error: Could not find package ID for vehicle-registration_1.0${NC}"
    echo "   Ensure you have installed the chaincode first."
    exit 1
fi

echo -e "${GREEN}✅ Found Package ID: $PACKAGE_ID${NC}"

# 2. Restart the chaincode container with this ID
echo "   Restarting chaincode-vehicle-reg container with correct ID..."
export CHAINCODE_PACKAGE_ID=$PACKAGE_ID
docker compose -f docker-compose.unified.yml stop chaincode-vehicle-reg
docker compose -f docker-compose.unified.yml up -d chaincode-vehicle-reg

echo -e "${GREEN}✅ Chaincode container restarted.${NC}"
echo "   Waiting 5 seconds for initialization..."
sleep 5

# 3. Verify logs
echo "   Checking chaincode logs..."
docker logs chaincode-vehicle-reg | tail -n 5

echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}  FIX COMPLETE${NC}"
echo -e "${GREEN}===========================================${NC}"
