# Manual Fix: Add Snapshot Path to core.yaml

**Purpose:** Fix the `invalid path: snapshots` error by adding the required snapshot directory configuration.

---

## 🎯 **What This Fixes**

The peer is crashing with:
```
panic: Error in instantiating ledger provider: invalid path: snapshots. 
The path for the snapshot dir is expected to be an absolute path
```

**Root Cause:** Fabric 2.5 requires an absolute path for ledger snapshots, but the current `core.yaml` doesn't specify it.

---

## 📋 **Manual Steps**

### **Step 1: Navigate to Project Directory**

```bash
cd ~/LTOBLOCKCHAIN
```

---

### **Step 2: Backup Current Config (Optional but Recommended)**

```bash
# Backup existing core.yaml if it exists
if [ -f fabric-network/config/core.yaml ]; then
    cp fabric-network/config/core.yaml fabric-network/config/core.yaml.backup.$(date +%Y%m%d_%H%M%S)
    echo "✓ Backup created"
else
    echo "⚠ No existing core.yaml to backup"
fi
```

---

### **Step 3: Check Current Config**

```bash
# View current ledger section
if [ -f fabric-network/config/core.yaml ]; then
    echo "Current ledger section:"
    grep -A 15 "^ledger:" fabric-network/config/core.yaml || echo "No ledger section found"
else
    echo "⚠ core.yaml does not exist yet"
fi
```

---

### **Step 4: Add Snapshot Path Configuration**

You have two options:

#### **Option A: Edit File Directly (if core.yaml exists)**

```bash
# Check if snapshots section already exists
if grep -q "snapshots:" fabric-network/config/core.yaml 2>/dev/null; then
    echo "⚠ snapshots section already exists"
    grep -A 3 "snapshots:" fabric-network/config/core.yaml
else
    echo "Adding snapshots configuration..."
    
    # Use sed to add snapshots section after "ledger:" line
    sed -i '/^ledger:/a\  snapshots:\n    rootDir: /var/hyperledger/production/snapshots' fabric-network/config/core.yaml
    
    echo "✓ Snapshot path added"
fi
```

#### **Option B: Use the Updated Script**

```bash
# Run the updated script (recommended)
bash scripts/final-fix-create-minimal-core-yaml.sh
```

---

### **Step 5: Verify the Configuration**

```bash
# Check that snapshots section was added correctly
echo "Verifying snapshot configuration:"
grep -A 3 "snapshots:" fabric-network/config/core.yaml

# Expected output:
#   snapshots:
#     rootDir: /var/hyperledger/production/snapshots
```

---

### **Step 6: Verify Config is Accessible in Container**

```bash
# Check if config mount exists in docker-compose
if grep -q "fabric-network/config:/var/hyperledger/fabric/config" docker-compose.unified.yml; then
    echo "✓ Config mount found in docker-compose"
else
    echo "✗ Config mount NOT found - you may need to update docker-compose.unified.yml"
fi

# If peer container is running, verify file exists inside
if docker ps | grep -q "peer0.lto.gov.ph"; then
    echo ""
    echo "Checking config inside container:"
    docker exec peer0.lto.gov.ph test -f /var/hyperledger/fabric/config/core.yaml && echo "✓ File exists in container" || echo "✗ File NOT found in container"
    
    echo ""
    echo "Snapshot config in container:"
    docker exec peer0.lto.gov.ph grep -A 3 "snapshots:" /var/hyperledger/fabric/config/core.yaml 2>/dev/null || echo "⚠ snapshots section not found in container"
fi
```

---

### **Step 7: Restart Peer Container**

```bash
# Stop peer
echo "Stopping peer container..."
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph

# Wait a moment
sleep 2

# Start peer
echo "Starting peer container..."
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Wait for peer to initialize
echo "Waiting for peer to start (30 seconds)..."
sleep 30
```

---

### **Step 8: Check Peer Logs**

