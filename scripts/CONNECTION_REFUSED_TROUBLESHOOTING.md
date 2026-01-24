# Connection Refused Troubleshooting Guide

**Error:** `ERR_CONNECTION_REFUSED` when accessing `ltoblockchain.duckdns.org`

---

## 🔍 **STEP-BY-STEP DIAGNOSIS**

### **Step 1: Check if Docker Containers are Running**

Run on your DigitalOcean server:

```bash
# Check all services status
docker compose -f docker-compose.unified.yml ps

# Expected output should show all services as "Up"
```

**If containers are not running**, start them:

```bash
cd ~/LTOBLOCKCHAIN  # or wherever your project is
docker compose -f docker-compose.unified.yml up -d
```

---

### **Step 2: Check Nginx Container**

Nginx is the reverse proxy that handles external requests:

```bash
# Check nginx status
docker ps | grep nginx

# Check nginx logs
docker logs nginx --tail=50

# Test nginx configuration
docker exec nginx nginx -t
```

**If nginx is not running:**

```bash
docker compose -f docker-compose.unified.yml up -d nginx
```

---

### **Step 3: Check if Ports 80 and 443 are Open**

```bash
# Check if ports are listening
sudo netstat -tuln | grep -E ":80|:443"
# OR
sudo ss -tuln | grep -E ":80|:443"

# Check firewall status
sudo ufw status
# OR
sudo iptables -L -n | grep -E "80|443"
```

**If ports are not open**, check your firewall:

```bash
# Allow HTTP/HTTPS (if using UFW)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Check DigitalOcean firewall rules in the web console
# Go to: Networking > Firewalls
```

---

### **Step 4: Verify Domain DNS**

Check if DuckDNS domain points to your server IP:

```bash
# Get your server's public IP
curl -4 ifconfig.me

# Check DNS resolution
dig ltoblockchain.duckdns.org +short

# They should match!
```

**If DNS doesn't match**, update DuckDNS:

1. Go to https://www.duckdns.org
2. Sign in
3. Update IP for `ltoblockchain` subdomain
4. Wait 1-2 minutes for DNS propagation

Or use the auto-update script:

```bash
bash scripts/setup-duckdns-auto-update.sh
```

---

### **Step 5: Check Backend Application**

```bash
# Check if lto-app container is running
docker ps | grep lto-app

# Check application logs
docker logs lto-app --tail=100

# Test application health (from inside container)
docker exec lto-app curl -s http://localhost:3001/api/health

# Check if application is listening on port 3001
docker exec lto-app netstat -tuln | grep 3001
```

**If application is not running:**

```bash
# Restart the application
docker compose -f docker-compose.unified.yml restart lto-app

# Check logs for errors
docker logs lto-app --tail=200
```

---

### **Step 6: Test Direct IP Access**

Try accessing your server by IP instead of domain:

```bash
# Get your server IP
SERVER_IP=$(curl -4 ifconfig.me)
echo "Your server IP: $SERVER_IP"

# Test HTTP access
curl -I http://$SERVER_IP

# Test HTTPS access (if configured)
curl -I -k https://$SERVER_IP
```

**If IP access works but domain doesn't:**
- DNS issue - update DuckDNS IP

**If IP access doesn't work:**
- Server/firewall issue - check ports and firewall rules

---

## 🚀 **QUICK FIX COMMANDS**

Run these commands in order on your DigitalOcean server:

```bash
# 1. Navigate to project directory
cd ~/LTOBLOCKCHAIN

# 2. Check all services
docker compose -f docker-compose.unified.yml ps

# 3. If services are down, start them
docker compose -f docker-compose.unified.yml up -d

# 4. Wait 30 seconds for services to start
sleep 30

# 5. Check service status again
docker compose -f docker-compose.unified.yml ps

# 6. Check nginx logs
docker logs nginx --tail=50

# 7. Check application logs
docker logs lto-app --tail=50

# 8. Test application health
docker exec lto-app curl -s http://localhost:3001/api/health

# 9. Check ports
sudo netstat -tuln | grep -E ":80|:443"

# 10. Verify DNS
dig ltoblockchain.duckdns.org +short
curl -4 ifconfig.me
```

---

## 🔧 **COMMON FIXES**

### **Fix 1: Services Not Started**

```bash
docker compose -f docker-compose.unified.yml up -d
```

### **Fix 2: Nginx Not Running**

```bash
docker compose -f docker-compose.unified.yml restart nginx
docker logs nginx --tail=50
```

### **Fix 3: Application Crashed**

```bash
# Check logs for errors
docker logs lto-app --tail=200

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# If still failing, check database connection
docker exec postgres pg_isready -U lto_user -d lto_blockchain
```

### **Fix 4: Firewall Blocking Ports**

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Also check DigitalOcean firewall in web console
```

### **Fix 5: DNS Not Updated**

```bash
# Update DuckDNS IP
SERVER_IP=$(curl -4 ifconfig.me)
curl "https://www.duckdns.org/update?domains=ltoblockchain&token=YOUR_TOKEN&ip=$SERVER_IP"

# Or use the auto-update script
bash scripts/setup-duckdns-auto-update.sh
```

---

## ✅ **VERIFICATION**

After applying fixes, verify everything works:

```bash
# 1. All services running
docker compose -f docker-compose.unified.yml ps | grep -E "Up|healthy"

# 2. Nginx responding
curl -I http://localhost

# 3. Application responding
docker exec lto-app curl -s http://localhost:3001/api/health | grep -q ok && echo "✅ App OK" || echo "❌ App FAILED"

# 4. External access (from your local machine)
curl -I http://ltoblockchain.duckdns.org
curl -I https://ltoblockchain.duckdns.org
```

---

## 📋 **EXPECTED SERVICE STATUS**

All these services should be "Up":

```
NAME                    STATUS
lto-app                 Up X minutes
nginx                   Up X minutes
postgres                Up X minutes (healthy)
ipfs                    Up X minutes
orderer.lto.gov.ph      Up X minutes
peer0.lto.gov.ph        Up X minutes
couchdb                 Up X minutes
```

---

## 🆘 **STILL NOT WORKING?**

If none of the above fixes work:

1. **Check DigitalOcean Droplet Status**
   - Go to DigitalOcean web console
   - Verify droplet is running
   - Check resource usage (CPU/RAM)

2. **Check Nginx Configuration**
   ```bash
   docker exec nginx cat /etc/nginx/conf.d/default.conf
   ```

3. **Check Application Environment Variables**
   ```bash
   docker exec lto-app env | grep -E "FRONTEND_URL|APP_BASE_URL|PORT"
   ```

4. **Full Service Restart**
   ```bash
   docker compose -f docker-compose.unified.yml down
   docker compose -f docker-compose.unified.yml up -d
   ```

5. **Check System Resources**
   ```bash
   free -h
   df -h
   docker stats --no-stream
   ```

---

**Status:** 🔍 **DIAGNOSIS REQUIRED** - Run the diagnostic commands above to identify the issue.
