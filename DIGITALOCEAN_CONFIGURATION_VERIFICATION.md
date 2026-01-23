# DigitalOcean Droplet Configuration Verification

## Your Droplet Specs
- **Memory:** 8 GiB
- **vCPUs:** 4 (shared)
- **SSD Disk:** 160 GiB
- **Bandwidth:** 5 TB

---

## Current Resource Allocation Analysis

### Resource Limits Summary

| Service | Memory Limit | CPU Limit | Status |
|---------|--------------|-----------|--------|
| Orderer | 512MB | 0.5 | ✅ Running |
| CouchDB | 512MB | 0.5 | ✅ Healthy |
| Peer | 1.5GB | 1.5 | ✅ Running |
| CLI | 512MB | 0.5 | ✅ Running |
| PostgreSQL | 1.5GB | 1.0 | ✅ Healthy |
| IPFS | 768MB | 0.5 | ⚠️ Unhealthy |
| Application | 768MB | 1.0 | ❌ **Restarting** |
| Nginx | 128MB | 0.25 | ✅ Running |
| **Chaincode** | Dynamic | Dynamic | ✅ Running |
| **Total Limits** | **~5.5GB** | **~5.25 cores** | |

### Available Headroom
- **RAM:** ~2.5GB available (for system, Docker overhead, spikes)
- **CPU:** ~1 core available (for system processes)
- **Status:** ✅ **Configuration fits within 8GB RAM**

---

## ⚠️ Critical Issue: Application Container Restarting

**From your `docker ps` output:**
```
45baa5311e6b   ltoblockchain-lto-app   "dumb-init -- node s…"   57 minutes ago   Restarting (1) 6 seconds ago   lto-app
```

**Problem:** Application container is in restart loop

**Possible Causes:**
1. **Memory limit too low** (768MB may be insufficient)
2. **Application crash** (check logs)
3. **Fabric connection failure** (chaincode not deployed?)
4. **Database connection issue**
5. **Missing environment variables**

---

## Verification Steps

### 1. Check Application Logs

```bash
# Check recent logs
docker logs lto-app --tail 100

# Check for errors
docker logs lto-app 2>&1 | grep -i error

# Check for Fabric connection issues
docker logs lto-app 2>&1 | grep -i fabric
```

### 2. Check Resource Usage

```bash
# Check current resource usage
docker stats --no-stream

# Check if memory limit is being hit
docker stats lto-app --no-stream
```

### 3. Verify Fabric Connection

```bash
# Check if chaincode is deployed
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel

# Check if wallet exists
docker exec lto-app ls -la /app/wallet

# Check network config
docker exec lto-app cat /app/network-config.json | head -20
```

---

## Configuration Assessment

### ✅ What's Correctly Configured

1. **Resource Limits:** All services have appropriate limits
2. **Total Memory:** ~5.5GB limits fit within 8GB
3. **PostgreSQL:** Optimized for 1.5GB allocation
4. **Health Checks:** Configured for critical services
5. **Dependencies:** Proper startup ordering

### ⚠️ Potential Issues

1. **Application Memory:** 768MB may be tight for Node.js + Fabric SDK
2. **IPFS Unhealthy:** May indicate resource pressure
3. **Chaincode Version:** Shows `1.0.2` but reset script deploys `1.0`

---

## Recommended Fixes

### Fix 1: Increase Application Memory Limit

**Current:** 768MB  
**Recommended:** 1GB (for production workloads)

```yaml
lto-app:
  deploy:
    resources:
      limits:
        memory: 1G  # Increase from 768M
        cpus: '1.0'
      reservations:
        memory: 768M  # Increase from 512M
        cpus: '0.5'
```

**Impact:** Uses ~250MB more RAM, but provides stability

### Fix 2: Check Chaincode Version Mismatch

**Issue:** Chaincode container shows version `1.0.2` but reset script deploys `1.0`

**Check:**
```bash
# See what's actually committed
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

**If mismatch:** Redeploy chaincode using reset script or manual deployment

### Fix 3: Verify Environment Variables

**Critical variables that must be set:**
- `BLOCKCHAIN_MODE=fabric`
- `FABRIC_CHANNEL=ltochannel`
- `FABRIC_CHAINCODE=vehicle-registration`
- Database credentials
- JWT_SECRET (production)

**Check:**
```bash
docker exec lto-app env | grep -E "BLOCKCHAIN|FABRIC|DB_|JWT"
```

---

## Resource Optimization for 8GB Droplet

### Current Allocation (Optimized)

| Service | Memory | CPU | Notes |
|---------|--------|-----|-------|
| Orderer | 512MB | 0.5 | Minimal for single orderer |
| CouchDB | 512MB | 0.5 | Optimized for state DB |
| Peer | 1.5GB | 1.5 | Critical - handles chaincode |
| PostgreSQL | 1.5GB | 1.0 | Optimized settings applied |
| IPFS | 768MB | 0.5 | Storage limit: 10GB |
| Application | 768MB | 1.0 | **Consider increasing to 1GB** |
| Nginx | 128MB | 0.25 | Minimal reverse proxy |
| **Total** | **~5.5GB** | **~5.25** | **~2.5GB headroom** |

### Recommended Adjustments

**Option 1: Increase Application Memory (Recommended)**
- Application: 768MB → **1GB**
- Total: ~5.75GB (still fits in 8GB)
- **Benefit:** More stable application, handles Fabric SDK better

**Option 2: Reduce Other Services (If needed)**
- IPFS: 768MB → **512MB** (if storage not critical)
- CLI: 512MB → **256MB** (only used for setup)
- **Benefit:** More headroom for application

---

## Immediate Action Items

### 1. Diagnose Application Restart

```bash
# Check logs first
docker logs lto-app --tail 200

# Check if it's memory-related
docker stats lto-app --no-stream

# Check if it's Fabric connection
docker exec lto-app node -e "
const fabricService = require('./backend/services/optimizedFabricService');
fabricService.initialize().then(() => console.log('OK')).catch(e => console.error('ERROR:', e.message));
"
```

### 2. Verify Chaincode Deployment

```bash
# Check committed chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel

# Should show: vehicle-registration version 1.0 (or 1.0.2)
```

### 3. Check PostgreSQL Sync Status

```bash
# Verify vehicles exist
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT COUNT(*) as total, 
       COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL) as synced
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

---

## Configuration Verification Checklist

- [ ] **Resource limits fit:** ✅ ~5.5GB < 8GB
- [ ] **CPU limits fit:** ✅ ~5.25 < 4 (shared, OK)
- [ ] **Application memory:** ⚠️ Consider increasing to 1GB
- [ ] **PostgreSQL optimized:** ✅ Settings configured
- [ ] **Health checks:** ✅ Configured
- [ ] **Dependencies:** ✅ Proper ordering
- [ ] **Application status:** ❌ **Restarting - needs investigation**

---

## Next Steps

1. **Immediate:** Check `lto-app` logs to diagnose restart
2. **Short-term:** Increase application memory limit to 1GB
3. **Verify:** Ensure chaincode is properly deployed
4. **Monitor:** Check resource usage with `docker stats`

---

**Status:** ✅ Configuration fits 8GB droplet, but application restart needs investigation
