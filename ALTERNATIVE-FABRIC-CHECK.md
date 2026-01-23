# 🔍 Alternative Ways to Check Fabric Usage

## Problem

1. Script not found in container (may not be in image)
2. `psql` not installed on host

## ✅ Solutions

### Method 1: Copy Script to Container (Quick Fix)

```bash
# Copy script into running container
docker cp backend/scripts/show-fabric-vehicles.js lto-app:/app/backend/scripts/show-fabric-vehicles.js

# Then run it
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

### Method 2: Use PostgreSQL Container for Database Query

```bash
# Query database via postgres container
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_registered,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_blockchain_txid,
    COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as without_blockchain_txid
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

### Method 3: Check CouchDB Directly (Most Reliable)

```bash
# List all databases (should see ltochannel_vehicle-registration if Fabric is used)
curl -u admin:adminpw http://localhost:5984/_all_dbs

# Query vehicles from CouchDB
curl -u admin:adminpw -X POST http://localhost:5984/ltochannel_vehicle-registration/_find \
  -H "Content-Type: application/json" \
  -d '{"selector": {"docType": "CR"}, "limit": 10}' | jq .
```

### Method 4: Check Application Logs

```bash
# Check if application connected to Fabric
docker logs lto-app 2>&1 | grep -i "fabric\|blockchain\|connected" | tail -20

# Look for:
# ✅ "Real Hyperledger Fabric integration active"
# ✅ "Connected to Hyperledger Fabric network successfully"
# ❌ "Fabric initialization failed"
```

### Method 5: Check Recent Vehicle Registrations

```bash
# Check if recent vehicles have blockchain_tx_id
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    vin,
    plate_number,
    status,
    blockchain_tx_id,
    created_at
FROM vehicles 
WHERE status = 'REGISTERED'
ORDER BY created_at DESC
LIMIT 10;
"
```

---

## Recommended: Check CouchDB First

CouchDB is the **most direct** way to see what's on Fabric:

```bash
# 1. List databases
curl -u admin:adminpw http://localhost:5984/_all_dbs

# 2. If you see ltochannel_vehicle-registration, query it
curl -u admin:adminpw http://localhost:5984/ltochannel_vehicle-registration/_all_docs?limit=10

# 3. Get a specific vehicle document
curl -u admin:adminpw http://localhost:5984/ltochannel_vehicle-registration/VIN_HERE
```

This will tell you **definitively** if Fabric is storing vehicles!
