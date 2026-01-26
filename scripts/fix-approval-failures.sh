#!/bin/bash

# Quick Fix: LTO Approval Failures
# Addresses the most common causes of approval failures

set -e

echo "=========================================="
echo "Fixing LTO Approval Failures"
echo "=========================================="
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Step 1: Ensuring all containers are running..."
docker-compose -f docker-compose.unified.yml up -d
sleep 10

echo ""
echo "Step 2: Fixing Fabric escc configuration..."
if [ -f "scripts/fix-escc-error-complete.sh" ]; then
    bash scripts/fix-escc-error-complete.sh
else
    echo -e "  ${YELLOW}⚠ fix-escc-error-complete.sh not found${NC}"
fi

echo ""
echo "Step 3: Enabling Fabric Discovery service..."
if [ -f "scripts/fix-enable-discovery.sh" ]; then
    bash scripts/fix-enable-discovery.sh
else
    echo -e "  ${YELLOW}⚠ fix-enable-discovery.sh not found${NC}"
fi

echo ""
echo "Step 4: Restarting backend service..."
docker-compose -f docker-compose.unified.yml restart lto-app
sleep 15

echo ""
echo "Step 5: Testing Fabric connection..."
TEST_RESULT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 2>&1 || echo "FAILED")

if echo "$TEST_RESULT" | grep -q "Error\|error\|FAILED"; then
    echo -e "  ${RED}✗ Fabric query still failing${NC}"
    echo "  Error: $(echo "$TEST_RESULT" | grep -i "error" | head -1)"
    echo ""
    echo "  Manual steps:"
    echo "  1. Check peer logs: docker logs peer0.lto.gov.ph --tail=50"
    echo "  2. Check core.yaml: docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml | grep -A 6 handlers"
    echo "  3. Try full restart: docker-compose -f docker-compose.unified.yml down && docker-compose -f docker-compose.unified.yml up -d"
else
    echo -e "  ${GREEN}✓ Fabric query succeeded${NC}"
fi

echo ""
echo "Step 6: Checking backend Fabric connection..."
BACKEND_LOGS=$(docker logs lto-app --tail=50 2>&1 | grep -i "connected to fabric\|fabric.*error" | tail -3 || echo "")
if [ -n "$BACKEND_LOGS" ]; then
    echo "  Backend logs:"
    echo "$BACKEND_LOGS"
else
    echo -e "  ${YELLOW}⚠ No Fabric connection messages in recent logs${NC}"
    echo "  Check: docker logs lto-app --tail=100 | grep -i fabric"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "If approval still fails, check:"
echo "  1. Backend logs: docker logs lto-app --tail=500 | grep -i 'approval\|CRITICAL'"
echo "  2. Vehicle status: Must be 'SUBMITTED' before approval"
echo "  3. Fabric connection: Run diagnostic script"
echo ""
echo "Run diagnostic: bash scripts/diagnose-approval-failure.sh"
echo ""
