#!/bin/bash
# TrustChain LTO - Remove Emission Columns Migration
# Runs the SQL migration to remove legacy emission columns

echo "=========================================="
echo "Remove Emission Columns Migration"
echo "=========================================="

# Database connection details
DB_CONTAINER="postgres"
DB_USER="lto_user"
DB_NAME="lto_blockchain"
MIGRATION_FILE="database/remove-emission-columns.sql"

# Check if Docker container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ Error: PostgreSQL container '$DB_CONTAINER' is not running"
    echo "   Start it with: docker-compose up -d postgres"
    exit 1
fi

echo ""
echo "Step 1: Creating backup..."
echo "----------------------------------------"

# Create backup
BACKUP_FILE="backup_before_emission_removal_$(date +%Y%m%d_%H%M%S).sql"
docker exec $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
else
    echo "⚠️  Warning: Backup failed, but continuing..."
fi

echo ""
echo "Step 2: Running migration..."
echo "----------------------------------------"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Run migration
docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Migration executed successfully"
else
    echo "❌ Error: Migration failed"
    echo "   Rollback with: docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < database/rollback-emission-columns.sql"
    exit 1
fi

echo ""
echo "Step 3: Verifying removal..."
echo "----------------------------------------"

# Verify transfer_requests columns are removed
echo "Checking transfer_requests table..."
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ All emission columns removed from transfer_requests'
        ELSE '⚠️  Remaining columns: ' || string_agg(column_name, ', ')
    END as status
FROM information_schema.columns
WHERE table_name = 'transfer_requests' 
AND column_name LIKE 'emission%';
"

# Verify vehicles column is removed
echo ""
echo "Checking vehicles table..."
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vehicles' 
            AND column_name = 'emission_compliance'
        ) THEN '⚠️  Column still exists: vehicles.emission_compliance'
        ELSE '✅ Column removed: vehicles.emission_compliance'
    END as status;
"

echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test the application to ensure everything works"
echo "2. Verify transfer workflow (should only check insurance + HPG)"
echo "3. Check application logs for any errors"
echo ""
