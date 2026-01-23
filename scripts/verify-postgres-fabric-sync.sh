#!/bin/bash
# Verify PostgreSQL and Fabric Data Synchronization
# Compares vehicles in PostgreSQL with vehicles in Fabric blockchain

set -e

echo "🔍 PostgreSQL ↔ Fabric Data Synchronization Verification"
echo "========================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.unified.yml" ]; then
    echo "❌ Error: docker-compose.unified.yml not found"
    echo "💡 Run this script from the project root directory"
    exit 1
fi

# Check if PostgreSQL is running
if ! docker ps | grep -q "postgres"; then
    echo "❌ PostgreSQL container is not running!"
    exit 1
fi

# Check if Fabric peer is running
if ! docker ps | grep -q "peer0.lto.gov.ph"; then
    echo "❌ Fabric peer container is not running!"
    exit 1
fi

echo "📊 Step 1: Checking PostgreSQL vehicles..."
echo ""

# Get PostgreSQL vehicle counts
PG_TOTAL=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "
    SELECT COUNT(*) FROM vehicles WHERE status IN ('REGISTERED', 'APPROVED');
" | tr -d ' ')

PG_WITH_TXID=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "
    SELECT COUNT(*) FROM vehicles 
    WHERE status IN ('REGISTERED', 'APPROVED')
    AND blockchain_tx_id IS NOT NULL 
    AND blockchain_tx_id != '';
" | tr -d ' ')

PG_WITHOUT_TXID=$((PG_TOTAL - PG_WITH_TXID))

echo "   PostgreSQL Statistics:"
echo "   ├─ Total REGISTERED/APPROVED vehicles: $PG_TOTAL"
echo "   ├─ With blockchain_tx_id: $PG_WITH_TXID"
echo "   └─ Without blockchain_tx_id: $PG_WITHOUT_TXID"
echo ""

# Get list of VINs from PostgreSQL
echo "📋 Step 2: Getting VINs from PostgreSQL..."
PG_VINS=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "
    SELECT vin FROM vehicles 
    WHERE status IN ('REGISTERED', 'APPROVED')
    ORDER BY vin;
" | tr -d ' ' | grep -v '^$')

PG_VIN_COUNT=$(echo "$PG_VINS" | wc -l | tr -d ' ')
echo "   Found $PG_VIN_COUNT vehicle(s) in PostgreSQL"
echo ""

