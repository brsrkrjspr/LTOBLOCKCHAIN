# ⏱️ Container Removal Timeout Analysis

**Date:** 2026-01-24  
**Script:** `scripts/complete-fabric-reset-reconfigure.sh`  
**Question:** Are timeouts sufficient for removing peer/orderer containers?

---

## 📊 **CURRENT TIMEOUT BEHAVIOR**

### **1. Docker Stop Command (Line 68, 83)**

**Current:**
```bash
docker stop peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli 2>/dev/null || true
sleep 2
```

**Docker Default Behavior:**
- **Graceful Stop:** Sends SIGTERM, waits up to **10 seconds** (default)
- **Force Stop:** If not stopped, sends SIGKILL (immediate)
- **Total Max Time:** ~10 seconds per container
- **No Explicit Timeout:** Uses Docker's default

**Issue:** ⚠️ **No explicit timeout** - relies on Docker defaults

---

### **2. Docker Compose Down (Line 79)**

**Current:**
```bash
docker compose -f docker-compose.unified.yml down -v --remove-orphans
```

**Behavior:**
- Stops containers gracefully (10s default per container)
- Then removes containers
- Can take **30-60 seconds** if containers are slow to stop

**Issue:** ⚠️ **No explicit timeout** - can hang if containers are stuck

---

### **3. Docker RM -F (Line 73-74, 86)**

**Current:**
```bash
docker rm -f peer0.lto.gov.ph orderer.lto.gov.ph couchdb cli
```

**Behavior:**
- **Force remove** - kills container if running, then removes
- **Usually fast:** < 1 second per container
- **Can hang:** If volumes are locked or Docker daemon is slow

**Issue:** ⚠️ **No timeout** - can hang indefinitely if Docker daemon is stuck

---

## ⏱️ **ACTUAL TIMING ANALYSIS**

### **Typical Container Removal Times:**

| Operation | Normal | Slow | Stuck |
|-----------|--------|------|-------|
| `docker stop` (healthy) | 1-3s | 5-10s | 10s+ |
| `docker stop` (busy) | 3-5s | 10s | 10s+ |
| `docker rm -f` (stopped) | <1s | 1-2s | Can hang |
| `docker rm -f` (running) | 1-2s | 3-5s | Can hang |
| `docker compose down` | 10-30s | 30-60s | Can hang |

### **Fabric Containers Specifically:**

- **Orderer:** Usually stops quickly (1-3s), but can take longer if processing transactions
- **Peer:** Can take 5-10s if chaincode is running or state is being committed
- **CouchDB:** Usually stops quickly (1-2s)
- **Chaincode Containers:** Usually <1s (lightweight)

---

## ⚠️ **CURRENT ISSUES**

### **1. No Explicit Timeout on `docker stop`**

**Problem:**
- Relies on Docker's default 10-second timeout
- If container is stuck, waits full 10 seconds
- No way to customize timeout per container

**Impact:** ⚠️ **Medium** - Usually fine, but can be slow

---

### **2. No Timeout on `docker rm -f`**

**Problem:**
- Can hang indefinitely if:
  - Volume is locked by another process
  - Docker daemon is slow/unresponsive
  - Container is in a bad state

**Impact:** ⚠️ **High** - Can cause script to hang indefinitely

---

### **3. Short Sleep After Stop**

**Problem:**
- `sleep 2` after `docker stop` may not be enough
- Containers may still be stopping when `docker rm` runs
- Can cause "container is running" errors

**Impact:** ⚠️ **Low** - Usually fine, but can cause errors

---

## ✅ **RECOMMENDED IMPROVEMENTS**

### **Option 1: Add Explicit Timeouts (Recommended)**

```bash
# Stop containers with explicit timeout
echo "   Stopping containers (timeout: 15s per container)..."
timeout 15s docker stop peer0.lto.gov.ph 2>/dev/null || docker kill peer0.lto.gov.ph 2>/dev/null || true
timeout 15s docker stop orderer.lto.gov.ph 2>/dev/null || docker kill orderer.lto.gov.ph 2>/dev/null || true
timeout 15s docker stop couchdb 2>/dev/null || docker kill couchdb 2>/dev/null || true
timeout 15s docker stop cli 2>/dev/null || docker kill cli 2>/dev/null || true

# Wait for containers to fully stop
sleep 3

# Force remove with timeout
echo "   Removing containers (timeout: 10s per container)..."
timeout 10s docker rm -f peer0.lto.gov.ph 2>/dev/null || true
timeout 10s docker rm -f orderer.lto.gov.ph 2>/dev/null || true
timeout 10s docker rm -f couchdb 2>/dev/null || true
timeout 10s docker rm -f cli 2>/dev/null || true
```

**Benefits:**
- ✅ Explicit timeouts prevent hanging
- ✅ Falls back to `docker kill` if stop times out
- ✅ Prevents indefinite waits

---

