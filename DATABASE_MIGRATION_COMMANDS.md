# Database Migration Commands for TrustChain LTO Backend Fixes

## Overview
This document provides SSH commands to run database migrations for the backend architecture fixes.

## Prerequisites
- SSH access to the server
- PostgreSQL database access
- Database name: `ltoblockchain` (or your configured database name)

## Migration Files

### 1. Add Scrapped Status (Issue 1)
**File:** `backend/migrations/add-scrapped-status.sql`

**SSH Commands:**
```bash
# Navigate to project directory
cd /path/to/LTO

# Run migration
psql -U your_db_user -d ltoblockchain -f backend/migrations/add-scrapped-status.sql

# Verify enum values were added
psql -U your_db_user -d ltoblockchain -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'vehicle_status'::regtype ORDER BY enumsortorder;"
```

### 2. Add Verification Mode (Issue 4)
**File:** `backend/migrations/add-verification-mode.sql`

**SSH Commands:**
```bash
# Navigate to project directory
cd /path/to/LTO

# Run migration
psql -U your_db_user -d ltoblockchain -f backend/migrations/add-verification-mode.sql

# Verify columns were added
psql -U your_db_user -d ltoblockchain -c "\d clearance_requests"
psql -U your_db_user -d ltoblockchain -c "\d users"
```

## Combined Migration (Run Both)
```bash
# Navigate to project directory
cd /path/to/LTO

# Run both migrations
psql -U your_db_user -d ltoblockchain -f backend/migrations/add-scrapped-status.sql
psql -U your_db_user -d ltoblockchain -f backend/migrations/add-verification-mode.sql

# Verify all changes
psql -U your_db_user -d ltoblockchain -c "
SELECT 
    'vehicle_status enum' as check_type,
    string_agg(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_enum 
WHERE enumtypid = 'vehicle_status'::regtype
UNION ALL
SELECT 
    'clearance_requests columns' as check_type,
    string_agg(column_name, ', ') as values
FROM information_schema.columns
WHERE table_name = 'clearance_requests' AND column_name IN ('verification_mode')
UNION ALL
SELECT 
    'users columns' as check_type,
    string_agg(column_name, ', ') as values
FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('is_trusted_partner', 'trusted_partner_type');
"
```

## Notes
- Replace `your_db_user` with your actual PostgreSQL username
- Replace `/path/to/LTO` with your actual project path
- Replace `ltoblockchain` with your actual database name if different
- Ensure you have proper permissions to run migrations
- Back up your database before running migrations in production

## Rollback (if needed)

### Rollback Scrapped Status
```sql
-- Remove columns
ALTER TABLE vehicles DROP COLUMN IF EXISTS scrapped_at;
ALTER TABLE vehicles DROP COLUMN IF EXISTS scrapped_by;
ALTER TABLE vehicles DROP COLUMN IF EXISTS scrap_reason;

-- Note: Cannot remove enum values in PostgreSQL, but can prevent their use
```

### Rollback Verification Mode
```sql
-- Remove columns
ALTER TABLE clearance_requests DROP COLUMN IF EXISTS verification_mode;
ALTER TABLE users DROP COLUMN IF EXISTS is_trusted_partner;
ALTER TABLE users DROP COLUMN IF EXISTS trusted_partner_type;

-- Remove index
DROP INDEX IF EXISTS idx_users_trusted_partner;
```

