#!/bin/bash
# Complete Verification Script for Database Schema and Fabric Network
# Run this after running database migrations

set -e

echo "=========================================="
echo "🔍 Database & Fabric Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================
# PART 1: Database Schema Verification
# ============================================

echo -e "${CYAN}📊 PART 1: Database Schema Verification${NC}"
echo ""

# Check if columns exist
echo "Checking required columns..."
COLUMNS_CHECK=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'ipfs_cid') 
         THEN 'EXISTS' ELSE 'MISSING' END as ipfs_cid,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'vehicle_category') 
         THEN 'EXISTS' ELSE 'MISSING' END as vehicle_category,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'passenger_capacity') 
         THEN 'EXISTS' ELSE 'MISSING' END as passenger_capacity,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'gross_vehicle_weight') 
         THEN 'EXISTS' ELSE 'MISSING' END as gross_vehicle_weight;
")

IF echo "$COLUMNS_CHECK" | grep -q "MISSING"; then
    echo -e "${RED}❌ Some columns are missing!${NC}"
    echo "$COLUMNS_CHECK"
    exit 1
else
    echo -e "${GREEN}✅ All required columns exist${NC}"
fi

# Verify from application container perspective
echo ""
echo "Verifying from application container..."
# Get DB credentials from container environment
DB_HOST=$(docker exec lto-app printenv DB_HOST 2>/dev/null || echo "postgres")
DB_PORT=$(docker exec lto-app printenv DB_PORT 2>/dev/null || echo "5432")
DB_NAME=$(docker exec lto-app printenv DB_NAME 2>/dev/null || echo "lto_blockchain")
DB_USER=$(docker exec lto-app printenv DB_USER 2>/dev/null || echo "lto_user")
DB_PASSWORD=$(docker exec lto-app printenv DB_PASSWORD 2>/dev/null || echo "")

