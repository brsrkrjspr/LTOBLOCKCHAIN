# 🚨 CRITICAL: Container Can't Connect to Fabric

## The Problem

Even inside `lto-app` container, the script **cannot connect** to Fabric:
```
Failed to connect before the deadline on Endorser- name: peer0.lto.gov.ph
```

This means either:
1. **Fabric containers are NOT running**
2. **Network configuration issue**
3. **Application itself might not be connecting either**

---

## ✅ Diagnostic Steps

### Step 1: Check if Fabric Containers Are Running

```bash
# Check Fabric container status
docker-compose -f docker-compose.unified.yml ps | grep -E "peer0|orderer|couchdb"

# Should show containers in "Up" state
```

**If containers are NOT running:**
```bash
# Start Fabric network
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph orderer.lto.gov.ph couchdb
```

### Step 2: Check Application Startup Logs

```bash
# See if application connected to Fabric on startup
docker logs lto-app 2>&1 | grep -i "fabric\|blockchain\|connected" | head -30

# Look for:
# ✅ "✅ Connected to Hyperledger Fabric network successfully" = CONNECTED
# ❌ "❌ Failed to connect to Fabric network" = NOT CONNECTED
# ⚠️  "Real Hyperledger Fabric integration active" = CONFIGURED (but may not be connected)
```

### Step 3: Test Network Resolution Inside Container

```bash
# Test if container can resolve peer hostname
docker exec lto-app ping -c 2 peer0.lto.gov.ph

# Test if container can reach peer port
docker exec lto-app nc -zv peer0.lto.gov.ph 7051
```

### Step 4: Check Container Network

```bash
# Verify container is on correct network
docker inspect lto-app | grep -A 10 "Networks"

# Should show "trustchain" network
```

### Step 5: Check CouchDB (Most Direct Check)

```bash
# If CouchDB is accessible, Fabric is running
curl -u admin:adminpw http://localhost:5984/_all_dbs

# If you see databases, Fabric IS running
```

---

## Most Likely Issues

### Issue 1: Fabric Containers Not Running

**Check:**
```bash
docker-compose -f docker-compose.unified.yml ps
```

**Fix:**
```bash
# Start Fabric services
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph orderer.lto.gov.ph couchdb

# Wait for them to be healthy
docker-compose -f docker-compose.unified.yml ps
```

### Issue 2: Application Never Connected

**Check:**
```bash
docker logs lto-app 2>&1 | grep -i "fabric" | head -20
```

**If application shows connection errors:**
- Fabric containers might not be running when app started
- Network configuration might be wrong
- Wallet/admin identity might be missing

### Issue 3: Network Configuration

**Check:**
```bash
# Verify network-config.json exists in container
docker exec lto-app ls -la /app/network-config.json

# Check wallet exists
docker exec lto-app ls -la /app/wallet/admin.id
```

---

## 🔍 Critical Question: Is Application Actually Using Fabric?

**Check application logs:**
```bash
docker logs lto-app 2>&1 | grep -E "fabric|blockchain|connected" | tail -20
```

**If logs show:**
- ✅ "✅ Connected to Hyperledger Fabric network successfully" → **Application CAN connect**
- ❌ "❌ Failed to connect" → **Application CANNOT connect**
- ⚠️  No Fabric logs → **Application might be using fallback/mock**

---

## Next Steps

1. **Check if Fabric is running:**
   ```bash
   docker-compose -f docker-compose.unified.yml ps | grep -E "peer0|orderer"
   ```

2. **Check application logs:**
   ```bash
   docker logs lto-app 2>&1 | grep -i fabric | head -20
   ```

3. **If Fabric is NOT running, start it:**
   ```bash
   docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph orderer.lto.gov.ph couchdb
   ```

4. **If Fabric IS running but can't connect, check network:**
   ```bash
   docker exec lto-app ping peer0.lto.gov.ph
   ```

This will tell us if Fabric is actually running and if the application can connect!
