# Real Services Setup Guide
## Using Real IPFS, Hyperledger Fabric, and PostgreSQL

This guide will help you configure and run the TrustChain LTO system with **real services** instead of mock/fallback implementations.

---

## 🎯 What This Changes

### Before (Mock/Fallback Mode)
- ❌ Mock blockchain (in-memory/file-based)
- ❌ Local file storage (no IPFS)
- ✅ PostgreSQL (already real)

### After (Real Services Mode)
- ✅ **Real Hyperledger Fabric** blockchain network
- ✅ **Real IPFS** network for document storage
- ✅ **Real PostgreSQL** database

---

## 📋 Prerequisites

1. **Docker Desktop** installed and running
2. **Node.js** 16+ and npm installed
3. **PowerShell** (for Windows) or Bash (for Linux/macOS)
4. **At least 8GB RAM** available for Docker
5. **At least 20GB free disk space**

---

## 🚀 Quick Start (Automated)

### Step 1: Create Environment File

Copy the production environment template:

```powershell
Copy-Item .env.production .env
```

**Important**: Edit `.env` and change the security keys:
- `JWT_SECRET` - Generate a random secret key
- `ENCRYPTION_KEY` - Generate a random encryption key

### Step 2: Run the Startup Script

```powershell
.\start-real-services.ps1
```

This script will:
1. ✅ Check Docker is running
2. ✅ Create `.env` from template if needed
3. ✅ Set up Hyperledger Fabric network (if not already set up)
4. ✅ Start all services (PostgreSQL, IPFS, Fabric, Application)
5. ✅ Verify all services are healthy

**Time**: ~5-10 minutes (first time, includes Fabric setup)

---

## 📝 Manual Setup (Step-by-Step)

If you prefer to set up manually or troubleshoot:

### Step 1: Set Up Hyperledger Fabric Network

```powershell
# Run complete Fabric setup
.\scripts\complete-fabric-setup.ps1
```

This will:
- Generate cryptographic materials
- Generate channel artifacts
- Start Fabric network
- Create and join channel
- Set up application wallet
- Deploy chaincode

**Time**: ~5-7 minutes

### Step 2: Start All Services

```powershell
# Start all services
docker-compose -f docker-compose.production.yml up -d
```

### Step 3: Verify Services

```powershell
# Check PostgreSQL
docker exec postgres pg_isready -U lto_user

# Check IPFS
Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST

# Check Fabric Peer
docker exec peer0.lto.gov.ph peer node status

# Check Application
Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET
```

---

## 🔧 Configuration

### Environment Variables

The system uses environment variables to configure services. Key variables in `.env`:

#### Database (PostgreSQL)
```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password
```

#### IPFS
```env
IPFS_HOST=ipfs-node-1
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs  # Options: 'ipfs', 'local', 'auto'
```

#### Blockchain (Hyperledger Fabric)
```env
BLOCKCHAIN_MODE=fabric  # Options: 'fabric', 'mock'
FABRIC_NETWORK_CONFIG=./network-config.yaml
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration
```

### Storage Modes

**`STORAGE_MODE=ipfs`** (Recommended for Real Services)
- Uses real IPFS network
- Documents stored on IPFS
- Falls back to local if IPFS unavailable

**`STORAGE_MODE=auto`**
- Tries IPFS first
- Automatically falls back to local if IPFS unavailable
- Good for development/testing

**`STORAGE_MODE=local`**
- Uses local file storage only
- No IPFS (mock mode)

### Blockchain Modes

**`BLOCKCHAIN_MODE=fabric`** (Real Services)
- Uses real Hyperledger Fabric network
- Transactions on actual blockchain
- Requires Fabric network to be running

**`BLOCKCHAIN_MODE=mock`**
- Uses mock blockchain (file-based)
- No real blockchain network needed
- Good for development/testing

---

## 🌐 Service Endpoints

Once services are running, you can access:

| Service | URL | Purpose |
|---------|-----|---------|
| **Application** | http://localhost:3001 | Main web application |
| **PostgreSQL** | localhost:5432 | Database |
| **Redis** | localhost:6379 | Cache |
| **IPFS Gateway** | http://localhost:8080 | IPFS web gateway |
| **IPFS API** | http://localhost:5001 | IPFS API |
| **Fabric Peer** | localhost:7051 | Fabric peer node |
| **Fabric CA** | localhost:7054 | Certificate Authority |
| **CouchDB** | http://localhost:5984 | Fabric state database |
| **Prometheus** | http://localhost:9090 | Metrics |
| **Grafana** | http://localhost:3000 | Dashboards |

---

## ✅ Verifying Real Services Are Active

### Check Application Logs

```powershell
# View application logs
docker logs lto-app -f
```

