# Hyperledger Fabric Integration Guide
## Complete Step-by-Step Guide

This guide will help you set up and integrate a real Hyperledger Fabric network with your TrustChain LTO system.

---

## 📋 **PREREQUISITES**

Before starting, ensure you have:

- ✅ **Docker Desktop** installed and running
- ✅ **Docker Compose** installed (comes with Docker Desktop)
- ✅ **Node.js** (v16+) and npm installed
- ✅ **PowerShell** (for Windows scripts)
- ✅ **At least 4GB RAM** available for Docker
- ✅ **At least 10GB free disk space**

---

## 🚀 **QUICK START (Automated Setup)**

The easiest way is to use the automated setup script:

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\scripts\complete-fabric-setup.ps1
```

This will:
1. Generate cryptographic materials
2. Generate channel artifacts
3. Start the Fabric network
4. Create and join the channel
5. Set up the application wallet
6. Deploy chaincode

**Time: ~10-15 minutes**

---

## 📝 **MANUAL SETUP (Step-by-Step)**

If you prefer to run each step manually or troubleshoot:

### **STEP 1: Generate Cryptographic Materials**

This creates certificates and keys for all Fabric components.

```powershell
.\scripts\generate-crypto.ps1
```

**What it does:**
- Creates certificates for CA, orderers, peers
- Generates admin user certificates
- Saves to `fabric-network/crypto-config/`

**Expected output:**
```
✅ Cryptographic materials generated successfully!
📁 Materials saved to: fabric-network\crypto-config
```

---

### **STEP 2: Generate Channel Artifacts**

This creates the genesis block and channel configuration.

```powershell
.\scripts\generate-channel-artifacts.ps1
```

**What it does:**
- Creates genesis block for orderers
- Creates channel transaction for `ltochannel`
- Creates anchor peer update
- Saves to `fabric-network/channel-artifacts/`

**Expected output:**
```
✅ Genesis block generated
✅ Channel transaction generated
✅ Anchor peer update generated
```

---

### **STEP 3: Start Fabric Network**

This starts all Fabric Docker containers.

```powershell
.\scripts\start-fabric-network.ps1
```

**What it starts:**
- Certificate Authority (CA) - Port 7054
- 3 Orderer nodes - Ports 7050, 8050, 9050
- 1 Peer node - Port 7051
- CouchDB - Port 5984
- CLI container (for commands)

**Expected output:**
```
✅ Fabric network started successfully!
```

**Verify it's running:**
```powershell
docker-compose -f docker-compose.fabric.yml ps
```

All containers should show "Up" status.

---

### **STEP 4: Create and Join Channel**

This creates the blockchain channel and joins the peer to it.

```powershell
.\scripts\create-channel.ps1
```

**What it does:**
- Creates `ltochannel`
- Joins `peer0.lto.gov.ph` to the channel
- Updates anchor peers

**Expected output:**
```
✅ Channel created successfully
✅ Peer joined channel successfully
✅ Anchor peers updated successfully
```

---

### **STEP 5: Setup Application Wallet**

This creates a wallet with admin identity for your application to connect.

```powershell
.\scripts\setup-fabric-wallet.ps1
```

**What it does:**
- Creates `wallet/` directory
- Adds admin identity to wallet
- Enables application connection

**Expected output:**
```
✅ Admin identity added to wallet successfully
✅ Wallet setup complete!
```

---

### **STEP 6: Deploy Chaincode**

This packages, installs, and commits your smart contract.

```powershell
.\scripts\deploy-chaincode.ps1
```

**What it does:**
- Packages the chaincode
- Installs on peer
- Approves for organization
- Commits to channel
- Tests the chaincode

**Expected output:**
```
✅ Chaincode packaged
✅ Chaincode installed
✅ Chaincode approved
✅ Chaincode committed
✅ Chaincode is working!
```

---

## ⚙️ **STEP 7: Configure Application**

Now configure your application to use the real Fabric network.

### **Update Environment Variables**

Create or update `.env` file in the project root:

```env
# Blockchain Configuration
BLOCKCHAIN_MODE=fabric

# Fabric Network Settings
FABRIC_NETWORK_CONFIG=network-config.yaml
FABRIC_WALLET_PATH=wallet
FABRIC_CHANNEL_NAME=ltochannel
FABRIC_CHAINCODE_NAME=vehicle-registration

# Application Settings
PORT=3001
NODE_ENV=production
```

### **Verify Network Configuration**

Check that `network-config.yaml` exists and has correct paths:

```yaml
peers:
  peer0.lto.gov.ph:
    url: grpcs://localhost:7051
    tlsCACerts:
      path: fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
