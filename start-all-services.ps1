# TrustChain LTO - Complete Service Startup Script
# Starts all services in the correct order and verifies they're working

param(
    [switch]$SkipFabric,
    [switch]$ForceReset
)

Write-Host "🚀 Starting TrustChain LTO Services..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Force reset option
if ($ForceReset) {
    Write-Host "`n🔄 Force Reset: Stopping all containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.core.yml down 2>$null
    docker-compose -f docker-compose.fabric.yml down 2>$null
    Start-Sleep -Seconds 2
}

# 1. Start core services
Write-Host "`n📦 Starting Core Services (PostgreSQL, IPFS, Redis)..." -ForegroundColor Yellow
docker-compose -f docker-compose.core.yml up -d postgres ipfs redis

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start core services" -ForegroundColor Red
    exit 1
}

# 2. Wait for services to initialize
Write-Host "⏳ Waiting for services to initialize (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 3. Verify PostgreSQL
Write-Host "`n🔍 Verifying PostgreSQL..." -ForegroundColor Yellow
$maxRetries = 10
$retryCount = 0
$pgReady = $false

while ($retryCount -lt $maxRetries -and -not $pgReady) {
    $pgStatus = docker exec postgres pg_isready -U lto_user -d lto_blockchain 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pgReady = $true
        Write-Host "✅ PostgreSQL: Ready" -ForegroundColor Green
    } else {
        $retryCount++
        Write-Host "   Waiting for PostgreSQL... ($retryCount/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $pgReady) {
    Write-Host "❌ PostgreSQL failed to start" -ForegroundColor Red
    Write-Host "   Check logs: docker logs postgres" -ForegroundColor Yellow
    exit 1
}

# Check for ipfs_cid column
Write-Host "   Checking database schema..." -ForegroundColor Cyan
$hasIpfsCid = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='ipfs_cid';" 2>&1
if ($hasIpfsCid -notmatch "1") {
    Write-Host "   Adding ipfs_cid column to documents table..." -ForegroundColor Yellow
    docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);" 2>&1 | Out-Null
    docker exec postgres psql -U lto_user -d lto_blockchain -c "CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);" 2>&1 | Out-Null
    Write-Host "✅ Database schema updated" -ForegroundColor Green
}

# 4. Verify IPFS
Write-Host "`n🔍 Verifying IPFS..." -ForegroundColor Yellow
$maxRetries = 10
$retryCount = 0
$ipfsReady = $false

while ($retryCount -lt $maxRetries -and -not $ipfsReady) {
    try {
        $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5 -ErrorAction Stop
        $ipfsReady = $true
        Write-Host "✅ IPFS: Ready (Version $($ipfsVersion.Version))" -ForegroundColor Green
    } catch {
        $retryCount++
        Write-Host "   Waiting for IPFS... ($retryCount/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if (-not $ipfsReady) {
    Write-Host "⚠️ IPFS not accessible, attempting to fix configuration..." -ForegroundColor Yellow
    docker exec ipfs ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001 2>&1 | Out-Null
    docker exec ipfs ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080 2>&1 | Out-Null
    docker restart ipfs 2>&1 | Out-Null
    Start-Sleep -Seconds 10
    
    try {
        $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ IPFS: Fixed and ready" -ForegroundColor Green
        $ipfsReady = $true
    } catch {
        Write-Host "❌ IPFS still not accessible. Check: docker logs ipfs" -ForegroundColor Red
    }
}

# 5. Check .env configuration
Write-Host "`n⚙️ Checking Environment Configuration..." -ForegroundColor Yellow
if (Test-Path .env) {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    
    $envContent = Get-Content .env
    $storageMode = ($envContent | Select-String "STORAGE_MODE")
    $blockchainMode = ($envContent | Select-String "BLOCKCHAIN_MODE")
    
    if ($storageMode) {
        $storageMode = $storageMode.ToString().Split("=")[1].Trim()
        Write-Host "   STORAGE_MODE: $storageMode" -ForegroundColor Cyan
        if ($storageMode -eq "ipfs" -and -not $ipfsReady) {
            Write-Host "⚠️ WARNING: STORAGE_MODE=ipfs but IPFS is not accessible!" -ForegroundColor Red
            Write-Host "   Documents will fail to upload. Consider STORAGE_MODE=auto" -ForegroundColor Yellow
        }
    }
    
    if ($blockchainMode) {
        $blockchainMode = $blockchainMode.ToString().Split("=")[1].Trim()
        Write-Host "   BLOCKCHAIN_MODE: $blockchainMode" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "   Please create .env from .env.example" -ForegroundColor Yellow
    exit 1
}

# 6. Start Hyperledger Fabric (if not skipped and mode is fabric)
if (-not $SkipFabric) {
    if (Test-Path .env) {
        $envContent = Get-Content .env
        $blockchainMode = ($envContent | Select-String "BLOCKCHAIN_MODE")
        if ($blockchainMode) {
            $blockchainMode = $blockchainMode.ToString().Split("=")[1].Trim()
            
            if ($blockchainMode -eq "fabric") {
                Write-Host "`n⛓️ Starting Hyperledger Fabric..." -ForegroundColor Yellow
                if (Test-Path "docker-compose.fabric.yml") {
                    docker-compose -f docker-compose.fabric.yml up -d
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ Fabric started (waiting 30 seconds for initialization)..." -ForegroundColor Green
                        Start-Sleep -Seconds 30
                    } else {
                        Write-Host "⚠️ Fabric startup had issues. Check logs." -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "⚠️ docker-compose.fabric.yml not found. Skipping Fabric." -ForegroundColor Yellow
                }
            } else {
                Write-Host "`nℹ️ Using mock blockchain mode (BLOCKCHAIN_MODE=$blockchainMode)" -ForegroundColor Cyan
            }
        }
    }
}

# 7. Verify all services
Write-Host "`n🔍 Final Verification..." -ForegroundColor Yellow
Write-Host "   Running service alignment check..." -ForegroundColor Cyan
& .\verify-services-alignment.ps1

# 8. Start backend application
Write-Host "`n🔧 Starting Backend Application..." -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ Core services are running" -ForegroundColor Green
Write-Host "`nBackend will start on: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Health check: http://localhost:3001/api/health/detailed" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop the backend (containers will keep running)" -ForegroundColor Yellow
Write-Host ""

# Check if node is already running
$nodeProcess = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Write-Host "⚠️ Node.js process already running. Stop it first?" -ForegroundColor Yellow
    $response = Read-Host "Stop existing process and start new one? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Stop-Process -Name node -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Keeping existing process. Exiting." -ForegroundColor Yellow
        exit 0
    }
}

# Start backend
try {
    node server.js
} catch {
    Write-Host "`n❌ Backend failed to start: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Check the error above and verify:" -ForegroundColor Yellow
    Write-Host "  1. All dependencies installed (npm install)" -ForegroundColor White
    Write-Host "  2. .env file is properly configured" -ForegroundColor White
    Write-Host "  3. Port 3001 is not in use" -ForegroundColor White
}
