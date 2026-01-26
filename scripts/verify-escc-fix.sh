#!/bin/bash

# Verify escc/vscc fix and test chaincode query

echo "=========================================="
echo "Verifying escc/vscc Fix"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Checking system chaincodes in config..."
echo "System chaincodes enabled:"
grep -A 5 "^  system:" fabric-network/config/core.yaml | grep "enable"

echo ""
echo "Step 2: Verifying escc/vscc are NOT in system chaincodes..."
if grep -A 5 "^  system:" fabric-network/config/core.yaml | grep -q "escc: enable\|vscc: enable"; then
    echo "✗ ERROR: escc or vscc still enabled as system chaincodes!"
    grep -A 5 "^  system:" fabric-network/config/core.yaml | grep "escc\|vscc"
else
    echo "✓ escc and vscc are NOT enabled as system chaincodes (correct)"
fi

echo ""
echo "Step 3: Verifying handlers are still configured..."
if grep -q "name: DefaultEndorsement" fabric-network/config/core.yaml; then
    echo "✓ Handlers section exists with DefaultEndorsement"
    echo "Handlers section:"
    grep -A 6 "^handlers:" fabric-network/config/core.yaml
else
    echo "✗ ERROR: Handlers section missing!"
fi

echo ""
echo "Step 4: Checking peer logs for system chaincode deployment..."
echo "Deployed system chaincodes:"
docker logs peer0.lto.gov.ph 2>&1 | grep "DeploySysCC" | tail -10

echo ""
echo "Step 5: Checking for escc errors in recent logs..."
RECENT_ERRORS=$(docker logs peer0.lto.gov.ph 2>&1 | grep -i "escc.*wasn't found\|plugin.*escc" | tail -5 || echo "")
if [ -n "$RECENT_ERRORS" ]; then
    echo "⚠ Found recent escc errors:"
    echo "$RECENT_ERRORS"
else
    echo "✓ No recent escc errors found"
fi

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next: Test chaincode query to verify fix works"
