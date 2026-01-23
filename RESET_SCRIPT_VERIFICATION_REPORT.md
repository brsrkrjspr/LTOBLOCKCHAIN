# Fabric Blockchain Reset Script Verification Report

## Executive Summary

**Script Analyzed:** `scripts/reset-fabric-blockchain.sh`  
**Purpose:** Complete reset of Hyperledger Fabric blockchain data  
**Critical Finding:** ⚠️ **CHAINCODE DEPLOYMENT IS MISSING** - Vehicle registration and ownership transfer will NOT work without chaincode deployment.

---

## 1. What the Reset Script Does Correctly ✅

### 1.1 Data Cleanup
- ✅ Stops all Fabric containers (peer, orderer, couchdb, cli)
- ✅ Removes Fabric containers
- ✅ Removes Docker volumes (peer-data, orderer-data, couchdb-data) - **Critical for clearing blockchain state**
- ✅ Clears local CouchDB data directory (if mounted)
- ✅ Clears local peer ledger data (if mounted)
- ✅ Clears local orderer ledger data (if mounted)

### 1.2 Certificate Regeneration
- ✅ Backs up old certificates with timestamp
- ✅ Regenerates certificates using `scripts/generate-crypto.sh`
- ✅ Sets up TLS certificates
- ✅ Fixes MSP structure

### 1.3 Channel Setup
- ✅ Backs up old channel artifacts with timestamp
- ✅ Regenerates channel artifacts using `scripts/generate-channel-artifacts.sh`
- ✅ Creates channel `ltochannel`
- ✅ Joins peer to channel
- ✅ Updates anchor peer (if anchor peer transaction exists)
- ✅ Verifies channel creation

### 1.4 Wallet Recreation
- ✅ Removes old wallet
- ✅ Creates new wallet directory
- ✅ Sets up wallet using `scripts/setup-fabric-wallet.js` (if Node.js available)

### 1.5 Verification
- ✅ Checks for certificate errors
- ✅ Verifies channel exists
- ✅ Checks CouchDB status and confirms databases are cleared

---

## 2. Critical Issues Found ❌

### 2.1 **MISSING: Chaincode Deployment** 🔴

**Problem:** The reset script does NOT deploy chaincode after reset. This is **CRITICAL** because:

1. **Vehicle Registration (`RegisterVehicle`)** requires chaincode to be installed and instantiated
2. **Ownership Transfer (`TransferOwnership`)** requires chaincode to be installed and instantiated
3. Without chaincode, the application cannot store vehicle data in Fabric's world state (CouchDB)

**Evidence:**
- Line 243: Script mentions "Deploy chaincode: bash scripts/deploy-chaincode.sh"
- **BUT:** `scripts/deploy-chaincode.sh` does NOT exist in the codebase
- Available scripts: `install-chaincode.sh` and `instantiate-chaincode.sh` (separate scripts)

**Impact:**
- ❌ Vehicle registration will fail: `RegisterVehicle` chaincode function not available
- ❌ Ownership transfer will fail: `TransferOwnership` chaincode function not available
- ❌ Application will show "chaincode not found" errors

**Required Chaincode Functions (from `chaincode/vehicle-registration-production/index.js`):**
- `RegisterVehicle` - Stores vehicle registration in Fabric world state
- `TransferOwnership` - Updates vehicle owner in Fabric world state
- `GetVehicle` - Retrieves vehicle from Fabric
- `UpdateVerificationStatus` - Updates verification status
- `GetVehiclesByOwner` - Queries vehicles by owner
- `GetVehicleHistory` - Gets vehicle transaction history

---

### 2.2 **Incorrect Script Reference**

**Line 243:** References non-existent `scripts/deploy-chaincode.sh`

**Available Alternatives:**
- `scripts/install-chaincode.sh` - Installs chaincode on peer
- `scripts/instantiate-chaincode.sh` - Instantiates chaincode on channel
- `scripts/deploy-chaincode.js` - Node.js deployment script (uses Gateway API, not CLI)

**Recommendation:** Either:
1. Create `scripts/deploy-chaincode.sh` that calls both install and instantiate scripts
2. Update reset script to call `install-chaincode.sh` and `instantiate-chaincode.sh` directly

