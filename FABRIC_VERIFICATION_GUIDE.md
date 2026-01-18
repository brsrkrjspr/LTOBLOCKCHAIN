# 🔍 Hyperledger Fabric Verification Guide

Complete guide to verify Fabric is properly running on your DigitalOcean deployment.

## Quick Verification Checklist

Run these commands via SSH to verify each component:

---

## 1. Check Fabric Containers Are Running

```bash
# Check all Fabric-related containers
docker compose -f docker-compose.unified.yml ps | grep -E "orderer|peer|couchdb|cli"

# Expected output should show:
# - orderer.lto.gov.ph: Up
# - peer0.lto.gov.ph: Up  
# - couchdb: Up (healthy)
# - cli: Up
```

**If containers are not running:**
```bash
docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph couchdb peer0.lto.gov.ph cli
```

---

## 2. Check Orderer Status

```bash
# Check orderer logs for errors
docker logs orderer.lto.gov.ph --tail 50 | grep -iE "error|fatal|panic"

# Check if orderer is listening on port 7050
docker exec orderer.lto.gov.ph netstat -tlnp | grep 7050 || echo "Orderer not listening"

# Expected: Should show port 7050 is listening
```

**If orderer has issues:**
```bash
# Restart orderer
docker compose -f docker-compose.unified.yml restart orderer.lto.gov.ph

# Check logs
docker logs orderer.lto.gov.ph --tail 100
```

---

## 3. Check CouchDB Status

```bash
# Check CouchDB health
docker exec couchdb curl -s http://localhost:5984/_up

# Expected output: {"status":"ok","seeds":{}}

# Check if CouchDB is accessible
curl -s http://localhost:5984/_up || echo "CouchDB not accessible from host"

# Check CouchDB logs
docker logs couchdb --tail 30 | grep -iE "error|fatal"
```

**If CouchDB is not healthy:**
```bash
# Restart CouchDB
docker compose -f docker-compose.unified.yml restart couchdb

# Wait 30 seconds, then check again
sleep 30
docker exec couchdb curl -s http://localhost:5984/_up
```

---

## 4. Check Peer Status

```bash
# Check peer node status
docker exec peer0.lto.gov.ph peer node status

# Expected output should show peer is running

# Check peer logs for errors
docker logs peer0.lto.gov.ph --tail 50 | grep -iE "error|fatal|panic"

# Check if peer is listening on port 7051
docker exec peer0.lto.gov.ph netstat -tlnp | grep 7051 || echo "Peer not listening"
```

**If peer has issues:**
```bash
# Restart peer
docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph

# Check logs
docker logs peer0.lto.gov.ph --tail 100
```

---

## 5. Verify Channel Exists and Peer is Joined

```bash
# Check if peer is joined to channel
docker exec cli peer channel list

# Expected output:
# Channels peers has joined: 
# ltochannel
```

**If channel doesn't exist or peer not joined:**

```bash
# Option 1: Use the setup script (recommended)
chmod +x scripts/setup-fabric-channel.sh
bash scripts/setup-fabric-channel.sh

# Option 2: Manual channel creation
# First, check if channel artifacts exist
ls -la fabric-network/channel-artifacts/

# Create channel (if not exists)
docker exec cli peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f ./channel-artifacts/channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Join peer to channel
docker exec cli peer channel join -b ltochannel.block

# Verify
docker exec cli peer channel list
```

---

## 6. Verify Chaincode is Installed and Instantiated

```bash
# Check installed chaincode
docker exec cli peer lifecycle chaincode queryinstalled

# Expected output should show:
# Installed chaincodes on peer:
# Package ID: vehicle-registration_1.0:xxxxx, Label: vehicle-registration_1.0

# Check instantiated chaincode
docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel

# Expected output should show chaincode is committed to channel
```

**If chaincode is not installed:**

```bash
# Install chaincode
chmod +x scripts/install-chaincode.sh
bash scripts/install-chaincode.sh

# Then instantiate
chmod +x scripts/instantiate-chaincode.sh
bash scripts/instantiate-chaincode.sh
```

---

## 7. Check Application Connection to Fabric

```bash
# Check application logs for Fabric connection
docker logs lto-app --tail 100 | grep -iE "fabric|blockchain|connected|disconnected"

# Look for:
# ✅ "Connected to Hyperledger Fabric network successfully"
# ❌ "Failed to connect to Fabric network"

# Check blockchain status via API
docker exec lto-app curl -s http://localhost:3001/api/blockchain/status | python3 -m json.tool || \
docker exec lto-app curl -s http://localhost:3001/api/blockchain/status

# Expected JSON response:
# {
#   "success": true,
#   "blockchain": {
#     "status": "CONNECTED",
#     "networkName": "...",
#     "channelName": "ltochannel",
#     ...
#   }
# }
```

