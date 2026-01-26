# Why the escc Error Happened: Root Cause Analysis

**Date:** 2026-01-25  
**Error:** `endorsing with plugin failed: plugin with name escc could not be used: plugin with name escc wasn't found`

---

## 🔍 **What Changed**

### **The Critical Change:**

**`core.yaml` was removed or never created** in `fabric-network/config/`, but the peer is still configured to look for it.

### **Evidence:**

1. **`docker-compose.unified.yml` still references config:**
   ```yaml
   # Line 111
   - FABRIC_CFG_PATH=/var/hyperledger/fabric/config
   
   # Line 116
   - ./fabric-network/config:/var/hyperledger/fabric/config:ro
   ```

2. **But `core.yaml` doesn't exist:**
   - Directory `fabric-network/config/` exists (or is created by scripts)
   - File `fabric-network/config/core.yaml` is **missing**

3. **Previous attempts to remove it:**
   - `FINAL_FIX_REMOVE_CONFIG_MOUNT.md` documents an attempt to remove `core.yaml`
   - `scripts/fix-chaincode-query-error-remove-config.sh` removes `core.yaml`
   - `TERMINAL_OUTPUT_ANALYSIS.md` shows peer crashes when config is missing

---

## 🎯 **Why This Causes the Error**

### **Hyperledger Fabric 2.5 Requirement:**

Fabric 2.5 **requires** explicit `handlers` configuration in `core.yaml` for system chaincodes:

```yaml
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
```

### **What Happens Without It:**

1. **Peer starts** (because it can run without `core.yaml` initially)
2. **Peer reads config** from `/var/hyperledger/fabric/config/core.yaml` (because `FABRIC_CFG_PATH` is set)
3. **File doesn't exist** → Peer uses default behavior
4. **Default behavior:** Look for `escc` as an **external plugin file** (e.g., `/opt/gopath/src/github.com/hyperledger/fabric/core/handlers/endorsement/plugin/plugin.so`)
5. **Plugin file doesn't exist** → Error: `plugin with name escc wasn't found`

### **The Chain of Events:**

```
Peer Startup
    ↓
Reads FABRIC_CFG_PATH=/var/hyperledger/fabric/config
    ↓
Looks for core.yaml
    ↓
File not found (or missing handlers section)
    ↓
Uses default: Look for external escc plugin
    ↓
Plugin file doesn't exist
    ↓
ERROR: "plugin with name escc wasn't found"
```

---

## 📋 **What Actually Changed**

### **Timeline of Changes:**

1. **Initially:** `core.yaml` was created with full configuration (see `scripts/fix-peer-fabric-cfg-path.sh`)

2. **Later:** Someone tried to remove `core.yaml` thinking:
   - Environment variables were sufficient
   - Fabric could work without it
   - It was causing conflicts

3. **Result:** `core.yaml` was deleted, but:
   - `FABRIC_CFG_PATH` was still set in `docker-compose.unified.yml`
   - Volume mount was still present
   - Peer still looks for the file

4. **Current State:**
   - `FABRIC_CFG_PATH=/var/hyperledger/fabric/config` ✅ (set)
   - `./fabric-network/config:/var/hyperledger/fabric/config:ro` ✅ (mounted)
   - `fabric-network/config/core.yaml` ❌ (missing)

---

## 🔧 **Why the Fix Works**

The fix script (`fix-escc-root-cause.sh`) works because it:

1. **Creates `core.yaml`** with the required `handlers` section
2. **Specifies `DefaultEndorsement`** for `escc` (built-in handler, not external plugin)
3. **Performs FULL restart** (stop + start) so peer reloads config
4. **Verifies** the file is accessible in the container

### **Key Configuration:**

```yaml
chaincode:
  mode: dev  # Uses built-in handlers

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement  # ← This tells Fabric to use built-in handler
  validators:
    vscc:
      name: DefaultValidation
```

**Without this:** Fabric looks for external plugin files  
**With this:** Fabric uses built-in handlers (no external files needed)

---

## ⚠️ **Why Previous Fixes Failed**

### **Attempt 1: Remove `core.yaml` entirely**
- **Problem:** Fabric 2.5 requires `handlers` section for system chaincodes
- **Result:** Peer crashes or escc error persists

### **Attempt 2: Use environment variables only**
- **Problem:** `handlers` section cannot be set via environment variables
- **Result:** escc error persists

### **Attempt 3: Use `mode: net`**
- **Problem:** `net` mode expects external plugins, not built-in handlers
- **Result:** escc error persists

### **Correct Solution:**
- **Create `core.yaml`** with `mode: dev` and explicit `handlers` section
- **Use `DefaultEndorsement`** (built-in handler)
- **FULL restart** peer to reload config

---

## 🎓 **Key Lessons**

1. **Fabric 2.5 requires `handlers` section** in `core.yaml` for system chaincodes
2. **Cannot use environment variables** for handlers configuration
3. **`mode: dev`** enables built-in handlers (no external plugins needed)
4. **Peer only reads config at startup** - must FULL restart (stop + start) after changes
5. **Volume mount must match `FABRIC_CFG_PATH`** - if path is set, file must exist

---

## ✅ **Prevention**

To prevent this in the future:

1. **Never remove `core.yaml`** if `FABRIC_CFG_PATH` is set
2. **Always include `handlers` section** in `core.yaml` for Fabric 2.5
3. **Use `mode: dev`** for development (built-in handlers)
4. **Document why `core.yaml` is required** (system chaincode handlers)

---

**Summary:** The error happened because `core.yaml` was removed, but Fabric 2.5 requires it for system chaincode handlers. The fix recreates it with the proper `handlers` section pointing to built-in handlers (`DefaultEndorsement`).
