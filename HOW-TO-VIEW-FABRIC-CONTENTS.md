# 🔍 How to View Fabric Blockchain Contents

## Overview

There are **3 main ways** to view what's stored on Hyperledger Fabric:

1. **Chaincode Queries** (Recommended) - Query via your application/scripts
2. **CouchDB Direct Access** - View raw state database
3. **Fabric CLI Commands** - Use peer commands

---

## Method 1: Chaincode Queries (Recommended) ✅

### Using the Script

I've created a script to display all vehicles on Fabric:

```bash
node backend/scripts/show-fabric-vehicles.js
```

**What it shows:**
- All vehicles stored on Fabric
- VIN, Plate, CR Number
- Owner information
- Status and verification status
- Blockchain transaction IDs
- History entries
- Summary statistics

**Example output:**
```
✅ Found 5 vehicle(s) on Fabric blockchain:

1. VIN: ABC1234567890XYZ
   Plate Number: ABC-1234
   CR Number: CR-2024-001
   Make/Model: Toyota Vios (2024)
   Status: REGISTERED
   Owner: john@example.com (John Doe)
   Blockchain TX ID: abc123def456...
```

### Using API Endpoint

```bash
# Get all vehicles from blockchain (admin only)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/blockchain/vehicles/all
```

### Available Chaincode Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `GetAllVehicles()` | Get all vehicles | `contract.evaluateTransaction('GetAllVehicles')` |
| `GetVehicle(vin)` | Get single vehicle | `contract.evaluateTransaction('GetVehicle', vin)` |
| `GetVehiclesByOwner(email)` | Get by owner | `contract.evaluateTransaction('GetVehiclesByOwner', email)` |
| `GetVehicleHistory(vin)` | Get history | `contract.evaluateTransaction('GetVehicleHistory', vin)` |
| `QueryVehiclesByStatus(status)` | Filter by status | `contract.evaluateTransaction('QueryVehiclesByStatus', status)` |

---

## Method 2: CouchDB Direct Access 🌐

CouchDB is Fabric's **state database** - it stores the current world state.

### Access CouchDB Web UI

**URL:** `http://localhost:5984/_utils`

**Credentials:**
- Username: `admin`
- Password: `adminpw` (default) or check `.env` file for `COUCHDB_PASSWORD`

**To find password in .env:**
```bash
# Linux/Mac
grep "COUCHDB_PASSWORD" .env

# Windows PowerShell
Select-String -Path .env -Pattern "COUCHDB_PASSWORD"
```

**If not found in .env, default is:** `adminpw`

### View Databases

1. **Open CouchDB UI:** `http://localhost:5984/_utils`
2. **Find database:** Look for `ltochannel_vehicle-registration` or similar
3. **Browse documents:** Each document is a vehicle record

### Query via CouchDB API

```bash
# List all databases
curl -u admin:adminpw http://localhost:5984/_all_dbs

# Get database info
curl -u admin:adminpw http://localhost:5984/ltochannel_vehicle-registration

# Query vehicles (Mango query)
curl -u admin:adminpw -X POST http://localhost:5984/ltochannel_vehicle-registration/_find \
  -H "Content-Type: application/json" \
  -d '{
    "selector": {
      "docType": "CR"
    },
    "limit": 10
  }'

# Get specific vehicle by VIN
curl -u admin:adminpw http://localhost:5984/ltochannel_vehicle-registration/VIN_HERE
```

### Docker Access

```bash
# Access CouchDB container
docker exec -it couchdb bash

# Or query from host
docker exec couchdb curl -u admin:adminpw http://localhost:5984/_all_dbs
```

---

## Method 3: Fabric CLI Commands 🔧

### Query via Peer CLI

```bash
# Enter CLI container
docker exec -it cli bash

# Query all vehicles (using chaincode)
peer chaincode query \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetAllVehicles","Args":[]}'

# Query specific vehicle
peer chaincode query \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetVehicle","Args":["VIN_HERE"]}'

# Query by owner
peer chaincode query \
  -C ltochannel \
  -n vehicle-registration \
  -c '{"function":"GetVehiclesByOwner","Args":["owner@email.com"]}'
```

### Get Block Information

```bash
# Get latest block number
peer channel getinfo -c ltochannel

# Get specific block
peer channel fetch 0 block_0.block -c ltochannel

# Decode block (requires jq)
cat block_0.block | jq
```

---

## Comparison: PostgreSQL vs Fabric

### PostgreSQL (Off-chain)
```bash
# Query PostgreSQL
psql -U lto_user -d lto_blockchain -c "SELECT vin, plate_number, status FROM vehicles;"
```

**Shows:** Current state, can be modified

### Fabric (On-chain)
```bash
# Query Fabric
node backend/scripts/show-fabric-vehicles.js
```

**Shows:** Immutable blockchain records, transaction history

---

## Quick Reference

### Check if Vehicle Exists on Fabric

```bash
# Using script
node backend/scripts/show-fabric-vehicles.js | grep "VIN_HERE"

# Using API
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/blockchain/vehicles/VIN_HERE

# Using CouchDB
curl -u admin:adminpw \
  http://localhost:5984/ltochannel_vehicle-registration/VIN_HERE
```

### Compare PostgreSQL vs Fabric

```bash
# PostgreSQL count
psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM vehicles WHERE status='REGISTERED';"

# Fabric count
node backend/scripts/show-fabric-vehicles.js | grep "Total vehicles"
```

---

## Troubleshooting

### "No vehicles found on Fabric"

**Possible causes:**
1. Vehicles were never registered on blockchain
2. Fabric network not running
3. Chaincode not deployed
4. Wrong channel name

**Check:**
```bash
# Verify Fabric is running
docker-compose -f docker-compose.unified.yml ps | grep peer

# Check chaincode is deployed
docker exec cli peer chaincode list --installed
docker exec cli peer chaincode list --instantiated -C ltochannel
```

### "Failed to connect to Fabric"

**Check:**
```bash
# Verify network config
cat config/network-config.json

# Check wallet exists
ls -la wallet/admin/

# Test connection
node -e "require('./backend/services/optimizedFabricService').initialize().then(() => console.log('OK')).catch(e => console.error(e))"
```

---

## Summary

✅ **Best Method:** Use `show-fabric-vehicles.js` script  
✅ **For Debugging:** Access CouchDB UI directly  
✅ **For Automation:** Use API endpoints or chaincode queries  

**Quick Start:**
```bash
node backend/scripts/show-fabric-vehicles.js
```

This will show you exactly what's stored on your Fabric blockchain! 🎯
