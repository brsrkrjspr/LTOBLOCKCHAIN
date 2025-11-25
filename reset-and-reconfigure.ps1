# TrustChain LTO - Complete Reset and Reconfiguration
# This script will reset all containers and reconfigure them properly

Write-Host "🔄 TrustChain LTO - Complete Reset and Reconfiguration" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all containers
Write-Host "Step 1/8: Stopping all containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.core.yml down -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some containers may not have been running" -ForegroundColor Yellow
}
Write-Host "✅ All containers stopped and volumes removed" -ForegroundColor Green
Write-Host ""

# Step 2: Remove old volumes (optional - uncomment if you want fresh start)
Write-Host "Step 2/8: Cleaning up old volumes..." -ForegroundColor Yellow
docker volume prune -f
Write-Host "✅ Old volumes cleaned" -ForegroundColor Green
Write-Host ""

# Step 3: Verify .env file exists
Write-Host "Step 3/8: Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Creating .env from template..." -ForegroundColor Yellow
    
    # Create .env with proper configuration
    @"
# Application
NODE_ENV=production
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# IPFS
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs

# Blockchain
BLOCKCHAIN_MODE=fabric
FABRIC_NETWORK_CONFIG=./network-config.yaml
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=$(New-Guid).ToString().Replace('-', '') + $(New-Guid).ToString().Replace('-', '')
ENCRYPTION_KEY=$(New-Guid).ToString().Replace('-', '')
"@ | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "✅ .env file created" -ForegroundColor Green
    Write-Host "⚠️  IMPORTANT: Review and update JWT_SECRET and ENCRYPTION_KEY in .env!" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    Write-Host "⚠️  Verifying critical settings..." -ForegroundColor Yellow
    
    # Check if STORAGE_MODE is set to ipfs
    $envContent = Get-Content ".env" -Raw
    if ($envContent -notmatch "STORAGE_MODE=ipfs") {
        Write-Host "⚠️  WARNING: STORAGE_MODE is not set to 'ipfs'" -ForegroundColor Yellow
        Write-Host "   Applications will use local storage instead of IPFS" -ForegroundColor Yellow
        Write-Host "   Updating .env to use IPFS..." -ForegroundColor Yellow
        $envContent = $envContent -replace "STORAGE_MODE=.*", "STORAGE_MODE=ipfs"
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "   ✅ Updated STORAGE_MODE to 'ipfs'" -ForegroundColor Green
    }
    
    if ($envContent -notmatch "BLOCKCHAIN_MODE=fabric") {
        Write-Host "⚠️  WARNING: BLOCKCHAIN_MODE is not set to 'fabric'" -ForegroundColor Yellow
        Write-Host "   Blockchain will use mock mode instead of real Fabric" -ForegroundColor Yellow
        Write-Host "   Updating .env to use Fabric..." -ForegroundColor Yellow
        $envContent = $envContent -replace "BLOCKCHAIN_MODE=.*", "BLOCKCHAIN_MODE=fabric"
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "   ✅ Updated BLOCKCHAIN_MODE to 'fabric'" -ForegroundColor Green
    }
}
Write-Host ""

# Step 4: Create necessary directories
Write-Host "Step 4/8: Creating necessary directories..." -ForegroundColor Yellow
$directories = @(
    "uploads",
    "logs",
    "backup",
    "blockchain-ledger",
    "wallet",
    "fabric-network/crypto-config",
    "fabric-network/channel-artifacts"
)
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   Created: $dir" -ForegroundColor Gray
    }
}
Write-Host "✅ Directories ready" -ForegroundColor Green
Write-Host ""

# Step 5: Check Docker is running
Write-Host "Step 5/8: Verifying Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Step 6: Start all services
Write-Host "Step 6/8: Starting all services..." -ForegroundColor Yellow
Write-Host "   This includes: PostgreSQL, Redis, IPFS, Fabric CA, Orderers, Peer, CouchDB" -ForegroundColor Gray
Write-Host ""

docker-compose -f docker-compose.core.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Services started" -ForegroundColor Green
Write-Host ""

# Step 7: Wait for services to initialize
Write-Host "Step 7/8: Waiting for services to initialize (45 seconds)..." -ForegroundColor Yellow
Write-Host "   This gives PostgreSQL, IPFS, and Fabric time to fully start" -ForegroundColor Gray
Start-Sleep -Seconds 45
Write-Host ""

# Step 8: Verify services
Write-Host "Step 8/8: Verifying services..." -ForegroundColor Yellow
Write-Host ""

# Check PostgreSQL
Write-Host -NoNewline "   PostgreSQL: "
$pgReady = docker exec postgres pg_isready -U lto_user 2>&1
if ($pgReady -like "*accepting connections*") {
    Write-Host "✅ RUNNING" -ForegroundColor Green
} else {
    Write-Host "❌ NOT READY" -ForegroundColor Red
    Write-Host "      Waiting a bit longer..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    $pgReady = docker exec postgres pg_isready -U lto_user 2>&1
    if ($pgReady -like "*accepting connections*") {
        Write-Host "   PostgreSQL: ✅ NOW READY" -ForegroundColor Green
    } else {
        Write-Host "   PostgreSQL: ❌ STILL NOT READY - Check logs: docker logs postgres" -ForegroundColor Red
    }
}

# Check Redis
Write-Host -NoNewline "   Redis: "
try {
    $redisResult = docker exec redis redis-cli --raw incr ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ RUNNING" -ForegroundColor Green
    } else {
        Write-Host "⚠️  STARTING" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  STARTING" -ForegroundColor Yellow
}

# Check IPFS
Write-Host -NoNewline "   IPFS: "
try {
    $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5 2>&1
    Write-Host "✅ RUNNING (v$($ipfsVersion.Version))" -ForegroundColor Green
} catch {
    Write-Host "⚠️  STARTING (may take 1-2 minutes)" -ForegroundColor Yellow
}

# Check Fabric services
Write-Host -NoNewline "   Fabric CA: "
$caRunning = docker ps --filter "name=ca.lto.gov.ph" --format "{{.Status}}" 2>&1
if ($caRunning -like "*Up*") {
    Write-Host "✅ RUNNING" -ForegroundColor Green
} else {
    Write-Host "⚠️  STARTING" -ForegroundColor Yellow
}

Write-Host -NoNewline "   Fabric Peer: "
$peerRunning = docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Status}}" 2>&1
if ($peerRunning -like "*Up*") {
    Write-Host "✅ RUNNING" -ForegroundColor Green
} else {
    Write-Host "⚠️  STARTING" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ RECONFIGURATION COMPLETE!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Final instructions
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Verify Fabric network setup (if not done):" -ForegroundColor White
Write-Host "   .\scripts\complete-fabric-setup.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Initialize database (if needed):" -ForegroundColor White
Write-Host "   docker exec -i postgres psql -U lto_user -d lto_blockchain < database/init-laptop.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start the application:" -ForegroundColor White
Write-Host "   node server.js" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Verify services are working:" -ForegroundColor White
Write-Host "   Invoke-RestMethod -Uri 'http://localhost:3001/api/health/detailed' -Method GET" -ForegroundColor Gray
Write-Host ""

Write-Host "Service URLs:" -ForegroundColor Cyan
Write-Host "   Application: http://localhost:3001" -ForegroundColor White
Write-Host "   PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "   IPFS API: http://localhost:5001" -ForegroundColor White
Write-Host "   IPFS Gateway: http://localhost:8080" -ForegroundColor White
Write-Host "   Fabric Peer: localhost:7051" -ForegroundColor White
Write-Host "   CouchDB: http://localhost:5984" -ForegroundColor White
Write-Host ""

