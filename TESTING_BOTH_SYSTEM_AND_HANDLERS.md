# Testing Both System Chaincodes AND Handlers

**Date:** 2026-01-26  
**Hypothesis:** According to official documentation, `chaincode.system.escc: enable` and `handlers.endorsers.escc.name: DefaultEndorsement` can coexist and serve different purposes.

---

## 🔍 **Why We're Trying This**

From the official Fabric 2.5 documentation:
> "These serve different purposes and can coexist. There is no documented conflict."

**What we removed:**
- `chaincode.system.escc: enable`
- `chaincode.system.vscc: enable`

**What we kept:**
- `handlers.endorsers.escc.name: DefaultEndorsement`
- `handlers.validators.vscc.name: DefaultValidation`

**The Problem:**
- Handlers are configured but NOT being initialized/registered
- System chaincodes `escc`/`vscc` are NOT being deployed
- When transaction comes in, Fabric can't find either

**The Solution:**
- Add back `escc: enable` and `vscc: enable` in `chaincode.system`
- Keep handlers configuration
- See if having BOTH resolves the issue

---

## 📋 **What Changed**

**File:** `scripts/final-fix-create-minimal-core-yaml.sh`

**Before:**
```yaml
chaincode:
  system:
    cscc: enable
    lscc: enable
    qscc: enable
    # escc and vscc removed
```

**After:**
```yaml
chaincode:
  system:
    cscc: enable
    lscc: enable
    qscc: enable
    escc: enable  # ← Added back
    vscc: enable  # ← Added back
```

**Handlers remain:**
```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
```

---

## 🧪 **Testing Steps**

1. **Run the updated script:**
   ```bash
   bash scripts/final-fix-create-minimal-core-yaml.sh
   ```

2. **Check if system chaincodes are deployed:**
   ```bash
   docker logs peer0.lto.gov.ph 2>&1 | grep -i "Deployed system chaincodes"
   # Should show: lscc, cscc, qscc, escc, vscc
   ```

3. **Test chaincode query:**
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

---

## 📚 **Documentation Reference**

From `OFFICIAL_DOCS_HANDLERS_ANALYSIS.md`:
> **Official documentation states:**
> - `chaincode.system.escc: enable` - Enables the system chaincode
> - `handlers.endorsers.escc.name: DefaultEndorsement` - Specifies handler implementation
> 
> **These serve different purposes and can coexist.** There is no documented conflict.

---

## ✅ **Expected Outcome**

If this works:
- ✅ System chaincodes `escc`/`vscc` will be deployed
- ✅ Handlers will be configured (even if not used)
- ✅ Chaincode queries should work
- ✅ No more "plugin with name escc wasn't found" error

If this doesn't work:
- We'll need to investigate why handlers aren't being initialized
- May need to check Fabric 2.5.0 specific issues
- May need to try alternative handler names
