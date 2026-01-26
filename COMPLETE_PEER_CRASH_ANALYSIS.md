# Complete Peer Crash Analysis: Full Trace

**Analysis Date:** 2026-01-26  
**Trace Period:** 07:54:58 - 10:43:50+ (terminal output)

---

## 📊 **Complete Timeline Analysis**

### **PHASE 1: Peer Running - escc Error (07:54:58 - 10:29:00)**

```
Duration: ~2 hours 34 minutes
Status: ✅ Peer container RUNNING
Issue: ❌ Chaincode queries FAILING

Error Pattern:
- Every 30 seconds: Health check queries (qscc)
- Every 30 seconds: Vehicle registration queries
- All failing with: "plugin with name escc wasn't found"

Key Observations:
- Peer container stayed running (not crashing)
- Error occurred during endorsement phase
- Peer could process requests but couldn't endorse them
- Discovery service working (seen at 10:07:47)
- One successful query at 10:20:16 (no escc error!)
```

**Analysis:**
- Peer was operational but missing handlers configuration
- One successful query suggests intermittent config loading
- Most queries failed due to missing escc handler

---

### **PHASE 2: Graceful Shutdown (10:29:00 - 10:29:07)**

```
10:29:00.730 → Signal 15 (SIGTERM) received
10:29:01.061 → Stopping chain ltochannel
10:29:01.061 → Stopping leader election
10:29:01.061 → Stopping gossip
10:29:01.062 → Stopping discovery
10:29:01.062 → Stopping communication layer
10:29:01.062 → Warning: deliver stream canceled (expected during shutdown)

Duration: ~7 seconds
Status: ✅ Clean shutdown sequence
```

**Analysis:**
- Normal termination signal (likely manual stop/restart)
- All services shut down gracefully
- No errors during shutdown

---

### **PHASE 3: BCCSP Configuration Error (10:29:07 - 10:43:16)**

```
10:29:07.522 → ERROR: "Cannot run peer because could not get peer BCCSP configuration"
10:29:08.279 → Crash → Restart → Crash (repeat)
10:30:04.697 → Still crashing
10:31:57.155 → Still crashing
... (continues every ~60 seconds)
10:43:16.705 → LAST BCCSP ERROR

Duration: ~14 minutes
Restart Count: ~14 crashes
Status: ❌ Peer cannot start - BCCSP missing
```

**Error Pattern:**
- Immediate crash on startup
- Error occurs before any initialization
- Docker restart policy keeps retrying
- Each attempt fails at same point (BCCSP check)

**Analysis:**
- Minimal core.yaml was missing BCCSP section
- Peer requires BCCSP to initialize cryptographic services
- Configuration was incomplete for peer startup

---

### **PHASE 4: Snapshot Path Error (10:43:16 - Present)**

```
10:43:16.705 → Peer starts successfully!
10:43:16.705 → ✅ BCCSP configuration loaded
10:43:16.706 → ✅ Peer address detected
10:43:16.708 → ✅ TLS enabled
10:43:16.762 → ✅ Certificate monitoring active
10:43:16.763 → ✅ LedgerMgr initialization started
10:43:16.831 → ✅ Database format set (2.0)
10:43:16.938 → ✅ File ledger directory created
10:43:16.986 → ✅ Database format set (2.5)
10:43:16.986 → ❌ PANIC: "invalid path: snapshots. The path for the snapshot dir is expected to be an absolute path"

Duration: ~0.3 seconds (very fast crash)
Status: ❌ Peer crashes during ledger initialization
```

**Progress Made:**
- ✅ BCCSP configuration loaded
- ✅ Peer process started
- ✅ Network configuration loaded
- ✅ TLS initialized
- ✅ Certificate monitoring active
- ✅ Ledger manager started initializing
- ✅ Database format detected
- ❌ **FAILED** at snapshot directory configuration

**Error Details:**
```
panic: Error in instantiating ledger provider: invalid path: snapshots. 
The path for the snapshot dir is expected to be an absolute path

Location: /core/ledger/kvledger/kv_ledger_provider.go:251
Function: initSnapshotDir
```

**Analysis:**
- Peer progressed MUCH further than before
- BCCSP issue is RESOLVED
- New issue: Ledger snapshot directory path configuration
- Error occurs during ledger provider initialization
- Path "snapshots" is relative, but Fabric 2.5 requires absolute path

---

## 🔍 **Error Evolution Map**

```
ERROR 1: escc plugin not found
    │
    ├─→ Status: Peer running, queries failing
    ├─→ Duration: ~2.5 hours
    └─→ Fixed: Added handlers section to core.yaml

ERROR 2: BCCSP configuration missing
    │
    ├─→ Status: Peer crashing on startup
    ├─→ Duration: ~14 minutes
    ├─→ Fixed: Added peer.BCCSP section
    └─→ Progress: Peer now starts successfully

ERROR 3: Snapshot path invalid (CURRENT)
    │
    ├─→ Status: Peer crashing during ledger init
    ├─→ Duration: Ongoing
    ├─→ Location: Ledger provider initialization
    └─→ Issue: Relative path "snapshots" instead of absolute path
```

---

## 🎯 **Current Error: Snapshot Path Analysis**

### **What Happened:**

1. **Peer starts** ✅
2. **BCCSP loads** ✅
3. **Network config loads** ✅
4. **TLS initializes** ✅
5. **Ledger manager starts** ✅
6. **Database detected** ✅
7. **Snapshot directory check** ❌ **FAILS HERE**

### **The Error:**

```
panic: Error in instantiating ledger provider: invalid path: snapshots. 
The path for the snapshot dir is expected to be an absolute path
```

**Location:** `kv_ledger_provider.go:251` - `initSnapshotDir()`

