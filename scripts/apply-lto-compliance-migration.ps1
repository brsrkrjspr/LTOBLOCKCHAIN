# TrustChain LTO - LTO Compliance Migration Script (PowerShell)
# This script applies the LTO compliance migration to add required fields and constraints
# Run this on your Windows development environment
# Usage: .\scripts\apply-lto-compliance-migration.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LTO COMPLIANCE MIGRATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Auto-detect database credentials
# Use docker-compose defaults (from docker-compose.unified.yml)
$DB_NAME = "lto_blockchain"
$DB_USER = "lto_user"
$DB_HOST = "postgres"

# Optionally override from .env if exists
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^DB_NAME=(.+)$") {
            $value = $matches[1].Trim('"', "'").Trim()
            if ($value) { $DB_NAME = $value }
        }
        if ($line -match "^DB_USER=(.+)$") {
            $value = $matches[1].Trim('"', "'").Trim()
            if ($value) { $DB_USER = $value }
        }
        if ($line -match "^DB_HOST=(.+)$") {
            $value = $matches[1].Trim('"', "'").Trim()
            if ($value) { $DB_HOST = $value }
        }
    }
}

Write-Host "Database Configuration:" -ForegroundColor Yellow
Write-Host "  Database: $DB_NAME"
Write-Host "  User: $DB_USER"
Write-Host "  Host: $DB_HOST"
Write-Host ""

# Check if migration file exists
$MIGRATION_FILE = "database\lto-compliance-migration.sql"
if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ ERROR: Migration file not found: $MIGRATION_FILE" -ForegroundColor Red
    Write-Host "   Please ensure you're running this script from the project root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Migration file found: $MIGRATION_FILE" -ForegroundColor Green
Write-Host ""

# Check if postgres container is running
$postgresRunning = docker ps --filter "name=postgres" --format "{{.Names}}"

