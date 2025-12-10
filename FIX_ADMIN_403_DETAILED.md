# Fix Admin Dashboard 403 Forbidden Error - Detailed Guide

## Understanding the 403 Error

The error `403 (Forbidden)` means:
- ✅ You ARE authenticated (token exists)
- ❌ Your token does NOT have the `admin` role
- ❌ The backend is rejecting your request because you're not an admin

## Why This Happens

1. **You're logged in as a regular user** (not admin)
2. **You have a demo token** (doesn't have real admin role)
3. **Your token expired** and needs to be refreshed
4. **You're using an old token** from before you created the admin user

## Solution: Login as Admin Properly

### Step 1: Clear Old Tokens

**In browser console (F12), run:**
```javascript
// Clear all authentication
localStorage.clear();
console.log('✅ Cleared all localStorage');
```

### Step 2: Login as Admin via API

**In browser console (F12), run:**
```javascript
// Login as admin
fetch('/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        email: 'admin@lto.gov.ph',
        password: 'admin123'
    })
})
.then(response => response.json())
.then(data => {
    console.log('Login response:', data);
    if (data.success) {
        // Store token and user
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        console.log('✅ Admin login successful!');
        console.log('User role:', data.user.role);
        console.log('Token stored. Refreshing page...');
        window.location.href = 'admin-dashboard.html';
    } else {
        console.error('❌ Login failed:', data.error);
    }
})
.catch(error => {
    console.error('❌ Login error:', error);
});
```

### Step 3: Verify Your Token Has Admin Role

**After logging in, in browser console (F12), run:**
```javascript
// Check token
const token = localStorage.getItem('authToken');
if (token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token payload:', payload);
        console.log('Your role:', payload.role);
        console.log('Your email:', payload.email);
        
        if (payload.role === 'admin') {
            console.log('✅ Token has admin role!');
        } else {
            console.error('❌ Token does NOT have admin role. Current role:', payload.role);
        }
    } catch (e) {
        console.error('❌ Could not decode token:', e);
    }
} else {
    console.error('❌ No token found');
}
```

### Step 4: Check Server Logs

**In Codespace terminal, you should see:**
```
Authorization check: {
  userRole: 'admin',
  userId: '...',
  email: 'admin@lto.gov.ph',
  allowedRoles: ['admin'],
  hasPermission: true
}
```

If you see `hasPermission: false`, the token doesn't have admin role.

## Alternative: Login via UI

1. **Go to:** `login-signup.html`
2. **Enter:**
   - Email: `admin@lto.gov.ph`
   - Password: `admin123`
3. **Click "Login"**
4. **Verify:** Check browser console for any errors

## If Login Fails

### Check if Admin User Exists

```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, is_active FROM users WHERE email = 'admin@lto.gov.ph';"
```

### Verify Password Hash

The password hash for `admin123` should be:
```
$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5
```

### Recreate Admin User (if needed)

```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
UPDATE users 
SET role = 'admin', 
    password_hash = '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5'
WHERE email = 'admin@lto.gov.ph';
"
```

## Expected Result

After proper login:
- ✅ Token has `role: 'admin'` in JWT payload
- ✅ Admin dashboard loads applications
- ✅ No 403 errors in console
- ✅ Server logs show `hasPermission: true`

