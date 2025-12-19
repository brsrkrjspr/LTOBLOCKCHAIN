# Database Schema Check Commands

Quick reference for checking your database schema to verify the transfer refactoring requirements.

---

## 🐳 Docker Environment (DigitalOcean Production)

### Option 1: Check via Docker Container (Recommended)

```bash
# Connect to PostgreSQL container
docker exec -it postgres psql -U lto_user -d lto_blockchain

# Or if using docker-compose
docker compose -f docker-compose.unified.yml exec postgres psql -U lto_user -d lto_blockchain
```

### Option 2: Check from Host Machine

```bash
# If PostgreSQL port is exposed
psql -h localhost -p 5432 -U lto_user -d lto_blockchain

# Or via Docker network
psql -h postgres -p 5432 -U lto_user -d lto_blockchain
```

---

## 📋 Essential Schema Check Commands

### 1. Check document_type ENUM Values ⚠️ **MOST IMPORTANT**

```sql
-- Check all ENUM values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') 
ORDER BY enumsortorder;
```

**Expected Output (8 values):**
```
enumlabel
---------------
registration_cert
insurance_cert
emission_cert
owner_id
deed_of_sale      ← Must be present
seller_id         ← Must be present
buyer_id          ← Must be present
other             ← Must be present
```

### 2. Check documents Table Structure

```sql
-- Check if documents table exists and has required columns
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;
```

**Expected:**
- `document_type` column with `udt_name = 'document_type'` (ENUM)
- `ipfs_cid` column (VARCHAR)

### 3. Check transfer_documents Table Constraint

```sql
-- Check CHECK constraint on transfer_documents
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%transfer_document%';
```

**Expected:**
```
constraint_name: check_transfer_document_type (or similar)
check_clause: (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other'))
```

### 4. Check All Required Tables Exist

```sql
-- Check if all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'transfer_requests', 'transfer_documents')
ORDER BY table_name;
```

**Expected (3 tables):**
```
table_name
---------------
documents
transfer_documents
transfer_requests
```

### 5. Check transfer_requests Table Structure

```sql
-- Check required columns in transfer_requests
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transfer_requests'
AND column_name IN ('vehicle_id', 'seller_id', 'buyer_id', 'buyer_info', 'status')
ORDER BY column_name;
```

---

## 🔍 Quick Verification Script

### Using the Provided Script

**Linux/Mac (Bash):**
```bash
# Make executable
chmod +x scripts/check-database-schema.sh

# Run the script
./scripts/check-database-schema.sh
```

**Windows (PowerShell):**
```powershell
# Run the script
.\scripts\check-database-schema.ps1
```

**Via Docker:**
```bash
# Copy script to container and run
docker cp scripts/check-database-schema.sh postgres:/tmp/
docker exec postgres bash /tmp/check-database-schema.sh
```

---

## 📊 One-Line Quick Checks

### Check ENUM Values (Quick)
```sql
SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type');
```

### Count Documents by Type
```sql
SELECT document_type, COUNT(*) 
FROM documents 
GROUP BY document_type 
ORDER BY document_type;
```

### Check if Migration is Needed
```sql
-- Returns count of new ENUM values (should be 4 if migration is complete)
SELECT COUNT(*) 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
AND enumlabel IN ('deed_of_sale', 'seller_id', 'buyer_id', 'other');
```

**Expected:** Should return `4` if migration is complete, `0` if not.

---

## 🐳 Docker-Specific Commands

### Access PostgreSQL Container
```bash
# Method 1: Direct exec
docker exec -it postgres psql -U lto_user -d lto_blockchain

# Method 2: Via docker-compose
docker compose -f docker-compose.unified.yml exec postgres psql -U lto_user -d lto_blockchain

# Method 3: Run command without interactive shell
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();"
```

### Check Container Status
```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs postgres --tail 50

# Check container resource usage
docker stats postgres --no-stream
```

### Run Migration Script via Docker
```bash
# Copy migration script to container
docker cp database/add-new-document-types.sql postgres:/tmp/

# Run migration
docker exec postgres psql -U lto_user -d lto_blockchain -f /tmp/add-new-document-types.sql
```

---

## 🔐 Connection Details

### Environment Variables (from .env or docker-compose)
```bash
# Check environment variables
echo $DB_HOST
echo $DB_PORT
echo $DB_NAME
echo $DB_USER

# Or in docker-compose
docker compose -f docker-compose.unified.yml config | grep -A 5 POSTGRES
```

### Default Values (if not set)
- **Host:** `localhost` (or `postgres` in Docker network)
- **Port:** `5432`
- **Database:** `lto_blockchain`
- **User:** `lto_user`
- **Password:** `lto_password` (check your .env or docker-compose.yml)

---

## ✅ Complete Verification Checklist

Run these commands to verify everything is correct:

```sql
-- 1. Check ENUM has 8 values
SELECT COUNT(*) FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type');
-- Expected: 8

-- 2. Check new ENUM values exist
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
AND enumlabel IN ('deed_of_sale', 'seller_id', 'buyer_id', 'other');
-- Expected: 4 rows

-- 3. Check documents table has ipfs_cid
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'documents' AND column_name = 'ipfs_cid';
-- Expected: 1 row

-- 4. Check transfer_documents constraint
SELECT COUNT(*) FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%transfer_document%';
-- Expected: 1 or more

-- 5. Check all tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'transfer_requests', 'transfer_documents');
-- Expected: 3
```

---

## 🚨 Troubleshooting

### Can't Connect to Database

**Check if PostgreSQL is running:**
```bash
# Docker
docker ps | grep postgres

# Check logs
docker logs postgres
```

**Check connection string:**
```bash
# Test connection
psql -h localhost -p 5432 -U lto_user -d lto_blockchain -c "SELECT 1;"
```

### ENUM Values Missing

**Run migration:**
```bash
# Via Docker
docker exec postgres psql -U lto_user -d lto_blockchain -f /path/to/add-new-document-types.sql

# Or manually
docker exec -it postgres psql -U lto_user -d lto_blockchain
# Then run the SQL from add-new-document-types.sql
```

### Permission Denied

**Check user permissions:**
```sql
-- Check current user
SELECT current_user;

-- Check if user has access
SELECT has_table_privilege('lto_user', 'documents', 'SELECT');
```

---

## 📝 Quick Reference

| What to Check | Command |
|---------------|---------|
| ENUM values | `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type');` |
| Table exists | `SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';` |
| Column exists | `SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'ipfs_cid';` |
| Constraint exists | `SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%transfer_document%';` |
| Count documents | `SELECT COUNT(*) FROM documents;` |
| Count by type | `SELECT document_type, COUNT(*) FROM documents GROUP BY document_type;` |

---

**Last Updated:** 2024-01-XX  
**For:** DigitalOcean Production Deployment
