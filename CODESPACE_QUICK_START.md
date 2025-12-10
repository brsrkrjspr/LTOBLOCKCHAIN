# 🚀 Codespace Quick Start Guide

## Starting the Project in GitHub Codespace

### **Option 1: One-Command Start (Recommended)**

After pulling the repository in Codespace, run this single command:

```bash
bash scripts/codespace-restart.sh
```

This script will automatically:
1. ✅ Start all Docker containers (Fabric, PostgreSQL, IPFS, Redis)
2. ✅ Create Fabric channel (if not exists)
3. ✅ Deploy chaincode (if not deployed)
4. ✅ Setup Fabric wallet (if not exists)
5. ✅ Verify all services are running

**Time:** ~2-3 minutes

---

### **Option 2: Step-by-Step Manual Start**

If you prefer manual control or need to troubleshoot:

#### **Step 1: Make Scripts Executable**
```bash
chmod +x scripts/*.sh
```

#### **Step 2: Install Dependencies**
```bash
# Install Node.js dependencies
npm install

# Install chaincode dependencies
cd chaincode/vehicle-registration-production
npm install
cd ../..
```

#### **Step 3: Start Docker Containers**
```bash
docker-compose -f docker-compose.unified.yml up -d
```

Wait ~30 seconds for containers to initialize.

#### **Step 4: Verify Containers Are Running**
```bash
docker ps
```

You should see these containers running:
- `orderer.lto.gov.ph`
- `peer0.lto.gov.ph`
- `couchdb`
- `cli`
- `postgres`
- `ipfs`
- `redis`

#### **Step 5: Run Complete Setup**
```bash
bash scripts/codespace-restart.sh
```

This will handle channel creation, chaincode deployment, and wallet setup.

#### **Step 6: Start the Application**
```bash
npm start
```

The application will start on port `3001`.

---

## 🌐 Accessing the Application

### **In Codespace:**

1. **Port Forwarding:** GitHub Codespace automatically forwards port 3001
2. **Access URL:** Look for the port forwarding notification in Codespace, or use:
   ```
   https://{your-workspace-id}-3001.app.github.dev
   ```
3. **Or use:** Click the "Ports" tab in Codespace and click on port 3001

### **Default Login Credentials:**

- **Admin:** 
  - Email: `admin@lto.gov.ph`
  - Password: `admin123`

- **Vehicle Owner:** 
  - Email: `owner@example.com`
  - Password: `admin123`

---

## ✅ Verification Checklist

After starting, verify everything is working:

### **1. Check Docker Containers**
```bash
docker ps
```
All 7 containers should be running.

### **2. Check Database**
```bash
docker exec postgres pg_isready -U lto_user
```
Should return: `postgres:5432 - accepting connections`

### **3. Check IPFS**
```bash
curl http://localhost:5001/api/v0/version
```
Should return IPFS version info.

### **4. Check Fabric Network**
```bash
docker logs peer0.lto.gov.ph --tail 20
```
Should show peer is running and connected.

### **5. Check Application**
```bash
curl http://localhost:3001/api/health
```
Should return: `{"status":"OK","message":"TrustChain LTO System is running"}`

---

## 🔄 After Codespace Restart

If your Codespace restarts (containers stop), simply run:

```bash
bash scripts/codespace-restart.sh
```

This will bring everything back up.

---

## 🐛 Troubleshooting

### **Containers Not Starting**
```bash
# Check container status
docker ps -a

# Check logs
docker logs orderer.lto.gov.ph --tail 50
docker logs peer0.lto.gov.ph --tail 50
```

### **Channel Creation Fails**
```bash
# Check if channel exists
docker exec cli peer channel list

# If missing, the restart script will create it automatically
```

### **Chaincode Not Deployed**
```bash
# Check chaincode status
docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration

# If missing, run:
bash scripts/redeploy-chaincode.sh
```

### **Wallet Missing**
```bash
# Check if wallet exists
ls wallet/

# If missing, create it:
node scripts/setup-fabric-wallet.js
```

### **Port Not Accessible**
- Check Codespace "Ports" tab
- Ensure port 3001 is forwarded
- Try accessing via the GitHub-provided URL

---

## 📝 Next Steps

After the application starts:

1. ✅ Open the application in your browser (use Codespace port forwarding URL)
2. ✅ Login with admin credentials
3. ✅ Test vehicle registration
4. ✅ Check blockchain viewer (`admin-blockchain-viewer.html`)

---

## 🆘 Need Help?

- Check `TROUBLESHOOTING.md` for detailed error solutions
- Check `CODESPACE-DEPLOYMENT-GUIDE.md` for comprehensive guide
- Check container logs: `docker logs {container-name}`

---

**Quick Reference:**
- **Start everything:** `bash scripts/codespace-restart.sh`
- **Start app only:** `npm start`
- **Check status:** `docker ps`
- **View logs:** `docker logs {container-name}`

