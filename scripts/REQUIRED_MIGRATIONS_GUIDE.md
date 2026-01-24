# Required Database Migrations Guide

**Date:** 2026-01-24  
**Purpose:** Complete list of migrations needed for LTO Admin/Officer functionality

---

## 🔴 **CRITICAL: Migration Order**

Migrations **MUST** be run in this order. Some migrations depend on previous ones.

---

## ✅ **MIGRATION CHECKLIST**

### **Phase 1: Core Application Migrations (Required for App Startup)**

These migrations are required for the application to start without errors:

#### **1. Refresh Tokens & Sessions**
**File:** `backend/migrations/add_refresh_tokens.sql`  
**Purpose:** Adds `refresh_tokens` and `sessions` tables for JWT refresh token system  
**Status:** ⚠️ **CRITICAL** - App will fail without this

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql
```

**Verify:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d refresh_tokens"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d sessions"
```

---

#### **2. Token Blacklist**
**File:** `backend/migrations/add_token_blacklist.sql`  
**Purpose:** Adds `token_blacklist` table and `cleanup_expired_blacklist()` function  
**Status:** ⚠️ **CRITICAL** - App will fail without this

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
```

**Verify:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d token_blacklist"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"
```

---

#### **3. Email Verification**
**File:** `backend/migrations/add_email_verification.sql`  
**Purpose:** Adds `email_verification_tokens` table and `cleanup_expired_verification_tokens()` function  
**Status:** ⚠️ **CRITICAL** - Required for email verification system

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_email_verification.sql
```

**Verify:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d email_verification_tokens"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_verification_tokens"
```

---

### **Phase 2: Vehicle & Inspection Migrations**

#### **4. Inspection Columns**
**File:** `backend/migrations/add-inspection-columns.sql`  
**Purpose:** Adds MVIR tracking, inspection columns to `vehicles` table, inspection document support  
**Status:** ✅ **REQUIRED** - For vehicle inspection functionality

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-inspection-columns.sql
```

**Verify:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d vehicles" | grep -E "mvir_number|inspection_date|inspection_result"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d documents" | grep -E "is_inspection_document|inspection_document_type"
```

---

#### **5. Expiry Tracking**
**File:** `backend/migrations/add-expiry-tracking.sql`  
**Purpose:** Adds `registration_expiry_date`, `insurance_expiry_date`, `emission_expiry_date` columns and `expiry_notifications` table  
**Status:** ✅ **REQUIRED** - For expiry notification system

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-expiry-tracking.sql
```

**Verify:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d vehicles" | grep -E "registration_expiry_date|insurance_expiry_date|emission_expiry_date"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d expiry_notifications"
```

---

#### **6. Blockchain TX ID**
**File:** `database/migrations/add-blockchain-tx-id-to-vehicles.sql`  
**Purpose:** Adds `blockchain_tx_id` column to `vehicles` table for Fabric transaction tracking  
**Status:** ✅ **REQUIRED** - For blockchain integration

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/migrations/add-blockchain-tx-id-to-vehicles.sql
```

**Verify:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d vehicles" | grep blockchain_tx_id
```

---

### **Phase 3: LTO Admin/Officer Roles (CRITICAL FOR NEW FEATURES)**

#### **7. Officer Roles & Tracking** ⚠️ **MUST RUN BEFORE CREATING ACCOUNTS**
**File:** `database/migrations/006_add_officer_roles_and_tracking.sql`  
**Purpose:** 
- Adds `lto_admin`, `lto_officer`, `lto_supervisor` roles to `user_role` enum
- Adds officer-specific columns to `users` table (employee_id, badge_number, department, etc.)
- Creates `officer_activity_log` table
- Creates `officer_performance_metrics` view
- Adds trigger for auto-logging officer activities

**Status:** 🔴 **CRITICAL** - Required before running account creation script

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/migrations/006_add_officer_roles_and_tracking.sql
```

**Verify:**
```bash
# Check enum values
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT unnest(enum_range(NULL::user_role)) as role_values;"

# Check new columns
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d users" | grep -E "employee_id|badge_number|department|branch_office"

# Check new table
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d officer_activity_log"

# Check new view
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d+ officer_performance_metrics"
```

**Expected Enum Values:**
```
admin
staff
insurance_verifier
emission_verifier
vehicle_owner
lto_admin          ← NEW
lto_officer        ← NEW
lto_supervisor     ← NEW
```

---

### **Phase 4: Additional Feature Migrations (Optional but Recommended)**

#### **8. Scrapped Status**
**File:** `backend/migrations/add-scrapped-status.sql`  
**Purpose:** Adds `SCRAPPED` status to `vehicle_status` enum  
**Status:** ⚠️ **OPTIONAL** - Only if scrapping vehicles is needed

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-scrapped-status.sql
```

---

