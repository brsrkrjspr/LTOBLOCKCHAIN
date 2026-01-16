# Document Upload Feature - SSH Commands Ready to Use

## Copy & Paste Ready Commands

### 1. Database Setup Commands

#### Connect to PostgreSQL
```bash
psql -U postgres -h localhost -d lto_system
```

#### Inside PostgreSQL - Run All at Once
```sql
-- Create MVIR sequence
CREATE SEQUENCE IF NOT EXISTS mvir_number_seq START WITH 1 INCREMENT BY 1;

-- Add inspection columns to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS mvir_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspection_result VARCHAR(20),
ADD COLUMN IF NOT EXISTS roadworthiness_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS emission_compliance VARCHAR(20),
ADD COLUMN IF NOT EXISTS inspection_officer VARCHAR(100),
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS inspection_documents JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_mvir ON vehicles(mvir_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_date ON vehicles(inspection_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_result ON vehicles(inspection_result);

-- Update documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50);

-- Create indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);

-- Verify the changes
\d vehicles
SELECT * FROM pg_sequences WHERE sequencename = 'mvir_number_seq';
```

#### Exit PostgreSQL
```sql
\q
```

---

### 2. File System Setup Commands

#### Create Uploads Directory
```bash
cd /path/to/LTO
mkdir -p backend/uploads/inspection-documents
chmod 755 backend/uploads/inspection-documents
ls -la backend/uploads/
```

#### For Production (If Running as Different User)
```bash
# Replace 'app-user' with your actual application user
sudo chown -R app-user:app-user backend/uploads/inspection-documents
sudo chmod -R 755 backend/uploads/inspection-documents
```

---

### 3. Verification Commands

#### Verify Database Changes
```bash
psql -U postgres -h localhost -d lto_system << EOF
-- Check inspection columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles'
AND (column_name LIKE 'inspection_%' OR column_name = 'mvir_number')
ORDER BY ordinal_position;

-- Check sequence exists
SELECT * FROM pg_sequences WHERE sequencename = 'mvir_number_seq';

-- Check documents table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'documents'
AND column_name LIKE '%inspection%'
ORDER BY ordinal_position;
EOF
```

#### Verify File Directory
```bash
ls -la backend/uploads/inspection-documents/
stat backend/uploads/inspection-documents/
```

---

### 4. Application Restart Commands

#### Stop Current Server
```bash
# If running in foreground
Ctrl+C

# If running in background
kill $(lsof -t -i :3001)
# or
pkill -f "node.*server.js"
```

#### Start Server
```bash
cd /path/to/LTO
npm start
```

#### Verify Server Running
```bash
curl http://localhost:3001/api/health
# Should return: {"status":"OK","message":"TrustChain LTO System is running",...}
```

---

### 5. All-in-One Setup Script

#### Save as `setup-document-upload.sh`
```bash
#!/bin/bash
set -e

echo "🔧 Setting up Document Upload Feature..."

# Variables
LTO_PATH="/path/to/LTO"
DB_USER="postgres"
DB_HOST="localhost"
DB_NAME="lto_system"
APP_USER="${APP_USER:-}"

# Step 1: File System Setup
echo "📁 Creating upload directory..."
mkdir -p "$LTO_PATH/backend/uploads/inspection-documents"
chmod 755 "$LTO_PATH/backend/uploads/inspection-documents"

if [ -n "$APP_USER" ]; then
    chown -R "$APP_USER:$APP_USER" "$LTO_PATH/backend/uploads/inspection-documents"
fi

echo "✅ Upload directory created"

# Step 2: Database Setup
echo "🗄️ Setting up database schema..."
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" << EOF
-- Create MVIR sequence
CREATE SEQUENCE IF NOT EXISTS mvir_number_seq START WITH 1 INCREMENT BY 1;

-- Add inspection columns to vehicles
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS mvir_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspection_result VARCHAR(20),
ADD COLUMN IF NOT EXISTS roadworthiness_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS emission_compliance VARCHAR(20),
ADD COLUMN IF NOT EXISTS inspection_officer VARCHAR(100),
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS inspection_documents JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_mvir ON vehicles(mvir_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_date ON vehicles(inspection_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_result ON vehicles(inspection_result);

-- Update documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50);

-- Create indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);
EOF

echo "✅ Database schema updated"

# Step 3: Verification
echo "🔍 Verifying changes..."
echo "  ✓ Upload directory:"
ls -lah "$LTO_PATH/backend/uploads/inspection-documents/"
echo ""
echo "  ✓ Database columns:"
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -c "SELECT column_name FROM information_schema.columns WHERE table_name='vehicles' AND column_name LIKE 'inspection_%' LIMIT 5;"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart your Node.js server: npm start"
echo "2. Test the upload feature:"
echo "   - Navigate to LTO Inspection form"
echo "   - Select a vehicle"
echo "   - Upload MVIR and photos"
echo "   - Verify in admin dashboard"
echo ""
```

#### Run the Script
```bash
chmod +x setup-document-upload.sh
./setup-document-upload.sh
```

---

### 6. Backup Commands (Before Deployment)

