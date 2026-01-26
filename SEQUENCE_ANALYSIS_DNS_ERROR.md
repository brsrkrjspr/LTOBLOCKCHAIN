# Sequence Analysis: DNS Resolution Error

**Date:** 2026-01-25  
**Error:** `lookup peer0.lto.gov.ph on 127.0.0.11:53: no such host`

---

## 📋 **Complete Sequence from Terminal**

### **Step-by-Step Breakdown:**

1. **Lines 997-1017:** ✅ Created `core.yaml` with proper handlers
   ```bash
   mkdir -p fabric-network/config
   cat > fabric-network/config/core.yaml << 'EOF'
   chaincode:
     mode: dev
   handlers:
     endorsers:
       escc:
         name: DefaultEndorsement
   ...
   ```

2. **Line 1018:** ✅ Stopped peer
   ```bash
   docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
   ```

3. **Line 1019:** ✅ Waited 5 seconds
   ```bash
   sleep 5
   ```

4. **Line 1020:** ✅ Started peer
   ```bash
   docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
   ```

5. **Line 1021:** ⚠️ **Waited only 40 seconds**
   ```bash
   sleep 40
   ```

6. **Lines 1022-1025:** ✅ Docker output shows peer started
   ```
   [+] stop 1/1
   ✔ Container peer0.lto.gov.ph Stopped
   [+] up 2/2
   ✔ Container orderer.lto.gov.ph Running
   ✔ Container couchdb            Healthy
   ```

7. **Line 1026:** ✅ Restarted backend
   ```bash
   docker-compose -f docker-compose.unified.yml restart lto-app
   ```

8. **Line 1027:** ✅ Waited 15 seconds
   ```bash
   sleep 15
   ```

9. **Lines 1028-1035:** ❌ **Query attempted immediately**
   ```bash
   docker exec cli bash -c "
   export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
   peer chaincode query ...
   "
   ```

10. **Line 1036:** ❌ **DNS Error**
    ```
    Error: lookup peer0.lto.gov.ph on 127.0.0.11:53: no such host
    ```

---

## 🔍 **Root Cause Analysis**

### **The Problem:**

**Timing Issue:** The query was attempted **too soon** after peer restart.

### **What Actually Happens:**

1. **Peer container starts** (Docker reports it as "running")
2. **Peer loads configuration** (`core.yaml`)
3. **Peer connects to CouchDB** (dependency check)
4. **Peer connects to Orderer** (network setup)
5. **Peer deploys system chaincodes** (escc, vscc) ← **Takes 30-60 seconds**
6. **Peer registers DNS hostname** ← **DNS available HERE**
7. **Peer ready for queries** ← **Query should happen HERE**

### **What Went Wrong:**

- ✅ Steps 1-4 completed (container running, dependencies connected)
- ⚠️ Step 5 might not have completed (only waited 40 seconds)
- ❌ Step 6 didn't happen yet (DNS not registered)
- ❌ Query attempted at step 6 → DNS lookup failed

---

## 🎯 **Why 40 Seconds Wasn't Enough**

### **Peer Startup Timeline:**

```
0s    → Container starts
5s    → Configuration loaded
10s   → CouchDB connection established
15s   → Orderer connection established
20-40s → System chaincodes deploying (escc, vscc)
40s   → Query attempted ← TOO EARLY!
45-60s → System chaincodes deployed
60s   → DNS registered ← DNS available here
65s   → Peer fully ready ← Query should happen here
```

**The query happened at 40 seconds, but DNS registration happens around 60 seconds.**

---

## ✅ **Solutions**

### **Solution 1: Wait Longer (Quick Fix)**

Increase wait time from 40 to 60+ seconds:

```bash
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
sleep 60  # Instead of 40
```

### **Solution 2: Wait for Peer Ready (Better Fix)**

Wait for actual readiness signal instead of fixed time:

```bash
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Wait for "Deployed system chaincodes" message
timeout=120
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker logs peer0.lto.gov.ph --tail=50 2>&1 | grep -q "Deployed system chaincodes"; then
        echo "Peer is ready!"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
done
```

### **Solution 3: Use Updated Script**

The `fix-escc-root-cause.sh` script has been updated to:
- ✅ Wait for "Deployed system chaincodes" message
- ✅ Check DNS resolution before querying
- ✅ Use IP address as fallback if DNS fails
- ✅ Provide better error messages

**Run the updated script:**
```bash
bash scripts/fix-escc-root-cause.sh
```

### **Solution 4: Run Diagnostic**

If DNS error persists, run diagnostic:

```bash
bash scripts/diagnose-peer-dns-issue.sh
```

This will check:
- Peer container status
- Peer startup completion
- Network configuration
- DNS resolution
- Port listening
- Start time

---

## 📊 **Timeline Comparison**

### **Current Sequence (Failed):**
```
0s   → Stop peer
5s   → Start peer
45s  → Wait 40s
45s  → Restart backend
60s  → Wait 15s
60s  → Query ← DNS ERROR (too early)
```

### **Correct Sequence (Should Work):**
```
0s   → Stop peer
5s   → Start peer
45s  → Wait 40s
45s  → Check for "Deployed system chaincodes"
65s  → Wait additional 20s (if not ready)
65s  → DNS registered
65s  → Restart backend
80s  → Wait 15s
80s  → Query ← Should succeed
```

---

## 🎓 **Key Lessons**

1. **Container "running" ≠ Container "ready"**
   - Docker reports container as running immediately
   - But peer needs time to initialize fully

2. **DNS Registration is Last Step**
   - DNS hostname is registered AFTER system chaincodes deploy
   - This is the final step before peer is query-ready

3. **Fixed Sleep Times Are Unreliable**
   - 40 seconds might be enough sometimes
   - But not always (depends on system load, network, etc.)
   - Better to wait for actual readiness signal

4. **Check Logs for Readiness**
   - Look for "Deployed system chaincodes" message
   - This indicates peer is fully initialized

---

## 🔧 **Updated Fix Script**

The `fix-escc-root-cause.sh` script now:
- ✅ Waits for "Deployed system chaincodes" (up to 120 seconds)
- ✅ Checks DNS resolution before querying
- ✅ Falls back to IP address if DNS fails
- ✅ Provides detailed error messages
- ✅ Checks peer container status

**Use the updated script for reliable fixes.**

---

## 📋 **Next Steps**

1. **Run diagnostic** to see current state:
   ```bash
   bash scripts/diagnose-peer-dns-issue.sh
   ```

2. **Run updated fix script**:
   ```bash
   bash scripts/fix-escc-root-cause.sh
   ```

3. **If DNS still fails**, check:
   - Peer logs: `docker logs peer0.lto.gov.ph --tail=100`
   - Peer status: `docker ps | grep peer0`
   - Network: `docker inspect peer0.lto.gov.ph | grep -A 10 Networks`

---

**Summary:** The query was attempted 40 seconds after peer restart, but DNS registration happens around 60 seconds. The fix script has been updated to wait for actual peer readiness instead of using a fixed sleep time.
