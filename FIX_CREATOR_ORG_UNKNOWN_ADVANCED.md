# Critical Fix: "Creator Org Unknown" Error

## The Problem Persists

Even after fixing admincerts, you're still seeing:
```
Error: access denied: channel [ltochannel] creator org unknown, creator is malformed
```

## Root Cause

The peer container may be:
1. **Using cached MSP data** - Restart doesn't always reload MSP
2. **Channel configuration mismatch** - Channel was created before MSP was fully fixed
3. **MSP mount issue** - Changes on host not reflected in container

## Complete Fix (Try This)

### Option 1: Recreate Peer Container (Recommended)

```bash
# Stop and remove peer
docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
docker compose -f docker-compose.unified.yml rm -f peer0.lto.gov.ph

# Verify admincerts exist on host
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts/
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/admincerts/

# Recreate peer
docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Wait for peer to start
sleep 20

# Test
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

### Option 2: Recreate Channel (If Option 1 Doesn't Work)

The channel might have been created with incomplete MSP configuration. Recreate it:

```bash
# 1. Stop peer
docker compose -f docker-compose.unified.yml stop peer0.lto.gov.ph

# 2. Remove channel data from peer volume
docker volume rm peer-data 2>/dev/null || true

# 3. Ensure admincerts are fixed (run fix script again)
bash scripts/fix-creator-org-unknown.sh

# 4. Recreate peer
docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
sleep 20

# 5. Recreate channel
bash scripts/setup-fabric-channel.sh

# 6. Test
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

### Option 3: Use CLI Container (Bypass Peer MSP Issue)

The CLI container has its own MSP configuration. Try using it:

```bash
# Check if CLI container exists
docker ps | grep cli

# If not, start it
docker compose -f docker-compose.unified.yml up -d cli

# Use CLI to query chaincode
docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

## Verify MSP Structure

Check that admincerts exist at all levels:

```bash
echo "=== Host MSP Structure ==="
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/admincerts/
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts/
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/admincerts/

echo ""
echo "=== Container MSP Structure ==="
docker exec peer0.lto.gov.ph ls -la /etc/hyperledger/fabric/msp/admincerts/ 2>&1 || echo "MSP not mounted correctly"
```

**Expected:** All should show `.pem` files

## If Nothing Works

**Nuclear option - Complete reset again:**

```bash
# This will reset everything fresh
bash scripts/reset-fabric-blockchain.sh
# Type: RESET
# Type: YES (for PostgreSQL reset)

# Then immediately after reset completes, run:
bash scripts/fix-creator-org-unknown.sh
```

This ensures channel is created AFTER MSP is fully configured.
