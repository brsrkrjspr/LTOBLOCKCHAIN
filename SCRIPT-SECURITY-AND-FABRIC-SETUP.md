# 🔒 Script Security & Fabric Network Setup

## Issue 1: Fabric Network Not Running

**Error:** `Failed to connect before the deadline on Endorser- name: peer0.lto.gov.ph`

**Solution:** Start the Fabric network first:

```bash
# On your server (Ubuntu)
cd ~/LTOBLOCKCHAIN

# Check if Fabric containers exist
docker ps -a | grep -E "peer0|orderer"

# Start Fabric network (using unified compose)
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph peer0.lto.gov.ph couchdb

# Or start all services
docker-compose -f docker-compose.unified.yml up -d

# Wait for containers to be ready (30-60 seconds)
sleep 30

# Verify they're running
docker-compose -f docker-compose.unified.yml ps
```

**Expected:** All containers should show "Up" status.

---

## Issue 2: Script Security Concern ✅ VALID QUESTION!

**Your Concern:** "If we can register vehicles using a script, doesn't this mean anyone can hack our system?"

**Answer:** This is a valid security concern. Let me explain the security layers:

### 🔒 Current Security Layers

1. **Server-Side Only:**
   - Script runs on the **server** (not exposed to users)
   - Requires **SSH access** to the server
   - Requires **file system access** to the project

2. **Database Access Required:**
   - Needs PostgreSQL credentials (in `.env` file)
   - Database user must have write permissions

3. **Fabric Network Access Required:**
   - Needs Fabric wallet with admin identity
   - Requires TLS certificates
   - Must be on same network as Fabric peers

4. **API Endpoints Are Protected:**
   - `/api/lto/inspect` → Requires `authenticateToken` + `authorizeRole(['admin'])`
   - `/api/transfer/requests/:id/approve` → Requires `authenticateToken` + `authorizeRole(['admin'])`
   - Users **cannot** call these without proper authentication

### ⚠️ Script Security Improvements Added

I've added security measures to the script:

1. **Admin Confirmation Required:**
   - Script prompts: "Are you an authorized administrator? Type 'YES' to continue"
   - Prevents accidental execution
   - Requires explicit confirmation

2. **Audit Logging:**
   - Logs who ran the script (username, hostname)
   - Logs when script started/completed
   - Stores metadata in `vehicle_history` table

3. **Server Access Required:**
   - Script is NOT exposed via API
   - Only accessible via SSH/server access
   - Requires file system permissions

---

## 🔒 Security Comparison

### Scripts (Server-Side Admin Tools)
| Security Layer | Status |
|----------------|--------|
| **SSH Access** | ✅ Required (server access) |
| **File Permissions** | ✅ Required (read script file) |
| **Database Credentials** | ✅ Required (`.env` file) |
| **Fabric Wallet** | ✅ Required (admin identity) |
| **Admin Confirmation** | ✅ **NOW ADDED** |
| **Audit Logging** | ✅ **NOW ADDED** |
| **API Exposure** | ✅ **NOT EXPOSED** (server-only) |

### API Endpoints (User-Facing)
| Security Layer | Status |
|----------------|--------|
| **JWT Authentication** | ✅ Required (`authenticateToken`) |
| **Role Authorization** | ✅ Required (`authorizeRole(['admin'])`) |
| **Rate Limiting** | ⚠️ Should be added |
| **Input Validation** | ✅ Required |
| **Audit Logging** | ✅ Required |

---

## 🎯 Key Differences

### Scripts vs API Endpoints

**Scripts (like `register-missing-vehicles-on-blockchain.js`):**
- ✅ Run on **server** (not exposed to internet)
- ✅ Require **SSH access** to server
- ✅ Require **file system access**
- ✅ Require **database credentials**
- ✅ Require **Fabric wallet** (admin identity)
- ✅ **NOW:** Require admin confirmation
- ✅ **NOW:** Log who ran them

**API Endpoints (like `/api/lto/inspect`):**
- ✅ Exposed to **internet** (via HTTP)
- ✅ Protected by **JWT authentication**
- ✅ Protected by **role authorization**
- ✅ Require **valid admin token**
- ✅ Logged in **activity logs**

---

## ✅ Why Scripts Are Safe

1. **Not Exposed:** Scripts are **NOT** HTTP endpoints - users cannot call them
2. **Server Access Required:** Need SSH/file access to run them
3. **Multiple Layers:** Database + Fabric + File system access all required
4. **Audit Trail:** Now logs who ran them and when

---

## 🚨 Additional Security Recommendations

### For Production:

1. **Restrict Script Access:**
   ```bash
   # Only allow specific users to run scripts
   chmod 750 backend/scripts/
   chown root:admin backend/scripts/
   ```

2. **Use Environment Variables for Confirmation:**
   ```bash
   # Require environment variable
   ADMIN_CONFIRMED=true node backend/scripts/register-missing-vehicles-on-blockchain.js
   ```

3. **Add Rate Limiting:**
   - Limit how often scripts can be run
   - Prevent abuse if server is compromised

4. **Monitor Script Execution:**
   - Send alerts when scripts run
   - Log to security monitoring system

---

## 📋 Summary

**Your concern is VALID and IMPORTANT!**

✅ **Scripts are now more secure:**
- Admin confirmation required
- Audit logging added
- Not exposed via API

✅ **API endpoints remain secure:**
- JWT authentication
- Role authorization
- Input validation

✅ **Multiple security layers:**
- Server access
- Database credentials
- Fabric wallet
- Admin confirmation

**The script cannot be "hacked" because:**
1. It's not exposed via HTTP/API
2. Requires server access (SSH)
3. Requires multiple credentials
4. Now requires admin confirmation

**However:** If someone gains **full server access**, they could run scripts. This is why:
- Server security is critical
- SSH keys should be protected
- File permissions should be restricted
- Database credentials should be secure
