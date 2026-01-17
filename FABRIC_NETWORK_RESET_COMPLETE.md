# Hyperledger Fabric Network Reset - Complete Documentation

**Date:** January 17, 2026  
**Status:** ✅ COMPLETE - All issues resolved  
**Duration:** Complete Fabric network reset and certificate trust chain fix

---

## Executive Summary

This document details the complete resolution of persistent `502 Bad Gateway` errors caused by Hyperledger Fabric network certificate trust chain issues. A comprehensive network reset was performed, regenerating all cryptographic materials, channel artifacts, and ensuring complete consistency across all components.

---

## Problem Statement

### Initial Symptoms
- **502 Bad Gateway** errors when accessing the application
- Application unable to connect to Hyperledger Fabric network
- Fabric service initialization hanging during requests
- Channel creation failures with policy validation errors

### Root Cause Analysis

The core issue was a **certificate trust chain mismatch**:

1. **Certificate Mismatch**: Admin identity in the wallet was signed by an old CA certificate
2. **Orderer Validation Failure**: Orderer couldn't verify admin signatures because it didn't trust the CA that signed the admin certificate
3. **Policy Validation Errors**: Channel creation failed with `BAD_REQUEST -- policy for [Group] /Channel/Application not satisfied`
4. **Incomplete MSP Setup**: Organization-level admincerts were missing, preventing proper policy validation

### Error Messages Encountered

```
Error: got unexpected status: BAD_REQUEST -- error validating channel creation transaction 
for new channel 'ltochannel', could not successfully apply update to template configuration: 
error authorizing update: error validating DeltaSet: policy for [Group] /Channel/Application 
not satisfied: implicit policy evaluation failed - 0 sub-policies were satisfied, but this 
policy requires 1 of the 'Admins' sub-policies to be satisfied
```

```
invalid identity error="the supplied identity is not valid: x509: certificate signed by 
unknown authority (possibly because of \"x509: ECDSA verification failure\" while trying 
to verify candidate authority certificate \"ca.lto.gov.ph\")"
```

---

## Solution Overview

A **complete Fabric network reset** was performed to ensure all components use matching certificates from the same generation:

1. ✅ Complete cleanup of old crypto materials and artifacts
2. ✅ Fresh generation of all cryptographic materials
3. ✅ Proper setup of admincerts at all levels (user, peer, organization)
4. ✅ Regeneration of genesis block and channel transaction
5. ✅ Channel creation and peer join
6. ✅ Chaincode deployment
7. ✅ Wallet regeneration with new admin identity
8. ✅ Database migrations for missing tables

---

## Detailed Steps Performed

### Step 1: Complete Cleanup

**Script Created:** `scripts/complete-fabric-reset.sh`

```bash
# Stopped all containers
docker compose -f docker-compose.unified.yml down -v

# Removed all old materials
sudo rm -rf fabric-network/crypto-config
sudo rm -rf fabric-network/channel-artifacts
rm -rf wallet
```

**Why:** Ensured no stale certificates or artifacts could cause conflicts.

---

### Step 2: Generate Fresh Cryptographic Materials

```bash
docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config
```

**Result:** Fresh CA certificates, admin certificates, peer certificates, and orderer certificates generated.

---

### Step 3: Setup Admin Certificates at All Levels

**Critical Fix:** Organization-level admincerts were missing, which prevented orderer from validating admin signatures.

```bash
ADMIN_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/Admin@lto.gov.ph-cert.pem"

# User-level admincerts
mkdir -p "${ADMIN_MSP}/admincerts"
cp "${ADMIN_CERT}" "${ADMIN_MSP}/admincerts/"

# Peer-level admincerts
mkdir -p "$PEER_ADMINCERTS"
cp "${ADMIN_CERT}" "$PEER_ADMINCERTS/"

# Organization-level admincerts (CRITICAL for orderer validation)
mkdir -p "${ORG_MSP}/admincerts"
cp "${ADMIN_CERT}" "${ORG_MSP}/admincerts/"

# Also ensure organization MSP has signcerts
mkdir -p "${ORG_MSP}/signcerts"
cp "${ADMIN_CERT}" "${ORG_MSP}/signcerts/"
```

**Why:** The orderer validates channel creation transactions by checking if the Application section was signed by an admin. With NodeOUs enabled, it needs the organization MSP to have admincerts properly configured.

---

### Step 4: Generate Genesis Block

```bash
docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel -outputBlock /fabric-network/channel-artifacts/genesis.block
```

**Result:** Fresh genesis block with updated organization MSP that includes admincerts.

---

### Step 5: Generate Channel Transaction

