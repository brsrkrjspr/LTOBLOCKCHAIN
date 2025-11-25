# 🌐 IPFS Integration Guide

## ✅ **What's Been Implemented**

### **1. IPFS Service (`backend/services/ipfsService.js`)**
- Real IPFS client using `ipfs-http-client`
- Automatic connection to IPFS node
- Document storage and retrieval
- Document pinning/unpinning
- Document verification
- Node information retrieval

### **2. Unified Storage Service (`backend/services/storageService.js`)**
- Automatically uses IPFS when available
- Falls back to local storage if IPFS unavailable
- Consistent interface for all storage operations
- Supports three modes:
  - `auto`: Try IPFS first, fallback to local
  - `ipfs`: Use IPFS only (fails if unavailable)
  - `local`: Use local storage only

### **3. Docker Configuration**
- IPFS node added to `docker-compose.laptop.yml`
- Single IPFS node for laptop deployment
- Resource limits configured (512MB memory)

### **4. Database Support**
- Migration script: `database/add-ipfs-cid.sql`
- `ipfs_cid` column added to `documents` table
- Database services updated to store CID

### **5. Document Routes Updated**
- Upload endpoints use unified storage service
- Download endpoints retrieve from IPFS or local
- Verification endpoints check IPFS integrity
- All endpoints return CID and storage mode

---

## 🚀 **Setup Instructions**

### **Step 1: Start IPFS Node**

```powershell
.\scripts\setup-ipfs.ps1
```

Or manually:
```powershell
docker-compose -f docker-compose.laptop.yml up -d ipfs
```

### **Step 2: Run Database Migration**

Add IPFS CID column to documents table:

```powershell
Get-Content database\add-ipfs-cid.sql | docker exec -i postgres psql -U lto_user -d lto_blockchain
```

### **Step 3: Update .env File**

Add these settings to your `.env` file:

```env
# Storage Configuration
STORAGE_MODE=auto          # Options: auto, ipfs, local
IPFS_HOST=localhost        # IPFS node host
IPFS_PORT=5001             # IPFS API port
IPFS_PROTOCOL=http         # IPFS protocol (http/https)
```

**Storage Mode Options:**
- `auto`: Try IPFS first, automatically fallback to local if unavailable (recommended)
- `ipfs`: Use IPFS only, will fail if IPFS is not available
- `local`: Use local storage only, ignore IPFS

### **Step 4: Restart Application**

```powershell
npm start
```

---

## 📊 **How It Works**

### **Document Upload Flow:**

1. **File Upload** → Received via multer
2. **Storage Service** → Checks `STORAGE_MODE`
3. **If `auto` or `ipfs`:**
   - Try to connect to IPFS
   - If connected: Store on IPFS, get CID
   - If failed: Fallback to local storage (if `auto`)
4. **Database** → Save document record with CID (if available)
5. **Response** → Return CID, gateway URL, and storage mode

### **Document Retrieval Flow:**

1. **Request** → Get document by ID
2. **Database** → Fetch document record
3. **If CID exists:**
   - Try to retrieve from IPFS
   - If successful: Return IPFS file
   - If failed: Fallback to local file
4. **If no CID:**
   - Retrieve from local storage

### **Document Verification Flow:**

1. **Request** → Verify document integrity
2. **If stored on IPFS:**
   - Check if CID exists on IPFS
   - Check if CID is pinned
   - Verify local hash (if file exists)
3. **If stored locally:**
   - Calculate current hash
   - Compare with stored hash

---

## 🔍 **Verification**

### **Check IPFS Status:**

```powershell
# Check if IPFS container is running
docker ps | Select-String "ipfs"

# Check IPFS version
docker exec ipfs ipfs version

# Check IPFS node info
docker exec ipfs ipfs id

# Check IPFS repo stats
docker exec ipfs ipfs stats repo
```

### **Test IPFS Connection from Application:**

The application will automatically log IPFS connection status on startup:
- `✅ Connected to IPFS version X.X.X` - IPFS is working
- `❌ Failed to connect to IPFS` - IPFS unavailable, using fallback

### **Check Storage Mode:**

The application logs the storage mode on startup:
- `🌐 Using IPFS storage (auto mode)` - IPFS active
- `📁 Using local storage (IPFS unavailable, auto fallback)` - Using fallback
- `📁 Using local storage mode` - Local only

---

## 📝 **API Response Examples**

### **Upload Response (IPFS):**

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "id": "doc-123",
    "cid": "QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "filename": "document-123.pdf",
    "fileSize": 102400,
    "url": "http://localhost:8080/ipfs/QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "storageMode": "ipfs"
  }
}
```

### **Upload Response (Local Fallback):**

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "id": "doc-123",
    "cid": null,
    "filename": "document-123.pdf",
    "fileSize": 102400,
    "url": "/uploads/document-123.pdf",
    "storageMode": "local"
  }
}
```

---

## 🛠️ **Troubleshooting**

### **IPFS Not Connecting:**

1. **Check if container is running:**
   ```powershell
   docker ps | Select-String "ipfs"
   ```

2. **Check IPFS logs:**
   ```powershell
   docker-compose -f docker-compose.laptop.yml logs ipfs
   ```

3. **Check IPFS API:**
   ```powershell
   curl http://localhost:5001/api/v0/version
   ```

4. **Restart IPFS:**
   ```powershell
   docker-compose -f docker-compose.laptop.yml restart ipfs
   ```

### **Documents Not Storing on IPFS:**

1. **Check storage mode in .env:**
   - Should be `auto` or `ipfs`
   - Not `local`

2. **Check application logs:**
   - Look for IPFS connection messages
   - Check for error messages

3. **Verify IPFS is accessible:**
   ```powershell
   docker exec ipfs ipfs version
   ```

### **CID Not Stored in Database:**

1. **Run migration:**
   ```powershell
   Get-Content database\add-ipfs-cid.sql | docker exec -i postgres psql -U lto_user -d lto_blockchain
   ```

2. **Check database column:**
   ```sql
   SELECT ipfs_cid FROM documents LIMIT 1;
   ```

---

## 💡 **Best Practices**

1. **Use `auto` mode** for production - provides automatic fallback
2. **Monitor IPFS storage** - Check repo size regularly
3. **Pin important documents** - Prevents garbage collection
4. **Backup IPFS data** - IPFS volume is in Docker volume `ipfs-data`
5. **Monitor IPFS node** - Check logs and stats regularly

---

## 📚 **Additional Resources**

- **IPFS Documentation:** https://docs.ipfs.io/
- **IPFS HTTP Client:** https://github.com/ipfs/js-ipfs/tree/master/packages/ipfs-http-client
- **IPFS Gateway:** Access files at `http://localhost:8080/ipfs/{CID}`

---

**Last Updated:** 2025-11-13

