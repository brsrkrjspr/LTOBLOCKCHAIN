#!/bin/bash

# Fix Chaincode Definition: Re-commit with built-in handlers
# Root Cause: Chaincode was committed with default plugin names (escc/vscc) 
# which override core.yaml handlers configuration
# Solution: Re-commit with empty plugin strings to use built-in handlers

# Don't use set -e - we need to handle errors manually
set +e

echo "=========================================="
echo "Fix Chaincode Definition: Use Built-in Handlers"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Helper function to run docker exec with timeout
run_docker_exec() {
    local cmd="$1"
    local timeout="${2:-30}"
    timeout $timeout docker exec cli bash -c "$cmd" 2>&1
}

# Helper function to check container status
check_container() {
    local container="$1"
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        return 0
    fi
    return 1
}

# Helper function to wait for container with retries
wait_for_container() {
    local container="$1"
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if check_container "$container"; then
            return 0
        fi
        echo "  Waiting for $container... (attempt $attempt/$max_attempts)"
        sleep 3
        attempt=$((attempt + 1))
    done
    return 1
}

# Helper function to wait for peer to be ready (check for actual log message)
wait_for_peer_ready() {
    echo "  Waiting for peer to be ready (checking logs for 'Deployed system chaincodes')..."
    local timeout=120
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if docker logs peer0.lto.gov.ph --tail=50 2>&1 | grep -q "Deployed system chaincodes"; then
            echo "  ✓ Peer is ready! (found 'Deployed system chaincodes' message)"
            return 0
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        if [ $((elapsed % 15)) -eq 0 ]; then
            echo "  Still waiting... (${elapsed}s elapsed)"
        fi
    done
    
    echo "  ⚠ Peer did not show 'Deployed system chaincodes' within ${timeout} seconds"
    echo "  Proceeding anyway, but peer may not be fully ready..."
    return 1
}

# Helper function to check if file exists in CLI container
check_file_in_container() {
    local file_path="$1"
    docker exec cli test -f "$file_path" 2>/dev/null
    return $?
}

echo ""
echo "Step 0: Pre-flight checks..."

# Check if orderer CA certificate exists
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem"
if ! check_file_in_container "$ORDERER_CA"; then
    echo "❌ Orderer CA certificate not found at: $ORDERER_CA"
    echo "   Please verify crypto-config is properly mounted in CLI container"
    exit 1
fi
echo "✓ Orderer CA certificate found"

# Check and fix core.yaml chaincode mode (CRITICAL: must be 'dev' for _lifecycle to work)
echo ""
echo "Step 0.1: Checking core.yaml chaincode mode..."
CORE_YAML="fabric-network/config/core.yaml"
NEED_PEER_RESTART=false

if [ -f "$CORE_YAML" ]; then
    # Check current mode
    CURRENT_MODE=$(grep -E "^[[:space:]]*mode:[[:space:]]*" "$CORE_YAML" | head -1 | grep -oE "(net|dev)" || echo "")
    
    if [ "$CURRENT_MODE" = "net" ]; then
        echo "⚠ WARNING: core.yaml has mode: net (will cause _lifecycle.syscc errors)"
        echo "  Fixing to mode: dev..."
        sed -i 's/^[[:space:]]*mode:[[:space:]]*net/mode: dev/' "$CORE_YAML"
        
        # Verify change
        if grep -q "mode: dev" "$CORE_YAML"; then
            echo "✓ Updated core.yaml to mode: dev"
            NEED_PEER_RESTART=true
        else
            echo "❌ Failed to update core.yaml mode"
            exit 1
        fi
    elif [ "$CURRENT_MODE" = "dev" ]; then
        echo "✓ core.yaml already has mode: dev (correct)"
    else
        echo "⚠ WARNING: Could not determine chaincode mode in core.yaml"
        echo "  Adding mode: dev if missing..."
        # Check if chaincode section exists
        if grep -q "^chaincode:" "$CORE_YAML"; then
            # Add mode: dev after chaincode: line
            sed -i '/^chaincode:/a\  mode: dev' "$CORE_YAML"
            echo "✓ Added mode: dev to core.yaml"
            NEED_PEER_RESTART=true
        else
            echo "  ⚠ chaincode section not found, will be handled by peer defaults"
        fi
    fi
    
    # Ensure _lifecycle is enabled in system chaincodes
    if ! grep -q "_lifecycle: enable" "$CORE_YAML"; then
        echo "  Ensuring _lifecycle is enabled..."
        # Check if system section exists
        if grep -q "^[[:space:]]*system:" "$CORE_YAML"; then
            # Add _lifecycle if not present
            if ! grep -A 10 "^[[:space:]]*system:" "$CORE_YAML" | grep -q "_lifecycle"; then
                sed -i '/^[[:space:]]*system:/a\    _lifecycle: enable' "$CORE_YAML"
                echo "  ✓ Added _lifecycle: enable to core.yaml"
                NEED_PEER_RESTART=true
            fi
        fi
    else
        echo "✓ _lifecycle is enabled in core.yaml"
    fi
    
    # Restart peer if config was changed
    if [ "$NEED_PEER_RESTART" = true ]; then
        echo ""
        echo "  Restarting peer to apply core.yaml changes..."
        docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph
        echo "  Waiting for peer to restart (20 seconds)..."
        sleep 20
        echo "  ✓ Peer restarted"
    fi
