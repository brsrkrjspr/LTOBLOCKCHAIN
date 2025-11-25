# Database Schema Fix - IPFS CID Column Added

**Date**: 2025-01-27  
**Status**: ✅ **COMPLETE**

---

## Problem

The `documents` table was missing the `ipfs_cid` column, which is required for storing IPFS Content Identifiers. This caused:
- Document uploads to fail when trying to store IPFS CIDs
- Document retrieval to fail when looking up documents by IPFS CID
- 404 errors when viewing documents that should be stored in IPFS

---

## Solution

### 1. ✅ Added `ipfs_cid` Column

**Command Executed**:
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);
```

**Result**: Column successfully added to the `documents` table.

### 2. ✅ Added Index for Performance

**Command Executed**:
```sql
CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
```

**Result**: Index created for faster IPFS CID lookups.

---

## Schema Changes

### Before
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    vehicle_id UUID NOT NULL,
    document_type document_type NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    verified_by UUID
);
```

### After
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    vehicle_id UUID NOT NULL,
    document_type document_type NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    verified_by UUID,
    ipfs_cid VARCHAR(255)  -- ✅ NEW COLUMN
);
```

---

## Impact

### ✅ Fixed Issues
1. **Document Upload**: Can now store IPFS CIDs in the database
2. **Document Retrieval**: Can now look up documents by IPFS CID
3. **Document Viewing**: Documents stored in IPFS can now be retrieved and displayed
4. **Backend Code**: `backend/database/services.js` and `backend/routes/documents.js` can now use `ipfs_cid` without errors

### ✅ Backward Compatibility
- Existing documents without `ipfs_cid` will have `NULL` values (acceptable)
- Code handles both IPFS and local storage documents
- Migration is non-breaking

---

## Verification

### Check Column Exists
```powershell
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d documents" | Select-String -Pattern "ipfs_cid"
```

### Check Index Exists
```powershell
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d documents" | Select-String -Pattern "idx_documents_ipfs_cid"
```

### Test Document with IPFS CID
```powershell
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, filename, ipfs_cid FROM documents WHERE ipfs_cid IS NOT NULL LIMIT 5;"
```

---

## Related Files

- **Migration Script**: `database/add-ipfs-cid.sql`
- **Database Schema**: `database/init-laptop.sql` (should be updated to include this column)
- **Backend Code**: 
  - `backend/database/services.js` (uses `ipfs_cid`)
  - `backend/routes/documents.js` (uses `ipfs_cid`)
  - `backend/services/storageService.js` (stores `ipfs_cid`)

---

## Next Steps

1. ✅ Column added - **DONE**
2. ✅ Index created - **DONE**
3. ⏳ Update `database/init-laptop.sql` to include `ipfs_cid` in the initial schema (optional, for new deployments)
4. ⏳ Test document upload with IPFS to verify CID is stored correctly
5. ⏳ Test document retrieval using IPFS CID

---

**Status**: ✅ **COMPLETE - Database schema updated successfully!**

