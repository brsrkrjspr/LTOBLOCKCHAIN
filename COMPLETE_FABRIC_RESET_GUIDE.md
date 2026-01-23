# Complete Fabric Reset & Reconfiguration Script

## Overview

`scripts/complete-fabric-reset-reconfigure.sh` is a comprehensive script that resets and reconfigures all Fabric components for your DigitalOcean Docker environment. It ensures everything is properly configured for your current codebase with **strict real Fabric only** (no fallbacks).

## What It Does

The script performs these steps in the correct order:

### 0. Validates .env Configuration
- Checks for required variables: `BLOCKCHAIN_MODE=fabric`, `JWT_SECRET`, `STORAGE_MODE`
- Ensures `FABRIC_AS_LOCALHOST=false` is set (critical for Docker)
- Exits early if configuration is invalid

### 1. Stops and Removes Fabric Containers
- Stops: peer, orderer, couchdb, cli, lto-app
- Removes containers to ensure clean restart

### 2. Removes Fabric Volumes
- Clears all blockchain data (peer-data, orderer-data, couchdb-data)
- Removes local data directories if they exist

### 3. Regenerates Certificates
- Backs up old certificates
- Generates fresh crypto materials

### 4. Fixes MSP admincerts (CRITICAL)
- **Fixes admincerts BEFORE containers start** (key learning!)
- Sets admincerts at:
  - User level (`Admin@lto.gov.ph/msp/admincerts`)
  - Peer level (`peer0.lto.gov.ph/msp/admincerts`)
  - Organization level (`lto.gov.ph/msp/admincerts`) - **CRITICAL**
- Fixes orderer TLS CA for clustering

### 5. Regenerates Channel Artifacts
- Backs up old artifacts
- Generates fresh channel transaction files

### 6. Starts Fabric Containers
- Starts orderer and couchdb first
- Waits for orderer to be ready ("Beginning to serve requests")
- Starts peer container

### 7. Creates Channel
- Copies channel transaction to peer
- Copies orderer TLS CA certificate
- Creates channel `ltochannel` with proper TLS
- Joins peer to channel
- Verifies channel exists

### 8. Updates Anchor Peer
- Updates anchor peer configuration (if anchor transaction exists)

### 9. Deploys Chaincode
- Copies chaincode to peer container
- Packages chaincode
- Installs chaincode
- Approves chaincode
- Commits chaincode
- Verifies deployment

### 10. Regenerates Wallet
- Removes old wallet
- Creates new wallet with admin identity
- Falls back to manual wallet creation if Node.js script fails

### 11. Verifies Network Configuration
- Checks that `network-config.json` exists

### 12. Restarts Application
- Restarts `lto-app` container
- Waits for application to start

### 13. Final Verification
- Checks containers are running
- Verifies channel exists
- Verifies chaincode is deployed
- Checks wallet is configured
- Checks application logs for Fabric connection

## Usage

```bash
# On your DigitalOcean server
cd ~/LTOBLOCKCHAIN
bash scripts/complete-fabric-reset-reconfigure.sh
```

## Prerequisites

1. **.env file** with required variables:
   ```env
   BLOCKCHAIN_MODE=fabric
   JWT_SECRET=your-secret-key-here
   STORAGE_MODE=ipfs
   FABRIC_AS_LOCALHOST=false
   ```

2. **Required scripts**:
   - `scripts/generate-crypto.sh`
   - `scripts/generate-channel-artifacts.sh`
   - `scripts/setup-fabric-wallet.js` (optional, has fallback)

3. **Required directories**:
   - `chaincode/vehicle-registration-production/`
   - `fabric-network/` (will be created/regenerated)

4. **Required files**:
   - `network-config.json` (must exist in project root)
   - `docker-compose.unified.yml`

## Key Features

### ✅ Proper Order of Operations
- MSP admincerts fixed **BEFORE** containers start
- Channel created **AFTER** MSP is properly configured
- Wallet regenerated **AFTER** certificates are ready

### ✅ DigitalOcean Optimized
- Sets `FABRIC_AS_LOCALHOST=false` automatically
- Uses Docker service names (not localhost)
- Proper resource allocation for 8GB RAM droplet

### ✅ Error Handling
- Validates prerequisites before starting
- Checks each step for success
- Provides clear error messages
- Exits early on critical failures

### ✅ Verification
- Verifies each major step
- Final comprehensive check at the end
- Clear success/failure indicators

## Expected Output

```
╔══════════════════════════════════════════════════════════════╗
║  Complete Fabric Reset & Reconfiguration                   ║
║  DigitalOcean Docker Environment - Real Fabric Only        ║
╚══════════════════════════════════════════════════════════════╝

0️⃣  Validating .env configuration...
✅ .env configuration validated

1️⃣  Stopping Fabric containers...
...

✅ Fabric network reset and reconfigured
✅ MSP admincerts fixed at all levels
✅ Channel created: ltochannel
✅ Chaincode deployed: vehicle-registration
✅ Wallet regenerated
```

## Troubleshooting

### If script fails at MSP step:
- Check that certificates were generated correctly
- Verify `fabric-network/crypto-config/` exists

### If channel creation fails:
- Check orderer logs: `docker logs orderer.lto.gov.ph`
- Ensure orderer is ready: `docker logs orderer.lto.gov.ph | grep "Beginning to serve requests"`

### If chaincode deployment fails:
- Verify chaincode directory exists: `ls -la chaincode/vehicle-registration-production/`
- Check peer logs: `docker logs peer0.lto.gov.ph`

### If application can't connect:
- Check `.env` has `FABRIC_AS_LOCALHOST=false`
- Verify wallet exists: `ls -la wallet/admin/`
- Check application logs: `docker logs lto-app --tail 50`

## What Makes This Different

1. **Single Script**: Everything in one place - no need to run multiple scripts
2. **Proper Order**: MSP fixed BEFORE channel creation (prevents "creator org unknown" errors)
3. **Complete Reset**: Cleans volumes, regenerates everything fresh
4. **DigitalOcean Ready**: Configured for Docker environment, not localhost
5. **Real Fabric Only**: No fallbacks, strict Fabric mode enforcement
6. **Comprehensive**: Handles everything from certificates to application restart

## After Running

1. **Check application logs**:
   ```bash
   docker logs lto-app --tail 50 | grep -i fabric
   ```

2. **Verify Fabric connection**:
   ```bash
   docker exec lto-app curl -s http://localhost:3001/api/blockchain/status
   ```

3. **Test vehicle registration** via API or UI

## Notes

- **TLS errors in orderer logs are harmless** - these are expected warnings for single-node Raft clusters
- **Script takes ~5-10 minutes** to complete (depends on system resources)
- **All blockchain data is deleted** - this is a complete reset
- **PostgreSQL data is NOT touched** - only Fabric blockchain data is reset
