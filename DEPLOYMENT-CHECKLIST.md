# ✅ DigitalOcean Deployment Checklist

## Pre-Deployment Checklist

### 1. **Configuration Files** ✅

- [x] **Update `network-config.json`** ✅ **COMPLETED**
  - Changed `localhost` to Docker service names:
    - `peer0.lto.gov.ph`: `grpcs://peer0.lto.gov.ph:7051` ✅
    - `orderer.lto.gov.ph`: `grpcs://orderer.lto.gov.ph:7050` ✅
  - **File:** `network-config.json`
  - **Status:** ✅ **UPDATED**

- [ ] **Create `.env` file**
  ```bash
  # Copy the example file
  cp ENV.example .env
  
  # Then edit .env and update with your actual secrets:
  JWT_SECRET=your-strong-random-secret-key-minimum-32-characters
  ENCRYPTION_KEY=your-strong-random-encryption-key-32-characters
  ```
  - **File:** `.env` (copy from `ENV.example`)
  - **Status:** ⚠️ **REQUIRED BEFORE DEPLOYMENT**

- [ ] **Verify `docker-compose.unified.yml`**
  - All services configured
  - Resource limits set
  - Health checks enabled
  - **Status:** ✅ **READY**

---

### 2. **Fabric Network Setup** ✅

- [ ] **Generate Crypto Material**
  ```bash
  ./scripts/generate-crypto.sh
  ```
  - Generates certificates for Fabric network
  - **Status:** ⚠️ **REQUIRED BEFORE DEPLOYMENT**

- [ ] **Generate Channel Artifacts**
  ```bash
  ./scripts/generate-channel-artifacts.sh
  ```
  - Creates genesis block and channel configuration
  - **Status:** ⚠️ **REQUIRED BEFORE DEPLOYMENT**

- [ ] **Setup Fabric Wallet**
  ```bash
  ./scripts/setup-wallet-only.sh
  ```
  - Creates admin wallet for application
  - **Status:** ⚠️ **REQUIRED BEFORE DEPLOYMENT**

---

### 3. **DigitalOcean Server Setup** ✅

- [ ] **Create Droplet**
  - **Size:** 8GB RAM, 4 CPU ($48/month)
  - **OS:** Ubuntu 22.04 LTS
  - **Region:** Choose closest to users
  - **Status:** ⚠️ **REQUIRED**

- [ ] **Install Docker**
  ```bash
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
  ```
  - **Status:** ⚠️ **REQUIRED**

- [ ] **Install Docker Compose**
  ```bash
  sudo apt-get update
  sudo apt-get install docker-compose-plugin
  ```
  - **Status:** ⚠️ **REQUIRED**

- [ ] **Configure Firewall**
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp     # HTTP
  sudo ufw allow 443/tcp    # HTTPS
  sudo ufw allow 3001/tcp   # Application
  sudo ufw enable
  ```
  - **Status:** ⚠️ **REQUIRED**

---

### 4. **File Transfer** ✅

- [ ] **Upload Project Files**
  ```bash
  # Using SCP
  scp -r . user@your-droplet-ip:/opt/lto-blockchain/
  
  # Or using Git
  git clone <repository-url>
  ```
  - **Status:** ⚠️ **REQUIRED**

- [ ] **Verify Essential Files**
  ```bash
  ls -la docker-compose.unified.yml
  ls -la Dockerfile.production
  ls -la network-config.json
  ls -la .env
  ```
  - **Status:** ⚠️ **REQUIRED**

---

## Deployment Steps

### Step 1: **Start Services**
```bash
cd /opt/lto-blockchain
docker-compose -f docker-compose.unified.yml up -d
```

**Expected Output:**
```
Creating network "trustchain" ...
Creating volume "lto-blockchain_orderer-data" ...
Creating volume "lto-blockchain_couchdb-data" ...
...
Creating lto-app ... done
```

---

### Step 2: **Verify Services**
```bash
# Check all services are running
docker-compose -f docker-compose.unified.yml ps

# Check resource usage
docker stats

# Check logs
docker-compose -f docker-compose.unified.yml logs -f
```

**Expected Status:**
- ✅ orderer.lto.gov.ph: Up
- ✅ couchdb: Up (healthy)
- ✅ peer0.lto.gov.ph: Up
- ✅ postgres: Up (healthy)
- ✅ ipfs: Up
- ✅ lto-app: Up (healthy)

---

### Step 3: **Initialize Fabric Network**
```bash
# Create channel (if not already created)
docker exec cli peer channel create -o orderer.lto.gov.ph:7050 -c ltochannel -f ./channel-artifacts/channel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# Join peer to channel
docker exec cli peer channel join -b ltochannel.block

# Install chaincode
docker exec cli peer chaincode install -n vehicle-registration -v 1.0 -p /opt/gopath/src/github.com/chaincode/vehicle-registration-production

