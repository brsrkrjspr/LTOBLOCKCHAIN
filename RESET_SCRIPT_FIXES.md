# Reset Script Fixes - January 2026

## Issues Fixed

### 1. ✅ TLS Certificate Verification Error
**Problem:** Channel creation was failing with:
```
tls: failed to verify certificate: x509: certificate signed by unknown authority
```

**Root Cause:** Script was trying to use `orderer-tls-ca.crt` from peer's TLS directory, which doesn't exist. It should use the orderer's TLS CA certificate directly.

**Fix:** 
- Changed to copy orderer's TLS CA directly: `fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt`
- Copy it to peer container at: `/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt`
- Use this path for all TLS operations (channel create, join, anchor peer update, chaincode approve/commit)

**Location:** Step 14 (Channel Creation)

### 2. ✅ Chaincode Copy Failure
**Problem:** Chaincode packaging failed because the copy operation failed silently:
```
lstat /opt/gopath/src/github.com/chaincode/vehicle-registration-production: no such file or directory
```

**Root Cause:** The `docker cp` command was failing but the script continued anyway due to `2>/dev/null` redirecting errors.

**Fix:**
- Removed silent error suppression (`2>/dev/null`)
- Added explicit error checking after copy
- Added verification step to confirm chaincode directory and `index.js` exist in peer container before packaging
- Script now exits with clear error message if copy fails

**Location:** Step 16 (Chaincode Deployment)

### 3. ✅ Channel Creation Error Handling
**Problem:** Channel creation errors were not properly detected, causing subsequent steps to fail.

**Fix:**
- Added proper error detection using `grep -qi "error\|failed"`
- Added explicit `--outputBlock` parameter to save genesis block
- Increased timeout from 30s to 60s
- Script now exits with error if channel creation fails

**Location:** Step 14 (Channel Creation)

### 4. ✅ PostgreSQL Reset Option
**Problem:** User wanted to reset PostgreSQL as well, but script only reset Fabric.

**Fix:**
- Added prompt asking if user wants to reset PostgreSQL
- If user types "YES", script clears all application data using `database/clear-application-data.sql`
- Falls back to `TRUNCATE CASCADE` if SQL file doesn't exist
- Preserves user accounts and schema structure
- Updated final summary to reflect PostgreSQL reset status

**Location:** Step 11 (PostgreSQL Reset)

## Changes Summary

| Step | Old Behavior | New Behavior |
|------|-------------|--------------|
| TLS CA | Used peer's TLS CA or non-existent file | Uses orderer's TLS CA directly |
| Channel Create | 30s timeout, no error checking | 60s timeout, explicit error detection |
| Chaincode Copy | Silent failure allowed | Explicit verification, fails fast |
| PostgreSQL | Not reset | Optional reset with confirmation |

## Testing Checklist

After running the reset script, verify:

1. **Channel Created:**
   ```bash
   docker exec peer0.lto.gov.ph peer channel list
   # Should show: ltochannel
   ```

2. **Chaincode Deployed:**
   ```bash
   docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
   # Should show: vehicle-registration
   ```

3. **PostgreSQL (if reset):**
   ```bash
   docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles;"
   # Should show: 0 (if reset) or original count (if not reset)
   ```

4. **Application Connection:**
   ```bash
   docker logs lto-app | grep -i "fabric\|chaincode\|channel"
   # Should show successful connection messages
   ```

## Usage

### Complete Reset (Fabric + PostgreSQL):
```bash
bash scripts/reset-fabric-blockchain.sh
# Type: RESET
# Type: YES (when asked about PostgreSQL)
```

### Fabric Only Reset:
```bash
bash scripts/reset-fabric-blockchain.sh
# Type: RESET
# Press Enter (skip PostgreSQL reset)
```

## Next Steps After Reset

1. **Restart Application:**
   ```bash
   docker compose -f docker-compose.unified.yml restart lto-app
   ```

2. **Verify Everything Works:**
   - Check application logs: `docker logs lto-app`
   - Test vehicle registration
   - Verify blockchain transaction is created

3. **If PostgreSQL Was NOT Reset:**
   - Re-register vehicles: `docker exec lto-app node backend/scripts/register-missing-vehicles-on-blockchain.js`
   - Verify sync: `bash scripts/verify-postgres-fabric-sync.sh`
