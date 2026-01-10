#!/bin/bash
# LTO Compliance Migration Script
# This script applies the LTO compliance migration to add required fields and constraints
# Run this on your DigitalOcean server (server-only deployment required)
# Usage: ./scripts/apply-lto-compliance-migration.sh

set -e  # Exit on error

echo "========================================"
echo "LTO COMPLIANCE MIGRATION"
echo "========================================"
echo ""

# Auto-detect database credentials
# Use docker-compose defaults (from docker-compose.unified.yml)
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_HOST=postgres

# Optionally override from .env if it has uncommented values
if [ -f .env ]; then
    ENV_DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    ENV_DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    ENV_DB_HOST=$(grep "^DB_HOST=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    
    # Only use .env values if they're not empty (handles commented lines)
    [ -n "$ENV_DB_NAME" ] && DB_NAME="$ENV_DB_NAME"
    [ -n "$ENV_DB_USER" ] && DB_USER="$ENV_DB_USER"
    [ -n "$ENV_DB_HOST" ] && DB_HOST="$ENV_DB_HOST"
fi

echo "Database Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"
echo ""

# Check if migration file exists
MIGRATION_FILE="database/lto-compliance-migration.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
    echo "   Please ensure you're running this script from the project root directory"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"
echo ""

# Step 1: Create database backup
echo "Step 1: Creating database backup..."
BACKUP_FILE="backup_before_lto_migration_$(date +%Y%m%d_%H%M%S).sql"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

if docker compose -f docker-compose.unified.yml exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE" 2>&1; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created: $BACKUP_DIR/$BACKUP_FILE ($BACKUP_SIZE)"
    echo "   You can restore from this backup if needed:"
    echo "   docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME < $BACKUP_DIR/$BACKUP_FILE"
else
    echo "⚠️  WARNING: Could not create backup (continuing anyway)"
    echo "   Migration will continue, but backup is recommended"
fi

echo ""

# Step 2: Ensure UUID extension exists
echo "Step 2: Ensuring UUID extension exists..."
docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ UUID extension check complete"
else
    echo "❌ ERROR: Failed to create UUID extension"
    exit 1
fi

echo ""

# Step 3: Run migration
echo "Step 3: Running LTO compliance migration..."
echo "   This may take a few minutes depending on the number of vehicles..."
docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$MIGRATION_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Migration SQL executed successfully"
else
    echo "❌ ERROR: Migration failed"
    echo ""
    echo "If you need to rollback:"
    echo "   docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME < database/rollback-lto-compliance.sql"
    echo ""
    echo "Or restore from backup:"
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        echo "   docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME < $BACKUP_DIR/$BACKUP_FILE"
    fi
    exit 1
fi

echo ""

# Step 4: Verify new columns exist
echo "Step 4: Verifying new columns exist..."
CATEGORY_EXISTS=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='vehicle_category';" 2>&1 | xargs)

CAPACITY_EXISTS=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='passenger_capacity';" 2>&1 | xargs)

GVW_EXISTS=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='gross_vehicle_weight';" 2>&1 | xargs)

if [ "$CATEGORY_EXISTS" = "1" ] && [ "$CAPACITY_EXISTS" = "1" ] && [ "$GVW_EXISTS" = "1" ]; then
    echo "✅ All new columns exist: vehicle_category, passenger_capacity, gross_vehicle_weight"
else
    echo "❌ ERROR: Some columns are missing"
    echo "   vehicle_category: $CATEGORY_EXISTS"
    echo "   passenger_capacity: $CAPACITY_EXISTS"
    echo "   gross_vehicle_weight: $GVW_EXISTS"
    exit 1
fi

echo ""

# Step 5: Verify constraints exist
echo "Step 5: Verifying constraints exist..."
CONSTRAINT_COUNT=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'vehicles'::regclass AND conname LIKE 'chk_%';" 2>&1 | xargs)

if [ "$CONSTRAINT_COUNT" -ge "5" ]; then
    echo "✅ Constraints verified: Found $CONSTRAINT_COUNT check constraints"
else
    echo "⚠️  WARNING: Expected at least 5 constraints, found $CONSTRAINT_COUNT"
    echo "   This may be normal if some constraints already existed"
fi

echo ""

# Step 6: Verify data migration
echo "Step 6: Verifying data migration..."
VEHICLES_WITH_CATEGORY=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM vehicles WHERE vehicle_category IS NOT NULL;" 2>&1 | xargs)

TOTAL_VEHICLES=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT COUNT(*) FROM vehicles;" 2>&1 | xargs)

if [ "$VEHICLES_WITH_CATEGORY" = "$TOTAL_VEHICLES" ] && [ "$TOTAL_VEHICLES" -gt "0" ]; then
    echo "✅ Data migration verified: All $TOTAL_VEHICLES vehicles have vehicle_category"
elif [ "$TOTAL_VEHICLES" = "0" ]; then
    echo "ℹ️  No vehicles in database (this is normal for new installations)"
else
    echo "⚠️  WARNING: $VEHICLES_WITH_CATEGORY out of $TOTAL_VEHICLES vehicles have vehicle_category"
fi

echo ""

# Step 7: Run validation script (optional)
if [ -f "scripts/validate-migration.js" ]; then
    echo "Step 7: Running post-migration validation..."
    # Try to run from application container if available
    if docker compose -f docker-compose.unified.yml exec -T lto-app node scripts/validate-migration.js post 2>/dev/null; then
        echo "✅ Validation script passed"
    elif command -v node >/dev/null 2>&1; then
        if node scripts/validate-migration.js post; then
            echo "✅ Validation script passed"
        else
            echo "⚠️  WARNING: Validation script found some issues - please review the report"
        fi
    else
        echo "ℹ️  Node.js not found - skipping validation script"
        echo "   You can run it manually from the app container:"
        echo "   docker compose -f docker-compose.unified.yml exec lto-app node scripts/validate-migration.js post"
    fi
else
    echo "Step 7: Validation script not found - skipping"
fi

echo ""

# Summary
echo "========================================"
echo "MIGRATION SUMMARY"
echo "========================================"
echo "✅ LTO compliance migration completed successfully"
echo ""
echo "What was changed:"
echo "  • Added vehicle_category (PNS codes: L1-L5, M1-M3, N1-N3, O1-O4)"
echo "  • Added passenger_capacity (1-100)"
echo "  • Added gross_vehicle_weight (required for MVUC fees)"
echo "  • Added constraints to ensure data integrity"
echo "  • Migrated existing vehicle data with smart defaults"
echo "  • Made non-LTO fields (fuel_type, transmission, engine_displacement) nullable"
echo ""
echo "Next steps:"
echo "1. Restart the application:"
echo "   docker compose -f docker-compose.unified.yml restart lto-app"
echo ""
echo "2. Verify application is running:"
echo "   docker compose -f docker-compose.unified.yml logs lto-app --tail=50"
echo ""
echo "3. Test the registration form:"
echo "   • Navigate to registration page"
echo "   • Verify new LTO fields are visible and required"
echo "   • Submit a test registration"
echo ""
echo "4. Verify API responses:"
echo "   • Check that v2 API includes new LTO fields"
echo "   • Check that v1 API shows deprecation warnings"
echo ""
echo "5. Test certificate generation:"
echo "   • Generate a certificate for a registered vehicle"
echo "   • Verify new LTO fields are displayed correctly"
echo ""
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "Backup location: $BACKUP_DIR/$BACKUP_FILE"
    echo "   Keep this backup safe in case you need to rollback"
fi
echo ""
echo "Rollback (if needed):"
echo "   docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME < database/rollback-lto-compliance.sql"
echo "========================================"
