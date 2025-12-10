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

## Contact & Resources

- **Hyperledger Fabric Docs:** https://hyperledger-fabric.readthedocs.io/
- **Fabric Samples:** https://github.com/hyperledger/fabric-samples
- **Node.js Chaincode:** https://hyperledger.github.io/fabric-chaincode-node/

