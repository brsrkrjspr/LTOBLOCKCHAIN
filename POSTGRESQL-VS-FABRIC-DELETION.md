# 🔄 Removing Vehicles: PostgreSQL vs Fabric

## Your Question

**"If we delete them in postgres, they are still in fabric?"**

**Answer: YES** - Deleting from PostgreSQL does NOT automatically delete from Fabric.

---

## Architecture Overview

Your system has **two separate data stores**:

1. **PostgreSQL** (Off-chain database)
   - Fast queries, searchable
   - Can be modified/deleted
   - Used for UI, reports, search

2. **Hyperledger Fabric** (On-chain blockchain)
   - Immutable ledger
   - Cannot be deleted (only marked as deleted)
   - Used for audit trail, verification

---

## What Happens When You Delete

### ❌ If you ONLY delete from PostgreSQL:

```
PostgreSQL: Vehicle DELETED ❌
Fabric:     Vehicle STILL EXISTS ✅
Result:     DATA INCONSISTENCY ⚠️
```

**Problems:**
- Vehicle still exists on blockchain
- Can be queried via Fabric API
- Data inconsistency between systems
- Audit trail shows vehicle exists but DB doesn't

### ✅ If you delete from BOTH:

```
PostgreSQL: Vehicle DELETED ❌
Fabric:     Vehicle DELETED ❌
Result:     DATA CONSISTENCY ✅
```

---

## Updated Script Behavior

The `remove-vehicles-missing-blockchain.js` script now:

1. **Checks if Fabric is available**
2. **For each vehicle:**
   - Checks if it exists on Fabric
   - If exists → Deletes from Fabric first
   - Then deletes from PostgreSQL
3. **Reports summary** of both deletions

---

## Chaincode Functions Available

### 1. `DeleteVehicle(vin)` - Complete Removal
- **Removes** vehicle from Fabric world state
- **Deletes** all composite keys
- **Preserves** transaction history (immutable ledger)
- **Use case:** Vehicles that should be completely removed

### 2. `ScrapVehicle(vin, reason)` - Mark as Scrapped
- **Marks** vehicle as `SCRAPPED` status
- **Preserves** all data and history
- **Better** for audit trail
- **Use case:** End-of-life vehicles (preserves history)

---

## For Vehicles Missing Blockchain Records

**Most vehicles missing `blockchain_tx_id` likely DON'T exist on Fabric** because:
- They were registered before blockchain integration
- Blockchain transaction failed but DB update succeeded
- They were never registered on blockchain

**The script handles this:**
- Checks if vehicle exists on Fabric
- If not found → Only deletes from PostgreSQL (expected)
- If found → Deletes from both (ensures consistency)

---

## Best Practice

**Always delete from BOTH systems:**

1. **Delete from Fabric first** (if exists)
2. **Then delete from PostgreSQL**

This ensures:
- ✅ Data consistency
- ✅ Complete removal
- ✅ Audit trail preserved (Fabric history remains)

---

## Alternative: Mark as Deleted Instead

Instead of deleting, you could:

1. **Update status** to `DELETED` or `REVOKED`
2. **Keep records** for audit trail
3. **Filter in queries** to exclude deleted vehicles

**Benefits:**
- Preserves audit trail
- Can be restored if needed
- Better for compliance

**Trade-off:**
- Takes up storage space
- Requires filtering logic

---

## Summary

✅ **Updated script** now handles both PostgreSQL and Fabric deletion  
✅ **Checks Fabric** before deleting  
✅ **Reports** what was deleted from each system  
✅ **Handles** vehicles that don't exist on Fabric gracefully  

**Run the script:**
```bash
node backend/scripts/remove-vehicles-missing-blockchain.js
```

It will ensure data consistency between PostgreSQL and Fabric! 🎯
