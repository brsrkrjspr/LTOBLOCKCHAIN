# Database Verification Guide

**Date:** 2026-01-24  
**Purpose:** Verify database accounts, roles, and schema after setup

---

## ✅ **QUICK VERIFICATION**

Run these commands on your DigitalOcean server:

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
-- 1. Verify all accounts exist with correct roles
SELECT 
    email, 
    role, 
    organization,
    employee_id,
    badge_number,
    is_active,
    email_verified
FROM users 
WHERE email IN (
    'admin@lto.gov.ph',
    'ltoadmin@lto.gov.ph',
    'ltofficer@lto.gov.ph',
    'hpgadmin@hpg.gov.ph',
    'insurance@insurance.gov.ph'
)
ORDER BY 
    CASE 
        WHEN email = 'admin@lto.gov.ph' THEN 1
        WHEN email = 'ltoadmin@lto.gov.ph' THEN 2
        WHEN email = 'ltofficer@lto.gov.ph' THEN 3
        WHEN email = 'insurance@insurance.gov.ph' THEN 4
        ELSE 5
    END;"
```

---

## 🔍 **COMPREHENSIVE VERIFICATION**

### **1. Verify User Roles Enum**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT unnest(enum_range(NULL::user_role)) as role_values 
ORDER BY role_values;"
```

**Expected Roles:**
- `admin`
- `staff`
- `insurance_verifier`
- `emission_verifier`
- `vehicle_owner`
- `lto_admin`
- `lto_officer`
- `lto_supervisor`

---

### **2. Verify LTO Accounts**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    email,
    role,
    employee_id,
    badge_number,
    department,
    branch_office,
    position,
    is_active
FROM users 
WHERE role IN ('lto_admin', 'lto_officer', 'admin')
ORDER BY role, email;"
```

**Expected:**
- `admin@lto.gov.ph` - Role: `lto_admin`, Employee ID: `LTO-ADMIN-001`
- `ltofficer@lto.gov.ph` - Role: `lto_officer`, Employee ID: `LTO-OFF-001`

---

### **3. Verify Officer Fields Exist**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('employee_id', 'badge_number', 'department', 'branch_office', 'position', 'hire_date')
ORDER BY column_name;"
```

**Expected:** All 6 columns should exist

---

### **4. Verify Critical Tables**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users',
    'vehicles',
    'documents',
    'transfer_requests',
    'clearance_requests',
    'officer_activity_log',
    'refresh_tokens',
    'token_blacklist',
    'email_verification_tokens',
    'sessions'
)
ORDER BY table_name;"
```

**Expected:** All 10 tables should exist

---

### **5. Verify Views**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'officer_performance_metrics';"
```

**Expected:** View should exist (if `transfer_requests` and `clearance_requests` tables exist)

---

### **6. Verify Functions**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'cleanup_expired_blacklist',
    'cleanup_expired_verification_tokens'
)
ORDER BY routine_name;"
```

**Expected:** Both functions should exist

---

### **7. Verify System Settings**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT key, value, updated_at 
FROM system_settings 
WHERE key = 'blockchain_mode';"
```

**Expected:** `blockchain_mode` should be `fabric`

---

## 📋 **ALL-IN-ONE VERIFICATION SCRIPT**

Run this complete verification:

```bash
docker exec postgres psql -U lto_user -d lto_blockchain << 'EOF'
-- ============================================
-- COMPREHENSIVE DATABASE VERIFICATION
-- ============================================

\echo '========================================'
\echo '1. USER ROLES ENUM'
\echo '========================================'
SELECT unnest(enum_range(NULL::user_role)) as role_values 
ORDER BY role_values;

\echo ''
\echo '========================================'
\echo '2. LTO ACCOUNTS'
\echo '========================================'
SELECT 
    email,
    role,
    employee_id,
    badge_number,
    department,
    is_active
FROM users 
WHERE email IN (
    'admin@lto.gov.ph',
    'ltoadmin@lto.gov.ph',
    'ltofficer@lto.gov.ph',
    'hpgadmin@hpg.gov.ph',
    'insurance@insurance.gov.ph'
)
ORDER BY email;

\echo ''
\echo '========================================'
\echo '3. OFFICER FIELDS'
\echo '========================================'
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('employee_id', 'badge_number', 'department', 'branch_office', 'position', 'hire_date')
ORDER BY column_name;

\echo ''
\echo '========================================'
\echo '4. CRITICAL TABLES'
\echo '========================================'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 'vehicles', 'documents', 'transfer_requests', 
    'clearance_requests', 'officer_activity_log', 
    'refresh_tokens', 'token_blacklist', 
    'email_verification_tokens', 'sessions'
)
ORDER BY table_name;

\echo ''
\echo '========================================'
\echo '5. CRITICAL FUNCTIONS'
\echo '========================================'
SELECT routine_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'cleanup_expired_blacklist',
    'cleanup_expired_verification_tokens'
)
ORDER BY routine_name;

\echo ''
\echo '========================================'
\echo '6. BLOCKCHAIN MODE'
\echo '========================================'
SELECT key, value 
FROM system_settings 
WHERE key = 'blockchain_mode';

EOF
```

---

## ✅ **EXPECTED RESULTS**

### **Accounts:**
- ✅ `admin@lto.gov.ph` - `lto_admin`, Employee ID: `LTO-ADMIN-001`
- ✅ `ltofficer@lto.gov.ph` - `lto_officer`, Employee ID: `LTO-OFF-001`
- ✅ `hpgadmin@hpg.gov.ph` - `admin` (HPG org)
- ✅ `insurance@insurance.gov.ph` - `insurance_verifier`

### **Schema:**
- ✅ All 8 user roles in enum
- ✅ All 6 officer fields in `users` table
- ✅ All 10 critical tables exist
- ✅ Both cleanup functions exist
- ✅ `blockchain_mode` = `fabric`

---

## 🔧 **IF VERIFICATION FAILS**

### **Missing Accounts:**
```bash
# Re-run account creation
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql
```

### **Missing Tables/Columns:**
```bash
# Re-run migrations
bash scripts/run-all-migrations.sh
```

### **Wrong Blockchain Mode:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
UPDATE system_settings 
SET value = 'fabric', updated_at = NOW() 
WHERE key = 'blockchain_mode';"
```

---

**Status:** ✅ **VERIFICATION RECOMMENDED** - Run verification to ensure everything is set up correctly.
