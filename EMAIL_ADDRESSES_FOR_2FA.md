# Email Addresses for 2FA: Safe Options for Demo/Thesis

## Current Email Setup

Your system uses:
- **Gmail API** (`GMAIL_USER=foundlost004@gmail.com`)
- **SMTP** support (if configured)

---

## Safe Email Address Options

### Option 1: Use Gmail with Specific Patterns ⭐ **RECOMMENDED**

**Pattern:** `yourprojectname+org+role@gmail.com`

**Examples:**
- `foundlost004+lto+admin@gmail.com` (LTO Admin)
- `foundlost004+hpg+admin@gmail.com` (HPG Admin)
- `foundlost004+insurance+verifier@gmail.com` (Insurance Verifier)
- `foundlost004+certificate+generator@gmail.com` (Certificate Generator)

**How it works:**
- Gmail ignores everything after `+` in the local part
- All emails go to `foundlost004@gmail.com`
- You can filter by the `+` part
- **No conflicts** - all emails go to your inbox

**Pros:**
- ✅ Uses existing Gmail account
- ✅ No conflicts (all go to your inbox)
- ✅ Easy to filter/organize
- ✅ Works immediately

**Implementation:**
```javascript
// Use Gmail + addressing
const emailFor2FA = `foundlost004+${org}+${role}@gmail.com`;

// Examples:
// foundlost004+lto+admin@gmail.com
// foundlost004+hpg+admin@gmail.com
// foundlost004+insurance+verifier@gmail.com
```

---

### Option 2: Use Disposable Email Services (For Demo Only)

**Services:**
- **Mailinator**: `anything@mailinator.com` (public inbox)
- **10 Minute Mail**: `temporary@10minutemail.com`
- **Temp Mail**: `temp@temp-mail.org`

**Examples:**
- `lto-admin@mailinator.com`
- `hpg-admin@mailinator.com`
- `insurance-verifier@mailinator.com`

**Pros:**
- ✅ No conflicts (temporary emails)
- ✅ Easy to create
- ✅ Public inboxes (can check online)

**Cons:**
- ⚠️ **Not secure** (public inboxes)
- ⚠️ **Not suitable for production**
- ⚠️ Emails expire

**Use Case:** Only for demo/testing, not production

---

### Option 3: Use Your Own Domain (If Available)

**Pattern:** `role@yourdomain.com`

**Examples:**
- `admin@yourproject.com`
- `hpg@yourproject.com`
- `insurance@yourproject.com`

**Pros:**
- ✅ Professional
- ✅ Full control
- ✅ No conflicts

**Cons:**
- ⚠️ Requires domain purchase (~$10-15/year)
- ⚠️ Requires email hosting setup

---

### Option 4: Use Gmail Aliases (Multiple Gmail Accounts)

**Pattern:** Create separate Gmail accounts

**Examples:**
- `ltoblockchain.demo@gmail.com`
- `ltoblockchain.hpg@gmail.com`
- `ltoblockchain.insurance@gmail.com`

**Pros:**
- ✅ Separate inboxes
- ✅ Professional appearance
- ✅ Easy to manage

**Cons:**
- ⚠️ Requires creating multiple Gmail accounts
- ⚠️ More accounts to manage

---

### Option 5: Use DuckDNS Email (If Using DuckDNS Domain)

**Pattern:** `role@ltoblockchain.duckdns.org`

**Examples:**
- `admin@ltoblockchain.duckdns.org`
- `hpg@ltoblockchain.duckdns.org`
- `insurance@ltoblockchain.duckdns.org`

**Pros:**
- ✅ Uses your existing domain
- ✅ Professional
- ✅ Consistent with your setup

**Cons:**
- ⚠️ Requires email hosting setup
- ⚠️ DuckDNS doesn't provide email hosting (need separate service)

---

## Recommendation: **Gmail + Addressing** ⭐

### **Best Approach for Demo/Thesis:**

Use **Gmail + addressing** with your existing account:

```javascript
// Email addresses for seed accounts
const seedAccounts = {
    'admin@lto.gov.ph': 'foundlost004+lto+admin@gmail.com',
    'hpg@hpg.gov.ph': 'foundlost004+hpg+admin@gmail.com',
    'insurance@hpg.gov.ph': 'foundlost004+insurance+verifier@gmail.com',
    'certificategenerator@generator.com': 'foundlost004+certificate+generator@gmail.com'
};
```

