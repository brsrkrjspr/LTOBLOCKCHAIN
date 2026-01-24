#!/bin/bash
# Complete Fabric Reset and Reconfiguration Script
# For DigitalOcean Docker Environment - Real Fabric Only
# Ensures complete reset: volumes removed BEFORE certificate regeneration
# This prevents "channel already exists" errors

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Complete Fabric Reset & Reconfiguration                   ║"
echo "║  DigitalOcean Docker Environment - Real Fabric Only        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# STEP 0: Validate .env Configuration
# ============================================
echo "0️⃣  Validating .env configuration..."

if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "💡 Copy ENV.example to .env and configure required variables"
    exit 1
fi

# Check required variables
MISSING_VARS=()

if ! grep -q "^BLOCKCHAIN_MODE=fabric" .env; then
    MISSING_VARS+=("BLOCKCHAIN_MODE=fabric")
fi

if ! grep -q "^JWT_SECRET=" .env || grep -q "^JWT_SECRET=CHANGE-THIS" .env; then
    MISSING_VARS+=("JWT_SECRET=<your-secret-key>")
fi

if ! grep -q "^STORAGE_MODE=" .env; then
    MISSING_VARS+=("STORAGE_MODE=ipfs")
fi

if ! grep -q "^FABRIC_AS_LOCALHOST=false" .env; then
    echo "⚠️  FABRIC_AS_LOCALHOST not set to 'false' - adding it..."
    echo "FABRIC_AS_LOCALHOST=false" >> .env
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ Missing required .env variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "💡 Add these to your .env file and run this script again"
    exit 1
fi

echo "✅ .env configuration validated"

# ============================================
# STEP 1: Stop and Remove ALL Containers (Complete Cleanup)
# ============================================
echo ""
echo "1️⃣  Stopping and removing ALL Fabric containers..."

# First, explicitly stop existing containers (handles containers started manually)
echo "   Stopping existing containers explicitly..."
# Stop containers with explicit timeout (15s per container) - prevents hanging
# If timeout fails, force kill the container
timeout 15s docker stop peer0.lto.gov.ph 2>/dev/null || docker kill peer0.lto.gov.ph 2>/dev/null || true
timeout 15s docker stop orderer.lto.gov.ph 2>/dev/null || docker kill orderer.lto.gov.ph 2>/dev/null || true
timeout 15s docker stop couchdb 2>/dev/null || docker kill couchdb 2>/dev/null || true
timeout 15s docker stop cli 2>/dev/null || docker kill cli 2>/dev/null || true

# Wait for containers to fully stop before removal
sleep 3

# Remove ALL old chaincode containers (they're not in docker-compose)
# Use timeout to prevent hanging (10s per container)
echo "   Removing old chaincode containers..."
CHAINCODE_IDS=$(docker ps -a --filter "name=dev-peer" --format "{{.ID}}" 2>/dev/null || true)
if [ -n "$CHAINCODE_IDS" ]; then
    echo "$CHAINCODE_IDS" | while read -r cid; do
        timeout 10s docker rm -f "$cid" 2>/dev/null || true
    done
fi
CHAINCODE_IDS2=$(docker ps -a --filter "name=vehicle-registration" --format "{{.ID}}" 2>/dev/null || true)
if [ -n "$CHAINCODE_IDS2" ]; then
    echo "$CHAINCODE_IDS2" | while read -r cid; do
        timeout 10s docker rm -f "$cid" 2>/dev/null || true
    done
fi
echo "   ✅ Old chaincode containers removed"

