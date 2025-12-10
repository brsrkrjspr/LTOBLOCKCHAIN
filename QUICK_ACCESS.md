# Quick Access Guide - Owner Dashboard

## 🔧 Fixed Authentication Issues

The authentication system has been updated to properly handle demo tokens. You should no longer be logged out automatically.

## 🚀 Quick Access Methods

### Method 1: Normal Login (Recommended)
1. Go to `login-signup.html`
2. Enter credentials:
   - **Email:** `owner@example.com`
   - **Password:** `owner123`
3. Click "Login"
4. You'll be redirected to `owner-dashboard.html`

### Method 2: Quick Login via Browser Console
If you're already on any page, open the browser console (F12) and type:
```javascript
quickLoginAsOwner()
```
Then press Enter. This will automatically log you in and redirect to the owner dashboard.

### Method 3: Direct Demo Credentials Setup
Open browser console (F12) and run:
```javascript
AuthUtils.setDemoCredentials('owner@example.com', 'owner123');
window.location.href = 'owner-dashboard.html';
```

## 🔍 Troubleshooting

### If you're still being logged out:

1. **Clear browser cache and localStorage:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Manually set credentials:**
   ```javascript
   localStorage.setItem('currentUser', JSON.stringify({
     id: 'demo-user-' + Date.now(),
     email: 'owner@example.com',
     role: 'vehicle_owner',
     firstName: 'John',
     lastName: 'Doe',
     name: 'Vehicle Owner',
     organization: 'Individual',
     phone: '+63 912 345 6789',
     isActive: true,
     emailVerified: true
   }));
   localStorage.setItem('authToken', 'demo-token-' + Date.now());
   localStorage.setItem('token', 'demo-token-' + Date.now());
   window.location.href = 'owner-dashboard.html';
   ```

3. **Check if credentials are stored:**
   ```javascript
   console.log('User:', localStorage.getItem('currentUser'));
   console.log('Token:', localStorage.getItem('authToken'));
   ```

## ✅ What Was Fixed

1. **Token Validation:** Updated to handle demo tokens that don't follow JWT format
2. **Authentication Check:** Made more lenient for demo/testing purposes
3. **Dashboard Access:** Improved error handling to prevent unnecessary redirects
4. **Helper Functions:** Added `quickLoginAsOwner()` for easy testing

## 📝 Test Credentials

| Email | Password | Role |
|-------|----------|------|
| `owner@example.com` | `owner123` | Vehicle Owner |
| `vehicle@example.com` | `vehicle123` | Vehicle Owner |

## 🎯 Expected Behavior

After logging in:
- ✅ You should stay logged in when navigating between pages
- ✅ The dashboard should display your name (John Doe)
- ✅ You should see all dashboard features
- ✅ You should NOT be automatically logged out

If you experience any issues, use the browser console methods above to manually set credentials.

