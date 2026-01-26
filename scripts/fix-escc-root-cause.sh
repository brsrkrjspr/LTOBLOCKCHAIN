#!/bin/bash

# Complete Fix: escc Plugin Error - Root Cause Resolution
# Ensures handlers section exists, is valid, and peer reloads it

set -e

echo "=========================================="
echo "Root Cause Fix: escc Plugin Error"
echo "=========================================="
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

# Step 1: Ensure config directory exists
echo "Step 1: Ensuring config directory exists..."
mkdir -p fabric-network/config
echo "  ✓ Config directory ready"

# Step 2: Check if core.yaml exists
echo ""
echo "Step 2: Checking core.yaml..."
if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "  ✗ core.yaml not found - creating minimal config..."
    
    cat > fabric-network/config/core.yaml << 'EOF'
chaincode:
  mode: dev

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation

discovery:
  enabled: true
  authCacheEnabled: true
  authCacheMaxSize: 1000
  authCachePurgeRetentionRatio: 0.75
  orgMembersAllowedAccess: false

metrics:
  provider: disabled
EOF
    echo "  ✓ Created minimal core.yaml"
else
    echo "  ✓ core.yaml exists"
fi

# Step 3: Remove duplicate handlers sections
echo ""
echo "Step 3: Cleaning up duplicate handlers..."
HANDLER_COUNT=$(grep -c "^handlers:" fabric-network/config/core.yaml 2>/dev/null || echo "0")
if [ "$HANDLER_COUNT" -gt 1 ]; then
    echo "  ⚠ Found $HANDLER_COUNT handlers sections - removing duplicates..."
    
    # Backup
    cp fabric-network/config/core.yaml fabric-network/config/core.yaml.backup.$(date +%Y%m%d_%H%M%S)
    
    # Remove all handlers sections
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
    
    # Add single handlers section before metrics (or at end)
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
    echo "  ✓ Duplicates removed"
fi

# Step 4: Ensure handlers section exists
echo ""
echo "Step 4: Verifying handlers section..."
if ! grep -q "^handlers:" fabric-network/config/core.yaml || ! grep -q "DefaultEndorsement" fabric-network/config/core.yaml; then
    echo "  ⚠ Handlers section missing or incomplete - adding..."
    
    # Remove old handlers if exists but incomplete
    sed -i '/^handlers:/,/^[a-z]/d' fabric-network/config/core.yaml
    
    # Add handlers before metrics (or at end)
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
    echo "  ✓ Handlers section added"
else
    echo "  ✓ Handlers section exists"
fi

# Step 5: Ensure discovery section exists
echo ""
echo "Step 5: Verifying discovery section..."
if ! grep -q "^discovery:" fabric-network/config/core.yaml || ! grep -q "enabled: true" fabric-network/config/core.yaml; then
    echo "  ⚠ Discovery section missing - adding..."
    
    # Remove old discovery if exists
    sed -i '/^discovery:/,/^[a-z]/d' fabric-network/config/core.yaml
    
    # Add discovery before metrics (or at end)
    if grep -q "^metrics:" fabric-network/config/core.yaml; then
        sed -i '/^metrics:/i\
discovery:\
  enabled: true\
  authCacheEnabled: true\
  authCacheMaxSize: 1000\
  authCachePurgeRetentionRatio: 0.75\
  orgMembersAllowedAccess: false\
' fabric-network/config/core.yaml
    else
        cat >> fabric-network/config/core.yaml << 'EOF'

discovery:
  enabled: true
  authCacheEnabled: true
  authCacheMaxSize: 1000
  authCachePurgeRetentionRatio: 0.75
  orgMembersAllowedAccess: false
EOF
    fi
    echo "  ✓ Discovery section added"
else
    echo "  ✓ Discovery section exists"
fi

# Step 6: Verify file is accessible in container
echo ""
echo "Step 6: Verifying volume mount..."
if docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml 2>/dev/null; then
    echo "  ✓ core.yaml is accessible in container"
    
    # Check handlers in container
    CONTAINER_HANDLERS=$(docker exec peer0.lto.gov.ph grep -A 6 "^handlers:" /var/hyperledger/fabric/config/core.yaml 2>/dev/null || echo "")
    if [ -n "$CONTAINER_HANDLERS" ]; then
        echo "  ✓ Handlers found in container:"
        echo "$CONTAINER_HANDLERS" | head -7
    else
        echo "  ✗ Handlers NOT found in container!"
        echo "  Volume mount may not be working correctly"
    fi
else
    echo "  ✗ core.yaml NOT accessible in container!"
    echo "  This indicates a volume mount issue"
fi

# Step 7: FULL restart (stop + start, not just restart)
echo ""
echo "Step 7: Performing FULL restart (stop + start)..."
echo "  Stopping peer..."
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
sleep 5

echo "  Starting peer..."
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

echo ""
echo "Step 8: Waiting for peer to fully start..."
echo "  Initial wait (20 seconds)..."
sleep 20

# Wait for peer to be actually ready (check for "Deployed system chaincodes")
echo "  Waiting for peer to deploy system chaincodes..."
TIMEOUT=120
ELAPSED=0
PEER_READY=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker logs peer0.lto.gov.ph --tail=50 2>&1 | grep -q "Deployed system chaincodes"; then
        echo "  ✓ Peer is ready! (found 'Deployed system chaincodes' message)"
        PEER_READY=true
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    if [ $((ELAPSED % 15)) -eq 0 ]; then
        echo "  Still waiting... (${ELAPSED}s elapsed)"
    fi
