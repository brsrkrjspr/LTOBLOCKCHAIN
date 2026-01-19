# 502 Bad Gateway - Quick Fix Guide

## Most Common Causes

### 1. Backend Container Not Running or Crashed
**Check**:
```bash
docker ps | grep lto-app
```

**Fix**:
```bash
docker compose restart lto-app
# Wait 15 seconds
docker compose logs lto-app --tail=50
```

### 2. Backend Failed to Start (Syntax/Runtime Error)
**Check**:
```bash
docker compose logs lto-app --tail=100 | grep -i error
```

**Common Issues**:
- Syntax errors in route files
- Missing dependencies
- Database connection failed

**Fix**:
```bash
# Check syntax
docker exec lto-app node -c backend/routes/insurance.js
docker exec lto-app node -c backend/routes/emission.js
docker exec lto-app node -c backend/routes/hpg.js

# If errors found, check the file
```

### 3. Database Connection Failed
**Check**:
```bash
docker ps | grep postgres
docker compose logs postgres --tail=20
```

**Fix**:
```bash
# Restart database
docker compose restart postgres
sleep 10

# Restart backend
docker compose restart lto-app
```

### 4. Backend Not Listening on Port 3001
**Check**:
```bash
docker exec lto-app netstat -tuln | grep 3001
```

**If empty**: Backend didn't start properly

### 5. Nginx Can't Reach Backend
**Check**:
```bash
docker exec nginx ping -c 2 lto-app
```

**If fails**: Containers not on same network

## Quick Diagnostic Script

Run this to diagnose:
```bash
# Linux/Mac
./scripts/diagnose-502.sh

# Windows PowerShell
.\scripts\diagnose-502.ps1
```

## Most Likely Fix

Based on recent code changes, the most likely issue is:

1. **Backend container crashed** due to a runtime error
2. **Database connection issue** preventing startup

**Quick Fix**:
```bash
# 1. Check what's wrong
docker compose logs lto-app --tail=100

# 2. Restart everything
docker compose restart postgres
sleep 10
docker compose restart lto-app
sleep 15

# 3. Verify it's working
docker exec lto-app curl -s http://localhost:3001/api/health

# 4. If still failing, check logs again
docker compose logs lto-app --tail=50
```

## Check Recent Code Changes

The recent changes to add column existence checks should be safe, but verify:

```bash
# Check for syntax errors
docker exec lto-app node -c backend/routes/insurance.js
docker exec lto-app node -c backend/routes/emission.js  
docker exec lto-app node -c backend/routes/hpg.js
```

If any show errors, that's the problem.

## Expected Backend Startup Logs

When backend starts successfully, you should see:
```
✅ PostgreSQL connection successful
🚀 TrustChain LTO System running on port 3001
```

If you see errors instead, that's the cause of the 502.
