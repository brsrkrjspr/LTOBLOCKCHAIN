# 🔒 Free HTTPS Setup Guide - DuckDNS + Let's Encrypt

## Overview
This guide sets up **free HTTPS** for your TrustChain LTO deployment using:
- **DuckDNS** - Free subdomain (e.g., `yourname.duckdns.org`)
- **Let's Encrypt** - Free trusted SSL certificate
- **Nginx** - Reverse proxy with security features

**Total Cost: $0** ✅

---

## ✅ What's Already Done

1. ✅ **docker-compose.unified.yml** updated:
   - Added Nginx service
   - Removed direct port exposure from `lto-app`
   - Added `nginx-logs` volume

2. ✅ **nginx/nginx-ssl.conf** created:
   - HTTP → HTTPS redirect
   - SSL configuration
   - Security headers
   - Rate limiting (DDoS protection)
   - Connection limiting

3. ✅ **scripts/setup-https-free.sh** created:
   - Automated setup script
   - Certificate generation
   - Configuration updates

---

## 📋 Step-by-Step Setup

### Step 1: Get DuckDNS Subdomain (5 minutes)

1. Go to **https://www.duckdns.org**
2. Sign in with **GitHub** or **Google**
3. Create a subdomain:
   - Enter your desired name (e.g., `mylto`)
   - Click **Add Domain**
   - Your domain will be: `mylto.duckdns.org`
4. Point to your droplet IP:
   - Enter: `139.59.117.203`
   - Click **Update IP**
