# Peer Container Restart Loop - Diagnostic Steps

**Issue:** `Container is restarting, wait until the container is running`

This means the peer is **crashing** and Docker is automatically restarting it.

---

## 🔍 **Immediate Diagnostic Steps**

### **Step 1: Check Peer Logs (Most Important)**

```bash
# Check recent logs to see why it's crashing
docker logs peer0.lto.gov.ph --tail=100

# Look for error messages, especially:
# - Configuration errors
# - Port conflicts
# - Connection failures
# - File not found errors
```

### **Step 2: Check Container Status**

```bash
# See restart count and status
docker ps -a --filter "name=peer0.lto.gov.ph"

# Check restart count - if it's high, container is crashing repeatedly
docker inspect peer0.lto.gov.ph --format='{{.RestartCount}}'
```

### **Step 3: Stop the Restart Loop**

```bash
# Stop the container to prevent restart loop
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph

# Now you can check logs without it restarting
docker logs peer0.lto.gov.ph --tail=200
```

---

## 🎯 **Common Causes and Fixes**

### **Cause 1: Configuration Error in core.yaml**

**Symptoms:**
- YAML syntax error in logs
- "Config File" error
- "Invalid configuration" error

**Fix:**
```bash
# Check core.yaml syntax
cat fabric-network/config/core.yaml

# Validate YAML (if yq is installed)
yq eval . fabric-network/config/core.yaml

# Check for common issues:
# - Missing colons after keys
# - Incorrect indentation (should be 2 spaces)
# - Duplicate keys
```

### **Cause 2: Volume Mount Issue**

**Symptoms:**
- "File not found" errors
- "Permission denied" errors

**Fix:**
```bash
# Check if directory exists
ls -la fabric-network/config/

# Check file permissions
ls -la fabric-network/config/core.yaml

# Verify volume mount in docker-compose
grep -A 5 "fabric-network/config" docker-compose.unified.yml
```

### **Cause 3: Port Conflict**

**Symptoms:**
- "Address already in use" error
- "Bind: address already in use" error

**Fix:**
```bash
# Check if port 7051 is already in use
netstat -tlnp | grep 7051
# or
ss -tlnp | grep 7051

# If something else is using it, stop that service or change peer port
```

### **Cause 4: Dependency Not Ready**

**Symptoms:**
- "Connection refused" to CouchDB
- "Connection refused" to Orderer
- "Failed to connect" errors

**Fix:**
```bash
# Check if dependencies are running
docker ps | grep -E "couchdb|orderer"

# Check if they're healthy
docker ps --filter "name=couchdb" --format "{{.Status}}"
docker ps --filter "name=orderer" --format "{{.Status}}"

# If CouchDB is not healthy, check its logs
docker logs couchdb --tail=50
```

### **Cause 5: Resource Constraints**

**Symptoms:**
- "Out of memory" errors
- Container killed by OOM killer

**Fix:**
```bash
# Check system resources
free -h
df -h

# Check Docker stats
docker stats --no-stream peer0.lto.gov.ph
```

---

## 🔧 **Step-by-Step Recovery**

### **Step 1: Stop Container**

```bash
# Stop to prevent restart loop
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
```

### **Step 2: Check Logs**

```bash
# Get full error message
docker logs peer0.lto.gov.ph --tail=200 > peer-logs.txt
cat peer-logs.txt

# Look for the FIRST error (that's usually the root cause)
```

### **Step 3: Identify Error Pattern**

Based on logs, identify which category it falls into:
- Configuration error → Fix core.yaml
- Volume mount error → Fix file permissions/path
- Port conflict → Free up port or change config
- Dependency error → Start/fix dependencies
- Resource error → Increase resources or optimize

### **Step 4: Fix the Issue**

Apply the appropriate fix from "Common Causes" above.

### **Step 5: Verify Fix**

```bash
# Check core.yaml is valid (if that was the issue)
cat fabric-network/config/core.yaml | grep -A 6 "^handlers:"

# Verify dependencies are ready
docker ps | grep -E "couchdb|orderer"
```

### **Step 6: Start Peer**

```bash
# Start peer
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Watch logs in real-time
docker logs -f peer0.lto.gov.ph
```

**Press Ctrl+C to stop watching logs, then check if it stays running:**

```bash
# Wait 10 seconds
sleep 10

# Check if still running (not restarting)
docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Status}}"
```

---

## 📋 **Quick Diagnostic Commands**

```bash
# 1. Check why it's restarting
docker logs peer0.lto.gov.ph --tail=100 | grep -i "error\|fatal\|panic" | head -10

# 2. Check restart count
docker inspect peer0.lto.gov.ph --format='Restart count: {{.RestartCount}}'

# 3. Check dependencies
docker ps | grep -E "couchdb|orderer"

# 4. Check port conflict
netstat -tlnp | grep 7051

# 5. Check file exists
ls -la fabric-network/config/core.yaml

# 6. Check YAML syntax (basic check)
head -20 fabric-network/config/core.yaml
```

---

## 🎯 **Most Likely Issues**

Based on the context (we just created core.yaml), the most likely causes are:

1. **YAML Syntax Error** - Check indentation, colons, etc.
2. **Volume Mount Not Working** - File exists on host but not in container
3. **Dependency Not Ready** - CouchDB or Orderer not started/healthy

---

## ✅ **Next Steps**

1. **Run these commands in order:**
   ```bash
   # Stop container
   docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
   
   # Check logs
   docker logs peer0.lto.gov.ph --tail=200
   ```

2. **Share the error message** from logs (especially the first error)

3. **Check dependencies:**
   ```bash
   docker ps | grep -E "couchdb|orderer"
   ```

4. **Verify core.yaml:**
   ```bash
   cat fabric-network/config/core.yaml
   ```

Once you identify the specific error from the logs, we can apply the exact fix needed.