done

if [ "$PEER_READY" = "false" ]; then
    echo "  ⚠ Peer did not show 'Deployed system chaincodes' within ${TIMEOUT} seconds"
    echo "  Checking peer status..."
    docker ps --filter "name=peer0.lto.gov.ph" --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "  Recent peer logs:"
    docker logs peer0.lto.gov.ph --tail=30 2>&1 | tail -10
fi

# Step 9: Verify peer started successfully
echo ""
echo "Step 9: Verifying peer started..."
PEER_ERRORS=$(docker logs peer0.lto.gov.ph --tail=50 2>&1 | grep -i "error\|fatal\|panic" | tail -5 || echo "")
if [ -n "$PEER_ERRORS" ]; then
    echo "  ⚠ Found errors in peer logs:"
    echo "$PEER_ERRORS"
else
    echo "  ✓ No critical errors in peer logs"
fi

# Check if peer is actually running
PEER_STATUS=$(docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Status}}" 2>&1 || echo "NOT_RUNNING")
if [ "$PEER_STATUS" = "NOT_RUNNING" ] || [ -z "$PEER_STATUS" ]; then
    echo "  ✗ Peer container is NOT running!"
    echo "  Check logs: docker logs peer0.lto.gov.ph --tail=100"
    exit 1
else
    echo "  ✓ Peer container is running: $PEER_STATUS"
fi

# Additional wait for DNS registration
echo ""
echo "  Waiting additional 10 seconds for DNS registration..."
sleep 10

# Step 10: Test DNS resolution before query
echo ""
echo "Step 10: Testing DNS resolution..."
DNS_TEST=$(docker exec cli nslookup peer0.lto.gov.ph 2>&1 || echo "DNS_FAILED")
if echo "$DNS_TEST" | grep -q "can't find\|no such host\|DNS_FAILED"; then
    echo "  ⚠ DNS resolution failed - peer hostname not found"
    echo "  This might be a timing issue. Trying to get peer IP address..."
    
    # Try to get peer IP and use it instead
    PEER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' peer0.lto.gov.ph 2>/dev/null || echo "")
    if [ -n "$PEER_IP" ]; then
        echo "  Found peer IP: $PEER_IP"
        echo "  Will use IP address for query (workaround)"
        USE_IP=true
    else
        echo "  ✗ Could not get peer IP address"
        echo "  Peer container might not be fully started"
        echo ""
        echo "  Troubleshooting:"
        echo "  1. Check peer logs: docker logs peer0.lto.gov.ph --tail=100"
        echo "  2. Wait longer and try again"
        echo "  3. Restart peer: docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph"
        exit 1
    fi
else
    echo "  ✓ DNS resolution succeeded"
    USE_IP=false
fi

# Step 11: Test chaincode query
echo ""
echo "Step 11: Testing chaincode query..."
if [ "$USE_IP" = "true" ]; then
    echo "  Using IP address: $PEER_IP:7051"
    QUERY_RESULT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=$PEER_IP:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 2>&1 || echo "FAILED")
else
    QUERY_RESULT=$(docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 2>&1 || echo "FAILED")
fi

if echo "$QUERY_RESULT" | grep -q "Error.*escc\|plugin.*escc.*wasn't found"; then
    echo "  ✗ escc error still present!"
    echo "  Error: $(echo "$QUERY_RESULT" | grep -i "escc" | head -1)"
    echo ""
    echo "  Troubleshooting:"
    echo "  1. Check core.yaml in container: docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml"
    echo "  2. Check peer logs: docker logs peer0.lto.gov.ph --tail=100"
    echo "  3. Verify volume mount: docker inspect peer0.lto.gov.ph | grep -A 10 fabric-network/config"
    exit 1
elif echo "$QUERY_RESULT" | grep -q "lookup.*no such host\|DNS"; then
    echo "  ✗ DNS resolution error still present!"
    echo "  Error: $(echo "$QUERY_RESULT" | grep -i "lookup\|DNS" | head -1)"
    echo ""
    echo "  This indicates peer DNS is not registered yet."
    echo "  Troubleshooting:"
    echo "  1. Wait longer (peer might still be starting)"
    echo "  2. Check peer logs: docker logs peer0.lto.gov.ph --tail=100 | grep -i 'Deployed system chaincodes'"
    echo "  3. Restart peer: docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph"
    echo "  4. Run diagnostic: bash scripts/diagnose-peer-dns-issue.sh"
    exit 1
elif echo "$QUERY_RESULT" | grep -q "Error\|error"; then
    echo "  ⚠ Query failed with different error:"
    echo "$QUERY_RESULT" | grep -i "error" | head -3
    echo ""
    echo "  Full error output:"
    echo "$QUERY_RESULT" | tail -5
else
    echo "  ✓ Chaincode query succeeded!"
    echo "  escc plugin error is fixed"
fi

# Step 12: Restart backend to reconnect
echo ""
echo "Step 12: Restarting backend to reconnect to Fabric..."
docker-compose -f docker-compose.unified.yml restart lto-app
sleep 15

echo ""
echo "=========================================="
echo "Fix Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Try approval again from admin dashboard"
echo "  2. If it still fails, check: docker logs lto-app --tail=200 | grep -i 'approval\|blockchain\|CRITICAL'"
echo ""
