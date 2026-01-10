# LTO Compliance Migration - Deployment Notes

## Server-Only Deployment

**Important:** This migration must be performed directly on the DigitalOcean server. Local testing is not possible due to:

- Server-specific requirements (Ubuntu, Docker environment)
- Application dependencies on server configuration
- Database connection requirements

## Quick Deployment Steps

### 1. SSH to Server
```bash
ssh root@your-droplet-ip
cd /root/LTOBLOCKCHAIN  # or your project directory
```

### 2. Ensure Latest Code
```bash
# If using Git
git pull origin main

# Or upload files via SCP/SFTP:
# - scripts/apply-lto-compliance-migration.sh
# - database/lto-compliance-migration.sql
# - database/rollback-lto-compliance.sql
```

### 3. Make Script Executable
```bash
chmod +x scripts/apply-lto-compliance-migration.sh
```

### 4. Run Migration
```bash
./scripts/apply-lto-compliance-migration.sh
```

### 5. Restart Application
```bash
docker compose -f docker-compose.unified.yml restart lto-app
```

### 6. Verify
```bash
# Check logs
docker compose -f docker-compose.unified.yml logs lto-app --tail=50

# Verify new columns
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='vehicles' 
AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight');"
```

## Safety Measures

1. **Automatic Backup**: The script creates a backup before migration
2. **Transaction Safety**: Migration runs in a transaction (rolls back on error)
3. **Verification Steps**: Script verifies each step before proceeding
4. **Rollback Available**: Rollback script provided if needed

## Rollback (If Needed)

```bash
# Option 1: Use rollback script
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain < database/rollback-lto-compliance.sql

# Option 2: Restore from backup
docker compose -f docker-compose.unified.yml exec -T postgres psql -U lto_user -d lto_blockchain < backups/backup_before_lto_migration_TIMESTAMP.sql

# Restart application
docker compose -f docker-compose.unified.yml restart lto-app
```

## Support

If you encounter issues:
1. Check the backup was created: `ls -lh backups/`
2. Review migration logs in the script output
3. Check application logs: `docker compose -f docker-compose.unified.yml logs lto-app`
4. Verify database state using verification commands in deployment guide
