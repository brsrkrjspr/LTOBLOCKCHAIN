# Insurance Account Setup

**Date:** 2026-01-24  
**Question:** What about the insurance organization account?

---

## 🔍 **CURRENT STATE**

### **Insurance Account Discrepancy:**

1. **Database Dump Shows:**
   - `insurance@lto.gov.ph` - Role: `insurance_verifier`

2. **create-real-accounts.sql Creates:**
   - `insurance@insurance.gov.ph` - Role: `insurance_verifier`

3. **create-lto-admin-officer-accounts.sql:**
   - ❌ **Missing** - Insurance account not included

---

## ✅ **FIX APPLIED**

### **Added Insurance Account to Comprehensive Script**

**Updated:** `database/create-lto-admin-officer-accounts.sql`

**Added:**
- ✅ Insurance verifier account creation
- ✅ Handles legacy `insurance@lto.gov.ph` → migrates to `insurance@insurance.gov.ph`
- ✅ Uses same password as LTO accounts (`admin123`) for consistency

**Account Details:**
- **Email:** `insurance@insurance.gov.ph`
- **Password:** `admin123` (same hash as LTO accounts)
- **Role:** `insurance_verifier`
- **Organization:** Insurance Verification Office
- **Note:** Insurance verifiers are **external organization** users, so they **do NOT need** `employee_id` (only LTO officers need it)

---

## 📋 **UPDATED ACCOUNT LIST**

### **Accounts Created by `create-lto-admin-officer-accounts.sql`:**

1. ✅ `ltoadmin@lto.gov.ph` - LTO Admin (`lto_admin`) - **Has employee_id**
2. ✅ `ltofficer@lto.gov.ph` - LTO Officer (`lto_officer`) - **Has employee_id**
3. ✅ `hpgadmin@hpg.gov.ph` - HPG Admin (`admin` with HPG org)
4. ✅ `insurance@insurance.gov.ph` - Insurance Verifier (`insurance_verifier`) - **No employee_id** (external org)

---

## 🔄 **LEGACY ACCOUNT HANDLING**

The script now handles the legacy `insurance@lto.gov.ph` account:

```sql
-- Migrate legacy account to new email
UPDATE users 
SET 
    email = 'insurance@insurance.gov.ph',
    organization = 'Insurance Verification Office',
    role = 'insurance_verifier',
    is_active = true,
    email_verified = true
WHERE email = 'insurance@lto.gov.ph'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'insurance@insurance.gov.ph');
```

**Why:** Standardizes on `insurance@insurance.gov.ph` (external organization domain) instead of `insurance@lto.gov.ph` (LTO domain).

---

## ✅ **VERIFICATION**

After running the account creation script:

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    email, 
    role, 
    organization,
    employee_id,
    is_active
FROM users 
WHERE email IN (
    'ltoadmin@lto.gov.ph', 
    'ltofficer@lto.gov.ph', 
    'hpgadmin@hpg.gov.ph', 
    'insurance@insurance.gov.ph',
    'insurance@lto.gov.ph'  -- Check if legacy account still exists
)
ORDER BY role, email;"
```

**Expected:**
- ✅ `insurance@insurance.gov.ph` exists (new account)
- ✅ `insurance@lto.gov.ph` either migrated or doesn't exist

---

## 📝 **SUMMARY**

| Account | Email | Role | Employee ID | Notes |
|---------|-------|------|-------------|-------|
| LTO Admin | `ltoadmin@lto.gov.ph` | `lto_admin` | ✅ Yes (`LTO-ADMIN-001`) | LTO officer |
| LTO Officer | `ltofficer@lto.gov.ph` | `lto_officer` | ✅ Yes (`LTO-OFF-001`) | LTO officer |
| HPG Admin | `hpgadmin@hpg.gov.ph` | `admin` | ❌ No | External org admin |
| Insurance Verifier | `insurance@insurance.gov.ph` | `insurance_verifier` | ❌ No | External org verifier |

**Key Point:** Only LTO officers (`lto_admin`, `lto_officer`, `staff`) need `employee_id` because they're LTO employees. External organization users (HPG, Insurance, Emission) don't need `employee_id`.

---

**Status:** ✅ **FIXED** - Insurance account now included in comprehensive account creation script.