---

### 2.3 **Missing Chaincode Volume Mount Check**

**Issue:** The reset script doesn't verify that chaincode is accessible to the peer container.

**Required:** Chaincode must be available at:
- Container path: `/opt/gopath/src/github.com/chaincode/vehicle-registration-production`
- Local path: `chaincode/vehicle-registration-production`

**Current State:** Script assumes chaincode exists but doesn't verify.

---

### 2.4 **CLI Container Not Started**

**Issue:** The reset script doesn't start the `cli` container, which is needed for chaincode deployment.

**Evidence:**
- Line 117-120: Only starts `orderer.lto.gov.ph` and `couchdb`
- Line 125-128: Starts `peer0.lto.gov.ph`
- **Missing:** `cli` container startup

**Impact:** If chaincode deployment is added, it will fail because `cli` container is not running.

**Note:** The `install-chaincode.sh` and `instantiate-chaincode.sh` scripts use `docker exec peer0.lto.gov.ph` directly, so they don't require `cli` container. However, some deployment methods may require it.

---

## 3. Verification Against Chaincode Requirements

### 3.1 Vehicle Registration Requirements

**Chaincode Function:** `RegisterVehicle(ctx, vehicleData)`

**Requirements:**
- ✅ Channel exists (`ltochannel`) - **VERIFIED** (line 174)
- ✅ Peer joined to channel - **VERIFIED** (line 166-170)
- ❌ Chaincode installed on peer - **MISSING**
- ❌ Chaincode instantiated on channel - **MISSING**
- ✅ MSP configured (LTOMSP) - **VERIFIED** (certificates regenerated)
- ✅ CouchDB running - **VERIFIED** (line 217-230)

**Storage in Fabric:**
- Vehicle stored with VIN as key: `ctx.stub.putState(vehicle.vin, ...)`
- OR (Official Receipt) stored separately if provided: `ctx.stub.putState(vehicle.orNumber, ...)`
- Composite keys created for owner lookup: `owner~vin`
- Composite keys created for plate lookup: `plate~vin`
- Composite keys created for CR lookup: `cr~vin`

**Status:** ❌ **WILL FAIL** - Chaincode not deployed

---

### 3.2 Ownership Transfer Requirements

**Chaincode Function:** `TransferOwnership(ctx, vin, newOwnerData, transferData)`

**Requirements:**
- ✅ Channel exists (`ltochannel`) - **VERIFIED**
- ✅ Peer joined to channel - **VERIFIED**
- ❌ Chaincode installed on peer - **MISSING**
- ❌ Chaincode instantiated on channel - **MISSING**
- ✅ MSP configured (LTOMSP) - **VERIFIED**
- ✅ CouchDB running - **VERIFIED**

**Storage in Fabric:**
- Updates vehicle record: `ctx.stub.putState(vin, ...)`
- Deletes old owner composite key: `ctx.stub.deleteState(oldOwnerKey)`
- Creates new owner composite key: `ctx.stub.putState(newOwnerKey, ...)`
- Adds transfer to vehicle history array

**Status:** ❌ **WILL FAIL** - Chaincode not deployed

---

## 4. Required Fixes

### Fix 1: Add Chaincode Deployment to Reset Script

**Location:** After Step 14 (anchor peer update), add Step 15 (chaincode deployment)

**Proposed Addition:**

