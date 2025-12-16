# ✅ Real Services Only - No Mocks Configuration

This document confirms that the system is configured to use **ONLY real services** with **NO mocks or fallbacks**.

---

## 🔧 Configuration

### 1. **Blockchain Service**
- **Mode:** `BLOCKCHAIN_MODE=fabric` (in `docker-compose.unified.yml`)
- **Service:** `optimizedFabricService.js` (Real Hyperledger Fabric)
- **No Mocks:** `mockBlockchainService.js` exists but is **NOT imported or used** anywhere
- **Status:** ✅ Real Fabric network required

### 2. **Storage Service**
- **Mode:** `STORAGE_MODE=ipfs` (in `docker-compose.unified.yml`)
- **Service:** `storageService.js` with `ipfsService.js` (Real IPFS)
- **No Fallbacks:** When `STORAGE_MODE=ipfs`, the system will:
  - ✅ **FAIL** if IPFS is unavailable (no local storage fallback)
  - ✅ **THROW ERRORS** instead of silently falling back
  - ✅ **REQUIRE** IPFS to be running and accessible
- **Status:** ✅ Real IPFS required, no fallbacks

### 3. **Database Service**
- **Service:** PostgreSQL (Real database)
- **No Mocks:** All database operations use real PostgreSQL
- **Status:** ✅ Real PostgreSQL required

---

## 🚫 Fallback Behavior (Disabled)

### Storage Service Fallbacks
When `STORAGE_MODE=ipfs`:
- ❌ **NO** fallback to local storage if IPFS fails
- ❌ **NO** silent degradation
- ✅ **FAILS FAST** with clear error messages
- ✅ **REQUIRES** IPFS to be operational

### Error Handling
If IPFS is unavailable:
- Document uploads will return `503 Service Unavailable`
- Error message: `"IPFS storage is required (STORAGE_MODE=ipfs) but IPFS service is unavailable"`
- System will **NOT** proceed with local storage

---

## ✅ Verification

### Check Blockchain Mode
```bash
# In docker-compose.unified.yml
grep BLOCKCHAIN_MODE docker-compose.unified.yml
# Should show: BLOCKCHAIN_MODE=fabric
```

### Check Storage Mode
```bash
# In docker-compose.unified.yml
grep STORAGE_MODE docker-compose.unified.yml
# Should show: STORAGE_MODE=ipfs
```

### Verify No Mock Usage
```bash
# Check if mockBlockchainService is imported anywhere
grep -r "mockBlockchainService\|MockBlockchainService" backend/routes/
# Should return: No matches (mocks not used)
```

### Verify IPFS is Required
```bash
# Check storageService error handling
grep -A 5 "STORAGE_MODE=ipfs" backend/services/storageService.js
# Should show: throw Error (no fallback)
```

---

## 🔍 Code Locations

### Real Services
- **Blockchain:** `backend/services/optimizedFabricService.js`
- **Storage:** `backend/services/storageService.js` + `backend/services/ipfsService.js`
- **Database:** `backend/database/db.js` + `backend/database/services.js`

### Mock Services (NOT USED)
- **Blockchain Mock:** `backend/services/mockBlockchainService.js` (exists but not imported)

---

## 📋 Service Dependencies

### Required Services (Must Be Running)
1. ✅ **Hyperledger Fabric Network**
   - Orderer: `orderer.lto.gov.ph`
   - Peer: `peer0.lto.gov.ph`
   - CouchDB: `couchdb`
   - Chaincode: `vehicle-registration` (installed and instantiated)

2. ✅ **IPFS Service**
   - Container: `ipfs`
   - API: `http://ipfs:5001`
   - Gateway: `http://ipfs:8080` (optional)

3. ✅ **PostgreSQL Database**
   - Container: `postgres`
   - Database: `lto_blockchain`
   - User: `lto_user`

---

## 🚨 Error Messages

### IPFS Unavailable
```
Error: IPFS storage is required (STORAGE_MODE=ipfs) but IPFS service is unavailable.
Please ensure IPFS is running and accessible.
```

### Fabric Unavailable
```
Error: Not connected to Fabric network. Cannot register vehicle.
```

---

## ✅ Summary

- ✅ **Blockchain:** Real Hyperledger Fabric (no mocks)
- ✅ **Storage:** Real IPFS (no local fallback when STORAGE_MODE=ipfs)
- ✅ **Database:** Real PostgreSQL (no mocks)
- ✅ **All Services:** Production-ready, real implementations only

**Status:** System is configured for **REAL SERVICES ONLY** with **NO MOCKS OR FALLBACKS**.

