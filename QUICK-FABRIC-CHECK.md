# 🔍 Quick Fix: Check What's on Fabric

## Issue 1: Script Not in Container

**Fix:** Copy script into container, then run it:

```bash
# Copy script to container
docker cp backend/scripts/show-fabric-vehicles.js lto-app:/app/backend/scripts/show-fabric-vehicles.js

# Run it
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

## Issue 2: psql Not Installed on Host

**Fix:** Use PostgreSQL container instead:

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

---

## ✅ BEST METHOD: Check CouchDB Directly

CouchDB is Fabric's state database - this is the **most reliable** way:

```bash
# 1. List all databases (should see ltochannel_vehicle-registration if Fabric is used)
curl -u admin:adminpw http://localhost:5984/_all_dbs

# 2. If database exists, count documents
curl -u admin:adminpw http://localhost:5984/ltochannel_vehicle-registration/_all_docs?limit=5

# 3. Get detailed vehicle count
curl -u admin:adminpw http://localhost:5984/ltochannel_vehicle-registration/_all_docs | grep -o '"id":"[^"]*"' | wc -l
```

**If you see `ltochannel_vehicle-registration` database → Fabric IS being used!**

---

## Quick Check Commands

Run these in order:

```bash
# 1. Check CouchDB databases
curl -u admin:adminpw http://localhost:5984/_all_dbs

# 2. Check database via postgres container
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total, COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL) as with_txid FROM vehicles WHERE status = 'REGISTERED';"

# 3. Check application logs
docker logs lto-app 2>&1 | grep -i "fabric\|blockchain" | tail -5

# 4. Copy and run script
docker cp backend/scripts/show-fabric-vehicles.js lto-app:/app/backend/scripts/show-fabric-vehicles.js
docker exec lto-app node backend/scripts/show-fabric-vehicles.js
```

This will tell you **definitively** if Fabric is storing vehicles!
