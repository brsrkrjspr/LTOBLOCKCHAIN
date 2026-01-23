# Pre-Reset Readiness Guide

## ✅ Before Running Reset: Complete Checklist

This guide ensures your system is ready for the Fabric blockchain reset.

---

## Step 1: Run Pre-Reset Verification

```bash
# Make script executable
chmod +x scripts/pre-reset-verification.sh

# Run verification
bash scripts/pre-reset-verification.sh
```

**This checks:**
- ✅ Docker containers are running
- ✅ Required scripts exist
- ✅ Chaincode directory exists
- ✅ PostgreSQL data status
- ✅ Disk space available

---

## Step 2: Verify Current System State

### Check Current Vehicles

```bash
# Count vehicles in PostgreSQL
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL) as with_blockchain
FROM vehicles 
WHERE status IN ('REGISTERED', 'APPROVED');
"
```

**What this tells you:**
- How many vehicles will need re-registration after reset
- Current sync status

### Check Current Fabric State

```bash
# List vehicles on Fabric
docker exec lto-app node backend/scripts/query-fabric-vehicles.js

# Or check chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

**What this tells you:**
- What's currently on Fabric
- Chaincode version deployed

---

## Step 3: Backup (Optional but Recommended)

### Backup PostgreSQL Data

```bash
# Create backup
docker exec postgres pg_dump -U lto_user -d lto_blockchain > backup_before_reset_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_before_reset_*.sql
```

**Why:** If something goes wrong, you can restore your data.

---

## Step 4: Verify Prerequisites

### Required Files/Directories

- [ ] `scripts/reset-fabric-blockchain.sh` - Reset script
- [ ] `scripts/generate-crypto.sh` - Certificate generation
- [ ] `scripts/generate-channel-artifacts.sh` - Channel artifacts
- [ ] `scripts/setup-fabric-wallet.js` - Wallet setup
- [ ] `chaincode/vehicle-registration-production/` - Chaincode directory
- [ ] `chaincode/vehicle-registration-production/index.js` - Chaincode file
- [ ] `docker-compose.unified.yml` - Docker compose file

### Required Environment Variables

The reset script uses these (with defaults):
- `COUCHDB_PASSWORD` (default: `adminpw`) - For CouchDB verification
- `POSTGRES_PASSWORD` (default: `lto_password`) - Not used by reset script

**Note:** Reset script doesn't require `.env` file - it uses defaults or environment variables.

---

## Step 5: Understand What Will Happen

### During Reset

1. **Stops containers:** peer, orderer, couchdb, cli
2. **Removes containers:** All Fabric containers
3. **Deletes volumes:** All blockchain data (peer-data, orderer-data, couchdb-data)
4. **Clears local data:** CouchDB, peer, orderer directories
5. **Regenerates certificates:** New crypto materials
6. **Regenerates channel artifacts:** New genesis block, channel transaction
7. **Recreates wallet:** New Fabric wallet
8. **Starts containers:** Fresh Fabric network
9. **Creates channel:** `ltochannel`
10. **Deploys chaincode:** `vehicle-registration` v1.0

### What's Preserved

- ✅ **PostgreSQL database** - All vehicles, users, transfers remain
- ✅ **IPFS data** - Document storage unchanged
- ✅ **Application code** - No code changes

### What's Lost

- ❌ **All Fabric transactions** - Complete blockchain history cleared
- ❌ **All Fabric state** - CouchDB world state cleared
- ❌ **All blocks** - Ledger cleared
- ❌ **Old transaction IDs** - `blockchain_tx_id` values become invalid

---

## Step 6: Post-Reset Requirements

### Critical: Re-register Vehicles

After reset, PostgreSQL vehicles will have invalid `blockchain_tx_id` values. You MUST re-register:

```bash
# Re-register all vehicles from PostgreSQL to Fabric
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js
```

**This script will:**
- Find all REGISTERED vehicles in PostgreSQL
- Check if they exist on Fabric
- Re-register missing vehicles
- Update `blockchain_tx_id` with new transaction IDs

### Verify Sync

```bash
# Run sync verification
bash scripts/verify-postgres-fabric-sync.sh

# Should show: "✅ All vehicles are synchronized!"
```

---

## Step 7: Application Container Issue

**Current Status:** Your `lto-app` is restarting

**Before Reset:**
- Check logs: `docker logs lto-app --tail 100`
- Identify the cause (Fabric connection, memory, etc.)

**After Reset:**
- Application should start properly (chaincode will be deployed)
- If still restarting, check logs again

**Memory Fix Applied:**
- Application memory increased to 1GB (from 768MB)
- Should be more stable

---

## Step 8: Chaincode Version Note

**Current:** Chaincode container shows version `1.0.2`

**Reset Script:** Deploys version `1.0`

**Impact:** 
- Old chaincode container will be removed
- New chaincode v1.0 will be deployed
- This is expected and correct

---

## Complete Pre-Reset Checklist

- [ ] **Run pre-reset verification:** `bash scripts/pre-reset-verification.sh`
- [ ] **Check PostgreSQL vehicle count:** Know how many need re-registration
- [ ] **Check Fabric state:** See what's currently on blockchain
- [ ] **Backup PostgreSQL** (optional): `docker exec postgres pg_dump ...`
- [ ] **Verify required files exist:** Scripts, chaincode, configs
- [ ] **Check disk space:** At least 5GB free
- [ ] **Understand post-reset steps:** Know you need to re-register vehicles
- [ ] **Application logs checked:** Understand why it's restarting

---

## Ready to Reset?

Once all checks pass:

```bash
# Run reset script
bash scripts/reset-fabric-blockchain.sh

# When prompted, type: RESET (all caps)
```

**Expected Duration:** 5-10 minutes

---

## After Reset: Complete Workflow

```bash
# 1. Verify reset completed
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel

# 2. Check sync status
bash scripts/verify-postgres-fabric-sync.sh

# 3. Re-register vehicles (if you have vehicles in PostgreSQL)
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js

# 4. Verify sync complete
bash scripts/verify-postgres-fabric-sync.sh

# 5. Restart application (if needed)
docker compose -f docker-compose.unified.yml restart lto-app

# 6. Check application logs
docker logs lto-app -f
```

---

## Troubleshooting

### If Reset Fails

1. **Check error message** - Script shows what failed
2. **Check container logs** - `docker logs [container-name]`
3. **Verify prerequisites** - Run pre-reset verification again
4. **Check disk space** - `df -h`
5. **Check Docker** - `docker ps` and `docker system df`

### Common Issues

**Issue:** "Chaincode directory not found"
- **Fix:** Ensure `chaincode/vehicle-registration-production/` exists

**Issue:** "Failed to generate certificates"
- **Fix:** Check `crypto-config.yaml` exists in root/config/fabric-network

**Issue:** "Channel creation failed"
- **Fix:** Check orderer is running, TLS certificates are valid

**Issue:** "Chaincode deployment failed"
- **Fix:** Check peer is in channel, chaincode directory is accessible

---

## Summary

**Your System Status:**
- ✅ Configuration fits DigitalOcean 8GB droplet
- ✅ Reset script is ready and verified
- ✅ All required scripts exist
- ⚠️ Application restarting (will be addressed after reset)
- ⚠️ Need to re-register vehicles after reset

**You're Ready!** Run the pre-reset verification, then proceed with reset.

---

**Last Updated:** 2026-01-24
