# 🔧 Complete Database Schema Fix Script

**Purpose:** Fix all missing columns and functions identified in dump restore analysis.

---

## 🚀 **ALL-IN-ONE FIX COMMAND**

```bash
# 1. Add missing columns to users table
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);"

# 2. Add OR/CR columns to vehicles table
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/separate-or-cr.sql

# 3. Add inspection columns to vehicles table
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-inspection-columns.sql

# 4. Add missing columns to documents table
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);
"

# 5. Add missing columns to vehicle_verifications table
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS automated BOOLEAN DEFAULT false;
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS clearance_request_id UUID;
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS verification_score INTEGER;
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}';
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS auto_verified_at TIMESTAMP;
"

# 6. Add missing columns to vehicles table (insurance_expiry_date, registration_expiry_date)
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry_date TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_expiry_date TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_expiry ON vehicles(registration_expiry_date);
"

# 7. Verify function exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

# 8. Verify all critical tables exist
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt refresh_tokens; \dt token_blacklist; \dt sessions"

# 9. Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# 10. Check logs
sleep 10
docker logs lto-app --tail 50
```

---

## 📋 **STEP-BY-STEP BREAKDOWN**

### **Step 1: Fix Users Table**
```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);"
```

### **Step 2: Fix Vehicles Table - OR/CR Columns**
```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/separate-or-cr.sql
```

**This adds:**
- `or_number`, `cr_number`
- `or_issued_at`, `cr_issued_at`
- `date_of_registration`
- `net_weight`, `registration_type`, `vehicle_classification`

### **Step 3: Fix Vehicles Table - Inspection Columns**
```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-inspection-columns.sql
```

**This adds:**
- `mvir_number`
- `inspection_date`, `inspection_result`
- `roadworthiness_status`
- `inspection_officer`, `inspection_notes`, `inspection_documents`

### **Step 4: Fix Documents Table**
```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);
"
```

### **Step 5: Fix Vehicle Verifications Table**
```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS automated BOOLEAN DEFAULT false;
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS clearance_request_id UUID;
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS verification_score INTEGER;
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}';
ALTER TABLE vehicle_verifications ADD COLUMN IF NOT EXISTS auto_verified_at TIMESTAMP;
"
```

### **Step 6: Add Missing Indexes for Vehicles**
```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
CREATE INDEX IF NOT EXISTS idx_vehicles_cr_number ON vehicles(cr_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_mvir ON vehicles(mvir_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_or_number ON vehicles(or_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_date_of_registration ON vehicles(date_of_registration);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_date ON vehicles(inspection_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_result ON vehicles(inspection_result);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_expiry ON vehicles(registration_expiry_date);
"
```

---

## 🔍 **VERIFICATION COMMANDS**

After running fixes, verify everything:

```bash
# Check users table
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\d users" | grep address

# Check vehicles table columns
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('or_number', 'cr_number', 'mvir_number', 'inspection_date', 'registration_expiry_date', 'insurance_expiry_date')
ORDER BY column_name;
"

# Check documents table columns
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'documents' 
AND column_name IN ('ipfs_cid', 'is_inspection_document', 'inspection_document_type')
ORDER BY column_name;
"

# Check vehicle_verifications table columns
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vehicle_verifications' 
AND column_name IN ('automated', 'clearance_request_id')
ORDER BY column_name;
"

# Check function exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

# Check critical tables
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt refresh_tokens; \dt token_blacklist; \dt sessions"
```

---

## ⚠️ **IMPORTANT NOTES**

1. **Missing Functions:** The dump showed 6 missing functions. These are likely in separate migration files. Check if they exist:
   ```bash
   docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df"
   ```

2. **Foreign Key Constraint:** Line 371 showed error about `clearance_request_id` foreign key. After adding the column, you may need to add the constraint:
   ```bash
   docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
   ALTER TABLE vehicle_verifications 
   ADD CONSTRAINT vehicle_verifications_clearance_request_id_fkey 
   FOREIGN KEY (clearance_request_id) REFERENCES clearance_requests(id) ON DELETE SET NULL;
   "
   ```

3. **Application Restart:** Always restart the application after schema changes.

---

## 🎯 **EXPECTED RESULT**

After running all fixes:
- ✅ All missing columns added
- ✅ All indexes created
- ✅ `cleanup_expired_blacklist()` function exists
- ✅ Application starts successfully
- ✅ No schema errors in logs

---

**Status:** ⚠️ **Run the fix commands above to complete schema migration!**
