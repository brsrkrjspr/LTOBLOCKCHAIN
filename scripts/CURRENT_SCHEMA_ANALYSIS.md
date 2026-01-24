# 🔍 Current Database Schema Analysis

**Dump File:** `database/dump.sql` (2746 lines)  
**Dump Date:** 2026-01-24 12:22:54  
**PostgreSQL Version:** 15.15

---

## ✅ **WHAT EXISTS IN CURRENT SCHEMA**

### **1. Users Table**
- ✅ `address` column (Line 382) - **EXISTS**

### **2. Functions**
- ✅ `cleanup_expired_blacklist()` function (Lines 125-135) - **EXISTS**
- ✅ `update_updated_at_column()` function (Lines 145-172) - **EXISTS**

### **3. Sequences**
- ✅ `cr_number_seq` (Lines 664-672) - **EXISTS**
- ✅ `mvir_number_seq` (Lines 750-758) - **EXISTS**
- ✅ `or_number_seq` (Lines 793-801) - **EXISTS**

### **4. Critical Tables**
- ✅ `refresh_tokens` table (Lines 808-814) - **EXISTS**
- ✅ `sessions` table (Lines 857-866) - **EXISTS**
- ✅ `token_blacklist` table (Lines 901-907) - **EXISTS**

---

## ⚠️ **MISSING COLUMNS ANALYSIS**

### **Vehicles Table (Lines 402-422)**

**Current columns in dump:**
- Basic columns only: `id`, `vin`, `plate_number`, `make`, `model`, `year`, `color`, `engine_number`, `chassis_number`, `vehicle_type`, `fuel_type`, `transmission`, `engine_displacement`, `owner_id`, `status`, `registration_date`, `last_updated`, `priority`, `notes`

**Missing columns (should exist but not in dump):**
- ❌ `or_number`, `cr_number`
- ❌ `or_issued_at`, `cr_issued_at`
- ❌ `date_of_registration`
- ❌ `net_weight`, `registration_type`, `vehicle_classification`
- ❌ `mvir_number`
- ❌ `inspection_date`, `inspection_result`
- ❌ `insurance_expiry_date`, `registration_expiry_date`
- ❌ `roadworthiness_status`, `inspection_officer`, `inspection_notes`, `inspection_documents`

**Note:** The dump shows the base table definition. If columns were added via `ALTER TABLE`, they may not appear in the initial `CREATE TABLE` statement but should be in the dump. Let me verify.

---

### **Documents Table (Lines 679-694)**

**Current columns in dump:**
- Basic columns: `id`, `vehicle_id`, `document_type`, `filename`, `original_name`, `file_path`, `file_size`, `mime_type`, `file_hash`, `uploaded_by`, `uploaded_at`, `verified`, `verified_at`, `verified_by`

**Missing columns (should exist):**
- ❌ `ipfs_cid`
- ❌ `is_inspection_document`
- ❌ `inspection_document_type`

**Note:** `ipfs_cid` appears in `certificates` table (Line 491) but not in `documents` table.

---

### **Vehicle Verifications Table (Lines 1109-1119)**

**Current columns in dump:**
- Basic columns: `id`, `vehicle_id`, `verification_type`, `status`, `verified_by`, `verified_at`, `notes`, `created_at`, `updated_at`

**Missing columns (should exist):**
- ❌ `automated`
- ❌ `clearance_request_id`
- ❌ `verification_score`
- ❌ `verification_metadata`
- ❌ `auto_verified_at`

**Note:** `clearance_request_id` appears in `certificates` table (Line 486) but not in `vehicle_verifications` table.

---

## 🔍 **VERIFICATION NEEDED**

The dump shows the base `CREATE TABLE` statements, but columns added via `ALTER TABLE` migrations may not be reflected in the initial table definition. We need to verify what actually exists in the database.

---

## 🚀 **VERIFY CURRENT SCHEMA**

Run these commands to check what columns actually exist:

```bash
# Check vehicles table columns
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN (
    'or_number', 'cr_number', 'or_issued_at', 'cr_issued_at',
    'date_of_registration', 'net_weight', 'registration_type',
    'vehicle_classification', 'mvir_number', 'inspection_date',
    'inspection_result', 'insurance_expiry_date', 'registration_expiry_date'
)
ORDER BY column_name;
"

# Check documents table columns
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND column_name IN ('ipfs_cid', 'is_inspection_document', 'inspection_document_type')
ORDER BY column_name;
"

# Check vehicle_verifications table columns
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicle_verifications' 
AND column_name IN ('automated', 'clearance_request_id', 'verification_score', 'verification_metadata', 'auto_verified_at')
ORDER BY column_name;
"
```

---

## 📊 **COMPLETE SCHEMA STATUS CHECK**

Run this comprehensive check:

```bash
echo "=== SCHEMA STATUS CHECK ==="
echo ""
echo "1. Users table - address:"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address') AS exists;"

echo ""
echo "2. Vehicles table - Missing columns check:"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    column_name,
    CASE WHEN column_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
    SELECT unnest(ARRAY[
        'or_number', 'cr_number', 'or_issued_at', 'cr_issued_at',
        'date_of_registration', 'net_weight', 'registration_type',
        'vehicle_classification', 'mvir_number', 'inspection_date',
        'inspection_result', 'insurance_expiry_date', 'registration_expiry_date'
    ]) AS column_name
) expected
LEFT JOIN information_schema.columns actual 
    ON actual.table_name = 'vehicles' 
    AND actual.column_name = expected.column_name
ORDER BY expected.column_name;
"

echo ""
echo "3. Documents table - Missing columns check:"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    column_name,
    CASE WHEN column_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
    SELECT unnest(ARRAY['ipfs_cid', 'is_inspection_document', 'inspection_document_type']) AS column_name
) expected
LEFT JOIN information_schema.columns actual 
    ON actual.table_name = 'documents' 
    AND actual.column_name = expected.column_name
ORDER BY expected.column_name;
"

echo ""
echo "4. Vehicle_verifications table - Missing columns check:"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    column_name,
    CASE WHEN column_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
    SELECT unnest(ARRAY['automated', 'clearance_request_id', 'verification_score', 'verification_metadata', 'auto_verified_at']) AS column_name
) expected
LEFT JOIN information_schema.columns actual 
    ON actual.table_name = 'vehicle_verifications' 
    AND actual.column_name = expected.column_name
ORDER BY expected.column_name;
"

echo ""
echo "5. Functions:"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

echo ""
echo "6. Sequences:"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\ds" | grep -E "or_number_seq|cr_number_seq|mvir_number_seq"
```

---

## ⚠️ **IMPORTANT NOTE**

**The dump shows base table definitions only.**  
If migrations ran successfully, columns added via `ALTER TABLE` may exist in the database but won't appear in the initial `CREATE TABLE` statement in the dump.

**To verify actual schema:**
- Run the verification queries above
- Or check the database directly: `\d vehicles`, `\d documents`, `\d vehicle_verifications`

---

## 🎯 **NEXT STEPS**

1. **Run verification queries** to see what actually exists
2. **If columns are missing**, run the migration scripts again
3. **If columns exist**, the dump just shows the base schema (this is normal)

---

**Status:** ⚠️ **Need to verify actual database state** - Dump shows base schema, but migrations may have added columns!
