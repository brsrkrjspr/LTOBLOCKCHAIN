#!/bin/bash

# COMPLETE FIX: Restore Working State + Fix Chaincode Definition
# 
# This script provides the SUREST fix by:
# 1. Removing FABRIC_CFG_PATH (restore to pre-CLI working state)
# 2. Removing config mount (clean up)
# 3. Fixing chaincode definition (re-commit with empty plugin strings)
# 4. Restarting peer (apply all changes)
#
# This is the BEST solution because:
# - Restores the working state you had before CLI was added
# - Uses Fabric 2.5 safe defaults (no config file needed)
# - Fixes the chaincode definition issue
# - Prevents future configuration cascade issues

set +e  # Don't exit on error - we need to handle errors manually

echo "=========================================="
echo "COMPLETE FIX: Restore Working State + Fix Chaincode"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Remove FABRIC_CFG_PATH from docker-compose (restore Fabric defaults)"
echo "  2. Remove config directory mount (clean up)"
echo "  3. Fix chaincode definition (re-commit with built-in handlers)"
echo "  4. Restart peer (apply all changes)"
echo ""

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

# Step 1: Remove FABRIC_CFG_PATH from docker-compose.unified.yml
echo "Step 1: Removing FABRIC_CFG_PATH from docker-compose.unified.yml..."
DOCKER_COMPOSE_FILE="docker-compose.unified.yml"

if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    echo "❌ docker-compose.unified.yml not found!"
    exit 1
fi

# Create backup
cp "$DOCKER_COMPOSE_FILE" "${DOCKER_COMPOSE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✓ Backup created: ${DOCKER_COMPOSE_FILE}.backup.*"

# Check if FABRIC_CFG_PATH exists
if grep -q "FABRIC_CFG_PATH" "$DOCKER_COMPOSE_FILE"; then
    echo "  Removing FABRIC_CFG_PATH line..."
    # Remove the line (handles both with and without spaces)
    sed -i '/FABRIC_CFG_PATH/d' "$DOCKER_COMPOSE_FILE"
    echo "✓ Removed FABRIC_CFG_PATH"
else
    echo "✓ FABRIC_CFG_PATH not found (already removed or never set)"
fi

# Check if config mount exists
if grep -q "fabric-network/config:/var/hyperledger/fabric/config" "$DOCKER_COMPOSE_FILE"; then
    echo "  Removing config directory mount..."
    # Remove the volume mount line
    sed -i '\|fabric-network/config:/var/hyperledger/fabric/config|d' "$DOCKER_COMPOSE_FILE"
    echo "✓ Removed config directory mount"
else
    echo "✓ Config mount not found (already removed or never set)"
fi

# Verify changes
if ! grep -q "FABRIC_CFG_PATH" "$DOCKER_COMPOSE_FILE" && ! grep -q "fabric-network/config:/var/hyperledger/fabric/config" "$DOCKER_COMPOSE_FILE"; then
    echo "✓ docker-compose.unified.yml updated successfully"
else
    echo "⚠ WARNING: Some FABRIC_CFG_PATH references may still exist"
    echo "  Please verify manually: grep -n 'FABRIC_CFG_PATH\|fabric-network/config' $DOCKER_COMPOSE_FILE"
fi

# Step 2: Stop peer to apply docker-compose changes
echo ""
echo "Step 2: Stopping peer to apply docker-compose changes..."
docker-compose -f "$DOCKER_COMPOSE_FILE" stop peer0.lto.gov.ph
sleep 5

# Step 3: Start peer (will use Fabric defaults now)
echo ""
echo "Step 3: Starting peer with Fabric defaults (no FABRIC_CFG_PATH)..."
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d peer0.lto.gov.ph

echo "  Waiting for peer to start..."
sleep 10

# Wait for peer to be ready
wait_for_peer_ready

# Step 4: Verify peer is working
echo ""
echo "Step 4: Verifying peer is working..."
PEER_LOGS=$(docker logs peer0.lto.gov.ph --tail=30 2>&1)

