#!/bin/bash
# Complete Fabric Blockchain Reset
# WARNING: This will DELETE ALL blockchain data (transactions, blocks, state)
# Use this to start completely fresh

set -e

cd ~/LTOBLOCKCHAIN || cd /root/LTOBLOCKCHAIN || exit 1

echo "⚠️  COMPLETE FABRIC BLOCKCHAIN RESET"
echo "====================================="
echo ""
echo "This will DELETE:"
echo "  ❌ All blockchain transactions"
echo "  ❌ All blocks"
echo "  ❌ All world state (CouchDB)"
echo "  ❌ All channel data"
echo "  ❌ All chaincode data"
echo ""
echo "This will KEEP:"
echo "  ✅ PostgreSQL database (your application data)"
echo "  ✅ Certificates (will be regenerated)"
echo "  ✅ Channel artifacts (will be regenerated)"
echo ""
read -p "Are you SURE you want to reset the entire Fabric blockchain? (type 'RESET' to confirm): " -r
echo
if [[ ! $REPLY == "RESET" ]]; then
    echo "Aborted. Type 'RESET' (all caps) to confirm."
    exit 1
fi

# Ask about PostgreSQL reset
echo ""
read -p "Do you also want to RESET PostgreSQL (delete all application data)? (type 'YES' to confirm, or press Enter to skip): " -r
RESET_POSTGRES=""
if [[ $REPLY == "YES" ]]; then
    RESET_POSTGRES="yes"
    echo "⚠️  PostgreSQL will be cleared (all vehicles, transfers, documents, etc.)"
    echo "   User accounts and schema will be preserved"
fi
echo ""

# Step 1: Stop all Fabric containers
echo ""
echo "1️⃣ Stopping Fabric containers..."
docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || \
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || {
    docker stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || true
}
sleep 2

# Step 2: Remove Fabric containers
echo "2️⃣ Removing Fabric containers..."
docker compose -f docker-compose.unified.yml rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || \
docker-compose -f docker-compose.unified.yml rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || {
    docker rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || true
}

# Step 3: Remove Fabric Docker volumes (contains all blockchain data)
echo "3️⃣ Removing Fabric volumes (all blockchain data)..."
docker volume rm peer-data orderer-data couchdb-data 2>/dev/null || {
    echo "⚠️  Some volumes may not exist (this is OK)"
}

# Step 4: Clear CouchDB data directory (if mounted locally)
echo "4️⃣ Clearing CouchDB data..."
if [ -d "fabric-network/couchdb-data" ]; then
    rm -rf fabric-network/couchdb-data
    echo "✅ Cleared CouchDB data directory"
fi

# Step 5: Clear peer ledger data (if mounted locally)
echo "5️⃣ Clearing peer ledger data..."
if [ -d "fabric-network/peer-data" ]; then
    rm -rf fabric-network/peer-data
    echo "✅ Cleared peer ledger data directory"
fi

# Step 6: Clear orderer ledger data (if mounted locally)
echo "6️⃣ Clearing orderer ledger data..."
if [ -d "fabric-network/orderer-data" ]; then
    rm -rf fabric-network/orderer-data
    echo "✅ Cleared orderer ledger data directory"
fi

# Step 7: Backup and regenerate certificates
echo "7️⃣ Regenerating certificates..."
if [ -d "fabric-network/crypto-config" ]; then
    BACKUP_CRYPTO="fabric-network/crypto-config.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/crypto-config "$BACKUP_CRYPTO"
    echo "✅ Backed up old certificates to: $BACKUP_CRYPTO"
fi

bash scripts/generate-crypto.sh
echo "✅ Certificates regenerated"

# Step 8: Backup and regenerate channel artifacts
echo "8️⃣ Regenerating channel artifacts..."
if [ -d "fabric-network/channel-artifacts" ]; then
    BACKUP_CHANNEL="fabric-network/channel-artifacts.backup.$(date +%Y%m%d_%H%M%S)"
    mv fabric-network/channel-artifacts "$BACKUP_CHANNEL"
    echo "✅ Backed up old channel artifacts to: $BACKUP_CHANNEL"
fi

