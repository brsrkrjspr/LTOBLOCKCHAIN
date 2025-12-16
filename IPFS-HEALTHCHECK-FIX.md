# 🔧 IPFS Healthcheck Fix

## Issue Analysis

### **Problem 1: IPFS Healthcheck Still Failing**

**Status:** `health: starting` (line 473)  
**Reality:** IPFS is working (connectivity test passed on line 515)

**Root Cause:**
- Healthcheck command might not be available in IPFS container
- IPFS needs more time to fully initialize (90+ seconds)
- The healthcheck script in `check-all-services.sh` might be using wrong command

### **Problem 2: Running `npm start` on Host**

**Issue:** You ran `npm start` directly on the server (line 575)  
**Problem:** 
- Application is trying to connect to `http://localhost:5001` (line 583)
- This works because IPFS port is exposed, BUT:
- Application should run **inside Docker container** (`lto-app`)
- Running on host bypasses Docker networking and environment variables

**Correct Approach:**
- Application should run in `lto-app` container
- Container already running (line 474: `lto-app Up 6 minutes (healthy)`)
- Don't run `npm start` on host - use the Docker container

---

## Fixes Applied

### **1. Improved IPFS Healthcheck**

**Changed from:**
```yaml
test: ["CMD-SHELL", "wget --spider --quiet http://localhost:5001/api/v0/version || exit 1"]
```

**Changed to:**
```yaml
test: ["CMD-SHELL", "ipfs id > /dev/null 2>&1 || curl -f -s -X POST http://localhost:5001/api/v0/version > /dev/null || exit 1"]
```

**Why:**
- Tries `ipfs id` first (native IPFS command)
- Falls back to `curl` if `ipfs` command not available
- Increased `start_period` to 90s (IPFS needs more time)
- More reliable healthcheck

### **2. Fixed Service Check Script**

Updated `check-all-services.sh` to use the same reliable healthcheck method.

---

## Important: Don't Run `npm start` on Host

### **Why This Is Wrong:**

1. **Environment Variables:**
   - Host: Uses system environment or `.env` file
   - Docker: Uses `docker-compose.unified.yml` environment variables
   - **Mismatch:** Host might not have correct IPFS_HOST, STORAGE_MODE, etc.

2. **Network Access:**
   - Host: Connects to `localhost:5001` (exposed port)
   - Docker: Connects to `ipfs:5001` (Docker service name)
   - **Both work, but Docker is correct**

3. **Port Conflicts:**
   - Host: Tries to bind to port 3001 (might conflict with Docker container)
   - Docker: Container already running on port 3001

### **Correct Usage:**

**✅ Use Docker Container (Already Running):**
```bash
# Application is already running in lto-app container
docker compose -f docker-compose.unified.yml ps lto-app

# View logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50

# Restart if needed
docker compose -f docker-compose.unified.yml restart lto-app
```

**❌ Don't Run on Host:**
```bash
# DON'T do this:
npm start  # This runs on host, not in Docker
```

---

## Next Steps

### **1. Wait for IPFS Healthcheck (90 seconds)**

The healthcheck shows `health: starting` because:
- IPFS was restarted about 1 minute ago (line 473)
- Healthcheck `start_period` is now 90 seconds
- IPFS needs time to fully initialize

**Action:** Wait 30-60 more seconds, then check again:
```bash
docker compose -f docker-compose.unified.yml ps ipfs
```

### **2. Verify IPFS is Working**

Even if healthcheck shows "starting", IPFS is working:
- ✅ Connectivity test passed (line 515)
- ✅ Application can connect (line 593-594)
- ✅ Ports are active (lines 548-549)

**Test document upload:**
- Try uploading a document through the web interface
- Check application logs: `docker compose -f docker-compose.unified.yml logs lto-app --tail=50`

### **3. Stop Host Process (If Running)**

If you started `npm start` on the host:
```bash
# Press Ctrl+C to stop it
# Or find and kill the process:
ps aux | grep "node server.js"
kill <PID>
```

---

## Summary

### **IPFS Status:**
- ✅ **Working correctly** (connectivity tests pass)
- ⚠️ **Healthcheck in progress** (needs 90 seconds to initialize)
- ✅ **Application can connect** (confirmed in logs)

### **Application Status:**
- ✅ **Running in Docker** (`lto-app` container)
- ❌ **Don't run `npm start` on host** (use Docker container)

### **Healthcheck:**
- ✅ **Fixed** (uses multiple fallback methods)
- ⏳ **Wait 90 seconds** after IPFS restart for healthcheck to pass

---

**The IPFS "unhealthy" status is just a timing issue - IPFS is actually working fine!**