### **Option 2: Separate Removal with Indefinite Wait**

```bash
# Function to remove container with indefinite wait
remove_container_safely() {
    local container=$1
    local max_attempts=${2:-30}  # Default 30 attempts
    
    echo "   Removing $container..."
    
    # Stop container
    docker stop "$container" 2>/dev/null || true
    
    # Wait and remove with retries
    for i in $(seq 1 $max_attempts); do
        if docker rm -f "$container" 2>/dev/null; then
            echo "   ✅ $container removed (attempt $i)"
            return 0
        fi
        echo "   ⏳ Waiting for $container to be removable (attempt $i/$max_attempts)..."
        sleep 2
    done
    
    echo "   ⚠️  $container could not be removed after $max_attempts attempts"
    return 1
}

# Use function
remove_container_safely "peer0.lto.gov.ph"
remove_container_safely "orderer.lto.gov.ph"
remove_container_safely "couchdb"
remove_container_safely "cli"
```

**Benefits:**
- ✅ Waits indefinitely (with max attempts) until container is removable
- ✅ More reliable for stuck containers
- ✅ Better error reporting

---

### **Option 3: Parallel Removal with Timeout**

```bash
# Stop all containers in parallel with timeout
stop_containers_parallel() {
    local containers=("peer0.lto.gov.ph" "orderer.lto.gov.ph" "couchdb" "cli")
    local pids=()
    
    for container in "${containers[@]}"; do
        (
            timeout 15s docker stop "$container" 2>/dev/null || \
            docker kill "$container" 2>/dev/null || true
        ) &
        pids+=($!)
    done
    
    # Wait for all stops to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    sleep 3
}

# Remove all containers in parallel
remove_containers_parallel() {
    local containers=("peer0.lto.gov.ph" "orderer.lto.gov.ph" "couchdb" "cli")
    local pids=()
    
    for container in "${containers[@]}"; do
        (
            timeout 10s docker rm -f "$container" 2>/dev/null || true
        ) &
        pids+=($!)
    done
    
    # Wait for all removals to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
}
```

**Benefits:**
- ✅ Faster (parallel execution)
- ✅ Still has timeouts
- ✅ More efficient for multiple containers

---

## 🎯 **RECOMMENDATION**

### **Best Approach: Hybrid (Option 1 + Option 2)**

1. **Use explicit timeouts** for normal cases (fast)
2. **Fall back to indefinite wait** if timeout fails (reliable)
3. **Remove containers separately** for better error reporting

**Implementation:**
```bash
# Stop with timeout, fallback to kill
stop_container_with_timeout() {
    local container=$1
    timeout 15s docker stop "$container" 2>/dev/null || \
    docker kill "$container" 2>/dev/null || true
}

# Remove with retries (indefinite wait with max attempts)
remove_container_with_retry() {
    local container=$1
    local max_attempts=30
    
    for i in $(seq 1 $max_attempts); do
        if docker rm -f "$container" 2>/dev/null; then
            return 0
        fi
        sleep 2
    done
    
    echo "   ⚠️  Could not remove $container after $max_attempts attempts"
    return 1
}

# Usage
stop_container_with_timeout "peer0.lto.gov.ph"
stop_container_with_timeout "orderer.lto.gov.ph"
stop_container_with_timeout "couchdb"
stop_container_with_timeout "cli"

sleep 3

remove_container_with_retry "peer0.lto.gov.ph"
remove_container_with_retry "orderer.lto.gov.ph"
remove_container_with_retry "couchdb"
remove_container_with_retry "cli"
```

---

## 📊 **TIMEOUT COMPARISON**

| Approach | Speed | Reliability | Hanging Risk |
|----------|-------|-------------|--------------|
| **Current (no timeout)** | Fast | Medium | ⚠️ High |
| **Explicit timeout (15s)** | Fast | High | ✅ Low |
| **Indefinite wait (30 attempts)** | Slow | Very High | ✅ Very Low |
| **Hybrid (timeout + retry)** | Medium | Very High | ✅ Very Low |

---

## ✅ **CONCLUSION**

### **Current Timeouts:**
- ⚠️ **Insufficient** - No explicit timeouts on critical operations
- ⚠️ **Risk of hanging** - `docker rm -f` can hang indefinitely
- ✅ **Usually works** - But can be slow or hang in edge cases

### **Recommended:**
- ✅ **Add explicit timeouts** to `docker stop` (15s)
- ✅ **Add timeout wrapper** to `docker rm -f` (10s)
- ✅ **Add retry logic** with indefinite wait fallback (30 attempts × 2s = 60s max)
- ✅ **Remove containers separately** for better error reporting

**Total Max Time:** ~90 seconds (15s stop + 3s wait + 60s retry)  
**Normal Time:** ~5-10 seconds (fast path)

---

**Analysis Complete:** 2026-01-24  
**Recommendation:** ✅ **Add explicit timeouts + retry logic** for reliability