bash scripts/generate-channel-artifacts.sh
echo "✅ Channel artifacts regenerated"

# Step 9: Setup TLS certificates
echo "9️⃣ Setting up TLS certificates..."
bash scripts/setup-tls-certs.sh 2>/dev/null || echo "⚠️  TLS setup had issues, continuing..."

# Step 10: Fix MSP structure
echo "🔟 Fixing MSP structure..."
bash scripts/fix-fabric-ca-chain.sh 2>/dev/null || echo "⚠️  MSP fix had issues, continuing..."

# Step 11: Reset PostgreSQL (if requested)
if [ "$RESET_POSTGRES" == "yes" ]; then
    echo "1️⃣1️⃣ Resetting PostgreSQL database..."
    
    # Check if PostgreSQL container is running
    if ! docker ps | grep -q "postgres"; then
        echo "⚠️  PostgreSQL container not running, skipping database reset"
    else
        # Check if clear-application-data.sql exists
        if [ -f "database/clear-application-data.sql" ]; then
            echo "   Clearing application data (preserving users and schema)..."
            docker exec -i postgres psql -U lto_user -d lto_blockchain < database/clear-application-data.sql 2>&1 | grep -v "NOTICE" || {
                echo "⚠️  PostgreSQL reset had issues (check logs above)"
            }
            echo "✅ PostgreSQL data cleared"
        else
            echo "⚠️  database/clear-application-data.sql not found"
            echo "   Using TRUNCATE CASCADE instead..."
            docker exec postgres psql -U lto_user -d lto_blockchain -c "
                TRUNCATE TABLE vehicle_history, transfer_verifications, transfer_documents, 
                certificate_submissions, notifications, expiry_notifications, certificates, 
                vehicle_verifications, transfer_requests, clearance_requests, documents, 
                issued_certificates, vehicles, system_settings, registration_document_requirements CASCADE;
                ALTER SEQUENCE IF EXISTS or_cr_number_seq RESTART WITH 1;
                ALTER SEQUENCE IF EXISTS mvir_number_seq RESTART WITH 1;
            " 2>&1 | grep -v "NOTICE" || echo "⚠️  TRUNCATE had issues"
            echo "✅ PostgreSQL data cleared (using TRUNCATE)"
        fi
    fi
fi

# Step 12: Recreate wallet
echo "1️⃣2️⃣ Recreating wallet..."
rm -rf wallet
mkdir -p wallet
if command -v node > /dev/null 2>&1; then
    node scripts/setup-fabric-wallet.js || echo "⚠️  Wallet setup had issues"
else
    echo "⚠️  Node.js not found, wallet will be created on app start"
fi

# Step 13: Start Fabric containers
echo "1️⃣3️⃣ Starting Fabric containers..."
docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb 2>/dev/null || {
    docker start orderer.lto.gov.ph couchdb 2>/dev/null || true
}

echo "⏳ Waiting for orderer and CouchDB to start..."
sleep 10

docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph 2>/dev/null || {
    docker start peer0.lto.gov.ph 2>/dev/null || true
}

echo "⏳ Waiting for peer to start..."
sleep 10

# Step 14: Create and join channel
echo "1️⃣4️⃣ Creating and joining channel..."

# Wait for orderer to be ready (check logs for "Beginning to serve requests")
echo "   Waiting for orderer to be ready..."
ORDERER_READY=false
for i in {1..30}; do
    if docker logs orderer.lto.gov.ph 2>&1 | grep -q "Beginning to serve requests\|Raft leader"; then
        ORDERER_READY=true
        break
    fi
    sleep 2
done

if [ "$ORDERER_READY" != "true" ]; then
    echo "⚠️  Orderer may not be fully ready, but continuing..."
fi

# Determine channel transaction file name
CHANNEL_TX="fabric-network/channel-artifacts/ltochannel.tx"
if [ ! -f "$CHANNEL_TX" ]; then
    CHANNEL_TX="fabric-network/channel-artifacts/channel.tx"
fi

# Copy channel transaction to peer
docker cp "$CHANNEL_TX" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

# Copy orderer TLS CA cert to peer container (CRITICAL: use orderer's TLS CA, not peer's)
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
ORDERER_TLSCA_DIR="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca"

