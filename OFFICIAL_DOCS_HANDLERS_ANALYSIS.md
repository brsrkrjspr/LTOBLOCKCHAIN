# Official Documentation Analysis: Handlers Configuration

**Date:** 2026-01-26  
**Source:** Official Hyperledger Fabric 2.5 Documentation  
**URL:** https://hyperledger-fabric.readthedocs.io/en/release-2.5/pluggable_endorsement_and_validation.html

---

## 📚 **Official Documentation Findings**

### **1. Required Handlers Configuration**

According to official Fabric 2.5 documentation, the `handlers` section should be:

```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
```

**Key Points:**
- For **built-in handlers** (like `DefaultEndorsement`), you **only need `name`**
- **Do NOT include `library` property** for built-in handlers
- The `name` property references an initialization function in `HandlerLibrary` construct (`core/handlers/library/library.go`)

### **2. When Library Property is Needed**

The `library` property is **ONLY** needed for custom Go plugins:

```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement  # Built-in - no library needed
    custom:
      name: customEndorsement
      library: /etc/hyperledger/fabric/plugins/customEndorsement.so  # Custom plugin - library required
```

### **3. No Conflict Between Settings**

**Official documentation states:**
- `chaincode.system.escc: enable` - Enables the system chaincode
- `handlers.endorsers.escc.name: DefaultEndorsement` - Specifies handler implementation

**These serve different purposes and can coexist.** There is no documented conflict.

### **4. Common Issue: Empty Library Fields**

**From Stack Overflow examples:**
- Having an **empty `library:` field** can cause Fabric to look for plugin files
- **Solution:** For built-in handlers, **omit the `library` property entirely**

**Incorrect:**
```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
      library:  # ← Empty field causes issues
```

**Correct:**
```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement  # ← No library property
```

---

## 🔍 **Current Configuration Analysis**

### **Your Current Config (from script):**

```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
```

**Status:** ✅ **Matches official documentation structure**

### **What We Verified:**

1. ✅ Handlers section exists
2. ✅ `DefaultEndorsement` name is correct
3. ✅ No `library` property (correct for built-in handlers)
4. ✅ Config accessible in container
5. ✅ `mode: dev` is set

---

## 🎯 **Why Error Persists (Based on Documentation)**

### **Possible Causes:**

1. **Handler Not Registered at Runtime**
   - Config is loaded, but handler might not be registered properly
   - Peer might need a **full restart** (not just restart, but stop + start)

2. **Handler Name Resolution Issue**
   - `DefaultEndorsement` should reference `HandlerLibrary.DefaultEndorsement`
   - If not found, Fabric falls back to plugin lookup

3. **Configuration Loading Timing**
   - Handlers might need to be loaded before system chaincodes are deployed
   - Order of initialization matters

---

## 📋 **Recommended Diagnostic Steps**

Run the diagnostic script to verify:

```bash
bash scripts/diagnose-handlers-config.sh
```

This will check:
- Handlers section structure
- Presence of empty `library` fields
- Config accessibility in container
- Handler initialization in logs

---

## 🔧 **Potential Solutions (Based on Documentation)**

### **Solution 1: Ensure Full Restart**

```bash
# Full stop and start (not restart)
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph
sleep 40  # Wait for full initialization
```

### **Solution 2: Verify Handler Registration**

Check if handlers are being registered:

```bash
docker logs peer0.lto.gov.ph 2>&1 | grep -i "handler\|endorsement\|DefaultEndorsement"
```

### **Solution 3: Check for YAML Formatting Issues**

Verify exact YAML structure:

```bash
docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)" 2>&1
```

---

## 📖 **Official Documentation References**

1. **Pluggable Endorsement and Validation:**
   https://hyperledger-fabric.readthedocs.io/en/release-2.5/pluggable_endorsement_and_validation.html

2. **Key Quote from Documentation:**
   > "When the endorsement or validation implementation is compiled into the peer, the `name` property represents the initialization function that is to be run in order to obtain the factory that creates instances of the endorsement/validation logic."

3. **HandlerLibrary Location:**
   `core/handlers/library/library.go`

---

## ✅ **Summary**

Based on official documentation:
- Your configuration structure is **correct**
- No `library` property is needed (and shouldn't be present)
- `chaincode.system.escc: enable` should not conflict
- The issue is likely related to **handler registration at runtime** rather than configuration structure

**Next Step:** Run the diagnostic script to identify the exact runtime issue.
