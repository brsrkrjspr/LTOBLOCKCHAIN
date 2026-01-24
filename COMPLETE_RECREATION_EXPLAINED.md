# Complete Fabric Reset - Complete Recreation (No Reuse)

## What This Script Does

The `complete-fabric-reset-reconfigure.sh` script ensures **COMPLETE RECREATION** of all Fabric components - nothing is reused.

## Complete Cleanup Process

### Step 1: Remove ALL Containers (Including Old Chaincode)

**What it removes:**
- ✅ All Fabric containers (`peer0.lto.gov.ph`, `orderer.lto.gov.ph`, `couchdb`, `cli`)
- ✅ **ALL old chaincode containers** (`dev-peer0.lto.gov.ph-vehicle-registration_*`)
- ✅ Application container (`lto-app`)

**How:**
1. Removes old chaincode containers first (they're not in docker-compose)
2. Uses `docker compose down -v` to stop and remove containers AND volumes
3. Verifies all Fabric containers are gone
4. Force removes any remaining containers

**Why this matters:**
- Old chaincode containers can interfere with new deployments
- Containers must be completely removed, not just stopped
- Ensures no cached state from old containers

### Step 2: Remove ALL Volumes (Critical)

**What it removes:**
- ✅ `orderer-data` volume (contains old channel ledger)
- ✅ `peer-data` volume (contains old peer ledger)
- ✅ `couchdb-data` volume (contains old world state)
- ✅ Handles prefixed volumes (`ltoblockchain_orderer-data`, etc.)

**How:**
1. Finds all volumes matching patterns (with/without prefixes)
2. Removes all containers first (to release volumes)
3. Removes volumes
4. **VERIFIES volumes are gone** (critical check)
5. Exits with error if volumes can't be removed

**Why this matters:**
- If `orderer-data` volume still exists, orderer will find old `ltochannel`
- This causes "channel already exists" errors
- Old channel has old certificates, new certificates won't match

### Step 3: Regenerate Certificates

**What it does:**
- Backs up old certificates
- Generates completely new certificates
- Verifies certificates were created

**Why fresh:**
- Old certificates won't match new channel configuration
- Ensures everything is from the same generation

### Step 4: Fix MSP admincerts

**What it fixes:**
- User-level admincerts
- Peer-level admincerts
- **Organization-level admincerts** (CRITICAL)
- Orderer TLS CA

**Why before containers:**
- Containers read MSP when they start
- Must be fixed before containers are created
- Prevents "creator org unknown" errors

### Step 5: Regenerate Channel Artifacts

**What it creates:**
- New genesis block (for orderer)
- New channel transaction (`ltochannel.tx` or `channel.tx`)
- New anchor peer update

**Why fresh:**
- Old artifacts have old certificate references
- New artifacts match new certificates

### Step 6: Start Containers (COMPLETELY NEW)

**What happens:**
- Containers are **created fresh** using `docker compose up -d`
- They are **NOT restarted** - they are **NEW containers**
- Orderer starts with new genesis block
- Peer starts with new MSP configuration

**Why new containers:**
- Restarting keeps old container state
- Creating new ensures clean state
- Orderer starts with empty ledger (no old channels)

### Step 7: Create Channel

**Why it works now:**
- Orderer has **no old channel** (volume was removed)
- Orderer starts with **new genesis block**
- Channel creation succeeds because orderer is clean

## Key Differences from Previous Attempts

### ❌ What Was Wrong Before:

1. **Volumes not fully removed:**
   - Script tried to remove `orderer-data` but volume was `ltoblockchain_orderer-data`
   - Orderer still had old channel in ledger

2. **Containers were restarted, not recreated:**
   - `docker restart` keeps old container state
   - Old chaincode containers weren't removed

3. **No verification:**
   - Didn't verify volumes were actually gone
   - Didn't verify containers were actually removed

### ✅ What's Fixed Now:

1. **Volume detection handles prefixes:**
   ```bash
   FABRIC_VOLUMES=$(docker volume ls -q | grep -E "(orderer-data|peer-data|couchdb-data)" || true)
   ```
   - Catches `orderer-data`, `ltoblockchain_orderer-data`, `ltoblockchain-orderer-data`, etc.

2. **Complete container removal:**
   ```bash
   # Remove old chaincode containers FIRST
   docker ps -a | grep "dev-peer0.lto.gov.ph-vehicle-registration" | awk '{print $1}' | xargs -r docker rm -f
   
   # Then use docker compose down -v
   docker compose -f docker-compose.unified.yml down -v
   
   # Verify all are gone
   REMAINING_CONTAINERS=$(docker ps -a --format "{{.Names}}" | grep -E "(peer|orderer|couchdb|cli|dev-peer)" || true)
   ```

3. **Verification at every step:**
   - Verifies volumes are gone before proceeding
   - Verifies containers are gone before proceeding
   - Exits with error if verification fails

4. **Containers are created, not restarted:**
   ```bash
   docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph
   ```
   - `up -d` creates new containers
   - `restart` would reuse old containers

## Container Lifecycle

### Old Way (Wrong):
```
1. docker stop orderer.lto.gov.ph
2. docker restart orderer.lto.gov.ph  ❌ Reuses old container
```

### New Way (Correct):
```
1. docker compose down -v              ✅ Removes containers AND volumes
2. docker compose up -d orderer.lto.gov.ph  ✅ Creates NEW container
```

## Volume Lifecycle

### Old Way (Wrong):
```
1. docker volume rm orderer-data        ❌ Misses ltoblockchain_orderer-data
2. Start orderer                        ❌ Still has old channel
```

### New Way (Correct):
```
1. Find ALL volumes (any prefix)        ✅ Catches all patterns
2. Remove ALL containers first          ✅ Releases volumes
3. Remove volumes                       ✅ Actually removes them
4. VERIFY volumes are gone              ✅ Critical check
5. Exit if volumes remain               ✅ Prevents errors
```

## Expected Container States After Reset

After running the script, you should see:

```bash
docker ps
```

**Expected:**
- `orderer.lto.gov.ph` - **NEW** (created just now)
- `peer0.lto.gov.ph` - **NEW** (created just now)
- `couchdb` - **NEW** (created just now)
- **NO** `dev-peer0.lto.gov.ph-vehicle-registration_*` containers (old ones removed)

**Container ages:**
- All Fabric containers should be **very recent** (created during script execution)
- If you see containers that are "hours" or "days" old, they weren't recreated

## Verification Commands

After running the script, verify complete recreation:

```bash
# Check container creation times (should be recent)
docker ps --format "table {{.Names}}\t{{.CreatedAt}}"

# Check volumes are gone
docker volume ls | grep -E "(orderer-data|peer-data|couchdb-data)"
# Should return nothing

# Check no old chaincode containers
docker ps -a | grep "dev-peer"
# Should return nothing

# Check orderer has no old channels
docker logs orderer.lto.gov.ph | grep "ltochannel"
# Should only show channel creation, not "Found 2 inactive chains"
```

## Why "Channel Already Exists" Error Happened

The error occurred because:

1. **Orderer volume wasn't fully removed:**
   - Volume `ltoblockchain_orderer-data` existed
   - Script only tried to remove `orderer-data`
   - Orderer started with old ledger containing `ltochannel`

2. **Orderer found old channel:**
   ```
   Found 2 inactive chains: [system-channel ltochannel]
   ```
   - This means orderer had old channel in its ledger
   - When trying to create channel with new certificates, orderer rejected it
   - Error: "config update for existing channel did not pass initial checks"

3. **Certificate mismatch:**
   - Old channel was created with old certificates
   - New certificates don't match old channel's MSP
   - Orderer rejects the update

## How This Script Fixes It

1. **Removes ALL volumes (any prefix):**
   - Catches `ltoblockchain_orderer-data`
   - Verifies it's gone
   - Orderer starts with empty ledger

2. **Removes ALL containers:**
   - Including old chaincode containers
   - Verifies they're gone
   - Creates completely new containers

3. **Proper order:**
   - Volumes removed BEFORE certificates regenerated
   - Certificates regenerated BEFORE containers started
   - Containers created (not restarted) with new configuration

## Summary

**The script ensures:**
- ✅ No containers are reused (all are recreated)
- ✅ No volumes remain (all are removed and verified)
- ✅ No old chaincode containers interfere
- ✅ Orderer starts completely fresh (no old channels)
- ✅ Everything uses new certificates from same generation
- ✅ Channel creation succeeds because orderer is clean

**Result:**
- Complete fresh start
- No "channel already exists" errors
- No "creator org unknown" errors
- Everything works from scratch
