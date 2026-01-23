#!/bin/bash
# Pre-Reset Verification Checklist
# Run this BEFORE executing reset-fabric-blockchain.sh
# Ensures your system is ready for a clean reset

set -e

echo "🔍 Pre-Reset Verification Checklist"
echo "====================================="
echo ""
echo "This script verifies your system is ready for Fabric blockchain reset."
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.unified.yml" ]; then
    echo "❌ Error: docker-compose.unified.yml not found"
    echo "💡 Run this script from the project root directory"
    exit 1
fi

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    exit 1
fi

echo "✅ Step 1: Checking Docker containers..."
echo ""

# Check critical containers
CONTAINERS=("postgres" "peer0.lto.gov.ph" "orderer.lto.gov.ph" "couchdb")
ALL_RUNNING=true

for container in "${CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "   ✅ $container is running"
    else
        echo "   ⚠️  $container is not running"
        ALL_RUNNING=false
    fi
done

if [ "$ALL_RUNNING" = false ]; then
    echo ""
    echo "⚠️  Some containers are not running. Start them first:"
    echo "   docker compose -f docker-compose.unified.yml up -d"
    exit 1
fi

echo ""
echo "✅ Step 2: Checking PostgreSQL data..."
echo ""

# Check PostgreSQL vehicle count
PG_COUNT=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "
    SELECT COUNT(*) FROM vehicles WHERE status IN ('REGISTERED', 'APPROVED');
" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$PG_COUNT" = "0" ]; then
    echo "   ⚠️  No vehicles in PostgreSQL (database may be empty)"
    echo "   💡 This is OK - reset will work fine"
else
    echo "   ✅ Found $PG_COUNT vehicle(s) in PostgreSQL"
    echo ""
    echo "   ⚠️  IMPORTANT: After reset, these vehicles will need to be re-registered on Fabric"
    echo "   💡 Run this after reset:"
    echo "      docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js"
fi

echo ""
echo "✅ Step 3: Checking Fabric chaincode..."
echo ""

# Check if chaincode is currently deployed
CHAINCODE_CHECK=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1 || echo "ERROR")

if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
    CHAINCODE_VERSION=$(echo "$CHAINCODE_CHECK" | grep "vehicle-registration" | grep -o "Version: [^,]*" | cut -d' ' -f2 || echo "unknown")
    echo "   ✅ Chaincode is deployed (version: $CHAINCODE_VERSION)"
    echo "   💡 Reset script will redeploy chaincode version 1.0"
else
    echo "   ⚠️  Chaincode not found or channel not accessible"
    echo "   💡 Reset script will deploy chaincode fresh"
fi

echo ""
echo "✅ Step 4: Checking required scripts..."
echo ""

# Check required scripts exist
REQUIRED_SCRIPTS=(
    "scripts/reset-fabric-blockchain.sh"
    "scripts/generate-crypto.sh"
    "scripts/generate-channel-artifacts.sh"
    "scripts/setup-fabric-wallet.js"
    "backend/scripts/register-missing-vehicles-on-blockchain.js"
)

ALL_SCRIPTS_EXIST=true
for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        echo "   ✅ $script exists"
    else
        echo "   ❌ $script NOT FOUND"
        ALL_SCRIPTS_EXIST=false
    fi
done

if [ "$ALL_SCRIPTS_EXIST" = false ]; then
    echo ""
    echo "❌ Some required scripts are missing!"
    exit 1
fi

echo ""
echo "✅ Step 5: Checking chaincode directory..."
echo ""

if [ -d "chaincode/vehicle-registration-production" ]; then
    echo "   ✅ Chaincode directory exists"
    
    # Check for required files
    if [ -f "chaincode/vehicle-registration-production/index.js" ]; then
        echo "   ✅ Chaincode index.js exists"
    else
        echo "   ❌ Chaincode index.js NOT FOUND"
        exit 1
    fi
    
    if [ -f "chaincode/vehicle-registration-production/package.json" ]; then
        echo "   ✅ Chaincode package.json exists"
    else
        echo "   ⚠️  Chaincode package.json not found (may be OK)"
    fi
else
    echo "   ❌ Chaincode directory NOT FOUND"
    echo "   💡 Expected: chaincode/vehicle-registration-production"
    exit 1
fi

echo ""
echo "✅ Step 6: Checking certificate/config files..."
echo ""

# Check for config files (they'll be regenerated, but check if templates exist)
CONFIG_FILES=(
    "crypto-config.yaml"
    "configtx.yaml"
)

CONFIG_FOUND=false
for config in "${CONFIG_FILES[@]}"; do
    if [ -f "$config" ] || [ -f "config/$config" ] || [ -f "fabric-network/${config%.yaml}-simple.yaml" ]; then
        echo "   ✅ Config template found (for $config)"
        CONFIG_FOUND=true
        break
    fi
done

if [ "$CONFIG_FOUND" = false ]; then
    echo "   ⚠️  Config templates not found in root/config/fabric-network"
    echo "   💡 Scripts will look in multiple locations"
fi

echo ""
echo "✅ Step 7: Checking disk space..."
echo ""

# Check available disk space (need at least 5GB free)
AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ -z "$AVAILABLE_SPACE" ]; then
    AVAILABLE_SPACE=$(df -h . | tail -1 | awk '{print $4}' | sed 's/G//' || echo "0")
fi

if [ "$AVAILABLE_SPACE" -gt 5 ] 2>/dev/null || [ "$AVAILABLE_SPACE" = "0" ]; then
    echo "   ✅ Sufficient disk space available"
else
    echo "   ⚠️  Low disk space: ${AVAILABLE_SPACE}GB available"
    echo "   💡 Recommend at least 5GB free for reset operation"
fi

echo ""
echo "✅ Step 8: Checking application container status..."
echo ""

APP_STATUS=$(docker ps --filter "name=lto-app" --format "{{.Status}}" 2>/dev/null || echo "not running")

if echo "$APP_STATUS" | grep -q "Restarting"; then
    echo "   ⚠️  Application is restarting (this is OK - will be fixed after reset)"
    echo "   💡 Check logs: docker logs lto-app --tail 50"
elif echo "$APP_STATUS" | grep -q "Up"; then
    echo "   ✅ Application is running"
else
    echo "   ⚠️  Application is not running (will start after reset)"
fi

echo ""
echo "📊 Pre-Reset Summary"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "System Status:"
echo "  ✅ Docker containers: Running"
echo "  ✅ Required scripts: Present"
echo "  ✅ Chaincode directory: Found"
echo "  ⚠️  PostgreSQL vehicles: $PG_COUNT (will need re-registration)"
echo "  ⚠️  Application: $APP_STATUS"
echo ""

if [ "$PG_COUNT" -gt 0 ]; then
    echo "⚠️  IMPORTANT REMINDERS:"
    echo ""
    echo "  1. After reset, PostgreSQL will still have $PG_COUNT vehicle(s)"
    echo "  2. Fabric blockchain will be empty (all data cleared)"
    echo "  3. You MUST re-register vehicles:"
    echo "     docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js"
    echo "  4. Verify sync:"
    echo "     bash scripts/verify-postgres-fabric-sync.sh"
    echo ""
fi

echo "✅ System is ready for reset!"
echo ""
echo "Next step:"
echo "  bash scripts/reset-fabric-blockchain.sh"
echo ""
echo "⚠️  Remember: Type 'RESET' (all caps) when prompted to confirm"
echo ""