else
    echo "⚠ WARNING: core.yaml not found at $CORE_YAML"
    echo "  Peer may use defaults, but _lifecycle may not work properly"
    echo "  Consider running: bash scripts/final-fix-create-minimal-core-yaml.sh"
fi

echo ""
echo "Step 0.5: Checking and starting containers..."
NEED_START=false

if ! check_container "cli"; then
    echo "⚠ CLI container is not running, starting it..."
    docker-compose -f docker-compose.unified.yml up -d cli
    NEED_START=true
fi

if ! check_container "peer0.lto.gov.ph"; then
    echo "⚠ Peer container is not running, starting it..."
    docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
    NEED_START=true
fi

if [ "$NEED_START" = true ]; then
    echo "Waiting for containers to be ready..."
    
    # Wait for CLI container
    if ! wait_for_container "cli"; then
        echo "❌ Failed to start CLI container after multiple attempts"
        echo "Container status:"
        docker ps -a | grep cli || echo "  CLI container not found"
        exit 1
    fi
    echo "✓ CLI container is ready"
    
    # Wait for peer container
    if ! wait_for_container "peer0.lto.gov.ph"; then
        echo "❌ Failed to start peer container after multiple attempts"
        echo "Container status:"
        docker ps -a | grep peer0.lto.gov.ph || echo "  Peer container not found"
        exit 1
    fi
    
    # Wait for peer to be actually ready (check logs)
    wait_for_peer_ready
else
    echo "✓ All required containers are already running"
    # Still check if peer is ready
    wait_for_peer_ready
fi

echo ""
echo "Step 1: Checking current chaincode definition..."

# Try JSON output first (more reliable for parsing)
CURRENT_DEF_JSON=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration --output json 2>&1
" 30)

SEQUENCE=1

# Try to parse sequence from JSON
if echo "$CURRENT_DEF_JSON" | grep -q '"sequence"'; then
    SEQUENCE=$(echo "$CURRENT_DEF_JSON" | grep -o '"sequence"[[:space:]]*:[[:space:]]*[0-9]*' | grep -oE '[0-9]+' | head -1)
    if [ -n "$SEQUENCE" ] && [[ "$SEQUENCE" =~ ^[0-9]+$ ]]; then
        echo "✓ Chaincode definition found (JSON format)"
        echo "  Found sequence: $SEQUENCE"
    else
        SEQUENCE=1
        echo "⚠ Could not parse sequence from JSON, defaulting to 1"
    fi
else
    # Fall back to text output
    echo "  JSON output not available, trying text format..."
    CURRENT_DEF=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration 2>&1
" 30)
    
    if [ $? -eq 0 ] && ! echo "$CURRENT_DEF" | grep -qi "error\|failed\|timeout\|not found"; then
        echo "✓ Chaincode definition query successful (text format)"
        # Extract sequence number from text output
        # Look for "Sequence: X" or "sequence X" patterns
        SEQUENCE=$(echo "$CURRENT_DEF" | grep -iE "sequence[[:space:]]*:?[[:space:]]*[0-9]+" | grep -oE '[0-9]+' | head -1)
        if [ -n "$SEQUENCE" ] && [[ "$SEQUENCE" =~ ^[0-9]+$ ]]; then
            echo "  Found sequence: $SEQUENCE"
        else
            SEQUENCE=1
            echo "⚠ Could not extract sequence number, defaulting to 1"
        fi
    else
        echo "⚠ Warning: Could not query chaincode definition"
        echo "  This may mean chaincode is not yet committed or _lifecycle is not working"
        echo "  Output: $(echo "$CURRENT_DEF" | head -3)"
        echo ""
        echo "  Attempting to proceed with sequence number 1..."
        SEQUENCE=1
    fi
fi

NEXT_SEQUENCE=$((SEQUENCE + 1))
echo ""
echo "Current sequence: $SEQUENCE"
echo "Next sequence: $NEXT_SEQUENCE"

