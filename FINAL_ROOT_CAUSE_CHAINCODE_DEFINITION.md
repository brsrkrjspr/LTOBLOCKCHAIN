# FINAL ROOT CAUSE ANALYSIS: Chaincode Definition Override

**Date:** 2026-01-26  
**Root Cause Identified:** Chaincode definition has hardcoded plugin references  
**Solution:** Re-commit chaincode with empty plugin strings to use built-in handlers

---

## 🎯 **THE REAL ROOT CAUSE**

### **Problem:**
The chaincode definition itself has hardcoded `escc`/`vscc` plugin references from when it was committed. These override the `core.yaml` handlers configuration.

### **Why This Happens:**

In Fabric 2.x lifecycle, when you commit a chaincode using `peer lifecycle chaincode commit`:

1. **If you DON'T specify `--endorsement-plugin` or `--validation-plugin`:**
   - Fabric defaults to plugin names: `"escc"` and `"vscc"`
   - These are **OLD Fabric 1.x plugin names** that no longer exist as plugins
   - Fabric tries to find external plugin files instead of using built-in handlers

2. **The chaincode definition stores these plugin names:**
   - When a transaction comes in, Fabric checks the chaincode definition
   - It sees `endorsement_plugin: "escc"` 
   - It tries to find a plugin named "escc"
   - Plugin doesn't exist → Error: `"plugin with name escc wasn't found"`

3. **Even though `core.yaml` has handlers configured:**
   - The chaincode definition **overrides** the peer's handler configuration
   - Chaincode-level plugin specification takes precedence

---

## ✅ **Evidence**

### **From Diagnostic:**
```
Step 1: Check Fabric version...
Version: v2.5.0

Step 3: Check for handler initialization messages...
(No handler initialization found)

Step 8: Check chaincode system chaincode deployment...
Deployed system chaincodes: lscc, cscc, qscc
(NOT escc/vscc - they're not system chaincodes, they're handlers)

Error: "endorsing with plugin failed: plugin with name escc could not be used: 
plugin with name escc wasn't found"
```

### **From Chaincode Commit Commands:**
Looking at `scripts/redeploy-chaincode.sh` and other deployment scripts:
```bash
peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    # ❌ NO --endorsement-plugin specified
    # ❌ NO --validation-plugin specified
    # → Defaults to "escc" and "vscc" as plugin names
```

---

## 🔧 **THE SOLUTION**

### **Re-commit the chaincode with empty plugin strings:**

```bash
peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence <NEXT_SEQUENCE> \
    --endorsement-plugin '' \      # ← Empty string = use built-in handlers
    --validation-plugin '' \       # ← Empty string = use built-in handlers
    --tls \
    --cafile <CA_FILE>
```

**What empty strings do:**
- `--endorsement-plugin ''` tells Fabric to use the **built-in handler** from `core.yaml` (`DefaultEndorsement`)
- `--validation-plugin ''` tells Fabric to use the **built-in handler** from `core.yaml` (`DefaultValidation`)
- Instead of looking for external plugin files

---

## 📋 **Implementation**

### **Script Created:**
`scripts/fix-chaincode-handlers.sh`

**What it does:**
1. Checks current chaincode definition
2. Gets current sequence number
3. Approves chaincode with `--endorsement-plugin ''` and `--validation-plugin ''`
4. Commits chaincode with empty plugin strings
5. Verifies the fix worked
6. Tests chaincode query

### **Run the fix:**
```bash
bash scripts/fix-chaincode-handlers.sh
```

---

## 🎓 **Key Lessons**

1. **Chaincode definition overrides peer config:**
   - Even if `core.yaml` has handlers configured correctly
   - Chaincode-level plugin specification takes precedence

2. **Fabric 2.x defaults are problematic:**
   - Default plugin names (`escc`/`vscc`) are from Fabric 1.x
   - They don't exist as plugins in Fabric 2.x
   - Must explicitly specify empty strings to use built-in handlers

3. **Handlers vs System Chaincodes:**
   - In Fabric 2.5, `escc`/`vscc` are **handlers** (built into peer)
   - NOT system chaincodes (like `lscc`, `cscc`, `qscc`)
   - Missing `/core/handlers/` directory is **normal** - handlers are compiled into peer binary

4. **Always specify plugin settings:**
   - When committing chaincode in Fabric 2.x, always specify:
     - `--endorsement-plugin ''` (empty = use built-in)
     - `--validation-plugin ''` (empty = use built-in)
   - Or explicitly name custom plugins if using them

---

## ✅ **Expected Outcome**

After running the fix script:

1. ✅ Chaincode definition updated with empty plugin strings
2. ✅ Fabric uses built-in handlers from `core.yaml`
3. ✅ No more "plugin with name escc wasn't found" error
4. ✅ Chaincode queries work correctly
5. ✅ Transactions can be submitted successfully

---

## 📚 **References**

- [Fabric 2.5 Chaincode Lifecycle Documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/chaincode_lifecycle.html)
- [Pluggable Endorsement and Validation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/pluggable_endorsement_and_validation.html)

---

**Summary:** The root cause was the chaincode definition specifying old Fabric 1.x plugin names (`escc`/`vscc`) which override the peer's handler configuration. The solution is to re-commit the chaincode with empty plugin strings to use built-in handlers.