```bash
docker run --rm \
    -v "$(pwd)/config:/config" \
    -v "$(pwd)/fabric-network:/fabric-network" \
    -e FABRIC_CFG_PATH=/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -outputCreateChannelTx /fabric-network/channel-artifacts/channel.tx -channelID ltochannel
```

**Result:** Channel transaction file generated with correct organization configuration.

---

### Step 6: Start Containers

```bash
docker compose -f docker-compose.unified.yml up -d
```

**Containers Started:**
- `orderer.lto.gov.ph` - Ordering service
- `peer0.lto.gov.ph` - Peer node
- `couchdb` - State database
- `cli` - Fabric CLI tool
- `postgres` - Application database
- `ipfs` - IPFS storage
- `lto-app` - Application server

---

### Step 7: Create Channel

```bash
docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

**Result:** ✅ Channel `ltochannel` created successfully (previously failing with policy errors).

---

### Step 8: Join Peer to Channel

```bash
docker exec cli peer channel join -b ltochannel.block
```

**Result:** ✅ Peer `peer0.lto.gov.ph` successfully joined `ltochannel`.

---

### Step 9: Deploy Chaincode

**Chaincode:** `vehicle-registration` v1.0

```bash
# Package chaincode
docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

# Install chaincode
docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration_1.0:" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

# Approve chaincode
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Commit chaincode
docker exec cli peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

**Result:** ✅ Chaincode deployed and committed successfully.

**Package ID:** `vehicle-registration_1.0:c4282372f5282e602b292c050dc8abfe8051939c67b5dfaa5099c15d7a18c1ee`

---

### Step 10: Regenerate Wallet

**Critical:** The wallet contained the old admin identity signed by the old CA. It needed to be regenerated with the new admin identity.

```bash
node scripts/setup-fabric-wallet.js
```

**Result:** ✅ New wallet created with admin identity matching the fresh certificates.

---

### Step 11: Database Migrations

**Issue:** Application startup failed due to missing database tables.

**Migrations Applied:**

1. **Refresh Tokens Migration**
   ```bash
   docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql
   ```
   - Created `refresh_tokens` table
   - Created `sessions` table
   - Created `cleanup_expired_tokens()` function

2. **Token Blacklist Migration**
   ```bash
   docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
   ```
   - Created `token_blacklist` table
   - Created `cleanup_expired_blacklist()` function

**Result:** ✅ All required tables created, application startup successful.

---

## Key Technical Insights

### Why Organization-Level Admincerts Are Critical

With **NodeOUs enabled** in Hyperledger Fabric:
- Admin identification is based on `OU=admin` in the certificate's Subject
- However, when the orderer validates channel creation transactions, it checks the organization MSP structure
- The organization MSP must have `admincerts` folder containing admin certificates
- Without this, the orderer cannot validate that the Application section was signed by an admin

### Certificate Trust Chain

The complete trust chain must be consistent:
```
CA Certificate (in genesis block)
    ↓
Admin Certificate (signed by CA)
    ↓
Wallet Identity (uses Admin Certificate)
    ↓
Channel Transaction (signed by Admin)
    ↓
Orderer Validation (checks CA trust + admin policy)
```

If any link in this chain is broken or mismatched, validation fails.

### Why Complete Reset Was Necessary

Partial fixes (regenerating only some components) didn't work because:
- Old wallet had admin identity from old CA
- New genesis block had new CA
- Orderer couldn't verify old admin signature against new CA
- Channel creation failed at policy validation

**Solution:** Regenerate everything from scratch to ensure complete consistency.

---

## Files Created/Modified

### New Files

1. **`scripts/complete-fabric-reset.sh`**
   - Comprehensive reset script
   - Handles all steps automatically
   - Includes error checking and validation

### Modified Files

1. **`fabric-network/crypto-config/`** - Completely regenerated
2. **`fabric-network/channel-artifacts/`** - Regenerated
3. **`wallet/`** - Regenerated with new admin identity
4. **Database schema** - Added `refresh_tokens`, `sessions`, `token_blacklist` tables

---

## Verification Steps

### 1. Verify Channel Exists
```bash
docker exec cli peer channel list
# Expected: ltochannel
```

### 2. Verify Chaincode is Committed
```bash
docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration
# Expected: Version: 1.0, Sequence: 1
```

### 3. Verify Wallet Exists
```bash
ls -la wallet/
# Expected: admin.id file exists
```

### 4. Verify Database Tables
```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt"
# Expected: refresh_tokens, sessions, token_blacklist tables exist
```