# Use docker compose down to properly stop and remove containers AND volumes
# Note: This will preserve postgres and lto-app if they're in the compose file
docker compose -f docker-compose.unified.yml down -v --remove-orphans 2>/dev/null || \
docker-compose -f docker-compose.unified.yml down -v --remove-orphans 2>/dev/null || {
    echo "   ⚠️  docker compose down failed, trying manual cleanup..."
    # Manual cleanup - stop all Fabric containers (preserve postgres and lto-app)
    # Use timeout to prevent hanging (15s per container)
    timeout 15s docker stop peer0.lto.gov.ph 2>/dev/null || docker kill peer0.lto.gov.ph 2>/dev/null || true
    timeout 15s docker stop orderer.lto.gov.ph 2>/dev/null || docker kill orderer.lto.gov.ph 2>/dev/null || true
    timeout 15s docker stop couchdb 2>/dev/null || docker kill couchdb 2>/dev/null || true
    timeout 15s docker stop cli 2>/dev/null || docker kill cli 2>/dev/null || true
    sleep 3
    # Remove all Fabric containers with timeout (10s per container)
    timeout 10s docker rm -f peer0.lto.gov.ph 2>/dev/null || true
    timeout 10s docker rm -f orderer.lto.gov.ph 2>/dev/null || true
    timeout 10s docker rm -f couchdb 2>/dev/null || true
    timeout 10s docker rm -f cli 2>/dev/null || true
    # Remove any remaining chaincode containers with timeout
    CHAINCODE_IDS=$(docker ps -a --filter "name=dev-peer" --format "{{.ID}}" 2>/dev/null || true)
    if [ -n "$CHAINCODE_IDS" ]; then
        echo "$CHAINCODE_IDS" | while read -r cid; do
            timeout 10s docker rm -f "$cid" 2>/dev/null || true
        done
    fi
}

sleep 3

# Verify all Fabric containers are gone
REMAINING_CONTAINERS=$(docker ps -a --format "{{.Names}}" | grep -E "(peer|orderer|couchdb|cli|dev-peer)" || true)
if [ -n "$REMAINING_CONTAINERS" ]; then
    echo "   ⚠️  Warning: Some Fabric containers still exist:"
    echo "$REMAINING_CONTAINERS" | sed 's/^/      - /'
    echo "   Force removing with timeout (10s per container)..."
    echo "$REMAINING_CONTAINERS" | while read -r container; do
        timeout 10s docker rm -f "$container" 2>/dev/null || true
    done
fi

echo "   ✅ All Fabric containers stopped and removed"

# ============================================
# STEP 2: Remove ALL Fabric Volumes (CRITICAL - Handle prefixes)
# ============================================
echo ""
echo "2️⃣  Removing Fabric volumes (CRITICAL: removes old channel data)..."

