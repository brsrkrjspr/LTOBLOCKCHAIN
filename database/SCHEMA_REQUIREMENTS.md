# Database Schema Requirements for Transfer Refactoring

## Overview
This document outlines the database schema requirements to ensure accuracy with the transfer of ownership refactoring changes.

---

## Required Schema Changes

### 1. ✅ `documents` Table - Document Type ENUM

**Current State:**
```sql
CREATE TYPE document_type AS ENUM (
    'registration_cert', 
    'insurance_cert', 
    'emission_cert', 
    'owner_id'
);
```

**Required State:**
```sql
CREATE TYPE document_type AS ENUM (
    'registration_cert', 
    'insurance_cert', 
    'emission_cert', 
    'owner_id',
    'deed_of_sale',      -- NEW: For transfer deeds
    'seller_id',         -- NEW: For seller identification
    'buyer_id',          -- NEW: For buyer identification
    'other'              -- NEW: For miscellaneous documents
);
```

**Migration Script:** `database/add-new-document-types.sql`

**Why Needed:**
- The new document type configuration (`backend/config/documentTypes.js`) includes these types
- Transfer documents may be uploaded with these types
- The unified upload pipeline needs to support all document types

---

### 2. ✅ `transfer_documents` Table - Document Type CHECK Constraint

**Current State:**
```sql
CREATE TABLE transfer_documents (
    ...
    document_type VARCHAR(30) NOT NULL CHECK (
        document_type IN (
            'deed_of_sale', 
            'seller_id', 
            'buyer_id', 
            'or_cr', 
            'emission_cert', 
            'insurance_cert', 
            'other'
        )
    ),
    ...
);
```

**Status:** ✅ **Already Correct**

**Why:**
- This table already has the correct CHECK constraint
- It supports all transfer-specific document roles
- No changes needed

---

## Schema Verification Checklist

### ✅ Required Tables

1. **`documents` table**
   - ✅ Must exist
   - ✅ Must have `document_type` column of type `document_type` ENUM
   - ✅ ENUM must include: `registration_cert`, `insurance_cert`, `emission_cert`, `owner_id`, `deed_of_sale`, `seller_id`, `buyer_id`, `other`
   - ✅ Must have `ipfs_cid` column (from `add-ipfs-cid.sql`)

2. **`transfer_requests` table**
   - ✅ Must exist (from `add-transfer-ownership.sql`)
   - ✅ Must have `vehicle_id`, `seller_id`, `buyer_id`, `buyer_info`, `status` columns

3. **`transfer_documents` table**
   - ✅ Must exist (from `add-transfer-ownership.sql`)
   - ✅ Must have `document_type` column with CHECK constraint
   - ✅ CHECK constraint must allow: `deed_of_sale`, `seller_id`, `buyer_id`, `or_cr`, `emission_cert`, `insurance_cert`, `other`

---

## Migration Steps

### Step 1: Run Base Schema (if not already done)
```sql
-- Run init-laptop.sql first
\i database/init-laptop.sql
```

### Step 2: Run IPFS Support (if not already done)
```sql
-- Add IPFS CID column
\i database/add-ipfs-cid.sql
```

### Step 3: Run Transfer Schema (if not already done)
```sql
-- Add transfer tables
\i database/add-transfer-ownership.sql
```

### Step 4: Run New Document Types Migration ⚠️ **REQUIRED**
```sql
-- Add new document types to ENUM
\i database/add-new-document-types.sql
```

---

## Verification Queries

### Check ENUM Values
```sql
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') 
ORDER BY enumsortorder;
```

**Expected Output:**
```
enumlabel
---------------
registration_cert
insurance_cert
emission_cert
owner_id
deed_of_sale      -- Should be present
seller_id         -- Should be present
buyer_id          -- Should be present
other             -- Should be present
```

### Check transfer_documents Constraint
```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%transfer_document%';
```

**Expected Output:**
```
constraint_name: check_transfer_document_type
check_clause: (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other'))
```

### Check documents Table Structure
```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'documents'
AND column_name = 'document_type';
```

**Expected Output:**
```
column_name: document_type
data_type: USER-DEFINED
udt_name: document_type
```

---

## Potential Issues and Solutions

### Issue 1: ENUM Values Already Exist
**Symptom:** Migration script fails with "value already exists" error

**Solution:** The migration script is idempotent - it checks before adding. This is safe to run multiple times.

### Issue 2: Existing Data Uses Old Types
**Symptom:** No issue - old types (`registration_cert`, `insurance_cert`, etc.) are still valid

**Solution:** No data migration needed. Old data continues to work.

### Issue 3: transfer_documents Constraint Mismatch
**Symptom:** Insert fails with constraint violation

**Solution:** Run `add-new-document-types.sql` which will fix the constraint.

---

## Backward Compatibility

### ✅ All Changes Are Backward Compatible

1. **Old document types still work:**
   - `registration_cert` ✅
   - `insurance_cert` ✅
   - `emission_cert` ✅
   - `owner_id` ✅

2. **New document types are additive:**
   - `deed_of_sale` ✅ (new)
   - `seller_id` ✅ (new)
   - `buyer_id` ✅ (new)
   - `other` ✅ (new)

3. **No data migration required:**
   - Existing documents continue to work
   - No need to update existing rows

---

## Testing After Migration

### Test 1: Upload Document with New Type
```sql
-- This should work after migration
INSERT INTO documents (vehicle_id, document_type, filename, original_name, file_path, file_size, mime_type, file_hash)
VALUES (
    'some-vehicle-id',
    'deed_of_sale',  -- New type
    'deed.pdf',
    'deed.pdf',
    '/path/to/deed.pdf',
    12345,
    'application/pdf',
    'hash123'
);
```

### Test 2: Create Transfer with New Document Types
```sql
-- This should work after migration
INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
VALUES (
    'some-transfer-id',
    'deed_of_sale',  -- Transfer role
    'some-document-id',
    'some-user-id'
);
```

---

## Summary

### ✅ Required Actions

1. **Run migration script:** `database/add-new-document-types.sql`
   - Adds new ENUM values to `document_type`
   - Verifies `transfer_documents` constraint

2. **Verify schema:**
   - Run verification queries above
   - Confirm all ENUM values exist
   - Confirm constraints are correct

### ✅ No Breaking Changes

- All existing document types continue to work
- No data migration required
- Backward compatible with existing code

---

**Last Updated:** 2024-01-XX  
**Status:** Ready for migration
