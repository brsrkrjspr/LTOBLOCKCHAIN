# Next Steps After Reset - Complete Guide

## ✅ Current Status

- ✅ Fabric reset complete
- ✅ PostgreSQL reset complete  
- ✅ Channel `ltochannel` exists and working (8 blocks)
- ⏳ Chaincode deployment status: **Need to verify**

---

## Step 1: Check Chaincode Status

Run this command (fix the syntax error - remove extra text):

```bash
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

**Expected Results:**

### ✅ If Chaincode is Deployed:
```
Committed chaincode definition for chaincode 'vehicle-registration' on channel 'ltochannel':
Version: 1.0, Sequence: 1, Endorsement Plugin: escc, Validation Plugin: vscc
```

**→ Skip to Step 3 (Restart Application)**

### ❌ If No Chaincode Found:
```
No chaincode definitions found
```

**→ Continue to Step 2 (Deploy Chaincode)**

---

## Step 2: Deploy Chaincode (If Not Already Deployed)

The reset script should have deployed chaincode automatically, but if it didn't complete, run:

### Option A: Let Reset Script Complete (Recommended)

Check if the reset script is still running or if it completed. If it stopped at chaincode deployment, you can:

1. **Check reset script logs** - Look for "Step 16: Deploying chaincode"
2. **If it failed**, manually deploy using Option B below

### Option B: Manual Chaincode Deployment

```bash
# 1. Copy chaincode to peer
docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/

# 2. Copy orderer TLS CA (needed for approval/commit)
docker cp fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt \
  peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt

# 3. Package chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode package vehicle-registration.tar.gz \
  --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
  --lang node \
  --label vehicle-registration_1.0

# 4. Install chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode install vehicle-registration.tar.gz

# 5. Wait for installation
sleep 15

# 6. Get package ID
PACKAGE_ID=$(docker exec peer0.lto.gov.ph peer lifecycle chaincode queryinstalled 2>&1 | \
  grep "vehicle-registration_1.0:" | \
  sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

echo "Package ID: $PACKAGE_ID"

# 7. Approve chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode approveformyorg \
  -o orderer.lto.gov.ph:7050 \
  --channelID ltochannel \
  --name vehicle-registration \
  --version 1.0 \
  --package-id "$PACKAGE_ID" \
  --sequence 1 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt

# 8. Commit chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode commit \
  -o orderer.lto.gov.ph:7050 \
  --channelID ltochannel \
  --name vehicle-registration \
  --version 1.0 \
  --sequence 1 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt \
  --peerAddresses peer0.lto.gov.ph:7051 \
  --tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt

# 9. Verify deployment
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

**Expected Output:**
```
Committed chaincode definition for chaincode 'vehicle-registration' on channel 'ltochannel'
```

---

## Step 3: Restart Application

```bash
docker compose -f docker-compose.unified.yml restart lto-app
```

**Wait 10-15 seconds**, then check logs:

```bash
docker logs lto-app --tail 50 | grep -i "fabric\|chaincode\|connected"
```

**Look for:**
- ✅ `Connected to Hyperledger Fabric network successfully`
- ✅ `Chaincode vehicle-registration ready`
- ❌ `Failed to connect` or `chaincode not found` → Check Step 2

---

## Step 4: Verify System is Ready

### Check Application Status
```bash
docker ps | grep lto-app
# Should show: Up (not Restarting)
```

### Check Fabric Connection
```bash
docker logs lto-app --tail 20
# Should show successful Fabric connection
```

### Test Vehicle Registration (Optional)
1. Open your application in browser
2. Login as admin or vehicle owner
3. Try registering a test vehicle
4. Check if transaction succeeds

---

## Step 5: Final Verification

Run this comprehensive check:

```bash
echo "=== Fabric Status ==="
docker exec peer0.lto.gov.ph peer channel list
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel

echo ""
echo "=== Application Status ==="
docker ps | grep -E "lto-app|postgres|peer|orderer"

echo ""
echo "=== Application Logs ==="
docker logs lto-app --tail 10
```

---

## Troubleshooting

### Issue: Chaincode deployment fails with TLS errors
**Solution:** The TLS errors are harmless warnings. Chaincode deployment should still work. If it fails, check:
- Orderer is running: `docker ps | grep orderer`
- Channel exists: `docker exec peer0.lto.gov.ph peer channel list`

### Issue: Application can't connect to Fabric
**Solution:**
1. Check wallet exists: `ls -la wallet/`
2. Check network config: `ls -la network-config.json`
3. Restart application: `docker compose -f docker-compose.unified.yml restart lto-app`

### Issue: Application keeps restarting
**Solution:**
1. Check logs: `docker logs lto-app --tail 50`
2. Check memory: `docker stats lto-app`
3. May need to increase memory limit in `docker-compose.unified.yml`

---

## Quick Reference Commands

```bash
# Check chaincode
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel

# Check channel
docker exec peer0.lto.gov.ph peer channel list

# Check application
docker logs lto-app --tail 20

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# Check all containers
docker ps
```

---

## Summary

**What you've accomplished:**
- ✅ Complete system reset (Fabric + PostgreSQL)
- ✅ Fresh certificates and channel
- ✅ Clean slate for testing

**What's next:**
1. Verify chaincode deployment
2. Deploy if missing
3. Restart application
4. Test vehicle registration

**You're almost done!** 🎉
