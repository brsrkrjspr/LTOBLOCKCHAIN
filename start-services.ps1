# TrustChain LTO - Service Startup Script
# Ensures all services (PostgreSQL, IPFS, Fabric) are running before starting the application

Write-Host "🚀 TrustChain LTO - Service Startup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "🔍 Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Check if docker-compose is available
Write-Host "🔍 Checking docker-compose..." -ForegroundColor Yellow
$composeVersion = docker-compose --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ docker-compose is not available." -ForegroundColor Red
    exit 1
}
Write-Host "✅ docker-compose is available" -ForegroundColor Green
Write-Host ""

# Start PostgreSQL
Write-Host "📊 Starting PostgreSQL..." -ForegroundColor Yellow
$postgresRunning = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
if ($postgresRunning -notlike "*postgres*") {
    Write-Host "   Starting PostgreSQL container..." -ForegroundColor Gray
    docker-compose -f docker-compose.production.yml up -d postgres 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Gray
        Start-Sleep -Seconds 10
        $retries = 0
        while ($retries -lt 30) {
            $pgReady = docker exec postgres pg_isready -U lto_user 2>&1
            if ($pgReady -like "*accepting connections*") {
                Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green
                break
            }
            Start-Sleep -Seconds 2
            $retries++
        }
        if ($retries -ge 30) {
            Write-Host "⚠️ PostgreSQL may not be fully ready, but continuing..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️ Failed to start PostgreSQL, but continuing..." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ PostgreSQL is already running" -ForegroundColor Green
}
Write-Host ""

# Start IPFS
Write-Host "🌐 Starting IPFS..." -ForegroundColor Yellow
$ipfsRunning = docker ps --filter "name=ipfs" --format "{{.Names}}" 2>&1
if ($ipfsRunning -notlike "*ipfs*") {
    Write-Host "   Starting IPFS container..." -ForegroundColor Gray
    docker-compose -f docker-compose.production.yml up -d ipfs-cluster 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ⏳ Waiting for IPFS to initialize..." -ForegroundColor Gray
        Start-Sleep -Seconds 15
        Write-Host "✅ IPFS container started" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Failed to start IPFS, but continuing..." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ IPFS is already running" -ForegroundColor Green
}
Write-Host ""

# Check Fabric network (optional)
Write-Host "⛓️ Checking Hyperledger Fabric..." -ForegroundColor Yellow
$fabricPeer = docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Names}}" 2>&1
if ($fabricPeer -like "*peer0*") {
    Write-Host "✅ Fabric network is running" -ForegroundColor Green
} else {
    Write-Host "⚠️ Fabric network is not running (will use mock mode)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "📊 Service Status Summary:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
docker ps --filter "name=postgres" --format "   PostgreSQL: {{.Status}}" 2>&1
docker ps --filter "name=ipfs" --format "   IPFS: {{.Status}}" 2>&1
docker ps --filter "name=peer0" --format "   Fabric Peer: {{.Status}}" 2>&1
Write-Host ""

Write-Host "✅ Services are ready!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Make sure your .env file is configured" -ForegroundColor White
Write-Host "   2. Run: node server.js" -ForegroundColor White
Write-Host ""

