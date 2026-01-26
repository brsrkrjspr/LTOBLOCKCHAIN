#!/bin/bash

# Diagnostic Script: Check Why LTO Approval Fails
# This script checks all potential failure points in the approval process

set -e

echo "=========================================="
echo "LTO Approval Failure Diagnostics"
echo "=========================================="
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Step 1: Checking Fabric Connection..."
if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo -e "  ${GREEN}✓ Peer container is running${NC}"
else
    echo -e "  ${RED}✗ Peer container is NOT running${NC}"
    echo "  Start with: docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph"
    exit 1
fi

echo ""
echo "Step 2: Checking Backend Service..."
if docker ps | grep -q "lto-app.*Up"; then
    echo -e "  ${GREEN}✓ Backend container is running${NC}"
    
    # Check if backend can connect to Fabric
    echo "  Checking backend logs for Fabric connection..."
    FABRIC_CONNECTED=$(docker logs lto-app --tail=100 2>&1 | grep -i "connected to fabric\|fabric connection" | tail -1 || echo "")
    if [ -n "$FABRIC_CONNECTED" ]; then
        echo -e "  ${GREEN}✓ Backend reports Fabric connection${NC}"
        echo "    $FABRIC_CONNECTED"
    else
        echo -e "  ${YELLOW}⚠ No Fabric connection message in logs${NC}"
    fi
    
    # Check for Fabric errors
    FABRIC_ERRORS=$(docker logs lto-app --tail=200 2>&1 | grep -i "fabric.*error\|blockchain.*error\|discovery.*error" | tail -5 || echo "")
    if [ -n "$FABRIC_ERRORS" ]; then
        echo -e "  ${RED}✗ Found Fabric errors in backend logs:${NC}"
        echo "$FABRIC_ERRORS"
    fi
else
    echo -e "  ${RED}✗ Backend container is NOT running${NC}"
    exit 1
fi

echo ""
echo "Step 3: Checking Environment Variables..."
if docker exec lto-app printenv | grep -q "BLOCKCHAIN_MODE=fabric"; then
    echo -e "  ${GREEN}✓ BLOCKCHAIN_MODE is set to 'fabric'${NC}"
else
    echo -e "  ${RED}✗ BLOCKCHAIN_MODE is NOT set to 'fabric'${NC}"
    echo "  Check .env file or docker-compose.unified.yml"
fi

echo ""
echo "Step 4: Testing Fabric Connection from Backend..."
echo "  Attempting to query Fabric from backend..."
QUERY_RESULT=$(docker exec lto-app node -e "
const fabricService = require('./services/optimizedFabricService');
fabricService.initialize()
  .then(() => {
    console.log('SUCCESS: Fabric connected');
    console.log('isConnected:', fabricService.isConnected);
    console.log('mode:', fabricService.mode);
    process.exit(0);
  })
  .catch(err => {
    console.log('ERROR:', err.message);
    process.exit(1);
  });
" 2>&1 || echo "FAILED")

if echo "$QUERY_RESULT" | grep -q "SUCCESS"; then
    echo -e "  ${GREEN}✓ Fabric connection test passed${NC}"
    echo "$QUERY_RESULT" | grep -E "isConnected|mode"
else
    echo -e "  ${RED}✗ Fabric connection test failed${NC}"
    echo "$QUERY_RESULT"
fi

echo ""
echo "Step 5: Checking Peer Configuration..."
echo "  Checking for escc handlers..."
if docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml 2>/dev/null; then
    HANDLERS=$(docker exec peer0.lto.gov.ph grep -A 3 "^handlers:" /var/hyperledger/fabric/config/core.yaml 2>/dev/null || echo "")
    if echo "$HANDLERS" | grep -q "DefaultEndorsement"; then
        echo -e "  ${GREEN}✓ Handlers section configured${NC}"
    else
        echo -e "  ${RED}✗ Handlers section missing or incomplete${NC}"
        echo "  Run: bash scripts/fix-escc-error-complete.sh"
    fi
else
    echo -e "  ${RED}✗ core.yaml not found in container${NC}"
fi

echo ""
echo "Step 6: Checking Recent Approval Errors..."
echo "  Checking backend logs for approval failures..."
APPROVAL_ERRORS=$(docker logs lto-app --tail=500 2>&1 | grep -i "approval.*fail\|blockchain.*fail\|registration.*fail\|CRITICAL" | tail -10 || echo "")
if [ -n "$APPROVAL_ERRORS" ]; then
    echo -e "  ${RED}✗ Found approval errors:${NC}"
    echo "$APPROVAL_ERRORS"
else
    echo -e "  ${GREEN}✓ No recent approval errors found${NC}"
fi

echo ""
echo "Step 7: Testing Chaincode Query (from CLI)..."
echo "  Testing GetAllVehicles query..."
CLI_TEST=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 2>&1 || echo "FAILED")

if echo "$CLI_TEST" | grep -q "Error\|error\|FAILED"; then
    echo -e "  ${RED}✗ Chaincode query failed${NC}"
    echo "$CLI_TEST" | head -5
    echo ""
    echo "  This indicates Fabric is not working properly."
    echo "  Run: bash scripts/fix-escc-error-complete.sh"
else
    echo -e "  ${GREEN}✓ Chaincode query succeeded${NC}"
fi

echo ""
echo "=========================================="
echo "Common Failure Points Summary"
echo "=========================================="
echo ""
echo "1. Fabric Connection:"
echo "   - Check: docker logs lto-app | grep -i fabric"
echo "   - Fix: Ensure Fabric network is running"
echo ""
echo "2. escc/Discovery Configuration:"
echo "   - Check: docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml | grep handlers"
echo "   - Fix: bash scripts/fix-escc-error-complete.sh"
echo ""
echo "3. Transaction ID Format:"
echo "   - Issue: If transaction ID contains hyphens (UUID), validation fails"
echo "   - Check: Look for 'Invalid blockchain transaction ID format' in logs"
echo ""
echo "4. Blockchain Registration Error:"
echo "   - Check: docker logs lto-app | grep -i 'blockchain registration failed'"
echo "   - Common: 'already exists', 'unauthorized', 'connection failed'"
echo ""
echo "5. Status Transition:"
echo "   - Check: Vehicle must be in SUBMITTED status"
echo "   - Fix: Ensure vehicle status is correct before approval"
echo ""