**If application cannot connect:**

```bash
# Check network-config.json exists
docker exec lto-app ls -la /app/network-config.json

# Check wallet directory exists
docker exec lto-app ls -la /app/wallet/

# Check environment variables
docker exec lto-app env | grep -iE "BLOCKCHAIN|FABRIC"

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# Wait 30 seconds and check logs again
sleep 30
docker logs lto-app --tail 50 | grep -i fabric
```

---

## 8. Test Fabric Transaction (End-to-End Test)

```bash
# Test if you can invoke chaincode (if you have a test function)
# This verifies the entire chain: app -> peer -> chaincode -> ledger

# Check application health endpoint
curl -s http://localhost:3001/api/health | python3 -m json.tool || \
curl -s http://localhost:3001/api/health

# If you have a test endpoint that writes to blockchain:
# curl -X POST http://localhost:3001/api/blockchain/test
```

---

## Complete Verification Script

Run this all-in-one verification:

```bash
#!/bin/bash
echo "🔍 Hyperledger Fabric Verification"
echo "=================================="
echo ""

echo "1. Checking containers..."
docker compose -f docker-compose.unified.yml ps | grep -E "orderer|peer|couchdb|cli"
echo ""

echo "2. Checking orderer..."
docker logs orderer.lto.gov.ph --tail 5 | tail -1
echo ""

echo "3. Checking CouchDB..."
docker exec couchdb curl -s http://localhost:5984/_up || echo "❌ CouchDB not healthy"
echo ""

echo "4. Checking peer..."
docker exec peer0.lto.gov.ph peer node status 2>&1 | head -3
echo ""

echo "5. Checking channel..."
docker exec cli peer channel list 2>&1 | grep -q "ltochannel" && echo "✅ Channel exists" || echo "❌ Channel missing"
echo ""

echo "6. Checking chaincode..."
docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration" && echo "✅ Chaincode installed" || echo "❌ Chaincode not installed"
echo ""

echo "7. Checking application connection..."
docker logs lto-app --tail 20 | grep -iE "fabric.*connect|blockchain.*connect" | tail -1 || echo "⚠️  Check logs manually"
echo ""

echo "8. Testing API..."
docker exec lto-app curl -s http://localhost:3001/api/blockchain/status 2>&1 | head -5
echo ""

echo "=================================="
echo "Verification complete!"
```

Save this as `verify-fabric.sh`, make it executable, and run:
```bash
chmod +x verify-fabric.sh
./verify-fabric.sh
```

---

## Common Issues and Fixes

### Issue 1: Containers Not Starting
```bash
# Check logs
docker compose -f docker-compose.unified.yml logs orderer.lto.gov.ph
docker compose -f docker-compose.unified.yml logs peer0.lto.gov.ph

# Check if crypto-config exists
ls -la fabric-network/crypto-config/

# Restart all Fabric services
docker compose -f docker-compose.unified.yml restart orderer.lto.gov.ph couchdb peer0.lto.gov.ph
```

### Issue 2: Channel Creation Fails
```bash
# Check if channel artifacts exist
ls -la fabric-network/channel-artifacts/

# If missing, generate them
chmod +x scripts/generate-channel-artifacts.sh
bash scripts/generate-channel-artifacts.sh

# Then create channel again
bash scripts/setup-fabric-channel.sh
```

### Issue 3: Chaincode Not Working
```bash
# Check chaincode logs
docker logs peer0.lto.gov.ph | grep -i chaincode

# Reinstall chaincode
bash scripts/install-chaincode.sh
bash scripts/instantiate-chaincode.sh

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app
```

### Issue 4: Application Cannot Connect
```bash
# Verify network-config.json
docker exec lto-app cat /app/network-config.json | head -20

# Check wallet
docker exec lto-app ls -la /app/wallet/

# Check if peer is reachable from app container
docker exec lto-app ping -c 1 peer0.lto.gov.ph

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app
```

---

## Quick Status Check (One Command)

```bash
# Quick status of all Fabric components
echo "=== Fabric Status ===" && \
echo "Orderer:" && docker ps | grep orderer | awk '{print $1, $7}' && \
echo "Peer:" && docker ps | grep peer0 | awk '{print $1, $7}' && \
echo "CouchDB:" && docker ps | grep couchdb | awk '{print $1, $7}' && \
echo "Channel:" && docker exec cli peer channel list 2>&1 | grep -q "ltochannel" && echo "✅ Joined" || echo "❌ Not joined" && \
echo "Chaincode:" && docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration" && echo "✅ Installed" || echo "❌ Not installed"
```

---

**Last Updated:** Based on docker-compose.unified.yml configuration  
**Status:** Ready for production verification