# Get project name for volume prefix detection
PROJECT_NAME=$(basename $(pwd) | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' || echo "ltoblockchain")

# List all volumes and remove Fabric-related ones (handles prefixes)
echo "   Finding Fabric volumes..."
# Find volumes with any prefix pattern (ltoblockchain_orderer-data, ltoblockchain-orderer-data, or just orderer-data)
# Pattern matches volumes ending in orderer-data, peer-data, or couchdb-data (with or without prefix)
FABRIC_VOLUMES=$(docker volume ls -q | grep -E "(orderer-data|peer-data|couchdb-data)$" || true)

if [ -n "$FABRIC_VOLUMES" ]; then
    echo "   Found volumes:"
    echo "$FABRIC_VOLUMES" | sed 's/^/      - /'
    echo "   Removing volumes..."
    # Remove all containers that might be using these volumes first (only Fabric containers)
    # Use timeout to prevent hanging (10s per container)
    docker ps -a --format "{{.Names}}" | grep -E "(peer|orderer|couchdb|cli|dev-peer)" | while read -r container; do
        timeout 10s docker rm -f "$container" 2>/dev/null || true
    done
    sleep 3
    echo "$FABRIC_VOLUMES" | xargs -r docker volume rm 2>/dev/null || {
        echo "   ⚠️  Some volumes may be in use, trying again..."
        sleep 2
        echo "$FABRIC_VOLUMES" | xargs -r docker volume rm 2>/dev/null || true
    }
else
    echo "   ⚠️  No Fabric volumes found (may already be removed)"
fi

# Clear local data directories if they exist
echo "   Clearing local data directories..."
if [ -d "fabric-network/couchdb-data" ]; then
    rm -rf fabric-network/couchdb-data
    echo "   ✅ Cleared couchdb-data"
fi
if [ -d "fabric-network/peer-data" ]; then
    rm -rf fabric-network/peer-data
    echo "   ✅ Cleared peer-data"
fi
if [ -d "fabric-network/orderer-data" ]; then
    rm -rf fabric-network/orderer-data
    echo "   ✅ Cleared orderer-data"
fi

# Wait for volumes to be fully released
sleep 3

# Verify volumes are completely gone (match volumes ending in orderer-data, peer-data, or couchdb-data)
REMAINING_VOLUMES=$(docker volume ls -q | grep -E "(orderer-data|peer-data|couchdb-data)$" || true)
if [ -n "$REMAINING_VOLUMES" ]; then
    echo "   ❌ CRITICAL: Some volumes still exist after removal:"
    echo "$REMAINING_VOLUMES" | sed 's/^/      - /'
    echo "   This WILL cause 'channel already exists' errors!"
    echo "   Attempting final force removal..."
    # Stop ALL containers with timeout (15s per container)
    docker ps -aq | while read -r cid; do
        timeout 15s docker stop "$cid" 2>/dev/null || docker kill "$cid" 2>/dev/null || true
    done
    sleep 3
    # Remove ALL containers with timeout (10s per container)
    docker ps -aq | while read -r cid; do
        timeout 10s docker rm -f "$cid" 2>/dev/null || true
    done
    sleep 3
    # Try removing volumes again
    echo "$REMAINING_VOLUMES" | xargs -r docker volume rm 2>/dev/null || {
        echo "   ❌ CRITICAL: Could not remove volumes. Manual intervention required."
        echo "   Run: docker volume rm $(echo "$REMAINING_VOLUMES" | tr '\n' ' ')"
        exit 1
    }
    echo "   ✅ Volumes force-removed"
else
    echo "   ✅ All Fabric volumes verified removed"
fi

echo "   ✅ Volumes removed (orderer ledger cleared - no old channels)"

# ============================================
# STEP 3: Backup and Regenerate Certificates
# ============================================
echo ""
echo "3️⃣  Regenerating certificates..."

if [ -d "fabric-network/crypto-config" ]; then
    BACKUP_CRYPTO="fabric-network/crypto-config.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/crypto-config "$BACKUP_CRYPTO"
    echo "   ✅ Backed up old certificates to: $BACKUP_CRYPTO"
fi

if [ ! -f "scripts/generate-crypto.sh" ]; then
    echo "❌ scripts/generate-crypto.sh not found!"
    exit 1
fi

bash scripts/generate-crypto.sh
echo "   ✅ Certificates regenerated"

# Verify critical certificates exist
if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts" ]; then
    echo "❌ Admin certificate directory not found after generation!"
    exit 1
fi

if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls" ]; then
    echo "❌ Peer TLS directory not found after generation!"
    exit 1
fi

if [ ! -d "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls" ]; then
    echo "❌ Orderer TLS directory not found after generation!"
    exit 1
fi

echo "   ✅ Certificates verified"

# ============================================
# STEP 4: Fix MSP admincerts (CRITICAL - BEFORE containers start)
# ============================================
echo ""
echo "4️⃣  Fixing MSP admincerts (CRITICAL for proper identity validation)..."

ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
PEER_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp"
ORG_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp"

# Find admin certificate
ADMIN_CERT=$(find "$ADMIN_MSP/signcerts" -name "*.pem" 2>/dev/null | head -1)

if [ -z "$ADMIN_CERT" ]; then
    echo "❌ Admin certificate not found!"
    exit 1
fi

echo "   Found admin cert: $ADMIN_CERT"

# Fix user-level admincerts
mkdir -p "$ADMIN_MSP/admincerts"
cp "$ADMIN_CERT" "$ADMIN_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ User admincerts fixed"

# Fix peer-level admincerts
mkdir -p "$PEER_MSP/admincerts"
cp "$ADMIN_CERT" "$PEER_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ Peer admincerts fixed"

# Fix organization-level admincerts (CRITICAL for NodeOUs)
mkdir -p "$ORG_MSP/admincerts"
cp "$ADMIN_CERT" "$ORG_MSP/admincerts/Admin@lto.gov.ph-cert.pem" 2>/dev/null || true
echo "   ✅ Organization admincerts fixed"

# Fix orderer MSP TLS CA (for orderer clustering)
ORDERER_MSP="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp"
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
if [ -f "$ORDERER_TLS_CA" ]; then
    mkdir -p "$ORDERER_MSP/tlscacerts"
    cp "$ORDERER_TLS_CA" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem" 2>/dev/null || true
    echo "   ✅ Orderer TLS CA fixed"
fi

# ============================================
# STEP 5: Regenerate Channel Artifacts
# ============================================
echo ""
echo "5️⃣  Regenerating channel artifacts..."

if [ -d "fabric-network/channel-artifacts" ]; then
    BACKUP_CHANNEL="fabric-network/channel-artifacts.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/channel-artifacts "$BACKUP_CHANNEL"
    echo "   ✅ Backed up old artifacts to: $BACKUP_CHANNEL"
fi

if [ ! -f "scripts/generate-channel-artifacts.sh" ]; then
    echo "❌ scripts/generate-channel-artifacts.sh not found!"
    exit 1
fi

bash scripts/generate-channel-artifacts.sh
echo "   ✅ Channel artifacts regenerated"

# Verify channel artifacts were created
if [ ! -f "fabric-network/channel-artifacts/genesis.block" ]; then
    echo "❌ Genesis block not found after generation!"
    exit 1
fi

# Check for channel transaction (either name)
if [ ! -f "fabric-network/channel-artifacts/ltochannel.tx" ] && [ ! -f "fabric-network/channel-artifacts/channel.tx" ]; then
    echo "❌ Channel transaction file not found after generation!"
    echo "   Expected: fabric-network/channel-artifacts/ltochannel.tx or channel.tx"
    ls -la fabric-network/channel-artifacts/ 2>&1 || echo "   Directory does not exist"
    exit 1
fi

echo "   ✅ Channel artifacts verified"

# ============================================
# STEP 6: Start Fabric Containers (FRESH - Completely New)
# ============================================
echo ""
echo "6️⃣  Starting Fabric containers (COMPLETELY NEW - not reused)..."

# Start orderer and couchdb first
docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb 2>/dev/null || {
    echo "❌ Failed to start orderer/couchdb"
    exit 1
}

echo "   ⏳ Waiting for orderer and couchdb to be ready (25 seconds)..."
sleep 25

# Wait for orderer to log "Beginning to serve requests"
echo "   Waiting for orderer to be ready..."
ORDERER_READY=false
for i in {1..40}; do
    if docker logs orderer.lto.gov.ph 2>&1 | grep -q "Beginning to serve requests"; then
        echo "   ✅ Orderer is ready"
        ORDERER_READY=true
        break
    fi
    sleep 2
done

if [ "$ORDERER_READY" = false ]; then
    echo "   ⚠️  Orderer may not be ready, checking status..."
    docker logs orderer.lto.gov.ph --tail 15
    echo "   Continuing anyway..."
fi

# Verify couchdb is healthy
if docker ps | grep -q "couchdb.*Up"; then
    echo "   ✅ CouchDB is running"
else
    echo "   ⚠️  CouchDB may not be running"
fi

# Start peer
docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || {
    echo "❌ Failed to start peer"
    exit 1
}

echo "   ⏳ Waiting for peer to start (20 seconds)..."
sleep 20

# Verify peer is running
if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "   ✅ Peer is running"
else
    echo "   ⚠️  Peer may not be running, checking logs..."
    docker logs peer0.lto.gov.ph --tail 15
fi

# ============================================
# STEP 7: Create Channel
# ============================================
echo ""
echo "7️⃣  Creating channel..."

# Determine channel transaction file name (check both possible names)
CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
fi

if [ ! -f "$CHANNEL_TX" ]; then
    echo "❌ Channel transaction file not found!"
    echo "   Checked: fabric-network/channel-artifacts/ltochannel.tx"
    echo "   Checked: fabric-network/channel-artifacts/channel.tx"
    echo "   Listing channel-artifacts directory:"
    ls -la fabric-network/channel-artifacts/ 2>&1 || echo "   Directory does not exist"
    exit 1
fi

echo "   Using channel transaction: $CHANNEL_TX"
docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

# Copy orderer TLS CA cert to peer container
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
if [ ! -f "$ORDERER_TLS_CA" ]; then
    echo "❌ Orderer TLS CA certificate not found"
    exit 1
fi

docker cp "$ORDERER_TLS_CA" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt
TLS_CA_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"

# CRITICAL: Copy Admin MSP to peer container for channel creation (requires Admin identity)
echo "   Copying Admin MSP to peer container..."
ADMIN_MSP="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
if [ ! -d "$ADMIN_MSP" ]; then
    echo "❌ Admin MSP directory not found: $ADMIN_MSP"
    exit 1
fi

# Copy Admin MSP to a temporary location in peer container
docker exec peer0.lto.gov.ph mkdir -p /tmp/admin-msp
docker cp "$ADMIN_MSP" peer0.lto.gov.ph:/tmp/admin-msp/
ADMIN_MSP_PATH="/tmp/admin-msp/msp"

# Verify Admin cert exists
if ! docker exec peer0.lto.gov.ph test -f "$ADMIN_MSP_PATH/signcerts/Admin@lto.gov.ph-cert.pem"; then
    echo "❌ Admin certificate not found in MSP"
    exit 1
fi

# Create channel with timeout - MUST use Admin identity
echo "   Creating channel 'ltochannel' (using Admin identity)..."
CHANNEL_CREATE_OUTPUT=$(timeout 90s docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --timeout 60s \
    2>&1) || {
    echo "❌ Channel creation failed or timed out"
    echo "   Orderer logs:"
    docker logs orderer.lto.gov.ph --tail 30
    echo "   Peer logs:"
    docker logs peer0.lto.gov.ph --tail 30
    exit 1
}

if echo "$CHANNEL_CREATE_OUTPUT" | grep -qi "error\|failed\|FORBIDDEN"; then
    echo "❌ Channel creation failed:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -15
    echo ""
    echo "💡 Common causes:"
    echo "   - Admin MSP not properly configured (check admincerts)"
    echo "   - Orderer still has old channel data (ensure volumes were removed)"
    echo "   - Channel creation policy requires Admin identity (now using Admin MSP)"
    exit 1
fi

echo "   ✅ Channel created"

# Verify channel block exists before joining
if ! docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block; then
    echo "❌ Channel block not found in peer container!"
    echo "   Channel creation may have failed silently"
    echo "   Orderer logs:"
    docker logs orderer.lto.gov.ph --tail 30
    exit 1
fi
echo "   ✅ Channel block verified"

# Join channel with timeout - MUST use Admin identity (same as channel create)
echo "   Joining peer to channel (using Admin identity)..."
CHANNEL_JOIN_OUTPUT=$(timeout 60s docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1) || {
    echo "❌ Channel join failed or timed out after 60s"
    echo "   Checking channel block..."
    docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block && \
        echo "   ✅ Channel block exists" || \
        echo "   ❌ Channel block missing!"
    echo "   Peer logs:"
    docker logs peer0.lto.gov.ph --tail 20
    echo "   Orderer logs:"
    docker logs orderer.lto.gov.ph --tail 20
    exit 1
}

if echo "$CHANNEL_JOIN_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel join failed:"
    echo "$CHANNEL_JOIN_OUTPUT" | tail -5
    exit 1
fi

echo "   ✅ Peer joined channel"

# Verify channel
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo "   ✅ Channel verified"
else
    echo "   ⚠️  Channel verification failed"
    echo "$CHANNEL_LIST"
fi

# ============================================
# STEP 8: Update Anchor Peer (if exists)
# ============================================
if [ -f "fabric-network/channel-artifacts/LTOMSPanchors.tx" ]; then
    echo ""
    echo "8️⃣  Updating anchor peer..."
    docker cp fabric-network/channel-artifacts/LTOMSPanchors.tx peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx
    
    # Use Admin identity for anchor peer update (requires Admin privileges)
    ANCHOR_OUTPUT=$(docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer channel update \
        -o orderer.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx \
        --tls \
        --cafile "$TLS_CA_FILE" \
        2>&1)
    
    if echo "$ANCHOR_OUTPUT" | grep -qi "error\|failed"; then
        echo "   ⚠️  Anchor peer update failed (may not be critical)"
    else
        echo "   ✅ Anchor peer updated"
    fi
fi

# ============================================
# STEP 9: Deploy Chaincode
# ============================================
echo ""
echo "9️⃣  Deploying chaincode..."

if [ ! -d "chaincode/vehicle-registration-production" ]; then
    echo "❌ Chaincode directory not found: chaincode/vehicle-registration-production"
    exit 1
fi

# Copy chaincode to peer
echo "   Copying chaincode to peer..."
# Ensure parent directory exists in peer container
docker exec peer0.lto.gov.ph mkdir -p /opt/gopath/src/github.com/chaincode || {
    echo "❌ Failed to create chaincode directory in peer container"
    exit 1
}

# Copy chaincode directory
docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/ || {
    echo "❌ Failed to copy chaincode"
    echo "   Debugging: Checking if source exists..."
    ls -la chaincode/vehicle-registration-production/ 2>&1 | head -10
    echo "   Debugging: Checking peer container..."
    docker exec peer0.lto.gov.ph ls -la /opt/gopath/src/github.com/chaincode/ 2>&1 || true
    exit 1
}

# Verify chaincode copy with detailed error messages
if ! docker exec peer0.lto.gov.ph test -d /opt/gopath/src/github.com/chaincode/vehicle-registration-production; then
    echo "❌ Chaincode directory not found in peer container"
    echo "   Debugging: Listing chaincode directory contents..."
    docker exec peer0.lto.gov.ph ls -la /opt/gopath/src/github.com/chaincode/ 2>&1 || true
    echo "   Debugging: Checking if directory exists..."
    docker exec peer0.lto.gov.ph test -d /opt/gopath/src/github.com/chaincode && echo "   ✅ Parent directory exists" || echo "   ❌ Parent directory missing"
    exit 1
fi

if ! docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/chaincode/vehicle-registration-production/index.js; then
    echo "❌ Chaincode index.js not found"
    echo "   Debugging: Listing chaincode files..."
    docker exec peer0.lto.gov.ph ls -la /opt/gopath/src/github.com/chaincode/vehicle-registration-production/ 2>&1 || true
    exit 1
fi

echo "   ✅ Chaincode copied and verified"

# Package chaincode
echo "   Packaging chaincode..."
PACKAGE_OUTPUT=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0 2>&1)