echo ""
echo "Step 2: Approving chaincode definition with built-in handlers..."
APPROVE_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence $NEXT_SEQUENCE \
    --endorsement-plugin '' \
    --validation-plugin '' \
    --tls \
    --cafile $ORDERER_CA \
    2>&1
" 60)

APPROVE_EXIT=$?

# Check for specific error cases
if echo "$APPROVE_OUTPUT" | grep -qi "already approved\|already exists"; then
    echo "⚠ Chaincode definition already approved for this sequence"
    echo "  This is OK - proceeding to commit..."
elif [ $APPROVE_EXIT -ne 0 ] || echo "$APPROVE_OUTPUT" | grep -qi "error\|failed"; then
    if echo "$APPROVE_OUTPUT" | grep -qi "sequence mismatch\|sequence.*mismatch"; then
        echo "❌ Sequence mismatch error"
        echo "  The sequence number may be incorrect. Current chaincode definition:"
        echo "$CURRENT_DEF" | head -10
        echo ""
        echo "  Please check the actual sequence number and update the script"
        exit 1
    else
        echo "❌ Failed to approve chaincode"
        echo "$APPROVE_OUTPUT"
        exit 1
    fi
else
    echo "✓ Chaincode approved"
fi

echo ""
echo "Step 3: Committing chaincode definition with built-in handlers..."
COMMIT_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence $NEXT_SEQUENCE \
    --endorsement-plugin '' \
    --validation-plugin '' \
    --tls \
    --cafile $ORDERER_CA \
    --peerAddresses peer0.lto.gov.ph:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt \
    2>&1
" 60)

COMMIT_EXIT=$?
if [ $COMMIT_EXIT -ne 0 ] || echo "$COMMIT_OUTPUT" | grep -qi "error\|failed"; then
    if echo "$COMMIT_OUTPUT" | grep -qi "sequence mismatch\|sequence.*mismatch"; then
        echo "❌ Sequence mismatch error during commit"
        echo "  The sequence number may be incorrect"
        exit 1
    else
        echo "❌ Failed to commit chaincode"
        echo "$COMMIT_OUTPUT"
        exit 1
    fi
fi
echo "✓ Chaincode committed"

echo ""
echo "Step 4: Waiting for chaincode to be ready..."
sleep 5

echo ""
echo "Step 5: Testing chaincode query..."

# Verify which query method is available
# Try peer chaincode query first (deprecated but may still work)
TEST_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}' 2>&1
" 30)

# Check for escc error
if echo "$TEST_OUTPUT" | grep -qi "plugin.*escc.*wasn't found\|endorsement.*failed\|plugin.*could not be used"; then
    echo "❌ Still seeing escc error:"
    echo "$TEST_OUTPUT" | grep -i "plugin\|endorsement" | head -5
    echo ""
    echo "  The fix may not have taken effect. Please:"
    echo "  1. Verify core.yaml has handlers section configured"
    echo "  2. Restart peer container: docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph"
    echo "  3. Wait for peer to be ready and try again"
    exit 1
elif echo "$TEST_OUTPUT" | grep -qi "error\|failed"; then
    # Check if it's a chaincode-specific error (not escc)
    if echo "$TEST_OUTPUT" | grep -qi "chaincode.*not found\|chaincode.*not available"; then
        echo "⚠ Chaincode not yet available (may need more time to start)"
        echo "  This is OK - the commit was successful"
    else
        echo "⚠ Query returned an error (may be expected if no vehicles registered yet):"
        echo "$TEST_OUTPUT" | head -5
        echo ""
        echo "  If this is not a 'no vehicles' error, please check chaincode logs"
    fi
else
    echo "✓ Chaincode query successful!"
    echo "  Response preview: $(echo "$TEST_OUTPUT" | head -3)"
fi

echo ""
echo "=========================================="
echo "Fix completed successfully!"
echo "=========================================="
echo ""
echo "The chaincode definition now uses built-in handlers (DefaultEndorsement/DefaultValidation)"
echo "instead of looking for external plugins (escc/vscc)."
echo ""
echo "Summary:"
echo "  - Current sequence: $SEQUENCE"
echo "  - New sequence: $NEXT_SEQUENCE"
echo "  - Chaincode: vehicle-registration"
echo "  - Channel: ltochannel"
echo ""
echo "If you still see escc errors, ensure:"
echo "1. core.yaml has handlers section configured correctly"
echo "2. Peer has been restarted after core.yaml changes"
echo "3. Chaincode was committed with --endorsement-plugin '' and --validation-plugin ''"
echo "4. Wait for peer to show 'Deployed system chaincodes' message before querying"