**What This Means:**
- Fabric 2.5 requires absolute paths for snapshot directory
- Current config has relative path: `snapshots`
- Needs absolute path like: `/var/hyperledger/production/snapshots`

### **Why This Happens:**

Fabric 2.5 introduced ledger snapshots feature. The snapshot directory path must be:
- **Absolute path** (starts with `/`)
- **Not relative** (like `snapshots` or `./snapshots`)

The minimal `core.yaml` doesn't specify this, so Fabric might be using a default relative path, which causes the panic.

---

## 📋 **Configuration Requirements Analysis**

### **What We've Added So Far:**

1. ✅ `chaincode.mode: dev`
2. ✅ `handlers` section (escc, vscc)
3. ✅ `discovery` section
4. ✅ `peer.BCCSP` section
5. ❌ **Missing:** Ledger snapshot path configuration

### **What's Still Needed:**

The `core.yaml` needs ledger configuration, specifically:
- `ledger.snapshots.rootDir` - Absolute path for snapshots

---

## 🔄 **Startup Sequence (Current)**

```
1. Docker starts container ✅
2. Peer process starts ✅
3. Read core.yaml ✅
4. Parse BCCSP ✅
5. Initialize BCCSP ✅
6. Load network config ✅
7. Initialize TLS ✅
8. Start certificate monitoring ✅
9. Initialize LedgerMgr ✅
10. Detect database format ✅
11. Create file ledger directory ✅
12. Initialize snapshot directory ❌ FAILS HERE
13. (Would continue to system chaincode deployment)
```

**Progress:** Made it to step 12 of ~15 steps

---

## 📊 **Error Frequency Analysis**

### **BCCSP Errors:**
- **Frequency:** Every ~60 seconds
- **Count:** ~14 occurrences
- **Pattern:** Immediate crash, no progress

### **Snapshot Errors:**
- **Frequency:** Every ~1-2 seconds (very fast restart)
- **Count:** Multiple (seen 5+ times in trace)
- **Pattern:** Crash after ~0.3 seconds of initialization

**Observation:** Snapshot error causes faster crash loop (peer gets further before crashing)

---

## 🎓 **Key Findings**

### **1. Configuration Evolution:**

```
Initial Config:
  ✅ chaincode.mode
  ✅ handlers
  ✅ discovery
  ❌ BCCSP (missing)

After BCCSP Fix:
  ✅ chaincode.mode
  ✅ handlers
  ✅ discovery
  ✅ BCCSP
  ❌ Ledger snapshot path (missing)
```

### **2. Error Progression:**

- **Error 1:** Runtime error (peer running, queries failing)
- **Error 2:** Startup error (peer can't start)
- **Error 3:** Initialization error (peer starts, crashes during init)

**Each fix allows peer to progress further.**

### **3. Startup Progress:**

- **Before BCCSP fix:** Crashed immediately (0% progress)
- **After BCCSP fix:** Crashes at ~80% initialization (much better!)

### **4. Configuration Completeness:**

Minimal config is getting less minimal as we discover required sections:
- Started with 3 sections
- Added BCCSP (4 sections)
- Need to add ledger config (5+ sections)

---

## 🔍 **Snapshot Path Error Details**

### **Error Location:**
```
File: /core/ledger/kvledger/kv_ledger_provider.go
Line: 251
Function: initSnapshotDir
```

### **What Fabric Expects:**
- Absolute path starting with `/`
- Example: `/var/hyperledger/production/snapshots`

### **What Fabric Got:**
- Relative path: `snapshots`
- Or possibly empty/unset (defaults to relative)

### **Why It Fails:**
Fabric 2.5 validates paths strictly. Relative paths can cause issues with:
- Volume mounts
- Working directory changes
- Path resolution in containers

---

## 📈 **Success Indicators**

### **What's Working:**

1. ✅ **BCCSP Configuration** - No more BCCSP errors
2. ✅ **Peer Startup** - Peer process starts successfully
3. ✅ **Network Detection** - Auto-detects peer address
4. ✅ **TLS Initialization** - TLS enabled and working
5. ✅ **Certificate Monitoring** - Certificates tracked
6. ✅ **Ledger Manager Init** - Starts initializing
7. ✅ **Database Detection** - Detects database format

### **What's Failing:**

1. ❌ **Snapshot Directory** - Path validation fails
2. ❌ **Ledger Provider** - Cannot complete initialization
3. ❌ **System Chaincodes** - Never reaches deployment

---

## 🎯 **Root Cause Summary**

### **Current Issue:**

**Missing ledger snapshot directory configuration in `core.yaml`**

Fabric 2.5 requires:
- Absolute path for snapshot directory
- Must be specified in `core.yaml` under `ledger.snapshots.rootDir`

### **Why Minimal Config Isn't Enough:**

Each time we fix one missing section, peer progresses further and hits the next required configuration. This suggests we need a more complete `core.yaml` with:
- Chaincode config ✅
- Handlers ✅
- Discovery ✅
- BCCSP ✅
- **Ledger config** ❌ (current blocker)
- Possibly more...

---

## 📊 **Metrics Summary**

- **Total Errors:** 3 distinct error types
- **BCCSP Errors:** ~14 occurrences
- **Snapshot Errors:** 5+ occurrences (in visible trace)
- **Progress:** From 0% → 80% initialization
- **Time to Crash:** From immediate → ~0.3 seconds
- **Configuration Sections:** 3 → 4 → needs 5+

---

## 🔍 **Next Required Configuration**

Based on the error, `core.yaml` needs:

```yaml
ledger:
  snapshots:
    rootDir: /var/hyperledger/production/snapshots
```

**Or** the ledger section with snapshot configuration.

---

**Analysis Complete.** The peer is making significant progress - BCCSP is fixed, but now needs ledger snapshot path configuration.