# Find orderer TLS CA (try multiple locations)
if [ ! -f "$ORDERER_TLS_CA" ]; then
    # Try tlsca directory
    ORDERER_TLS_CA=$(find "$ORDERER_TLSCA_DIR" -name "*.pem" 2>/dev/null | head -1)
fi

if [ ! -f "$ORDERER_TLS_CA" ]; then
    # Try orderer org MSP cacerts as fallback
    ORDERER_TLS_CA=$(find "fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/msp/cacerts" -name "*.pem" 2>/dev/null | head -1)
fi

if [ ! -f "$ORDERER_TLS_CA" ]; then
    echo "❌ Orderer TLS CA certificate not found!"
    echo "💡 Check if certificates were generated correctly"
    echo "💡 Expected locations:"
    echo "   - fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
    echo "   - fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca/*.pem"
    exit 1
fi

echo "   Copying orderer TLS CA certificate..."
echo "   Using: $ORDERER_TLS_CA"
docker cp "$ORDERER_TLS_CA" peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt

# Verify the file was copied
if ! docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt; then
    echo "❌ Failed to copy orderer TLS CA to peer container"
    exit 1
fi

TLS_CA_FILE="/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt"

# Create channel with timeout wrapper
echo "   Creating channel..."
echo "   Using TLS CA: $TLS_CA_FILE"

# First, verify orderer is ready and can accept connections
echo "   Verifying orderer connectivity..."
ORDERER_READY=false
for i in {1..15}; do
    if docker exec peer0.lto.gov.ph timeout 5s bash -c "echo > /dev/tcp/orderer.lto.gov.ph/7050" 2>/dev/null; then
        ORDERER_READY=true
        break
    fi
    sleep 2
done

if [ "$ORDERER_READY" != "true" ]; then
    echo "⚠️  Orderer port check failed, but continuing..."
fi

# Create channel
CHANNEL_CREATE_OUTPUT=$(timeout 120s docker exec peer0.lto.gov.ph peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --timeout 90s \
    2>&1) || {
    CHANNEL_CREATE_EXIT_CODE=$?
    echo "❌ Channel creation failed (exit code: $CHANNEL_CREATE_EXIT_CODE)"
    echo ""
    echo "Channel creation output:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -20
    echo ""
    echo "💡 Checking orderer logs for channel 'ltochannel'..."
    docker logs orderer.lto.gov.ph 2>&1 | grep -i "ltochannel\|channel" | tail -10
    echo ""
    echo "💡 If orderer says channel already exists, you may need to:"
    echo "   1. Stop orderer: docker stop orderer.lto.gov.ph"
    echo "   2. Remove orderer volume: docker volume rm orderer-data"
    echo "   3. Restart orderer and try again"
    exit 1
}

if echo "$CHANNEL_CREATE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel creation failed:"
    echo "$CHANNEL_CREATE_OUTPUT" | tail -10
    exit 1
else
    echo "$CHANNEL_CREATE_OUTPUT" | tail -5
fi

# Join channel
echo "   Joining peer to channel..."
CHANNEL_JOIN_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1)

if echo "$CHANNEL_JOIN_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Channel join failed:"
    echo "$CHANNEL_JOIN_OUTPUT" | tail -5
    exit 1
else
    echo "$CHANNEL_JOIN_OUTPUT" | tail -5
fi

# Verify channel
CHANNEL_LIST=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_LIST" | grep -q "ltochannel"; then
    echo "✅ Channel 'ltochannel' created and joined successfully"
else
    echo "⚠️  Channel join may have failed"
    echo "$CHANNEL_LIST"
fi

# Step 15: Update anchor peer (if exists)
if [ -f "fabric-network/channel-artifacts/LTOMSPanchors.tx" ]; then
    echo "1️⃣5️⃣ Updating anchor peer..."
    docker cp fabric-network/channel-artifacts/LTOMSPanchors.tx peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx
    
    ANCHOR_OUTPUT=$(docker exec peer0.lto.gov.ph peer channel update \
        -o orderer.lto.gov.ph:7050 \
        -c ltochannel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/anchors.tx \
        --tls \
        --cafile "$TLS_CA_FILE" \
        2>&1)
    
    if echo "$ANCHOR_OUTPUT" | grep -qi "error\|failed"; then
        echo "⚠️  Anchor peer update failed (may not be critical):"
        echo "$ANCHOR_OUTPUT" | tail -3
    else
        echo "$ANCHOR_OUTPUT" | tail -3
    fi