#### Backup Database
```bash
pg_dump -U postgres -h localhost -d lto_system > lto_backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Backup Application
```bash
tar -czf lto_backup_$(date +%Y%m%d_%H%M%S).tar.gz --exclude=node_modules --exclude=.git /path/to/LTO/
```

---

### 7. Rollback Commands (If Needed)

#### Restore Database Backup
```bash
psql -U postgres -h localhost -d lto_system < lto_backup_YYYYMMDD_HHMMSS.sql
```

#### Remove Inspection Columns (Full Rollback)
```bash
psql -U postgres -h localhost -d lto_system << EOF
ALTER TABLE vehicles DROP COLUMN IF EXISTS inspection_documents;
ALTER TABLE vehicles DROP COLUMN IF EXISTS inspection_notes;
ALTER TABLE vehicles DROP COLUMN IF EXISTS inspection_officer;
ALTER TABLE vehicles DROP COLUMN IF EXISTS emission_compliance;
ALTER TABLE vehicles DROP COLUMN IF EXISTS roadworthiness_status;
ALTER TABLE vehicles DROP COLUMN IF EXISTS inspection_result;
ALTER TABLE vehicles DROP COLUMN IF EXISTS inspection_date;
ALTER TABLE vehicles DROP COLUMN IF EXISTS mvir_number;

DROP SEQUENCE IF EXISTS mvir_number_seq;

ALTER TABLE documents DROP COLUMN IF EXISTS inspection_document_type;
ALTER TABLE documents DROP COLUMN IF EXISTS is_inspection_document;
EOF
```

---

### 8. Monitoring & Logs Commands

#### Watch Server Logs
```bash
tail -f logs/app.log
```

#### Check Node Process
```bash
ps aux | grep node
```

#### Check Port Usage
```bash
lsof -i :3001
```

#### Check Disk Usage (Uploads)
```bash
du -sh backend/uploads/inspection-documents/
find backend/uploads/inspection-documents/ -type f -exec ls -lh {} \;
```

---

### 9. Testing Commands

#### Test Database Connection
```bash
psql -U postgres -h localhost -d lto_system -c "SELECT version();"
```

#### Test API Endpoint (Requires Auth Token)
```bash
# Get your auth token first, then:
TOKEN="your_auth_token_here"
VEHICLE_ID="your_vehicle_uuid_here"

# Test GET documents endpoint
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/lto/inspect-documents/$VEHICLE_ID

# Test POST documents endpoint (with file)
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -F "vehicleId=$VEHICLE_ID" \
     -F "mvirDocument=@test.pdf" \
     http://localhost:3001/api/lto/inspect-documents
```

---

### 10. Cleanup Commands

#### Remove Old Uploaded Files (30 days+)
```bash
find backend/uploads/inspection-documents/ -type f -mtime +30 -delete
```

#### Clear Entire Upload Directory
```bash
rm -rf backend/uploads/inspection-documents/*
echo "Upload directory cleared"
```

---

## Troubleshooting Commands

### If Database Connection Fails
```bash
# Check PostgreSQL service
systemctl status postgresql
sudo systemctl start postgresql

# Test connection
psql -U postgres -h localhost -d lto_system -c "SELECT 1"
```

### If Uploads Directory Permission Denied
```bash
# Check permissions
ls -la backend/uploads/

# Fix permissions
chmod -R 755 backend/uploads/
chown -R $(whoami):$(whoami) backend/uploads/
```

### If Port 3001 Already in Use
```bash
# Find what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3002 npm start
```

### If Files Not Accessible via Browser
```bash
# Check if static route is working
curl http://localhost:3001/api/health  # Test API

# List files in directory
ls -la backend/uploads/inspection-documents/

# Check server logs
tail -100 logs/app.log
```

---

## Quick Reference Table

| Task | Command |
|------|---------|
| Connect to DB | `psql -U postgres -h localhost -d lto_system` |
| Create uploads dir | `mkdir -p backend/uploads/inspection-documents` |
| Fix permissions | `chmod 755 backend/uploads/inspection-documents` |
| Restart server | `npm start` (after stopping current) |
| Check server status | `curl http://localhost:3001/api/health` |
| View logs | `tail -f logs/app.log` |
| Backup database | `pg_dump -U postgres -d lto_system > backup.sql` |
| Verify schema | `psql -U postgres -d lto_system -c "\d vehicles"` |
| List uploaded files | `ls -lh backend/uploads/inspection-documents/` |
| Check port usage | `lsof -i :3001` |

---

## Implementation Checklist

### Pre-Deployment
- [ ] Back up database: `pg_dump -U postgres -d lto_system > backup.sql`
- [ ] Back up application: `tar -czf lto_backup.tar.gz /path/to/LTO/`

### Deployment
- [ ] Create uploads directory
- [ ] Set directory permissions  
- [ ] Create MVIR sequence
- [ ] Add inspection columns
- [ ] Create database indexes
- [ ] Restart Node.js server

### Post-Deployment
- [ ] Verify database changes
- [ ] Check uploads directory
- [ ] Test API endpoints
- [ ] Test upload functionality
- [ ] Test admin viewing
- [ ] Monitor logs

---

## Need Help?

If something goes wrong:

1. **Check logs**: `tail -f logs/app.log`
2. **Verify database**: Run verification commands above
3. **Check directory**: `ls -la backend/uploads/inspection-documents/`
4. **Restart server**: Kill process and restart npm start
5. **Rollback if needed**: Use rollback commands above

---

**Last Updated:** 2025-01-20
**Ready to Deploy:** ✅ YES