APP_CHECK=$(docker exec lto-app node -e "
const { Pool } = require('pg');
const pool = new Pool({
    host: '${DB_HOST}',
    port: ${DB_PORT},
    database: '${DB_NAME}',
    user: '${DB_USER}',
    password: '${DB_PASSWORD}'
});

(async () => {
    try {
        const result = await pool.query(\`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vehicles' 
            AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight')
        \`);
        if (result.rows.length === 3) {
            console.log('SUCCESS');
        } else {
            console.log('FAILED');
        }
        await pool.end();
    } catch (error) {
        console.log('ERROR:', error.message);
        await pool.end();
        process.exit(1);
    }
})();
" 2>&1)

if echo "$APP_CHECK" | grep -q "SUCCESS"; then
    echo -e "${GREEN}✅ Application can see all columns${NC}"
else
    echo -e "${YELLOW}⚠️  Application container needs restart to refresh connections${NC}"
fi

echo ""

# ============================================
# PART 2: Fabric Network Verification
# ============================================

echo -e "${CYAN}🔗 PART 2: Hyperledger Fabric Verification${NC}"
echo ""

# Check Fabric containers
echo "1. Checking Fabric containers..."
FABRIC_CONTAINERS=$(docker compose -f docker-compose.unified.yml ps --format json | jq -r 'select(.Name | contains("orderer") or contains("peer") or contains("couchdb") or contains("cli")) | "\(.Name): \(.State)"' 2>/dev/null || docker compose -f docker-compose.unified.yml ps | grep -E "orderer|peer|couchdb|cli")

if [ -z "$FABRIC_CONTAINERS" ]; then
    echo -e "${RED}❌ No Fabric containers found${NC}"
else
    echo -e "${GREEN}✅ Fabric containers:${NC}"
    echo "$FABRIC_CONTAINERS"
fi

echo ""

# Check Orderer
echo "2. Checking Orderer..."
if docker exec orderer.lto.gov.ph peer version > /dev/null 2>&1 || docker logs orderer.lto.gov.ph --tail 5 | grep -q "Starting orderer"; then
    echo -e "${GREEN}✅ Orderer is running${NC}"
else
    echo -e "${RED}❌ Orderer not responding${NC}"
fi

# Check CouchDB
echo "3. Checking CouchDB..."
COUCHDB_STATUS=$(docker exec couchdb curl -s http://localhost:5984/_up 2>/dev/null || echo "ERROR")
if echo "$COUCHDB_STATUS" | grep -q "ok"; then
    echo -e "${GREEN}✅ CouchDB is healthy${NC}"
else
    echo -e "${RED}❌ CouchDB not healthy${NC}"
fi

# Check Peer
echo "4. Checking Peer..."
PEER_STATUS=$(docker exec peer0.lto.gov.ph peer node status 2>&1 | head -3 || echo "ERROR")
if echo "$PEER_STATUS" | grep -q "Status:" || echo "$PEER_STATUS" | grep -q "Blockchain info"; then
    echo -e "${GREEN}✅ Peer is running${NC}"
else
    echo -e "${YELLOW}⚠️  Peer status unclear (may still be starting)${NC}"
fi

# Check Channel
echo "5. Checking Channel..."
CHANNEL_CHECK=$(docker exec cli peer channel list 2>&1 | grep -q "ltochannel" && echo "EXISTS" || echo "MISSING")
if [ "$CHANNEL_CHECK" = "EXISTS" ]; then
    echo -e "${GREEN}✅ Channel 'ltochannel' exists${NC}"
else
    echo -e "${YELLOW}⚠️  Channel not found (may need to be created)${NC}"
fi

# Check Chaincode
echo "6. Checking Chaincode..."
CHAINCODE_CHECK=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration" && echo "INSTALLED" || echo "NOT_INSTALLED")
if [ "$CHAINCODE_CHECK" = "INSTALLED" ]; then
    echo -e "${GREEN}✅ Chaincode installed${NC}"
else
    echo -e "${YELLOW}⚠️  Chaincode not installed${NC}"
fi

echo ""

# ============================================
# PART 3: Application Connection Check
# ============================================

echo -e "${CYAN}🔌 PART 3: Application Connection Check${NC}"
echo ""

# Check application logs for Fabric connection
echo "7. Checking application Fabric connection..."
FABRIC_LOG=$(docker logs lto-app --tail 100 2>&1 | grep -iE "fabric.*connect|blockchain.*connect|Connected to.*Fabric" | tail -1 || echo "NOT_FOUND")
if echo "$FABRIC_LOG" | grep -qi "connect"; then
    echo -e "${GREEN}✅ Found connection log:${NC}"
    echo "$FABRIC_LOG"
else
    echo -e "${YELLOW}⚠️  No Fabric connection log found${NC}"
fi

# Check blockchain status API
echo "8. Testing blockchain status API..."
API_STATUS=$(docker exec lto-app curl -s http://localhost:3001/api/blockchain/status 2>&1 | head -20 || echo "ERROR")
if echo "$API_STATUS" | grep -q "CONNECTED" || echo "$API_STATUS" | grep -q "success"; then
    echo -e "${GREEN}✅ Blockchain API responding${NC}"
    echo "$API_STATUS" | head -5
else
    echo -e "${YELLOW}⚠️  Blockchain API check:${NC}"
    echo "$API_STATUS" | head -5
fi

echo ""

# ============================================
# SUMMARY
# ============================================

echo "=========================================="
echo "📋 SUMMARY"
echo "=========================================="
echo ""
echo "Database Schema: ✅ Columns exist"
echo "Fabric Containers: Check output above"
echo "Application: May need full restart (stop + start)"
echo ""
echo -e "${CYAN}💡 Next Steps:${NC}"
echo "1. If columns exist but app still errors:"
echo "   docker compose -f docker-compose.unified.yml stop lto-app"
echo "   docker compose -f docker-compose.unified.yml up -d lto-app"
echo ""
echo "2. If Fabric not running:"
echo "   docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb peer0.lto.gov.ph cli"
echo ""
echo "3. If channel missing:"
echo "   bash scripts/setup-fabric-channel.sh"
echo ""
echo "=========================================="
