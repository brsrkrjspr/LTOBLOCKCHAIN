# Verify database is properly initialized
Write-Host "Verifying database setup..." -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL container is running
Write-Host -NoNewline "Checking PostgreSQL container: "
$pgContainer = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
if ($pgContainer -like "*postgres*") {
    Write-Host "✅ RUNNING" -ForegroundColor Green
} else {
    Write-Host "❌ NOT RUNNING" -ForegroundColor Red
    Write-Host "   Please start services first: docker-compose -f docker-compose.core.yml up -d" -ForegroundColor Yellow
    exit 1
}

# Check if database is accepting connections
Write-Host -NoNewline "Checking database connection: "
$pgReady = docker exec postgres pg_isready -U lto_user 2>&1
if ($pgReady -like "*accepting connections*") {
    Write-Host "✅ READY" -ForegroundColor Green
} else {
    Write-Host "❌ NOT READY" -ForegroundColor Red
    Write-Host "   Waiting 10 seconds and retrying..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    $pgReady = docker exec postgres pg_isready -U lto_user 2>&1
    if ($pgReady -like "*accepting connections*") {
        Write-Host "   ✅ NOW READY" -ForegroundColor Green
    } else {
        Write-Host "   ❌ STILL NOT READY" -ForegroundColor Red
        exit 1
    }
}

# Check if database exists
Write-Host -NoNewline "Checking database exists: "
$dbExists = docker exec postgres psql -U lto_user -lqt 2>&1 | Select-String "lto_blockchain"
if ($dbExists) {
    Write-Host "✅ EXISTS" -ForegroundColor Green
} else {
    Write-Host "⚠️  NOT FOUND" -ForegroundColor Yellow
    Write-Host "   Database will be created automatically on first connection" -ForegroundColor Gray
}

# Check if tables exist
Write-Host -NoNewline "Checking database tables: "
$tables = docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt" 2>&1

if ($tables -like "*vehicles*" -and $tables -like "*users*") {
    Write-Host "✅ INITIALIZED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database tables found:" -ForegroundColor Cyan
    $tables | Select-String "public \|" | ForEach-Object {
        $tableName = ($_ -split '\|')[1].Trim()
        if ($tableName -and $tableName -ne "Name") {
            Write-Host "   ✅ $tableName" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "⚠️  NOT INITIALIZED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Database needs initialization. Run:" -ForegroundColor Yellow
    Write-Host "   docker exec -i postgres psql -U lto_user -d lto_blockchain < database/init-laptop.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or if database doesn't exist yet, it will be created automatically." -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Database verification complete!" -ForegroundColor Green

