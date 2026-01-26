# Manual Fix Guide: escc Error and DNS Resolution

**Date:** 2026-01-25  
**Purpose:** Step-by-step manual commands to fix escc plugin error and DNS resolution issues

---

## 📋 **Step-by-Step Manual Fix**

### **Step 1: Verify core.yaml Exists**

```bash
cd ~/LTOBLOCKCHAIN

# Check if core.yaml exists
ls -la fabric-network/config/core.yaml

# If it doesn't exist, create it:
mkdir -p fabric-network/config
cat > fabric-network/config/core.yaml << 'EOF'
chaincode:
  mode: dev

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation

discovery:
  enabled: true
  authCacheEnabled: true
  authCacheMaxSize: 1000
  authCachePurgeRetentionRatio: 0.75
  orgMembersAllowedAccess: false

metrics:
  provider: disabled
EOF
```

### **Step 2: Verify core.yaml Content**

```bash
# Check handlers section exists
grep -A 6 "^handlers:" fabric-network/config/core.yaml

# Should show:
# handlers:
#   endorsers:
#     escc:
#       name: DefaultEndorsement
#   validators:
#     vscc:
#       name: DefaultValidation
```

### **Step 3: Verify File is Accessible in Container**

```bash
# Check if file exists in container
docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml && echo "✓ File exists" || echo "✗ File missing"

# Check handlers in container
docker exec peer0.lto.gov.ph grep -A 6 "^handlers:" /var/hyperledger/fabric/config/core.yaml
```

### **Step 4: Restart Peer (Full Stop + Start)**

```bash
# Stop peer completely
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph

# Wait a few seconds
sleep 5

# Start peer
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
```

### **Step 5: Wait for Peer to Start**

```bash
# Initial wait (20 seconds)
sleep 20

# Check if peer is running
docker ps --filter "name=peer0.lto.gov.ph"

# Check peer logs for "Deployed system chaincodes" message
docker logs peer0.lto.gov.ph --tail=50 | grep -i "Deployed system chaincodes"

# If you don't see it, wait more and check again
sleep 10
docker logs peer0.lto.gov.ph --tail=50 | grep -i "Deployed system chaincodes"
```

**Keep checking until you see "Deployed system chaincodes" (up to 120 seconds total)**

### **Step 6: Check for Errors**

```bash
# Check peer logs for errors
docker logs peer0.lto.gov.ph --tail=50 | grep -i "error\|fatal\|panic"

# Check peer container status
docker ps --filter "name=peer0.lto.gov.ph" --format "table {{.Names}}\t{{.Status}}"
```

### **Step 7: Wait for DNS Registration**

```bash
# Additional wait for DNS (10 seconds)
sleep 10

# Test DNS resolution from CLI container
docker exec cli nslookup peer0.lto.gov.ph

# Should show IP address, not "can't find" or "no such host"
```

**If DNS fails, get peer IP and use it instead:**

```bash
# Get peer IP address
PEER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' peer0.lto.gov.ph)
echo "Peer IP: $PEER_IP"
```

### **Step 8: Test Chaincode Query**

**If DNS works (use hostname):**
```bash
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
"
```

**If DNS doesn't work (use IP address):**
```bash
# First get the IP
PEER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' peer0.lto.gov.ph)

# Then query using IP
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=$PEER_IP:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
"
```

### **Step 9: Check Query Result**

**If query succeeds:**
- ✅ escc error is fixed
- ✅ DNS is working (or IP fallback worked)
- Proceed to Step 10

**If query fails with escc error:**
```bash
# Check core.yaml in container
docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml | grep -A 6 "^handlers:"

# Check peer logs
docker logs peer0.lto.gov.ph --tail=100 | grep -i "escc\|handlers"

# Verify volume mount
docker inspect peer0.lto.gov.ph | grep -A 10 "fabric-network/config"
```

**If query fails with DNS error:**
```bash
# Check peer is actually running
docker ps | grep peer0

# Check peer logs for startup completion
docker logs peer0.lto.gov.ph --tail=100 | grep -i "Deployed system chaincodes"

# Wait longer and try again
sleep 20
# Then retry query
```

### **Step 10: Restart Backend**

```bash
# Restart backend to reconnect to Fabric
docker-compose -f docker-compose.unified.yml restart lto-app

# Wait for backend to start
sleep 15

# Check backend logs
docker logs lto-app --tail=50 | grep -i "fabric\|blockchain\|connected"
```

---

## 🔍 **Diagnostic Commands**

### **Check Peer Status**
```bash
# Is peer running?
docker ps --filter "name=peer0.lto.gov.ph"

# Peer logs (last 50 lines)
docker logs peer0.lto.gov.ph --tail=50

# Peer errors only
docker logs peer0.lto.gov.ph --tail=100 | grep -i "error\|fatal\|panic"
```

### **Check Network**
```bash
# Are both containers on same network?
docker inspect cli | grep -A 5 '"Networks"'
docker inspect peer0.lto.gov.ph | grep -A 5 '"Networks"'

# Both should show "trustchain"
```

### **Check DNS**
```bash
# Test DNS resolution
docker exec cli nslookup peer0.lto.gov.ph

# Test ping
docker exec cli ping -c 2 peer0.lto.gov.ph
```

### **Check Peer Port**
```bash
# Is peer listening on port 7051?
docker exec peer0.lto.gov.ph netstat -tlnp | grep 7051
```

---

## ⚠️ **Common Issues and Fixes**

### **Issue 1: core.yaml Missing**
```bash
# Create it (see Step 1)
mkdir -p fabric-network/config
cat > fabric-network/config/core.yaml << 'EOF'
# ... (content from Step 1)
EOF
```

### **Issue 2: Handlers Section Missing**
```bash
# Check if it exists
grep "^handlers:" fabric-network/config/core.yaml

# If missing, add it (see Step 1 for full content)
```

### **Issue 3: Peer Not Starting**
```bash
# Check peer logs
docker logs peer0.lto.gov.ph --tail=100

# Check dependencies
docker ps | grep -E "couchdb|orderer"

# Restart peer
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph
```

### **Issue 4: DNS Not Resolving**
```bash
# Wait longer (peer might still be starting)
sleep 30

# Check peer is ready
docker logs peer0.lto.gov.ph --tail=50 | grep -i "Deployed system chaincodes"

# Use IP address instead (see Step 8)
```

### **Issue 5: Query Still Fails**
```bash
# Check what error you're getting
# - escc error? → Check core.yaml handlers section
# - DNS error? → Wait longer or use IP
# - Connection error? → Check peer is running and listening on 7051
# - Channel error? → Check channel exists: docker exec cli peer channel list
```

---

## 📋 **Quick Reference Checklist**

- [ ] core.yaml exists in `fabric-network/config/`
- [ ] core.yaml has `handlers` section with `DefaultEndorsement`
- [ ] core.yaml is accessible in container at `/var/hyperledger/fabric/config/core.yaml`
- [ ] Peer container is running (`docker ps | grep peer0`)
- [ ] Peer logs show "Deployed system chaincodes"
- [ ] DNS resolves (`nslookup peer0.lto.gov.ph` works)
- [ ] Chaincode query succeeds (no escc error)
- [ ] Backend restarted and connected to Fabric

---

## 🎯 **Expected Timeline**

```
0s    → Stop peer
5s    → Start peer
25s   → Initial wait (20s)
25-65s → Check for "Deployed system chaincodes" (may take 40s)
75s   → DNS should be registered
75s   → Test query
90s   → Restart backend
105s  → Done
```

**Total time: ~2 minutes**

---

**Note:** If any step fails, check the diagnostic commands above to identify the issue.