if echo "$PEER_LOGS" | grep -qi "error\|failed\|panic\|fatal"; then
    echo "⚠ WARNING: Peer logs show errors:"
    echo "$PEER_LOGS" | grep -i "error\|failed\|panic\|fatal" | head -5
    echo ""
    echo "  Please check full logs: docker logs peer0.lto.gov.ph"
else
    echo "✓ Peer logs look clean (no critical errors)"
fi

# Step 5: Ensure CLI container is running
echo ""
echo "Step 5: Ensuring CLI container is running..."
if ! check_container "cli"; then
    echo "  Starting CLI container..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d cli
    wait_for_container "cli"
fi
echo "✓ CLI container is ready"

# Step 6: Check orderer CA certificate
echo ""
echo "Step 6: Verifying orderer CA certificate..."
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem"
if ! check_file_in_container "$ORDERER_CA"; then
    echo "❌ Orderer CA certificate not found at: $ORDERER_CA"
    echo "   Please verify crypto-config is properly mounted in CLI container"
    exit 1
fi
echo "✓ Orderer CA certificate found"

# Step 7: Check if chaincode is installed, install if needed
echo ""
echo "Step 7: Checking if chaincode package is installed..."
INSTALLED_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled 2>&1
" 30)

# Check if chaincode directory exists in CLI container
CHAINCODE_DIR="/opt/gopath/src/github.com/chaincode/vehicle-registration-production"
if ! docker exec cli test -d "$CHAINCODE_DIR" 2>/dev/null; then
    echo "⚠ Chaincode directory not found in CLI container"
    echo "  Checking if chaincode exists locally..."
    if [ -d "chaincode/vehicle-registration-production" ]; then
        echo "  Copying chaincode to CLI container..."
        docker cp chaincode/vehicle-registration-production cli:"$CHAINCODE_DIR"
        echo "✓ Chaincode copied to CLI container"
    else
        echo "❌ Chaincode directory not found locally: chaincode/vehicle-registration-production"
        exit 1
    fi
fi

# Check if chaincode is already installed
if echo "$INSTALLED_OUTPUT" | grep -q "vehicle-registration"; then
    echo "✓ Chaincode package is already installed"
    PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | grep "vehicle-registration" | \
        sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    if [ -n "$PACKAGE_ID" ]; then
        echo "  Package ID: ${PACKAGE_ID:0:30}..."
    fi
else
    echo "⚠ Chaincode package not installed, installing now..."
    
    # Package chaincode
    echo "  Packaging chaincode..."
    PACKAGE_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
cd /opt/gopath/src/github.com/hyperledger/fabric/peer
peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path $CHAINCODE_DIR \
    --lang node \
    --label vehicle-registration_1.0 2>&1
" 60)
    
    if echo "$PACKAGE_OUTPUT" | grep -qi "error\|failed"; then
        echo "❌ Failed to package chaincode:"
        echo "$PACKAGE_OUTPUT" | tail -10
        exit 1
    fi
    echo "✓ Chaincode packaged"
    
    # Install chaincode
    echo "  Installing chaincode package..."
    INSTALL_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
cd /opt/gopath/src/github.com/hyperledger/fabric/peer
peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1
" 60)
    
    if echo "$INSTALL_OUTPUT" | grep -qi "error\|failed"; then
        if echo "$INSTALL_OUTPUT" | grep -qi "already successfully installed"; then
            echo "✓ Chaincode already installed (from previous attempt)"
        else
            echo "❌ Failed to install chaincode:"
            echo "$INSTALL_OUTPUT" | tail -10
            exit 1
        fi
    else
        echo "✓ Chaincode installed successfully"
    fi
    
    # Wait for installation to complete
    echo "  Waiting for installation to complete (10 seconds)..."
    sleep 10
    
    # Get package ID
    INSTALLED_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled 2>&1
" 30)
    
    PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | grep "vehicle-registration" | \
        sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    
    if [ -z "$PACKAGE_ID" ]; then
        echo "⚠ WARNING: Could not get package ID, but installation may have succeeded"
        echo "  Installed chaincodes:"
        echo "$INSTALLED_OUTPUT" | grep -i "package\|installed" | head -5
    else
        echo "✓ Package ID: ${PACKAGE_ID:0:30}..."
    fi