```

---

## 🧪 **STEP 8: Test the Integration**

### **Start Your Application**

```powershell
npm start
```

### **Check Logs**

You should see:
```
🔗 Attempting to connect to Hyperledger Fabric...
✅ Real Hyperledger Fabric integration active
✅ Connected to channel: ltochannel
```

If you see "Using mock blockchain service", check:
1. Wallet exists: `Test-Path wallet`
2. Admin identity exists: `Test-Path wallet\admin`
3. Fabric network is running: `docker-compose -f docker-compose.fabric.yml ps`

### **Test API Endpoint**

```powershell
# Test blockchain status
Invoke-WebRequest -Uri "http://localhost:3001/api/blockchain/status" -UseBasicParsing
```

Should return:
```json
{
  "success": true,
  "mode": "fabric",
  "network": "TrustChainNetwork",
  "channel": "ltochannel"
}
```

---

## 🔍 **TROUBLESHOOTING**

### **Problem: Docker containers won't start**

**Solution:**
```powershell
# Check Docker is running
docker ps

# Check available resources
docker system df

# Clean up if needed
docker system prune -a
```

### **Problem: "Crypto materials not found"**

**Solution:**
```powershell
# Regenerate crypto materials
.\scripts\generate-crypto.ps1
```

### **Problem: "Channel already exists"**

**Solution:**
This is normal if you're re-running. The script handles this.

### **Problem: "Admin user not found in wallet"**

**Solution:**
```powershell
# Re-run wallet setup
.\scripts\setup-fabric-wallet.ps1
```

### **Problem: Application still uses mock mode**

**Check:**
1. `.env` file has `BLOCKCHAIN_MODE=fabric`
2. Wallet directory exists with admin identity
3. Fabric network is running
4. Restart the application

### **Problem: Chaincode deployment fails**

**Solution:**
```powershell
# Check if chaincode is already installed
docker exec cli peer lifecycle chaincode queryinstalled

# If needed, remove old chaincode and redeploy
```

---

## 📊 **VERIFY NETWORK STATUS**

### **Check Container Status**

```powershell
docker-compose -f docker-compose.fabric.yml ps
```

All should show "Up" status.

### **Check Channel**

```powershell
docker exec cli peer channel list
```

Should show `ltochannel`.

### **Check Chaincode**

```powershell
docker exec cli peer lifecycle chaincode querycommitted -C ltochannel
```

Should show `vehicle-registration` version 1.0.

### **Check CouchDB**

Open browser: `http://localhost:5984/_utils`

Login: `admin` / `adminpw`

---

## 🛑 **STOPPING THE NETWORK**

To stop the Fabric network:

```powershell
docker-compose -f docker-compose.fabric.yml down
```

To stop and remove all data:

```powershell
docker-compose -f docker-compose.fabric.yml down -v
```

**Warning:** This will delete all blockchain data!

---

## 🔄 **RESTARTING THE NETWORK**

If you need to restart:

```powershell
# Stop
docker-compose -f docker-compose.fabric.yml down

# Start
docker-compose -f docker-compose.fabric.yml up -d

# Wait for startup
Start-Sleep -Seconds 30

# Verify
docker-compose -f docker-compose.fabric.yml ps
```

---

## 📁 **FILE STRUCTURE**

After setup, you should have:

```
LTOBLOCKCHAIN/
├── fabric-network/
│   ├── crypto-config/          # Certificates and keys
│   │   ├── ordererOrganizations/
│   │   └── peerOrganizations/
│   └── channel-artifacts/      # Genesis block, channel config
│       ├── genesis.block
│       ├── channel.tx
│       └── LTOMSPanchors.tx
├── wallet/                      # Application wallet
│   └── admin/                   # Admin identity
├── docker-compose.fabric.yml    # Fabric network config
├── network-config.yaml          # SDK connection profile
└── .env                         # Environment variables
```

---

## 🎯 **NEXT STEPS**

Once Fabric is running:

1. ✅ **Test vehicle registration** - Register a vehicle through the UI
2. ✅ **Check blockchain** - View transactions in admin blockchain viewer
3. ✅ **Query chaincode** - Test query functions
4. ✅ **Monitor network** - Check CouchDB for state data

---

## 💡 **IMPORTANT NOTES**

1. **First startup takes time** - Containers need to initialize (2-3 minutes)
2. **Keep Docker running** - Fabric network requires Docker to be running
3. **Port conflicts** - Make sure ports 7050-7054, 8050, 9050, 5984 are free
4. **Resource usage** - Fabric network uses ~2-3GB RAM
5. **Data persistence** - Blockchain data is stored in Docker volumes

---

## 🆘 **NEED HELP?**

If you encounter issues:

1. Check Docker logs: `docker-compose -f docker-compose.fabric.yml logs`
2. Check specific container: `docker logs peer0.lto.gov.ph`
3. Verify crypto materials exist
4. Verify channel artifacts exist
5. Check wallet directory

---

**Last Updated**: 2025-01-XX  
**Status**: ✅ Ready for Integration
