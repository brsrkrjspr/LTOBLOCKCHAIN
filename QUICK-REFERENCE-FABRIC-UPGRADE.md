# 🚀 Quick Reference: Upgrade to Hyperledger Fabric

## One-Command Upgrade (Automated)

```powershell
.\scripts\upgrade-to-fabric.ps1
```

This script will:
- ✅ Check prerequisites
- ✅ Start Fabric network
- ✅ Setup wallet
- ✅ Update environment configuration
- ✅ Verify setup

## Manual Steps (If Automated Fails)

### 1. Start Fabric Network
```powershell
cd fabric-network
docker-compose -f docker-compose.fabric.yml up -d
```

### 2. Setup Wallet
```powershell
node scripts/setup-fabric-wallet.js
```

### 3. Update Environment
Edit `.env`:
```env
BLOCKCHAIN_MODE=fabric
```

### 4. Restart Application
```powershell
docker-compose -f docker-compose.production-no-ipfs.yml restart lto-app-prod
```

### 5. Verify Connection
```powershell
curl http://localhost:3001/api/blockchain/status
```

## Common Commands

### Check Fabric Network Status
```powershell
docker ps | findstr fabric
docker logs peer0.lto.gov.ph
docker logs orderer1.lto.gov.ph
```

### Check Wallet
```powershell
ls wallet
```

### Check Application Logs
```powershell
docker-compose -f docker-compose.production-no-ipfs.yml logs -f lto-app-prod
```

### Test Blockchain Connection
```powershell
curl http://localhost:3001/api/blockchain/status
```

## Troubleshooting

**"Wallet not found"**
```powershell
node scripts/setup-fabric-wallet.js
```

**"Network configuration not found"**
- Ensure `network-config.yaml` exists in project root
- Check paths in configuration file

**"Connection timeout"**
- Verify Fabric network is running: `docker ps`
- Check network-config.yaml has correct ports
- Ensure certificates are generated

**"Chaincode not found"**
- Deploy chaincode first (see full guide)
- Check chaincode is committed to channel

## Full Documentation

For detailed instructions, see: `UPGRADE-TO-HYPERLEDGER-FABRIC.md`

