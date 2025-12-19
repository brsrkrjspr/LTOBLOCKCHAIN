# Deployment Commands & Database Verification

## 🔄 Service Restart Requirements

### **Do you need to restart IPFS and PostgreSQL?**

**Answer: NO** - You only need to restart the **backend (lto-app)** container.

**Why:**
- ✅ **PostgreSQL**: Database schema changes were already applied (if needed). No restart required for code changes.
- ✅ **IPFS**: Not affected by these changes. No restart needed.
- ⚠️ **Backend (lto-app)**: **MUST RESTART** to load new code changes (buyer validation, transfer button logic)

---

## 🐳 Docker Commands

### **Restart Backend Only**
```bash
docker-compose restart lto-app
```

### **Or Restart All Services (if needed)**
```bash
docker-compose -f docker-compose.unified.yml restart
```

### **View Running Containers**
```bash
docker ps
```

---

## 📊 Database Schema Verification Commands

### **1. Check if Required Tables Exist**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'vehicles', 'transfer_requests', 'transfer_documents', 'documents')
ORDER BY table_name;"
```

### **2. Check transfer_requests Table Structure**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d transfer_requests"
```

### **3. Check transfer_documents Table Structure**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d transfer_documents"
```

### **4. Check Users Table Structure (for profile updates)**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d users"
```

### **5. Verify Multi-Org Approval Columns (if migration was run)**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND column_name LIKE '%approval%'
ORDER BY column_name;"
```

### **6. Check All Required Columns Exist**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain << 'EOF'
-- Check transfer_requests columns
SELECT 'transfer_requests' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND column_name IN ('id', 'vehicle_id', 'seller_id', 'buyer_id', 'buyer_info', 'status', 'submitted_at', 'created_at')
ORDER BY column_name;

-- Check users table columns (for profile)
SELECT 'users' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('id', 'email', 'first_name', 'last_name', 'phone', 'organization', 'created_at', 'updated_at')
ORDER BY column_name;
EOF
```

### **7. Comprehensive Schema Check (All-in-One)**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain << 'EOF'
-- Table existence
SELECT '=== TABLE EXISTENCE ===' as check_type;
SELECT table_name, 
       EXISTS (SELECT FROM information_schema.tables WHERE table_name = t.table_name) as exists 
FROM (VALUES 
    ('users'), 
    ('vehicles'), 
    ('transfer_requests'), 
    ('transfer_documents'),
    ('documents')
) t(table_name);

-- transfer_requests structure
SELECT '=== TRANSFER_REQUESTS STRUCTURE ===' as check_type;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
ORDER BY ordinal_position;

-- transfer_documents structure
SELECT '=== TRANSFER_DOCUMENTS STRUCTURE ===' as check_type;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transfer_documents' 
ORDER BY ordinal_position;

-- Users table structure (for profile)
SELECT '=== USERS STRUCTURE ===' as check_type;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('id', 'email', 'first_name', 'last_name', 'phone', 'organization', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- Check constraints
SELECT '=== TRANSFER_DOCUMENTS CONSTRAINTS ===' as check_type;
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'transfer_documents'::regclass 
AND contype = 'c';
EOF
```

---

## 📝 Backend Logs Commands

### **1. View Backend Logs (Last 100 lines)**
```bash
docker logs lto-app --tail 100
```

### **2. Follow Backend Logs (Real-time)**
```bash
docker logs -f lto-app
```

### **3. View Backend Logs with Timestamps**
```bash
docker logs -t lto-app --tail 100
```

### **4. View Logs for Specific Time Range**
```bash
docker logs lto-app --since 10m
docker logs lto-app --since 1h
docker logs lto-app --since 2024-01-01T00:00:00
```

### **5. Search Logs for Errors**
```bash
docker logs lto-app 2>&1 | grep -i error
docker logs lto-app 2>&1 | grep -i "transfer\|buyer\|validation"
```

### **6. View Last 50 Lines and Follow**
```bash
docker logs -f --tail 50 lto-app
```

### **7. Export Logs to File**
```bash
docker logs lto-app > backend-logs.txt 2>&1
```

### **8. View Logs from Specific Container (if multiple)**
```bash
# List all containers
docker ps

# View logs from specific container
docker logs <container-name>
```

---

## 🔍 Quick Verification Checklist

### **After Restarting Backend:**

1. **Check Backend is Running:**
   ```bash
   docker ps | grep lto-app
   ```

2. **Check Backend Logs for Errors:**
   ```bash
   docker logs lto-app --tail 50 | grep -i error
   ```

3. **Verify Database Connection:**
   ```bash
   docker logs lto-app --tail 20 | grep -i "database\|postgres\|connected"
   ```

4. **Test API Endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

---

## 🚨 Troubleshooting

### **If Backend Won't Start:**
```bash
# Check logs for startup errors
docker logs lto-app --tail 100

# Check if port is already in use
netstat -tuln | grep 3001

# Restart with fresh logs
docker-compose restart lto-app
docker logs -f lto-app
```

### **If Database Connection Fails:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test database connection
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();"

# Check backend logs for connection errors
docker logs lto-app | grep -i "database\|postgres\|connection"
```

### **If Schema Issues:**
```bash
# Verify tables exist
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"

# Check specific table
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d transfer_requests"
```

---

## 📋 Summary

**Restart Required:**
- ✅ **Backend (lto-app)** - YES (for code changes)
- ❌ **PostgreSQL** - NO (schema already applied)
- ❌ **IPFS** - NO (not affected)

**Verification:**
- Use database commands above to verify schema
- Use backend log commands to check for errors
- Test API endpoints after restart
