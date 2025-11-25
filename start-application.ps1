# Start application with proper environment
Write-Host "Starting TrustChain LTO Application..." -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "✅ Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file or run reset-and-reconfigure.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Verify critical environment variables
Write-Host "Verifying critical environment variables..." -ForegroundColor Yellow
$requiredVars = @("DB_HOST", "DB_PORT", "DB_NAME", "STORAGE_MODE", "BLOCKCHAIN_MODE")
$missing = @()

foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var, "Process")
    if (-not $value) {
        $missing += $var
    } else {
        Write-Host "   ✅ $var = $value" -ForegroundColor Gray
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Missing required environment variables: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "   Please check your .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Verify STORAGE_MODE
$storageMode = [Environment]::GetEnvironmentVariable("STORAGE_MODE", "Process")
if ($storageMode -ne "ipfs") {
    Write-Host "⚠️  WARNING: STORAGE_MODE is set to '$storageMode' instead of 'ipfs'" -ForegroundColor Yellow
    Write-Host "   Applications will be stored locally instead of IPFS" -ForegroundColor Yellow
    Write-Host "   Update .env file: STORAGE_MODE=ipfs" -ForegroundColor Gray
} else {
    Write-Host "✅ STORAGE_MODE is set to 'ipfs' - documents will be stored in IPFS" -ForegroundColor Green
}

# Verify BLOCKCHAIN_MODE
$blockchainMode = [Environment]::GetEnvironmentVariable("BLOCKCHAIN_MODE", "Process")
if ($blockchainMode -ne "fabric") {
    Write-Host "⚠️  WARNING: BLOCKCHAIN_MODE is set to '$blockchainMode' instead of 'fabric'" -ForegroundColor Yellow
    Write-Host "   Blockchain will use mock mode instead of real Fabric" -ForegroundColor Yellow
    Write-Host "   Update .env file: BLOCKCHAIN_MODE=fabric" -ForegroundColor Gray
} else {
    Write-Host "✅ BLOCKCHAIN_MODE is set to 'fabric' - using real Hyperledger Fabric" -ForegroundColor Green
}

Write-Host ""

# Check if services are running
Write-Host "Checking required services..." -ForegroundColor Yellow

# Check PostgreSQL
Write-Host -NoNewline "   PostgreSQL: "
$pgReady = docker exec postgres pg_isready -U lto_user 2>&1
if ($pgReady -like "*accepting connections*") {
    Write-Host "✅ RUNNING" -ForegroundColor Green
} else {
    Write-Host "❌ NOT RUNNING" -ForegroundColor Red
    Write-Host "   Start services: docker-compose -f docker-compose.core.yml up -d" -ForegroundColor Yellow
    exit 1
}

# Check IPFS (if STORAGE_MODE is ipfs)
if ($storageMode -eq "ipfs") {
    Write-Host -NoNewline "   IPFS: "
    try {
        $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5 2>&1
        Write-Host "✅ RUNNING" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  NOT RUNNING (will use fallback)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Starting application server..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Start the application
node server.js

