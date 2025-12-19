# Deployment Update Guide - Transfer Refactoring Changes

## Quick Answer: **YES, you need to rebuild the container** ✅

---

## Why Rebuild is Needed

Looking at your `docker-compose.unified.yml`:

```yaml
lto-app:
  build:
    context: .
    dockerfile: Dockerfile.production
  # NO volume mounts for application code
  volumes:
    - ./network-config.json:/app/network-config.json:ro
    - ./wallet:/app/wallet
    # ... but NO volumes for backend/ or js/ directories
```

**The application code is baked into the Docker image at build time**, not mounted as volumes. This means:

- ✅ **Code changes require rebuild** - New/modified files need to be in the image
- ✅ **Database migration is separate** - Run SQL migration on database
- ✅ **No code volume mounts** - Code is inside container, not on host

---

## What Changed (Requires Rebuild)

### Backend Files (Inside Container)
1. ✅ `backend/config/documentTypes.js` - **NEW FILE**
2. ✅ `backend/routes/documents.js` - **MODIFIED**
3. ✅ `backend/routes/transfer.js` - **MODIFIED**

### Frontend Files (Inside Container)
4. ✅ `js/document-upload-utils.js` - **NEW FILE**
5. ✅ `transfer-ownership.html` - **MODIFIED**

### Database (Separate - No Rebuild Needed)
6. ⚠️ `database/add-new-document-types.sql` - **Run migration separately**

---

## Deployment Steps

### Step 1: Rebuild Application Container ⚠️ **REQUIRED**

```bash
# On DigitalOcean server
cd /opt/lto-blockchain  # or wherever your project is

# Rebuild the application container
docker compose -f docker-compose.unified.yml build lto-app

# Restart the container (this will use the new image)
docker compose -f docker-compose.unified.yml up -d lto-app
```

**Or rebuild and restart in one command:**
```bash
docker compose -f docker-compose.unified.yml up -d --build lto-app
```

### Step 2: Run Database Migration ⚠️ **REQUIRED**

```bash
# Run the migration script
docker exec postgres psql -U lto_user -d lto_blockchain -f /path/to/add-new-document-types.sql

# Or copy and run
docker cp database/add-new-document-types.sql postgres:/tmp/
docker exec postgres psql -U lto_user -d lto_blockchain -f /tmp/add-new-document-types.sql
```

### Step 3: Verify Changes

```bash
# Check application logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50

# Check if new files are in container
docker exec lto-app ls -la /app/backend/config/documentTypes.js
docker exec lto-app ls -la /app/js/document-upload-utils.js

# Verify database ENUM
docker exec postgres psql -U lto_user -d lto_blockchain -c \
  "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') ORDER BY enumsortorder;"
```

---

## Alternative: Add Code Volume Mounts (For Development)

If you want to avoid rebuilding for future changes, you can add volume mounts:

```yaml
lto-app:
  volumes:
    # Existing volumes...
    - ./network-config.json:/app/network-config.json:ro
    - ./wallet:/app/wallet
    # ADD THESE for live code updates (development only)
    - ./backend:/app/backend
    - ./js:/app/js
    - ./*.html:/app/
```

**⚠️ Warning:** This is for development. In production, rebuilding is safer and more reliable.

---

## Complete Deployment Checklist

### ✅ Pre-Deployment
- [ ] All code changes committed to git
- [ ] Backup current database (optional but recommended)
- [ ] SSH into DigitalOcean server

### ✅ Deployment Steps
- [ ] Pull latest code: `git pull` (if using git)
- [ ] Or upload changed files via SCP
- [ ] Rebuild container: `docker compose -f docker-compose.unified.yml build lto-app`
- [ ] Restart container: `docker compose -f docker-compose.unified.yml up -d lto-app`
- [ ] Run database migration: `docker exec postgres psql -U lto_user -d lto_blockchain -f /tmp/add-new-document-types.sql`

### ✅ Verification
- [ ] Check container is running: `docker ps | grep lto-app`
- [ ] Check application logs: `docker compose logs lto-app --tail=50`
- [ ] Verify new files exist in container
- [ ] Verify database ENUM has new values
- [ ] Test transfer functionality

---

## Quick Commands Summary

```bash
# 1. Rebuild and restart app container
docker compose -f docker-compose.unified.yml up -d --build lto-app

# 2. Run database migration
docker cp database/add-new-document-types.sql postgres:/tmp/
docker exec postgres psql -U lto_user -d lto_blockchain -f /tmp/add-new-document-types.sql

# 3. Verify
docker compose logs lto-app --tail=50
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type');"
```

---

## What Does NOT Need Rebuild

- ✅ **Database** - Separate container, just run migration
- ✅ **IPFS** - No changes needed
- ✅ **PostgreSQL** - No changes needed
- ✅ **Fabric network** - No changes needed
- ✅ **Nginx** - No changes needed

---

## Rollback Plan

If something goes wrong:

```bash
# Option 1: Revert to previous image (if you have it)
docker compose -f docker-compose.unified.yml pull lto-app
docker compose -f docker-compose.unified.yml up -d lto-app

# Option 2: Revert code and rebuild
git checkout HEAD~1  # or specific commit
docker compose -f docker-compose.unified.yml build lto-app
docker compose -f docker-compose.unified.yml up -d lto-app

# Option 3: Use git tag backup
git checkout backup-before-changes
docker compose -f docker-compose.unified.yml build lto-app
docker compose -f docker-compose.unified.yml up -d lto-app
```

---

## Summary

**YES, you need to rebuild the `lto-app` container** because:
1. Code is baked into the image (not mounted as volumes)
2. New files were created (`documentTypes.js`, `document-upload-utils.js`)
3. Existing files were modified (`documents.js`, `transfer.js`, `transfer-ownership.html`)

**Database migration is separate** - run the SQL script on the PostgreSQL container.

---

**Last Updated:** 2024-01-XX  
**Status:** Ready for deployment
