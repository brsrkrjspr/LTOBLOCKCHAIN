# PostgreSQL ↔ Fabric Data Synchronization Guide

## Overview

Your system uses a **dual-database architecture**:
- **PostgreSQL**: Application database (fast queries, relational data)
- **Hyperledger Fabric/CouchDB**: Blockchain state (immutable, audit trail)

**Critical:** These systems are **manually synchronized** - data must be written to BOTH systems.

---

## How Synchronization Works

### Vehicle Registration Flow

1. **PostgreSQL First** (Application creates record)
   ```sql
   INSERT INTO vehicles (vin, plate_number, status, ...) 
   VALUES (...);
   -- Status: SUBMITTED
   ```

2. **Fabric Registration** (After admin approval)
   ```javascript
   const result = await fabricService.registerVehicle(vehicleData);
   const blockchainTxId = result.transactionId;
   ```

3. **Link Together** (Update PostgreSQL with Fabric TX ID)
   ```sql
   UPDATE vehicles 
   SET blockchain_tx_id = $1, status = 'REGISTERED'
   WHERE id = $2;
   ```

**The `blockchain_tx_id` field is the BRIDGE between systems!**

---

## Verification Commands

### Quick Check: Are They Synced?

```bash
# Run verification script
bash scripts/verify-postgres-fabric-sync.sh
```

### Manual Verification

```bash
# 1. Count vehicles in PostgreSQL
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_registered,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as synced_with_fabric,
    COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as not_synced
FROM vehicles 
WHERE status IN ('REGISTERED', 'APPROVED');
"

# 2. Count vehicles on Fabric
docker exec lto-app node backend/scripts/query-fabric-vehicles.js
```

---

## After Fabric Reset

**⚠️ CRITICAL:** When you reset Fabric blockchain:

1. **All Fabric data is cleared** (vehicles, transactions, state)
2. **PostgreSQL still has vehicles** with `blockchain_tx_id` values
3. **Those transaction IDs no longer exist** in Fabric

### Solution: Re-register Vehicles

```bash
# Re-register all vehicles from PostgreSQL to Fabric
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js
```

This script will:
- Find vehicles in PostgreSQL with `status = 'REGISTERED'`
- Check if they exist on Fabric
- Re-register missing vehicles on Fabric
- Update `blockchain_tx_id` with new transaction IDs

---

## Common Sync Issues

### Issue 1: Vehicle in PostgreSQL but NOT in Fabric

**Symptom:** `blockchain_tx_id` is NULL or empty

**Cause:**
- Registered before blockchain was mandatory
- Blockchain write failed (network error, chaincode error)
- Fabric was reset but vehicle wasn't re-registered

**Fix:**
```bash
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js
```

---

### Issue 2: Vehicle has blockchain_tx_id but NOT on Fabric

**Symptom:** `blockchain_tx_id` exists but vehicle not found on Fabric

**Cause:**
- Fabric was reset (transaction IDs are now invalid)
- Vehicle was deleted from Fabric but PostgreSQL wasn't updated
- Transaction ID is invalid/incorrect format

**Fix:**
```bash
# Clear invalid transaction IDs
docker exec postgres psql -U lto_user -d lto_blockchain -c "
UPDATE vehicles 
SET blockchain_tx_id = NULL 
WHERE status = 'REGISTERED' 
AND blockchain_tx_id IS NOT NULL;
"

# Then re-register
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js
```

---

### Issue 3: Data Mismatch

**Symptom:** Same VIN has different data in PostgreSQL vs Fabric

**Cause:**
- Manual updates to one system without updating the other
- Partial transaction failure

**Fix:**
- **PostgreSQL is source of truth** for application data
- Re-register from PostgreSQL to Fabric to sync

---

## Ownership Transfer Synchronization

### Transfer Flow

1. **PostgreSQL Update** (Update owner in database)
   ```sql
   UPDATE vehicles SET owner_id = $1 WHERE id = $2;
   ```

2. **Fabric Transfer** (Update owner on blockchain)
   ```javascript
   await fabricService.transferOwnership(vin, newOwnerData, transferData);
   ```

3. **Link Together** (Update transaction ID)
   ```sql
   UPDATE vehicles 
   SET blockchain_tx_id = $1 
   WHERE vin = $2;
   ```

**Note:** Transfer creates a NEW transaction ID - old registration TX ID is replaced.

---

## Verification Checklist

After any major operation, verify sync:

- [ ] Run verification script: `bash scripts/verify-postgres-fabric-sync.sh`
- [ ] Check counts match: PostgreSQL count = Fabric count
- [ ] Verify all REGISTERED vehicles have `blockchain_tx_id`
- [ ] Test querying a vehicle from Fabric using VIN
- [ ] Check vehicle history includes blockchain transactions

---

## Best Practices

1. **Always verify sync after:**
   - Fabric reset
   - Chaincode deployment
   - Network restart
   - Database restore

2. **Monitor for sync issues:**
   - Set up alerts for vehicles without `blockchain_tx_id`
   - Regular sync verification (daily/weekly)

3. **When in doubt:**
   - PostgreSQL is source of truth for application
   - Re-register from PostgreSQL to Fabric to fix sync

---

## Scripts Available

| Script | Purpose |
|--------|---------|
| `verify-postgres-fabric-sync.sh` | Compare PostgreSQL and Fabric data |
| `register-missing-vehicles-on-blockchain.js` | Re-register vehicles from PostgreSQL to Fabric |
| `query-fabric-vehicles.js` | List all vehicles on Fabric |
| `backfill-blockchain-tx-ids.js` | Fix missing transaction IDs from Fabric history |

---

**Last Updated:** 2026-01-24
