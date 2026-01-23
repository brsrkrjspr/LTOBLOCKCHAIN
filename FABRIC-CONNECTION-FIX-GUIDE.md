# 🔧 Fabric Connection Fix Guide
## Based on Network Diagnostics

**Status:** Network connectivity is ✅ GOOD, but Fabric connection fails  
**Root Cause:** Likely missing channel/chaincode setup or certificate issues

---

## ✅ What We Know Works

1. **Network Connectivity:** ✅
   - DNS resolution works (`peer0.lto.gov.ph` → `172.18.0.6`)
   - Ports are open (`7051`, `7050`)
   - All containers on `trustchain` network

2. **Docker Configuration:** ✅
   - Certificates mounted: `./fabric-network/crypto-config:/app/fabric-network/crypto-config:ro`
   - `network-config.json` mounted
   - Wallet mounted
   - `FABRIC_AS_LOCALHOST=false` (correct for Docker)

---

## 🔍 Diagnostic Steps (Run on SSH Server)

### Step 1: Check if Certificates Exist

```bash
cd ~/LTOBLOCKCHAIN
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt
```

**If missing:** Certificates need to be generated.

### Step 2: Check if Channel Exists

```bash
docker exec peer0.lto.gov.ph peer channel list
```

**Expected:** Should show `ltochannel`  
**If empty:** Channel needs to be created.

### Step 3: Check if Chaincode is Deployed

```bash
docker exec peer0.lto.gov.ph peer chaincode list --installed
docker exec peer0.lto.gov.ph peer chaincode list --instantiated -C ltochannel
```

**Expected:** Should show `vehicle-registration` chaincode  
**If missing:** Chaincode needs to be deployed.

### Step 4: Check Wallet

```bash
ls -la ~/LTOBLOCKCHAIN/wallet/admin
```

**Expected:** Should show admin identity files  
**If missing:** Admin needs to be enrolled.

### Step 5: Run Diagnostic Script Inside Container

```bash
docker exec lto-app bash /app/scripts/diagnose-fabric-connection.sh
```

Or copy the script and run it:
```bash
docker cp scripts/diagnose-fabric-connection.sh lto-app:/tmp/
docker exec lto-app bash /tmp/diagnose-fabric-connection.sh
```

---

## 🔧 Most Likely Fixes

### Fix 1: Channel Not Created

If channel doesn't exist, create it:

```bash
# Create channel (run from host or inside cli container)
docker exec cli peer channel create -o orderer.lto.gov.ph:7050 \
  -c ltochannel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt

# Join peer to channel
docker exec cli peer channel join -b ltochannel.block --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt
```

### Fix 2: Chaincode Not Deployed

If chaincode isn't deployed:

```bash
# Install chaincode
docker exec cli peer chaincode install -n vehicle-registration -v 1.0.2 \
  -p /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt

# Instantiate chaincode (if not already instantiated)
docker exec cli peer chaincode instantiate -o orderer.lto.gov.ph:7050 \
  -C ltochannel \
  -n vehicle-registration \
  -v 1.0.2 \
  -c '{"Args":[]}' \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt \
  --peerAddresses peer0.lto.gov.ph:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
```

### Fix 3: Certificates Missing

If certificates don't exist, they need to be generated. Check if you have a script:

```bash
ls -la scripts/generate-crypto.sh
# Or check fabric-network directory structure
ls -la fabric-network/
```

### Fix 4: Wallet Not Set Up

If wallet is empty, enroll admin:

```bash
# Check if enrollment script exists
ls -la scripts/enroll-admin.js

# Or manually enroll (if CA is running)
# This depends on your CA setup
```

---

## 🚨 Quick Test: Check Peer Logs

```bash
docker logs peer0.lto.gov.ph 2>&1 | grep -i "error\|channel\|chaincode" | tail -20
```

Look for:
- Channel join errors
- Chaincode installation errors
- TLS errors

---

## 📋 Complete Setup Checklist

Run these commands to verify everything:

```bash
# 1. Certificates exist
[ -f fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt ] && echo "✅ Peer cert" || echo "❌ Peer cert missing"
[ -f fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt ] && echo "✅ Orderer cert" || echo "❌ Orderer cert missing"

# 2. Channel exists
docker exec peer0.lto.gov.ph peer channel list 2>&1 | grep -q ltochannel && echo "✅ Channel exists" || echo "❌ Channel missing"

# 3. Chaincode deployed
docker exec peer0.lto.gov.ph peer chaincode list --instantiated -C ltochannel 2>&1 | grep -q vehicle-registration && echo "✅ Chaincode deployed" || echo "❌ Chaincode missing"

# 4. Wallet has admin
[ -d wallet/admin ] && echo "✅ Wallet has admin" || echo "❌ Wallet missing admin"
```

---

## 🎯 Next Steps

1. **Run diagnostic script** inside `lto-app` container
2. **Check channel/chaincode status** using commands above
3. **Fix missing components** based on diagnostic results
4. **Restart lto-app** after fixes: `docker compose -f docker-compose.unified.yml restart lto-app`

---

**Last Updated:** January 23, 2026
