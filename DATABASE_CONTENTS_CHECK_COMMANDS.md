# Database Contents Check Commands

Quick reference for inspecting actual data stored in PostgreSQL and IPFS.

---

## 🐳 PostgreSQL Database Contents

### Connect to Database

```bash
# Via Docker
docker exec -it postgres psql -U lto_user -d lto_blockchain

# Or via docker-compose
docker compose -f docker-compose.unified.yml exec postgres psql -U lto_user -d lto_blockchain
```

---

## 📊 Quick Content Checks

### 1. Count All Tables (Quick Overview)

```sql
SELECT 
    'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'transfer_requests', COUNT(*) FROM transfer_requests
UNION ALL
SELECT 'transfer_documents', COUNT(*) FROM transfer_documents
UNION ALL
SELECT 'vehicle_verifications', COUNT(*) FROM vehicle_verifications
UNION ALL
SELECT 'vehicle_history', COUNT(*) FROM vehicle_history
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY row_count DESC;
```

### 2. View Users

```sql
-- All users
SELECT id, email, first_name, last_name, role, is_active, created_at 
FROM users 
ORDER BY created_at DESC;

-- Count by role
SELECT role, COUNT(*) as count 
FROM users 
GROUP BY role;
```

### 3. View Vehicles

```sql
-- Recent vehicles
SELECT id, vin, plate_number, make, model, year, status, owner_id, registration_date 
FROM vehicles 
ORDER BY registration_date DESC 
LIMIT 20;

-- Vehicles by status
SELECT status, COUNT(*) as count 
FROM vehicles 
GROUP BY status;
```

### 4. View Documents

```sql
-- All documents with details
SELECT 
    d.id,
    d.vehicle_id,
    v.plate_number,
    d.document_type,
    d.original_name,
    d.file_size,
    d.ipfs_cid,
    d.verified,
    d.uploaded_at
FROM documents d
LEFT JOIN vehicles v ON d.vehicle_id = v.id
ORDER BY d.uploaded_at DESC
LIMIT 20;

-- Documents by type
SELECT document_type, COUNT(*) as count, 
       COUNT(CASE WHEN ipfs_cid IS NOT NULL THEN 1 END) as with_ipfs
FROM documents 
GROUP BY document_type 
ORDER BY count DESC;

-- Documents with IPFS CID
SELECT id, document_type, original_name, ipfs_cid, file_size 
FROM documents 
WHERE ipfs_cid IS NOT NULL 
ORDER BY uploaded_at DESC;
```

### 5. View Transfer Requests

```sql
-- All transfer requests
SELECT 
    tr.id,
    tr.vehicle_id,
    v.plate_number,
    tr.seller_id,
    tr.buyer_id,
    tr.status,
    tr.submitted_at,
    tr.reviewed_at
FROM transfer_requests tr
LEFT JOIN vehicles v ON tr.vehicle_id = v.id
ORDER BY tr.submitted_at DESC;

-- Transfer requests by status
SELECT status, COUNT(*) as count 
FROM transfer_requests 
GROUP BY status;
```

### 6. View Transfer Documents

```sql
-- Transfer documents with details
SELECT 
    td.id,
    td.transfer_request_id,
    td.document_type,
    td.document_id,
    d.original_name,
    td.uploaded_at
FROM transfer_documents td
LEFT JOIN documents d ON td.document_id = d.id
ORDER BY td.uploaded_at DESC;

-- Transfer documents by type
SELECT document_type, COUNT(*) as count 
FROM transfer_documents 
GROUP BY document_type;
```

### 7. View Vehicle Verifications

```sql
-- All verifications
SELECT 
    vv.id,
    vv.vehicle_id,
    v.plate_number,
    vv.verification_type,
    vv.status,
    vv.verified_by,
    vv.verified_at
FROM vehicle_verifications vv
LEFT JOIN vehicles v ON vv.vehicle_id = v.id
ORDER BY vv.verified_at DESC;
```

### 8. View Vehicle History (Audit Trail)

```sql
-- Recent history
SELECT 
    vh.id,
    vh.vehicle_id,
    v.plate_number,
    vh.action,
    vh.description,
    vh.performed_by,
    vh.performed_at,
    vh.transaction_id
FROM vehicle_history vh
LEFT JOIN vehicles v ON vh.vehicle_id = v.id
ORDER BY vh.performed_at DESC
LIMIT 50;
```

---

## 🔍 IPFS Contents Check

### Connect to IPFS

```bash
# Check if IPFS container is running
docker ps | grep ipfs

# Access IPFS container
docker exec -it ipfs sh
```

### IPFS API Commands

```bash
# Check IPFS version
curl -X POST http://localhost:5001/api/v0/version

# Get IPFS node ID
curl -X POST http://localhost:5001/api/v0/id

# List all pinned files
curl -X POST http://localhost:5001/api/v0/pin/ls

# Get repository statistics
curl -X POST http://localhost:5001/api/v0/stats/repo

# List connected peers
curl -X POST http://localhost:5001/api/v0/swarm/peers

# Get file by CID (test)
curl -X POST http://localhost:5001/api/v0/cat?arg=<CID>
```

### Via Docker

```bash
# IPFS version
docker exec ipfs ipfs version

# IPFS node ID
docker exec ipfs ipfs id

# List pinned files
docker exec ipfs ipfs pin ls

# Repository stats
docker exec ipfs ipfs stats repo

# Connected peers
docker exec ipfs ipfs swarm peers
```

---

## 📋 Complete Database Contents Report

