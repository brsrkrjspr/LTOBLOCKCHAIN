# Nginx Container Missing - Quick Fix

**Issue:** Nginx container is not running, causing `ERR_CONNECTION_REFUSED`

**Root Cause:** Nginx handles external HTTP/HTTPS requests (ports 80/443) and forwards them to the application. Without it, external requests can't reach the server.

---

## 🚀 **IMMEDIATE FIX**

Run this command on your DigitalOcean server:

```bash
cd ~/LTOBLOCKCHAIN
docker compose -f docker-compose.unified.yml up -d nginx
```

---

## ✅ **VERIFICATION**

After starting nginx, verify it's running:

```bash
# Check nginx status
docker ps | grep nginx

# Check nginx logs
docker logs nginx --tail=50

# Test nginx configuration
docker exec nginx nginx -t

# Check if ports 80/443 are listening
sudo netstat -tuln | grep -E ":80|:443"
```

**Expected Output:**
- Nginx container should show "Up" status
- Ports 80 and 443 should be listening
- Nginx config test should pass

---

## 🔍 **WHY THIS HAPPENED**

From your terminal output:
- ✅ `lto-app` is running (healthy)
- ✅ `postgres` is running (healthy)
- ✅ All Fabric services are running
- ❌ **`nginx` container is missing/not started**

This means:
- Application is working internally ✅
- External requests can't reach it ❌
- Ports 80/443 are not being served ❌

---

## 📋 **FULL SERVICE CHECK**

After starting nginx, verify all services:

```bash
docker compose -f docker-compose.unified.yml ps
```

**Expected Services:**
```
NAME                 STATUS
nginx                Up X minutes          ← Should be here now!
lto-app              Up X minutes (healthy)
postgres             Up X minutes (healthy)
ipfs                 Up X minutes
orderer.lto.gov.ph   Up X minutes
peer0.lto.gov.ph     Up X minutes
couchdb               Up X minutes (healthy)
```

---

## 🌐 **TEST ACCESS**

After nginx starts, test access:

```bash
# From your server
curl -I http://localhost
curl -I https://localhost

# From your local machine (after DNS propagates)
curl -I http://ltoblockchain.duckdns.org
curl -I https://ltoblockchain.duckdns.org
```

---

## 🔧 **IF NGINX FAILS TO START**

If nginx fails to start, check:

1. **Check nginx logs:**
   ```bash
   docker logs nginx
   ```

2. **Check if ports 80/443 are already in use:**
   ```bash
   sudo netstat -tuln | grep -E ":80|:443"
   ```

3. **Check nginx configuration:**
   ```bash
   docker exec nginx nginx -t
   ```

4. **Check if nginx config file exists:**
   ```bash
   ls -la nginx/nginx-ssl.conf
   ```

5. **If using HTTP-only (no SSL), check:**
   ```bash
   ls -la nginx/nginx-http-only.conf
   ```

---

## 📝 **NOTE**

If you're using HTTP-only mode (no SSL), you may need to update the docker-compose file to use `nginx-http-only.conf` instead of `nginx-ssl.conf`:

```yaml
volumes:
  - ./nginx/nginx-http-only.conf:/etc/nginx/nginx.conf:ro
```

But first, try starting nginx with the default configuration.

---

**Status:** 🔧 **FIX REQUIRED** - Start nginx container to enable external access.
