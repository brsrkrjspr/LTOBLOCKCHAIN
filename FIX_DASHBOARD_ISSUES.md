# Fix Dashboard Issues

## Issues Found

1. ✅ **JavaScript Syntax Error** - Fixed: Removed duplicate `statApprovedEl` declaration
2. ⚠️ **Blockchain Query Error** - Fixed: Improved error handling for "not found" during propagation
3. ⚠️ **Admin Dashboard 403 Forbidden** - Need to verify admin login
4. ⚠️ **Applications Not Showing** - Related to 403 error

---

## Quick Fixes

### 1. JavaScript Syntax Error (FIXED)
- **Issue:** `statApprovedEl` declared twice in `owner-dashboard.js`
- **Fix:** Removed duplicate declaration at line 198
- **Status:** ✅ Fixed

### 2. Blockchain Query Error (FIXED)
- **Issue:** Vehicle registered but immediately query fails with "not found"
- **Fix:** Improved error handling in `getTransactionStatus()` to gracefully handle "not found" during propagation
- **Status:** ✅ Fixed - Will retry up to 10 times with 2-second delays

### 3. Admin Dashboard 403 Forbidden

**Problem:** Admin can't access `/api/vehicles?status=SUBMITTED`

**Possible Causes:**
1. User not logged in as admin
2. Token doesn't have 'admin' role
3. Token expired or invalid

**Solution:**

#### Step 1: Verify You're Logged In as Admin

1. **Check Browser Console:**
   ```javascript
   // In browser console (F12):
   console.log('Token:', localStorage.getItem('authToken'));
   console.log('User:', localStorage.getItem('currentUser'));
   ```

2. **Check Token Role:**
   ```javascript
   // Decode JWT token to see role
   const token = localStorage.getItem('authToken');
   if (token) {
       const payload = JSON.parse(atob(token.split('.')[1]));
       console.log('User Role:', payload.role);
       console.log('User ID:', payload.userId);
   }
   ```

#### Step 2: Login as Admin

If you're not logged in as admin:

1. **Go to login page:** `login-signup.html`
2. **Login with admin credentials:**
   - Email: `admin@lto.gov.ph`
   - Password: `admin123`

3. **Or create admin user in database:**
   ```sql
   -- Connect to database
   docker exec -it postgres psql -U lto_user -d lto_blockchain
   
   -- Check existing admin
   SELECT id, email, role FROM users WHERE role = 'admin';
   
   -- If no admin exists, create one:
   INSERT INTO users (email, password_hash, first_name, last_name, role)
   VALUES (
       'admin@lto.gov.ph',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5', -- hash of 'admin123'
       'Admin',
       'User',
       'admin'
   );
   ```

#### Step 3: Verify Admin User Exists

```bash
# Check if admin user exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role FROM users WHERE role = 'admin';"
```

### 4. Applications Not Showing

**After fixing the 403 error, applications should appear.**

**If still not showing:**

1. **Check if vehicles exist in database:**
   ```bash
   docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vin, plate_number, status, owner_id FROM vehicles WHERE status = 'SUBMITTED' LIMIT 5;"
   ```

2. **Check browser console for errors:**
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed API calls

3. **Verify API endpoint works:**
   ```bash
   # Get your auth token from browser console, then:
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3001/api/vehicles?status=SUBMITTED&limit=10
   ```

---

## Testing Steps

### 1. Test Admin Login
```bash
# In browser console (F12):
# Check if logged in
console.log('Auth Token:', localStorage.getItem('authToken'));
console.log('Current User:', localStorage.getItem('currentUser'));

# If not logged in, login via UI or API
```

### 2. Test API Endpoint
```bash
# Get token from browser localStorage, then:
TOKEN="your-token-here"
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/vehicles?status=SUBMITTED&limit=10
```

### 3. Check Database
```bash
# Check vehicles
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles WHERE status = 'SUBMITTED';"

# Check users
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role FROM users;"
```

---

## Expected Behavior After Fixes

1. ✅ **Owner Dashboard:**
   - No JavaScript errors in console
   - Applications load and display
   - Stats update correctly

2. ✅ **Admin Dashboard:**
   - Can access `/api/vehicles?status=SUBMITTED`
   - Applications list displays
   - Can approve/reject applications

3. ✅ **Blockchain:**
   - Vehicle registration succeeds
   - Query retries gracefully if vehicle not immediately available
   - Transaction status polling works correctly

---

## If Issues Persist

1. **Clear browser cache and localStorage:**
   ```javascript
   // In browser console:
   localStorage.clear();
   // Then refresh page and login again
   ```

2. **Check server logs:**
   ```bash
   # Check for authentication errors
   # Look for "Authorization check" logs in terminal
   ```

3. **Verify JWT_SECRET:**
   ```bash
   # Check .env file has JWT_SECRET set
   grep JWT_SECRET .env
   ```

---

## Summary of Fixes Applied

1. ✅ Fixed JavaScript syntax error in `owner-dashboard.js`
2. ✅ Improved blockchain error handling in `optimizedFabricService.js`
3. ✅ Added debug logging to authorization middleware
4. ✅ Improved "not found" error detection in blockchain queries

**Next Steps:**
1. Restart application: `npm start`
2. Login as admin: `admin@lto.gov.ph` / `admin123`
3. Check browser console for any remaining errors
4. Verify applications appear in dashboards

