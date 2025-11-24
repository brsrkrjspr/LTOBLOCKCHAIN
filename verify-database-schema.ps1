# TrustChain LTO - Database Schema Verification Script
# Ensures all required tables and columns exist and are properly configured

Write-Host "Verifying Database Schema..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$allGood = $true

# Check PostgreSQL connection
Write-Host "`nChecking PostgreSQL Connection..." -ForegroundColor Yellow
$pgStatus = docker exec postgres pg_isready -U lto_user -d lto_blockchain 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "PostgreSQL: Not accessible" -ForegroundColor Red
    Write-Host "   Start PostgreSQL first: docker-compose -f docker-compose.core.yml up -d postgres" -ForegroundColor Yellow
    exit 1
}
Write-Host "PostgreSQL: Connected" -ForegroundColor Green

# Required tables
$requiredTables = @(
    "users",
    "vehicles",
    "documents",
    "notifications",
    "vehicle_history"
)

Write-Host "`nChecking Required Tables..." -ForegroundColor Yellow
foreach ($table in $requiredTables) {
    $exists = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='$table';" 2>&1
    $exists = $exists.ToString().Trim()
    if ($exists -eq "1") {
        Write-Host "Table '$table': Exists" -ForegroundColor Green
    } else {
        Write-Host "Table '$table': Missing" -ForegroundColor Red
        $allGood = $false
    }
}

# Check documents table columns
Write-Host "`nChecking Documents Table Schema..." -ForegroundColor Yellow
$requiredColumns = @(
    @{Name="id"; Type="uuid"},
    @{Name="vehicle_id"; Type="uuid"},
    @{Name="document_type"; Type="document_type"},
    @{Name="filename"; Type="character varying"},
    @{Name="original_name"; Type="character varying"},
    @{Name="file_path"; Type="character varying"},
    @{Name="file_size"; Type="bigint"},
    @{Name="mime_type"; Type="character varying"},
    @{Name="file_hash"; Type="character varying"},
    @{Name="uploaded_by"; Type="uuid"},
    @{Name="uploaded_at"; Type="timestamp"},
    @{Name="verified"; Type="boolean"},
    @{Name="verified_at"; Type="timestamp"},
    @{Name="verified_by"; Type="uuid"},
    @{Name="ipfs_cid"; Type="character varying"}
)

foreach ($col in $requiredColumns) {
    $exists = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='$($col.Name)';" 2>&1
    $exists = $exists.ToString().Trim()
    if ($exists -eq "1") {
        Write-Host "Column '$($col.Name)': Exists" -ForegroundColor Green
    } else {
        Write-Host "Column '$($col.Name)': Missing" -ForegroundColor Red
        if ($col.Name -eq "ipfs_cid") {
            Write-Host "   Fix: docker exec postgres psql -U lto_user -d lto_blockchain -c 'ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);'" -ForegroundColor Yellow
        }
        $allGood = $false
    }
}

# Check vehicles table columns
Write-Host "`nChecking Vehicles Table Schema..." -ForegroundColor Yellow
$vehicleColumns = @(
    "id", "vin", "plate_number", "make", "model", "year", "color",
    "engine_number", "chassis_number", "vehicle_type", "fuel_type",
    "transmission", "engine_displacement", "owner_id", "status",
    "verification_status", "documents", "notes", "registration_date",
    "last_updated", "priority", "history", "blockchain_tx_id",
    "created_at", "updated_at"
)

foreach ($col in $vehicleColumns) {
    $exists = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='$col';" 2>&1
    $exists = $exists.ToString().Trim()
    if ($exists -eq "1") {
        Write-Host "Column '$col': Exists" -ForegroundColor Green
    } else {
        Write-Host "Column '$col': Missing (may be optional)" -ForegroundColor Yellow
    }
}

# Check indexes
Write-Host "`nChecking Indexes..." -ForegroundColor Yellow
$requiredIndexes = @(
    "idx_documents_vehicle",
    "idx_documents_type",
    "idx_documents_hash",
    "idx_documents_ipfs_cid"
)

foreach ($idx in $requiredIndexes) {
    $exists = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname='$idx';" 2>&1
    $exists = $exists.ToString().Trim()
    if ($exists -eq "1") {
        Write-Host "Index '$idx': Exists" -ForegroundColor Green
    } else {
        Write-Host "Index '$idx': Missing" -ForegroundColor Yellow
        if ($idx -eq "idx_documents_ipfs_cid") {
            Write-Host "   Fix: docker exec postgres psql -U lto_user -d lto_blockchain -c 'CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);'" -ForegroundColor Yellow
        }
    }
}

# Check foreign keys
Write-Host "`nChecking Foreign Keys..." -ForegroundColor Yellow
$fks = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT conname FROM pg_constraint WHERE contype='f' AND conrelid='documents'::regclass;" 2>&1
$fksString = $fks.ToString()
if ($fksString -match "documents_vehicle_id_fkey") {
    Write-Host "Foreign Key 'documents_vehicle_id_fkey': Exists" -ForegroundColor Green
} else {
    Write-Host "Foreign Key 'documents_vehicle_id_fkey': Missing" -ForegroundColor Yellow
}

if ($fksString -match "documents_uploaded_by_fkey") {
    Write-Host "Foreign Key 'documents_uploaded_by_fkey': Exists" -ForegroundColor Green
} else {
    Write-Host "Foreign Key 'documents_uploaded_by_fkey': Missing" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "Database Schema: Complete" -ForegroundColor Green
} else {
    Write-Host "Database Schema: Issues Found" -ForegroundColor Red
    Write-Host "`nRun the suggested fixes above to resolve issues." -ForegroundColor Yellow
}

Write-Host ""
