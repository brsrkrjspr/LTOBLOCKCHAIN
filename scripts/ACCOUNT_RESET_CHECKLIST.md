# Account Reset - Requirements Checklist

## ✅ **NO .env Variables Needed**

The account creation script (`database/create-lto-admin-officer-accounts.sql`) is **pure SQL** and doesn't require any `.env` variables. It runs directly against the PostgreSQL database.

---

## 🔐 **Bcrypt Hashes - Already Generated**

All password hashes are **already correct** in the script:

### **Current Passwords & Hashes:**

1. **`admin123`** (used for LTO Admin, LTO Officer, Insurance Verifier)
   - Hash: `$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG`
   - ✅ Already in script

2. **`hpg123456`** (used for HPG Admin)
   - Hash: `$2a$12$7r//ad4yFuGcjrhqlzbnCOJPiBLLH8eDNGr7/pmsKa7FByehFVFem`
   - ✅ Already in script (just updated)

---

## 📋 **Account Summary**

| Account | Email | Password | Role | Status |
|---------|-------|----------|------|--------|
| LTO Admin | `admin@lto.gov.ph` or `ltoadmin@lto.gov.ph` | `admin123` | `lto_admin` | ✅ Ready |
| LTO Officer | `ltofficer@lto.gov.ph` | `admin123` | `lto_officer` | ✅ Ready |
| HPG Admin | `hpgadmin@hpg.gov.ph` | `hpg123456` | `admin` | ✅ Ready |
| Insurance Verifier | `insurance@insurance.gov.ph` | `admin123` | `insurance_verifier` | ✅ Ready |

---

## 🚀 **Ready to Reset**

**No action needed from you!** The script is ready to run. Just execute:

```bash
# On your DigitalOcean server
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql
```

---

## 🔄 **If You Want Different Passwords**

If you want to change any passwords, I can generate new bcrypt hashes. Just tell me:
- Which account(s)
- What password(s) you want

Example:
- "Change HPG password to `SecurePass123!`"
- "Change all passwords to `MyNewPassword123!`"

---

## ✅ **Status: READY TO RESET**

All hashes are correct, no .env needed, script is ready to run! 🎉
