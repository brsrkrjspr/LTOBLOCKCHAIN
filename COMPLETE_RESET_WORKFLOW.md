# Complete Reset Workflow - Step by Step

## Overview

This is your complete guide for resetting the Fabric blockchain while preserving PostgreSQL data.

---

## Phase 1: Pre-Reset (Do This First)

### 1.1 Run Pre-Reset Verification

```bash
chmod +x scripts/pre-reset-verification.sh
bash scripts/pre-reset-verification.sh
```

**Expected Output:**
- ✅ All checks pass
- Shows current vehicle count
- Shows current Fabric state

### 1.2 Check Current State

```bash
# PostgreSQL vehicles
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT COUNT(*) as total_vehicles FROM vehicles WHERE status = 'REGISTERED';
"

# Fabric vehicles
docker exec lto-app node backend/scripts/query-fabric-vehicles.js
```

**Note the counts** - you'll verify they match after re-registration.

### 1.3 (Optional) Backup PostgreSQL

```bash
docker exec postgres pg_dump -U lto_user -d lto_blockchain > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Phase 2: Reset Execution

### 2.1 Run Reset Script

```bash
bash scripts/reset-fabric-blockchain.sh
```

**When prompted:** Type `RESET` (all caps) to confirm

**Expected Duration:** 5-10 minutes

**What Happens:**
1. Stops Fabric containers
2. Removes containers and volumes
3. Clears all blockchain data
4. Regenerates certificates
5. Regenerates channel artifacts
6. Creates channel
7. **Deploys chaincode** (Step 15)
8. Verifies deployment

**Success Indicators:**
- ✅ "Channel 'ltochannel' created and joined successfully"
- ✅ "Chaincode deployed successfully"
- ✅ "FABRIC BLOCKCHAIN RESET COMPLETE!"

---

## Phase 3: Post-Reset Verification

### 3.1 Verify Fabric Reset

```bash
# Check chaincode is deployed
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel

# Should show: vehicle-registration version 1.0

# Check Fabric is empty (no vehicles)
docker exec lto-app node backend/scripts/query-fabric-vehicles.js
# Should show: 0 vehicles (or empty)
```

### 3.2 Verify PostgreSQL Still Has Data

```bash
# Check vehicles still exist
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT COUNT(*) as total FROM vehicles WHERE status = 'REGISTERED';
"

# Should show same count as before reset
```

---

## Phase 4: Synchronization (Critical)

### 4.1 Check Sync Status

```bash
bash scripts/verify-postgres-fabric-sync.sh
```

**Expected Output:**
- PostgreSQL: X vehicles
- Fabric: 0 vehicles
- Status: ⚠️ Out of sync (expected after reset)

### 4.2 Re-register Vehicles

```bash
# Re-register all vehicles from PostgreSQL to Fabric
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js
```

**When prompted:** Type `YES` to confirm

**Expected Output:**
- ✅ "Found X vehicle(s) missing blockchain registration"
- ✅ "Registered successfully. TX ID: ..."
- ✅ "Fixed X vehicle(s) - QR codes should now work!"

### 4.3 Verify Sync Complete

```bash
# Run sync verification again
bash scripts/verify-postgres-fabric-sync.sh
```

**Expected Output:**
- ✅ "All vehicles are synchronized!"
- PostgreSQL count = Fabric count

---

## Phase 5: Application Restart

### 5.1 Restart Application

```bash
# Restart with new memory limit (1GB)
docker compose -f docker-compose.unified.yml up -d lto-app

# Monitor startup
docker logs lto-app -f
```

**Look for:**
- ✅ "Connected to Hyperledger Fabric network successfully"
- ✅ "PostgreSQL connection successful"
- ✅ "Server running on port 3001"

### 5.2 Verify Application Health

```bash
# Check container status
docker ps | grep lto-app
# Should show: Up X minutes (not Restarting)

# Check health endpoint
curl http://localhost:3001/api/health
# Or via nginx: curl https://your-domain/api/health
```

---

## Phase 6: Final Verification

### 6.1 Test Vehicle Registration

1. Register a new vehicle through the application
2. Verify it appears in both PostgreSQL and Fabric

### 6.2 Test Ownership Transfer

1. Initiate an ownership transfer
2. Verify transfer recorded in Fabric

### 6.3 Verify Data Accuracy

```bash
# Compare counts
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT COUNT(*) FROM vehicles WHERE status = 'REGISTERED';
"
docker exec lto-app node backend/scripts/query-fabric-vehicles.js

# Counts should match!
```

---

## Troubleshooting

### Reset Script Fails

**Check:**
1. Error message in script output
2. Container logs: `docker logs [container-name]`
3. Disk space: `df -h`
4. Docker status: `docker ps`

**Common Fixes:**
- Ensure all containers are running before reset
- Check disk space (need ~5GB free)
- Verify chaincode directory exists

---

### Re-registration Fails

**Check:**
1. Application logs: `docker logs lto-app`
2. Fabric connection: `docker exec lto-app node -e "require('./backend/services/optimizedFabricService').initialize()"`
3. Chaincode deployed: `docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel`

**Common Fixes:**
- Ensure chaincode is deployed
- Check wallet exists: `docker exec lto-app ls -la /app/wallet`
- Verify network config: `docker exec lto-app cat /app/network-config.json`

---

### Application Still Restarting

**Check:**
1. Logs: `docker logs lto-app --tail 200`
2. Memory usage: `docker stats lto-app --no-stream`
3. Fabric connection errors

**Common Causes:**
- Fabric not connected (chaincode not deployed)
- Database connection failed
- Missing environment variables
- Memory limit hit (should be fixed with 1GB limit)

---

## Success Criteria

After completing all phases, verify:

- [ ] ✅ Reset script completed successfully
- [ ] ✅ Chaincode deployed (version 1.0)
- [ ] ✅ Channel exists and peer is joined
- [ ] ✅ PostgreSQL vehicles re-registered on Fabric
- [ ] ✅ Sync verification shows all vehicles synchronized
- [ ] ✅ Application is running (not restarting)
- [ ] ✅ Vehicle registration works
- [ ] ✅ Ownership transfer works
- [ ] ✅ Data accuracy verified (PostgreSQL = Fabric)

---

## Quick Reference

### Before Reset
```bash
bash scripts/pre-reset-verification.sh
```

### Reset
```bash
bash scripts/reset-fabric-blockchain.sh
# Type: RESET
```

### After Reset
```bash
bash scripts/verify-postgres-fabric-sync.sh
docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js
bash scripts/verify-postgres-fabric-sync.sh
docker compose -f docker-compose.unified.yml restart lto-app
```

---

**Status:** ✅ **Ready for Reset**  
**Configuration:** ✅ **Verified for DigitalOcean 8GB Droplet**
