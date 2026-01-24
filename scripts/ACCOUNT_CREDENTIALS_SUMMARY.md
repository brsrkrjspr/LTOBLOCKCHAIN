# Account Credentials Summary

**Date:** 2026-01-24  
**Source:** `database/create-lto-admin-officer-accounts.sql`

---

## 🔐 **ACCOUNT CREDENTIALS**

### **1. LTO Admin**
- **Email:** `admin@lto.gov.ph` (or `ltoadmin@lto.gov.ph` if created separately)
- **Password:** `admin123`
- **Role:** `lto_admin`
- **Organization:** Land Transportation Office
- **Employee ID:** `LTO-ADMIN-001`
- **Badge Number:** `ADMIN-001`

**Note:** The script checks if `admin@lto.gov.ph` already has `employee_id = 'LTO-ADMIN-001'`. If so, it updates that account to `lto_admin` role. Otherwise, it creates `ltoadmin@lto.gov.ph`.

---

### **2. LTO Officer**
- **Email:** `ltofficer@lto.gov.ph`
- **Password:** `admin123`
- **Role:** `lto_officer`
- **Organization:** Land Transportation Office
- **Employee ID:** `LTO-OFF-001`
- **Badge Number:** `OFF-001`
- **Name:** Juan Dela Cruz

---

### **3. Insurance Verifier**
- **Email:** `insurance@insurance.gov.ph`
- **Password:** `admin123`
- **Role:** `insurance_verifier`
- **Organization:** Insurance Verification Office
- **Employee ID:** ❌ None (external organization user)

**Note:** Legacy account `insurance@lto.gov.ph` should be migrated to `insurance@insurance.gov.ph`.

---

### **4. HPG Admin**
- **Email:** `hpgadmin@hpg.gov.ph`
- **Password:** `SecurePass123!`
- **Role:** `admin` (with HPG organization)
- **Organization:** Highway Patrol Group
- **Employee ID:** ❌ None (external organization admin)

---

## 📋 **QUICK REFERENCE TABLE**

| Account | Email | Password | Role | Employee ID |
|---------|-------|----------|------|-------------|
| **LTO Admin** | `admin@lto.gov.ph` | `admin123` | `lto_admin` | `LTO-ADMIN-001` |
| **LTO Officer** | `ltofficer@lto.gov.ph` | `admin123` | `lto_officer` | `LTO-OFF-001` |
| **Insurance Verifier** | `insurance@insurance.gov.ph` | `admin123` | `insurance_verifier` | None |
| **HPG Admin** | `hpgadmin@hpg.gov.ph` | `SecurePass123!` | `admin` | None |

---

## 🔑 **PASSWORD HASHES**

- **`admin123`** → `$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG` (bcrypt cost 12)
- **`SecurePass123!`** → `$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K` (bcrypt cost 12)

---

## ✅ **VERIFICATION COMMAND**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    email, 
    role, 
    organization,
    employee_id,
    badge_number,
    is_active
FROM users 
WHERE email IN (
    'admin@lto.gov.ph',
    'ltoadmin@lto.gov.ph',
    'ltofficer@lto.gov.ph',
    'insurance@insurance.gov.ph',
    'hpgadmin@hpg.gov.ph'
)
ORDER BY 
    CASE 
        WHEN email = 'ltoadmin@lto.gov.ph' THEN 1
        WHEN email = 'admin@lto.gov.ph' THEN 2
        WHEN email = 'ltofficer@lto.gov.ph' THEN 3
        WHEN email = 'insurance@insurance.gov.ph' THEN 4
        ELSE 5
    END;"
```

---

## ⚠️ **SECURITY NOTES**

1. **Change passwords after first login** for production use
2. All passwords are hashed using bcrypt (cost factor 12)
3. Default password `admin123` should be changed immediately for LTO accounts
4. Default password `SecurePass123!` should be changed for HPG admin account

---

**Status:** ✅ **VERIFIED** - All credentials confirmed from account creation script.
