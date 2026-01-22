# Complete System Reset Guide - Preserve Schema & Users

This guide resets all data while preserving:
- ✅ Database schema (all tables, indexes, functions)
- ✅ User accounts
- ✅ External issuers configuration
- ✅ Authentication data

## Prerequisites

1. **SSH into your server:**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Navigate to project directory:**
   ```bash
   cd ~/LTOBLOCKCHAIN
   ```

## Step-by-Step Reset

### Step 1: Backup Database (Recommended)

```bash
docker exec postgres pg_dump -U lto_user -d lto_blockchain > backup_$(date +%Y%m%d_%H%M%S).sql
echo "✓ Backup created: backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Step 2: Clear Database Data

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/clear-application-data.sql
```

**What this does:**
- Deletes all vehicles, transfers, documents, certificates
- Deletes all notifications and history
- Deletes system settings and config
- **Preserves:** users, external_issuers, authentication tables
- Resets OR/CR/MVIR number sequences to 1

### Step 3: Reset Fabric and IPFS Volumes

```bash
# Make script executable (if not already)
chmod +x scripts/reset-volumes.sh

# Run the reset script
bash scripts/reset-volumes.sh
```

**Or manually:**
```bash
# Stop containers
docker compose -f docker-compose.unified.yml stop ipfs peer0.lto.gov.ph orderer.lto.gov.ph couchdb

# Remove volumes (try both prefixed and direct names)
docker volume rm ltoblockchain_orderer-data 2>/dev/null || docker volume rm orderer-data 2>/dev/null || true
docker volume rm ltoblockchain_peer-data 2>/dev/null || docker volume rm peer-data 2>/dev/null || true
docker volume rm ltoblockchain_couchdb-data 2>/dev/null || docker volume rm couchdb-data 2>/dev/null || true
docker volume rm ltoblockchain_ipfs-data 2>/dev/null || docker volume rm ipfs-data 2>/dev/null || true

# Restart containers
docker compose -f docker-compose.unified.yml up -d ipfs peer0.lto.gov.ph orderer.lto.gov.ph couchdb
```

**What this does:**
- Deletes all blockchain transaction history
- Deletes all IPFS stored documents
- Creates fresh volumes on restart

### Step 4: Verify Reset

```bash
# Check database
echo "=== Database Status ==="
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as users FROM users;"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as vehicles FROM vehicles;"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as issuers FROM external_issuers;"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as documents FROM documents;"

# Check volumes
echo ""
echo "=== Volume Status ==="
docker volume ls | grep -E "(orderer|peer|couchdb|ipfs)" || echo "No Fabric/IPFS volumes found (reset successful)"

# Check containers
echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.unified.yml ps
```

### Step 5: Restart Application (if needed)

```bash
docker compose -f docker-compose.unified.yml restart lto-app
```

## All-in-One Command (Copy-Paste Everything)

```bash
cd ~/LTOBLOCKCHAIN

# Backup database
docker exec postgres pg_dump -U lto_user -d lto_blockchain > backup_$(date +%Y%m%d_%H%M%S).sql
echo "✓ Backup created"

# Clear database
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/clear-application-data.sql
echo "✓ Database cleared"

# Reset volumes
chmod +x scripts/reset-volumes.sh
bash scripts/reset-volumes.sh

# Verify
echo "=== Verification ==="
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as vehicles FROM vehicles; SELECT COUNT(*) as issuers FROM external_issuers;"
docker compose -f docker-compose.unified.yml ps
```

## What Gets Preserved

✅ **Database Schema:**
- All tables, columns, indexes
- All functions, triggers, views
- All ENUM types

✅ **User Data:**
- All user accounts (users table)
- Authentication tokens (refresh_tokens, sessions)
- Email verification tokens

✅ **Configuration:**
- External issuers (insurance companies, emission centers, HPG)

## What Gets Deleted

❌ **Application Data:**
- All vehicles and registrations
- All transfer requests
- All documents
- All certificates
- All notifications
- All history records
- System settings
- Registration document requirements config

❌ **Blockchain Data:**
- All Fabric transaction history
- All blockchain state

❌ **IPFS Data:**
- All stored documents/files

## After Reset

1. **Re-initialize Fabric network** (if needed):
   ```bash
   bash scripts/complete-fabric-reset.sh
   ```

2. **Re-deploy chaincode** (if needed):
   ```bash
   # Follow your chaincode deployment process
   ```

3. **Re-create external issuers** (if they were deleted):
   ```sql
   -- Insert your issuer records
   INSERT INTO external_issuers (issuer_type, company_name, license_number, ...) VALUES (...);
   ```

## Troubleshooting

**Issue:** "Volume not found"
- Solution: Volume may already be removed. Continue with next step.

**Issue:** "Foreign key constraint violation"
- Solution: Make sure you ran the SQL script in the correct order (it's wrapped in a transaction).

**Issue:** "Container won't start"
- Solution: Check logs: `docker compose -f docker-compose.unified.yml logs [service-name]`

**Issue:** "Permission denied" on scripts
- Solution: Run `chmod +x scripts/reset-volumes.sh`

## Quick Reference

### Essential Commands

```bash
# Clear database only
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/clear-application-data.sql

# Reset volumes only
bash scripts/reset-volumes.sh

# Check what will be preserved
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM external_issuers;"

# Check what will be deleted
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles; SELECT COUNT(*) FROM documents;"
```

---

**Last Updated:** Based on docker-compose.unified.yml configuration  
**Status:** Ready for use
