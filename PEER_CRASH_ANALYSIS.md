# Peer Crash Analysis: BCCSP Configuration Error

**Date:** 2026-01-26  
**Error:** `Cannot run peer because could not get peer BCCSP configuration`  
**Restart Count:** 17 (crashing repeatedly)

---

## 🔍 **Timeline Analysis**

### **Phase 1: Peer Running but escc Error (07:54 - 10:29)**

```
07:54:58 → Peer running, processing queries
          → All queries failing with: "plugin with name escc wasn't found"
          → Peer container stayed running (not crashing)
          → Error was in chaincode endorsement, not peer startup
```

**Status:** ✅ Peer container running, ❌ Chaincode queries failing

### **Phase 2: Peer Stopped (10:29:00)**

```
10:29:00 → Received signal: 15 (terminated)
10:29:01 → Graceful shutdown started
          → Stopping gossip, discovery, chain
```

**Status:** ✅ Normal shutdown (likely manual stop or restart)

### **Phase 3: Peer Crash Loop (10:29:07 - Present)**

```
10:29:07 → NEW ERROR: "Cannot run peer because could not get peer BCCSP configuration"
10:29:08 → Crash → Restart → Crash (repeating)
10:30:04 → Still crashing
10:31:57 → Still crashing
... (continues every ~60 seconds)
```

**Status:** ❌ Peer cannot start - BCCSP configuration missing

---

## 🎯 **Root Cause**

### **The Problem:**

The `core.yaml` file is **missing the BCCSP (Blockchain Cryptographic Service Provider) configuration**.

### **What is BCCSP?**

BCCSP is Fabric's cryptographic service provider - it handles:
- Key generation
- Signing/verification
- Encryption/decryption
- Hash functions

**Fabric peers REQUIRE BCCSP configuration to start.**

### **Why This Happened:**

The minimal `core.yaml` we created earlier only included:
- `chaincode.mode: dev`
- `handlers` section
- `discovery` section
- `metrics` section

**But it's missing:**
- `peer` section (with BCCSP configuration)
- `BCCSP` section (cryptographic provider settings)

---

## 🔧 **The Fix**

### **Complete core.yaml Required:**

The peer needs a more complete `core.yaml` with BCCSP configuration. Here's what's needed:

```yaml
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

peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256

metrics:
  provider: disabled
```

**OR** use a more complete configuration that includes all required sections.

---

## 📋 **Step-by-Step Fix**

### **Step 1: Stop Peer**

```bash
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
```

### **Step 2: Update core.yaml**

```bash
cd ~/LTOBLOCKCHAIN

# Backup current file
cp fabric-network/config/core.yaml fabric-network/config/core.yaml.backup

# Create complete core.yaml with BCCSP
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

peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256

metrics:
  provider: disabled
EOF
```

### **Step 3: Verify File**

```bash
# Check BCCSP section exists
grep -A 8 "^peer:" fabric-network/config/core.yaml

# Should show:
# peer:
#   BCCSP:
#     Default: SW
#     SW:
#       Hash: SHA2
#       Security: 256
```

### **Step 4: Start Peer**

```bash
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Watch logs
docker logs -f peer0.lto.gov.ph
```

**Look for:**
- ✅ No "BCCSP configuration" error
- ✅ "Starting peer" message
- ✅ "Deployed system chaincodes" message

---

## 🔍 **Error Pattern Mapping**

### **Error Sequence:**

```
1. Peer starts
   ↓
2. Reads core.yaml
   ↓
3. Looks for BCCSP configuration
   ↓
4. NOT FOUND → Error: "could not get peer BCCSP configuration"
   ↓
5. Peer exits (crash)
   ↓
6. Docker restarts (restart policy)
   ↓
7. Loop repeats (every ~60 seconds)
```

### **Why Restart Count is 17:**

- Each crash → Docker restarts
- Restart happens ~every 60 seconds
- 17 restarts = ~17 minutes of crash loop
- Started at 10:29:07, current time shows it's been crashing for a while

---

## ✅ **Verification**

After applying the fix:

```bash
# 1. Check peer is running (not restarting)
docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Status}}"

# Should show: "Up X seconds" (not "Restarting")

# 2. Check logs for BCCSP error
docker logs peer0.lto.gov.ph --tail=50 | grep -i "BCCSP"

# Should show: NOTHING (no BCCSP errors)

# 3. Check for successful startup
docker logs peer0.lto.gov.ph --tail=50 | grep -i "Deployed system chaincodes"

# Should show: "Deployed system chaincodes" message

# 4. Check restart count (should stop increasing)
docker inspect peer0.lto.gov.ph --format='Restart count: {{.RestartCount}}'

# Wait 2 minutes, check again - count should be same
```

---

## 🎓 **Key Insights**

1. **Minimal config wasn't enough** - Fabric needs BCCSP configuration
2. **Error changed** - From escc error (peer running) to BCCSP error (peer crashing)
3. **Restart loop** - Docker's restart policy keeps trying, but peer can't start without BCCSP
4. **Dependencies fine** - CouchDB and Orderer are running, issue is peer config only

---

## 📊 **Before vs After**

### **Before (Current State):**
```
core.yaml:
  ✅ chaincode.mode: dev
  ✅ handlers section
  ✅ discovery section
  ❌ BCCSP section (MISSING)
  
Result: Peer crashes on startup
```

### **After (Fixed):**
```
core.yaml:
  ✅ chaincode.mode: dev
  ✅ handlers section
  ✅ discovery section
  ✅ BCCSP section (ADDED)
  
Result: Peer starts successfully
```

---

**Next Step:** Update `core.yaml` with BCCSP section and restart peer.
