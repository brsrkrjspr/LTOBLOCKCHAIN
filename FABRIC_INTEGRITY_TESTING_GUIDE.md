
# Hyperledger Fabric CLI Installation & Integrity Testing Guide

**Date:** 2026-01-25  
**Purpose:** Install Fabric CLI tools and test application-level integrity  
**Fabric Version:** 2.5.0  
**Environment:** Ubuntu with Docker CE

---

## 🔧 **STEP 1: Install Fabric CLI Tools**

### **Installation Commands (Docker CE Compatible)**

```bash
# 1. Install prerequisites (skip docker.io, use Docker CE)
sudo apt update
sudo apt install -y curl git

# 2. Install docker-compose standalone (if not using docker compose V2)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Verify Docker is running
sudo systemctl start docker
sudo systemctl enable docker
sudo docker ps  # Should work

# 4. Download Fabric samples, binaries, and Docker images
cd ~
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.2

# 5. Add Fabric binaries to PATH (for current session)
export PATH=$PATH:~/fabric-samples/bin

# 6. Make PATH permanent (add to .bashrc)
echo 'export PATH=$PATH:~/fabric-samples/bin' >> ~/.bashrc

# 7. Verify installation
which peer
peer version
which configtxgen
configtxgen --version
```

**Expected Output:**
```
peer:
 Version: 2.5.0
 Commit SHA: [hash]
 Go version: go1.20.x
 OS/Arch: linux/amd64
```

---

## 🧪 **STEP 2: Integrity Testing Setup**

### **Prerequisites for Testing**

1. **Ensure Fabric network is running:**
```bash
cd ~/LTOBLOCKCHAIN
docker-compose -f docker-compose.fabric.yml up -d
# OR if using unified compose
docker-compose -f docker-compose.unified.yml up -d
```

2. **Verify network is up:**
```bash
docker ps | grep fabric
# Should see: peer, orderer, ca, cli containers
```

3. **Environment variables (already set in CLI container):**
```bash
# If testing from INSIDE the CLI container (recommended):
docker exec -it cli bash

# ✅ GOOD NEWS: Environment variables are ALREADY SET in docker-compose.yml!
# You can verify with:
env | grep CORE_PEER

# You should see:
# CORE_PEER_LOCALMSPID=LTOMSP
# CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
# CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp

# ⚠️ Only set these manually if:
# - Testing from HOST machine (not CLI container) with peer CLI installed
# - Need to switch to a different peer/org for testing
# - Environment variables got unset somehow

# Example: Switch to different peer (if testing multi-org)
export CORE_PEER_ADDRESS=peer0.insurance.com:7051
export CORE_PEER_LOCALMSPID=InsuranceMSP
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.com/users/Admin@insurance.com/msp
```

---

## 🔒 **STEP 3: Application-Level Integrity Tests**

### **Test 1: Attempt to Overwrite Existing Record**

**Goal:** Ensure chaincode prevents unauthorized overwrites of immutable fields.

**Test Vehicle Registration Overwrite:**
```bash
# From CLI container or with proper env vars set
# Try to register a vehicle that already exists
peer chaincode invoke \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"RegisterVehicle","Args":["EXISTING_VIN","{\"make\":\"Toyota\",\"model\":\"Camry\",\"year\":2020}","{\"email\":\"test@example.com\"}"]}'

# Expected Result: Should fail with error like:
# "Vehicle with VIN EXISTING_VIN already exists"
# OR "Error: Vehicle already registered"
```

**Test Ownership Transfer Overwrite:**
```bash
# Try to change VIN of existing vehicle (immutable field)
peer chaincode invoke \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"UpdateVehicle","Args":["VIN123","{\"vin\":\"DIFFERENT_VIN\"}"]}'

# Expected Result: Should reject if chaincode validates VIN immutability
```

**Test Previous Owner Overwrite:**
```bash
# Try to modify pastOwners array directly (should be immutable)
# This would require chaincode modification attempt
# Expected: Chaincode should not expose function to modify pastOwners
```

---

### **Test 2: Bypass Endorsement Policies**

**Goal:** Ensure only transactions endorsed by required organizations are accepted.

**Check Current Endorsement Policy:**
```bash
# Query chaincode definition to see endorsement policy
peer lifecycle chaincode querycommitted \
  -C ltochannel \
  -n vehicle-registration

# Look for: Endorsement Plugin: escc, Endorsement Policy: ...
```

**Test with Single Org Endorsement (if policy requires multiple):**
```bash
# If policy requires AND('LTOMSP.member','Org2.member')
# Try submitting with only LTOMSP endorsement

# Set to single org
export CORE_PEER_LOCALMSPID=LTOMSP

# Submit transaction (should fail if policy requires multiple orgs)
peer chaincode invoke \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"RegisterVehicle","Args":["TEST_VIN","{}","{}"]}'

# Expected Result: 
# Error: endorsement policy failure
# OR: proposal response was not successful
```

**Monitor Logs:**
```bash
# Check peer logs for endorsement failures
docker logs peer0.lto.example.com 2>&1 | grep -i "endorsement\|policy"

# Check orderer logs
docker logs orderer.example.com 2>&1 | grep -i "endorsement\|policy"
```

---

### **Test 3: Submit Transaction with Invalid Signature**

**Goal:** Ensure Fabric rejects transactions with tampered signatures.

