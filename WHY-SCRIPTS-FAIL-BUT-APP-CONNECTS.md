# 🔍 Why Scripts Fail But Application Connects

## The Situation

✅ **Fabric containers ARE running** (peer0, orderer, couchdb)  
✅ **Application connected successfully** on startup  
❌ **Scripts fail to connect** when run manually

## Root Cause Analysis

The application connects on startup and maintains a **singleton gateway connection**. When scripts try to create a **new connection**, they may be:

1. **Hitting connection limits** - Fabric might limit concurrent connections
2. **Gateway not properly closed** - Previous connections might not be closed
3. **Timing issue** - Scripts connect too quickly after application operations
4. **Discovery service issue** - The discovery service might be busy

## The Real Question: Is Fabric Actually Being Used?

Since the application **connected successfully**, let's check what's actually on Fabric:

### Method 1: Check CouchDB (Most Direct)

The CouchDB password is `${COUCHDB_PASSWORD:-adminpw}` from docker-compose. Try:

```bash
# Check what password is actually set
docker exec couchdb cat /opt/couchdb/etc/local.d/docker.ini | grep password

# Or try different common passwords
curl -u admin:adminpw http://localhost:5984/_all_dbs
curl -u admin:password http://localhost:5984/_all_dbs

# If you can access, list databases
curl -u admin:<password> http://localhost:5984/_all_dbs
```

### Method 2: Query via Application's Existing Connection

Since the application IS connected, we can query through it:

```bash
# Check if application can query Fabric
docker exec lto-app node -e "
const fabricService = require('./backend/services/optimizedFabricService');
(async () => {
  try {
    await fabricService.initialize();
    const result = await fabricService.contract.evaluateTransaction('GetAllVehicles');
    console.log('Vehicles on Fabric:', result.toString());
  } catch(e) { console.error(e.message); }
})();
"
```

### Method 3: Check Database for blockchain_tx_id

```bash
# Count vehicles with blockchain transaction IDs
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_registered,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_blockchain_txid
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

**If `with_blockchain_txid > 0` → Fabric IS being used!**

---

## Why Scripts Fail

The script creates a **new gateway connection** each time, which might:
- Conflict with the application's existing connection
- Hit Fabric connection limits
- Fail due to discovery service timing

**Solution:** Use the application's existing connection or wait between connection attempts.

---

## Answer to Your Original Question

**"Does the system actually store something in Fabric?"**

Based on your logs:
- ✅ Application connected successfully
- ✅ Logs show: "✅ Found transaction ID from BLOCKCHAIN_REGISTERED: 0137667b7a4e5c6443e0cf273760d8dbc266afb452e321222366b166a05e45b9"
- ⚠️ But also: "Vehicle with VIN T0EEXKT4NGT8P5H9N not found" (some vehicles missing)

**Answer:** **YES, Fabric IS being used**, but some vehicles might be missing from Fabric (registered before mandatory enforcement).

---

## Next Steps

1. **Check CouchDB password and query directly**
2. **Query via application's connection** (it's already connected)
3. **Count vehicles with blockchain_tx_id** in database

This will definitively show what's on Fabric!
