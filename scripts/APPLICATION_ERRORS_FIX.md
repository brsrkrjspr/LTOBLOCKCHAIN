# 🔧 Application Errors Fix - Missing Database Elements

**Errors Found in Application Logs:**
1. ❌ `function cleanup_expired_verification_tokens() does not exist` (Line 945)
2. ❌ `column v.registration_expiry_date does not exist` (Line 970)

---

## 🚀 **QUICK FIX - Run These Commands**

```bash
# 1. Add missing function: cleanup_expired_verification_tokens()
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS INTEGER AS \$\$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
\$\$ LANGUAGE plpgsql;
"

# 2. Add missing expiry date columns to vehicles table
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS registration_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS insurance_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS expiry_notified_30d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_notified_7d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_notified_1d BOOLEAN DEFAULT FALSE;
"

# 3. Create indexes for expiry date queries
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_expiry ON vehicles(registration_expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry_date);
"

# 4. Verify fixes
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_verification_tokens') AS function_exists;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'registration_expiry_date') AS column_exists;
"

# 5. Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# 6. Check logs (should see no errors)
sleep 10
docker logs lto-app --tail 50
```

---

## 📋 **ALTERNATIVE: Run Migration Files**

If migration files exist, run them:

```bash
# Run email verification migration (includes function)
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_email_verification.sql

# Run expiry tracking migration (includes columns)
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-expiry-tracking.sql

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app && sleep 10 && docker logs lto-app --tail 50
```

---

## 🔍 **ERROR ANALYSIS**

### **Error 1: Missing Function (Line 945)**
```
error: function cleanup_expired_verification_tokens() does not exist
```

**Location:** `server.js:408` calls this function  
**Purpose:** Cleans up expired email verification tokens  
**Fix:** Create the function (see command above)

---

### **Error 2: Missing Column (Line 970)**
```
error: column v.registration_expiry_date does not exist
```

**Location:** `backend/services/expiryService.js:24` queries this column  
**Purpose:** Tracks vehicle registration expiry dates for notifications  
**Fix:** Add the column (see command above)

---

## ✅ **EXPECTED RESULT**

After running fixes:
- ✅ `cleanup_expired_verification_tokens()` function exists
- ✅ `vehicles.registration_expiry_date` column exists
- ✅ `vehicles.insurance_expiry_date` column exists
- ✅ Expiry notification flags exist (`expiry_notified_30d`, `expiry_notified_7d`, `expiry_notified_1d`)
- ✅ Application starts without these errors
- ✅ Expiry service runs successfully

---

## 🎯 **COMPLETE FIX SCRIPT**

Run this all-in-one fix:

```bash
echo "=== FIXING APPLICATION ERRORS ==="

# Add function
echo "1. Adding cleanup_expired_verification_tokens() function..."
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS INTEGER AS \$\$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
\$\$ LANGUAGE plpgsql;
"

# Add columns
echo "2. Adding expiry date columns to vehicles table..."
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS registration_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS insurance_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS expiry_notified_30d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_notified_7d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_notified_1d BOOLEAN DEFAULT FALSE;
"

# Add indexes
echo "3. Creating indexes..."
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_expiry ON vehicles(registration_expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry_date);
"

# Verify
echo "4. Verifying fixes..."
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    'cleanup_expired_verification_tokens()' AS check_item,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_verification_tokens') AS exists
UNION ALL
SELECT 'vehicles.registration_expiry_date', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'registration_expiry_date')
UNION ALL
SELECT 'vehicles.insurance_expiry_date', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'insurance_expiry_date');
"

# Restart
echo "5. Restarting application..."
docker compose -f docker-compose.unified.yml restart lto-app

# Check logs
echo "6. Checking application logs..."
sleep 10
docker logs lto-app --tail 50 | grep -E "ERROR|error|✅|expiry|cleanup" || echo "No errors found!"
```

---

**Status:** ⚠️ **Application errors detected** - Run the fix commands above to resolve!
