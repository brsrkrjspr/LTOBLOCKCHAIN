# Handlers Configuration Analysis: Why DefaultEndorsement Isn't Working

**Date:** 2026-01-26  
**Status:** Configuration correct, but handlers not being used  
**Error:** `plugin with name escc wasn't found`

---

## ✅ **What We've Verified**

### 1. **Configuration Structure is Correct**
- ✅ `handlers` section exists in `core.yaml`
- ✅ Structure matches official Fabric 2.5 documentation:
  ```yaml
  handlers:
    endorsers:
      escc:
        name: DefaultEndorsement
    validators:
      vscc:
        name: DefaultValidation
  ```
- ✅ No empty `library:` fields (known issue from Stack Overflow)
- ✅ `chaincode.mode: dev` is set
- ✅ `chaincode.system.escc: enable` is **removed** (as per fix)
- ✅ File is accessible in container at `/var/hyperledger/fabric/config/core.yaml`

### 2. **Config is Being Read**
- ✅ Peer logs show `handlers:` in config dump
- ✅ YAML structure is correct (verified via `cat` command)
- ✅ Config file exists and is mounted correctly

### 3. **Chaincode Definition**
- ✅ Chaincode definition does NOT override `escc` (verified via `peer lifecycle chaincode querycommitted`)
- ✅ No custom endorsement policy that would conflict

---

## ❌ **What's NOT Working**

### 1. **Handlers Not Being Used**
Despite correct configuration:
- ❌ Error persists: `plugin with name escc wasn't found`
- ❌ No handler initialization messages in peer logs
- ❌ Fabric is still looking for external plugin files instead of using `DefaultEndorsement`

### 2. **Missing Handler Registration**
Peer logs show:
- ✅ Config is read (`handlers:` appears)
- ❌ **No handler registration/initialization messages**
- ❌ **No "DefaultEndorsement initialized" or similar messages**

---

## 🔍 **Possible Root Causes**

### **Hypothesis 1: Handler Registration Timing Issue**
**Theory:** Handlers need to be registered before chaincode lifecycle system initializes, but there's a race condition.

**Evidence:**
- Handlers config is read
- But handlers aren't registered/initialized
- Error occurs when chaincode is queried

**Test:**
- Check peer startup logs for handler initialization sequence
- Look for any errors during handler registration

### **Hypothesis 2: Fabric 2.5 Dev Mode Handler Bug**
**Theory:** There's a bug in Fabric 2.5 where handlers configured correctly aren't actually used in dev mode.

**Evidence:**
- Configuration matches documentation exactly
- But handlers still aren't working
- No known bug reports found (but may exist)

**Test:**
- Try switching to `mode: net` (but this would require external plugins)
- Check Fabric GitHub issues for similar problems

### **Hypothesis 3: Handler Name Mismatch**
**Theory:** `DefaultEndorsement` name doesn't match what Fabric expects internally.

**Evidence:**
- Documentation says `DefaultEndorsement` is correct
- But maybe internal name is different

**Test:**
- Check Fabric source code for actual handler names
- Try alternative names like `DefaultESCC` or `BuiltinEndorsement`

### **Hypothesis 4: Missing Handler Library Registration**
**Theory:** The `HandlerLibrary` construct isn't properly registering `DefaultEndorsement` at runtime.

**Evidence:**
- Config is read
- But handler isn't found when needed
- Suggests runtime registration issue

**Test:**
- Check if there's a way to explicitly register handlers
- Look for handler registration code in peer startup

---

## 📋 **Next Diagnostic Steps**

### **Step 1: Check Handler Initialization Sequence**
```bash
# Get full peer startup logs
docker logs peer0.lto.gov.ph 2>&1 | head -500 > peer-startup.log

# Search for handler-related messages
grep -i "handler\|endorsement\|DefaultEndorsement\|library\|register" peer-startup.log
```

### **Step 2: Check Fabric Version**
```bash
docker exec peer0.lto.gov.ph peer version
```

### **Step 3: Try Alternative Handler Name**
Based on Stack Overflow examples, try:
```yaml
handlers:
  endorsers:
    escc:
      name: DefaultESCC  # Instead of DefaultEndorsement
```

### **Step 4: Check if Handlers Need Explicit Enable**
Maybe handlers need to be explicitly enabled:
```yaml
chaincode:
  handlers:
    enabled: true  # If this option exists
```

### **Step 5: Check Fabric GitHub Issues**
Search for:
- "Fabric 2.5 handlers not working"
- "DefaultEndorsement not found"
- "escc plugin wasn't found handlers configured"

---

## 🛠️ **Potential Workarounds**

### **Option 1: Use System Chaincode Mode**
If handlers truly don't work, we might need to:
- Keep `chaincode.system.escc: enable`
- But ensure system chaincode is properly deployed
- This contradicts our current fix, but might be necessary

### **Option 2: Compile Custom Handler Plugin**
If built-in handlers don't work:
- Create a minimal Go plugin that wraps `DefaultEndorsement`
- Compile it as `.so` file
- Point `library` to the plugin file

### **Option 3: Downgrade Fabric Version**
If this is a Fabric 2.5 bug:
- Try Fabric 2.4 or 2.3
- Check if handlers work in those versions

---

## 📝 **Current Configuration**

**File:** `fabric-network/config/core.yaml`

**Relevant Sections:**
```yaml
chaincode:
  mode: dev
  system:
    cscc: enable
    lscc: enable
    qscc: enable
    # escc and vscc removed

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
```

**Docker Compose:**
- `FABRIC_CFG_PATH=/var/hyperledger/fabric/config`
- Volume mount: `./fabric-network/config:/var/hyperledger/fabric/config:ro`

---

## 🎯 **Immediate Action Items**

1. ✅ **DONE:** Verify config structure
2. ✅ **DONE:** Check chaincode definition
3. ⏳ **TODO:** Check handler initialization in peer logs
4. ⏳ **TODO:** Try alternative handler names
5. ⏳ **TODO:** Search Fabric GitHub issues
6. ⏳ **TODO:** Check if there's a handler enable flag

---

## 📚 **References**

- [Official Fabric 2.5 Handlers Documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/pluggable_endorsement_and_validation.html)
- [Stack Overflow: ESCC Plugin Error](https://stackoverflow.com/questions/72195530/error-endorsement-failure-during-invoke-response-status500-messageendorsin)
- HandlerLibrary: `core/handlers/library/library.go`

---

**Conclusion:** Configuration is correct per documentation, but handlers aren't being used. This suggests either a timing/initialization issue, a Fabric 2.5 bug, or a missing configuration step not documented.