```bash
# Step 15: Deploy chaincode (CRITICAL for vehicle registration and ownership transfer)
echo "1️⃣5️⃣ Deploying chaincode..."

# Check if chaincode directory exists
if [ ! -d "chaincode/vehicle-registration-production" ]; then
    echo "❌ Chaincode directory not found!"
    echo "💡 Expected: chaincode/vehicle-registration-production"
    exit 1
fi

# Copy chaincode to peer container
echo "   Copying chaincode to peer..."
docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/ 2>/dev/null || {
    echo "⚠️  Failed to copy chaincode (may already exist)"
}

# Install chaincode
echo "   Installing chaincode..."
docker exec peer0.lto.gov.ph peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0 2>&1 | tail -5

docker exec peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1 | tail -5

echo "⏳ Waiting for chaincode installation (15s)..."
sleep 15

# Get package ID
PACKAGE_ID=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0:" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    echo "❌ Failed to get chaincode package ID"
    exit 1
fi

echo "   Package ID: $PACKAGE_ID"

# Approve chaincode
echo "   Approving chaincode..."
docker exec peer0.lto.gov.ph peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    2>&1 | tail -5

# Commit chaincode
echo "   Committing chaincode..."
docker exec peer0.lto.gov.ph peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile "$TLS_CA_FILE" \
    --peerAddresses peer0.lto.gov.ph:7051 \
    --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt \
    2>&1 | tail -5

echo "⏳ Waiting for chaincode commit (10s)..."
sleep 10

# Verify chaincode
CHAINCODE_LIST=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_LIST" | grep -q "vehicle-registration"; then
    echo "✅ Chaincode deployed successfully"
else
    echo "⚠️  Chaincode deployment verification failed"
    echo "$CHAINCODE_LIST"
fi
```

**Update Step Numbers:** Renumber existing Step 15 (verification) to Step 16

---

### Fix 2: Update Next Steps Message

**Current (Line 243):**
```bash
echo "  1. Deploy chaincode: bash scripts/deploy-chaincode.sh"
```

**Proposed:**
```bash
echo "  1. Chaincode already deployed (if reset completed successfully)"
echo "  2. Verify chaincode: docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel"
echo "  3. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
echo "  4. Test registration: Register a new vehicle"
```

---

### Fix 3: Add Chaincode Verification to Final Check

**Add to Step 16 (verification):**

```bash
# Check chaincode
CHAINCODE_CHECK=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel 2>&1)
if echo "$CHAINCODE_CHECK" | grep -q "vehicle-registration"; then
    echo "✅ Chaincode deployed"
else
    echo "❌ Chaincode not found"
fi
```

---

## 5. Testing Checklist

After applying fixes, verify:

- [ ] Reset script completes without errors
- [ ] Channel `ltochannel` exists and peer is joined
- [ ] Chaincode `vehicle-registration` v1.0 is installed
- [ ] Chaincode `vehicle-registration` v1.0 is committed to channel
- [ ] CouchDB is running and accessible
- [ ] Application can connect to Fabric network
- [ ] Vehicle registration works (test `RegisterVehicle`)
- [ ] Ownership transfer works (test `TransferOwnership`)
- [ ] Vehicle queries work (test `GetVehicle`, `GetVehiclesByOwner`)

---

## 6. Conclusion

### Current State: ⚠️ **INCOMPLETE**

The reset script correctly:
- ✅ Clears all blockchain data
- ✅ Regenerates certificates and channel artifacts
- ✅ Creates and joins channel
- ✅ Sets up wallet

**BUT** it **MISSING** the critical step of deploying chaincode, which means:
- ❌ Vehicle registration will NOT work
- ❌ Ownership transfer will NOT work
- ❌ Any Fabric operations will fail

### Recommendation: 🔴 **HIGH PRIORITY FIX REQUIRED**

**Action Required:** Add chaincode deployment step to the reset script before marking reset as complete.

**Priority:** **CRITICAL** - System cannot function without chaincode deployment.

---

## 7. Additional Notes

### Chaincode Deployment Methods

The codebase has multiple chaincode deployment methods:

1. **CLI-based (recommended for reset script):**
   - `scripts/install-chaincode.sh` + `scripts/instantiate-chaincode.sh`
   - Uses `docker exec peer0.lto.gov.ph peer lifecycle chaincode ...`

2. **Node.js Gateway API:**
   - `scripts/deploy-chaincode.js`
   - Requires wallet and network config
   - More complex but provides better error handling

3. **Fabric 2.x Lifecycle:**
   - Package → Install → Approve → Commit
   - Required for Fabric 2.5 (current version)

**Recommendation:** Use Fabric 2.x lifecycle commands directly in reset script for reliability.

---

**Report Generated:** 2026-01-24  
**Analyzed By:** AI Code Auditor  
**Script Version:** Current (as of analysis date)