5. **Save your token** (you'll need it for auto-updates)

**Note:** DuckDNS subdomains are free and don't expire as long as you update them periodically.

---

### Step 2: Configure Firewall

On your SSH connection, ensure ports 80 and 443 are open:

```bash
# Check firewall status
ufw status

# Allow HTTP (for Let's Encrypt verification)
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow SSH (if not already allowed)
ufw allow 22/tcp

# Enable firewall (if not already enabled)
ufw enable
```

---

### Step 3: Run Setup Script

On your SSH connection:

```bash
cd ~/LTOBLOCKCHAIN

# Make script executable (if needed)
chmod +x scripts/setup-https-free.sh

# Run setup script
bash scripts/setup-https-free.sh
```

The script will:
1. Ask for your DuckDNS subdomain name
2. Ask for your email (for Let's Encrypt)
3. Create necessary directories
4. Update Nginx configuration
5. Start Nginx
6. Obtain SSL certificate from Let's Encrypt
7. Restart Nginx with SSL

**Expected time:** 2-5 minutes

---

### Step 4: Verify HTTPS

After setup completes:

1. **Test HTTPS:**
   ```bash
   curl -I https://yourname.duckdns.org/health
   ```

2. **Access in browser:**
   - Go to: `https://yourname.duckdns.org`
   - You should see **no security warnings** ✅
   - Green padlock in browser ✅

3. **Check Nginx logs:**
   ```bash
   docker compose -f docker-compose.unified.yml logs nginx
   ```

---

## 🔒 Security Features Enabled

### 1. HTTPS Encryption
- TLS 1.2 and TLS 1.3
- Modern cipher suites
- Perfect Forward Secrecy

### 2. HSTS (HTTP Strict Transport Security)
- Forces HTTPS for 2 years
- Prevents downgrade attacks
- Includes subdomains

### 3. Rate Limiting (DDoS Protection)
- **General:** 30 requests/second
- **API:** 10 requests/second
- **Login:** 5 requests/minute
- **Connections:** Max 20 per IP

### 4. Security Headers
- **X-Frame-Options:** Prevents clickjacking
- **X-Content-Type-Options:** Prevents MIME sniffing
- **X-XSS-Protection:** XSS protection
- **Referrer-Policy:** Controls referrer information
- **Content-Security-Policy:** XSS and injection protection

### 5. Connection Limiting
- Maximum 20 concurrent connections per IP
- Prevents connection exhaustion attacks

---

## 🔄 Certificate Auto-Renewal

Let's Encrypt certificates expire every **90 days**. Set up auto-renewal:

### Option 1: Manual Renewal (Test First)

```bash
# Test renewal (dry run)
docker run -it --rm \
  -v "$(pwd)/nginx/letsencrypt:/etc/letsencrypt" \
  certbot/certbot renew --dry-run

# Actual renewal
docker run -it --rm \
  -v "$(pwd)/nginx/letsencrypt:/etc/letsencrypt" \
  certbot/certbot renew

# Restart Nginx after renewal
docker compose -f docker-compose.unified.yml restart nginx
```

### Option 2: Automatic Renewal (Recommended)

Create a cron job:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /root/LTOBLOCKCHAIN && docker run --rm -v "$(pwd)/nginx/letsencrypt:/etc/letsencrypt" certbot/certbot renew --quiet && docker compose -f docker-compose.unified.yml restart nginx
```

---

## 🐤 DuckDNS Auto-Update

If your droplet IP changes, update DuckDNS automatically:

### Option 1: Manual Update
Go to https://www.duckdns.org and update your IP

### Option 2: Automatic Update (Recommended)

Create a cron job:

```bash
# Edit crontab
crontab -e

# Add this line (runs every 5 minutes)
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=yourname&token=YOUR_TOKEN&ip=" > /dev/null
```

Replace:
- `yourname` with your DuckDNS subdomain name
- `YOUR_TOKEN` with your DuckDNS token

---

## 🐛 Troubleshooting

### Issue: Certificate Generation Fails

**Symptoms:**
- Error: "Failed to obtain certificate"
- Error: "Connection refused"

**Solutions:**
1. **Check DNS:**
   ```bash
   dig yourname.duckdns.org
   # Should return: 139.59.117.203
   ```

2. **Check Port 80:**
   ```bash
   # From outside your server
   curl -I http://yourname.duckdns.org
   ```

3. **Check Firewall:**
   ```bash
   ufw status
   # Should show: 80/tcp ALLOW
   ```

4. **Check Nginx:**
   ```bash
   docker compose -f docker-compose.unified.yml logs nginx
   ```

### Issue: HTTPS Not Working After Setup

**Solutions:**
1. **Check certificate path:**
   ```bash
   ls -la nginx/letsencrypt/live/yourname.duckdns.org/
   ```

2. **Verify Nginx config:**
   ```bash
   docker exec nginx nginx -t
   ```

3. **Check Nginx logs:**
   ```bash
   docker compose -f docker-compose.unified.yml logs nginx
   ```

### Issue: CSS/Static Files Not Loading

**Solutions:**
1. **Check static file proxy:**
   - Verify `nginx/nginx-ssl.conf` has static file location blocks
   - Check Nginx logs for 404 errors

2. **Clear browser cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

---

## 📊 Architecture

```
Internet
   ↓
[Port 80/443]
   ↓
[Nginx Container]
   ├─ SSL Termination
   ├─ Rate Limiting
   ├─ Security Headers
   └─ DDoS Protection
   ↓
[Docker Network: trustchain]
   ↓
[lto-app Container :3001]
   ├─ Express.js Application
   ├─ Hyperledger Fabric
   ├─ IPFS
   └─ PostgreSQL
```

---

## 📝 Files Modified/Created

1. **docker-compose.unified.yml**
   - Added `nginx` service
   - Removed `lto-app` port exposure
   - Added `nginx-logs` volume

2. **nginx/nginx-ssl.conf** (NEW)
   - SSL configuration
   - Security headers
   - Rate limiting
   - Reverse proxy settings

3. **scripts/setup-https-free.sh** (NEW)
   - Automated setup script
   - Certificate generation
   - Configuration updates

---

## ✅ Verification Checklist

After setup, verify:

- [ ] HTTPS works: `https://yourname.duckdns.org`
- [ ] No browser security warnings
- [ ] HTTP redirects to HTTPS
- [ ] CSS/static files load correctly
- [ ] API endpoints work: `https://yourname.duckdns.org/api/health`
- [ ] Rate limiting works (try rapid requests)
- [ ] Certificate valid for 90 days
- [ ] Nginx logs show no errors

---

## 🎯 Summary

You now have:
- ✅ **Free HTTPS** (no browser warnings)
- ✅ **DDoS protection** (rate limiting)
- ✅ **Security headers** (XSS, clickjacking protection)
- ✅ **Auto-renewal** (certificates)
- ✅ **Production-ready** security

**Total Cost: $0** 🎉

---

## 📚 Additional Resources

- **DuckDNS:** https://www.duckdns.org
- **Let's Encrypt:** https://letsencrypt.org
- **Nginx Docs:** https://nginx.org/en/docs/
- **Certbot Docs:** https://certbot.eff.org/docs/

---

## 🆘 Support

If you encounter issues:

1. Check Nginx logs: `docker compose -f docker-compose.unified.yml logs nginx`
2. Check application logs: `docker compose -f docker-compose.unified.yml logs lto-app`
3. Verify DNS: `dig yourname.duckdns.org`
4. Test connectivity: `curl -I https://yourname.duckdns.org`

---

**Last Updated:** 2024
**Status:** ✅ Ready for Production

