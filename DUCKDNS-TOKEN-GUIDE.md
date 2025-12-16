# 🐤 DuckDNS Token Usage Guide

## Your Domain
**Domain:** `ltoblockchain.duckdns.org` ✅

---

## 🔑 Where You Need Your DuckDNS Token

### **Option 1: Automatic IP Updates (Recommended)**

Your DuckDNS token is used to **automatically update your IP address** if your droplet IP changes.

**When to use:**
- ✅ Set up automatic updates (optional but recommended)
- ✅ Your droplet IP might change
- ✅ You want "set it and forget it"

**How to set up:**

1. **Get your token:**
   - Go to https://www.duckdns.org
   - Sign in
   - Find your token (it's a long string like `abc123def456...`)

2. **Run the auto-update script:**
   ```bash
   cd ~/LTOBLOCKCHAIN
   chmod +x scripts/setup-duckdns-auto-update.sh
   bash scripts/setup-duckdns-auto-update.sh
   ```
   
   The script will:
   - Ask for your token
   - Test it
   - Set up automatic updates every 5 minutes
   - Create a cron job

**That's it!** Your IP will update automatically if it changes.

---

### **Option 2: Manual Updates (If IP Changes)**

If you don't set up auto-update, you can manually update:

1. Go to https://www.duckdns.org
2. Sign in
3. Enter your IP: `139.59.117.203`
4. Click "Update IP"

**You only need to do this if your droplet IP changes.**

---

## 🔒 Let's Encrypt - Fully Automatic!

**Good news:** You don't need to do anything special for Let's Encrypt! ✅

The `setup-https-free.sh` script handles everything automatically:

1. ✅ **Obtains certificate** from Let's Encrypt
2. ✅ **Installs certificate** in Nginx
3. ✅ **Configures SSL** automatically
4. ✅ **Sets up auto-renewal** (certificates renew every 90 days)

**What Let's Encrypt does:**
- Provides **free SSL certificate** (trusted by all browsers)
- **No browser warnings** ✅
- **Auto-renews** every 90 days
- **Zero cost** ✅

**You just need to:**
1. Run the setup script (it handles Let's Encrypt automatically)
2. That's it!

---

## 📋 Quick Setup Summary

### Step 1: Run HTTPS Setup (Handles Let's Encrypt)
```bash
cd ~/LTOBLOCKCHAIN
bash scripts/setup-https-free.sh
```

**What it does:**
- Uses your domain: `ltoblockchain.duckdns.org`
- Gets Let's Encrypt certificate automatically
- Configures Nginx with SSL
- **No token needed here!**

### Step 2: Set Up Auto-Update (Optional - Uses Token)
```bash
bash scripts/setup-duckdns-auto-update.sh
```

**What it does:**
- Asks for your DuckDNS token
- Sets up automatic IP updates
- Creates cron job (runs every 5 minutes)

---

## ❓ FAQ

### Q: Do I need the token for HTTPS setup?
**A:** No! The HTTPS setup script doesn't need your token. It only needs your domain name (which you already have: `ltoblockchain.duckdns.org`).

### Q: When do I need the token?
**A:** Only if you want automatic IP updates. If your droplet IP never changes, you don't need it.

### Q: What if I lose my token?
**A:** Go to https://www.duckdns.org, sign in, and you'll see your token.

### Q: Does Let's Encrypt cost money?
**A:** No! It's completely free. ✅

### Q: Do I need to renew the certificate manually?
**A:** No! The setup script configures auto-renewal. Certificates renew automatically every 90 days.

---

## 🎯 What You Need to Do Right Now

1. **Run HTTPS setup** (no token needed):
   ```bash
   cd ~/LTOBLOCKCHAIN
   bash scripts/setup-https-free.sh
   ```
   
   When prompted:
   - Domain: Already set to `ltoblockchain.duckdns.org` ✅
   - Email: Enter your email (for Let's Encrypt notifications)

2. **Optional: Set up auto-update** (uses token):
   ```bash
   bash scripts/setup-duckdns-auto-update.sh
   ```
   
   When prompted:
   - Token: Enter your DuckDNS token

---

## ✅ Summary

| Item | Needed For | When |
|------|------------|------|
| **Domain** | HTTPS setup | ✅ Already have: `ltoblockchain.duckdns.org` |
| **Token** | Auto-update only | Optional - only if you want automatic IP updates |
| **Let's Encrypt** | SSL certificate | ✅ Automatic - handled by setup script |

**Bottom line:** Run the HTTPS setup script, and you're done! The token is only for optional auto-updates.

