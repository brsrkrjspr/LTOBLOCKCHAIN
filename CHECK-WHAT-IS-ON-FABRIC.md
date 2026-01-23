# 🔍 Check What's Actually on Fabric

## The Key Insight

**Application Container** (`lto-app`) CAN connect to Fabric:
- ✅ Runs inside Docker on `trustchain` network
- ✅ Can resolve Docker hostnames
- ✅ Logs show: "Real Hyperledger Fabric integration active"

**Scripts on Host** CANNOT connect:
- ❌ Run outside Docker
- ❌ Cannot resolve Docker hostnames
- ❌ Need `localhost` instead

---

## ✅ Solution: Run Script Inside Container

Since the application container CAN connect, run the script there:

```bash
# Run script INSIDE the application container
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

**This will work** because the container is on the same Docker network as Fabric!

---

## Check What's Actually Stored

### Method 1: Via Application Container (Recommended)

```bash
# Query Fabric from inside the container
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

### Method 2: Check Application Logs

```bash
# See if application is using Fabric
docker logs lto-app 2>&1 | grep -i "fabric\|blockchain" | tail -10
```

**Look for:**
- ✅ `"✅ Real Hyperledger Fabric integration active"` = USING FABRIC
- ✅ `"✅ Connected to Hyperledger Fabric network successfully"` = CONNECTED

### Method 3: Check Database

```bash
# Count vehicles with blockchain_tx_id
psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL) as with_txid
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

### Method 4: Check CouchDB Directly

```bash
# List databases
curl -u admin:adminpw http://localhost:5984/_all_dbs

# Query vehicles (if database exists)
curl -u admin:adminpw -X POST http://localhost:5984/ltochannel_vehicle-registration/_find \
  -H "Content-Type: application/json" \
  -d '{"selector": {"docType": "CR"}, "limit": 10}'
```

---

## Most Likely Scenario

Based on your logs showing **"Real Hyperledger Fabric integration active"**:

✅ **Application IS using Fabric**  
⚠️ **But OLD vehicles might not be on Fabric** (registered before mandatory enforcement)  
⚠️ **Scripts can't connect from host** (network issue, not authentication)

---

## Next Steps

1. **Run script inside container:**
   ```bash
   docker exec lto-app node backend/scripts/show-fabric-vehicles.js
   ```

2. **Check database:**
   ```bash
   psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles WHERE blockchain_tx_id IS NOT NULL;"
   ```

3. **Check CouchDB:**
   ```bash
   curl -u admin:adminpw http://localhost:5984/_all_dbs
   ```

This will tell you definitively if Fabric is being used!