Look for these messages:
- ✅ `Connected to IPFS version X.X.X` (Real IPFS)
- ✅ `Connected to Hyperledger Fabric network` (Real Fabric)
- ✅ `PostgreSQL connection successful` (Real PostgreSQL)

### Check Service Status via API

```powershell
# Get health status
Invoke-RestMethod -Uri "http://localhost:3001/api/health/detailed" -Method GET
```

Response should show:
```json
{
  "status": "healthy",
  "database": { "status": "connected", "type": "postgresql" },
  "blockchain": { "status": "connected", "type": "fabric", "mode": "fabric" },
  "storage": { "status": "connected", "type": "ipfs", "mode": "ipfs" }
}
```

### Check IPFS

```powershell
# Get IPFS node info
Invoke-RestMethod -Uri "http://localhost:5001/api/v0/id" -Method POST
```

### Check Fabric

```powershell
# Check Fabric peer status
docker exec peer0.lto.gov.ph peer node status
```

---

## 🔍 Troubleshooting

### IPFS Not Connecting

**Problem**: Application shows "IPFS is not connected"

**Solutions**:
1. Check IPFS container is running:
   ```powershell
   docker ps | Select-String "ipfs"
   ```

2. Check IPFS is accessible:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST
   ```

3. Restart IPFS:
   ```powershell
   docker restart ipfs-node-1
   ```

### Fabric Not Connecting

**Problem**: Application shows "Failed to connect to Fabric network"

**Solutions**:
1. Check Fabric network is running:
   ```powershell
   docker ps | Select-String "peer|orderer|ca"
   ```

2. Verify wallet exists:
   ```powershell
   Test-Path "wallet\admin.id"
   ```

3. Re-run Fabric setup:
   ```powershell
   .\scripts\complete-fabric-setup.ps1
   ```

4. Check network config exists:
   ```powershell
   Test-Path "network-config.yaml"
   ```

### PostgreSQL Not Connecting

**Problem**: Application shows "PostgreSQL connection failed"

**Solutions**:
1. Check PostgreSQL container:
   ```powershell
   docker ps | Select-String "postgres"
   ```

2. Check PostgreSQL logs:
   ```powershell
   docker logs postgres
   ```

3. Restart PostgreSQL:
   ```powershell
   docker restart postgres
   ```

### Services Not Starting

**Problem**: Docker containers fail to start

**Solutions**:
1. Check Docker has enough resources (8GB+ RAM)
2. Check ports are not in use:
   ```powershell
   netstat -ano | findstr "3001 5432 5001 7051"
   ```
3. Stop conflicting containers:
   ```powershell
   docker-compose -f docker-compose.production.yml down
   ```
4. Start fresh:
   ```powershell
   docker-compose -f docker-compose.production.yml up -d
   ```

---

## 📊 Monitoring Services

### View All Container Status

```powershell
docker-compose -f docker-compose.production.yml ps
```

### View Logs

```powershell
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker logs lto-app -f
docker logs postgres -f
docker logs ipfs-node-1 -f
docker logs peer0.lto.gov.ph -f
```

### Resource Usage

```powershell
docker stats
```

---

## 🛑 Stopping Services

```powershell
# Stop all services
docker-compose -f docker-compose.production.yml down

# Stop and remove volumes (⚠️ deletes data)
docker-compose -f docker-compose.production.yml down -v
```

---

## 🔄 Switching Between Modes

### From Mock to Real Services

1. Update `.env`:
   ```env
   STORAGE_MODE=ipfs
   BLOCKCHAIN_MODE=fabric
   ```

2. Start real services:
   ```powershell
   .\start-real-services.ps1
   ```

### From Real Services to Mock

1. Update `.env`:
   ```env
   STORAGE_MODE=local
   BLOCKCHAIN_MODE=mock
   ```

2. Stop real services:
   ```powershell
   docker-compose -f docker-compose.production.yml down
   ```

3. Start application only:
   ```powershell
   npm start
   ```

---

## 📚 Additional Resources

- **Fabric Setup**: See `FABRIC-INTEGRATION-GUIDE.md`
- **IPFS Setup**: See `IPFS-INTEGRATION-GUIDE.md`
- **PostgreSQL Setup**: See `POSTGRESQL-INTEGRATION-GUIDE.md`
- **Production Setup**: See `PRODUCTION-SETUP-GUIDE.md`

---

## ✅ Summary

With real services configured:

- ✅ **PostgreSQL**: Real database with persistent storage
- ✅ **IPFS**: Real decentralized document storage
- ✅ **Hyperledger Fabric**: Real blockchain network with immutable ledger

All services are production-ready and can be used for:
- Capstone project demonstration
- Academic evaluation
- Real-world deployment (with proper security configuration)

---

**Last Updated**: 2025-01-XX  
**Status**: ✅ Ready for Real Services