# Instantiate chaincode
docker exec cli peer chaincode instantiate -o orderer.lto.gov.ph:7050 -C ltochannel -n vehicle-registration -v 1.0 -c '{"Args":[]}' --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
```

**Status:** ⚠️ **REQUIRED** (if not using automated setup script)

---

### Step 4: **Verify Application**
```bash
# Check health endpoint
curl http://localhost:3001/api/health

# Expected response:
# {"status":"ok","timestamp":"..."}
```

**Status:** ✅ **VERIFY**

---

## Post-Deployment Checklist

### 1. **Security** ✅

- [ ] **Change Default Passwords**
  - PostgreSQL: Update `lto_password` in `.env`
  - CouchDB: Update `adminpw` in docker-compose
  - **Status:** ⚠️ **REQUIRED**

- [ ] **Set Strong Secrets**
  - `JWT_SECRET`: Minimum 32 characters, random
  - `ENCRYPTION_KEY`: 32 characters, random
  - **Status:** ⚠️ **REQUIRED**

- [ ] **Configure SSL/TLS**
  - Set up Nginx reverse proxy with Let's Encrypt
  - **Status:** 🔄 **RECOMMENDED**

---

### 2. **Monitoring** ✅

- [ ] **Set Up DigitalOcean Monitoring**
  - Enable monitoring in DigitalOcean dashboard
  - Set up alerts for CPU > 80%
  - Set up alerts for Memory > 85%
  - **Status:** 🔄 **RECOMMENDED**

- [ ] **Monitor Logs**
  ```bash
  # Application logs
  docker-compose -f docker-compose.unified.yml logs -f lto-app
  
  # All logs
  docker-compose -f docker-compose.unified.yml logs -f
  ```
  - **Status:** 🔄 **ONGOING**

---

### 3. **Backup** ✅

- [ ] **Set Up Database Backup**
  ```bash
  # Manual backup
  docker exec postgres pg_dump -U lto_user lto_blockchain > backup.sql
  
  # Automated backup (cron job)
  # Add to crontab: 0 2 * * * docker exec postgres pg_dump -U lto_user lto_blockchain > /backup/backup-$(date +\%Y\%m\%d).sql
  ```
  - **Status:** 🔄 **RECOMMENDED**

- [ ] **Backup Fabric Wallet**
  ```bash
  tar -czf wallet-backup.tar.gz wallet/
  ```
  - **Status:** 🔄 **RECOMMENDED**

- [ ] **Backup IPFS Data**
  ```bash
  docker exec ipfs ipfs get <root-hash> -o /backup/ipfs-backup
  ```
  - **Status:** 🔄 **RECOMMENDED**

---

### 4. **Performance Tuning** ✅

- [ ] **Monitor Resource Usage**
  ```bash
  docker stats
  ```
  - Check if any service is hitting limits
  - **Status:** 🔄 **ONGOING**

- [ ] **Optimize if Needed**
  - If PostgreSQL is slow: Increase `shared_buffers`
  - If IPFS is slow: Check disk I/O
  - If Peer is slow: Check CouchDB performance
  - **Status:** 🔄 **AS NEEDED**

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.unified.yml logs [service-name]

# Check resource usage
docker stats

# Restart service
docker-compose -f docker-compose.unified.yml restart [service-name]
```

### Out of Memory
```bash
# Check memory usage
free -h
docker stats

# Reduce resource limits in docker-compose.unified.yml
# Or upgrade droplet to 16GB RAM
```

### Network Issues
```bash
# Check network
docker network inspect trustchain

# Check service connectivity
docker exec lto-app ping postgres
docker exec lto-app ping ipfs
```

---

## Quick Reference

### Essential Commands
```bash
# Start services
docker-compose -f docker-compose.unified.yml up -d

# Stop services
docker-compose -f docker-compose.unified.yml down

# View logs
docker-compose -f docker-compose.unified.yml logs -f

# Check status
docker-compose -f docker-compose.unified.yml ps

# Restart service
docker-compose -f docker-compose.unified.yml restart [service-name]

# View resource usage
docker stats
```

### Important Files
- `docker-compose.unified.yml` - Main deployment file
- `network-config.json` - Fabric network configuration
- `.env` - Environment variables (secrets)
- `Dockerfile.production` - Application Dockerfile

---

## Success Criteria

✅ **Deployment Successful When:**
1. All services are running (`docker-compose ps` shows all Up)
2. Health checks pass (`curl http://localhost:3001/api/health` returns OK)
3. Application is accessible (can login and use features)
4. Resource usage is within limits (`docker stats` shows < 7GB RAM)
5. No errors in logs (`docker-compose logs` shows no critical errors)

---

## Support & Resources

- **Best Practices:** See `BEST-PRACTICES-FROM-RESEARCH.md`
- **Optimization:** See `DEPLOYMENT-OPTIMIZATION-SUMMARY.md`
- **Troubleshooting:** Check service logs and DigitalOcean monitoring

---

**Last Updated:** Based on industry best practices research
**Status:** Ready for production deployment