if (-not $postgresRunning) {
    Write-Host "❌ PostgreSQL container is not running!" -ForegroundColor Red
    Write-Host "   Please start the database container first." -ForegroundColor Yellow
    Write-Host "   docker compose -f docker-compose.unified.yml up -d postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL container found: $postgresRunning" -ForegroundColor Green
Write-Host ""

# Step 1: Create database backup
Write-Host "Step 1: Creating database backup..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "backup_before_lto_migration_$timestamp.sql"
$BACKUP_DIR = "backups"

if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

try {
    docker compose -f docker-compose.unified.yml exec -T postgres pg_dump -U $DB_USER -d $DB_NAME | Out-File -FilePath "$BACKUP_DIR\$BACKUP_FILE" -Encoding utf8
    $backupSize = (Get-Item "$BACKUP_DIR\$BACKUP_FILE").Length / 1MB
    Write-Host "✅ Backup created: $BACKUP_DIR\$BACKUP_FILE ($([math]::Round($backupSize, 2)) MB)" -ForegroundColor Green
    Write-Host "   You can restore from this backup if needed:" -ForegroundColor Yellow
    Write-Host "   Get-Content $BACKUP_DIR\$BACKUP_FILE | docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  WARNING: Could not create backup (continuing anyway)" -ForegroundColor Yellow
    Write-Host "   Migration will continue, but backup is recommended" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Ensure UUID extension exists
Write-Host "Step 2: Ensuring UUID extension exists..." -ForegroundColor Cyan
docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS `"uuid-ossp`";" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ UUID extension check complete" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Failed to create UUID extension" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Run migration
Write-Host "Step 3: Running LTO compliance migration..." -ForegroundColor Cyan
Write-Host "   This may take a few minutes depending on the number of vehicles..." -ForegroundColor Gray

Get-Content $MIGRATION_FILE | docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration SQL executed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Migration failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "If you need to rollback:" -ForegroundColor Yellow
    Write-Host "   Get-Content database\rollback-lto-compliance.sql | docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME" -ForegroundColor Gray
    Write-Host ""
    if (Test-Path "$BACKUP_DIR\$BACKUP_FILE") {
        Write-Host "Or restore from backup:" -ForegroundColor Yellow
        Write-Host "   Get-Content $BACKUP_DIR\$BACKUP_FILE | docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME" -ForegroundColor Gray
    }
    exit 1
}

Write-Host ""

# Step 4: Verify new columns exist
Write-Host "Step 4: Verifying new columns exist..." -ForegroundColor Cyan
$categoryExists = docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='vehicle_category';" 2>&1
$capacityExists = docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='passenger_capacity';" 2>&1
$gvwExists = docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='gross_vehicle_weight';" 2>&1

$categoryExists = $categoryExists.Trim()
$capacityExists = $capacityExists.Trim()
$gvwExists = $gvwExists.Trim()

if ($categoryExists -eq "1" -and $capacityExists -eq "1" -and $gvwExists -eq "1") {
    Write-Host "✅ All new columns exist: vehicle_category, passenger_capacity, gross_vehicle_weight" -ForegroundColor Green
} else {
    Write-Host "❌ ERROR: Some columns are missing" -ForegroundColor Red
    Write-Host "   vehicle_category: $categoryExists"
    Write-Host "   passenger_capacity: $capacityExists"
    Write-Host "   gross_vehicle_weight: $gvwExists"
    exit 1
}

Write-Host ""

# Step 5: Verify constraints exist
Write-Host "Step 5: Verifying constraints exist..." -ForegroundColor Cyan
$constraintCount = docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'vehicles'::regclass AND conname LIKE 'chk_%';" 2>&1
$constraintCount = $constraintCount.Trim()

if ([int]$constraintCount -ge 5) {
    Write-Host "✅ Constraints verified: Found $constraintCount check constraints" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING: Expected at least 5 constraints, found $constraintCount" -ForegroundColor Yellow
    Write-Host "   This may be normal if some constraints already existed" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Verify data migration
Write-Host "Step 6: Verifying data migration..." -ForegroundColor Cyan
$vehiclesWithCategory = docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM vehicles WHERE vehicle_category IS NOT NULL;" 2>&1
$totalVehicles = docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM vehicles;" 2>&1

$vehiclesWithCategory = $vehiclesWithCategory.Trim()
$totalVehicles = $totalVehicles.Trim()

if ($vehiclesWithCategory -eq $totalVehicles -and [int]$totalVehicles -gt 0) {
    Write-Host "✅ Data migration verified: All $totalVehicles vehicles have vehicle_category" -ForegroundColor Green
} elseif ([int]$totalVehicles -eq 0) {
    Write-Host "ℹ️  No vehicles in database (this is normal for new installations)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  WARNING: $vehiclesWithCategory out of $totalVehicles vehicles have vehicle_category" -ForegroundColor Yellow
}

Write-Host ""

# Step 7: Run validation script (optional)
if (Test-Path "scripts\validate-migration.js") {
    Write-Host "Step 7: Running post-migration validation..." -ForegroundColor Cyan
    if (Get-Command node -ErrorAction SilentlyContinue) {
        node scripts\validate-migration.js post
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Validation script passed" -ForegroundColor Green
        } else {
            Write-Host "⚠️  WARNING: Validation script found some issues - please review the report" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  Node.js not found - skipping validation script" -ForegroundColor Yellow
        Write-Host "   You can run it manually: node scripts\validate-migration.js post" -ForegroundColor Gray
    }
} else {
    Write-Host "Step 7: Validation script not found - skipping" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ LTO compliance migration completed successfully" -ForegroundColor Green
Write-Host ""
Write-Host "What was changed:" -ForegroundColor Yellow
Write-Host "  • Added vehicle_category (PNS codes: L1-L5, M1-M3, N1-N3, O1-O4)"
Write-Host "  • Added passenger_capacity (1-100)"
Write-Host "  • Added gross_vehicle_weight (required for MVUC fees)"
Write-Host "  • Added constraints to ensure data integrity"
Write-Host "  • Migrated existing vehicle data with smart defaults"
Write-Host "  • Made non-LTO fields (fuel_type, transmission, engine_displacement) nullable"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart the application:"
Write-Host "   docker compose -f docker-compose.unified.yml restart lto-app"
Write-Host ""
Write-Host "2. Verify application is running:"
Write-Host "   docker compose -f docker-compose.unified.yml logs lto-app --tail=50"
Write-Host ""
Write-Host "3. Test the registration form:"
Write-Host "   • Navigate to registration page"
Write-Host "   • Verify new LTO fields are visible and required"
Write-Host "   • Submit a test registration"
Write-Host ""
Write-Host "4. Verify API responses:"
Write-Host "   • Check that v2 API includes new LTO fields"
Write-Host "   • Check that v1 API shows deprecation warnings"
Write-Host ""
Write-Host "5. Test certificate generation:"
Write-Host "   • Generate a certificate for a registered vehicle"
Write-Host "   • Verify new LTO fields are displayed correctly"
Write-Host ""
if (Test-Path "$BACKUP_DIR\$BACKUP_FILE") {
    Write-Host "Backup location: $BACKUP_DIR\$BACKUP_FILE" -ForegroundColor Cyan
    Write-Host "   Keep this backup safe in case you need to rollback" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Rollback (if needed):" -ForegroundColor Yellow
Write-Host "   Get-Content database\rollback-lto-compliance.sql | docker compose -f docker-compose.unified.yml exec -T postgres psql -U $DB_USER -d $DB_NAME" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
