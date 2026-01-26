#!/bin/bash

# Complete Fix for escc Plugin Error
# This error means handlers section is missing or peer needs restart

set -e

echo "=========================================="
echo "Fixing escc Plugin Error"
echo "=========================================="
echo ""
echo "Error Explanation:"
echo "  The peer is trying to use 'escc' (Endorsement System Chaincode) plugin"
echo "  but it's not configured. The 'handlers' section in core.yaml tells Fabric"
echo "  to use built-in DefaultEndorsement instead of looking for plugin files."
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

echo "Step 1: Verifying core.yaml exists..."
if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "  ✗ core.yaml not found! Creating it..."
    bash scripts/final-fix-create-minimal-core-yaml.sh
    exit 0
fi
echo "  ✓ core.yaml exists"

echo ""
echo "Step 2: Checking for duplicate handlers sections..."
HANDLER_COUNT=$(grep -c "^handlers:" fabric-network/config/core.yaml 2>/dev/null || echo "0")
echo "  Found $HANDLER_COUNT handlers section(s)"

if [ "$HANDLER_COUNT" -gt 1 ]; then
    echo "  ⚠ Multiple handlers sections found! Cleaning up duplicates..."
    
    # Create a backup
    cp fabric-network/config/core.yaml fabric-network/config/core.yaml.backup.$(date +%Y%m%d_%H%M%S)
    echo "  ✓ Backup created"
    
    # Remove ALL handlers sections first
    awk '
    /^handlers:/ { 
        in_handlers = 1
        next
    }
    in_handlers && /^[a-z]/ {
        in_handlers = 0
    }
    !in_handlers {
        print
    }
    ' fabric-network/config/core.yaml > fabric-network/config/core.yaml.tmp
    
    # Add single handlers section before metrics
    if grep -q "^metrics:" fabric-network/config/core.yaml.tmp; then
        sed -i '/^metrics:/i\
handlers:\
  endorsers:\
    escc:\
      name: DefaultEndorsement\
  validators:\
    vscc:\
      name: DefaultValidation\
' fabric-network/config/core.yaml.tmp
    else
        # If no metrics, append at end
        cat >> fabric-network/config/core.yaml.tmp << 'EOF'

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
EOF
    fi
    
    mv fabric-network/config/core.yaml.tmp fabric-network/config/core.yaml
    echo "  ✓ Duplicate handlers removed, single handlers section added"
fi

echo ""
echo "Step 2b: Verifying handlers section..."
if grep -q "^handlers:" fabric-network/config/core.yaml && grep -q "DefaultEndorsement" fabric-network/config/core.yaml; then
    echo "  ✓ handlers section exists and is configured"
    echo "  Showing handlers:"
    grep -A 6 "^handlers:" fabric-network/config/core.yaml | head -7
else
    echo "  ✗ handlers section missing or incomplete!"
    echo "  Adding handlers section..."
    
    # Remove old handlers if exists but incomplete
    sed -i '/^handlers:/,/^[a-z]/d' fabric-network/config/core.yaml
    
    # Add handlers before metrics
    if grep -q "^metrics:" fabric-network/config/core.yaml; then
        sed -i '/^metrics:/i\
handlers:\
  endorsers:\
    escc:\
      name: DefaultEndorsement\
  validators:\
    vscc:\
      name: DefaultValidation\
' fabric-network/config/core.yaml
    else
        cat >> fabric-network/config/core.yaml << 'EOF'

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
EOF
    fi
    
    echo "  ✓ handlers section added"
fi

echo ""
echo "Step 3: Verifying handlers in core.yaml..."
grep -A 6 "^handlers:" fabric-network/config/core.yaml

echo ""
echo "Step 4: Checking if core.yaml is mounted in container..."
if docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml 2>/dev/null; then
    echo "  ✓ core.yaml is accessible in container"
    echo "  Checking handlers in container's core.yaml:"
    docker exec peer0.lto.gov.ph grep -A 6 "^handlers:" /var/hyperledger/fabric/config/core.yaml || echo "  ⚠ handlers not found in container!"
else
    echo "  ✗ core.yaml NOT accessible in container!"
    echo "  This means the volume mount is not working."
    exit 1
fi

echo ""
echo "Step 5: Performing FULL restart (stop/start) to ensure config is loaded..."
echo "  Stopping peer..."
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
echo "  Starting peer..."
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

echo ""
echo "Step 6: Waiting for peer to fully restart (30 seconds)..."
sleep 30

echo ""
echo "Step 7: Checking peer logs for configuration..."
echo "  Looking for 'mode: dev' and handlers..."
docker logs peer0.lto.gov.ph 2>&1 | grep -E "mode: dev|handlers|DefaultEndorsement" | head -5 || echo "  Not found in logs (may be in config dump)"

echo ""
echo "Step 8: Testing chaincode query..."
echo "  Executing GetAllVehicles query..."
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051

peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
" 2>&1

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "=========================================="
    echo "✅ SUCCESS! Query worked!"
    echo "=========================================="
    echo ""
    echo "The escc error is fixed. You can now proceed with integrity testing."
else
    echo "=========================================="
    echo "❌ Query still failing"
    echo "=========================================="
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check peer logs: docker logs peer0.lto.gov.ph --tail=50"
    echo "  2. Verify core.yaml: cat fabric-network/config/core.yaml | grep -A 6 handlers"
    echo "  3. Check volume mount: docker inspect peer0.lto.gov.ph | grep -A 5 fabric-network/config"
    echo "  4. Try full restart: docker-compose -f docker-compose.unified.yml down && docker-compose -f docker-compose.unified.yml up -d"
fi

echo ""
