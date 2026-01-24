# Account Creation - Error Fix

## ❌ **Error Encountered**

```
ERROR: duplicate key value violates unique constraint "users_employee_id_key"
DETAIL: Key (employee_id)=(LTO-OFF-001) already exists.
```

## ✅ **What Succeeded**

- ✅ `admin@lto.gov.ph` → Updated to `lto_admin` role
- ✅ `insurance@insurance.gov.ph` → Updated
- ✅ `hpg@hpg.gov.ph` → Created

## ❌ **What Failed**

- ❌ `ltoofficer@lto.gov.ph` → Failed because `LTO-OFF-001` exists on another account

---

## 🔧 **Solution: Two Options**

### **Option 1: Run Fixed Script (Recommended)**

The main script has been updated to handle employee_id conflicts. Run it again:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql
```

The updated script will:
1. Check if `ltoofficer@lto.gov.ph` already exists → Update it
2. If `LTO-OFF-001` exists on different account → Clear it first
3. Then create the officer account

### **Option 2: Quick Fix Script**

Run the quick fix script to create just the missing officer account:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/fix-officer-account.sql
```

---

## ✅ **After Running Fix**

Verify all accounts exist:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, employee_id FROM users WHERE email IN ('ltoadmin@lto.gov.ph', 'ltoofficer@lto.gov.ph', 'hpg@hpg.gov.ph', 'insurance@insurance.gov.ph', 'admin@lto.gov.ph') ORDER BY email;"
```

**Expected Result:** All 5 accounts should exist.

---

## 📋 **Account Summary**

| Email | Password | Role | Status |
|-------|----------|------|--------|
| `admin@lto.gov.ph` | `admin123` | `lto_admin` | ✅ Created |
| `ltoadmin@lto.gov.ph` | `admin123` | `lto_admin` | ⚠️ Not created (not needed if admin@lto.gov.ph exists) |
| `ltoofficer@lto.gov.ph` | `admin123` | `lto_officer` | ❌ **NEEDS FIX** |
| `hpg@hpg.gov.ph` | `admin123` | `admin` | ✅ Created |
| `insurance@insurance.gov.ph` | `admin123` | `insurance_verifier` | ✅ Created |

---

**Status:** ⚠️ **PARTIAL SUCCESS** - Run fix script to complete account creation.
