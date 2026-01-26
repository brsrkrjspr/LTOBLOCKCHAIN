# DNS Resolution Error Analysis: "no such host"

**Date:** 2026-01-25  
**Error:** `lookup peer0.lto.gov.ph on 127.0.0.11:53: no such host`

**Location:** CLI container trying to connect to peer after restart

---

## 🔍 **Error Details**

```
Error: error getting endorser client for query: endorser client failed to connect to peer0.lto.gov.ph:7051: 
failed to create new connection: connection error: desc = "transport: error while dialing: 
dial tcp: lookup peer0.lto.gov.ph on 127.0.0.11:53: no such host"
```

**What this means:**
- CLI container is trying to resolve `peer0.lto.gov.ph` via DNS
- Using Docker's internal DNS server (`127.0.0.11:53`)
- DNS lookup **failed** - hostname not found

---

## 🎯 **Root Cause Analysis**

### **Timeline from Terminal:**

1. **Line 786:** `docker-compose stop peer0.lto.gov.ph` ✅ (stopped)
2. **Line 788:** `docker-compose up -d peer0.lto.gov.ph` ✅ (started)
3. **Line 789:** `sleep 40` ✅ (waited)
4. **Line 799-808:** CLI query **failed** with DNS error ❌

### **Possible Causes:**

#### **1. Peer Container Not Fully Started** ⚠️ **MOST LIKELY**

After restarting the peer, it may not have fully initialized:
- Peer container is "running" but not ready
- DNS registration hasn't completed yet
- Network attachment still in progress

**Evidence:**
- Only waited 40 seconds after restart
- Peer startup can take 30-60 seconds
- DNS registration happens after peer is fully ready

#### **2. Peer Container Failed to Start** ⚠️

The peer might have crashed or failed during startup:
- Configuration error (e.g., core.yaml issue)
- Port conflict
- Dependency not ready (CouchDB, Orderer)

**Check:** `docker logs peer0.lto.gov.ph --tail=50`

#### **3. Network Issue** ⚠️

Containers might not be on the same network:
- CLI container on different network
- Network not created properly
- DNS service not running

**Check:** Both containers should be on `trustchain` network

#### **4. DNS Cache/Propagation Delay** ⚠️

Docker's internal DNS might need time to update:
- DNS cache hasn't refreshed
- Container name not registered yet
- Network DNS service slow to update

---

## 🔧 **Diagnostic Steps**

### **Step 1: Check Peer Container Status**

```bash
# Check if peer is running
docker ps --filter "name=peer0.lto.gov.ph"

# Check peer logs for errors
docker logs peer0.lto.gov.ph --tail=100 | grep -i "error\|fatal\|panic\|started"

# Check if peer is listening on port 7051
docker exec peer0.lto.gov.ph netstat -tlnp | grep 7051
```

### **Step 2: Check Network Connectivity**

```bash
# Verify both containers are on same network
docker inspect cli | grep -A 10 "Networks"
docker inspect peer0.lto.gov.ph | grep -A 10 "Networks"

# Both should show "trustchain" network

# Test DNS resolution from CLI container
docker exec cli nslookup peer0.lto.gov.ph

# Test direct connection
docker exec cli ping -c 3 peer0.lto.gov.ph
```

### **Step 3: Check Peer Startup Time**

```bash
# Check when peer actually started
docker inspect peer0.lto.gov.ph | grep -i "startedat"

# Check peer logs for "Starting peer" message
docker logs peer0.lto.gov.ph | grep -i "starting\|started\|ready"
```

---

## ✅ **Solutions**

### **Solution 1: Wait Longer After Restart** (Quick Fix)

Peer needs more time to fully start and register DNS:

```bash
# Restart peer
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
sleep 5
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Wait longer (60 seconds instead of 40)
sleep 60

# Verify peer is ready
docker logs peer0.lto.gov.ph --tail=20 | grep -i "Deployed system chaincodes\|started peer"

# Then try query
docker exec cli bash -c "..."
```

### **Solution 2: Use IP Address Instead of Hostname** (Workaround)

If DNS is slow, use container IP directly:

```bash
# Get peer container IP
PEER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' peer0.lto.gov.ph)

# Use IP instead of hostname
docker exec cli bash -c "
export CORE_PEER_ADDRESS=$PEER_IP:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
"
```

**Note:** This is a workaround - DNS should work normally.

### **Solution 3: Restart Both Containers** (Full Fix)

Restart both CLI and peer to ensure network is properly initialized:

```bash
# Restart peer
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph
sleep 60

# Restart CLI (to refresh DNS cache)
docker-compose -f docker-compose.unified.yml restart cli
sleep 10

# Try query
docker exec cli bash -c "..."
```

### **Solution 4: Check Peer Health** (Diagnostic)

Verify peer actually started successfully:

```bash
# Check peer logs for successful startup
docker logs peer0.lto.gov.ph --tail=50 | grep -E "Starting peer|Deployed system chaincodes|started peer"

# If no "Deployed system chaincodes" message, peer didn't start properly
# Check for errors:
docker logs peer0.lto.gov.ph --tail=100 | grep -i "error\|fatal\|panic"
```

---

## 🎓 **Key Insights**

### **Why DNS Resolution Fails:**

1. **Docker DNS Registration:**
   - Containers register their hostname with Docker's internal DNS
   - Registration happens **after** container is fully started
   - If container crashes or fails to start, DNS entry is not created

2. **Peer Startup Sequence:**
   ```
   Container starts
       ↓
   Load configuration (core.yaml)
       ↓
   Connect to CouchDB
       ↓
   Connect to Orderer
       ↓
   Deploy system chaincodes (escc, vscc, etc.)
       ↓
   Register DNS hostname ← DNS available here
       ↓
   Peer ready for queries
   ```

3. **Timing Issue:**
   - If query happens before DNS registration, lookup fails
   - Need to wait for "Deployed system chaincodes" message
   - Usually takes 30-60 seconds

---

## 📋 **Prevention**

### **Best Practice: Wait for Peer Ready**

Instead of fixed sleep, wait for peer to be actually ready:

```bash
# Wait for peer to be ready (with timeout)
timeout=120
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker logs peer0.lto.gov.ph 2>&1 | grep -q "Deployed system chaincodes"; then
        echo "Peer is ready!"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
done

if [ $elapsed -ge $timeout ]; then
    echo "ERROR: Peer did not start within $timeout seconds"
    docker logs peer0.lto.gov.ph --tail=50
    exit 1
fi
```

### **Alternative: Use Health Check**

Add health check to peer in `docker-compose.unified.yml`:

```yaml
peer0.lto.gov.ph:
  # ... existing config ...
  healthcheck:
    test: ["CMD-SHELL", "peer node status || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 60s
```

Then wait for health:

```bash
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
docker-compose -f docker-compose.unified.yml wait --timeout=120 peer0.lto.gov.ph
```

---

## 🔍 **Most Likely Root Cause**

Based on the terminal output:

**The peer container was restarted, but:**
1. ✅ Container started (`docker-compose up -d` succeeded)
2. ⚠️ Only waited 40 seconds (might not be enough)
3. ❌ DNS not registered yet when query was attempted
4. ❌ Query failed because DNS lookup couldn't find `peer0.lto.gov.ph`

**Solution:** Wait longer (60+ seconds) or check peer logs for "Deployed system chaincodes" before querying.

---

**Next Steps:**
1. Check peer logs: `docker logs peer0.lto.gov.ph --tail=100`
2. Verify peer is actually running: `docker ps | grep peer0`
3. Wait longer or use health check before querying
4. If peer crashed, fix the underlying issue (likely core.yaml or escc)
