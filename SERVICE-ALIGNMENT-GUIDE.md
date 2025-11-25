# Service Alignment and Integration Guide
## Ensuring All Services Work Together Seamlessly

This guide explains how to ensure PostgreSQL, IPFS, Hyperledger Fabric, and the backend application are properly aligned and working together for vehicle registration and document viewing.

---

## 📋 Table of Contents

1. [Service Architecture Overview](#service-architecture)
2. [Service Startup Sequence](#startup-sequence)
3. [Service Verification](#verification)
4. [Common Alignment Issues](#common-issues)
5. [Complete Reset Procedure](#reset-procedure)
6. [Integration Testing](#integration-testing)

---

## 🏗️ Service Architecture Overview {#service-architecture}

Based on the **Technical Implementation Guide**, the system follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                   │
│  - Registration Wizard                                   │
│  - Document Viewer                                       │
│  - Dashboards                                           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST API
                     │ (JWT Authentication)
┌────────────────────▼────────────────────────────────────┐
│              BACKEND (Node.js/Express)                  │
│  - API Routes                                           │
│  - Authentication                                       │
│  - Business Logic                                       │
│  - Service Integration Layer                            │
└────┬──────────────┬──────────────┬──────────────────────┘
     │              │              │
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌────▼──────────────┐
│PostgreSQL│  │    IPFS     │  │Hyperledger Fabric │
│ Database │  │  Storage    │  │   Blockchain      │
│          │  │             │  │                   │
│ - Users  │  │ - Documents │  │ - Vehicle Records │
│ - Vehicles│ │ - CIDs      │  │ - Immutable Ledger│
│ - Documents│ │ - Gateway  │  │ - Smart Contracts│
└──────────┘  └────────────┘  └───────────────────┘
```

### Service Responsibilities

**PostgreSQL:**
- Stores application data (users, vehicles, documents metadata)
- Links documents to vehicles via `vehicle_id`
- Stores IPFS CIDs in `ipfs_cid` column
- Provides fast queries for dashboards

**IPFS:**
- Stores actual document files (PDFs, images)
- Returns Content Identifiers (CIDs) for each file
- Provides decentralized, immutable document storage
- Gateway allows direct browser access via `http://localhost:8080/ipfs/CID`

**Hyperledger Fabric:**
- Stores vehicle registration records on immutable ledger
- Enforces business rules via chaincode
- Provides audit trail and transaction history
- Ensures data integrity and non-repudiation

**Backend Application:**
- Orchestrates all services
- Validates data before storage
- Manages authentication and authorization
- Provides unified API for frontend

---

## 🚀 Service Startup Sequence {#startup-sequence}

According to **Phase 2 & 3** of the Technical Implementation Guide, services must start in this specific order:

### Step 1: Core Infrastructure (PostgreSQL, IPFS, Redis)

```powershell
# Start core services
docker-compose -f docker-compose.core.yml up -d postgres ipfs redis

# Wait for initialization
Start-Sleep -Seconds 15
```

**Why this order?**
- PostgreSQL must be ready before backend connects
- IPFS needs time to initialize its repository
- Redis is optional but helps with caching

### Step 2: Hyperledger Fabric (if using Fabric mode)

```powershell
# Start Fabric network
docker-compose -f docker-compose.fabric.yml up -d

# Wait for Fabric to initialize (longer wait needed)
Start-Sleep -Seconds 30
```

**Why this order?**
- Fabric needs core services (especially network) to be ready
- Peers need to join channels
- Chaincode needs to be instantiated

### Step 3: Backend Application

```powershell
# Start backend (loads .env and initializes services)
node server.js
```

**Backend Initialization Order:**
1. Database connection (PostgreSQL)
2. Storage service initialization (IPFS or Local)
3. Blockchain service initialization (Fabric or Mock)

---

## ✅ Service Verification {#verification}

### Automated Verification Script

Use the provided script to verify all services:

```powershell
.\verify-services-alignment.ps1
```

This script checks:
- ✅ PostgreSQL connectivity and schema
- ✅ IPFS API accessibility and configuration
- ✅ Hyperledger Fabric peer status (if enabled)
- ✅ Backend application health
- ✅ Environment variable alignment
- ✅ Container network connectivity

### Manual Verification

**1. PostgreSQL:**
```powershell
# Check connection
docker exec postgres pg_isready -U lto_user -d lto_blockchain

# Check schema
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d documents"
# Should show ipfs_cid column
```

**2. IPFS:**
```powershell
# Check API
Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST

# Check configuration
docker exec ipfs ipfs config Addresses.API
# Should show: /ip4/0.0.0.0/tcp/5001
```

**3. Hyperledger Fabric:**
```powershell
# Check peer status
docker exec peer0.lto.gov.ph peer node status

# Check if chaincode is installed
docker exec peer0.lto.gov.ph peer chaincode list --installed
```

**4. Backend Application:**
```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3001/api/health/detailed" -Method GET
```

---

## 🔧 Common Alignment Issues {#common-issues}

### Issue 1: Documents Not Storing in IPFS

**Symptoms:**
- Document uploads fail with "IPFS storage is required but unavailable"
- `STORAGE_MODE=ipfs` but documents fall back to local storage

**Causes:**
- IPFS API not accessible from host
- IPFS container not running
- IPFS API bound to `127.0.0.1` instead of `0.0.0.0`

**Fix:**
```powershell
# Check IPFS container
docker ps | findstr ipfs

# Fix API configuration
docker exec ipfs ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
docker exec ipfs ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
docker restart ipfs

# Verify
Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST
```

### Issue 2: Backend Can't Connect to PostgreSQL

**Symptoms:**
- Backend logs show "Database connection failed"
- Health check shows database as "disconnected"

**Causes:**
- PostgreSQL container not running
- Wrong `DB_HOST` in `.env`
- Port 5432 blocked or in use

**Fix:**
```powershell
# Check container
docker ps | findstr postgres

# Check .env
Get-Content .env | Select-String "DB_HOST"
# Should be: DB_HOST=localhost or DB_HOST=postgres

# Restart PostgreSQL
docker restart postgres
```

### Issue 3: Document Viewing Returns 404

**Symptoms:**
- Document viewer shows "Document not found"
- API returns 404 for `/api/documents/:id/view`

**Causes:**
- Document ID is actually a vehicle/application ID (not a document ID)
- Document record missing `ipfs_cid` or `file_path`
- File doesn't exist at the path

**Fix:**
```powershell
# Check document in database
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, filename, ipfs_cid, file_path FROM documents WHERE id = 'DOCUMENT-ID';"

# If ipfs_cid exists, verify in IPFS
Invoke-RestMethod -Uri "http://localhost:5001/api/v0/pin/ls?arg=CID" -Method POST

# If file_path exists, verify file exists
Test-Path "PATH_FROM_DATABASE"
```

### Issue 4: Blockchain Transactions Failing

**Symptoms:**
- Vehicle registration fails with "Blockchain transaction failed"
- Backend logs show Fabric connection errors

**Causes:**
- Fabric peer not running
- Wallet missing user identity
- Chaincode not installed/instantiated

**Fix:**
```powershell
# Check Fabric containers
docker ps | findstr peer0

# Check wallet
node scripts/setup-fabric-wallet.js

# Verify chaincode
docker exec peer0.lto.gov.ph peer chaincode list --installed
```

---

## 🔄 Complete Reset Procedure {#reset-procedure}

If services are misaligned, a complete reset may be necessary:

### Option A: Reset Without Data Loss

```powershell
# 1. Stop all containers
docker-compose -f docker-compose.core.yml restart
docker-compose -f docker-compose.fabric.yml restart

# 2. Wait for services
Start-Sleep -Seconds 15

# 3. Verify services
.\verify-services-alignment.ps1

# 4. Restart backend
node server.js
```

### Option B: Complete Reset (Deletes All Data)

```powershell
# 1. Stop all containers
docker-compose -f docker-compose.core.yml down
docker-compose -f docker-compose.fabric.yml down

# 2. Remove volumes (WARNING: Deletes all data!)
docker volume rm lto-blockchain_postgres-data
docker volume rm lto-blockchain_ipfs-data

# 3. Recreate containers
docker-compose -f docker-compose.core.yml up -d

# 4. Wait for initialization
Start-Sleep -Seconds 20

# 5. Add ipfs_cid column (if needed)
docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);"

# 6. Verify
.\verify-services-alignment.ps1

# 7. Start backend
node server.js
```

---

## 🧪 Integration Testing {#integration-testing}

### Test Complete Vehicle Registration Flow

**1. Verify Services:**
```powershell
.\verify-services-alignment.ps1
```

**2. Register Vehicle (via Frontend):**
- Fill registration form
- Upload documents
- Submit application

**3. Verify Data Storage:**

**PostgreSQL:**
```powershell
# Check vehicle
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vin, make, model, status FROM vehicles ORDER BY created_at DESC LIMIT 1;"

# Check documents
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, filename, ipfs_cid, document_type FROM documents ORDER BY uploaded_at DESC LIMIT 4;"
```

**IPFS:**
```powershell
# Get CID from database
$cid = "CID_FROM_DATABASE"

# Verify in IPFS
Invoke-RestMethod -Uri "http://localhost:5001/api/v0/pin/ls?arg=$cid" -Method POST

# Access via gateway
Start-Process "http://localhost:8080/ipfs/$cid"
```

**Blockchain (if Fabric enabled):**
```powershell
# Query vehicle from blockchain
docker exec peer0.lto.gov.ph peer chaincode query -C ltochannel -n vehicle-registration-production -c '{"function":"GetVehicle","Args":["VIN"]}'
```

**4. Test Document Viewing:**
- Navigate to vehicle application
- Click "View Documents"
- Verify document loads correctly

---

## 📝 Configuration Checklist

Before starting services, verify:

- [ ] `.env` file exists with correct values
- [ ] `STORAGE_MODE` matches desired storage (ipfs/auto/local)
- [ ] `BLOCKCHAIN_MODE` matches desired blockchain (fabric/mock)
- [ ] `DB_HOST` points to correct PostgreSQL (localhost/postgres)
- [ ] PostgreSQL container name is `postgres`
- [ ] IPFS container name is `ipfs`
- [ ] IPFS API configured to `0.0.0.0:5001`
- [ ] Docker network `lto-network` exists
- [ ] All required ports are available (5432, 5001, 8080, 3001)

---

## 🎯 Quick Start

For the fastest setup:

```powershell
# Use the automated startup script
.\start-all-services.ps1
```

This script:
1. ✅ Starts all services in correct order
2. ✅ Waits for initialization
3. ✅ Verifies each service
4. ✅ Fixes common configuration issues
5. ✅ Starts backend application

---

## 📚 References

- **Technical Implementation Guide**: See `TECHNICAL-IMPLEMENTATION-GUIDE.md`
- **Phase 2**: Blockchain Network Foundation
- **Phase 3**: Backend Application Development
- **Phase 6**: Integration and Security

---

**Status**: ✅ **Complete Guide - Ready to Use!**

