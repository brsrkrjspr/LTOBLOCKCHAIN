# 🔐 Real Account Credentials

All accounts are stored in the database with proper authentication. **No demo accounts exist.**

## 📋 Account Information

### 1. LTO Administrator
- **Email:** `admin@lto.gov.ph`
- **Password:** `admin123`
- **Role:** `admin`
- **Organization:** Land Transportation Office
- **Dashboard:** `admin-dashboard.html`

### 2. HPG Administrator
- **Email:** `hpgadmin@hpg.gov.ph`
- **Password:** `SecurePass123!`
- **Role:** `admin` (with HPG organization)
- **Organization:** Highway Patrol Group
- **Dashboard:** `hpg-admin-dashboard.html`

### 3. Insurance Verifier
- **Email:** `insurance@insurance.gov.ph`
- **Password:** `SecurePass123!`
- **Role:** `insurance_verifier`
- **Organization:** Insurance Verification Office
- **Dashboard:** `insurance-verifier-dashboard.html`

### 4. Emission Verifier
- **Email:** `emission@emission.gov.ph`
- **Password:** `SecurePass123!`
- **Role:** `emission_verifier`
- **Organization:** Emission Testing Center
- **Dashboard:** `verifier-dashboard.html`

### 5. Vehicle Owner (Sample)
- **Email:** `owner@example.com`
- **Password:** `SecurePass123!`
- **Role:** `vehicle_owner`
- **Organization:** Individual
- **Dashboard:** `owner-dashboard.html`

---

## 🚀 Setup Instructions

### Step 1: Create Accounts in Database

Run the SQL script to create all accounts:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-real-accounts.sql
```

Or in Codespace:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-real-accounts.sql
```

### Step 2: Verify Accounts

Check that accounts were created:

```sql
SELECT email, first_name, last_name, role, organization, is_active 
FROM users 
WHERE email IN (
    'admin@lto.gov.ph',
    'hpgadmin@hpg.gov.ph',
    'insurance@insurance.gov.ph',
    'emission@emission.gov.ph',
    'owner@example.com'
)
ORDER BY role, email;
```

### Step 3: Login

1. Go to `login-signup.html`
2. Enter one of the credentials above
3. Click "Login"
4. You will be redirected to the appropriate dashboard

---

## 🔒 Security Notes

- All passwords are hashed using bcrypt (cost factor 12)
- **Change passwords after first login** for production use
- The default password `SecurePass123!` should be changed for all accounts
- Admin password `admin123` should be changed immediately

---

## 📝 Password Change

To change a password, users can:
1. Login to their dashboard
2. Go to Settings (if available)
3. Or use the password reset functionality

For admin password changes, update directly in the database:

```sql
-- Generate new hash (use Node.js script: scripts/generate-password-hashes.js)
-- Then update:
UPDATE users 
SET password_hash = '$2a$12$...new_hash...', 
    updated_at = CURRENT_TIMESTAMP 
WHERE email = 'admin@lto.gov.ph';
```

---

## ✅ All Accounts Summary

| Role | Email | Password | Dashboard |
|------|-------|----------|-----------|
| LTO Admin | `admin@lto.gov.ph` | `admin123` | `admin-dashboard.html` |
| HPG Admin | `hpgadmin@hpg.gov.ph` | `SecurePass123!` | `hpg-admin-dashboard.html` |
| Insurance Verifier | `insurance@insurance.gov.ph` | `SecurePass123!` | `insurance-verifier-dashboard.html` |
| Emission Verifier | `emission@emission.gov.ph` | `SecurePass123!` | `verifier-dashboard.html` |
| Vehicle Owner | `owner@example.com` | `SecurePass123!` | `owner-dashboard.html` |

---

**Note:** All accounts use real database authentication. No demo tokens or mock accounts exist.