### Run the Automated Script

**Linux/Mac:**
```bash
chmod +x scripts/check-database-contents.sh
./scripts/check-database-contents.sh
```

**Via Docker:**
```bash
docker cp scripts/check-database-contents.sh postgres:/tmp/
docker exec postgres bash /tmp/check-database-contents.sh
```

**IPFS Check:**
```bash
chmod +x scripts/check-ipfs-contents.sh
./scripts/check-ipfs-contents.sh
```

---

## 🔍 Detailed Inspection Queries

### Find Documents Linked to Transfers

```sql
-- Documents used in transfers
SELECT 
    d.id,
    d.document_type,
    d.original_name,
    d.ipfs_cid,
    td.transfer_request_id,
    td.document_type as transfer_role,
    tr.status as transfer_status
FROM documents d
JOIN transfer_documents td ON d.id = td.document_id
JOIN transfer_requests tr ON td.transfer_request_id = tr.id
ORDER BY td.uploaded_at DESC;
```

### Find Vehicles with Transfer History

```sql
-- Vehicles that have been transferred
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    COUNT(tr.id) as transfer_count,
    MAX(tr.submitted_at) as last_transfer
FROM vehicles v
JOIN transfer_requests tr ON v.id = tr.vehicle_id
GROUP BY v.id, v.vin, v.plate_number
ORDER BY last_transfer DESC;
```

### Find Documents Without IPFS CID

```sql
-- Documents stored locally (not in IPFS)
SELECT 
    id,
    document_type,
    original_name,
    file_path,
    uploaded_at
FROM documents
WHERE ipfs_cid IS NULL
ORDER BY uploaded_at DESC;
```

### Find Recent Activity

```sql
-- Recent activity across all tables
SELECT 'Vehicle Registration' as activity, registration_date as date, id::text as id
FROM vehicles
WHERE registration_date > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Document Upload', uploaded_at, id::text
FROM documents
WHERE uploaded_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Transfer Request', submitted_at, id::text
FROM transfer_requests
WHERE submitted_at > NOW() - INTERVAL '7 days'
ORDER BY date DESC
LIMIT 50;
```

---

## 📊 Statistics Queries

### Overall Statistics

```sql
-- Complete system statistics
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM vehicles) as total_vehicles,
    (SELECT COUNT(*) FROM documents) as total_documents,
    (SELECT COUNT(*) FROM documents WHERE ipfs_cid IS NOT NULL) as ipfs_documents,
    (SELECT COUNT(*) FROM transfer_requests) as total_transfers,
    (SELECT COUNT(*) FROM transfer_requests WHERE status = 'APPROVED') as approved_transfers,
    (SELECT COUNT(*) FROM vehicle_verifications WHERE status = 'APPROVED') as approved_verifications;
```

### Document Storage Statistics

```sql
-- Storage breakdown
SELECT 
    CASE 
        WHEN ipfs_cid IS NOT NULL THEN 'IPFS'
        ELSE 'Local'
    END as storage_type,
    COUNT(*) as document_count,
    SUM(file_size) as total_size_bytes,
    ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as total_size_mb
FROM documents
GROUP BY storage_type;
```

### Transfer Statistics

```sql
-- Transfer request statistics
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM transfer_requests), 2) as percentage
FROM transfer_requests
GROUP BY status
ORDER BY count DESC;
```

---

## 🔐 IPFS Content Verification

### Check Specific Document in IPFS

```bash
# If you have a CID from the database
CID="QmYourCIDHere"

# Check if file exists in IPFS
docker exec ipfs ipfs pin ls $CID

# Get file info
docker exec ipfs ipfs object stat $CID

# Download file (test)
docker exec ipfs ipfs cat $CID > /tmp/test-file.pdf
```

### Compare Database CIDs with IPFS

```sql
-- Get all IPFS CIDs from database
SELECT DISTINCT ipfs_cid 
FROM documents 
WHERE ipfs_cid IS NOT NULL;
```

Then verify each CID:
```bash
# For each CID, check if it exists in IPFS
docker exec ipfs ipfs pin ls <CID>
```

---

## 🚀 One-Liner Quick Checks

### Count Everything
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -t -A -c \
  "SELECT 'users: ' || COUNT(*) FROM users UNION ALL SELECT 'vehicles: ' || COUNT(*) FROM vehicles UNION ALL SELECT 'documents: ' || COUNT(*) FROM documents;"
```

### Check IPFS Status
```bash
docker exec ipfs ipfs stats repo | grep -E "RepoSize|StorageMax"
```

### Count Documents with IPFS
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -t -A -c \
  "SELECT COUNT(*) FROM documents WHERE ipfs_cid IS NOT NULL;"
```

---

## 📝 Export Data (Optional)

### Export to CSV

```sql
-- Export vehicles to CSV
\copy (SELECT * FROM vehicles) TO '/tmp/vehicles.csv' CSV HEADER;

-- Export documents to CSV
\copy (SELECT * FROM documents) TO '/tmp/documents.csv' CSV HEADER;
```

### Export via Docker

```bash
# Export vehicles
docker exec postgres psql -U lto_user -d lto_blockchain -c \
  "\copy (SELECT * FROM vehicles) TO STDOUT CSV HEADER" > vehicles.csv

# Export documents
docker exec postgres psql -U lto_user -d lto_blockchain -c \
  "\copy (SELECT * FROM documents) TO STDOUT CSV HEADER" > documents.csv
```

---

**Last Updated:** 2024-01-XX  
**For:** DigitalOcean Production Deployment