### 5. Verify Application Logs
```bash
docker logs lto-app --tail 50
# Expected: 
# ✅ Database schema validation passed
# ✅ Connected to Hyperledger Fabric network successfully
# ✅ Real Hyperledger Fabric integration active
```

---

## Current Status

### ✅ All Systems Operational

- **Fabric Network:** ✅ Running and connected
- **Channel:** ✅ `ltochannel` created and active
- **Chaincode:** ✅ `vehicle-registration` v1.0 deployed
- **Wallet:** ✅ Regenerated with matching certificates
- **Database:** ✅ All required tables exist
- **Application:** ✅ Running on port 3001
- **IPFS:** ✅ Connected and operational

### Application Endpoints

- **Frontend:** https://ltoblockchain.duckdns.org
- **API Base:** https://ltoblockchain.duckdns.org/api
- **Health Check:** https://ltoblockchain.duckdns.org/api/health

---

## Prevention & Best Practices

### 1. Certificate Management

**DO:**
- Always regenerate wallet when crypto materials change
- Ensure organization-level admincerts are set up
- Use complete reset scripts for major changes
- Verify certificate trust chain consistency

**DON'T:**
- Mix old and new certificates
- Skip wallet regeneration after crypto changes
- Forget organization-level admincerts setup

### 2. Channel Creation

**DO:**
- Ensure genesis block includes correct organization MSP
- Verify admincerts exist at organization level before generating artifacts
- Use correct profile (`Channel` for channel.tx, `Genesis` for genesis.block)

**DON'T:**
- Create channels with mismatched MSP configurations
- Skip organization-level admincerts setup

### 3. Chaincode Deployment

**DO:**
- Deploy chaincode after channel is created and peer has joined
- Verify chaincode is committed before using it
- Keep chaincode package IDs for reference

**DON'T:**
- Deploy chaincode before channel is ready
- Skip commit step after approval

### 4. Database Migrations

**DO:**
- Run migrations before starting application
- Verify migrations completed successfully
- Check for missing tables in application logs

**DON'T:**
- Start application with missing required tables
- Skip migration verification

---

## Troubleshooting Guide

### Issue: Channel Creation Fails with Policy Error

**Symptoms:**
```
policy for [Group] /Channel/Application not satisfied
```

**Solution:**
1. Verify organization-level admincerts exist:
   ```bash
   ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/admincerts/
   ```
2. Regenerate genesis block and channel.tx
3. Restart orderer with fresh genesis block

### Issue: Application Can't Connect to Fabric

**Symptoms:**
- 502 Bad Gateway errors
- Fabric initialization hangs

**Solution:**
1. Verify wallet exists and has correct admin identity
2. Check Fabric containers are running: `docker ps | grep -E "orderer|peer"`
3. Verify channel exists: `docker exec cli peer channel list`
4. Check application logs for connection errors

### Issue: Database Schema Validation Fails

**Symptoms:**
```
❌ CRITICAL: Required table 'refresh_tokens' does not exist
```

**Solution:**
1. Run missing migrations:
   ```bash
   docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql
   docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
   ```
2. Verify tables exist:
   ```bash
   docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt"
   ```
3. Restart application

---

## Scripts Reference

### Complete Reset Script

**Location:** `scripts/complete-fabric-reset.sh`

**Usage:**
```bash
bash scripts/complete-fabric-reset.sh
```

**What it does:**
1. Stops all containers and cleans volumes
2. Removes old crypto materials and artifacts
3. Generates fresh crypto materials
4. Sets up admincerts at all levels
5. Generates genesis block and channel transaction
6. Starts containers
7. Creates channel
8. Joins peer to channel
9. Regenerates wallet

**Note:** Does not include chaincode deployment - run separately if needed.

---

## Related Documentation

- `scripts/unified-setup.sh` - Original setup script (reference)
- `DATABASE_BLACKLIST_DEPLOYMENT.md` - Database migration details
- `FABRIC-INTEGRATION-GUIDE.md` - Fabric integration overview
- `TROUBLESHOOTING.md` - General troubleshooting guide

---

## Conclusion

The complete Fabric network reset successfully resolved all certificate trust chain issues. The application is now fully operational with:

- ✅ Consistent certificate chain across all components
- ✅ Properly configured organization MSP with admincerts
- ✅ Successfully created and joined channel
- ✅ Deployed and committed chaincode
- ✅ Regenerated wallet with matching certificates
- ✅ Complete database schema with all required tables

**The 502 Bad Gateway errors are resolved, and the system is production-ready.**

---

**Last Updated:** January 17, 2026  
**Status:** ✅ Complete  
**Next Review:** After any major Fabric network changes
