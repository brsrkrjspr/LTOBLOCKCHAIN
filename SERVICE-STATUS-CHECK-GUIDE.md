# 🔍 Service Status Check Guide

This guide explains how to check if all services in the TrustChain LTO system are running correctly.

---

## Quick Check Commands

### 1. **Check All Services Status (Recommended)**

Use the automated script:
```bash
bash scripts/check-all-services.sh
```

This script checks:
- ✅ Docker Compose service status
- ✅ Individual service health
- ✅ Service connectivity
- ✅ Resource usage
- ✅ Port availability
- ✅ Environment variables
- ✅ Summary report

### 2. **Basic Docker Compose Status**

```bash
# View all services status
docker compose -f docker-compose.unified.yml ps

# View status in table format
docker compose -f docker-compose.unified.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

**Expected Output:**
```
NAME                    STATUS              PORTS
lto-app                 Up 5 minutes        3001/tcp
nginx                   Up 5 minutes        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
postgres                Up 5 minutes (healthy)  5432/tcp
ipfs                    Up 5 minutes        5001/tcp, 8080/tcp
orderer.lto.gov.ph      Up 5 minutes        7050/tcp
peer0.lto.gov.ph        Up 5 minutes        7051/tcp
couchdb                 Up 5 minutes        5984/tcp
```

---

## Individual Service Checks

### **1. PostgreSQL Database**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps postgres

# Check database connectivity
docker exec postgres pg_isready -U lto_user -d lto_blockchain

# Test connection from application
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    console.log(result ? '✅ Database OK' : '❌ Database FAILED');
    process.exit(result ? 0 : 1);
});
"
```

**Expected:** `✅ Database OK`

---

### **2. IPFS Document Storage**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps ipfs

# Check IPFS API
docker exec ipfs curl -s -X POST http://localhost:5001/api/v0/version

# Check IPFS Gateway
docker exec ipfs curl -s http://localhost:8080/ipfs/QmUNLLsPACCz1vLxM4w6HqqFqwWeExR3x5BCPStwwGAZtP

# Test connection from application
docker exec lto-app node -e "
const http = require('http');
const req = http.request({
    hostname: 'ipfs',
    port: 5001,
    path: '/api/v0/version',
    method: 'POST'
}, (res) => {
    console.log(res.statusCode === 200 ? '✅ IPFS OK' : '❌ IPFS FAILED');
    process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => {
    console.log('❌ IPFS FAILED');
    process.exit(1);
});
req.end();
"
```

**Expected:** `{"Version":"0.39.0",...}` or `✅ IPFS OK`

---

### **3. LTO Application (Node.js)**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps lto-app

# Check application health endpoint
docker exec lto-app curl -s http://localhost:3001/api/health

# Check application logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50

# Check if application is listening
docker exec lto-app netstat -tuln | grep 3001
```

**Expected:** Health endpoint returns JSON with `status: "ok"`

---

### **4. Nginx Reverse Proxy**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps nginx

# Test Nginx configuration
docker exec nginx nginx -t

# Check Nginx logs
docker compose -f docker-compose.unified.yml logs nginx --tail=50

# Test HTTP endpoint
curl -I http://localhost

# Test HTTPS endpoint (if configured)
curl -I https://localhost -k
```

**Expected:** `nginx: configuration file /etc/nginx/nginx.conf test is successful`

---

### **5. Hyperledger Fabric Orderer**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps orderer.lto.gov.ph

# Check orderer logs
docker compose -f docker-compose.unified.yml logs orderer.lto.gov.ph --tail=50

# Check if orderer is listening
docker exec orderer.lto.gov.ph netstat -tuln | grep 7050
```

**Expected:** Container status shows `Up` and logs show no errors

---

### **6. Hyperledger Fabric Peer**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps peer0.lto.gov.ph

# Check peer logs
docker compose -f docker-compose.unified.yml logs peer0.lto.gov.ph --tail=50

# Check if peer is listening
docker exec peer0.lto.gov.ph netstat -tuln | grep 7051

# Test Fabric connection from application
docker exec lto-app node -e "
const fabricService = require('./backend/services/optimizedFabricService');
fabricService.initialize().then(() => {
    console.log(fabricService.isConnected ? '✅ Fabric OK' : '❌ Fabric FAILED');
    process.exit(fabricService.isConnected ? 0 : 1);
}).catch(err => {
    console.log('❌ Fabric FAILED:', err.message);
    process.exit(1);
});
"
```

**Expected:** Container status shows `Up` and application can connect

---

### **7. CouchDB (Fabric State Database)**

```bash
# Check container status
docker compose -f docker-compose.unified.yml ps couchdb

# Check CouchDB API
docker exec couchdb curl -s http://localhost:5984

# List databases
docker exec couchdb curl -s http://localhost:5984/_all_dbs
```

**Expected:** Returns JSON with CouchDB version information

---

## Service Connectivity Tests

### **Test All Service Connections**

```bash
# Test PostgreSQL connection
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    console.log('PostgreSQL:', result ? '✅' : '❌');
    process.exit(result ? 0 : 1);
});
"