#### **9. Verification Mode**
**File:** `backend/migrations/add-verification-mode.sql`  
**Purpose:** Adds `verification_mode` column to `clearance_requests` table  
**Status:** ⚠️ **OPTIONAL** - Only if verification mode tracking is needed

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-verification-mode.sql
```

---

#### **10. Origin Type**
**File:** `backend/migrations/add_origin_type_to_vehicles.sql`  
**Purpose:** Adds `origin_type` column to `vehicles` table  
**Status:** ⚠️ **OPTIONAL** - Only if vehicle origin tracking is needed

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_origin_type_to_vehicles.sql
```

---

## 🚀 **QUICK START: Run All Critical Migrations**

Run this script to execute all critical migrations in order:

```bash
#!/bin/bash
# Run all critical migrations

echo "🔄 Running critical database migrations..."

# Phase 1: Core Application
echo "📦 Phase 1: Core Application Migrations..."
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_email_verification.sql

# Phase 2: Vehicle & Inspection
echo "🚗 Phase 2: Vehicle & Inspection Migrations..."
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-inspection-columns.sql
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add-expiry-tracking.sql
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/migrations/add-blockchain-tx-id-to-vehicles.sql

# Phase 3: LTO Roles (CRITICAL)
echo "👮 Phase 3: LTO Admin/Officer Roles Migration..."
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/migrations/006_add_officer_roles_and_tracking.sql

echo "✅ All critical migrations completed!"
echo ""
echo "🔍 Verifying migrations..."
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT unnest(enum_range(NULL::user_role)) as role_values;"
```

---

## 📋 **POST-MIGRATION: Create Accounts**

**After running migration #7 (006_add_officer_roles_and_tracking.sql),** create the LTO accounts:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql
```

**Verify accounts:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, employee_id, badge_number, department FROM users WHERE email IN ('ltoadmin@lto.gov.ph', 'ltofficer@lto.gov.ph', 'hpgadmin@hpg.gov.ph');"
```

---

## 🔍 **VERIFICATION CHECKLIST**

After running migrations, verify:

### **1. Core Tables Exist**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "refresh_tokens|token_blacklist|sessions|email_verification_tokens|expiry_notifications|officer_activity_log"
```

### **2. Functions Exist**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\df" | grep -E "cleanup_expired_blacklist|cleanup_expired_verification_tokens|cleanup_expired_tokens"
```

### **3. Enum Values**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT unnest(enum_range(NULL::user_role)) as role_values;"
```

### **4. Vehicle Columns**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d vehicles" | grep -E "mvir_number|inspection_date|registration_expiry_date|blockchain_tx_id"
```

### **5. User Columns**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d users" | grep -E "employee_id|badge_number|department|branch_office|email_verified"
```

---

## ⚠️ **TROUBLESHOOTING**

### **Error: "relation already exists"**
- **Cause:** Migration already run
- **Solution:** Migrations use `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`, so safe to re-run

### **Error: "enum value already exists"**
- **Cause:** Enum value already added
- **Solution:** Migration uses `ADD VALUE IF NOT EXISTS`, so safe to re-run

### **Error: "function already exists"**
- **Cause:** Function already created
- **Solution:** Migrations use `CREATE OR REPLACE FUNCTION`, so safe to re-run

### **Error: "column already exists"**
- **Cause:** Column already added
- **Solution:** Migrations use `ADD COLUMN IF NOT EXISTS`, so safe to re-run

---

## 📝 **MIGRATION SUMMARY**

| # | Migration File | Phase | Status | Required For |
|---|---------------|-------|--------|--------------|
| 1 | `add_refresh_tokens.sql` | 1 | 🔴 Critical | App startup |
| 2 | `add_token_blacklist.sql` | 1 | 🔴 Critical | App startup |
| 3 | `add_email_verification.sql` | 1 | 🔴 Critical | Email verification |
| 4 | `add-inspection-columns.sql` | 2 | ✅ Required | Vehicle inspection |
| 5 | `add-expiry-tracking.sql` | 2 | ✅ Required | Expiry notifications |
| 6 | `add-blockchain-tx-id-to-vehicles.sql` | 2 | ✅ Required | Blockchain integration |
| 7 | `006_add_officer_roles_and_tracking.sql` | 3 | 🔴 Critical | LTO Admin/Officer features |
| 8 | `add-scrapped-status.sql` | 4 | ⚠️ Optional | Vehicle scrapping |
| 9 | `add-verification-mode.sql` | 4 | ⚠️ Optional | Verification mode tracking |
| 10 | `add_origin_type_to_vehicles.sql` | 4 | ⚠️ Optional | Vehicle origin tracking |

---

## ✅ **NEXT STEPS**

1. ✅ Run migrations #1-7 (all critical/required)
2. ✅ Create accounts using `database/create-lto-admin-officer-accounts.sql`
3. ✅ Restart application: `docker compose -f docker-compose.unified.yml restart lto-app`
4. ✅ Test login with `ltoadmin@lto.gov.ph` and `ltofficer@lto.gov.ph`
5. ✅ Verify dashboard access and permissions

---

**Status:** ✅ **READY TO RUN** - All migrations are idempotent and safe to re-run.