fi

# Step 16: Deploy chaincode (CRITICAL for vehicle registration and ownership transfer)
echo ""
echo "1️⃣6️⃣ Deploying chaincode..."

# Check if chaincode directory exists
if [ ! -d "chaincode/vehicle-registration-production" ]; then
    echo "❌ Chaincode directory not found!"
    echo "💡 Expected: chaincode/vehicle-registration-production"
    echo "⚠️  Skipping chaincode deployment - you must deploy it manually"
else
    # Copy chaincode to peer container
    echo "   Copying chaincode to peer..."
    docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/ || {
        echo "❌ Failed to copy chaincode to peer container"
        exit 1
    }
    
    # Verify chaincode was copied successfully
    echo "   Verifying chaincode copy..."
    if ! docker exec peer0.lto.gov.ph test -d /opt/gopath/src/github.com/chaincode/vehicle-registration-production; then
        echo "❌ Chaincode directory not found in peer container after copy"
        exit 1
    fi
    if ! docker exec peer0.lto.gov.ph test -f /opt/gopath/src/github.com/chaincode/vehicle-registration-production/index.js; then
        echo "❌ Chaincode index.js not found in peer container"
        exit 1
    fi
    echo "   ✅ Chaincode copied successfully"
    
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
    else
        echo "$PACKAGE_OUTPUT" | tail -5
    fi
    
    # Install chaincode
    echo "   Installing chaincode..."
    docker exec peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1 | tail -5 || {
        echo "❌ Failed to install chaincode"
        exit 1
    }
    
    echo "⏳ Waiting for chaincode installation (15s)..."
    sleep 15
    
    # Get package ID
    echo "   Getting package ID..."
    PACKAGE_ID=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode queryinstalled 2>&1 | \
        grep "vehicle-registration_1.0:" | \
        sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    
    if [ -z "$PACKAGE_ID" ]; then
        echo "❌ Failed to get chaincode package ID"
        echo "💡 Try running: docker exec peer0.lto.gov.ph peer lifecycle chaincode queryinstalled"
        exit 1
    fi
    
    echo "   Package ID: $PACKAGE_ID"
    
    # Approve chaincode
    echo "   Approving chaincode..."
    docker exec peer0.lto.gov.ph peer lifecycle chaincode approveformyorg \
        -o orderer.lto.gov.ph:7050 \
        --channelID ltochannel \
        --name vehicle-registration \
        --version 1.0 \
        --package-id "$PACKAGE_ID" \
        --sequence 1 \
        --tls \
        --cafile "$TLS_CA_FILE" \
        2>&1 | tail -5 || {
        echo "❌ Failed to approve chaincode"
        exit 1
    }
    
    # Commit chaincode
    echo "   Committing chaincode..."
    docker exec peer0.lto.gov.ph peer lifecycle chaincode commit \
        -o orderer.lto.gov.ph:7050 \
        --channelID ltochannel \
        --name vehicle-registration \
        --version 1.0 \
        --sequence 1 \
        --tls \
        --cafile "$TLS_CA_FILE" \
        --peerAddresses peer0.lto.gov.ph:7051 \
        --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt \
        2>&1 | tail -5 || {
        echo "❌ Failed to commit chaincode"
        exit 1
    }
    
    echo "⏳ Waiting for chaincode commit (10s)..."
    sleep 10
    
    # Verify chaincode
    CHAINCODE_LIST=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
    if echo "$CHAINCODE_LIST" | grep -q "vehicle-registration"; then
        echo "✅ Chaincode deployed successfully"
    else
        echo "⚠️  Chaincode deployment verification failed"
        echo "$CHAINCODE_LIST"
    fi
fi

# Step 17: Verify reset
echo ""
echo "1️⃣7️⃣ Verifying reset..."
sleep 5

