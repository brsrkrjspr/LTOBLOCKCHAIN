# 🔧 502 Bad Gateway - Quick Fix Guide

## **What This Error Means**

A **502 Bad Gateway** error means:
- ✅ Nginx is running and receiving requests
- ❌ Nginx cannot connect to the backend application (`lto-app`)
- The application may have crashed, not started, or is not listening on port 3001

---

## **Quick Diagnostic Steps**

### **1. Check Application Container Status**

```bash
docker compose -f docker-compose.unified.yml ps lto-app
```

**Expected:** `Up X minutes (healthy)`  
**If not:** Container is not running or crashed

### **2. Check Application Logs**

```bash
docker compose -f docker-compose.unified.yml logs lto-app --tail=100
```

**Look for:**
- ❌ `Error:` or `FATAL:` messages
- ❌ `Cannot connect to...` errors
- ❌ `EADDRINUSE` (port already in use)
- ❌ `ECONNREFUSED` (database/IPFS connection failed)
- ✅ `🚀 TrustChain LTO System running on port 3001` (good sign)

### **3. Test Application Health Endpoint**

```bash
# From inside the container
docker exec lto-app curl -s http://localhost:3001/api/health
```

**Expected:** JSON response with `{"status":"ok"}`  
**If fails:** Application is not running or crashed

### **4. Check if Application is Listening**

```bash
docker exec lto-app netstat -tuln | grep 3001
# OR
docker exec lto-app ss -tuln | grep 3001
```

**Expected:** `:3001` in the output  
**If empty:** Application is not listening on port 3001

---

## **Common Causes & Fixes**

### **Cause 1: Application Container Crashed**

**Symptoms:**
- Container shows `Exited` or `Restarting` status
- Logs show fatal errors

**Fix:**
```bash
# Restart the application
docker compose -f docker-compose.unified.yml restart lto-app

# Wait 30 seconds, then check logs
sleep 30
docker compose -f docker-compose.unified.yml logs lto-app --tail=50
```

### **Cause 2: Application Failed to Start**

**Symptoms:**
- Container is running but not responding
- Logs show initialization errors

**Fix:**
```bash
# Check what's preventing startup
docker compose -f docker-compose.unified.yml logs lto-app --tail=100 | grep -i "error\|fatal"

# Common issues:
# - Database connection failed → Check postgres container
# - IPFS connection failed → Check ipfs container
# - Fabric connection failed → Check peer/orderer containers
# - Missing environment variables → Check .env file
```

### **Cause 3: Port 3001 Not Listening**

**Symptoms:**
- Container is running
- `netstat` shows no port 3001
- Health endpoint fails

**Fix:**
```bash
# Restart the application
docker compose -f docker-compose.unified.yml restart lto-app

# Wait for startup (60 seconds)
sleep 60

# Verify it's listening
docker exec lto-app netstat -tuln | grep 3001
```

### **Cause 4: Network Connectivity Issue**

**Symptoms:**
- Application is running and listening
- Nginx still shows 502

**Fix:**
```bash
# Test connectivity from nginx to lto-app
docker exec nginx ping -c 2 lto-app

# Test HTTP connection
docker exec nginx wget -q --spider http://lto-app:3001/api/health || docker exec nginx curl -s http://lto-app:3001/api/health

# If fails, restart both containers
docker compose -f docker-compose.unified.yml restart nginx lto-app
```

### **Cause 5: Application Taking Too Long to Respond**

**Symptoms:**
- Application is running
- Health endpoint works when tested directly
- Nginx times out

**Fix:**
- This is usually a temporary issue during startup
- Wait 2-3 minutes for full initialization
- Check if Fabric/IPFS connections are slow

---

## **Complete Restart Procedure**

If the above doesn't work, try a complete restart:

```bash
# 1. Stop all services
docker compose -f docker-compose.unified.yml stop

# 2. Start services in order
docker compose -f docker-compose.unified.yml up -d postgres ipfs
sleep 10

docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph peer0.lto.gov.ph couchdb
sleep 10

docker compose -f docker-compose.unified.yml up -d lto-app
sleep 60  # Wait for application to fully initialize

docker compose -f docker-compose.unified.yml up -d nginx

# 3. Check status
docker compose -f docker-compose.unified.yml ps

# 4. Check application logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50
```

---

## **Automated Diagnostic Script**

Run the diagnostic script to identify the exact issue:

```bash
bash scripts/diagnose-502-error.sh
```

This will check:
- ✅ Container status
- ✅ Port listening
- ✅ Health endpoint
- ✅ Network connectivity
- ✅ Error logs
- ✅ Network configuration

---

## **Verify Fix**

After applying fixes, verify the application is working:

```bash
# 1. Check container status
docker compose -f docker-compose.unified.yml ps lto-app

# 2. Test health endpoint
docker exec lto-app curl -s http://localhost:3001/api/health

# 3. Test from nginx
docker exec nginx curl -s http://lto-app:3001/api/health

# 4. Check nginx logs
docker compose -f docker-compose.unified.yml logs nginx --tail=20
```

**Expected:** All commands should succeed, and the website should load without 502 errors.

---

## **Still Not Working?**

If the issue persists:

1. **Check all service dependencies:**
   ```bash
   docker compose -f docker-compose.unified.yml ps
   ```
   All services should be `Up` and `healthy` (or at least `Up`).

2. **Check resource usage:**
   ```bash
   docker stats --no-stream
   ```
   Ensure containers have enough memory/CPU.

3. **Review full application logs:**
   ```bash
   docker compose -f docker-compose.unified.yml logs lto-app --tail=200
   ```

4. **Check nginx error logs:**
   ```bash
   docker exec nginx cat /var/log/nginx/error.log | tail -50
   ```

---

**Most Common Solution:** Simply restart the application container:
```bash
docker compose -f docker-compose.unified.yml restart lto-app
```

Wait 60 seconds, then refresh your browser.

