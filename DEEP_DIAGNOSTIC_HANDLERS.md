# Deep Diagnostic: Why Handlers Aren't Working

**Date:** 2026-01-26  
**Issue:** escc error persists despite correct configuration  
**Status:** Configuration verified correct, but error persists

---

## 🔍 **Current State**

### **Configuration (Verified Correct):**
```yaml
chaincode:
  system:
    cscc: enable
    lscc: enable
    qscc: enable
    # escc/vscc removed ✅

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement  ✅
  validators:
    vscc:
      name: DefaultValidation  ✅
```

### **Error Still Occurs:**
```
Error: endorsement failure during query. response: status:500 
message:"endorsing with plugin failed: plugin with name escc could not be used: 
plugin with name escc wasn't found"
```

---

## 🔍 **Deep Diagnostic Commands**

Run these to investigate further:

```bash
# 1. Check if handlers are actually being initialized
echo "=== Handler initialization in peer logs ==="
docker logs peer0.lto.gov.ph 2>&1 | grep -i "handler\|endorsement\|DefaultEndorsement" | head -30

# 2. Check peer startup sequence for handler registration
echo ""
echo "=== Peer startup sequence (first 150 lines) ==="
docker logs peer0.lto.gov.ph 2>&1 | head -150 | grep -E "handler|endorsement|plugin|chaincode|config"

# 3. Check if there are any errors during handler loading
echo ""
echo "=== Errors during startup ==="
docker logs peer0.lto.gov.ph 2>&1 | grep -i "error\|warn\|fail" | head -20

# 4. Verify the exact config structure in container
echo ""
echo "=== Exact handlers section in container (with line numbers) ==="
docker exec peer0.lto.gov.ph cat -n /var/hyperledger/fabric/config/core.yaml | grep -A 10 "^.*handlers:"

# 5. Check YAML parsing
echo ""
echo "=== YAML syntax check ==="
docker exec peer0.lto.gov.ph python3 -c "
import yaml, sys
try:
    with open('/var/hyperledger/fabric/config/core.yaml', 'r') as f:
        config = yaml.safe_load(f)
    if 'handlers' in config:
        print('✓ handlers section found in parsed YAML')
        print('Handlers structure:', config['handlers'])
    else:
        print('✗ handlers section NOT found in parsed YAML')
except Exception as e:
    print('✗ YAML parsing error:', e)
" 2>&1

# 6. Check if there's a chaincode definition specifying escc differently
echo ""
echo "=== Chaincode definition (if accessible) ==="
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration 2>&1 | grep -i 'endorsement\|escc' || echo 'No escc info in chaincode definition'
"
```

---

## 🎯 **Possible Root Causes**

1. **Handlers not initialized** - Config loaded but handlers not registered
2. **Handler name mismatch** - `DefaultEndorsement` not recognized
3. **Initialization order** - Handlers need to be registered before first query
4. **Chaincode definition override** - Chaincode might specify escc differently
5. **Fabric 2.5 dev mode issue** - Known issue with handlers in dev mode

---

## 📋 **Next Steps**

Run the diagnostic commands above and share the output. This will help identify:
- Whether handlers are being initialized
- If there are any errors during handler registration
- If the YAML is being parsed correctly
- If chaincode definition is overriding handlers