# Check if application container is running
if ! docker ps | grep -q "lto-app"; then
    echo "⚠️  Application container (lto-app) is not running"
    echo "   Cannot query Fabric directly. Checking CouchDB instead..."
    echo ""
    
    # Check CouchDB directly
    COUCHDB_PASSWORD=${COUCHDB_PASSWORD:-adminpw}
    COUCHDB_DBS=$(curl -s -u admin:$COUCHDB_PASSWORD http://localhost:5984/_all_dbs 2>/dev/null | grep -o 'ltochannel_vehicle-registration' || echo "")
    
    if [ -z "$COUCHDB_DBS" ]; then
        echo "   ❌ CouchDB database 'ltochannel_vehicle-registration' not found"
        FABRIC_COUNT=0
    else
        echo "   ✅ CouchDB database exists"
        # Count documents in CouchDB (approximate)
        FABRIC_COUNT=$(curl -s -u admin:$COUCHDB_PASSWORD "http://localhost:5984/ltochannel_vehicle-registration/_all_docs?limit=1000" 2>/dev/null | grep -o '"id"' | wc -l | tr -d ' ' || echo "0")
        echo "   Found approximately $FABRIC_COUNT document(s) in CouchDB"
    fi
else
    echo "📡 Step 3: Querying Fabric blockchain..."
    echo ""
    
    # Query Fabric via application
    FABRIC_RESULT=$(docker exec lto-app node -e "
        const fabricService = require('./backend/services/optimizedFabricService');
        (async () => {
            try {
                if (!fabricService.isConnected) {
                    await fabricService.initialize();
                }
                if (!fabricService.contract) {
                    throw new Error('Contract not available');
                }
                const result = await fabricService.contract.evaluateTransaction('GetAllVehicles');
                const vehicles = JSON.parse(result.toString());
                console.log(JSON.stringify(vehicles.map(v => ({ vin: v.vin, txId: v.blockchainTxId || v.transactionId || 'N/A' }))));
            } catch(e) {
                console.error('ERROR:', e.message);
                process.exit(1);
            }
        })();
    " 2>&1)
    
    if echo "$FABRIC_RESULT" | grep -q "ERROR:"; then
        echo "   ❌ Failed to query Fabric:"
        echo "$FABRIC_RESULT" | grep "ERROR:"
        FABRIC_COUNT=0
        FABRIC_VINS=""
    else
        FABRIC_VINS=$(echo "$FABRIC_RESULT" | grep -o '"vin":"[^"]*"' | sed 's/"vin":"//g' | sed 's/"//g' | sort)
        FABRIC_COUNT=$(echo "$FABRIC_VINS" | grep -v '^$' | wc -l | tr -d ' ')
        echo "   Found $FABRIC_COUNT vehicle(s) on Fabric blockchain"
    fi
fi

echo ""
echo "📊 Step 4: Comparison Analysis"
echo ""

# Compare counts
if [ "$PG_TOTAL" -eq 0 ]; then
    echo "   ⚠️  No vehicles in PostgreSQL (database may be empty)"
elif [ "$FABRIC_COUNT" -eq 0 ]; then
    echo "   ⚠️  No vehicles on Fabric blockchain"
    echo "   💡 This is expected after a Fabric reset"
    echo ""
    echo "   🔧 To sync PostgreSQL → Fabric, run:"
    echo "      docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js"
else
    if [ "$PG_TOTAL" -eq "$FABRIC_COUNT" ]; then
        echo "   ✅ Counts match: $PG_TOTAL vehicles in both systems"
    else
        echo "   ⚠️  Count mismatch:"
        echo "      PostgreSQL: $PG_TOTAL vehicles"
        echo "      Fabric: $FABRIC_COUNT vehicles"
        echo "      Difference: $((PG_TOTAL - FABRIC_COUNT)) vehicle(s)"
    fi
fi

echo ""
echo "📋 Step 5: Detailed Sync Status"
echo ""

# Check each PostgreSQL vehicle
MISSING_ON_FABRIC=0
SYNCED=0
NO_TXID=0

if [ "$PG_TOTAL" -gt 0 ]; then
    echo "   Checking each vehicle in PostgreSQL..."
    echo ""
    
    for vin in $PG_VINS; do
        if [ -z "$vin" ]; then
            continue
        fi
        
        # Get vehicle info from PostgreSQL
        VEHICLE_INFO=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "
            SELECT 
                vin, 
                plate_number, 
                status,
                CASE 
                    WHEN blockchain_tx_id IS NULL OR blockchain_tx_id = '' THEN 'NO_TXID'
                    ELSE 'HAS_TXID'
                END as txid_status
            FROM vehicles 
            WHERE vin = '$vin'
            LIMIT 1;
        " | tr -d ' ')
        
        VIN=$(echo "$VEHICLE_INFO" | cut -d'|' -f1)
        PLATE=$(echo "$VEHICLE_INFO" | cut -d'|' -f2)
        STATUS=$(echo "$VEHICLE_INFO" | cut -d'|' -f3)
        TXID_STATUS=$(echo "$VEHICLE_INFO" | cut -d'|' -f4)
        
        # Check if on Fabric (if we have Fabric VINs)
        ON_FABRIC="NO"
        if [ -n "$FABRIC_VINS" ]; then
            if echo "$FABRIC_VINS" | grep -q "^$vin$"; then
                ON_FABRIC="YES"
            fi
        fi
        
        if [ "$TXID_STATUS" = "NO_TXID" ]; then
            NO_TXID=$((NO_TXID + 1))
            echo "   ⚠️  $VIN ($PLATE): Missing blockchain_tx_id"
        elif [ "$ON_FABRIC" = "NO" ] && [ "$FABRIC_COUNT" -gt 0 ]; then
            MISSING_ON_FABRIC=$((MISSING_ON_FABRIC + 1))
            echo "   ⚠️  $VIN ($PLATE): Has blockchain_tx_id but not found on Fabric"
        else
            SYNCED=$((SYNCED + 1))
            if [ "$SYNCED" -le 5 ]; then
                echo "   ✅ $VIN ($PLATE): Synced"
            fi
        fi
    done
    
    if [ "$SYNCED" -gt 5 ]; then
        echo "   ... and $((SYNCED - 5)) more synced vehicles"
    fi
fi

echo ""
echo "📊 Summary Report"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "PostgreSQL:"
echo "  ├─ Total REGISTERED/APPROVED: $PG_TOTAL"
echo "  ├─ With blockchain_tx_id: $PG_WITH_TXID"
echo "  └─ Without blockchain_tx_id: $PG_WITHOUT_TXID"
echo ""
echo "Fabric Blockchain:"
echo "  └─ Vehicles found: $FABRIC_COUNT"
echo ""
echo "Sync Status:"
echo "  ├─ ✅ Fully synced: $SYNCED"
echo "  ├─ ⚠️  Missing blockchain_tx_id: $NO_TXID"
echo "  └─ ⚠️  Not on Fabric (but has tx_id): $MISSING_ON_FABRIC"
echo ""

# Recommendations
if [ "$NO_TXID" -gt 0 ] || [ "$MISSING_ON_FABRIC" -gt 0 ]; then
    echo "🔧 Recommendations:"
    echo ""
    
    if [ "$NO_TXID" -gt 0 ]; then
        echo "   1. Register missing vehicles on blockchain:"
        echo "      docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js"
        echo ""
    fi
    
    if [ "$MISSING_ON_FABRIC" -gt 0 ]; then
        echo "   2. Vehicles have blockchain_tx_id but not found on Fabric:"
        echo "      This may indicate Fabric was reset. Re-register these vehicles:"
        echo "      docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js"
        echo ""
    fi
fi

if [ "$SYNCED" -eq "$PG_TOTAL" ] && [ "$PG_TOTAL" -eq "$FABRIC_COUNT" ] && [ "$PG_TOTAL" -gt 0 ]; then
    echo "✅ All vehicles are synchronized!"
else
    echo "⚠️  Data synchronization issues detected"
fi

echo ""
