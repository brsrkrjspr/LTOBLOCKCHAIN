# PostgreSQL Integration Guide
## Complete Step-by-Step Guide

This guide will help you integrate PostgreSQL database with your TrustChain LTO system.

---

## 📋 **PREREQUISITES**

Before starting, ensure you have:

- ✅ **Docker Desktop** installed and running
- ✅ **Node.js** (v16+) and npm installed
- ✅ **PowerShell** (for Windows scripts)

---

## 🚀 **QUICK START (Automated Setup)**

The easiest way is to use the automated setup script:

```powershell
.\scripts\setup-postgresql.ps1
```

This will:
1. Start PostgreSQL container
2. Initialize database with schema
3. Test connection
4. Display connection information

**Time: ~2-3 minutes**

---

## 📝 **MANUAL SETUP**

### **STEP 1: Install PostgreSQL Package**

```powershell
npm install
```

This installs the `pg` (PostgreSQL client) package.

### **STEP 2: Start PostgreSQL Container**

```powershell
docker-compose -f docker-compose.laptop.yml up -d postgres
```

Wait 10-15 seconds for PostgreSQL to initialize.

### **STEP 3: Verify Database is Running**

```powershell
docker ps | Select-String "postgres"
```

Should show the postgres container running.

### **STEP 4: Test Connection**

```powershell
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();"
```

Should return PostgreSQL version information.

---

## ⚙️ **CONFIGURE APPLICATION**

### **Update .env File**

Create or update `.env` file in project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Other settings
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
BCRYPT_ROUNDS=12
```

### **Restart Application**

```powershell
npm start
```

---

## ✅ **VERIFICATION**

### **Check Database Connection**

Look for this in application logs:
```
✅ PostgreSQL connection successful
📅 Database time: [timestamp]
```

### **Test API Endpoints**

```powershell
# Test login (uses database)
Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"admin@lto.gov.ph","password":"admin123"}' `
    -UseBasicParsing
```

Should return user data and token.

### **Check Database Tables**

```powershell
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"
```

Should list all tables:
- users
- vehicles
- vehicle_verifications
- documents
- vehicle_history
- notifications
- system_settings

---

## 📊 **DATABASE SCHEMA**

The database includes:

### **Tables:**
- **users** - User accounts and authentication
- **vehicles** - Vehicle registration data
- **vehicle_verifications** - Verification status (insurance, emission, admin)
- **documents** - Document metadata
- **vehicle_history** - Audit trail
- **notifications** - User notifications
- **system_settings** - System configuration

### **Default Users:**
- `admin@lto.gov.ph` / `admin123` - Administrator
- `staff@lto.gov.ph` / `admin123` - Staff
- `insurance@lto.gov.ph` / `admin123` - Insurance Verifier
- `emission@lto.gov.ph` / `admin123` - Emission Verifier
- `owner@example.com` / `admin123` - Vehicle Owner

---

## 🔍 **TROUBLESHOOTING**

### **Problem: "Docker is not running"**

**Solution:**
```powershell
# Start Docker Desktop
# Then retry the setup script
```

### **Problem: "Connection refused"**

**Solution:**
```powershell
# Check if PostgreSQL is running
docker ps | Select-String "postgres"

# Check logs
docker-compose -f docker-compose.laptop.yml logs postgres

# Restart if needed
docker-compose -f docker-compose.laptop.yml restart postgres
```

### **Problem: "Database does not exist"**

**Solution:**
```powershell
# The database should be created automatically
# If not, check init script:
docker exec postgres psql -U lto_user -d postgres -c "CREATE DATABASE lto_blockchain;"
```

### **Problem: "Application can't connect"**

**Check:**
1. `.env` file has correct database credentials
2. PostgreSQL container is running
3. Port 5432 is not blocked
4. Application restarted after `.env` changes

### **Problem: "Table does not exist"**

**Solution:**
```powershell
# Re-run initialization script
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/init-laptop.sql
```

---

## 📊 **DATABASE OPERATIONS**

### **Connect to Database**

```powershell
docker exec -it postgres psql -U lto_user -d lto_blockchain
```

### **View All Tables**

```sql
\dt
```

### **View Table Structure**

```sql
\d users
\d vehicles
```

### **Query Data**

```sql
SELECT * FROM users;
SELECT * FROM vehicles LIMIT 10;
```

### **Exit psql**

```sql
\q
```

---

## 🔄 **MIGRATIONS**

### **Reset Database (WARNING: Deletes all data)**

```powershell
# Stop container
docker-compose -f docker-compose.laptop.yml stop postgres

# Remove volume
docker volume rm lto-blockchain_postgres-data

# Start again (will recreate database)
docker-compose -f docker-compose.laptop.yml up -d postgres
```

### **Backup Database**

```powershell
docker exec postgres pg_dump -U lto_user lto_blockchain > backup.sql
```

### **Restore Database**

```powershell
docker exec -i postgres psql -U lto_user -d lto_blockchain < backup.sql
```

---

## 🛑 **STOPPING THE DATABASE**

To stop PostgreSQL:

```powershell
docker-compose -f docker-compose.laptop.yml stop postgres
```

To stop and remove data:

```powershell
docker-compose -f docker-compose.laptop.yml down -v
```

**Warning:** This will delete all database data!

---

## 📁 **FILE STRUCTURE**

After setup:

```
LTOBLOCKCHAIN/
├── backend/
│   ├── database/
│   │   ├── db.js              # Database connection
│   │   └── services.js        # Database service helpers
│   └── routes/
│       ├── auth.js            # Updated to use PostgreSQL
│       └── vehicles.js        # Updated to use PostgreSQL
├── database/
│   └── init-laptop.sql        # Database schema
└── .env                        # Environment variables
```

---

## 🎯 **WHAT'S BEEN UPDATED**

### **Backend Changes:**
- ✅ Added `pg` package to `package.json`
- ✅ Created `backend/database/db.js` - Connection pool
- ✅ Created `backend/database/services.js` - Service helpers
- ✅ Updated `backend/routes/auth.js` - Uses PostgreSQL
- ✅ Created `backend/middleware/auth.js` - Auth middleware

### **Next Steps:**
- ⏳ Update `backend/routes/vehicles.js` - Use PostgreSQL
- ⏳ Update `backend/routes/documents.js` - Use PostgreSQL
- ⏳ Update other routes as needed

---

## 💡 **IMPORTANT NOTES**

1. **Data Persistence** - Database data is stored in Docker volume
2. **Default Password** - Change `lto_password` in production!
3. **Connection Pool** - Configured for 20 max connections
4. **Performance** - Optimized for 4GB RAM systems
5. **Backup** - Regularly backup your database

---

## 🆘 **NEED HELP?**

If you encounter issues:

1. Check Docker logs: `docker-compose -f docker-compose.laptop.yml logs postgres`
2. Check application logs for database errors
3. Verify `.env` configuration
4. Test connection manually using psql

---

**Last Updated**: 2025-01-XX  
**Status**: ✅ Ready for Integration

