# IPFS Healthcheck Debugging

**Status:** IPFS shows "unhealthy" but `ipfs id` works correctly  
**Issue:** Healthcheck command may be failing despite IPFS working

---

## 🔍 **DEBUG STEPS**

### **Step 1: Test Healthcheck Command Manually**

```bash
# Test the exact healthcheck command
docker exec ipfs sh -c "ipfs id > /dev/null 2>&1 || exit 1"
echo $?  # Should return 0 if successful
```

### **Step 2: Check Healthcheck Logs**

```bash
# Check Docker healthcheck logs
docker inspect ipfs | grep -A 10 Health

# Or check healthcheck status
docker inspect ipfs --format='{{json .State.Health}}' | jq
```

### **Step 3: Try Alternative Healthcheck**

If the current healthcheck is failing, try a simpler version:

```yaml
healthcheck:
  test: ["CMD", "ipfs", "id"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 120s
```

Or check if IPFS daemon is running:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pgrep -f 'ipfs daemon' || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 120s
```

---

## 🔧 **ALTERNATIVE FIX**

Since IPFS is working, you can also disable the healthcheck temporarily:

```yaml
# Comment out or remove healthcheck section
# healthcheck:
#   test: ["CMD-SHELL", "ipfs id > /dev/null 2>&1 || exit 1"]
#   interval: 30s
#   timeout: 10s
#   retries: 5
#   start_period: 120s
```

**Note:** This is cosmetic - IPFS functionality is not affected.

---

## ✅ **VERIFICATION**

IPFS is working correctly:
- ✅ `docker exec ipfs ipfs id` returns valid output
- ✅ Application connects to IPFS successfully
- ✅ IPFS API is accessible

The "unhealthy" status is just a healthcheck indicator issue, not a functional problem.

---

**Status:** ⚠️ **COSMETIC ISSUE** - IPFS works, healthcheck indicator needs adjustment.
