# 🚀 Quick Fix: Start Fabric Network

## Problem
```
Failed to connect before the deadline on Endorser- name: peer0.lto.gov.ph
```

**Fabric network is not running.**

---

## ✅ Solution: Start Fabric Network

### Step 1: Check Current Status

```bash
# Check if Fabric containers exist
docker ps -a | grep -E "peer0|orderer|ca"

# Check if they're running
docker-compose -f docker-compose.fabric.yml ps
```

### Step 2: Start Fabric Network

**Using unified compose (recommended):**
```bash
cd ~/LTOBLOCKCHAIN

# Start all services (including Fabric)
docker-compose -f docker-compose.unified.yml up -d

# OR start only Fabric services
docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph peer0.lto.gov.ph couchdb
```

### Step 3: Wait for Containers to Start

```bash
# Wait 30-60 seconds for containers to initialize
sleep 30

# Check status
docker-compose -f docker-compose.unified.yml ps
```

**Expected Output:**
```
NAME                    STATUS          PORTS
peer0.lto.gov.ph        Up              7051/tcp
orderer.lto.gov.ph      Up              7050/tcp
couchdb                 Up              5984/tcp
cli                     Up (optional)
```

### Step 4: Verify Fabric is Ready

```bash
# Check logs for errors
docker-compose -f docker-compose.unified.yml logs peer0.lto.gov.ph | tail -20

# Should see: "Started peer with ID=name:peer0.lto.gov.ph"

# Check orderer logs
docker-compose -f docker-compose.unified.yml logs orderer.lto.gov.ph | tail -20

# Should see: "Beginning to serve requests"
```

### Step 5: Run the Script Again

```bash
node backend/scripts/register-missing-vehicles-on-blockchain.js
```

---

## 🔍 Troubleshooting

### If containers don't start:

```bash
# Check Docker is running
docker ps

# Check for port conflicts
netstat -tulpn | grep -E "7051|7050|7054|5984"

# Check logs
docker-compose -f docker-compose.unified.yml logs peer0.lto.gov.ph orderer.lto.gov.ph
```

### If connection still fails:

1. **Check `FABRIC_AS_LOCALHOST` setting:**
   ```bash
   grep FABRIC_AS_LOCALHOST .env
   # Should be: FABRIC_AS_LOCALHOST=false (for Docker network)
   ```

2. **Check network-config.json paths:**
   ```bash
   # Verify certificate paths exist
   ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
   ```

3. **Check wallet exists:**
   ```bash
   ls -la wallet/admin/
   # Should see: admin.id file
   ```

---

## ✅ After Fabric Starts

Once Fabric is running, the script will:
1. Connect to Fabric network ✅
2. Find missing vehicles ✅
3. Register them on blockchain ✅
4. Update database with transaction IDs ✅
5. Generate QR codes ✅
