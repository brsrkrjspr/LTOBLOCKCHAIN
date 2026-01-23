# Channel Creation Troubleshooting Guide

## Issue: Channel Creation Hangs

If the reset script stops at "Creating channel...", follow these steps:

## Quick Diagnosis

### 1. Check Container Status
```bash
docker ps | grep -E "orderer|peer"
```

**Expected:** Both `orderer.lto.gov.ph` and `peer0.lto.gov.ph` should be running.

### 2. Check Orderer Logs
```bash
docker logs orderer.lto.gov.ph --tail 50
```

**Look for:**
- ✅ `Beginning to serve requests` - Orderer is ready
- ✅ `Raft leader` - Orderer is ready
- ❌ `panic` or `fatal` - Orderer has crashed
- ❌ `certificate` errors - TLS certificate issues

### 3. Check Peer Logs
```bash
docker logs peer0.lto.gov.ph --tail 50
```

**Look for:**
- ✅ `Started peer` - Peer is ready
- ❌ `certificate signed by unknown authority` - TLS certificate mismatch
- ❌ `connection refused` - Cannot connect to orderer

### 4. Test Orderer Connectivity
```bash
# From peer container
docker exec peer0.lto.gov.ph nc -zv orderer.lto.gov.ph 7050
```

**Expected:** Connection successful

## Manual Channel Creation

If the script hangs, you can create the channel manually:

### Step 1: Ensure Orderer is Ready
```bash
# Wait until you see "Beginning to serve requests" in orderer logs
docker logs -f orderer.lto.gov.ph
# Press Ctrl+C when ready
```

### Step 2: Copy Required Files
```bash
# Copy channel transaction
docker cp fabric-network/channel-artifacts/channel.tx peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx

# Copy orderer TLS CA
docker cp fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt \
  peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt
```

### Step 3: Create Channel Manually
```bash
docker exec peer0.lto.gov.ph peer channel create \
  -o orderer.lto.gov.ph:7050 \
  -c ltochannel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt \
  --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
  --timeout 60s
```

### Step 4: Join Channel
```bash
docker exec peer0.lto.gov.ph peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt
```

### Step 5: Verify Channel
```bash
docker exec peer0.lto.gov.ph peer channel list
```

**Expected:** Should show `ltochannel`

## Common Issues and Fixes

### Issue 1: Orderer Not Ready
**Symptom:** Channel creation hangs indefinitely

**Fix:**
```bash
# Wait longer for orderer
docker logs -f orderer.lto.gov.ph
# Wait for "Beginning to serve requests"
```

### Issue 2: TLS Certificate Mismatch
**Symptom:** `certificate signed by unknown authority`

**Fix:**
```bash
# Verify orderer TLS CA exists
ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt

# Re-run TLS setup
bash scripts/setup-tls-certs.sh
```

### Issue 3: Network Connectivity
**Symptom:** `connection refused` or timeout

**Fix:**
```bash
# Check if containers are on same network
docker network inspect trustchain | grep -E "orderer|peer"

# Restart containers
docker compose -f docker-compose.unified.yml restart orderer.lto.gov.ph peer0.lto.gov.ph
```

### Issue 4: Channel Already Exists
**Symptom:** `channel already exists`

**Fix:**
```bash
# Remove old channel block
docker exec peer0.lto.gov.ph rm -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block

# Or fetch existing channel
docker exec peer0.lto.gov.ph peer channel fetch config /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block -c ltochannel
```

## Continue Reset Script After Manual Channel Creation

If you manually created the channel, you can continue with chaincode deployment:

```bash
# Continue from Step 16 (chaincode deployment)
# The script will detect the channel exists and continue
```

Or run chaincode deployment manually:
```bash
bash scripts/reset-fabric-blockchain.sh
# It will skip channel creation if channel already exists
```
