# Next Steps After Installing Fabric CLI Tools

**Date:** 2026-01-25  
**After:** Step 1 - Fabric CLI Tools Installation  
**Purpose:** Set up and verify Fabric network before integrity testing

---

## ✅ **STEP 2: Verify Fabric Network Status**

### **2.1 Check if Fabric Network is Running**

```bash
# Check if Docker containers are running
cd ~/LTOBLOCKCHAIN
docker ps

# Should see containers like:
# - peer0.lto.gov.ph
# - orderer1.lto.gov.ph (or orderer.lto.gov.ph)
# - ca.lto.gov.ph
# - cli
```

**If containers are NOT running:**
```bash
# Start Fabric network
docker-compose -f docker-compose.fabric.yml up -d
# OR
docker-compose -f docker-compose.unified.yml up -d

# Wait for containers to start (30-60 seconds)
sleep 30
docker ps
```

---

### **2.2 Verify Channel Exists**

```bash
# Enter CLI container
docker exec -it cli bash

# Inside CLI container, check if channel exists
peer channel list

# Expected output:
# Channels peers has joined:
# ltochannel
```

**If channel doesn't exist, you need to create it first** (see Step 3 below).

---

### **2.3 Verify Chaincode is Installed**

```bash
# Still inside CLI container, check chaincode
peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration

# Expected output should show:
# Committed chaincode definition for chaincode 'vehicle-registration' on channel 'ltochannel'
# Version: 1.0
# Sequence: 1
# Endorsement Plugin: escc
# ...
```

**If chaincode is NOT installed**, you need to deploy it (see Step 4 below).

---

## 🔧 **STEP 3: Create Channel (If Needed)**

**Only do this if channel doesn't exist:**

```bash
# Enter CLI container
docker exec -it cli bash

# Create channel
peer channel create \
    -o orderer.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Join peer to channel
peer channel join -b ltochannel.block

# Verify channel joined
peer channel list
```

**Note:** If channel artifacts don't exist, you may need to generate them first using `configtxgen`.

---

## 📦 **STEP 4: Install Chaincode (If Needed)**

**Only do this if chaincode is NOT installed:**

```bash
# Enter CLI container
docker exec -it cli bash

# Package chaincode
peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

# Install chaincode
peer lifecycle chaincode install vehicle-registration.tar.gz

# Get package ID
peer lifecycle chaincode queryinstalled

# Copy the Package ID from output (looks like: vehicle-registration_1.0:abc123...)
# Then approve (replace PACKAGE_ID with actual ID):
peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id PACKAGE_ID \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Commit chaincode
peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Verify chaincode is committed
peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration
```

**Alternative:** Use your existing deployment script:
```bash
# From host machine
cd ~/LTOBLOCKCHAIN
./scripts/redeploy-chaincode.sh
```

---

## ✅ **STEP 5: Quick Test - Verify Everything Works**

**Before running integrity tests, verify basic functionality:**

```bash
# Enter CLI container
docker exec -it cli bash

# Test 1: Query chaincode (should work even if no vehicles exist)
peer chaincode query \
    -C ltochannel \
    -n vehicle-registration \
    -c '{"function":"GetAllVehicles","Args":[]}'

# Expected: Should return empty array [] or list of vehicles

# Test 2: Check chaincode info
peer lifecycle chaincode querycommitted \
    -C ltochannel \
    -n vehicle-registration

# Expected: Should show chaincode definition details
```

**If these work, you're ready for integrity testing!**

---

## 🧪 **STEP 6: Prepare for Integrity Testing**

### **6.1 Get a Test Vehicle VIN**

You'll need an existing vehicle on the ledger for testing. If none exists:

```bash
# Register a test vehicle first (from your application or CLI)
# This will be used for integrity tests

# Example: Register via application API or chaincode
# Then note the VIN for testing
```

### **6.2 Note Your Configuration**

**Important values for testing:**
- **Channel Name:** `ltochannel`
- **Chaincode Name:** `vehicle-registration`
- **Peer Address:** `peer0.lto.gov.ph:7051`
- **Orderer Address:** `orderer.lto.gov.ph:7050`
- **MSP ID:** `LTOMSP`

---

## 🎯 **STEP 7: Ready for Integrity Tests!**

Once Steps 2-6 are complete, you can proceed to **STEP 3** in `FABRIC_INTEGRITY_TESTING_GUIDE.md`:

1. ✅ Test 1: Attempt to Overwrite Existing Record
2. ✅ Test 2: Bypass Endorsement Policies  
3. ✅ Test 3: Submit Transaction with Invalid Signature
4. ✅ Test 4: Verify No Unauthorized Changes

---

## 🚨 **Quick Troubleshooting**

### **Issue: "Channel not found"**
```bash
# Check if channel artifacts exist
ls -la fabric-network/channel-artifacts/

# If missing, may need to generate them or use setup script
```

### **Issue: "Chaincode not found"**
```bash
# Check if chaincode directory exists
ls -la chaincode/vehicle-registration-production/

# Verify chaincode is installed
docker exec cli peer lifecycle chaincode queryinstalled
```

### **Issue: "Cannot connect to peer"**
```bash
# Check if peer container is running
docker ps | grep peer

# Check peer logs
docker logs peer0.lto.gov.ph | tail -20
```

---

## 📋 **Quick Checklist**

After Step 1 (Fabric CLI installation), verify:

- [ ] Docker containers running (`docker ps` shows peer, orderer, ca, cli)
- [ ] Channel exists (`peer channel list` shows `ltochannel`)
- [ ] Chaincode installed (`peer lifecycle chaincode querycommitted` works)
- [ ] Can query chaincode (`peer chaincode query` works)
- [ ] Have a test vehicle VIN (for overwrite tests)
- [ ] Know your channel name (`ltochannel`)
- [ ] Know your chaincode name (`vehicle-registration`)

**Once all checked, proceed to integrity testing!**