**Why:**
- ✅ Uses existing Gmail account (`foundlost004@gmail.com`)
- ✅ All emails go to your inbox
- ✅ Easy to filter by `+` part
- ✅ No conflicts (all go to your account)
- ✅ Works immediately (no setup needed)
- ✅ Professional appearance (looks like separate emails)

---

## Implementation Plan

### Step 1: Update Seed Accounts

**File: `database/all schema.sql` or seed script**

```sql
-- Add personal_email column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);

-- Update seed accounts with Gmail + addressing
UPDATE users 
SET personal_email = 'foundlost004+lto+admin@gmail.com'
WHERE email = 'admin@lto.gov.ph';

UPDATE users 
SET personal_email = 'foundlost004+hpg+admin@gmail.com'
WHERE email = 'hpg@hpg.gov.ph';

UPDATE users 
SET personal_email = 'foundlost004+insurance+verifier@gmail.com'
WHERE email = 'insurance@hpg.gov.ph';

UPDATE users 
SET personal_email = 'foundlost004+certificate+generator@gmail.com'
WHERE email = 'certificategenerator@generator.com';
```

### Step 2: Update 2FA Code Sending

**File: `backend/routes/auth.js`**

```javascript
// Get email for 2FA (use personal_email if available, fallback to email)
const emailFor2FA = user.personal_email || user.email;

// Send 2FA code
await sendEmail({
    to: emailFor2FA,
    subject: 'Your Login Verification Code',
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`
});
```

### Step 3: Gmail Filtering (Optional)

Create Gmail filters to organize emails:

1. Go to Gmail Settings → Filters
2. Create filter: `To: foundlost004+lto+admin@gmail.com`
3. Apply label: "LTO Admin"
4. Repeat for other addresses

---

## Email Address Mapping

| Org Email (Display) | Personal Email (2FA) | Purpose |
|---------------------|---------------------|---------|
| `admin@lto.gov.ph` | `foundlost004+lto+admin@gmail.com` | LTO Admin 2FA |
| `hpg@hpg.gov.ph` | `foundlost004+hpg+admin@gmail.com` | HPG Admin 2FA |
| `insurance@hpg.gov.ph` | `foundlost004+insurance+verifier@gmail.com` | Insurance Verifier 2FA |
| `certificategenerator@generator.com` | `foundlost004+certificate+generator@gmail.com` | Certificate Generator 2FA |

---

## Alternative: Use Environment Variables

**File: `.env.production`**

```bash
# 2FA Email Addresses (Gmail + addressing)
LTO_ADMIN_2FA_EMAIL=foundlost004+lto+admin@gmail.com
HPG_ADMIN_2FA_EMAIL=foundlost004+hpg+admin@gmail.com
INSURANCE_VERIFIER_2FA_EMAIL=foundlost004+insurance+verifier@gmail.com
CERTIFICATE_GENERATOR_2FA_EMAIL=foundlost004+certificate+generator@gmail.com
```

**Usage:**
```javascript
const emailFor2FA = process.env[`${user.role.toUpperCase()}_2FA_EMAIL`] || user.email;
```

---

## Summary

### **Recommended Approach:**

✅ **Use Gmail + Addressing**
- Pattern: `foundlost004+org+role@gmail.com`
- All emails go to your existing inbox
- Easy to filter and organize
- No conflicts
- Works immediately

### **Email Addresses:**

| Account | 2FA Email |
|---------|-----------|
| LTO Admin | `foundlost004+lto+admin@gmail.com` |
| HPG Admin | `foundlost004+hpg+admin@gmail.com` |
| Insurance Verifier | `foundlost004+insurance+verifier@gmail.com` |
| Certificate Generator | `foundlost004+certificate+generator@gmail.com` |

---

## Next Steps

1. ✅ Update seed accounts with `personal_email` field
2. ✅ Implement email-based 2FA using `personal_email`
3. ✅ Test 2FA code delivery to Gmail + addresses
4. ✅ Set up Gmail filters (optional, for organization)

**Ready to implement!** 🚀
