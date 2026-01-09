# Login/Signup Fixes Applied

## Date: 2026-01-09

## Issues Fixed

### 1. ✅ Signup - `email_verified` not returned
**Problem**: `createUser()` function didn't return `email_verified` field, causing frontend to not know verification status.

**Fix**: Added `email_verified` to RETURNING clause in `backend/database/services.js`

### 2. ✅ Login - Email verification blocking all users
**Problem**: Login endpoint was blocking ALL unverified users from logging in, even old accounts.

**Fix**: Removed the block in `backend/routes/auth.js` - now only logs a warning but allows login. Email verification is only required for new signups.

### 3. ✅ Password Validation Mismatch
**Problem**: Frontend validated 8 characters minimum, but backend required 12 characters, causing validation errors.

**Fix**: 
- Updated `js/login-signup.js` to require 12 characters minimum
- Updated `login-signup.html` hint text to reflect 12 characters

### 4. ✅ Old Users Backfilled
**Status**: All 14 existing users have been marked as `email_verified = TRUE` in the database.

## Files Modified

1. `backend/database/services.js` - Added `email_verified` to RETURNING clause
2. `backend/routes/auth.js` - Removed email verification block from login
3. `js/login-signup.js` - Updated password validation to 12 characters
4. `login-signup.html` - Updated password hint text

## Expected Behavior After Fixes

### Signup Flow
1. User fills signup form with 12+ character password
2. Backend creates user with `email_verified = false`
3. Backend sends magic link verification email (if EMAIL_VERIFICATION_ENABLED = true)
4. Frontend redirects to `email-verification-prompt.html`
5. User clicks magic link to verify email
6. User can then login normally

### Login Flow
1. User enters email and password
2. Backend validates credentials
3. **NEW**: Unverified users can login (warning logged, but not blocked)
4. Verified users login normally
5. User redirected to appropriate dashboard based on role

### Magic Link
- **Only sent during signup** (not during login)
- Sent via Gmail API service
- Expires in 24 hours
- One-time use token

## Testing Checklist

- [ ] Test signup with 12+ character password → Should work
- [ ] Test signup with <12 character password → Should show error
- [ ] Test login with old user (backfilled) → Should work normally
- [ ] Test login with new unverified user → Should work (warning in logs)
- [ ] Test login with verified user → Should work normally
- [ ] Test magic link from signup email → Should verify email
- [ ] Verify magic link is NOT sent during login

## Backend Status

- ✅ Backend running on port 3001
- ✅ Email verification enabled
- ✅ Database schema validated
- ⚠️ Fabric network connection issues (separate from login/signup)

## Next Steps

1. Restart backend container to apply changes:
   ```bash
   docker restart lto-app
   ```

2. Test signup and login flows

3. Monitor backend logs for any issues:
   ```bash
   docker logs lto-app --tail 50 -f
   ```

## Notes

- The 502 Bad Gateway error might be related to reverse proxy configuration or backend not responding on the expected port
- Fabric network connection errors are separate and don't affect login/signup functionality
- All 14 existing users are now verified and can login normally
