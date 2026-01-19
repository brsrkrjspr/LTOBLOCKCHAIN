# 502 Bad Gateway - Diagnosis Guide

## What This Error Means

A **502 Bad Gateway** error from nginx means:
- ✅ Nginx is running and receiving requests
- ❌ Nginx cannot connect to the backend application (`lto-app`)
- The backend may have crashed, not started, or is not listening on port 3001

## Quick Diagnostic Commands

### 1. Check if Backend Container is Running

```bash
docker ps | grep lto-app
# OR
docker compose ps lto-app
```

**Expected**: Container should show `Up` status  
**If not**: Container crashed or not started

### 2. Check Backend Container Logs

```bash
docker logs lto-app --tail=100
# OR
docker compose logs lto-app --tail=100
```

**Look for**:
- ❌ `Error:` or `FATAL:` messages
- ❌ `Cannot connect to database`
- ❌ `EADDRINUSE` (port 3001 already in use)
- ❌ `SyntaxError` or `ReferenceError` (code errors)
- ✅ `Server running on port 3001` or similar (good sign)

### 3. Check if Backend is Listening on Port 3001

```bash
docker exec lto-app netstat -tuln | grep 3001
# OR
docker exec lto-app ss -tuln | grep 3001
```

**Expected**: Should show `:3001` listening  
**If empty**: Application is not listening

### 4. Test Backend Health Endpoint Directly

```bash
# From inside the container
docker exec lto-app curl -s http://localhost:3001/api/health

# From host (if port is exposed)
curl -s http://localhost:3001/api/health
```

**Expected**: JSON response with status  
**If fails**: Application is not responding

### 5. Check Nginx Configuration

```bash
docker exec nginx nginx -t
```

**Expected**: `syntax is ok` and `test is successful`  
**If fails**: Nginx configuration error

### 6. Check Nginx Error Logs

```bash
docker logs nginx --tail=50
# OR
docker exec nginx cat /var/log/nginx/error.log | tail -20
```

**Look for**:
- `connect() failed (111: Connection refused)` - Backend not running
- `upstream timed out` - Backend too slow to respond
- `no live upstreams` - Backend container not found

## Common Causes & Fixes

### Cause 1: Backend Container Crashed

**Symptoms**:
- Container shows `Exited` status
- Logs show fatal errors

**Fix**:
```bash
# Restart the container
docker compose restart lto-app

# Wait and check logs
sleep 10
docker compose logs lto-app --tail=50
```

### Cause 2: Syntax Error in Code

**Symptoms**:
- Container starts then immediately exits
- Logs show `SyntaxError` or `ReferenceError`

**Recent Changes That Could Cause This**:
- ✅ `backend/routes/insurance.js` - Added column checks
- ✅ `backend/routes/emission.js` - Added column checks
- ✅ `backend/routes/hpg.js` - Added column checks

**Fix**:
```bash
# Check for syntax errors
docker exec lto-app node -c backend/routes/insurance.js
docker exec lto-app node -c backend/routes/emission.js
docker exec lto-app node -c backend/routes/hpg.js
```

### Cause 3: Database Connection Failed

**Symptoms**:
- Container running but not responding
- Logs show `ECONNREFUSED` or `timeout`

**Fix**:
```bash
# Check database is running
docker ps | grep postgres

# Test database connection
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.query('SELECT NOW()').then(() => {
  console.log('✅ Database connected');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database error:', err.message);
  process.exit(1);
});
"
```

### Cause 4: Port 3001 Already in Use

**Symptoms**:
- Container fails to start
- Logs show `EADDRINUSE: address already in use :::3001`

**Fix**:
```bash
# Find what's using port 3001
lsof -i :3001
# OR on Windows
netstat -ano | findstr :3001

# Kill the process or change port
```

### Cause 5: Missing Environment Variables

**Symptoms**:
- Container starts but crashes on initialization
- Logs show `undefined` or missing config

**Fix**:
```bash
# Check environment variables
docker exec lto-app env | grep -E 'DB_|PORT|NODE_ENV'

# Verify .env file exists and has required variables
```

### Cause 6: Nginx Can't Resolve Backend Hostname

**Symptoms**:
- Nginx error: `no live upstreams`
- Nginx can't find `lto-app` container

**Fix**:
```bash
# Check if containers are on same network
docker network inspect lto-network | grep -A 5 lto-app

# Verify nginx can reach backend
docker exec nginx ping -c 2 lto-app
```

## Step-by-Step Recovery

### Step 1: Check Container Status
```bash
docker compose ps
```

### Step 2: Check Backend Logs
```bash
docker compose logs lto-app --tail=100
```

### Step 3: Restart Backend
```bash
docker compose restart lto-app
sleep 15
docker compose logs lto-app --tail=50
```

### Step 4: Test Backend Directly
```bash
docker exec lto-app curl -s http://localhost:3001/api/health
```

### Step 5: Restart Nginx
```bash
docker compose restart nginx
```

### Step 6: Test Full Stack
```bash
curl -s http://localhost/api/health
```

## Quick Fix Script

```bash
#!/bin/bash
echo "🔍 Diagnosing 502 Bad Gateway..."

echo "1. Checking container status..."
docker compose ps

echo "2. Checking backend logs..."
docker compose logs lto-app --tail=50

echo "3. Testing backend health..."
docker exec lto-app curl -s http://localhost:3001/api/health || echo "❌ Backend not responding"

echo "4. Restarting services..."
docker compose restart lto-app
sleep 15
docker compose restart nginx

echo "5. Final test..."
curl -s http://localhost/api/health || echo "❌ Still failing"
```

## Most Likely Causes Based on Recent Changes

Given the recent code changes to add column existence checks:

1. **Syntax Error**: Check if the async/await syntax is correct in the new column check code
2. **Missing Import**: Verify `require('../database/db')` is correct
3. **Database Connection**: The column check queries might be failing if database is down

## Verification

After fixing, verify with:
```bash
# 1. Backend is running
docker ps | grep lto-app

# 2. Backend responds
curl http://localhost:3001/api/health

# 3. Nginx proxies correctly
curl http://localhost/api/health
```
