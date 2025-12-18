# TrustChain LTO - Apply Database Fix for completed_at Column
# This script adds the missing completed_at column to clearance_requests table

Write-Host "🔧 Applying database fix for clearance_requests.completed_at column..." -ForegroundColor Cyan

# Check if postgres container is running
$postgresRunning = docker ps --filter "name=postgres" --format "{{.Names}}"

if (-not $postgresRunning) {
    Write-Host "❌ PostgreSQL container is not running!" -ForegroundColor Red
    Write-Host "   Please start the database container first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL container found: $postgresRunning" -ForegroundColor Green

# Apply the SQL fix
Write-Host "📝 Applying SQL migration..." -ForegroundColor Cyan

docker exec -i postgres psql -U lto_user -d lto_blockchain -c @"
ALTER TABLE clearance_requests 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

COMMENT ON COLUMN clearance_requests.completed_at IS 'Timestamp when the clearance request was completed, approved, or rejected';
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database fix applied successfully!" -ForegroundColor Green
    Write-Host "   The completed_at column has been added to clearance_requests table." -ForegroundColor White
} else {
    Write-Host "❌ Failed to apply database fix!" -ForegroundColor Red
    Write-Host "   Error code: $LASTEXITCODE" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✨ Done! You can now test Insurance and Emission approval workflows." -ForegroundColor Green
