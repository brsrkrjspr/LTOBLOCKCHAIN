# 🔧 Database Migration Fix - Quick Guide

**Issue:** Application failing due to missing database tables and functions.

**Errors:**
1. ❌ `refresh_tokens` table does not exist
2. ❌ `cleanup_expired_blacklist()` function does not exist

---

## ✅ **QUICK FIX: Run Database Migrations**

### **Option 1: Run Migrations via Docker (Recommended)**

```bash
# Run refresh_tokens migration
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql

# Run token blacklist migration
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
```

### **Option 2: Use Migration Script**

```bash
# Run the migration script (if available)
node scripts/migrate.js

# Or use the backend migration runner
node backend/scripts/run-migration.js
```

### **Option 3: Restore from Dump (If Available)**

If you have a complete database dump:

```bash
# Restore entire database schema
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/dump.sql
```

---

## 🔍 **VERIFY MIGRATIONS**

After running migrations, verify:

```bash
# Check if tables exist
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "refresh_tokens|token_blacklist"

# Check if function exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

# Check refresh_tokens table structure
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\d refresh_tokens"
```

---

## 🚀 **COMPLETE FIX COMMAND**

Run this to fix everything:

```bash
# 1. Run refresh_tokens migration
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql

# 2. Run token blacklist migration  
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql

# 3. Verify migrations
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "refresh_tokens|token_blacklist|sessions"

# 4. Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# 5. Check logs
docker logs lto-app --tail 30
```

---

## 📋 **WHAT THESE MIGRATIONS CREATE**

### **add_refresh_tokens.sql:**
- ✅ `refresh_tokens` table
- ✅ `sessions` table
- ✅ `cleanup_expired_tokens()` function
- ✅ Indexes for performance

### **add_token_blacklist.sql:**
- ✅ `token_blacklist` table
- ✅ `cleanup_expired_blacklist()` function
- ✅ Indexes for performance

---

## ⚠️ **IF MIGRATIONS FAIL**

### **Check Database Connection:**
```bash
# Test connection
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "SELECT NOW();"
```

### **Check if Database Exists:**
```bash
# List databases
docker exec -it postgres psql -U lto_user -l
```

### **Check if User Has Permissions:**
```bash
# Check user permissions
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\du"
```

---

## 🎯 **EXPECTED RESULT**

After running migrations, you should see:

```
✅ refresh_tokens table created
✅ sessions table created
✅ token_blacklist table created
✅ cleanup_expired_blacklist() function created
✅ Application starts successfully
```

---

**Status:** ⚠️ **Database migrations needed** - Run the migrations above to fix the issue!
