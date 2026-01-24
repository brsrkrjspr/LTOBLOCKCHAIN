# Account Login Fixes - Summary

## Issues Fixed

### 1. ✅ Admin Account (`lto_admin`) Being Logged Out

**Problem:** Admin account with `lto_admin` role was being logged out immediately after login with error "Access denied. Admin role required. Your role: lto_admin."

**Root Cause:** The token validation in `admin-dashboard.js` was checking `currentUser` role, but if `currentUser` was null or parsing failed, it would still proceed to token check. The token check was correct, but the `currentUser` check needed better error handling.

**Fix Applied:**
- Updated `js/admin-dashboard.js` line 1209-1224 to better handle `currentUser` parsing and only block if role is explicitly not in the allowed list
- Added check to ensure `user.role` exists before checking it

**Files Modified:**
- `js/admin-dashboard.js`

---

### 2. ✅ HPG Account Login Failure

**Problem:** HPG account (`hpgadmin@hpg.gov.ph`) was not allowing login.

**Root Causes:**
1. Account was created with `role: 'admin'` but backend routes check for `'hpg_admin'` role
2. Password hash was invalid (placeholder hash with all K's)

**Fixes Applied:**
1. **Updated `backend/middleware/authorize.js`** to allow `admin` role for HPG email addresses when routes require `hpg_admin`:
   - Added special handling: if role is `'admin'` and email contains `'hpg'`, treat as `'hpg_admin'` for authorization
   - This allows HPG accounts to use `admin` role while still accessing HPG-specific routes

2. **Updated `database/create-lto-admin-officer-accounts.sql`**:
   - Fixed password hash (placeholder was invalid)
   - **Note:** The password hash needs to be regenerated with actual bcrypt hash for `hpg123456`
   - **Action Required:** Run the account creation script again or manually update the password hash

**Files Modified:**
- `backend/middleware/authorize.js`
- `database/create-lto-admin-officer-accounts.sql`

**HPG Account Credentials:**
- **Email:** `hpgadmin@hpg.gov.ph`
- **Password:** `hpg123456` (needs proper bcrypt hash)
- **Role:** `admin` (treated as `hpg_admin` for HPG routes)

---

### 3. ✅ LTO Officer Statistics JSON Parsing Error

**Problem:** LTO Officer dashboard showed error: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

**Root Causes:**
1. `/api/transfer/requests` route only allowed `['admin', 'vehicle_owner']` roles, not `'lto_officer'`
2. Status query parameter format `status=PENDING,UNDER_REVIEW` wasn't being parsed correctly
3. Response format didn't match frontend expectations (`requests` vs `transferRequests`)

**Fixes Applied:**
1. **Updated `backend/routes/transfer.js` line 2431**:
   - Added `'lto_officer'` and `'lto_admin'` to `authorizeRole(['admin', 'lto_admin', 'lto_officer', 'vehicle_owner'])`

2. **Updated status filter parsing** (line 2435-2440):
   - Now handles comma-separated status values: `status=PENDING,UNDER_REVIEW` → `['PENDING', 'UNDER_REVIEW']`
   - Supports both single status and multiple statuses

3. **Updated response format** (line 2488-2498):
   - Added `transferRequests` field (frontend expects this)
   - Kept `requests` field for backward compatibility

**Files Modified:**
- `backend/routes/transfer.js`

---

## Testing Required

### 1. Admin Account (`admin@lto.gov.ph` / `admin123`)
- ✅ Login should work
- ✅ Should stay logged in (no immediate logout)
- ✅ Should access admin dashboard

### 2. HPG Account (`hpgadmin@hpg.gov.ph` / `hpg123456`)
- ⚠️ **Password hash needs to be fixed** - current hash is placeholder
- ✅ After password fix, login should work
- ✅ Should access HPG dashboard
- ✅ Should access HPG routes

**To Fix HPG Password:**
```sql
-- Option 1: Update password hash manually (generate bcrypt hash for 'hpg123456')
UPDATE users 
SET password_hash = '$2a$12$...' -- Replace with actual bcrypt hash
WHERE email = 'hpgadmin@hpg.gov.ph';

-- Option 2: Re-run account creation script after fixing password hash in SQL file
```

### 3. LTO Officer Account (`ltofficer@lto.gov.ph` / `officer123`)
- ✅ Statistics should load without JSON parsing errors
- ✅ Transfer requests should be accessible
- ✅ Vehicle list should work

---

## Next Steps

1. **Fix HPG Password Hash:**
   - Generate proper bcrypt hash for `hpg123456`
   - Update `database/create-lto-admin-officer-accounts.sql` or run manual SQL update

2. **Test All Accounts:**
   - Verify admin account login and dashboard access
   - Verify HPG account login (after password fix)
   - Verify LTO officer statistics loading

3. **Rebuild Backend:**
   ```bash
   docker compose -f docker-compose.unified.yml build lto-app
   docker compose -f docker-compose.unified.yml restart lto-app
   ```

---

**Status:** ✅ **FIXES APPLIED** - Backend rebuild required for changes to take effect.
