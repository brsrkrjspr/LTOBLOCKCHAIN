# LTO Compliance Migration - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the LTO compliance migration on DigitalOcean. The migration adds required LTO fields (vehicle_category, passenger_capacity, gross_vehicle_weight) and removes non-LTO field defaults.

## Prerequisites

- SSH access to DigitalOcean droplet
- Docker and Docker Compose installed and running
- PostgreSQL container running (`postgres`)
- Project files uploaded to server
- Backup storage available

**Note:** This migration must be run on the DigitalOcean server. Local testing is not possible due to server-specific requirements (Ubuntu, Docker environment, etc.).

## Pre-Deployment Checklist

**IMPORTANT:** This migration must be performed directly on the DigitalOcean server. Local testing is not possible due to server-specific requirements.

### 1. Verify Environment

```bash
# SSH into your DigitalOcean droplet
ssh root@your-droplet-ip
# or
ssh root@ltoblockchain.duckdns.org

# Navigate to project directory
cd /root/LTOBLOCKCHAIN
# or
cd /opt/lto-blockchain

# Verify Docker is running
docker ps | grep postgres

# Verify docker-compose.unified.yml exists
ls -la docker-compose.unified.yml

# Verify migration script exists and is executable
ls -la scripts/apply-lto-compliance-migration.sh
chmod +x scripts/apply-lto-compliance-migration.sh
```

### 2. Verify Current Database State

```bash
# Check current vehicle count
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles;"

# Check if new columns already exist (should return 0)
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight');"
```

### 3. Ensure Latest Code is Deployed

```bash
# If using Git
git pull origin main
# or
git pull origin master

# If using SCP/SFTP, ensure these files are uploaded:
# - database/lto-compliance-migration.sql
# - database/rollback-lto-compliance.sql
# - database/validate-migration.sql
# - scripts/apply-lto-compliance-migration.sh
# - scripts/validate-migration.js
# - All updated application files (frontend, backend, chaincode)
```

## Deployment Steps

### Step 1: Make Migration Script Executable

```bash
chmod +x scripts/apply-lto-compliance-migration.sh
```

### Step 2: Run Pre-Migration Validation (Optional)

```bash
# Run pre-migration validation (if Node.js is available in the container)
# Option 1: Run from within the application container
docker compose -f docker-compose.unified.yml exec lto-app node scripts/validate-migration.js pre

# Option 2: Run SQL validation directly
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    'Total vehicles' as check_type,
    COUNT(*) as count
FROM vehicles
UNION ALL
SELECT 
    'Vehicles needing migration' as check_type,
    COUNT(*) as count
FROM vehicles
WHERE vehicle_category IS NULL;"

# This will show:
# - Total vehicles
# - Vehicles needing migration
```

### Step 3: Run the Migration

```bash
# Run the migration script
./scripts/apply-lto-compliance-migration.sh
```

**What the script does:**
1. Auto-detects database credentials from `.env` or uses defaults
2. Creates a timestamped backup in `backups/` directory
3. Ensures UUID extension exists
4. Runs the migration SQL
5. Verifies new columns exist
6. Verifies constraints are applied
7. Verifies data migration
8. Runs post-migration validation (if Node.js available)

**Expected Output:**
```
========================================
LTO COMPLIANCE MIGRATION
========================================

Database Configuration:
  Database: lto_blockchain
  User: lto_user
  Host: postgres

✅ Migration file found: database/lto-compliance-migration.sql

Step 1: Creating database backup...
✅ Backup created: backups/backup_before_lto_migration_20250115_143022.sql (2.5 MB)

Step 2: Ensuring UUID extension exists...
✅ UUID extension check complete

Step 3: Running LTO compliance migration...
   This may take a few minutes depending on the number of vehicles...
✅ Migration SQL executed successfully

Step 4: Verifying new columns exist...
✅ All new columns exist: vehicle_category, passenger_capacity, gross_vehicle_weight

Step 5: Verifying constraints exist...
✅ Constraints verified: Found 5 check constraints

Step 6: Verifying data migration...
✅ Data migration verified: All 15 vehicles have vehicle_category

Step 7: Running post-migration validation...
✅ Validation script passed

========================================
MIGRATION SUMMARY
========================================
✅ LTO compliance migration completed successfully
...
```

### Step 4: Restart Application