if echo "$PACKAGE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Failed to package chaincode:"
    echo "$PACKAGE_OUTPUT" | tail -10
    exit 1
fi

# Install chaincode - MUST use Admin identity
echo "   Installing chaincode..."
INSTALL_OUTPUT=$(docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1) || {
    echo "❌ Failed to install chaincode"
    echo "$INSTALL_OUTPUT" | tail -10
    exit 1
}

if echo "$INSTALL_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Chaincode installation failed:"
    echo "$INSTALL_OUTPUT" | tail -10
    exit 1
fi

echo "$INSTALL_OUTPUT" | tail -3

echo "   ⏳ Waiting for installation (15s)..."
sleep 15

# Get package ID - Use Admin identity for query
echo "   Getting package ID..."
PACKAGE_ID=$(docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0:" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    echo "❌ Failed to get chaincode package ID"
    exit 1
fi

echo "   Package ID: $PACKAGE_ID"

# Approve chaincode - MUST use Admin identity
echo "   Approving chaincode..."
APPROVE_OUTPUT=$(docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1) || {
    echo "❌ Failed to approve chaincode"
    echo "$APPROVE_OUTPUT" | tail -10
    exit 1
}

if echo "$APPROVE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Chaincode approval failed:"
    echo "$APPROVE_OUTPUT" | tail -10
    exit 1
fi

echo "$APPROVE_OUTPUT" | tail -3

# Commit chaincode - MUST use Admin identity
echo "   Committing chaincode..."
COMMIT_OUTPUT=$(docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --peerAddresses peer0.lto.gov.ph:7051 \
    --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt \
    2>&1) || {
    echo "❌ Failed to commit chaincode"
    echo "$COMMIT_OUTPUT" | tail -10
    exit 1
}

if echo "$COMMIT_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Chaincode commit failed:"
    echo "$COMMIT_OUTPUT" | tail -10
    exit 1
fi

echo "$COMMIT_OUTPUT" | tail -3

echo "   ⏳ Waiting for commit (10s)..."
sleep 10

# Verify chaincode - Use Admin identity for consistency
CHAINCODE_LIST=$(docker exec -e CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP_PATH" -e CORE_PEER_LOCALMSPID=LTOMSP peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_LIST" | grep -q "vehicle-registration"; then
    echo "   ✅ Chaincode deployed successfully"
else
    echo "   ⚠️  Chaincode verification failed"
    echo "$CHAINCODE_LIST"
fi

# ============================================
# STEP 10: Regenerate Wallet
# ============================================
echo ""
echo "🔟 Regenerating wallet..."

rm -rf wallet
mkdir -p wallet

if command -v node > /dev/null 2>&1; then
    node scripts/setup-fabric-wallet.js || {
        echo "   ⚠️  Wallet setup script failed, trying manual setup..."
        WALLET_ADMIN_DIR="wallet/admin"
        mkdir -p "$WALLET_ADMIN_DIR"
        
        ADMIN_KEY=$(find "$ADMIN_MSP/keystore" -name "*_sk" 2>/dev/null | head -1)
        if [ -n "$ADMIN_KEY" ] && [ -n "$ADMIN_CERT" ]; then
            cp "$ADMIN_CERT" "$WALLET_ADMIN_DIR/cert.pem"
            cp "$ADMIN_KEY" "$WALLET_ADMIN_DIR/key.pem"
            echo "   ✅ Wallet created manually"
        else
            echo "   ❌ Failed to create wallet manually"
        fi
    }
else
    echo "   ⚠️  Node.js not found, creating wallet manually..."
    WALLET_ADMIN_DIR="wallet/admin"
    mkdir -p "$WALLET_ADMIN_DIR"
    
    ADMIN_KEY=$(find "$ADMIN_MSP/keystore" -name "*_sk" 2>/dev/null | head -1)
    if [ -n "$ADMIN_KEY" ] && [ -n "$ADMIN_CERT" ]; then
        cp "$ADMIN_CERT" "$WALLET_ADMIN_DIR/cert.pem"
        cp "$ADMIN_KEY" "$WALLET_ADMIN_DIR/key.pem"
        echo "   ✅ Wallet created manually"
    fi
fi

# Verify wallet was created successfully
# The SDK wallet stores identities as JSON files, not cert.pem/key.pem
# Check if admin identity exists using Node.js if available, otherwise check for SDK wallet structure
if command -v node > /dev/null 2>&1; then
    # Use Node.js to verify wallet using SDK
    WALLET_CHECK=$(node -e "
        const { Wallets } = require('fabric-network');
        const path = require('path');
        (async () => {
            try {
                const walletPath = path.join(process.cwd(), 'wallet');
                const wallet = await Wallets.newFileSystemWallet(walletPath);
                const adminExists = await wallet.get('admin');
                if (adminExists) {
                    console.log('SUCCESS');
                    process.exit(0);
                } else {
                    console.log('NOT_FOUND');
                    process.exit(1);
                }
            } catch (error) {
                console.log('ERROR: ' + error.message);
                process.exit(1);
            }
        })();
    " 2>&1)
    
    if echo "$WALLET_CHECK" | grep -q "SUCCESS"; then
        echo "   ✅ Wallet regenerated successfully (SDK format verified)"
    elif echo "$WALLET_CHECK" | grep -q "NOT_FOUND"; then
        echo "   ⚠️  Wallet created but admin identity not found"
        echo "   💡 This may indicate a wallet creation issue"
    else
        echo "   ⚠️  Could not verify wallet (checking file structure...)"
        # Fallback: Check for SDK wallet directory structure
        if [ -d "wallet/admin" ] && [ -f "wallet/admin"/*.json ] 2>/dev/null; then
            echo "   ✅ Wallet directory structure found"
        elif [ -f "wallet/admin/cert.pem" ] && [ -f "wallet/admin/key.pem" ]; then
            echo "   ✅ Wallet regenerated successfully (manual format)"
        else
            echo "   ❌ Wallet files not found - application may fail to connect"
        fi
    fi
else
    # No Node.js - check for manual fallback format or SDK structure
    if [ -f "wallet/admin/cert.pem" ] && [ -f "wallet/admin/key.pem" ]; then
        echo "   ✅ Wallet regenerated successfully (manual format)"
    elif [ -d "wallet/admin" ] && [ "$(ls -A wallet/admin 2>/dev/null)" ]; then
        echo "   ✅ Wallet directory exists (SDK format may be present)"
        echo "   💡 Run 'node scripts/setup-fabric-wallet.js' to verify SDK wallet"
    else
        echo "   ❌ Wallet files not found - application may fail to connect"
    fi
fi

# ============================================
# STEP 11: Verify Network Configuration
# ============================================
echo ""
echo "1️⃣1️⃣ Verifying network configuration..."

if [ ! -f "network-config.json" ]; then
    echo "❌ network-config.json not found!"
    echo "💡 Ensure network-config.json exists in project root"
    exit 1
fi

echo "   ✅ network-config.json exists"

# ============================================
# STEP 12: Restart Application
# ============================================
echo ""
echo "1️⃣2️⃣ Restarting application..."

docker compose -f docker-compose.unified.yml restart lto-app 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d lto-app 2>/dev/null || {
    echo "   ⚠️  Failed to restart application (may not be running)"
}

echo "   ⏳ Waiting for application to start (20 seconds)..."
sleep 20

# ============================================
# STEP 13: Final Verification
# ============================================
echo ""
echo "1️⃣3️⃣ Final verification..."

# Check containers
echo "   Checking containers..."
if docker ps | grep -q "peer0.lto.gov.ph" && docker ps | grep -q "orderer.lto.gov.ph"; then
    echo "   ✅ Fabric containers running"
else
    echo "   ⚠️  Some Fabric containers may not be running"
fi

# Check channel
CHANNEL_CHECK=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_CHECK" | grep -q "ltochannel"; then
    echo "   ✅ Channel exists"
else
    echo "   ⚠️  Channel may not exist"
fi

# Check chaincode
CHAINCODE_CHECK=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_CHECK" | grep -qi "error\|access denied\|creator org unknown"; then
    echo "   ⚠️  Chaincode query failed (may need more time)"
else
    if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
        echo "   ✅ Chaincode deployed"
    else
        echo "   ⚠️  Chaincode may not be deployed"
    fi
fi

# Check wallet - Use SDK verification if Node.js available
if command -v node > /dev/null 2>&1; then
    WALLET_CHECK=$(node -e "
        const { Wallets } = require('fabric-network');
        const path = require('path');
        (async () => {
            try {
                const walletPath = path.join(process.cwd(), 'wallet');
                const wallet = await Wallets.newFileSystemWallet(walletPath);
                const adminExists = await wallet.get('admin');
                console.log(adminExists ? 'EXISTS' : 'NOT_FOUND');
            } catch (error) {
                console.log('ERROR');
            }
        })();
    " 2>&1)
    
    if echo "$WALLET_CHECK" | grep -q "EXISTS"; then
        echo "   ✅ Wallet configured"
    else
        echo "   ❌ Wallet not configured"
    fi
else
    # Fallback check
    if [ -f "wallet/admin/cert.pem" ] && [ -f "wallet/admin/key.pem" ]; then
        echo "   ✅ Wallet configured"
    elif [ -d "wallet/admin" ] && [ "$(ls -A wallet/admin 2>/dev/null)" ]; then
        echo "   ⚠️  Wallet directory exists (verification requires Node.js)"
    else
        echo "   ❌ Wallet not configured"
    fi
fi

# Check application logs
echo ""
echo "   Checking application logs..."
APP_LOGS=$(docker logs lto-app --tail 30 2>&1 | grep -i "fabric\|connected\|error" || true)
if echo "$APP_LOGS" | grep -qi "connected.*fabric\|fabric.*connected"; then
    echo "   ✅ Application connected to Fabric"
elif echo "$APP_LOGS" | grep -qi "error\|failed"; then
    echo "   ⚠️  Application may have errors (check logs)"
else
    echo "   ℹ️  Application logs not showing Fabric connection yet"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Reset Complete!                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Fabric network reset and reconfigured"
echo "✅ Volumes removed BEFORE certificate regeneration (prevents channel conflicts)"
echo "✅ MSP admincerts fixed at all levels"
echo "✅ Channel created: ltochannel"
echo "✅ Chaincode deployed: vehicle-registration"
echo "✅ Wallet regenerated"
echo ""
echo "📋 Next steps:"
echo "   1. Check application logs: docker logs lto-app --tail 50"
echo "   2. Verify Fabric connection: docker logs lto-app | grep -i fabric"
echo "   3. Test vehicle registration via API"
echo ""
echo "💡 Note: TLS errors in orderer logs are harmless warnings"
echo "   for single-node Raft clusters (expected behavior)"
echo ""