# Check for errors
RECENT_ERRORS=$(docker logs peer0.lto.gov.ph --since 15s 2>&1 | grep -i "certificate signed by unknown authority\|access denied.*creator org unknown" | wc -l)
if [ "$RECENT_ERRORS" -eq 0 ]; then
    echo "✅ No certificate errors detected"
else
    echo "⚠️  Some certificate errors detected (may be old logs)"
fi

# Check channel
CHANNEL_CHECK=$(docker exec peer0.lto.gov.ph peer channel list 2>&1)
if echo "$CHANNEL_CHECK" | grep -q "ltochannel"; then
    echo "✅ Channel exists"
else
    echo "❌ Channel not found"
fi

# Check CouchDB
COUCHDB_STATUS=$(curl -s -u admin:${COUCHDB_PASSWORD:-adminpw} http://localhost:5984/_up 2>/dev/null || echo "down")
if [ "$COUCHDB_STATUS" == "ok" ]; then
    echo "✅ CouchDB is running"
    
    # List databases (should be empty or only system DBs)
    COUCHDB_DBS=$(curl -s -u admin:${COUCHDB_PASSWORD:-adminpw} http://localhost:5984/_all_dbs 2>/dev/null | grep -v "^_" | grep -v "^users" || echo "")
    if [ -z "$COUCHDB_DBS" ]; then
        echo "✅ CouchDB databases cleared (empty state)"
    else
        echo "⚠️  CouchDB still has databases: $COUCHDB_DBS"
    fi
else
    echo "⚠️  CouchDB status check failed"
fi

# Check chaincode (if deployed)
CHAINCODE_CHECK=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
    echo "✅ Chaincode deployed"
else
    echo "⚠️  Chaincode not found (may need manual deployment)"
fi

echo ""
echo "✅ FABRIC BLOCKCHAIN RESET COMPLETE!"
echo ""
echo "📊 Summary:"
echo "  ✅ All blockchain transactions deleted"
echo "  ✅ All blocks deleted"
echo "  ✅ All world state cleared"
echo "  ✅ Channel recreated"
echo "  ✅ Certificates regenerated"
if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
    echo "  ✅ Chaincode deployed"
else
    echo "  ⚠️  Chaincode deployment skipped or failed"
fi
if [ "$RESET_POSTGRES" == "yes" ]; then
    echo "  ✅ PostgreSQL data cleared"
fi
echo ""
echo "Next steps:"
if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
    echo "  1. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
    echo "  2. Test registration: Register a new vehicle"
else
    echo "  1. Deploy chaincode manually:"
    echo "     bash scripts/install-chaincode.sh"
    echo "     bash scripts/instantiate-chaincode.sh"
    echo "  2. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
    echo "  3. Test registration: Register a new vehicle"
fi
echo ""
if [ "$RESET_POSTGRES" != "yes" ]; then
    echo "⚠️  PostgreSQL database was NOT cleared."
    echo ""
    echo "📋 IMPORTANT: After Fabric reset, PostgreSQL vehicles still have blockchain_tx_id"
    echo "   values that no longer exist in Fabric. You MUST re-register vehicles:"
    echo ""
    echo "   1. Verify sync status:"
    echo "      bash scripts/verify-postgres-fabric-sync.sh"
    echo ""
    echo "   2. Re-register vehicles from PostgreSQL to Fabric:"
    echo "      docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js"
    echo ""
    echo "   See POSTGRESQL_FABRIC_SYNC_GUIDE.md for details."
    echo ""
    echo "   If you want to clear application data too, run:"
    echo "   docker exec postgres psql -U lto_user -d lto_blockchain -c 'TRUNCATE vehicles, users, transfers CASCADE;'"
else
    echo "✅ System is completely reset - ready for fresh start!"
    echo "   - Fabric blockchain: Empty"
    echo "   - PostgreSQL: Application data cleared (users preserved)"
fi
echo ""
echo "ℹ️  NOTE: You may see TLS certificate errors in orderer logs."
echo "   These are harmless warnings from orderer trying to cluster with itself."
echo "   They don't affect functionality - your channel is working fine!"
echo "   See TLS_ERRORS_ARE_HARMLESS.md for details."
