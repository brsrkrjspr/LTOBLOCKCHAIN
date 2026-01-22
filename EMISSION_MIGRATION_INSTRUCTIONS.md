# Emission Columns Removal - Migration Instructions

## 🚨 Issue: PostgreSQL Client Not Found

You're getting this error because PostgreSQL client tools are not installed on your host system. However, **you don't need them!** The project uses Docker, and PostgreSQL runs inside a container.

---

## ✅ Solution: Use Docker to Run Migration

Since PostgreSQL runs in Docker, you need to use `docker exec` to run commands inside the container.

### **Option 1: Use the Provided Script (Recommended)**

#### **On Linux/SSH:**
```bash
cd ~/LTOBLOCKCHAIN
chmod +x scripts/remove-emission-columns.sh
./scripts/remove-emission-columns.sh
```

#### **On Windows (PowerShell):**
```powershell
cd C:\Users\Lenovo\Documents\LTO
.\scripts\remove-emission-columns.ps1
```

---

### **Option 2: Manual Docker Commands**

#### **Step 1: Check if PostgreSQL container is running**
```bash
docker ps | grep postgres
```

If not running, start it:
```bash
docker-compose up -d postgres
# Wait 10-15 seconds for it to start
```

#### **Step 2: Create backup**
```bash
docker exec postgres pg_dump -U lto_user -d lto_blockchain > backup_before_emission_removal_$(date +%Y%m%d_%H%M%S).sql
```

#### **Step 3: Run migration**
```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/remove-emission-columns.sql
```

#### **Step 4: Verify removal**
```bash
# Check transfer_requests table
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND column_name LIKE 'emission%';
"
# Should return 0 rows

# Check vehicles table
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name = 'emission_compliance';
"
# Should return 0 rows
```

---

## 🔧 Alternative: If You Want to Install PostgreSQL Client

If you prefer to install PostgreSQL client tools on your host system:

### **On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client-15
```

### **On CentOS/RHEL:**
```bash
sudo yum install postgresql15
```

### **On Windows:**
Download and install PostgreSQL from: https://www.postgresql.org/download/windows/

**However, this is NOT necessary** - using Docker is the recommended approach.

---

## 📋 Quick Reference Commands

### **Check container status:**
```bash
docker ps | grep postgres
```

### **Start PostgreSQL container:**
```bash
docker-compose up -d postgres
```

### **Stop PostgreSQL container:**
```bash
docker-compose stop postgres
```

### **View PostgreSQL logs:**
```bash
docker logs postgres
```

### **Connect to PostgreSQL interactively:**
```bash
docker exec -it postgres psql -U lto_user -d lto_blockchain
```

### **Run a single SQL command:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();"
```

### **Run SQL file:**
```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < your-file.sql
```

---

## ✅ Verification After Migration

After running the migration, verify:

1. **Check columns are removed:**
   ```bash
   docker exec postgres psql -U lto_user -d lto_blockchain -c "
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'transfer_requests' 
   AND column_name LIKE 'emission%';
   "
   ```

2. **Test application:**
   - Start your backend: `npm start`
   - Test transfer workflow (should only check insurance + HPG)
   - Check application logs for errors

3. **Verify frontend:**
   - Open `verifier-dashboard.html`
   - Should show deprecation warning message

---

## 🚨 Rollback (If Needed)

If you need to rollback the migration:

```bash
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/rollback-emission-columns.sql
```

**Note:** Rollback will restore columns but **will not restore data** that was in those columns.

---

## 📝 Summary

**Problem:** `psql` command not found on host system  
**Solution:** Use `docker exec` to run commands inside PostgreSQL container  
**Recommended:** Use the provided script (`remove-emission-columns.sh` or `.ps1`)

**No need to install PostgreSQL client on your host system!** Docker handles everything.