**Method 1: Use Invalid Certificate:**
```bash
# Set invalid MSP config path
export CORE_PEER_MSPCONFIGPATH=/invalid/path

# Try to invoke chaincode
peer chaincode invoke \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetVehicle","Args":["VIN123"]}'

# Expected Result:
# Error: failed to get signer: [error message]
# OR: proposal failed with status: 500
```

**Method 2: Tamper with Transaction (Advanced):**
```bash
# This requires SDK manipulation or custom script
# Basic test: Submit with wrong MSP ID
export CORE_PEER_LOCALMSPID=UNAUTHORIZED_ORG

peer chaincode invoke \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetVehicle","Args":["VIN123"]}'

# Expected Result: Signature validation failure
```

**Monitor Signature Validation:**
```bash
# Check peer logs for signature errors
docker logs peer0.lto.example.com 2>&1 | grep -i "signature\|certificate\|msp"

# Check for MVCC_READ_CONFLICT (indicates validation)
docker logs peer0.lto.example.com 2>&1 | grep -i "mvcc\|conflict"
```

---

### **Test 4: Verify No Unauthorized Changes**

**After each test, verify ledger state:**

```bash
# Query vehicle to ensure no changes were made
peer chaincode query \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetVehicle","Args":["VIN123"]}'

# Query ownership history
peer chaincode query \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetOwnershipHistory","Args":["VIN123"]}'

# Query all vehicles (if function exists)
peer chaincode query \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetAllVehicles","Args":[]}'
```

---

## 📊 **STEP 4: Monitor Test Results**

### **Check Peer Logs:**
```bash
# Real-time monitoring
docker logs -f peer0.lto.example.com

# Look for:
# - Endorsement policy failures
# - Signature validation errors
# - MVCC_READ_CONFLICT
# - Chaincode errors
```

### **Check Orderer Logs:**
```bash
docker logs -f orderer.example.com

# Look for:
# - Transaction rejection messages
# - Block creation failures
# - Validation errors
```

### **Check Chaincode Logs:**
```bash
# If chaincode runs in separate container
docker logs -f <chaincode-container-name>

# Look for:
# - Custom error messages from chaincode
# - Validation logic execution
# - State access attempts
```

---

## ✅ **Expected Test Results Summary**

| Test | Expected Behavior | Success Indicator |
|------|------------------|-------------------|
| **Overwrite Existing Record** | Transaction rejected | Error: "already exists" or "immutable" |
| **Bypass Endorsement Policy** | Transaction rejected | Error: "endorsement policy failure" |
| **Invalid Signature** | Transaction rejected | Error: "signature invalid" or "certificate error" |
| **Verify No Changes** | Ledger unchanged | Query returns original data |

---

## 🔍 **Advanced Testing: Using SDK**

If you want to test programmatically:

**File:** `scripts/test-fabric-integrity.js`

```javascript
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function testIntegrity() {
    const gateway = new Gateway();
    
    try {
        // Load connection profile
        const ccpPath = path.resolve(__dirname, '../network-config.yaml');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        
        // Connect to gateway
        await gateway.connect(ccp, {
            wallet: await Wallets.newFileSystemWallet('../wallet'),
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: true }
        });
        
        const network = await gateway.getNetwork('ltochannel');
        const contract = network.getContract('vehicle-registration');
        
        // Test 1: Try to overwrite existing vehicle
        try {
            await contract.submitTransaction('RegisterVehicle', 
                'EXISTING_VIN', 
                JSON.stringify({make: 'Toyota'}),
                JSON.stringify({email: 'test@example.com'})
            );
            console.log('❌ FAILED: Overwrite was allowed');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✅ PASSED: Overwrite prevented');
            }
        }
        
        // Test 2: Query to verify no changes
        const vehicle = await contract.evaluateTransaction('GetVehicle', 'EXISTING_VIN');
        console.log('Vehicle data:', vehicle.toString());
        
    } finally {
        gateway.disconnect();
    }
}

testIntegrity();
```

---

## 🚨 **Troubleshooting**

### **Issue: "peer: command not found"**
```bash
# Ensure PATH is set
export PATH=$PATH:~/fabric-samples/bin
which peer

# If still not found, reinstall Fabric binaries
cd ~
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.2
```

### **Issue: "Cannot connect to peer"**
```bash
# Check if containers are running
docker ps

# Check network connectivity
docker network ls
docker network inspect <network-name>

# Verify peer is listening
docker logs peer0.lto.example.com | grep -i "listening\|started"
```

### **Issue: "Endorsement policy failure"**
```bash
# This is EXPECTED if testing bypass - it means policy is working!
# Check what the actual policy requires:
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration
```

---

## 📝 **Test Checklist**

- [ ] Fabric CLI tools installed (`peer`, `configtxgen` available)
- [ ] Docker containers running (peer, orderer, ca, cli)
- [ ] Channel created and chaincode installed
- [ ] Test 1: Overwrite attempt fails
- [ ] Test 2: Endorsement bypass fails
- [ ] Test 3: Invalid signature rejected
- [ ] Test 4: Ledger state unchanged after failed attempts
- [ ] Logs show appropriate error messages
- [ ] Chaincode validation logic working correctly

---

## 🎯 **Next Steps**

After completing integrity tests:

1. Document test results
2. Verify chaincode validation logic
3. Review endorsement policies
4. Test with actual application workflows
5. Monitor production for similar attempts
