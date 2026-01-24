# Migration Fix Summary

**Date:** 2026-01-24  
**Issue:** Migration 006 failed because it references `transfer_requests` table that doesn't exist yet  
**Fix:** Updated migration order and made view creation conditional

---

## ✅ **FIXES APPLIED**

### **1. Migration Order Fixed**

**Updated:** `scripts/run-all-migrations.sh`

**Change:** Added migration 007 BEFORE migration 006:

```bash
# Phase 2.5: Transfer & Registration Workflow (Required before officer metrics view)
run_migration "database/migrations/007_registration_workflow_and_transfer_ownership.sql" "Registration Workflow & Transfer Ownership"

# Phase 3: LTO Roles (CRITICAL)
run_migration "database/migrations/006_add_officer_roles_and_tracking.sql" "Officer Roles & Tracking"
```

**Why:** Migration 007 creates `transfer_requests` and `clearance_requests` tables that migration 006's view depends on.

---

### **2. View Creation Made Conditional**

**Updated:** `database/migrations/006_add_officer_roles_and_tracking.sql`

**Change:** Made `officer_performance_metrics` view creation conditional:

```sql
-- Only create view if required tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_requests')
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clearance_requests') THEN
        -- Create view...
    ELSE
        RAISE NOTICE 'Skipping view creation - tables do not exist yet';
    END IF;
END $$;
```

**Why:** Safety measure - view won't fail if tables don't exist (though they should after running 007 first).

---

### **3. Account Creation Script Fixed**

**Updated:** `database/create-lto-admin-officer-accounts.sql`

**Change:** Handle case where `admin@lto.gov.ph` already has `employee_id = 'LTO-ADMIN-001'`:

```sql
-- If admin@lto.gov.ph exists with LTO-ADMIN-001, update it to lto_admin
-- Otherwise, create new ltoadmin account
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE email = 'admin@lto.gov.ph' AND employee_id = 'LTO-ADMIN-001') THEN
        UPDATE users SET role = 'lto_admin', ... WHERE email = 'admin@lto.gov.ph';
    ELSE
        INSERT INTO users ... VALUES ('ltoadmin@lto.gov.ph', ...);
    END IF;
END $$;
```

**Why:** Migration 006 sets `admin@lto.gov.ph` employee_id to 'LTO-ADMIN-001', causing conflict when trying to create `ltoadmin@lto.gov.ph` with same employee_id.

---

## 🚀 **NEXT STEPS**

Run the updated migration script:

```bash
# Run migrations (now includes 007 before 006)
bash scripts/run-all-migrations.sh

# Create accounts (now handles admin@lto.gov.ph conflict)
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql

# Verify
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT email, role, employee_id, badge_number 
FROM users 
WHERE email IN ('ltoadmin@lto.gov.ph', 'admin@lto.gov.ph', 'ltofficer@lto.gov.ph', 'hpgadmin@hpg.gov.ph')
ORDER BY email;"
```

---

## ✅ **EXPECTED RESULTS**

After running migrations:

1. ✅ Migration 007 runs first (creates `transfer_requests`, `clearance_requests`)
2. ✅ Migration 006 runs second (creates view successfully)
3. ✅ Account creation handles `admin@lto.gov.ph` conflict
4. ✅ All accounts created/updated correctly

---

**Status:** ✅ **FIXED** - Ready to run migrations again.
