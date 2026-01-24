# Post-Reset Complete Setup Guide

**Date:** 2026-01-24  
**Situation:** Fresh database reset - minimal data, schema may be missing columns  
**Goal:** Complete setup with all migrations, accounts, and employee_id support

---

## 🔍 **CURRENT STATE ANALYSIS**

### **Database Status:**
- ✅ Basic users exist: `admin`, `staff`, `insurance_verifier`, `emission_verifier`, `vehicle_owner`
- ❌ Missing: `lto_admin`, `lto_officer` accounts
- ⚠️ **Schema may be incomplete** - dump shows old column list (no `employee_id`, `badge_number`, etc.)
- ⚠️ **Blockchain mode:** Set to `mock` (needs to be `fabric`)

### **Chaincode Status:**
- ✅ **Should be deployed** with `employee_id` support (from previous reset)
- ⚠️ **Verify** chaincode still has employee_id changes

---

## ✅ **RECOMMENDED ACTION PLAN**

### **Step 1: Run All Migrations (CRITICAL)**

Even though schema exists, run migrations to ensure all columns and roles are present:

```bash
# Run all critical migrations
bash scripts/run-all-migrations.sh
```

**This will:**
- ✅ Add missing columns (`employee_id`, `badge_number`, `department`, etc.)
- ✅ Add new roles (`lto_admin`, `lto_officer`, `lto_supervisor`)
- ✅ Create required tables (`refresh_tokens`, `token_blacklist`, `officer_activity_log`, etc.)
- ✅ Create required functions (`cleanup_expired_blacklist`, etc.)

**Verify migrations:**
```bash
# Check roles
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT unnest(enum_range(NULL::user_role)) as role_values;"

# Check employee_id column exists
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d users" | grep employee_id

# Check tables exist
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "refresh_tokens|token_blacklist|officer_activity_log"
```

---

### **Step 2: Create LTO Admin/Officer Accounts**

```bash
# Create accounts (will update existing if they exist)
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql
```

**Verify accounts:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    email, 
    role, 
    employee_id, 
    badge_number, 
    department,
    is_active
FROM users 
WHERE email IN ('ltoadmin@lto.gov.ph', 'ltofficer@lto.gov.ph', 'hpgadmin@hpg.gov.ph')
ORDER BY role, email;"
```

**Expected output:**
```
        email         |    role     | employee_id  | badge_number | department | is_active 
----------------------+-------------+--------------+--------------+------------+-----------
 ltoadmin@lto.gov.ph  | lto_admin   | LTO-ADMIN-001| ADMIN-001    | Administration | t
 ltofficer@lto.gov.ph | lto_officer | LTO-OFF-001  | OFF-001      | Vehicle Registration | t
 hpgadmin@hpg.gov.ph   | admin       |              |              |            | t
```

---

### **Step 3: Update Blockchain Mode Setting**

**CRITICAL:** Change blockchain mode from `mock` to `fabric`:

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
UPDATE system_settings 
SET value = 'fabric', updated_at = NOW() 
WHERE key = 'blockchain_mode';"

# Verify
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT key, value FROM system_settings WHERE key = 'blockchain_mode';"
```

**Expected:** `blockchain_mode | fabric`

---

### **Step 4: Verify Chaincode Has Employee ID Support**

Since you ran `complete-fabric-reset-reconfigure.sh`, chaincode should already be deployed with `employee_id`. Verify:

```bash
# Check chaincode source code (should have employeeId in officerInfo)
grep -A 5 "employeeId" chaincode/vehicle-registration-production/index.js

# Or query chaincode to verify it's working
docker exec cli peer chaincode query \
  -C ltochannel \
  -n vehicle-registration-production \
  -c '{"function":"GetSystemStats","Args":[]}'
```

**If chaincode doesn't have employee_id:**
- The reset script should have deployed the latest chaincode
- If not, you'll need to redeploy (but this should already be done)

---

### **Step 5: Restart Application**

```bash
# Restart to pick up all changes
docker compose -f docker-compose.unified.yml restart lto-app

# Check logs
docker logs lto-app --tail 50
```

**Look for:**
- ✅ No errors about missing tables/columns
- ✅ Blockchain connection successful
- ✅ Application started successfully

---

## 📋 **COMPLETE SETUP COMMANDS (Copy-Paste)**

Run these commands in order:

```bash
# 1. Run all migrations
bash scripts/run-all-migrations.sh

# 2. Create LTO accounts
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql

# 3. Update blockchain mode to fabric
docker exec postgres psql -U lto_user -d lto_blockchain -c "UPDATE system_settings SET value = 'fabric', updated_at = NOW() WHERE key = 'blockchain_mode';"

# 4. Verify setup
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    'Roles' as check_type,
    COUNT(*) as count
FROM (SELECT unnest(enum_range(NULL::user_role)) as role) roles
UNION ALL
SELECT 
    'LTO Accounts' as check_type,
    COUNT(*) as count
FROM users 
WHERE email IN ('ltoadmin@lto.gov.ph', 'ltofficer@lto.gov.ph', 'hpgadmin@hpg.gov.ph')
UNION ALL
SELECT 
    'Blockchain Mode' as check_type,
    CASE WHEN value = 'fabric' THEN 1 ELSE 0 END as count
FROM system_settings 
WHERE key = 'blockchain_mode';"

# 5. Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# 6. Check application logs
docker logs lto-app --tail 30
```

---

## ✅ **VERIFICATION CHECKLIST**

After running setup, verify:

### **1. Database Schema**
- [ ] `lto_admin`, `lto_officer`, `lto_supervisor` roles exist
- [ ] `users` table has `employee_id`, `badge_number`, `department` columns
- [ ] `refresh_tokens`, `token_blacklist`, `officer_activity_log` tables exist
- [ ] Cleanup functions exist

### **2. Accounts**
- [ ] `ltoadmin@lto.gov.ph` exists with `employee_id = 'LTO-ADMIN-001'`
- [ ] `ltofficer@lto.gov.ph` exists with `employee_id = 'LTO-OFF-001'`
- [ ] `hpgadmin@hpg.gov.ph` exists

### **3. Configuration**
- [ ] `blockchain_mode = 'fabric'` in `system_settings`
- [ ] Application starts without errors
- [ ] Blockchain connection successful

### **4. Chaincode**
- [ ] Chaincode deployed (check from previous reset)
- [ ] Chaincode includes `employeeId` in `officerInfo` (verify source code)

---

## 🚨 **TROUBLESHOOTING**

### **Issue: "column employee_id does not exist"**
**Solution:** Run migrations - `bash scripts/run-all-migrations.sh`

### **Issue: "role lto_admin does not exist"**
**Solution:** Run migration #7 - `database/migrations/006_add_officer_roles_and_tracking.sql`

### **Issue: "duplicate key employee_id"**
**Solution:** Account already exists - this is OK, the script uses `ON CONFLICT DO UPDATE`

### **Issue: Application fails to start**
**Solution:** Check logs - likely missing tables. Run migrations.

### **Issue: Blockchain mode still "mock"**
**Solution:** Update manually - see Step 3 above

---

## 📝 **SUMMARY**

| Step | Action | Status |
|------|--------|--------|
| 1 | Run migrations | ⚠️ **REQUIRED** |
| 2 | Create accounts | ⚠️ **REQUIRED** |
| 3 | Update blockchain mode | ⚠️ **REQUIRED** |
| 4 | Verify chaincode | ✅ Should be done |
| 5 | Restart app | ⚠️ **REQUIRED** |

**Total Time:** ~5-10 minutes

---

**Status:** ✅ **READY TO EXECUTE** - Follow the commands above to complete setup.
