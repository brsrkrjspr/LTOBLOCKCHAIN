# 🚀 Quick Start: Real Hyperledger Fabric Integration

## ⚡ **FASTEST WAY (Automated - 10 minutes)**

Run this single command:

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\scripts\complete-fabric-setup.ps1
```

That's it! The script will:
1. ✅ Generate crypto materials
2. ✅ Generate channel artifacts  
3. ✅ Start Fabric network
4. ✅ Create channel
5. ✅ Setup wallet
6. ✅ Deploy chaincode

---

## 📝 **MANUAL STEPS (If you prefer step-by-step)**

### **Step 1: Generate Crypto Materials**
```powershell
.\scripts\generate-crypto.ps1
```
⏱️ **Time:** 2-3 minutes

### **Step 2: Generate Channel Artifacts**
```powershell
.\scripts\generate-channel-artifacts.ps1
```
⏱️ **Time:** 1-2 minutes

### **Step 3: Start Fabric Network**
```powershell
.\scripts\start-fabric-network.ps1
```
⏱️ **Time:** 2-3 minutes (first time)

### **Step 4: Create Channel**
```powershell
.\scripts\create-channel.ps1
```
⏱️ **Time:** 1 minute

### **Step 5: Setup Wallet**
```powershell
.\scripts\setup-fabric-wallet.ps1
```
⏱️ **Time:** 30 seconds

### **Step 6: Deploy Chaincode**
```powershell
.\scripts\deploy-chaincode.ps1
```
⏱️ **Time:** 2-3 minutes

---

## ⚙️ **Step 7: Configure Application**

### **Update .env file:**

Create or edit `.env` in project root:

```env
# Change from mock to fabric
BLOCKCHAIN_MODE=fabric

# Other settings
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
```

### **Restart Application:**

```powershell
npm start
```

---

## ✅ **VERIFY IT'S WORKING**

### **Check Network Status:**
```powershell
docker-compose -f docker-compose.fabric.yml ps
```

All containers should show "Up".

### **Check Application Logs:**
Look for:
```
✅ Real Hyperledger Fabric integration active
✅ Connected to channel: ltochannel
```

### **Test API:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/blockchain/status" -UseBasicParsing
```

Should return:
```json
{
  "success": true,
  "mode": "fabric",
  "network": "TrustChainNetwork"
}
```

---

## 🆘 **TROUBLESHOOTING**

### **Problem: Script fails at crypto generation**

**Solution:**
- Make sure Docker is running
- Check you have enough disk space (10GB+)
- Try: `docker system prune` to free space

### **Problem: Containers won't start**

**Solution:**
- Check ports are free: 7050-7054, 8050, 9050, 5984
- Check Docker has enough resources (4GB+ RAM)
- Check logs: `docker-compose -f docker-compose.fabric.yml logs`

### **Problem: Application still uses mock mode**

**Solution:**
1. Check `.env` has `BLOCKCHAIN_MODE=fabric`
2. Check wallet exists: `Test-Path wallet\admin`
3. Check Fabric is running: `docker ps | Select-String "fabric"`
4. Restart application

---

## 📊 **WHAT GETS CREATED**

After setup:
- `fabric-network/crypto-config/` - Certificates
- `fabric-network/channel-artifacts/` - Genesis block, channel config
- `wallet/` - Application wallet with admin identity
- Docker containers running Fabric network

---

## 🎯 **NEXT STEPS**

1. ✅ Test vehicle registration through UI
2. ✅ Check blockchain viewer for transactions
3. ✅ Query chaincode functions
4. ✅ View state in CouchDB: `http://localhost:5984/_utils`

---

**Total Setup Time:** ~10-15 minutes  
**Status:** ✅ Ready to use!

