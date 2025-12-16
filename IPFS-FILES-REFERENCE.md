# 📁 IPFS-Related Files Reference

This document lists all files related to IPFS functionality in the TrustChain LTO system. Use this as a reference when troubleshooting IPFS document upload issues.

---

## 🔴 **Core IPFS Implementation Files** (Most Important)

### 1. **`backend/services/ipfsService.js`**
- **Purpose:** Core IPFS service implementation
- **Key Functions:**
  - `initialize()` - Connects to IPFS node
  - `storeDocument()` - Uploads files to IPFS
  - `getDocument()` - Retrieves files from IPFS
  - `pinDocument()` - Pins documents on IPFS
  - `isAvailable()` - Checks if IPFS is accessible
- **Dependencies:** `ipfs-http-client` package
- **Configuration:** Uses environment variables (IPFS_HOST, IPFS_PORT, IPFS_PROTOCOL)

### 2. **`backend/services/storageService.js`**
- **Purpose:** Unified storage service that routes to IPFS or local storage
- **Key Functions:**
  - `initialize()` - Initializes storage mode (ipfs/local/auto)
  - `storeDocument()` - Stores documents via IPFS or local
  - `getDocument()` - Retrieves documents from IPFS or local
- **Configuration:** `STORAGE_MODE` environment variable
- **Behavior:** When `STORAGE_MODE=ipfs`, requires IPFS (no fallback)

### 3. **`backend/routes/documents.js`**
- **Purpose:** Document upload/download API endpoints
- **Key Endpoints:**
  - `POST /api/documents/upload` - Upload document to IPFS
  - `GET /api/documents/:documentId` - Retrieve document from IPFS
- **Uses:** `storageService.js` for actual storage operations

---

## 🐳 **Docker Configuration Files**

### 4. **`docker-compose.unified.yml`** (Lines 230-276)
- **Purpose:** IPFS container configuration
- **Key Settings:**
  - Image: `ipfs/kubo:latest`
  - Ports: 4001 (swarm), 5001 (API), 8080 (gateway)
  - Volume: `ipfs-data:/data/ipfs`
  - Healthcheck: `ipfs id || exit 1`
  - Entrypoint: Initializes IPFS with server profile and CORS settings

### 5. **`docker-compose.services.yml`** (Lines 62-98)
- **Purpose:** Alternative IPFS configuration
- **Note:** May have different settings than unified version

---

## ⚙️ **Configuration Files**

### 6. **`ENV.example`**
- **Purpose:** Environment variable template
- **IPFS Variables:**
  ```env
  STORAGE_MODE=ipfs
  IPFS_HOST=ipfs
  IPFS_PORT=5001
  IPFS_PROTOCOL=http
  ```

### 7. **`.env`** (on server)
- **Purpose:** Actual environment variables
- **Check:** Ensure IPFS variables match ENV.example

---

## 📊 **Database Files**

### 8. **`database/add-ipfs-cid.sql`**
- **Purpose:** Database migration to add `ipfs_cid` column
- **Table:** `documents`
- **Column:** `ipfs_cid VARCHAR(255) UNIQUE`

### 9. **`backend/database/services.js`**
- **Purpose:** Database operations for documents
- **Key Functions:**
  - `createDocument()` - Stores document with `ipfsCid`
  - `getDocumentById()` - Retrieves document with CID
  - `getDocumentByCid()` - Finds document by IPFS CID

---

## 🔧 **Scripts**

### 10. **`scripts/check-ipfs-status.sh`**
- **Purpose:** Check IPFS service status
- **Checks:**
  - Container status
  - API accessibility
  - Gateway accessibility
  - Connection from application

### 11. **`scripts/fix-ipfs-volume.sh`**
- **Purpose:** Fix IPFS volume version mismatches
- **Action:** Removes IPFS data volume and restarts

### 12. **`scripts/verify-ipfs-connection.sh`**
- **Purpose:** Verify IPFS connection from application

### 13. **`scripts/configure-ipfs-real.sh`**
- **Purpose:** Configure IPFS with real settings

---

## 📚 **Documentation Files**

### 14. **`IPFS-INTEGRATION-GUIDE.md`**
- **Purpose:** IPFS integration documentation
- **Content:** Setup instructions, configuration, usage