# Test IPFS connection
docker exec lto-app node -e "
const http = require('http');
const req = http.request({
    hostname: 'ipfs',
    port: 5001,
    path: '/api/v0/version',
    method: 'POST'
}, (res) => {
    console.log('IPFS:', res.statusCode === 200 ? '✅' : '❌');
    process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => {
    console.log('IPFS: ❌');
    process.exit(1);
});
req.end();
"

# Test Fabric connection
docker exec lto-app node -e "
const fabricService = require('./backend/services/optimizedFabricService');
fabricService.initialize().then(() => {
    console.log('Fabric:', fabricService.isConnected ? '✅' : '❌');
    process.exit(fabricService.isConnected ? 0 : 1);
}).catch(() => {
    console.log('Fabric: ❌');
    process.exit(1);
});
"
```

---

## Resource Usage Check

### **Check Container Resource Usage**

```bash
# View resource stats for all containers
docker stats --no-stream

# View formatted resource stats
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

**Expected:** All containers show reasonable CPU and memory usage

---

## Port Availability Check

### **Check if Ports are Listening**

```bash
# On Linux
netstat -tuln | grep -E ":(80|443|3001|5432|5001|8080|7050|7051|5984)"

# Or using ss
ss -tuln | grep -E ":(80|443|3001|5432|5001|8080|7050|7051|5984)"

# Check from inside containers
docker exec nginx netstat -tuln | grep 80
docker exec lto-app netstat -tuln | grep 3001
docker exec postgres netstat -tuln | grep 5432
docker exec ipfs netstat -tuln | grep -E "(5001|8080)"
```

---

## Environment Variables Check

### **Check Critical Environment Variables**

```bash
# Check application environment variables
docker exec lto-app printenv | grep -E "(STORAGE_MODE|BLOCKCHAIN_MODE|DB_|NODE_ENV)"

# Check PostgreSQL environment variables
docker exec postgres printenv | grep POSTGRES

# Check IPFS environment variables
docker exec ipfs printenv | grep IPFS
```

**Expected:**
- `STORAGE_MODE=ipfs`
- `BLOCKCHAIN_MODE=fabric`
- Database variables set correctly

---

## Logs Check

### **View Service Logs**

```bash
# View all logs
docker compose -f docker-compose.unified.yml logs

# View logs for specific service
docker compose -f docker-compose.unified.yml logs lto-app
docker compose -f docker-compose.unified.yml logs postgres
docker compose -f docker-compose.unified.yml logs ipfs

# View last 50 lines
docker compose -f docker-compose.unified.yml logs --tail=50 lto-app

# Follow logs (real-time)
docker compose -f docker-compose.unified.yml logs -f lto-app
```

---

## Common Issues and Solutions

### **Issue: Service Not Running**

**Symptoms:**
- Container status shows `Exited` or `Restarting`
- Service not responding

**Solutions:**
```bash
# Restart specific service
docker compose -f docker-compose.unified.yml restart [service_name]

# Restart all services
docker compose -f docker-compose.unified.yml restart

# View logs to identify issue
docker compose -f docker-compose.unified.yml logs [service_name]
```

---

### **Issue: Service Unhealthy**

**Symptoms:**
- Container running but health check failing
- Service not responding to requests

**Solutions:**
```bash
# Check health check status
docker compose -f docker-compose.unified.yml ps

# View detailed logs
docker compose -f docker-compose.unified.yml logs [service_name] --tail=100

# Restart service
docker compose -f docker-compose.unified.yml restart [service_name]
```

---

### **Issue: Cannot Connect Between Services**

**Symptoms:**
- Application cannot connect to database/IPFS/Fabric
- Connection timeout errors

**Solutions:**
```bash
# Verify Docker network
docker network ls
docker network inspect lto-blockchain_default

# Check service names match docker-compose.yml
docker compose -f docker-compose.unified.yml config

# Restart services to refresh network
docker compose -f docker-compose.unified.yml restart
```

---

## Quick Status Summary

Run this command for a quick overview:

```bash
echo "=== Service Status ===" && \
docker compose -f docker-compose.unified.yml ps --format "table {{.Name}}\t{{.Status}}" && \
echo "" && \
echo "=== Resource Usage ===" && \
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" && \
echo "" && \
echo "=== Quick Health Checks ===" && \
echo "PostgreSQL:" && docker exec postgres pg_isready -U lto_user -d lto_blockchain 2>/dev/null && \
echo "IPFS:" && docker exec ipfs curl -s -X POST http://localhost:5001/api/v0/version 2>/dev/null | grep -q Version && echo "OK" || echo "FAILED" && \
echo "Application:" && docker exec lto-app curl -s http://localhost:3001/api/health 2>/dev/null | grep -q ok && echo "OK" || echo "FAILED"
```

---

## Automated Status Check Script

The `scripts/check-all-services.sh` script provides a comprehensive check:

```bash
# Make script executable (if not already)
chmod +x scripts/check-all-services.sh

# Run the check
bash scripts/check-all-services.sh
```

**What it checks:**
1. ✅ Docker Compose service status
2. ✅ Individual service health
3. ✅ Service connectivity (PostgreSQL, IPFS, Fabric)
4. ✅ Resource usage
5. ✅ Port availability
6. ✅ Environment variables
7. ✅ Summary report

---

## Expected Service Count

The system should have **7 main services** running:

1. ✅ **lto-app** - Main application
2. ✅ **nginx** - Reverse proxy
3. ✅ **postgres** - Database
4. ✅ **ipfs** - Document storage
5. ✅ **orderer.lto.gov.ph** - Fabric orderer
6. ✅ **peer0.lto.gov.ph** - Fabric peer
7. ✅ **couchdb** - Fabric state database

---

## Next Steps

If all services are running:
- ✅ System is operational
- ✅ Test registration flow
- ✅ Check application logs for any warnings

If services are not running:
- ❌ Check logs: `docker compose -f docker-compose.unified.yml logs [service_name]`
- ❌ Restart services: `docker compose -f docker-compose.unified.yml restart`
- ❌ Check resource usage: `docker stats`
- ❌ Verify configuration: `docker compose -f docker-compose.unified.yml config`

---

**End of Guide**

