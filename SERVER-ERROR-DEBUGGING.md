# Server Error Debugging Guide

## 🔍 Current Issue

You're seeing a "Server error. Please try again later." message when submitting vehicle registration. This is a **500 Internal Server Error** from the backend.

## ✅ Improvements Made

I've enhanced the error handling to provide better debugging information:

### 1. **Server-Side Error Logging** (`backend/routes/vehicles.js`)
- Now logs full error stack traces
- Shows error details (message, name, code)
- Provides detailed error messages in development mode

### 2. **Client-Side Error Extraction** (`js/api-client.js`)
- Extracts actual error message from server response
- Shows error details in browser console (development mode)
- Better error message propagation

### 3. **Error Handler Updates** (`js/error-handler.js`)
- Shows detailed errors in development mode
- Logs error details to console for debugging

## 🔧 How to Debug

### Step 1: Check Server Console

**Look at the terminal where `node server.js` is running.** You should see:

```
Vehicle registration error: [actual error message]
Error stack: [full stack trace]
Error details: { message: '...', name: '...', code: '...' }
```

This will tell you **exactly what's failing** on the server.

### Step 2: Check Browser Console

After refreshing and trying again, check the browser console (F12). You should see:

- The actual error message from the server
- Error details (in development mode)
- More specific information about what failed

### Step 3: Common Issues to Check

1. **Database Connection**:
   ```powershell
   docker exec postgres pg_isready -U lto_user
   ```

2. **Missing Database Functions**:
   - Check if `getVehicleByVin`, `createVehicle`, `createUser` exist
   - Verify database schema is initialized

3. **Missing Dependencies**:
   - Ensure all npm packages are installed
   - Check if `bcryptjs`, `fabric-network`, etc. are available

4. **Blockchain Service**:
   - Check if Fabric service is running
   - Verify network configuration

## 📋 Next Steps

1. **Restart the server** to get the improved error logging:
   ```powershell
   # Stop current server (Ctrl+C)
   node server.js
   ```

2. **Try the registration again** and check:
   - Server console for detailed error
   - Browser console for error details

3. **Share the error message** from the server console so we can fix the root cause

## 🎯 Expected Behavior

After these changes:
- ✅ Server will log detailed error information
- ✅ Browser will show actual error message (not generic "Server error")
- ✅ Development mode will show full error details in console
- ✅ You'll be able to identify the exact issue

---

**Note**: The server needs to be restarted for the backend changes to take effect. The frontend changes just need a browser refresh.

