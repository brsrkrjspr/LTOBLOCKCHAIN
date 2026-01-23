#!/bin/bash
# Diagnostic script to check if Fabric is actually being used

echo "=== 🔍 Fabric Usage Diagnostic ==="
echo ""

echo "1️⃣  Checking BLOCKCHAIN_MODE setting..."
if [ -f .env ]; then
    BLOCKCHAIN_MODE_ENV=$(grep "^BLOCKCHAIN_MODE" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "")
    if [ -z "$BLOCKCHAIN_MODE_ENV" ]; then
        echo "   ❌ BLOCKCHAIN_MODE NOT SET in .env"
    else
        echo "   ✅ BLOCKCHAIN_MODE=$BLOCKCHAIN_MODE_ENV (in .env)"
    fi
else
    echo "   ⚠️  .env file not found"
fi

BLOCKCHAIN_MODE_DOCKER=$(grep "BLOCKCHAIN_MODE" docker-compose.unified.yml | grep -v "^#" | head -1 | sed 's/.*BLOCKCHAIN_MODE=\([^ ]*\).*/\1/' | tr -d '"' || echo "")
if [ -n "$BLOCKCHAIN_MODE_DOCKER" ]; then
    echo "   ✅ BLOCKCHAIN_MODE=$BLOCKCHAIN_MODE_DOCKER (in docker-compose.unified.yml)"
else
    echo "   ⚠️  BLOCKCHAIN_MODE not found in docker-compose.unified.yml"
fi

echo ""
echo "2️⃣  Checking if Fabric network is running..."
if docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "   ✅ Fabric peer is running"
else
    echo "   ❌ Fabric peer is NOT running"
fi

if docker ps | grep -q "orderer.lto.gov.ph"; then
    echo "   ✅ Fabric orderer is running"
else
    echo "   ❌ Fabric orderer is NOT running"
fi

if docker ps | grep -q "couchdb"; then
    echo "   ✅ CouchDB is running"
else
    echo "   ❌ CouchDB is NOT running"
fi

echo ""
echo "3️⃣  Checking vehicles in PostgreSQL..."
VEHICLES_TOTAL=$(psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM vehicles WHERE status='REGISTERED';" 2>/dev/null | tr -d ' \n' || echo "0")
VEHICLES_WITH_TXID=$(psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM vehicles WHERE status='REGISTERED' AND blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '';" 2>/dev/null | tr -d ' \n' || echo "0")

# Ensure values are numeric
VEHICLES_TOTAL=${VEHICLES_TOTAL:-0}
VEHICLES_WITH_TXID=${VEHICLES_WITH_TXID:-0}

echo "   Total REGISTERED vehicles: $VEHICLES_TOTAL"
echo "   Vehicles with blockchain_tx_id: $VEHICLES_WITH_TXID"

if [ "$VEHICLES_TOTAL" -gt 0 ] 2>/dev/null; then
    PERCENTAGE=$((VEHICLES_WITH_TXID * 100 / VEHICLES_TOTAL))
    echo "   Percentage with blockchain_tx_id: $PERCENTAGE%"
    
    if [ "$PERCENTAGE" -eq 0 ]; then
        echo "   ❌ NO vehicles have blockchain_tx_id - Fabric NOT being used!"
    elif [ "$PERCENTAGE" -lt 100 ]; then
        echo "   ⚠️  Some vehicles missing blockchain_tx_id - Partial Fabric usage"
    else
        echo "   ✅ All vehicles have blockchain_tx_id - Fabric IS being used"
    fi
fi

echo ""
echo "4️⃣  Checking vehicles on Fabric blockchain..."
echo "   Trying to query via application container (can access Docker network)..."
if docker ps | grep -q "lto-app"; then
    FABRIC_VEHICLES=$(docker exec lto-app node backend/scripts/show-fabric-vehicles.js 2>&1 | grep -oE "Found [0-9]+ vehicle" | grep -oE "[0-9]+" | head -1 || echo "0")
    FABRIC_VEHICLES=${FABRIC_VEHICLES:-0}
    if [ "$FABRIC_VEHICLES" = "0" ]; then
        echo "   ❌ No vehicles found on Fabric blockchain"
        echo "   ⚠️  This suggests Fabric is NOT being used OR vehicles were registered before blockchain enforcement"
    else
        echo "   ✅ Found $FABRIC_VEHICLES vehicle(s) on Fabric blockchain"
    fi
elif command -v node &> /dev/null; then
    echo "   ⚠️  Application container not running, trying from host..."
    FABRIC_VEHICLES=$(node backend/scripts/show-fabric-vehicles.js 2>&1 | grep -oE "Found [0-9]+ vehicle" | grep -oE "[0-9]+" | head -1 || echo "0")
    FABRIC_VEHICLES=${FABRIC_VEHICLES:-0}
    if [ "$FABRIC_VEHICLES" = "0" ]; then
        echo "   ❌ No vehicles found (may be network issue - try running inside container)"
    else
        echo "   ✅ Found $FABRIC_VEHICLES vehicle(s) on Fabric blockchain"
    fi
else
    echo "   ⚠️  Node.js not available - cannot check Fabric"
fi

echo ""
echo "5️⃣  Checking application logs..."
if docker ps | grep -q "lto-app"; then
    FABRIC_LOG=$(docker logs lto-app 2>&1 | grep -i "fabric\|blockchain" | tail -3)
    if echo "$FABRIC_LOG" | grep -qi "Real Hyperledger Fabric integration active"; then
        echo "   ✅ Application shows: 'Real Hyperledger Fabric integration active'"
    elif echo "$FABRIC_LOG" | grep -qi "BLOCKCHAIN_MODE is not"; then
        echo "   ❌ Application shows: 'BLOCKCHAIN_MODE is not fabric'"
    elif echo "$FABRIC_LOG" | grep -qi "Fabric initialization failed"; then
        echo "   ❌ Application shows: 'Fabric initialization failed'"
    else
        echo "   ⚠️  No clear Fabric status in logs"
        echo "   Recent logs:"
        echo "$FABRIC_LOG" | sed 's/^/      /'
    fi
else
    echo "   ⚠️  Application container not running"
fi

echo ""
echo "=== 📊 SUMMARY ==="
echo ""

if [ "$VEHICLES_WITH_TXID" -eq 0 ] 2>/dev/null && [ "$VEHICLES_TOTAL" -gt 0 ] 2>/dev/null; then
    echo "❌ CRITICAL: You have $VEHICLES_TOTAL REGISTERED vehicles but NONE have blockchain_tx_id!"
    echo "   This means Fabric has NOT been used for vehicle registration."
    echo ""
    echo "   What happened:"
    echo "   - Vehicles were registered in PostgreSQL only"
    echo "   - No blockchain transactions occurred"
    echo "   - No immutability/audit trail on blockchain"
    echo ""
    echo "   To fix:"
    echo "   1. Ensure BLOCKCHAIN_MODE=fabric in .env"
    echo "   2. Start Fabric network"
    echo "   3. Run: node backend/scripts/register-missing-vehicles-on-blockchain.js"
    echo "   OR delete vehicles and start fresh"
elif [ "$VEHICLES_WITH_TXID" -gt 0 ] 2>/dev/null; then
    echo "✅ Fabric IS being used (at least partially)"
    echo "   $VEHICLES_WITH_TXID out of $VEHICLES_TOTAL vehicles have blockchain_tx_id"
else
    echo "ℹ️  No vehicles found - cannot determine Fabric usage"
fi
