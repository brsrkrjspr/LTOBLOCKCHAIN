# 📊 Database Dump Analysis & Restore Guide

**Your Dump File:** `database/dump.sql` (2871 lines)  
**Dump Date:** 2026-01-23 17:05:51  
**PostgreSQL Version:** 15.15

---

## ✅ **WHAT'S IN YOUR DUMP**

### **Tables Found:**
- ✅ `refresh_tokens` (Line 763)
- ✅ `sessions` (Line 812)  
- ✅ `token_blacklist` (Line 856)
- ✅ All other application tables

### **Functions:**
⚠️ **Note:** Line 19 shows `SET check_function_bodies = false;`  
This means **functions may not be fully included** in the dump.  
The `cleanup_expired_blacklist()` function might be missing.

---

## 🚀 **RECOMMENDED: Restore from Dump + Add Missing Function**

### **Step 1: Restore Entire Database from Dump**

```bash
# Restore complete schema and data
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/dump.sql
```

### **Step 2: Add Missing Function (If Needed)**

After restore, check if function exists, then add it if missing:

```bash
# Check if function exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

# If function doesn't exist, add it
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
```

---

## 🎯 **COMPLETE RESTORE COMMAND (All-in-One)**

```bash
# 1. Restore from dump
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/dump.sql

# 2. Verify tables exist
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "refresh_tokens|token_blacklist|sessions"

# 3. Check if function exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist" || echo "Function missing - will add it"

# 4. Add function if missing (safe to run even if exists)
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql

# 5. Verify function now exists
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

# 6. Restart application
docker compose -f docker-compose.unified.yml restart lto-app

# 7. Check logs
sleep 10
docker logs lto-app --tail 30
```

---

## 📋 **WHAT YOUR DUMP CONTAINS**

### **✅ Tables (All Present):**
- `users`
- `vehicles`
- `documents`
- `certificates`
- `refresh_tokens` ← **Required!**
- `sessions` ← **Required!**
- `token_blacklist` ← **Required!**
- All other application tables

### **✅ Indexes & Constraints:**
- All indexes
- All foreign keys
- All constraints

### **⚠️ Functions:**
- May not be fully included (due to `check_function_bodies = false`)
- Need to add `cleanup_expired_blacklist()` separately

---

## 🔍 **VERIFY AFTER RESTORE**

```bash
# Check tables
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt refresh_tokens"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt token_blacklist"
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt sessions"

# Check function
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\df cleanup_expired_blacklist"

# Check table structure
docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\d refresh_tokens"
```

---

## ⚠️ **IMPORTANT NOTES**

1. **Data Preservation:**
   - Restoring will **replace** current database
   - If you have important data, backup first:
     ```bash
     docker exec postgres pg_dump -U lto_user -d lto_blockchain > backup_$(date +%Y%m%d_%H%M%S).sql
     ```

2. **Function Missing:**
   - The dump may not include `cleanup_expired_blacklist()` function
   - This is normal - just add it after restore

3. **Clean Restore (Optional):**
   - If you want a completely fresh start:
     ```bash
     # Drop and recreate database
     docker exec -it postgres psql -U lto_user -d postgres -c "DROP DATABASE IF EXISTS lto_blockchain; CREATE DATABASE lto_blockchain;"
     
     # Then restore
     docker exec -i postgres psql -U lto_user -d lto_blockchain < database/dump.sql
     ```

---

## 🎯 **EXPECTED RESULT**

After restore:
- ✅ All tables created
- ✅ `refresh_tokens` table exists
- ✅ `token_blacklist` table exists
- ✅ `sessions` table exists
- ✅ `cleanup_expired_blacklist()` function added
- ✅ Application starts successfully

---

**Status:** ✅ **Your dump is complete** - Restore from it, then add the missing function!
