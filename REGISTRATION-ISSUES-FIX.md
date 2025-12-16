# Registration Issues Fix

## Problems Identified

### 1. 503 Service Unavailable (IPFS Down)
**Issue:** Document upload fails with 503 because IPFS service is unavailable, but `STORAGE_MODE=ipfs` requires it.

**Root Cause:** 
- `STORAGE_MODE=ipfs` in docker-compose.unified.yml requires IPFS to be running
- When IPFS is down, document uploads fail with 503
- Frontend continues with registration anyway (by design)

**Fix Applied:**
- Changed `STORAGE_MODE=ipfs` to `STORAGE_MODE=auto` in docker-compose.unified.yml
- This allows fallback to local storage when IPFS is unavailable

### 2. 409 Conflict (Vehicle Already Exists)
**Issue:** Vehicle was created in database even though registration appeared to fail, causing duplicate VIN error on retry.

**Root Cause:**
- Document upload fails (503)
- Frontend shows error but still sends registration request
- Backend creates vehicle successfully (documents are optional)
- User sees error and tries again
- Second attempt fails with 409 because vehicle already exists

**Current Behavior:**
- Vehicle registration creates vehicle BEFORE checking document upload status
- Documents are optional, so registration succeeds even if uploads fail
- No rollback if registration appears to fail from user perspective

**Solutions:**

#### Option 1: Cleanup Orphaned Vehicle (Immediate Fix)
Use the cleanup script to remove the duplicate vehicle:
```bash
bash scripts/cleanup-orphaned-vehicles.sh <VIN>
```

#### Option 2: Check IPFS Status (Prevent Future Issues)
Check if IPFS is running:
```bash
bash scripts/check-ipfs-status.sh
```

If IPFS is down, restart it:
```bash
docker compose -f docker-compose.unified.yml restart ipfs
```

#### Option 3: Use Auto Mode (Already Applied)
Changed `STORAGE_MODE=ipfs` to `STORAGE_MODE=auto` to allow fallback to local storage.

---

## Immediate Actions Required

### 1. Restart Application Container
To apply the STORAGE_MODE change:
```bash
cd ~/LTOBLOCKCHAIN
docker compose -f docker-compose.unified.yml restart lto-app
```

### 2. Check IPFS Status
```bash
bash scripts/check-ipfs-status.sh
```

### 3. Cleanup Orphaned Vehicle
If you have a duplicate VIN, remove it:
```bash
bash scripts/cleanup-orphaned-vehicles.sh <VIN>
```

### 4. Restart IPFS (if needed)
If IPFS is down:
```bash
docker compose -f docker-compose.unified.yml restart ipfs
# Wait 10 seconds
docker compose -f docker-compose.unified.yml logs ipfs --tail=20
```

---

## Long-term Improvements Needed

### 1. Better Error Handling
- Frontend should not send registration if document uploads fail
- Or backend should handle partial failures better

### 2. Transaction Rollback
- Use database transactions to ensure atomicity
- Rollback vehicle creation if any critical step fails

### 3. Better User Feedback
- Show clear message when documents fail to upload
- Explain that registration can proceed without documents
- Or require documents to be uploaded before registration

---

## Current Status

✅ **Fixed:** Changed STORAGE_MODE to 'auto' for fallback
✅ **Created:** IPFS status check script
✅ **Created:** Orphaned vehicle cleanup script

⏳ **Pending:** Restart application container to apply changes
⏳ **Pending:** Cleanup duplicate vehicle (if exists)
⏳ **Pending:** Verify IPFS is running

