# TrustChain LTO - Codespace Deployment Guide

Complete step-by-step guide for deploying TrustChain LTO system in GitHub Codespace with Hyperledger Fabric, PostgreSQL, IPFS, and Redis.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Deployment Steps](#deployment-steps)
4. [Service Verification](#service-verification)
5. [Application Startup](#application-startup)
6. [Troubleshooting](#troubleshooting)
7. [Common Issues](#common-issues)

---

## Prerequisites

### Required in Codespace

- **Docker**: Pre-installed in Codespace
- **Node.js**: Version 16+ (check with `node --version`)
- **Git**: Pre-installed
- **Bash**: Available in terminal

### Verify Prerequisites

```bash
# Check Docker
docker --version

# Check Node.js
node --version
npm --version

# Check Git
git --version
```

---

## Initial Setup

### Step 1: Pull Latest Changes

If you're working locally and pushing to GitHub:

```bash
# In your local terminal (PowerShell)
cd "C:\Users\MY COMPUTER\Documents\GitHub\LTOBLOCKCHAIN"
git add .
git commit -m "Add Codespace deployment scripts"
git push origin main
```

Then in Codespace:

```bash
# Pull latest changes
git pull origin main
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

This installs all required packages including `fabric-network`, `pg`, `ipfs-http-client`, etc.

### Step 3: Update Environment Variables

The `.env` file needs to be configured for Codespace. Use container names instead of `localhost`:

```bash
# Run the update script
bash scripts/update-env-codespace.sh

# Or manually edit .env and ensure these values:
```

**Required `.env` values for Codespace:**

```env
# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3001

# Database (use container name)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Redis (use container name)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# IPFS (use container name)
IPFS_HOST=ipfs
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs

# Blockchain (Fabric mode required)
BLOCKCHAIN_MODE=fabric
FABRIC_NETWORK_CONFIG=./network-config.json
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=change-this-to-a-random-secret-key-in-production
ENCRYPTION_KEY=change-this-to-a-random-encryption-key
```

**Important**: Use container names (`postgres`, `ipfs`, `redis`) not `localhost` in Codespace!

---

## Deployment Steps

### Automated Deployment (Recommended)

The easiest way is to use the automated startup script:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run the startup script
bash scripts/start-codespace.sh
```

This script will:
1. Check and generate channel artifacts if needed
2. Start Hyperledger Fabric network (orderers, peers, CLI)
3. Wait for orderers to be ready
4. Create channel and join peer
5. Setup application wallet
6. Start core services (PostgreSQL, IPFS, Redis)
7. Verify all services
8. Check chaincode status

**Time**: ~5-10 minutes (first time)

### Manual Deployment (Step-by-Step)

If you prefer manual control or need to troubleshoot:

#### Step 1: Generate Cryptographic Materials (if needed)

```bash
# Check if crypto materials exist
ls -la fabric-network/crypto-config/

# If not, generate them (you may need a bash version of generate-crypto.sh)
# For now, assume they exist or were generated previously
```

#### Step 2: Generate Channel Artifacts

```bash
bash scripts/generate-channel-artifacts.sh
```

This creates:
- `fabric-network/channel-artifacts/genesis.block`
- `fabric-network/channel-artifacts/ltochannel.tx`
- `fabric-network/channel-artifacts/LTOMSPanchors.tx`

#### Step 3: Start Fabric Network

```bash
docker-compose -f docker-compose.fabric.yml up -d
```

Wait 15-20 seconds for containers to start.

#### Step 4: Verify Orderers

```bash
# Check orderer logs
docker logs orderer1.lto.gov.ph --tail 20

# Should see "Starting orderer" message
```

#### Step 5: Create Channel and Join Peer

The startup script handles this, but manually:

```bash
# Create channel
docker exec cli peer channel create \
    -o orderer1.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Join peer to channel
docker exec cli peer channel join -b ltochannel.block

# Verify
docker exec cli peer channel list
```

#### Step 6: Setup Application Wallet

```bash
node scripts/setup-fabric-wallet.js
```

This creates `wallet/admin.id` with the admin identity.

#### Step 7: Start Core Services

```bash
docker-compose -f docker-compose.core.yml up -d postgres ipfs redis
```

Wait 10 seconds for services to initialize.

---

## Service Verification

### Quick Verification

Run the verification script:

```bash
bash scripts/verify-services.sh
```

This checks:
- PostgreSQL connectivity
- IPFS accessibility
- Redis responsiveness
- Fabric peer status
- Channel membership
- Chaincode installation
- Wallet existence
- All Docker containers

### Manual Verification

#### Check PostgreSQL

```bash
docker exec postgres pg_isready -U lto_user
# Should output: /var/run/postgresql:5432 - accepting connections
```

#### Check IPFS

```bash
curl -s http://localhost:5001/api/v0/version
# Should return JSON with IPFS version
```

#### Check Redis

```bash
docker exec redis redis-cli -a redis_password ping
# Should output: PONG
```

#### Check Fabric Peer

```bash
docker exec peer0.lto.gov.ph peer node status
# Should show peer status
```

#### Check Channel

```bash
docker exec cli peer channel list
# Should show: Channels peers has joined: ltochannel
```

#### Check Chaincode

```bash
docker exec cli peer lifecycle chaincode queryinstalled
# Should show vehicle-registration chaincode if installed
```

#### Check All Containers

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Should show:
- `postgres` - Up
- `ipfs` - Up
- `redis` - Up
- `peer0.lto.gov.ph` - Up
- `orderer1.lto.gov.ph` - Up
- `orderer2.lto.gov.ph` - Up
- `orderer3.lto.gov.ph` - Up
- `cli` - Up
- Other peers and CouchDB instances

---

## Application Startup

### Step 1: Deploy Chaincode (if not already deployed)

```bash
bash scripts/complete-fabric-setup.sh
```

This will:
- Package chaincode
- Install on peer
- Approve chaincode
- Commit to channel
- Test chaincode

**Note**: Chaincode deployment may take a few minutes.

### Step 2: Start Application

```bash
npm start
```

The application will:
- Connect to PostgreSQL
- Connect to IPFS
- Connect to Redis (if configured)
- Connect to Hyperledger Fabric
- Start on port 3001

### Step 3: Access Application

In Codespace, the application will be available at:
- **Local URL**: `http://localhost:3001`
- **Codespace URL**: Use the "Ports" tab in Codespace to expose port 3001

**Default Login Credentials:**
- Admin: `admin@lto.gov.ph` / `admin123`
- Owner: `owner@example.com` / `admin123`

---

## Troubleshooting

### Issue: Channel Creation Fails

**Error**: `Error: can't read the block: &{NOT_FOUND}`

**Solution**:
1. Ensure channel artifacts are generated:
   ```bash
   bash scripts/generate-channel-artifacts.sh
   ```
2. Check if channel transaction exists:
   ```bash
   ls -la fabric-network/channel-artifacts/ltochannel.tx
   ```
3. Create channel manually (see Step 5 in Manual Deployment)

### Issue: Peer Cannot Join Channel

**Error**: `Failed to join peer to channel`

**Solution**:
1. Verify orderers are running:
   ```bash
   docker logs orderer1.lto.gov.ph --tail 20
   ```
2. Check if channel was created:
   ```bash
   docker exec cli peer channel fetch 0 ltochannel.block -o orderer1.lto.gov.ph:7050 -c ltochannel --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
   ```
3. Try joining again:
   ```bash
   docker exec cli peer channel join -b ltochannel.block
   ```

### Issue: Chaincode Installation Fails

**Error**: `Package ID not found`

**Solution**:
1. Check peer logs:
   ```bash
   docker logs peer0.lto.gov.ph --tail 50 | grep -i chaincode
   ```
2. Verify chaincode directory exists in CLI:
   ```bash
   docker exec cli ls -la /opt/gopath/src/github.com/chaincode/vehicle-registration-production
   ```
3. Ensure node_modules are installed:
   ```bash
   # On host
   cd chaincode/vehicle-registration-production
   npm install
   ```

### Issue: Application Cannot Connect to Services

**Error**: Connection refused or timeout

**Solution**:
1. Verify `.env` uses container names, not `localhost`:
   ```bash
   grep -E "DB_HOST|IPFS_HOST|REDIS_HOST" .env
   ```
   Should show: `postgres`, `ipfs`, `redis`

2. Verify services are running:
   ```bash
   docker ps
   ```

3. Check application logs:
   ```bash
   npm start
   # Look for connection errors
   ```

### Issue: Wallet Not Found

**Error**: `Wallet not found` or `Admin identity not found`

**Solution**:
```bash
node scripts/setup-fabric-wallet.js
```

Verify wallet was created:
```bash
ls -la wallet/admin.id
```

---

## Common Issues

### Containers Stop After Codespace Sleeps

**Solution**: All containers have `restart: unless-stopped` policy. They should restart automatically. If not:

```bash
# Restart all services
docker-compose -f docker-compose.fabric.yml restart
docker-compose -f docker-compose.core.yml restart
```

### Port Conflicts

**Solution**: Codespace automatically handles port forwarding. If you see port conflicts:

1. Check what's using the port:
   ```bash
   docker ps --format "table {{.Names}}\t{{.Ports}}"
   ```

2. Stop conflicting containers or change ports in docker-compose files

### Out of Memory

**Solution**: 
- Stop unused containers
- Increase Codespace machine size (if available)
- Reduce number of peers/organizations if not needed

### DNS Resolution Issues

**Solution**: Restart all containers together:

```bash
docker-compose -f docker-compose.fabric.yml down
docker-compose -f docker-compose.fabric.yml up -d
```

---

## Quick Reference

### Essential Commands

```bash
# Start everything
bash scripts/start-codespace.sh

# Verify services
bash scripts/verify-services.sh

# Deploy chaincode
bash scripts/complete-fabric-setup.sh

# Check container status
docker ps

# View logs
docker logs <container-name> --tail 50

# Restart a service
docker restart <container-name>

# Stop everything
docker-compose -f docker-compose.fabric.yml down
docker-compose -f docker-compose.core.yml down
```

### Service URLs

- **Application**: http://localhost:3001
- **IPFS API**: http://localhost:5001
- **IPFS Gateway**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Important Files

- `scripts/start-codespace.sh` - Main startup script
- `scripts/generate-channel-artifacts.sh` - Generate channel artifacts
- `scripts/complete-fabric-setup.sh` - Deploy chaincode
- `scripts/verify-services.sh` - Verify all services
- `.env` - Environment configuration
- `network-config.json` - Fabric network configuration

---

## Next Steps

After successful deployment:

1. **Test Registration**: Register a vehicle through the application
2. **Test Transfer**: Transfer ownership of a vehicle
3. **View History**: Check vehicle ownership history
4. **Verify Documents**: Test document verification workflow

For development and testing, refer to the project documentation for API endpoints and workflows.

---

## Support

If you encounter issues not covered in this guide:

1. Check service logs: `docker logs <container-name>`
2. Verify all prerequisites are met
3. Review the troubleshooting section
4. Check GitHub issues or project documentation

---

**Last Updated**: December 2024
**Version**: 1.0

