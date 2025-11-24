# Hyperledger Fabric Components Extraction Guide

## Overview
This guide explains how to extract and use all open source Hyperledger Fabric components for the TrustChain LTO system. These components are **ready-to-use** and do not require custom coding.

---

## 📦 Open Source Components to Extract

### 1. Docker Images (Pre-built by Hyperledger)

These Docker images are provided by Hyperledger Fabric and can be directly pulled from Docker Hub:

| Component | Docker Image | Purpose |
|-----------|--------------|---------|
| **Peer Node** | `hyperledger/fabric-peer:2.5` | Maintains ledger, executes chaincode |
| **Orderer Node** | `hyperledger/fabric-orderer:2.5` | Orders transactions, creates blocks (Raft consensus) |
| **Certificate Authority** | `hyperledger/fabric-ca:1.5` | Manages digital identities and certificates |
| **Fabric Tools** | `hyperledger/fabric-tools:2.5` | CLI tools for network operations |
| **CouchDB** | `couchdb:3.2` | State database for rich queries |

### 2. npm Packages (SDK Libraries)

These npm packages provide the application programming interface to interact with Fabric:

| Package | Version | Purpose |
|---------|---------|---------|
| **fabric-network** | `^2.2.20` | Gateway API for connecting to Fabric network |
| **fabric-ca-client** | `^2.2.20` | Client library for Certificate Authority operations |
| **fabric-contract-api** | `^2.2.0` | Chaincode API framework (for chaincode development) |

---

## 🚀 Quick Extraction

### Method 1: Using the Extraction Script (Recommended)

Run the automated extraction script:

```powershell
.\scripts\extract-fabric-components.ps1
```

This script will:
- ✅ Pull all required Docker images
- ✅ Install npm packages
- ✅ Verify installation
- ✅ Provide extraction summary

### Method 2: Manual Extraction

#### Step 1: Pull Docker Images

```powershell
# Pull all required Docker images
docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-ca:1.5
docker pull hyperledger/fabric-tools:2.5
docker pull couchdb:3.2
```

#### Step 2: Install npm Packages

```powershell
# Install Fabric SDK packages
npm install fabric-network@^2.2.20
npm install fabric-ca-client@^2.2.20

# Install chaincode dependencies (if developing chaincode)
cd chaincode/vehicle-registration-production
npm install
cd ../..
```

---

## ✅ Verification

### Check Docker Images

```powershell
# List all Hyperledger Fabric images
docker images | Select-String "hyperledger"

# Verify specific images
docker images hyperledger/fabric-peer:2.5
docker images hyperledger/fabric-orderer:2.5
docker images hyperledger/fabric-ca:1.5
docker images hyperledger/fabric-tools:2.5
docker images couchdb:3.2
```

Expected output should show all images with their sizes.

### Check npm Packages

```powershell
# Check if packages are installed
npm list fabric-network
npm list fabric-ca-client

# Or check package.json
cat package.json | Select-String "fabric"
```

---

## 📁 Configuration Files Created

After extraction, the following configuration files are available in the workspace:

1. **`network-config.yaml`** - Connection profile for Fabric SDK
2. **`docker-compose.fabric.yml`** - Complete Fabric network setup
3. **`docker-compose.production.yml`** - Full production setup (includes Fabric + App)
4. **`crypto-config.yaml`** - Cryptographic material configuration
5. **`configtx.yaml`** - Channel and network configuration

---

## 🎯 What's Extracted vs. What You Build

### ✅ Extracted (Open Source - Ready to Use)

- **Docker Images**: Peer, Orderer, CA, Tools, CouchDB
- **npm SDKs**: fabric-network, fabric-ca-client
- **Configuration Templates**: File formats and schemas

### 🎨 Custom Built (Your Design)

- **Chaincode**: Business logic in `chaincode/vehicle-registration-production/index.js`
- **Network Configuration**: Your organization structure in `crypto-config.yaml` and `configtx.yaml`
- **Application Integration**: How your app uses Fabric in `backend/services/fabricService.js`
- **Docker Compose Config**: Your network topology in `docker-compose.fabric.yml`

---

## 🔧 Using Extracted Components

### Start Fabric Network

```powershell
# Start only Fabric components
docker-compose -f docker-compose.fabric.yml up -d

# Or start full production setup
docker-compose -f docker-compose.production.yml up -d
```

### Connect Application to Fabric

The application uses `network-config.yaml` to connect:

```javascript
// In backend/services/fabricService.js
const connectionProfile = require('../../network-config.yaml');
await gateway.connect(connectionProfile, {
    wallet: wallet,
    identity: 'admin',
    discovery: { enabled: true, asLocalhost: true }
});
```

---

## 📊 Component Summary

| Component | Source | Status | Location |
|-----------|--------|--------|----------|
| Peer Node | Hyperledger | ✅ Extract | `docker-compose.fabric.yml` |
| Orderer Node | Hyperledger | ✅ Extract | `docker-compose.fabric.yml` |
| Certificate Authority | Hyperledger | ✅ Extract | `docker-compose.fabric.yml` |
| CouchDB | Apache | ✅ Extract | `docker-compose.fabric.yml` |
| Fabric Tools | Hyperledger | ✅ Extract | `docker-compose.fabric.yml` |
| fabric-network SDK | npm | ✅ Extract | `package.json` |
| fabric-ca-client SDK | npm | ✅ Extract | `package.json` |
| Chaincode Logic | Your Design | 🎨 Custom | `chaincode/vehicle-registration-production/` |
| Network Config | Your Design | 🎨 Custom | `crypto-config.yaml`, `configtx.yaml` |

---

## 🐛 Troubleshooting

### Docker Images Not Found

If Docker images fail to pull:

```powershell
# Check Docker is running
docker ps

# Try pulling individually
docker pull hyperledger/fabric-peer:2.5

# Check internet connection
ping docker.io
```

### npm Packages Installation Issues

```powershell
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

### Port Conflicts

If ports are already in use:

```powershell
# Check what's using the ports
netstat -ano | findstr :7051
netstat -ano | findstr :7054

# Update port mappings in docker-compose files if needed
```

---

## 📚 Next Steps

After extraction:

1. **Generate Crypto Material**: Use Fabric CA to create certificates
2. **Create Genesis Block**: Generate network genesis block
3. **Start Network**: Launch Fabric network using Docker Compose
4. **Deploy Chaincode**: Install and instantiate your chaincode
5. **Connect Application**: Update application to use real Fabric network

See `UPGRADE-TO-HYPERLEDGER-FABRIC.md` for detailed setup instructions.

---

## 📝 Notes

- **Docker Images**: These are large (several GB each). Ensure sufficient disk space.
- **Version Compatibility**: All components use compatible versions (Fabric 2.5, CA 1.5).
- **Network Requirements**: Docker Desktop must be running with WSL2 backend (Windows).
- **Resource Requirements**: Minimum 8GB RAM, 50GB disk space recommended.

---

**Last Updated**: 2025-01-XX