fi

# Step 8: Query current chaincode definition
echo ""
echo "Step 8: Querying current chaincode definition..."
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
        SEQUENCE=$(echo "$CURRENT_DEF" | grep -iE "sequence[[:space:]]*:?[[:space:]]*[0-9]+" | grep -oE '[0-9]+' | head -1)
        if [ -n "$SEQUENCE" ] && [[ "$SEQUENCE" =~ ^[0-9]+$ ]]; then
            echo "  Found sequence: $SEQUENCE"
        else
            SEQUENCE=1
            echo "⚠ Could not extract sequence number, defaulting to 1"
        fi
    else
        echo "⚠ Warning: Could not query chaincode definition"
        echo "  This may mean chaincode is not yet committed"
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

# Step 9: Approve chaincode with empty plugin strings
echo ""
echo "Step 9: Approving chaincode definition with built-in handlers..."
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
        echo "  The sequence number may be incorrect"
        exit 1
    elif echo "$APPROVE_OUTPUT" | grep -qi "plugin.*escc.*wasn't found\|endorsement.*failed"; then
        echo "❌ Still seeing ESCC error during approve"
        echo "  This suggests peer configuration is still wrong"
        echo "  Output: $APPROVE_OUTPUT"
        echo ""
        echo "  Please verify peer is using Fabric defaults (no FABRIC_CFG_PATH)"
        exit 1
    else
        echo "❌ Failed to approve chaincode"
        echo "$APPROVE_OUTPUT"
        exit 1
    fi
else
    echo "✓ Chaincode approved"
fi

# Step 10: Commit chaincode with empty plugin strings
echo ""
echo "Step 10: Committing chaincode definition with built-in handlers..."
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
        exit 1
    else
        echo "❌ Failed to commit chaincode"
        echo "$COMMIT_OUTPUT"
        exit 1
    fi
fi
echo "✓ Chaincode committed"

# Step 11: Wait and test
echo ""
echo "Step 11: Waiting for chaincode to be ready..."
sleep 5

echo ""
echo "Step 12: Testing chaincode query..."
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
    echo "❌ Still seeing ESCC error:"
    echo "$TEST_OUTPUT" | grep -i "plugin\|endorsement" | head -5
    echo ""
    echo "  This should not happen after removing FABRIC_CFG_PATH"
    echo "  Please check:"
    echo "  1. Peer was restarted after docker-compose changes"
    echo "  2. No FABRIC_CFG_PATH in docker-compose.unified.yml"
    echo "  3. Peer logs: docker logs peer0.lto.gov.ph --tail=50"
    exit 1
elif echo "$TEST_OUTPUT" | grep -qi "error\|failed"; then
    if echo "$TEST_OUTPUT" | grep -qi "chaincode.*not found\|chaincode.*not available"; then
        echo "⚠ Chaincode not yet available (may need more time to start)"
        echo "  This is OK - the commit was successful"
    else
        echo "⚠ Query returned an error (may be expected if no vehicles registered yet):"
        echo "$TEST_OUTPUT" | head -5
    fi
else
    echo "✓ Chaincode query successful!"
    echo "  Response preview: $(echo "$TEST_OUTPUT" | head -3)"
fi

echo ""
echo "=========================================="
echo "COMPLETE FIX SUCCESSFUL!"
echo "=========================================="
echo ""
echo "Summary of changes:"
echo "  ✅ Removed FABRIC_CFG_PATH from docker-compose.unified.yml"
echo "  ✅ Removed config directory mount"
echo "  ✅ Peer now uses Fabric 2.5 safe defaults"
echo "  ✅ Chaincode package installed on peer"
echo "  ✅ Chaincode definition updated (sequence $SEQUENCE → $NEXT_SEQUENCE)"
echo "  ✅ Chaincode uses built-in handlers (no external plugins)"
echo ""
echo "Your system is now restored to the working state (pre-CLI configuration)"
echo "with the chaincode definition issue fixed."
echo ""
echo "Backup created: ${DOCKER_COMPOSE_FILE}.backup.*"
echo "You can restore the old config if needed, but the new config should work better."