```bash
# Restart the application container
docker compose -f docker-compose.unified.yml restart lto-app

# Verify application is running
docker compose -f docker-compose.unified.yml ps lto-app

# Check application logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50
```

### Step 5: Verify Application Functionality

```bash
# Check for errors in logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=100 | grep -i error

# Test API health endpoint
curl http://localhost:3001/api/health
# or if using domain
curl https://your-domain.com/api/health
```

## Post-Deployment Verification

### 1. Verify Database Schema

```bash
# Check new columns exist
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='vehicles' 
AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight', 'net_weight')
ORDER BY column_name;"

# Check constraints exist
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'vehicles'::regclass 
AND conname LIKE 'chk_%'
ORDER BY conname;"
```

### 2. Test Registration Form

1. Navigate to registration page in browser
2. Verify new fields are visible:
   - Vehicle Category (PNS) dropdown
   - Passenger Capacity input
   - Gross Vehicle Weight input
   - Net Weight input
   - Classification dropdown
3. Fill out form and submit
4. Verify registration succeeds

### 3. Verify API Responses

```bash
# Test v2 API (should include new fields)
curl -H "X-API-Version: v2" http://localhost:3001/api/vehicles | jq '.[0] | {vehicleCategory, passengerCapacity, grossVehicleWeight}'

# Test v1 API (should show deprecation headers)
curl -I -H "X-API-Version: v1" http://localhost:3001/api/vehicles
# Should see: X-API-Deprecated: true
```

### 4. Test Certificate Generation

1. Navigate to a registered vehicle
2. Generate certificate
3. Verify new LTO fields are displayed:
   - Vehicle Category (PNS)
   - Passenger Capacity
   - Gross Vehicle Weight
   - Net Weight
   - Classification

## Rollback Procedure

If you need to rollback the migration:

### Option 1: Use Rollback Script

```bash
# Run rollback script
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain < database/rollback-lto-compliance.sql

# Verify rollback
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='vehicles' 
AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight');"
# Should return 0 rows
```

### Option 2: Restore from Backup

```bash
# Find your backup file
ls -lh backups/backup_before_lto_migration_*.sql

# Restore from backup
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain < backups/backup_before_lto_migration_TIMESTAMP.sql

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app
```

## Troubleshooting

### Issue: Migration Script Fails with "Container not found"

**Solution:**
```bash
# Check if postgres container is running
docker ps | grep postgres

# If not running, start it
docker compose -f docker-compose.unified.yml up -d postgres

# Wait for container to be ready
sleep 5

# Retry migration
./scripts/apply-lto-compliance-migration.sh
```

### Issue: Migration Fails with "Permission Denied"

**Solution:**
```bash
# Make script executable
chmod +x scripts/apply-lto-compliance-migration.sh

# Verify file permissions
ls -la scripts/apply-lto-compliance-migration.sh
```

### Issue: Migration Fails with "Relation already exists"

**Solution:**
This means the migration was partially run. Check what was created:

```bash
# Check which columns exist
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='vehicles' 
AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight');"

# If columns exist but migration failed, you may need to:
# 1. Rollback first
# 2. Then re-run migration
```

### Issue: Validation Script Fails to Connect

**Solution:**
The validation script needs to connect to the database. Since you're running on the server:

```bash
# Option 1: Run validation from application container (recommended)
docker compose -f docker-compose.unified.yml exec lto-app node scripts/validate-migration.js post

# Option 2: Run SQL validation directly
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -f database/validate-migration.sql

# Option 3: Set environment variables and run (if Node.js available on host)
export DB_HOST=postgres
export DB_PORT=5432
export DB_NAME=lto_blockchain
export DB_USER=lto_user
export DB_PASSWORD=$(grep POSTGRES_PASSWORD docker-compose.unified.yml | cut -d= -f2 | tr -d '"' | tr -d "'")
node scripts/validate-migration.js post
```

### Issue: Application Fails After Migration

**Solution:**
1. Check application logs for specific errors
2. Verify all new fields are being handled in code
3. Check if API versioning is working correctly
4. Verify database connection is working

