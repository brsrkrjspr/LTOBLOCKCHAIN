# IPFS Unhealthy Status Fix

**Status:** IPFS shows as "unhealthy" but is likely working correctly  
**Root Cause:** Healthcheck command may be failing or IPFS needs more initialization time

---

## 🔍 **STEP 1: Verify IPFS is Actually Working**

Before fixing, confirm IPFS is functional:

```bash
# Test IPFS API directly
docker exec ipfs ipfs id

# Test IPFS API via HTTP
docker exec ipfs curl -s -X POST http://localhost:5001/api/v0/version

# Test from application container
docker exec lto-app curl -s http://ipfs:5001/api/v0/version
```

**Expected Output:**
- `ipfs id` should return node information
- HTTP API should return version JSON
- Application should be able to connect

---

## 🔧 **STEP 2: Fix Healthcheck**

The current healthcheck might be too strict. Try these options:

### **Option A: Use HTTP API Healthcheck (Recommended)**

Update `docker-compose.unified.yml` IPFS healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f -s -X POST http://localhost:5001/api/v0/version > /dev/null || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 120s
```

### **Option B: Use IPFS Command (If curl not available)**

```yaml
healthcheck:
  test: ["CMD-SHELL", "ipfs id > /dev/null 2>&1 || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 120s
```

### **Option C: Combined Fallback (Most Reliable)**

```yaml
healthcheck:
  test: ["CMD-SHELL", "ipfs id > /dev/null 2>&1 || curl -f -s -X POST http://localhost:5001/api/v0/version > /dev/null || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 120s
```

---

## 🚀 **STEP 3: Apply Fix**

After updating the healthcheck:

```bash
# Restart IPFS to apply new healthcheck
docker compose -f docker-compose.unified.yml restart ipfs

# Wait 2 minutes for IPFS to initialize
sleep 120

# Check status
docker compose -f docker-compose.unified.yml ps ipfs
```

**Expected:** Status should change to "healthy" after 2 minutes

---

## ✅ **STEP 4: Verify Fix**

```bash
# Check IPFS status
docker compose -f docker-compose.unified.yml ps ipfs

# Check IPFS logs
docker logs ipfs --tail=50

# Test IPFS functionality
docker exec ipfs ipfs id
docker exec ipfs curl -s -X POST http://localhost:5001/api/v0/version
```

---

## 🔍 **TROUBLESHOOTING**

### **If IPFS Still Shows Unhealthy:**

1. **Check if IPFS is actually working:**
   ```bash
   # Test from application
   docker exec lto-app curl -s http://ipfs:5001/api/v0/version
   ```

2. **Check IPFS logs:**
   ```bash
   docker logs ipfs --tail=100
   ```

3. **Check if IPFS daemon is running:**
   ```bash
   docker exec ipfs ps aux | grep ipfs
   ```

4. **Manually test healthcheck command:**
   ```bash
   # Test the healthcheck command directly
   docker exec ipfs sh -c "ipfs id > /dev/null 2>&1 || curl -f -s -X POST http://localhost:5001/api/v0/version > /dev/null || exit 1"
   echo $?  # Should return 0 if successful
   ```

### **If IPFS is Not Working:**

1. **Check IPFS data volume:**
   ```bash
   docker volume inspect LTOBLOCKCHAIN_ipfs-data
   ```

2. **Restart IPFS completely:**
   ```bash
   docker compose -f docker-compose.unified.yml stop ipfs
   docker compose -f docker-compose.unified.yml rm -f ipfs
   docker compose -f docker-compose.unified.yml up -d ipfs
   ```

3. **Check system resources:**
   ```bash
   docker stats ipfs --no-stream
   free -h
   ```

---

## 📝 **IMPORTANT NOTES**

### **IPFS "Unhealthy" Status is Often Cosmetic**

From your application logs, IPFS is **actually working**:
- ✅ `✅ Connected to IPFS version 0.39.0`
- ✅ `🌐 Using IPFS storage mode`
- ✅ Application can connect to IPFS

**The healthcheck status doesn't affect functionality** - it's just a monitoring indicator.

### **If Everything Works, You Can Ignore It**

If:
- Application connects to IPFS successfully ✅
- Document uploads work ✅
- No errors in application logs ✅

Then the "unhealthy" status is just a healthcheck configuration issue and can be safely ignored.

---

## 🎯 **QUICK FIX COMMAND**

Run this to update and restart IPFS with improved healthcheck:

```bash
cd ~/LTOBLOCKCHAIN

# Backup current docker-compose
cp docker-compose.unified.yml docker-compose.unified.yml.backup

# Edit healthcheck (use your preferred editor)
# Change line 248 to use Option C (combined fallback)

# Restart IPFS
docker compose -f docker-compose.unified.yml restart ipfs

# Wait and check
sleep 120
docker compose -f docker-compose.unified.yml ps ipfs
```

---

**Status:** 🔧 **FIX AVAILABLE** - IPFS is working, healthcheck just needs adjustment.
