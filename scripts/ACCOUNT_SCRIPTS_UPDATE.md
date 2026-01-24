# Account Creation Scripts Update

**Date:** 2026-01-24  
**Status:** ✅ FIXED

---

## ✅ **FIXES APPLIED**

### **1. HPG Account Restored**

**Issue:** HPG account was missing from `create-lto-admin-officer-accounts.sql`

**Fix:** Added HPG Admin account to the script:
- **Email:** `hpgadmin@hpg.gov.ph`
- **Password:** `SecurePass123!`
- **Role:** `admin` (with HPG organization)
- **Organization:** Highway Patrol Group

**Location:** `database/create-lto-admin-officer-accounts.sql:95-115`

---

### **2. Emission Account Removed**

**Issue:** Emission verifier account is no longer needed

**Fix:** Removed emission verifier account creation from:
- ✅ `database/create-real-accounts.sql` - Removed emission verifier INSERT statement
- ✅ `database/create-real-accounts.sql` - Removed from verification SELECT query

**Note:** Existing emission verifier accounts in the database are not deleted (they remain for backward compatibility), but new accounts will not be created.

---

## 📋 **UPDATED ACCOUNT LIST**

### **Accounts Created by `create-lto-admin-officer-accounts.sql`:**
1. ✅ `ltoadmin@lto.gov.ph` - LTO Admin (`lto_admin`)
2. ✅ `ltofficer@lto.gov.ph` - LTO Officer (`lto_officer`)
3. ✅ `hpgadmin@hpg.gov.ph` - HPG Admin (`admin` with HPG org)

### **Accounts Created by `create-real-accounts.sql`:**
1. ✅ `admin@lto.gov.ph` - LTO Admin (`admin`)
2. ✅ `hpgadmin@hpg.gov.ph` - HPG Admin (`admin` with HPG org)
3. ✅ `insurance@insurance.gov.ph` - Insurance Verifier (`insurance_verifier`)
4. ❌ ~~`emission@emission.gov.ph`~~ - **REMOVED** (no longer needed)
5. ✅ `owner@example.com` - Vehicle Owner (`vehicle_owner`)

---

## 🚀 **USAGE**

### **Create All Accounts (Including LTO Admin/Officer and HPG):**
```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql
```

### **Create Standard Accounts (Without Emission):**
```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-real-accounts.sql
```

---

## ✅ **VERIFICATION**

### **Check All Accounts:**
```sql
SELECT 
    email, 
    first_name, 
    last_name, 
    role, 
    organization, 
    is_active
FROM users 
WHERE email IN (
    'admin@lto.gov.ph',
    'ltoadmin@lto.gov.ph',
    'ltofficer@lto.gov.ph',
    'hpgadmin@hpg.gov.ph',
    'insurance@insurance.gov.ph',
    'owner@example.com'
)
ORDER BY role, email;
```

---

**Status:** ✅ **FIXED** - HPG account restored, emission account removed from creation scripts
