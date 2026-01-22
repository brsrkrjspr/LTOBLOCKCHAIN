# TrustChain LTO - Remove Emission Columns Migration (PowerShell)
# Runs the SQL migration to remove legacy emission columns

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Remove Emission Columns Migration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Database connection details
$DB_CONTAINER = "postgres"
$DB_USER = "lto_user"
$DB_NAME = "lto_blockchain"
$MIGRATION_FILE = "database/remove-emission-columns.sql"

# Check if Docker container is running
$containerRunning = docker ps | Select-String "$DB_CONTAINER"
if (-not $containerRunning) {
    Write-Host "❌ Error: PostgreSQL container '$DB_CONTAINER' is not running" -ForegroundColor Red
    Write-Host "   Start it with: docker-compose up -d postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 1: Creating backup..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "backup_before_emission_removal_$timestamp.sql"
docker exec $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME | Out-File -FilePath $BACKUP_FILE -Encoding utf8

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backup created: $BACKUP_FILE" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: Backup failed, but continuing..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Running migration..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Check if migration file exists
if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Error: Migration file not found: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
}

# Run migration
Get-Content $MIGRATION_FILE | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration executed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Error: Migration failed" -ForegroundColor Red
    Write-Host "   Rollback with: Get-Content database/rollback-emission-columns.sql | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying removal..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Verify transfer_requests columns are removed
Write-Host "Checking transfer_requests table..." -ForegroundColor Cyan
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c @"
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ All emission columns removed from transfer_requests'
        ELSE '⚠️  Remaining columns: ' || string_agg(column_name, ', ')
    END as status
FROM information_schema.columns
WHERE table_name = 'transfer_requests' 
AND column_name LIKE 'emission%';
"@

# Verify vehicles column is removed
Write-Host ""
Write-Host "Checking vehicles table..." -ForegroundColor Cyan
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c @"
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vehicles' 
            AND column_name = 'emission_compliance'
        ) THEN '⚠️  Column still exists: vehicles.emission_compliance'
        ELSE '✅ Column removed: vehicles.emission_compliance'
    END as status;
"@

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the application to ensure everything works"
Write-Host "2. Verify transfer workflow (should only check insurance + HPG)"
Write-Host "3. Check application logs for any errors"
Write-Host ""
