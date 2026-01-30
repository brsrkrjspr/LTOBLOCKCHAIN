#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Fixing Chaincode Container Configuration...${NC}"

# 1. Retrieve the Package ID from the CLI container
echo "Querying installed chaincode..."
PACKAGE_ID=$(docker exec cli bash -c "peer lifecycle chaincode queryinstalled" | grep "vehicle-registration" | sed 's/.*Package ID: //;s/, Label:.*//;s/[[:space:]]*$//')

if [ -z "$PACKAGE_ID" ]; then
    echo -e "${RED}Error: Could not find installed chaincode package ID.${NC}"
    echo "Please ensure the network is up and chaincode is installed."
    exit 1
fi

echo -e "Found Package ID: ${GREEN}$PACKAGE_ID${NC}"

# 2. Restart the chaincode container with the correct ID
echo "Restarting chaincode-vehicle-reg with correct ID..."
export CHAINCODE_PACKAGE_ID=$PACKAGE_ID
docker compose -f docker-compose.unified.yml up -d --no-deps chaincode-vehicle-reg

echo -e "${GREEN}Success! Chaincode container has been patched.${NC}"
echo "Waiting 5 seconds for initialization..."
sleep 5

# 3. Verify status
docker ps --format "table {{.Names}}\t{{.Status}}" | grep chaincode