### 15. **`REAL-SERVICES-ONLY.md`**
- **Purpose:** Confirms IPFS is required (no fallbacks)
- **Content:** Service configuration verification

### 16. **`SYSTEM-FUNCTIONALITY-DOCUMENTATION.md`**
- **Purpose:** Comprehensive system documentation
- **Section:** Document Management (IPFS storage)

### 17. **`REGISTRATION-ISSUES-FIX.md`**
- **Purpose:** Documents IPFS-related fixes
- **Content:** 503 errors, STORAGE_MODE changes

---

## 🔍 **Other Related Files**

### 18. **`backend/routes/vehicles.js`**
- **Purpose:** Vehicle registration
- **IPFS Usage:** Links documents by CID during registration
- **Key Section:** Lines 486-568 (document linking)

### 19. **`package.json`**
- **Purpose:** Node.js dependencies
- **IPFS Package:** `ipfs-http-client` (check version)

### 20. **`server.js`**
- **Purpose:** Main Express server
- **IPFS Usage:** Initializes storage service on startup

---

## 📋 **File List for Claude**

When asking Claude for help with IPFS document upload issues, provide these files:

### **Essential Files (Must Include):**
1. `backend/services/ipfsService.js` - Core IPFS implementation
2. `backend/services/storageService.js` - Storage routing logic
3. `backend/routes/documents.js` - Upload endpoint
4. `docker-compose.unified.yml` (IPFS section, lines 230-276) - Container config
5. `.env` (IPFS variables) - Environment configuration

### **Supporting Files (Include if needed):**
6. `backend/database/services.js` - Document database operations
7. `backend/routes/vehicles.js` (document linking section) - Registration flow
8. `scripts/check-ipfs-status.sh` - Status check script
9. `ENV.example` - Configuration template

### **Error Logs (Include):**
10. Application logs: `docker compose logs lto-app`
11. IPFS logs: `docker compose logs ipfs`
12. Browser console errors (if available)
13. Network request details (if available)

---

## 🔍 **Key Configuration Points**

### **Environment Variables:**
```env
STORAGE_MODE=ipfs          # Required: 'ipfs' (no fallbacks)
IPFS_HOST=ipfs             # Docker service name
IPFS_PORT=5001             # IPFS API port
IPFS_PROTOCOL=http         # Protocol (http/https)
```

### **Docker Service:**
- **Service Name:** `ipfs`
- **Network:** `trustchain`
- **API Port:** `5001` (internal)
- **Gateway Port:** `8080` (internal)

### **Application Connection:**
- **URL:** `http://ipfs:5001/api/v0`
- **Test:** `POST http://ipfs:5001/api/v0/version`

---

## 🐛 **Common Issues to Check**

1. **IPFS Container Status:**
   ```bash
   docker compose ps ipfs
   ```

2. **IPFS API Accessibility:**
   ```bash
   docker exec ipfs curl -X POST http://localhost:5001/api/v0/version
   ```

3. **Application Connection:**
   ```bash
   docker exec lto-app node -e "const http = require('http'); const req = http.request({hostname: 'ipfs', port: 5001, path: '/api/v0/version', method: 'POST'}, (res) => {console.log('Status:', res.statusCode); process.exit(res.statusCode === 200 ? 0 : 1);}); req.on('error', () => {console.log('Error'); process.exit(1);}); req.end();"
   ```

4. **Environment Variables:**
   ```bash
   docker exec lto-app printenv | grep IPFS
   docker exec lto-app printenv | grep STORAGE_MODE
   ```

5. **IPFS Logs:**
   ```bash
   docker compose logs ipfs --tail=100
   ```

---

## 📝 **Quick Reference**

**Upload Flow:**
1. User uploads file → `POST /api/documents/upload`
2. `documents.js` → calls `storageService.storeDocument()`
3. `storageService.js` → checks `STORAGE_MODE=ipfs`
4. `storageService.js` → calls `ipfsService.storeDocument()`
5. `ipfsService.js` → uploads to IPFS via HTTP API
6. IPFS returns CID → stored in database
7. Response includes CID and document ID

**Error Points:**
- IPFS container not running
- IPFS API not accessible
- Network connectivity issues
- Environment variables incorrect
- IPFS client initialization failure

---

**Last Updated:** 2025-01-XX