```bash
# Check logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=100

# Test database connection from application
docker compose -f docker-compose.unified.yml exec lto-app node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'postgres',
  database: 'lto_blockchain',
  user: 'lto_user',
  password: process.env.POSTGRES_PASSWORD || 'lto_password'
});
pool.query('SELECT NOW()').then(r => { console.log('DB OK:', r.rows[0]); process.exit(0); }).catch(e => { console.error('DB Error:', e.message); process.exit(1); });
"
```

## Manual Verification Commands

### Check Migration Status

```bash
# Check if migration was successful
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain << 'EOF'
SELECT 
    'Columns' as check_type,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_name='vehicles' 
AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight', 'net_weight')
UNION ALL
SELECT 
    'Constraints' as check_type,
    COUNT(*) as count
FROM pg_constraint 
WHERE conrelid = 'vehicles'::regclass 
AND conname LIKE 'chk_%'
UNION ALL
SELECT 
    'Vehicles with data' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE vehicle_category IS NOT NULL 
AND passenger_capacity IS NOT NULL 
AND gross_vehicle_weight IS NOT NULL;
EOF
```

### Check Data Integrity

```bash
# Check for constraint violations
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    'Invalid categories' as issue,
    COUNT(*) as count
FROM vehicles 
WHERE vehicle_category IS NOT NULL 
AND vehicle_category NOT IN ('L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4')
UNION ALL
SELECT 
    'Invalid capacity' as issue,
    COUNT(*) as count
FROM vehicles 
WHERE passenger_capacity < 1 OR passenger_capacity > 100
UNION ALL
SELECT 
    'Invalid weights' as issue,
    COUNT(*) as count
FROM vehicles 
WHERE net_weight >= gross_vehicle_weight;"
```

## Integration with Existing Deployment

### If Using Git Deployment

```bash
# On DigitalOcean server
cd /root/LTOBLOCKCHAIN
git pull origin main

# Run migration
./scripts/apply-lto-compliance-migration.sh

# Restart services
docker compose -f docker-compose.unified.yml restart lto-app
```

### If Using Manual File Upload

1. Upload migration files via SCP/SFTP:
   - `database/lto-compliance-migration.sql`
   - `database/rollback-lto-compliance.sql`
   - `database/validate-migration.sql`
   - `scripts/apply-lto-compliance-migration.sh`
   - `scripts/validate-migration.js`

2. Upload updated application files

3. Run migration script

4. Restart application

## Backup and Recovery

### Automatic Backup

The migration script automatically creates a backup before running. Backups are stored in:
- Location: `backups/backup_before_lto_migration_TIMESTAMP.sql`
- Format: SQL dump file
- Size: Depends on database size (typically 1-10 MB)

### Manual Backup

```bash
# Create manual backup
docker compose -f docker-compose.unified.yml exec -T postgres pg_dump -U lto_user -d lto_blockchain > manual_backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup (optional)
gzip manual_backup_*.sql
```

### Backup Retention

Consider setting up automatic backup cleanup:

```bash
# Keep only last 7 days of backups
find backups/ -name "backup_before_lto_migration_*.sql" -mtime +7 -delete
```

## Success Criteria

After deployment, verify:

- [ ] Migration script ran successfully
- [ ] All new columns exist in database
- [ ] All constraints are applied
- [ ] Existing vehicle data was migrated
- [ ] Application restarts without errors
- [ ] Registration form shows new LTO fields
- [ ] New registrations work correctly
- [ ] API v2 returns new fields
- [ ] API v1 shows deprecation warnings
- [ ] Certificates display new LTO fields
- [ ] No data loss occurred

## Support and Rollback

If you encounter issues:

1. **Check logs**: `docker compose -f docker-compose.unified.yml logs lto-app`
2. **Verify database**: Use verification commands above
3. **Rollback if needed**: Use rollback procedure
4. **Restore from backup**: If rollback doesn't work

## Next Steps After Migration

1. **Monitor Application**: Watch logs for 24-48 hours
2. **Test Registration**: Submit test vehicle registrations
3. **Verify Certificates**: Generate and verify certificates
4. **Update Documentation**: Document any environment-specific notes
5. **Notify Users**: Inform users about new required fields

## Additional Resources

- Migration SQL: `database/lto-compliance-migration.sql`
- Rollback SQL: `database/rollback-lto-compliance.sql`
- Validation SQL: `database/validate-migration.sql`
- Validation Script: `scripts/validate-migration.js`
- Main Migration Script: `scripts/apply-lto-compliance-migration.sh`
