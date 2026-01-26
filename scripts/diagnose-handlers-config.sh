#!/bin/bash

# Diagnostic Script: Verify handlers configuration per official Fabric 2.5 documentation
# Based on: https://hyperledger-fabric.readthedocs.io/en/release-2.5/pluggable_endorsement_and_validation.html

set -e

echo "=========================================="
echo "Handlers Configuration Diagnostic"
echo "Based on Official Fabric 2.5 Documentation"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Checking core.yaml structure..."
if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "✗ ERROR: core.yaml not found!"
    exit 1
fi

echo "✓ core.yaml exists"

echo ""
echo "Step 2: Verifying handlers section structure (per official docs)..."
echo ""
echo "Expected structure (from official docs):"
echo "handlers:"
echo "  endorsers:"
echo "    escc:"
echo "      name: DefaultEndorsement"
echo "  validators:"
echo "    vscc:"
echo "      name: DefaultValidation"
echo ""

HANDLERS_SECTION=$(grep -A 10 "^handlers:" fabric-network/config/core.yaml || echo "")

if [ -z "$HANDLERS_SECTION" ]; then
    echo "✗ ERROR: handlers section not found!"
    exit 1
fi

echo "Actual structure in core.yaml:"
echo "$HANDLERS_SECTION"

echo ""
echo "Step 3: Checking for empty library fields (known issue)..."
if grep -A 5 "^handlers:" fabric-network/config/core.yaml | grep -q "library:"; then
    echo "⚠ WARNING: Found 'library:' field in handlers section"
    echo "For built-in handlers (DefaultEndorsement), library field should NOT exist"
    echo "Empty library fields can cause Fabric to look for plugin files"
    echo ""
    echo "Found library fields:"
    grep -A 5 "^handlers:" fabric-network/config/core.yaml | grep "library:"
else
    echo "✓ No library fields found (correct for built-in handlers)"
fi

echo ""
echo "Step 4: Verifying DefaultEndorsement name..."
if grep -q "name: DefaultEndorsement" fabric-network/config/core.yaml; then
    echo "✓ DefaultEndorsement found"
else
    echo "✗ ERROR: DefaultEndorsement not found!"
    exit 1
fi

echo ""
echo "Step 5: Checking chaincode mode..."
if grep -q "mode: dev" fabric-network/config/core.yaml; then
    echo "✓ mode: dev found"
else
    echo "⚠ WARNING: mode: dev not found"
fi

echo ""
echo "Step 6: Verifying config in container..."
if docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml 2>/dev/null; then
    echo "✓ Config file accessible in container"
    
    echo ""
    echo "Handlers section in container:"
    docker exec peer0.lto.gov.ph grep -A 10 "^handlers:" /var/hyperledger/fabric/config/core.yaml || echo "⚠ handlers section not found in container"
    
    echo ""
    echo "Checking for library fields in container:"
    if docker exec peer0.lto.gov.ph grep -A 5 "^handlers:" /var/hyperledger/fabric/config/core.yaml 2>/dev/null | grep -q "library:"; then
        echo "⚠ WARNING: Found library field in container config"
        docker exec peer0.lto.gov.ph grep -A 5 "^handlers:" /var/hyperledger/fabric/config/core.yaml | grep "library:"
    else
        echo "✓ No library fields in container config"
    fi
else
    echo "✗ ERROR: Config file not accessible in container!"
    exit 1
fi

echo ""
echo "Step 7: Checking peer logs for handler initialization..."
echo "Looking for handler-related messages in peer logs..."
HANDLER_LOGS=$(docker logs peer0.lto.gov.ph 2>&1 | grep -i "handler\|endorsement\|DefaultEndorsement" | tail -10 || echo "")
if [ -n "$HANDLER_LOGS" ]; then
    echo "Handler-related log entries:"
    echo "$HANDLER_LOGS"
else
    echo "⚠ No handler-related log entries found"
fi

echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "Based on official Fabric 2.5 documentation:"
echo "1. Handlers section structure: $(if grep -q "name: DefaultEndorsement" fabric-network/config/core.yaml; then echo "✓ Correct"; else echo "✗ Incorrect"; fi)"
echo "2. Library fields: $(if grep -A 5 "^handlers:" fabric-network/config/core.yaml | grep -q "library:"; then echo "⚠ Present (should be removed for built-in handlers)"; else echo "✓ Absent (correct)"; fi)"
echo "3. Config accessible in container: $(if docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml 2>/dev/null; then echo "✓ Yes"; else echo "✗ No"; fi)"
echo ""
echo "If library fields are present, they should be removed for built-in handlers."
echo "According to official docs, built-in handlers only need 'name', not 'library'."
