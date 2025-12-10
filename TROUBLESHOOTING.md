# TrustChain LTO - Troubleshooting Documentation

This document chronicles all errors encountered during development and deployment, along with their solutions.

## Deployment Environment
- **Platform:** GitHub Codespace
- **Hyperledger Fabric:** v2.5
- **Configuration:** Single orderer (simplified for development)
- **Last Updated:** December 10, 2025

---

## Table of Contents
1. [Orderer Container Panic](#issue-1-orderer-container-panic)
2. [Missing nslookup in CLI](#issue-2-missing-nslookup-in-cli-container)
3. [No Endpoints Currently Defined](#issue-3-no-endpoints-currently-defined-error)
4. [Chaincode Container Exited with 0](#issue-4-chaincode-container-exited-with-0)
5. [Chaincode Stream Terminated](#issue-5-chaincode-stream-terminated-error)
6. [Database Column ipfs_cid Missing](#issue-6-database-column-ipfs_cid-does-not-exist)
7. [Duplicate Plate Number Constraint](#issue-7-duplicate-plate-number-constraint-violation)
8. [Transaction ID Too Long](#issue-8-transaction-id-too-long-for-database-column)
9. [Network Configuration Mismatch](#issue-9-network-configuration-mismatch)
10. [Crypto Materials Not Persisted](#issue-10-crypto-materials-not-persisted-to-github)
11. [Genesis Block Mounting Error](#issue-11-genesis-block-mounting-error-docker-volume-cache)
12. [Root network-config.json Mismatch](#issue-12-root-network-configjson-mismatch)
13. [Missing signcerts Directory](#issue-13-missing-signcerts-directory)

---

## Issue #1: Orderer Container Panic

### Symptoms
```
go.uber.org/zap...Panicf at main.go:130
```
Orderer containers crashed on startup.

### Root Cause
Genesis block was generated with different cryptographic materials than the orderers were using. The `crypto-config.yaml` was incomplete, missing organization definitions.

### Solution
1. Updated `crypto-config.yaml` to include all organizations
2. Removed all Docker volumes to clear stale data
3. Regenerated cryptographic materials and genesis block in Codespace
4. Ensured consistency between generated certificates and genesis block

### Commands
```bash
# Remove all volumes
docker-compose -f docker-compose.unified.yml down -v

# Regenerate crypto materials
docker run --rm -v $(pwd):/workspace hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/workspace/config/crypto-config.yaml \
    --output=/workspace/fabric-network/crypto-config

# Regenerate genesis block
docker run --rm -v $(pwd):/workspace -e FABRIC_CFG_PATH=/workspace/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel \
    -outputBlock /workspace/fabric-network/channel-artifacts/genesis.block
```

---

## Issue #2: Missing nslookup in CLI Container

### Symptoms
```
nslookup: command not found
```

### Root Cause
The `hyperledger/fabric-tools:2.5` image doesn't include `dnsutils` by default.

### Solution
Modified `docker-compose.fabric.yml` CLI service command:
```yaml
command: /bin/bash -c "apt-get update && apt-get install -y dnsutils && /bin/bash"
```

### Note
This was a diagnostic issue only; not required for normal operation.

---

## Issue #3: "No Endpoints Currently Defined" Error

### Symptoms
```
WARN [peer.blocksprovider] DeliverBlocks -> Could not connect to ordering service: 
could not get orderer endpoints: no endpoints currently defined channel=ltochannel
```
Peer could not discover orderer endpoints after joining channel.

### Root Cause
**Critical missing configuration:** `OrdererEndpoints` was not defined at the organization level in `configtx.yaml`. This is **required since Fabric v1.4.2**.

### Solution
Added `OrdererEndpoints` to the `OrdererOrg` organization in `config/configtx.yaml`:

```yaml
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: ../fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/msp
    # CRITICAL: Required since Fabric v1.4.2
    OrdererEndpoints:
      - orderer.lto.gov.ph:7050
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Writers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Admins:
        Type: Signature
        Rule: "OR('OrdererMSP.admin')"
```

Then regenerated genesis block and channel transaction.

### Reference
- [Hyperledger Fabric Upgrade Documentation](https://hyperledger-fabric.readthedocs.io/en/latest/upgrade.html)
- Required for peer service discovery to locate orderers

---

## Issue #4: Chaincode "Container Exited with 0"

### Symptoms
```
error in simulation: failed to execute transaction: could not launch chaincode 
vehicle-registration_1.0: chaincode registration failed: container exited with 0
```
Chaincode container started but immediately exited.

### Root Cause
Incorrect start script in `chaincode/vehicle-registration-production/package.json`:
```json
"start": "node index.js"  // WRONG
```

For Fabric 2.x Node.js chaincode, the `fabric-chaincode-node` binary must be used.

### Solution
Changed `package.json`:
```json
"start": "fabric-chaincode-node start"  // CORRECT
```

### Reference
- [Official Fabric Node.js chaincode documentation](https://hyperledger.github.io/fabric-chaincode-node/)
- `fabric-chaincode-node` starts the gRPC server required for peer communication

---

## Issue #5: Chaincode Stream Terminated Error

### Symptoms
```
Chat stream with peer - on error: "Error: 13 INTERNAL: Request message 
serialization failure: Failure: Cannot coerce to Uint8Array: object"
```
Chaincode executed successfully but crashed when emitting events.

### Root Cause
`ctx.stub.setEvent()` requires the payload to be `Buffer` or `Uint8Array`, not a plain JavaScript object.

**Wrong:**
```javascript
ctx.stub.setEvent('VehicleRegistered', { vin: vehicle.vin, ... });
```

### Solution
Wrapped all event payloads in `Buffer.from(JSON.stringify(...))`:

```javascript
ctx.stub.setEvent('VehicleRegistered', Buffer.from(JSON.stringify({
    vin: vehicle.vin,
    plateNumber: vehicle.plateNumber,
    owner: vehicle.owner.email,
    timestamp: timestamp,
    transactionId: txId
})));
```

Fixed 8 occurrences in `chaincode/vehicle-registration-production/index.js`:
- VehicleRegistered
- VehicleUpdated
- OwnershipTransferred
- StatusChanged
- DocumentAdded

### Reference
- `fabric-shim` TypeScript definition: `setEvent(name: string, payload: Uint8Array): void`
- [Hyperledger Fabric chaincode events documentation](https://hyperledger-fabric.readthedocs.io/en/latest/chaincode4ade.html)

---

## Issue #6: Database Column "ipfs_cid" Does Not Exist

### Symptoms
```
error: column "ipfs_cid" of relation "documents" does not exist
```
Documents uploaded to IPFS but couldn't be saved to database.

### Root Cause
Database schema (`database/init-laptop.sql`) was missing the `ipfs_cid` column, but the application code expected it.

### Solution
Added the column to the running database:
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
```

### Permanent Fix
Update `database/init-laptop.sql` to include the column:
```sql
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id),
    document_type VARCHAR(50) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),
    ipfs_cid VARCHAR(255),  -- ADD THIS LINE
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Issue #7: Duplicate Plate Number Constraint Violation

### Symptoms
```
error: duplicate key value violates unique constraint "vehicles_plate_number_key"
Key (plate_number)=(WEZ-5678) already exists.
```

### Root Cause
Test data from previous failed registration attempts remained in the database.

### Solution
This is expected behavior (data validation working correctly). Either:
1. Use a different plate number, or
2. Delete the existing record:
```sql
DELETE FROM vehicles WHERE plate_number = 'WEZ-5678';
```

### Note
This confirms the unique constraint is working properly.

---

## Issue #8: Transaction ID Too Long for Database Column

### Symptoms
```
error: value too long for type character varying(100)
```

### Root Cause
The `vehicle_history.transaction_id` column was `VARCHAR(100)`, but Fabric transaction IDs are 64-character hex strings that can exceed this when combined with other data.

### Solution
Increased column size:
```sql
ALTER TABLE vehicle_history ALTER COLUMN transaction_id TYPE VARCHAR(255);
```

---

## Issue #9: Network Configuration Mismatch

### Symptoms
```
ENOENT: no such file or directory, open 'fabric-network/crypto-config/ordererOrganizations/
lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/ca.crt'
```
Application couldn't find orderer certificates.

### Root Cause
Two conflicting `network-config.json` files:
- Root file referenced 3 orderers (orderer1, orderer2, orderer3)
- `config/network-config.json` correctly referenced single orderer (orderer.lto.gov.ph)

### Solution
Copied the correct config:
```bash
cp config/network-config.json network-config.json
```

---

## Quick Reference: Deployment Checklist

After resolving all issues, a successful deployment requires:

| Requirement | Status |
|-------------|--------|
| `OrdererEndpoints` in `configtx.yaml` | ✅ |
| `fabric-chaincode-node start` in chaincode `package.json` | ✅ |
| `Buffer.from(JSON.stringify(...))` for all `setEvent()` calls | ✅ |
| `ipfs_cid` column in `documents` table | ✅ |
| Correct `network-config.json` matching actual orderer names | ✅ |
| Sufficient column sizes for transaction IDs | ✅ |

---

## Final Working Configuration

| Component | Version/Config |
|-----------|----------------|
| Hyperledger Fabric | 2.5 |
| Orderer | Single (`orderer.lto.gov.ph`) |
| Chaincode | v1.2, Sequence 3 |
| Channel | `ltochannel` |
| MSP | `LTOMSP`, `OrdererMSP` |
| PostgreSQL | 15-alpine |
| IPFS | kubo:latest |
| Redis | 7-alpine |

---

## Useful Diagnostic Commands

### Check Container Status
```bash
docker ps -a
docker logs peer0.lto.gov.ph --tail 50
docker logs orderer.lto.gov.ph --tail 50
```

### Check Channel Status
```bash
docker exec cli peer channel list
docker exec cli peer channel getinfo -c ltochannel
```

### Check Chaincode Status
```bash
docker exec cli peer lifecycle chaincode queryinstalled
docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel
```

### Check Database
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT * FROM vehicles LIMIT 5;"
```

### Check IPFS
```bash
docker exec ipfs ipfs id
docker exec ipfs ipfs pin ls
```

---

## Issue #10: Crypto Materials Not Persisted to GitHub

### Symptoms
After Codespace restart:
```
❌ orderer.lto.gov.ph is NOT running
```
Or orderer container fails to start because crypto materials are from the old multi-orderer setup.

### Root Cause
Crypto materials were generated in Codespace (ephemeral) but **never committed to GitHub**. When Codespace restarts, it pulls from GitHub which has the OLD crypto materials with `orderer1/2/3.lto.gov.ph` instead of `orderer.lto.gov.ph`.

The configuration files (`crypto-config.yaml`, `configtx.yaml`) were updated but the **generated** crypto materials were not regenerated locally and pushed.

### Solution
Generate crypto materials **locally** (where Docker Desktop is available) and push to GitHub:

```bash
# On local machine with Docker Desktop running:

# 1. Remove old crypto
rm -rf fabric-network/crypto-config

# 2. Generate new crypto
docker run --rm -v ${PWD}:/workspace hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/workspace/config/crypto-config.yaml \
    --output=/workspace/fabric-network/crypto-config

# 3. Generate genesis block
docker run --rm -v ${PWD}:/workspace -e FABRIC_CFG_PATH=/workspace/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel \
    -outputBlock /workspace/fabric-network/channel-artifacts/genesis.block

# 4. Generate channel transaction
docker run --rm -v ${PWD}:/workspace -e FABRIC_CFG_PATH=/workspace/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -channelID ltochannel \
    -outputCreateChannelTx /workspace/fabric-network/channel-artifacts/channel.tx

# 5. Commit and push
git add fabric-network/
git commit -m "Regenerate crypto materials for single orderer"
git push origin main
```

Then in Codespace:
```bash
sudo rm -rf fabric-network/crypto-config  # Remove root-owned files
git pull origin main
bash scripts/codespace-restart.sh
```

---

## Issue #11: Genesis Block Mounting Error (Docker Volume Cache)

### Symptoms
```
error mounting "genesis.block" to rootfs at "/var/hyperledger/orderer/orderer.genesis.block": 
mount src=.../genesis.block, dst=...: not a directory
```

### Root Cause
Docker previously created `genesis.block` as a **directory** (because the file didn't exist when the container first started). When you later try to mount a file, Docker sees a directory conflict.

### Solution
Clean up Docker volumes and restart:

```bash
# In Codespace:

# Stop all containers and remove volumes
docker-compose -f docker-compose.unified.yml down -v

# Remove any orphan containers
docker rm -f $(docker ps -aq) 2>/dev/null || true

# Prune Docker system
docker system prune -f

# Restart
bash scripts/codespace-restart.sh
```

### Prevention
The restart script should check if containers need a full cleanup before starting.

---

## Issue #12: Root network-config.json Mismatch

### Symptoms
```
ENOENT: no such file or directory, open 'fabric-network/crypto-config/ordererOrganizations/
lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/ca.crt'
```

### Root Cause
Two `network-config.json` files existed:
- `config/network-config.json` - Correct (single orderer)
- `network-config.json` (root) - Wrong (referenced old orderer1/2/3)

The application reads from the **root** file.

### Solution
Copy the correct config:
```bash
cp config/network-config.json network-config.json
```

Or ensure they stay synchronized.

---

## Issue #13: Missing signcerts Directory

### Symptoms
```
PANI [orderer.common.server] loadLocalMSP -> Failed to get local msp config: 
could not load a valid signer certificate from directory /var/hyperledger/orderer/msp/signcerts: 
stat /var/hyperledger/orderer/msp/signcerts: no such file or directory
```

### Root Cause
The `signcerts` directory in the orderer's MSP was not included when crypto materials were committed to GitHub. This can happen when:
1. The `cryptogen` command was interrupted
2. Files were selectively committed
3. Git ignored certain files

### Solution
Regenerate crypto materials completely and ensure all files are committed:

```bash
# Locally (with Docker Desktop running):
docker run --rm -v ${PWD}:/workspace hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/workspace/config/crypto-config.yaml \
    --output=/workspace/fabric-network/crypto-config

# Verify signcerts exists
ls fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/signcerts/

# Regenerate artifacts
docker run --rm -v ${PWD}:/workspace -e FABRIC_CFG_PATH=/workspace/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel \
    -outputBlock /workspace/fabric-network/channel-artifacts/genesis.block

docker run --rm -v ${PWD}:/workspace -e FABRIC_CFG_PATH=/workspace/config \
    hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -channelID ltochannel \
    -outputCreateChannelTx /workspace/fabric-network/channel-artifacts/channel.tx

# Commit all files
git add fabric-network/
git commit -m "Regenerate crypto materials with complete signcerts"
git push origin main
```

### Expected MSP Structure
```
orderer.lto.gov.ph/msp/
├── admincerts/
│   └── Admin@lto.gov.ph-cert.pem
├── cacerts/
│   └── ca.lto.gov.ph-cert.pem
├── keystore/
│   └── priv_sk
├── signcerts/                    ← REQUIRED
│   └── orderer.lto.gov.ph-cert.pem
└── tlscacerts/
    └── tlsca.lto.gov.ph-cert.pem
```

---

## Contact & Resources

- **Hyperledger Fabric Docs:** https://hyperledger-fabric.readthedocs.io/
- **Fabric Samples:** https://github.com/hyperledger/fabric-samples
- **Node.js Chaincode:** https://hyperledger.github.io/fabric-chaincode-node/