```bash
# Check if peer started successfully
echo "Checking peer status:"
docker ps | grep "peer0.lto.gov.ph" || echo "⚠ Peer container not running"

echo ""
echo "Recent peer logs (last 50 lines):"
docker logs peer0.lto.gov.ph 2>&1 | tail -50

echo ""
echo "Checking for snapshot path error:"
if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "invalid path.*snapshots"; then
    echo "✗ Still seeing snapshot path error!"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "invalid path.*snapshots" | tail -3
else
    echo "✓ No snapshot path errors found"
fi

echo ""
echo "Checking for BCCSP errors:"
if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "BCCSP configuration"; then
    echo "✗ Still seeing BCCSP errors!"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "BCCSP configuration" | tail -3
else
    echo "✓ No BCCSP errors found"
fi

echo ""
echo "Checking for system chaincode deployment:"
if docker logs peer0.lto.gov.ph 2>&1 | grep -q "Deployed system chaincodes"; then
    echo "✓ System chaincodes deployed successfully!"
else
    echo "⚠ System chaincodes not yet deployed (may still be starting)"
fi
```

---

### **Step 9: Monitor Peer Startup Progress**

```bash
# Watch logs in real-time (Ctrl+C to exit)
docker logs -f peer0.lto.gov.ph
```

**Look for:**
- ✅ No "invalid path: snapshots" errors
- ✅ No "BCCSP configuration" errors
- ✅ "Deployed system chaincodes" message (indicates successful startup)
- ✅ "Starting peer" → "Started peer" sequence

---

## 🔍 **Troubleshooting**

### **If snapshot path error persists:**

1. **Verify the path is absolute:**
   ```bash
   grep "rootDir:" fabric-network/config/core.yaml
   # Should show: rootDir: /var/hyperledger/production/snapshots
   # NOT: rootDir: snapshots (relative path)
   ```

2. **Check YAML indentation:**
   ```bash
   # snapshots should be indented 2 spaces under ledger:
   # rootDir should be indented 4 spaces under snapshots:
   cat -A fabric-network/config/core.yaml | grep -A 3 "snapshots:"
   ```

3. **Verify file is mounted correctly:**
   ```bash
   # Check docker-compose volume mount
   grep -A 5 "peer0.lto.gov.ph:" docker-compose.unified.yml | grep "fabric-network/config"
   
   # Check inside container
   docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml | grep -A 3 "snapshots:"
   ```

### **If peer still crashes:**

Check for new error messages:
```bash
docker logs peer0.lto.gov.ph 2>&1 | tail -30
```

The error message will indicate what configuration is missing next.

---

## ✅ **Success Indicators**

After applying this fix, you should see:

1. ✅ Peer container stays running (not restarting)
2. ✅ No "invalid path: snapshots" errors in logs
3. ✅ "Deployed system chaincodes" message appears
4. ✅ Peer listens on port 7051

---

## 📊 **Expected Configuration**

After the fix, your `core.yaml` should have:

```yaml
ledger:
  snapshots:
    rootDir: /var/hyperledger/production/snapshots
  state:
    stateDatabase: CouchDB
    couchDBConfig:
      # ... rest of config ...
```

---

## 🎯 **Quick Reference: All Manual Commands**

```bash
# Complete manual fix sequence
cd ~/LTOBLOCKCHAIN

# Backup
cp fabric-network/config/core.yaml fabric-network/config/core.yaml.backup 2>/dev/null || true

# Add snapshot path (if editing manually)
sed -i '/^ledger:/a\  snapshots:\n    rootDir: /var/hyperledger/production/snapshots' fabric-network/config/core.yaml

# Verify
grep -A 3 "snapshots:" fabric-network/config/core.yaml

# Restart peer
docker-compose -f docker-compose.unified.yml stop peer0.lto.gov.ph
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph

# Wait and check
sleep 30
docker logs peer0.lto.gov.ph 2>&1 | tail -30
```

---

**Note:** The script `scripts/final-fix-create-minimal-core-yaml.sh` has been updated to include this configuration automatically.
