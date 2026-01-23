# 🔍 CRITICAL: Is Fabric Actually Being Used?

## Your Questions

1. **"Is script connection issue authentication requiring LTO admin account?"**
   - **Answer:** NO - It's a **network resolution issue**, not authentication

2. **"If scripts can't connect, how are we storing records?"**
   - **Answer:** The **APPLICATION CONTAINER** can connect (it's inside Docker)

3. **"Does the system actually store something in Fabric?"**
   - **Answer:** Let's check! This is the critical question.

---

## The Key Difference

### Application Container (lto-app) ✅ CAN CONNECT

**Why:**
- Runs **inside Docker** on `trustchain` network
- Can resolve Docker hostnames: `peer0.lto.gov.ph`
- Has `FABRIC_AS_LOCALHOST=false` (uses Docker network names)
- Shares network with Fabric peers

**Configuration:**
```yaml
# docker-compose.unified.yml
lto-app:
  networks:
    - trustchain  # Same network as Fabric!
  environment:
    - FABRIC_AS_LOCALHOST=false  # Use Docker hostnames
  depends_on:
    - peer0.lto.gov.ph  # Same network!
```

### Scripts Running on Host ❌ CANNOT CONNECT

**Why:**
- Run **outside Docker** (on host machine)
- Cannot resolve Docker hostnames: `peer0.lto.gov.ph`
- Need `FABRIC_AS_LOCALHOST=true` (use localhost)
- Must connect via exposed ports

**The Problem:**
- Scripts try to use `peer0.lto.gov.ph:7051` (Docker hostname)
- Host machine doesn't know what `peer0.lto.gov.ph` is
- Should use `localhost:7051` instead

---

## How to Verify if Fabric is Actually Being Used

### Method 1: Check Application Logs

```bash
# Check if application connected to Fabric
docker logs lto-app 2>&1 | grep -i "fabric\|blockchain" | head -20
```

**Look for:**
- ✅ `"✅ Real Hyperledger Fabric integration active"` = USING FABRIC
- ✅ `"✅ Connected to Hyperledger Fabric network successfully"` = CONNECTED
- ❌ `"BLOCKCHAIN_MODE is not 'fabric'"` = NOT USING FABRIC
- ❌ `"Fabric initialization failed"` = NOT CONNECTED

### Method 2: Check Database for blockchain_tx_id

```bash
psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_registered,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_blockchain_txid,
    COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as without_blockchain_txid
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

**Interpretation:**
- `with_blockchain_txid = 0` → **NOT using Fabric** (vehicles registered before blockchain enforcement)
- `with_blockchain_txid > 0` → **Using Fabric** (at least some vehicles)
- `without_blockchain_txid > 0` → **Partial usage** (some missing blockchain)

### Method 3: Query Fabric Directly (via Application Container)

```bash
# Run script INSIDE the application container (where it can connect)
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

**This will work** because the container is on the same Docker network!

### Method 4: Check CouchDB Directly

```bash
# Access CouchDB from host
curl -u admin:adminpw http://localhost:5984/_all_dbs

# Find the channel database
curl -u admin:adminpw http://localhost:5984/_all_dbs | grep ltochannel

# Query vehicles
curl -u admin:adminpw -X POST http://localhost:5984/ltochannel_vehicle-registration/_find \
  -H "Content-Type: application/json" \
  -d '{"selector": {"docType": "CR"}, "limit": 10}'
```

---

## The Real Answer

### If Application Shows "Real Hyperledger Fabric integration active"

**Then:**
- ✅ Application **CAN** connect to Fabric
- ✅ Application **IS** configured to use Fabric
- ✅ **BUT:** Vehicles registered BEFORE mandatory enforcement might not be on Fabric

### If Vehicles Are Missing blockchain_tx_id

**Then:**
- ⚠️ They were registered **before** blockchain was mandatory
- ⚠️ Old code had fallback: "proceeding without blockchain"
- ⚠️ They're in PostgreSQL only, NOT on Fabric

---

## How to Check What's Actually on Fabric

### Option 1: Run Script Inside Container (Recommended)

```bash
# This will work because container is on Docker network
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

### Option 2: Fix Script for Host Execution

The script needs to use `localhost` when running on host. The `asLocalhost` fix should work, but we need to ensure the connection profile URLs are replaced.

### Option 3: Check CouchDB Web UI

1. Open: `http://localhost:5984/_utils`
2. Login: `admin` / `adminpw`
3. Find database: `ltochannel_vehicle-registration`
4. Browse documents - each is a vehicle on Fabric

---

## Summary

**Your Questions Answered:**

1. **Authentication issue?** NO - Network resolution issue (host vs Docker network)

2. **How are records stored if scripts can't connect?** 
   - Application container CAN connect (it's in Docker)
   - Scripts CANNOT connect (they're on host)
   - **Different network contexts!**

3. **Does system store in Fabric?**
   - **Check:** Run `docker exec lto-app node backend/scripts/show-fabric-vehicles.js`
   - **Check:** Query CouchDB directly
   - **Check:** Count vehicles with `blockchain_tx_id` in database

**Most Likely Scenario:**
- ✅ Application IS using Fabric (logs show "Real Hyperledger Fabric integration active")
- ⚠️ But OLD vehicles might not be on Fabric (registered before mandatory enforcement)
- ⚠️ Scripts can't connect from host (network issue, not authentication)

**Next Step:** Run the script INSIDE the container to see what's actually on Fabric!
