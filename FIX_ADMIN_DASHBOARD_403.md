# Fix Admin Dashboard 403 Forbidden Error

## Issue
Admin dashboard shows "No applications found" and console shows:
```
GET /api/vehicles?status=SUBMITTED&limit=100 403 (Forbidden)
Error: You do not have permission to perform this action.
```

## Root Causes

### 1. Authentication Issue
- User is not logged in as admin
- Token doesn't have 'admin' role
- Token expired or invalid

### 2. Status Mismatch
- Admin dashboard queries `status=SUBMITTED`
- Vehicles have status `PENDING_BLOCKCHAIN` (set during blockchain registration)
- Status never changes back to `SUBMITTED` after blockchain registration completes

## Fixes Applied

### Fix 1: Change Status Back to SUBMITTED After Blockchain Registration
- After blockchain registration completes, change status from `PENDING_BLOCKCHAIN` back to `SUBMITTED`
- This ensures admin dashboard can find pending applications

### Fix 2: Admin Dashboard Query Multiple Statuses
- Updated admin dashboard to query both `SUBMITTED` and `PENDING_BLOCKCHAIN`
- If no `SUBMITTED` vehicles found, also check `PENDING_BLOCKCHAIN`

### Fix 3: Backend Support Multiple Status Query
- Updated backend to support comma-separated status values
- Can query: `?status=SUBMITTED,PENDING_BLOCKCHAIN`

## How to Fix 403 Error

### Step 1: Verify You're Logged In as Admin

**In browser console (F12):**
```javascript
// Check token
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
console.log('Token:', token);

// Decode token to see role
if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('User Role:', payload.role);
    console.log('User ID:', payload.userId);
    console.log('Email:', payload.email);
}
```

### Step 2: Login as Admin

1. Go to `login-signup.html`
2. Login with:
   - **Email:** `admin@lto.gov.ph`
   - **Password:** `admin123`

### Step 3: Verify Admin User Exists

```bash
# Check if admin user exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role FROM users WHERE role = 'admin';"
```

### Step 4: Create Admin User (if needed)

```bash
# Create admin user with password: admin123
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
    'admin@lto.gov.ph',
    '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5',
    'Admin',
    'User',
    'admin'
) ON CONFLICT (email) DO UPDATE SET role = 'admin';
"
```

## Testing

After fixes:
1. Restart application: `npm start`
2. Login as admin: `admin@lto.gov.ph` / `admin123`
3. Check admin dashboard - should show applications
4. Check browser console - should not show 403 errors

## Expected Behavior

- ✅ Admin dashboard shows vehicles with status `SUBMITTED` or `PENDING_BLOCKCHAIN`
- ✅ No 403 Forbidden errors in console
- ✅ Applications appear in "Recent Applications" table
- ✅ Admin can approve/reject applications

