# 🔍 PostgreSQL vs CouchDB/Fabric: The Relationship

## Critical Answer: **NO, PostgreSQL does NOT automatically reflect CouchDB/Fabric**

They are **separate, independent systems** that the application keeps in sync **manually**.

---

## Architecture Overview

### PostgreSQL (Application Database)
- **Purpose:** Application's source of truth
- **Stores:** Vehicles, users, transfers, documents, application state
- **Type:** Traditional relational database
- **Access:** Direct SQL queries

### CouchDB (Fabric State Database)
- **Purpose:** Hyperledger Fabric's current state storage
- **Stores:** Current state of blockchain assets (vehicles)
- **Type:** Document database (NoSQL)
- **Access:** Via Fabric chaincode queries

### Fabric Ledger (Blockchain)
- **Purpose:** Immutable transaction history
- **Stores:** All transactions (register, transfer, update, etc.)
- **Type:** Immutable append-only ledger
- **Access:** Via Fabric chaincode queries

---

## How They Stay in Sync

The application **manually writes to both** when registering a vehicle:

### Step 1: Write to PostgreSQL First
```javascript
// backend/routes/lto.js (line ~773)
const newVehicle = await db.createVehicle({
    vin: vehicle.vin,
    plateNumber: vehicle.plateNumber,
    // ... other fields
    status: 'SUBMITTED'
});
```

### Step 2: Write to Fabric (Updates CouchDB)
```javascript
// backend/routes/lto.js (line ~773)
const result = await fabricService.registerVehicle(vehicleData);
const blockchainTxId = result.transactionId;
```

### Step 3: Link Them Together
```javascript
// Update PostgreSQL with Fabric transaction ID
await db.query(
    `UPDATE vehicles 
     SET blockchain_tx_id = $1, status = 'REGISTERED'
     WHERE id = $2`,
    [blockchainTxId, vehicle.id]
);
```

**The `blockchain_tx_id` field is the BRIDGE between PostgreSQL and Fabric!**

---

## What Happens When They're Out of Sync?

### Scenario 1: Vehicle in PostgreSQL but NOT in Fabric
- **Symptom:** `blockchain_tx_id` is NULL or empty
- **Cause:** Registered before blockchain was mandatory, or blockchain write failed
- **Example:** Vehicle `T0EEXKT4NGT8P5H9N` from your logs

### Scenario 2: Vehicle in Fabric but NOT in PostgreSQL
- **Symptom:** Shouldn't happen (application creates PostgreSQL record first)
- **Cause:** Database rollback after Fabric write, or manual Fabric operations

### Scenario 3: Data Mismatch
- **Symptom:** Same VIN has different data in PostgreSQL vs Fabric
- **Cause:** Manual updates to one system without updating the other

---

## How to Check Sync Status

### Method 1: Count Vehicles with blockchain_tx_id
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_registered,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as synced_with_fabric,
    COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as not_synced
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

**Interpretation:**
- `synced_with_fabric` = Vehicles that exist in BOTH PostgreSQL and Fabric
- `not_synced` = Vehicles that exist ONLY in PostgreSQL

### Method 2: Compare Counts
```bash
# Count in PostgreSQL
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles WHERE status = 'REGISTERED';"

# Count in Fabric (via application)
docker exec lto-app node backend/scripts/query-fabric-vehicles.js
```

**If counts differ → They're out of sync!**

---

## Why This Architecture?

### Benefits:
1. **Performance:** PostgreSQL is fast for application queries
2. **Blockchain Integrity:** Fabric provides immutability and audit trail
3. **Hybrid Approach:** Best of both worlds

### Trade-offs:
1. **Manual Sync:** Application must write to both systems
2. **Potential Drift:** Can get out of sync if writes fail
3. **Complexity:** Two systems to maintain

---

## Current State (Based on Your Logs)

From your logs:
- ✅ Application connected to Fabric successfully
- ✅ Some vehicles have `blockchain_tx_id` (synced)
- ⚠️ Some vehicles missing from Fabric (not synced)

**This is why we see:**
- "Vehicle with VIN T0EEXKT4NGT8P5H9N not found" (in Fabric)
- "✅ Found transaction ID from BLOCKCHAIN_REGISTERED" (some vehicles ARE synced)

---

## Summary

**PostgreSQL ≠ CouchDB/Fabric**

- They are **separate systems**
- Application **manually syncs** them
- `blockchain_tx_id` is the **link** between them
- They can get **out of sync** if writes fail
- **Check sync status** by counting vehicles with `blockchain_tx_id`

**To verify sync:** Run the database query above to see how many vehicles are synced vs not synced!
