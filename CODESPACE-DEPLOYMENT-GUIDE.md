# TrustChain LTO - Codespace Deployment Guide

Complete guide for deploying TrustChain LTO in GitHub Codespace.

## Quick Start (One Command)

After pulling the repository in Codespace, run:

```bash
bash scripts/codespace-setup.sh
```

This single command will:
1. Install all npm dependencies
2. Start Hyperledger Fabric network (orderers, peers, CLI)
3. Create and join the channel
4. Setup application wallet
5. Start core services (PostgreSQL, IPFS, Redis)
6. Deploy chaincode
7. Verify all services

## Manual Setup (Step-by-Step)

If you prefer manual control or need to troubleshoot:

### Step 1: Make scripts executable

```bash
chmod +x scripts/*.sh
```

### Step 2: Install dependencies

```bash
npm install

# Install chaincode dependencies
cd chaincode/vehicle-registration-production
npm install
cd ../..
```

### Step 3: Start all services

```bash
bash scripts/start-codespace.sh
```

### Step 4: Verify services

```bash
bash scripts/verify-services.sh
```

### Step 5: Deploy chaincode (if not already deployed)

```bash
bash scripts/complete-fabric-setup.sh
```

### Step 6: Start the application

```bash
npm start
```

### Step 7: Access the application

Open in browser: `http://localhost:3001`

**Default credentials:**
- Admin: `admin@lto.gov.ph` / `admin123`
- Owner: `owner@example.com` / `admin123`

## Services Overview

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| PostgreSQL | postgres | 5432 | Database |
| IPFS | ipfs | 5001, 8080 | Document storage |
| Redis | redis | 6379 | Caching |
| Fabric Peer | peer0.lto.gov.ph | 7051 | Blockchain peer |
| Orderer 1 | orderer1.lto.gov.ph | 7050 | Transaction ordering |
| CLI | cli | - | Fabric admin operations |

## Troubleshooting

### Containers not starting

```bash
# Check container status
docker ps -a

# Check logs for specific container
docker logs peer0.lto.gov.ph --tail 50
docker logs orderer1.lto.gov.ph --tail 50
```

### Channel creation fails

```bash
# Manually create channel
docker exec cli peer channel create \
    -o orderer1.lto.gov.ph:7050 \
    -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ltochannel.tx \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

### Peer not joining channel

```bash
# Fetch genesis block first
docker exec cli peer channel fetch 0 ltochannel.block \
    -o orderer1.lto.gov.ph:7050 \
    -c ltochannel \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Then join
docker exec cli peer channel join -b ltochannel.block
```

### Complete restart

```bash
# Stop everything
docker-compose -f docker-compose.fabric.yml down
docker-compose -f docker-compose.core.yml down

# Start fresh
bash scripts/start-codespace.sh
```

## Available Scripts

| Script | Purpose |
|--------|---------|
| `scripts/codespace-setup.sh` | Complete one-command setup |
| `scripts/start-codespace.sh` | Start all services |
| `scripts/generate-crypto.sh` | Generate crypto materials |
| `scripts/generate-channel-artifacts.sh` | Generate channel config |
| `scripts/complete-fabric-setup.sh` | Deploy chaincode |
| `scripts/verify-services.sh` | Check all services |

## Environment Configuration

The `.env` file should have these values for Codespace:

```env
# Database (use container name)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# IPFS (use container name)
IPFS_HOST=ipfs
IPFS_PORT=5001
STORAGE_MODE=ipfs

# Redis (use container name)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Blockchain
BLOCKCHAIN_MODE=fabric
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration
```

**Important**: Use container names (`postgres`, `ipfs`, `redis`) not `localhost`!

## Project Features

Once running, the system provides:

- **Vehicle Registration**: Register vehicles with blockchain verification
- **Ownership Transfer**: Transfer ownership with complete history
- **Document Storage**: Store documents on IPFS with blockchain hash
- **Multi-org Verification**: Insurance, Emission, HPG verification
- **History Tracking**: Complete ownership chain on blockchain

## Support

If issues persist:
1. Check container logs
2. Verify crypto materials exist
3. Ensure channel artifacts are generated
4. Restart all containers

For debugging:
```bash
# View all container status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check network
docker network inspect lto-network

# View CLI container environment
docker exec cli env | grep CORE
```
