# 🚀 TrustChain LTO - DigitalOcean Deployment Guide

## Overview
Complete step-by-step guide for deploying TrustChain LTO Blockchain Vehicle Registration System on DigitalOcean.

**Target:** DigitalOcean Droplet - 8GB RAM, 4 CPU ($48/month)  
**OS:** Ubuntu 22.04 LTS  
**Estimated Time:** 30-45 minutes

---

## Prerequisites

### 1. DigitalOcean Account
- ✅ Active DigitalOcean account
- ✅ Payment method configured
- ✅ SSH key added to DigitalOcean (recommended)

### 2. Local Machine Requirements
- ✅ SSH client installed
- ✅ Git installed (if using Git deployment)
- ✅ Terminal/Command prompt access

---

## Step 1: Create DigitalOcean Droplet

### 1.1 Create New Droplet
1. Log in to [DigitalOcean Dashboard](https://cloud.digitalocean.com)
2. Click **"Create"** → **"Droplets"**
3. Configure:
   - **Image:** Ubuntu 22.04 (LTS) x64
   - **Plan:** Regular - $48/month
     - 8GB RAM
     - 4 vCPU
     - 160GB SSD
   - **Region:** Choose closest to your users
   - **Authentication:** SSH keys (recommended) or root password
   - **Hostname:** `lto-blockchain` (optional)
   - **Tags:** `production`, `blockchain` (optional)
4. Click **"Create Droplet"**
5. Wait 1-2 minutes for droplet to be created

### 1.2 Note Your Droplet IP
- Copy the **IPv4 address** (e.g., `157.230.123.45`)
- You'll need this for SSH access

---

## Step 2: Connect to Droplet

### 2.1 SSH into Droplet
```bash
# Replace YOUR_DROPLET_IP with your actual IP
ssh root@YOUR_DROPLET_IP

# Or if using SSH key:
ssh -i ~/.ssh/your_key root@YOUR_DROPLET_IP
```

### 2.2 Update System
```bash
# Update package list
apt-get update

# Upgrade system packages
apt-get upgrade -y

# Install essential tools
apt-get install -y curl wget git nano
```

---

## Step 3: Install Docker and Docker Compose

### 3.1 Install Docker
```bash
# Install Docker using official script
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify Docker installation
docker --version
# Should show: Docker version 24.x.x or higher

# Test Docker
docker run hello-world
# Should see: "Hello from Docker!" message
```

### 3.2 Install Docker Compose Plugin
```bash
# Install Docker Compose plugin
apt-get update
apt-get install docker-compose-plugin -y

# Verify Docker Compose
docker compose version
# Should show: Docker Compose version v2.x.x or higher
```

**Note:** If you're not root, add your user to docker group:
```bash
usermod -aG docker $USER
# Then logout and login again for changes to take effect
```

---

## Step 4: Configure Firewall

### 4.1 Enable UFW Firewall
```bash
# Allow SSH (important - do this first!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow Application Port
ufw allow 3001/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

**Expected Output:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
3001/tcp                   ALLOW       Anywhere
```

---

## Step 5: Upload Project Files

### Option A: Using Git (Recommended)
```bash
# Create project directory
mkdir -p /opt/lto-blockchain
cd /opt/lto-blockchain

# Clone repository (replace with your repo URL)
git clone https://github.com/your-username/your-repo.git .

# Or if repository is private, use SSH:
# git clone git@github.com:your-username/your-repo.git .
```

### Option B: Using SCP (from local machine)
```bash
# From your local machine terminal:
# Replace YOUR_DROPLET_IP with your actual IP
scp -r . root@YOUR_DROPLET_IP:/opt/lto-blockchain/
```

### 5.1 Verify Files Uploaded
```bash
cd /opt/lto-blockchain

# Check essential files exist
ls -la docker-compose.unified.yml
ls -la Dockerfile.production
ls -la network-config.json
ls -la package.json
ls -la server.js
ls -la ENV.example
```

---

## Step 6: Configure Environment Variables

### 6.1 Create .env File
```bash
cd /opt/lto-blockchain

# Copy example file
cp ENV.example .env

# Edit .env file
nano .env
```

### 6.2 Generate Secure Secrets
```bash
# Generate JWT Secret (48 characters)
openssl rand -base64 32

# Generate Encryption Key (32 characters)
openssl rand -base64 24 | head -c 32
```

### 6.3 Update .env File
Edit `.env` and set:
```bash
JWT_SECRET=<paste-generated-jwt-secret-here>
ENCRYPTION_KEY=<paste-generated-encryption-key-here>

# Optional: Change database passwords (recommended)
POSTGRES_PASSWORD=your-secure-postgres-password
COUCHDB_PASSWORD=your-secure-couchdb-password
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

---

## Step 7: Setup Hyperledger Fabric Network

### 7.1 Generate Cryptographic Materials
```bash
cd /opt/lto-blockchain

# Make scripts executable
chmod +x scripts/*.sh

# Generate crypto materials
bash scripts/generate-crypto.sh
```

**Expected Output:**
```
🔐 Generating Hyperledger Fabric cryptographic materials...
✅ Created crypto-config directory
✅ Cryptographic materials generated successfully!
```

**Verification:**
```bash
# Check crypto materials exist
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/
ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/
```

### 7.2 Generate Channel Artifacts
```bash
# Generate channel artifacts
bash scripts/generate-channel-artifacts.sh
```

**Expected Output:**
```
📦 Generating channel artifacts...
✅ Genesis block generated
✅ Channel transaction created
```

**Verification:**
```bash
# Check channel artifacts exist
ls -la fabric-network/channel-artifacts/
# Should see: genesis.block, channel.tx, ltochannel.tx
```

### 7.3 Install Node.js Dependencies
```bash
cd ~/LTOBLOCKCHAIN

# Install Node.js dependencies (required for wallet setup)
npm install

# This will install all required packages including fabric-network
```

**Expected Output:**
```
added 234 packages, and audited 235 packages in 30s
```

**Note:** This step is required before running wallet setup scripts as they need the `fabric-network` module.

### 7.4 Setup Fabric Wallet
```bash
# Setup wallet for application
bash scripts/setup-wallet-only.sh
```

**Expected Output:**
```
🔐 Setting up Fabric wallet...
✅ Wallet setup complete!
```

**Verification:**
```bash
# Check wallet exists
ls -la wallet/
# Should see: admin.id
```

---

## Step 8: Pre-Flight Checklist

**Before running Docker Compose, verify all prerequisites are complete:**

### 8.1 Verify Required Files and Directories

```bash
cd ~/LTOBLOCKCHAIN

# Check essential files exist
echo "Checking files..."
ls -la docker-compose.unified.yml && echo "✅ docker-compose.unified.yml"
ls -la Dockerfile.production && echo "✅ Dockerfile.production"
ls -la network-config.json && echo "✅ network-config.json"
ls -la .env && echo "✅ .env file"
ls -la package.json && echo "✅ package.json"

# Check Fabric crypto materials
echo "Checking Fabric crypto materials..."
ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/ && echo "✅ Orderer MSP"
ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/server.crt && echo "✅ Orderer TLS certs"
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/ && echo "✅ Peer MSP"
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/server.crt && echo "✅ Peer TLS certs"

# Check channel artifacts
echo "Checking channel artifacts..."
ls -la fabric-network/channel-artifacts/genesis.block && echo "✅ Genesis block"
ls -la fabric-network/channel-artifacts/ltochannel.tx && echo "✅ Channel transaction"

# Check wallet
echo "Checking wallet..."
ls -la wallet/ && echo "✅ Wallet directory exists"
ls -la wallet/admin.id && echo "✅ Admin identity in wallet"

# Check Node.js dependencies
echo "Checking Node.js dependencies..."
test -d node_modules && echo "✅ node_modules exists" || echo "❌ Run 'npm install' first"
```

### 8.2 Verify Environment Variables

```bash
# Check .env file has required secrets
grep -q "JWT_SECRET=" .env && echo "✅ JWT_SECRET set" || echo "❌ JWT_SECRET missing"
grep -q "ENCRYPTION_KEY=" .env && echo "✅ ENCRYPTION_KEY set" || echo "❌ ENCRYPTION_KEY missing"

# Check they're not default values
grep "JWT_SECRET=CHANGE-THIS" .env && echo "⚠️  JWT_SECRET is default value" || echo "✅ JWT_SECRET is custom"
grep "ENCRYPTION_KEY=CHANGE-THIS" .env && echo "⚠️  ENCRYPTION_KEY is default value" || echo "✅ ENCRYPTION_KEY is custom"
```

### 8.3 Verify Docker is Running

```bash
# Check Docker daemon
docker ps > /dev/null 2>&1 && echo "✅ Docker is running" || echo "❌ Docker is not running"

# Check Docker Compose
docker compose version > /dev/null 2>&1 && echo "✅ Docker Compose available" || echo "❌ Docker Compose not found"
```

---

## Step 9: Deploy Services

### 9.0 Quick Status Check (After SSH Reconnection)
```bash
cd ~/LTOBLOCKCHAIN

# Run quick status check to see what's needed
chmod +x scripts/quick-status-check.sh
bash scripts/quick-status-check.sh
```

This will show you:
- ✅ What's already set up
- ❌ What's missing
- ⚠️  What needs attention
- 📋 Next steps to complete deployment

### 9.1 Start All Services
```bash
cd ~/LTOBLOCKCHAIN

# Start all services in detached mode
docker compose -f docker-compose.unified.yml up -d
```

**Expected Output:**
```
[+] Running 7/7
 ✔ Network trustchain              Created
 ✔ Volume "lto-blockchain_orderer-data"  Created
 ✔ Volume "lto-blockchain_couchdb-data"  Created
 ✔ Volume "lto-blockchain_peer-data"     Created
 ✔ Volume "lto-blockchain_postgres-data" Created
 ✔ Volume "lto-blockchain_ipfs-data"    Created
 ✔ Volume "lto-blockchain_app-uploads"  Created
 ✔ Container orderer.lto.gov.ph         Started
 ✔ Container couchdb                   Started
 ✔ Container peer0.lto.gov.ph          Started
 ✔ Container postgres                   Started
 ✔ Container ipfs                       Started
 ✔ Container lto-app                    Started
```

### 9.2 Verify Services Are Running
```bash
# Check service status
docker compose -f docker-compose.unified.yml ps
```

**Expected Output:**
```
NAME                  STATUS
orderer.lto.gov.ph    Up
couchdb               Up (healthy)
peer0.lto.gov.ph      Up
postgres              Up (healthy)
ipfs                  Up (healthy)
lto-app               Up (healthy)
```

**⚠️ If IPFS shows "Restarting":**
```bash
# Check IPFS logs for version mismatch
docker compose -f docker-compose.unified.yml logs ipfs --tail=20

# If you see "version (15) is lower than your repos (18)", fix it:
bash scripts/fix-ipfs-volume.sh

# Then restart IPFS
docker compose -f docker-compose.unified.yml up -d ipfs
```

### 9.3 Check Resource Usage
```bash
# Monitor resource usage
docker stats --no-stream
```

**Expected:** Total RAM usage should be ~5-6GB (fits 8GB droplet)

### 9.4 Check Logs
```bash
# View all logs
docker compose -f docker-compose.unified.yml logs

# View specific service logs
docker compose -f docker-compose.unified.yml logs lto-app
docker compose -f docker-compose.unified.yml logs postgres
docker compose -f docker-compose.unified.yml logs peer0.lto.gov.ph
```

**Look for:**
- ✅ `Connected to Hyperledger Fabric network successfully`
- ✅ `PostgreSQL connection successful`
- ✅ `Using IPFS storage mode`

---

## Step 10: Initialize Fabric Channel and Chaincode

**⚠️ IMPORTANT:** The application cannot connect to Fabric until the channel is created and chaincode is deployed.

### 10.1 Setup Channel (All-in-One Script)
```bash
cd ~/LTOBLOCKCHAIN

# Make script executable
chmod +x scripts/setup-fabric-channel.sh

# Create channel and join peer (no CLI container needed)
bash scripts/setup-fabric-channel.sh
```

**Expected Output:**
```
🔗 Setting up Fabric channel...
📦 Step 1: Creating channel...
✅ Channel created successfully
🔗 Step 2: Joining peer to channel...
✅ Peer joined channel successfully
📋 Step 3: Verifying channel...
🎉 Channel setup complete!
```

**Verification:**
```bash
# Verify peer is in channel
docker exec peer0.lto.gov.ph peer channel list
# Should show: ltochannel
```

### 10.2 Install Chaincode
```bash
# Make script executable
chmod +x scripts/install-chaincode.sh

# Install chaincode
bash scripts/install-chaincode.sh
```

**Expected Output:**
```
📦 Installing chaincode...
📋 Copying chaincode to peer...
📦 Installing chaincode...
✅ Chaincode installed successfully
🎉 Chaincode installation complete!
```

### 10.3 Instantiate Chaincode
```bash
# Make script executable
chmod +x scripts/instantiate-chaincode.sh

# Instantiate chaincode
bash scripts/instantiate-chaincode.sh
```

**Expected Output:**
```
🚀 Instantiating chaincode...
🚀 Instantiating chaincode on channel...
✅ Chaincode instantiated successfully
⏳ Waiting for chaincode to be ready...
🎉 Chaincode instantiation complete!
```

**Note:** Chaincode instantiation may take 30-60 seconds. Wait for the success message.

### 10.4 Restart Application
After chaincode is instantiated, restart the application to connect to Fabric:

```bash
# Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# Check logs (should see Fabric connection success)
docker compose -f docker-compose.unified.yml logs lto-app --tail=30 | grep -i fabric
```

**Expected:** `✅ Connected to Hyperledger Fabric network successfully`

---

## Alternative: Manual Channel Setup (if scripts fail)

If the scripts don't work, you can manually create the channel using the peer container directly:

### Manual Channel Creation
```bash
# Copy channel transaction to peer
docker cp fabric-network/channel-artifacts/ltochannel.tx peer0.lto.gov.ph:/opt/gopath/src/github.com/hyperledger/fabric/peer/

# Create channel
docker exec peer0.lto.gov.ph peer channel create \
  -o orderer.lto.gov.ph:7050 \
  -c ltochannel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.tx \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt \
  --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block

# Join peer to channel
docker exec peer0.lto.gov.ph peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block

# Verify
docker exec peer0.lto.gov.ph peer channel list
```

### Manual Chaincode Installation
```bash
# Copy chaincode to peer
docker cp chaincode/vehicle-registration-production peer0.lto.gov.ph:/opt/gopath/src/github.com/chaincode/

# Install chaincode
docker exec peer0.lto.gov.ph peer chaincode install \
  -n vehicle-registration \
  -v 1.0 \
  -p github.com/chaincode/vehicle-registration-production \
  -l node

# Instantiate chaincode
docker exec peer0.lto.gov.ph peer chaincode instantiate \
  -o orderer.lto.gov.ph:7050 \
  -C ltochannel \
  -n vehicle-registration \
  -v 1.0 \
  -c '{"Args":[]}' \
  -P "OR('LTOMSP.member')" \
  --tls \
  --cafile /etc/hyperledger/fabric/tls/ca.crt
```

### 10.5 Verify Fabric Connection
```bash
# Instantiate chaincode
docker exec cli peer chaincode instantiate \
  -o orderer.lto.gov.ph:7050 \
  -C ltochannel \
  -n vehicle-registration \
  -v 1.0 \
  -c '{"Args":[]}' \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

**Expected Output:**
```
2024-01-01 12:00:00.000 UTC [chaincodeCmd] checkChaincodeCmdParams -> INFO 001 Using default escc
2024-01-01 12:00:00.000 UTC [chaincodeCmd] checkChaincodeCmdParams -> INFO 002 Using default vscc
2024-01-01 12:00:00.000 UTC [chaincodeCmd] instantiate -> INFO 003 Chaincode instantiation successful
```

**Note:** Wait 10-15 seconds after instantiate for chaincode container to start.

---

## Step 10: Verify Deployment

### 10.1 Check Application Health
```bash
# Check health endpoint
curl http://localhost:3001/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 10.2 Check Detailed Health
```bash
curl http://localhost:3001/api/health/detailed
```

**Expected:** All services should show "connected":
```json
{
  "status": "healthy",
  "services": {
    "database": { "status": "connected" },
    "blockchain": { "status": "connected" },
    "storage": { "status": "connected" }
  }
}
```

### 10.3 Check Service Logs
```bash
# Application logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50

# Look for successful connections:
# ✅ Connected to Hyperledger Fabric network successfully
# ✅ PostgreSQL connection successful
# ✅ Using IPFS storage mode
```

---

## Step 11: Access Application

### 11.1 From Droplet
```bash
# Application is accessible at:
curl http://localhost:3001
```

### 11.2 From Browser
1. Open browser
2. Navigate to: `http://YOUR_DROPLET_IP:3001`
3. You should see the login page

### 11.3 Test Login
- Use default admin credentials (if configured)
- Or create new account via registration

---

## Step 12: Configure Domain and SSL (Optional but Recommended)

### 12.1 Point Domain to Droplet
1. Go to your domain registrar (e.g., Namecheap, GoDaddy)
2. Add A record:
   - **Type:** A
   - **Name:** @ (or subdomain like `lto`)
   - **Value:** YOUR_DROPLET_IP
   - **TTL:** 3600
3. Wait 5-10 minutes for DNS propagation

### 12.2 Install Nginx and Certbot
```bash
# Install Nginx
apt-get install nginx -y

# Install Certbot
apt-get install certbot python3-certbot-nginx -y

# Start Nginx
systemctl start nginx
systemctl enable nginx
```

### 12.3 Configure Nginx Reverse Proxy
```bash
# Create Nginx config
nano /etc/nginx/sites-available/lto-blockchain
```

**Add configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for blockchain operations
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/lto-blockchain /etc/nginx/sites-enabled/

# Remove default site (optional)
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 12.4 Get SSL Certificate
```bash
# Get SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

**Expected Output:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/your-domain.com/fullchain.pem
Key is saved at: /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 12.5 Verify SSL
```bash
# Test SSL certificate
curl https://your-domain.com/api/health

# Should return health status
```

---

## Step 13: Post-Deployment Configuration

### 13.1 Change Default Passwords
```bash
# Edit docker-compose.unified.yml
nano docker-compose.unified.yml

# Update passwords (or use environment variables):
# - POSTGRES_PASSWORD (line 178)
# - COUCHDB_PASSWORD (line 58, 107)

# Restart services
docker compose -f docker-compose.unified.yml restart
```

### 13.2 Setup DigitalOcean Monitoring
1. Go to DigitalOcean Dashboard
2. Click on your droplet
3. Go to **"Monitoring"** tab
4. Enable monitoring
5. Set up alerts:
   - CPU > 80%
   - Memory > 85%
   - Disk > 90%

### 13.3 Setup Automated Backups
```bash
# Create backup directory
mkdir -p /opt/lto-blockchain/backups

# Create backup script
nano /opt/lto-blockchain/backup.sh
```

**Add to backup.sh:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/lto-blockchain/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec postgres pg_dump -U lto_user lto_blockchain > $BACKUP_DIR/db-$DATE.sql

# Backup wallet
tar -czf $BACKUP_DIR/wallet-$DATE.tar.gz wallet/

# Backup crypto materials
tar -czf $BACKUP_DIR/crypto-$DATE.tar.gz fabric-network/crypto-config/

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/lto-blockchain/backup.sh

# Test backup
/opt/lto-blockchain/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /opt/lto-blockchain/backup.sh >> /opt/lto-blockchain/backups/backup.log 2>&1
```

### 13.4 Configure Docker Log Rotation
```bash
# Configure Docker log rotation
nano /etc/docker/daemon.json
```

**Add:**
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Restart Docker
systemctl restart docker

# Restart services
cd /opt/lto-blockchain
docker compose -f docker-compose.unified.yml restart
```

---

## Step 14: Verify Everything Works

### 14.1 Check All Services
```bash
# Check service status
docker compose -f docker-compose.unified.yml ps

# Check resource usage
docker stats --no-stream

# Check disk space
df -h
```

### 14.2 Test Application Features
1. **Access Application:** `http://YOUR_DROPLET_IP:3001` or `https://your-domain.com`
2. **Create Account:** Register a new user
3. **Login:** Test authentication
4. **Register Vehicle:** Test blockchain integration
5. **Upload Document:** Test IPFS storage

### 14.3 Monitor Logs
```bash
# Follow application logs
docker compose -f docker-compose.unified.yml logs -f lto-app

# Check for any errors
docker compose -f docker-compose.unified.yml logs | grep -i error
```

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.unified.yml logs [service-name]

# Check resource usage
docker stats

# Check disk space
df -h

# Restart service
docker compose -f docker-compose.unified.yml restart [service-name]
```

### Out of Memory
```bash
# Check memory usage
free -h
docker stats

# If memory is high:
# 1. Reduce resource limits in docker-compose.unified.yml
# 2. Upgrade to 16GB RAM droplet ($96/month)
```

### Application Can't Connect to Fabric
```bash
# Check Fabric network
docker compose -f docker-compose.unified.yml logs peer0.lto.gov.ph

# Verify wallet exists
ls -la wallet/

# Check network-config.json uses service names (not localhost)
grep "peer0.lto.gov.ph" network-config.json
# Should show: "grpcs://peer0.lto.gov.ph:7051"

# Check FABRIC_AS_LOCALHOST is false
grep FABRIC_AS_LOCALHOST docker-compose.unified.yml
# Should show: FABRIC_AS_LOCALHOST=false
```

### Database Connection Issues
```bash
# Check PostgreSQL logs
docker compose -f docker-compose.unified.yml logs postgres

# Test connection
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT 1;"

# Check if database is initialized
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"
```

### IPFS Connection Issues

#### IPFS Container Restarting (Version Mismatch)
If IPFS shows "Restarting" status and logs show "version (15) is lower than your repos (18)":

```bash
# Fix IPFS volume version mismatch
bash scripts/fix-ipfs-volume.sh

# Or manually:
docker compose -f docker-compose.unified.yml stop ipfs
docker compose -f docker-compose.unified.yml rm -f ipfs
docker volume rm lto-blockchain_ipfs-data
docker compose -f docker-compose.unified.yml up -d ipfs

# Verify IPFS is running
docker compose -f docker-compose.unified.yml ps ipfs
docker compose -f docker-compose.unified.yml logs ipfs --tail=20
```

#### IPFS Not Responding
```bash
# Check IPFS logs
docker compose -f docker-compose.unified.yml logs ipfs --tail=50

# Test IPFS connection
docker exec ipfs ipfs id

# Check IPFS API
curl http://localhost:5001/api/v0/version

# Restart IPFS if needed
docker compose -f docker-compose.unified.yml restart ipfs
```

### Network Issues
```bash
# Check Docker network
docker network inspect trustchain

# Check service connectivity
docker exec lto-app ping -c 3 postgres
docker exec lto-app ping -c 3 ipfs
docker exec lto-app ping -c 3 peer0.lto.gov.ph
```

---

## Maintenance Commands

### Daily Operations
```bash
# View logs
docker compose -f docker-compose.unified.yml logs -f

# View specific service logs
docker compose -f docker-compose.unified.yml logs -f lto-app

# Restart services
docker compose -f docker-compose.unified.yml restart

# Restart specific service
docker compose -f docker-compose.unified.yml restart lto-app

# Check resource usage
docker stats

# Check service status
docker compose -f docker-compose.unified.yml ps
```

### Update Application
```bash
cd /opt/lto-blockchain

# Pull latest code
git pull

# Rebuild and restart application
docker compose -f docker-compose.unified.yml up -d --build lto-app

# Check logs
docker compose -f docker-compose.unified.yml logs -f lto-app
```

### Backup and Restore
```bash
# Manual backup
docker exec postgres pg_dump -U lto_user lto_blockchain > backup-$(date +%Y%m%d).sql
tar -czf wallet-backup-$(date +%Y%m%d).tar.gz wallet/

# Restore backup
docker exec -i postgres psql -U lto_user -d lto_blockchain < backup-20240101.sql
tar -xzf wallet-backup-20240101.tar.gz
```

---

## Security Checklist

- [ ] Changed default passwords (PostgreSQL, CouchDB)
- [ ] Set strong JWT_SECRET and ENCRYPTION_KEY
- [ ] Configured firewall (UFW)
- [ ] Set up SSL/TLS certificate
- [ ] Enabled DigitalOcean monitoring
- [ ] Configured automated backups
- [ ] Set up log rotation
- [ ] Restricted SSH access (key-based only, disable password)
- [ ] Regular security updates: `apt-get update && apt-get upgrade`
- [ ] Review `.env` file permissions: `chmod 600 .env`

---

## Performance Monitoring

### Check Resource Usage
```bash
# Real-time resource usage
docker stats

# System resources
free -h
df -h
top
```

### Expected Resource Usage
- **Normal Operation:** ~5-6GB RAM
- **Peak Load:** ~6.5-7GB RAM
- **Warning:** If consistently >7GB, consider upgrading

### Optimize if Needed
```bash
# If PostgreSQL is slow, increase shared_buffers in docker-compose.unified.yml
# If IPFS is slow, check disk I/O: iostat -x 1
# If Peer is slow, check CouchDB: curl http://localhost:5984/_stats
```

---

## Quick Reference

### Essential Commands
```bash
# Start services
docker compose -f docker-compose.unified.yml up -d

# Stop services
docker compose -f docker-compose.unified.yml down

# View logs
docker compose -f docker-compose.unified.yml logs -f

# Check status
docker compose -f docker-compose.unified.yml ps

# Restart service
docker compose -f docker-compose.unified.yml restart [service-name]

# View resource usage
docker stats

# Check health
curl http://localhost:3001/api/health
```

### Important Files
- `docker-compose.unified.yml` - Main deployment file
- `network-config.json` - Fabric network configuration
- `.env` - Environment variables (secrets)
- `Dockerfile.production` - Application Dockerfile
- `fabric-network/crypto-config/` - Fabric certificates
- `wallet/` - Fabric wallet

### Important Ports
- **3001** - Application (HTTP)
- **5432** - PostgreSQL (internal)
- **5984** - CouchDB (internal)
- **5001** - IPFS API (internal)
- **8080** - IPFS Gateway (internal)
- **7050** - Fabric Orderer (internal)
- **7051** - Fabric Peer (internal)

---

## Success Criteria

✅ **Deployment Successful When:**
1. All services are running (`docker compose ps` shows all Up)
2. Health checks pass (`curl http://localhost:3001/api/health` returns OK)
3. Application is accessible (can login and use features)
4. Resource usage is within limits (`docker stats` shows < 7GB RAM)
5. No critical errors in logs (`docker compose logs` shows no errors)
6. Fabric network is connected (check logs for "Connected to Hyperledger Fabric")
7. IPFS is connected (check logs for "Using IPFS storage mode")
8. Database is accessible (health check shows database connected)

---

## Support & Resources

- **Best Practices:** See `BEST-PRACTICES-FROM-RESEARCH.md`
- **Optimization:** See `DEPLOYMENT-OPTIMIZATION-SUMMARY.md`
- **Troubleshooting:** Check service logs and DigitalOcean monitoring
- **Deployment Checklist:** See `DEPLOYMENT-CHECKLIST.md`

---

## Next Steps After Deployment

1. **Monitor:** Set up DigitalOcean alerts
2. **Backup:** Configure automated backups
3. **SSL:** Set up domain and SSL certificate
4. **Users:** Create admin accounts
5. **Testing:** Test all features thoroughly
6. **Documentation:** Document any custom configurations

---

**Deployment Complete!** 🎉

Your TrustChain LTO system is now running on DigitalOcean.

**Access:** `http://YOUR_DROPLET_IP:3001` or `https://your-domain.com`

---

**Last Updated:** Based on optimized configuration  
**Status:** Ready for production deployment

