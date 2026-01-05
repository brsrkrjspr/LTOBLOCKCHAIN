# TrustChain LTO - Start Real Services (IPFS, Fabric, PostgreSQL)
# This script starts the system with REAL services instead of mocks

Write-Host "🚀 TrustChain LTO - Starting with Real Services" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Services: PostgreSQL, IPFS, Hyperledger Fabric" -ForegroundColor Yellow
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if .env exists, create from template if not
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env from production template..." -ForegroundColor Yellow
    if (Test-Path ".env.production") {
        Copy-Item ".env.production" ".env"
        Write-Host "✅ Created .env from .env.production" -ForegroundColor Green
        Write-Host "⚠️  IMPORTANT: Review and update .env with your secrets!" -ForegroundColor Yellow
    } else {
        Write-Host "❌ .env.production template not found!" -ForegroundColor Red
        exit 1
    }
}

# Check if Fabric network is set up
$fabricCryptoExists = Test-Path "fabric-network\crypto-config"
$fabricChannelExists = Test-Path "fabric-network\channel-artifacts\genesis.block"
$walletExists = Test-Path "wallet\admin.id"

if (-not $fabricCryptoExists -or -not $fabricChannelExists -or -not $walletExists) {
    Write-Host "🔧 Hyperledger Fabric network not set up. Running setup..." -ForegroundColor Yellow
    Write-Host ""
    
    # Run complete Fabric setup
    & .\scripts\complete-fabric-setup.ps1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Fabric setup failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "✅ Fabric network setup complete!" -ForegroundColor Green
    Write-Host ""
}

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Cyan
$directories = @(
    "uploads",
    "logs",
    "backup",
    "blockchain-ledger",
    "monitoring/grafana/dashboards",
    "monitoring/grafana/datasources"
)
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   Created: $dir" -ForegroundColor Gray
    }
}

# Stop existing containers
Write-Host ""
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml down 2>$null

# Start all services
Write-Host ""
Write-Host "🚀 Starting production services with REAL IPFS, Fabric, and PostgreSQL..." -ForegroundColor Cyan
Write-Host ""

# Start services in background
docker-compose -f docker-compose.production.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services!" -ForegroundColor Red
    exit 1
}

# Wait for services to initialize
Write-Host ""
Write-Host "⏳ Waiting for services to initialize (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host ""
Write-Host "📊 Checking Service Status:" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Check PostgreSQL
Write-Host -NoNewline "PostgreSQL: "
try {
    $pgStatus = docker exec postgres pg_isready -U lto_user 2>&1
    if ($pgStatus -match "accepting connections") {
        Write-Host "✅ Healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Starting..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Starting..." -ForegroundColor Yellow
}

# Check IPFS
Write-Host -NoNewline "IPFS Node 1: "
try {
    $ipfsStatus = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5 2>&1
    if ($ipfsStatus) {
        Write-Host "✅ Healthy (v$($ipfsStatus.Version))" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Starting..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Starting..." -ForegroundColor Yellow
}

# Check Fabric Peer
Write-Host -NoNewline "Hyperledger Fabric Peer: "
try {
    $fabricStatus = docker exec peer0.lto.gov.ph peer node status 2>&1
    if ($fabricStatus) {
        Write-Host "✅ Running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Starting..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Starting..." -ForegroundColor Yellow
}

# Check Application
Write-Host -NoNewline "Application: "
Start-Sleep -Seconds 10
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Healthy" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Starting..." -ForegroundColor Yellow
}

# Display access information
Write-Host ""
Write-Host "🌐 Access Information:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host "Application:     http://localhost:3001" -ForegroundColor White
Write-Host "PostgreSQL:      localhost:5432" -ForegroundColor White
Write-Host "IPFS Gateway:    http://localhost:8080" -ForegroundColor White
Write-Host "IPFS API:        http://localhost:5001" -ForegroundColor White
Write-Host "Fabric Peer:     localhost:7051" -ForegroundColor White
Write-Host "Fabric CA:       localhost:7054" -ForegroundColor White
Write-Host "CouchDB:         http://localhost:5984" -ForegroundColor White
Write-Host "Prometheus:      http://localhost:9090" -ForegroundColor White
Write-Host "Grafana:         http://localhost:3000 (admin/admin)" -ForegroundColor White

Write-Host ""
Write-Host "📝 Default Login Credentials:" -ForegroundColor Cyan
Write-Host "Admin:    admin@lto.gov.ph / admin123" -ForegroundColor White
Write-Host "Owner:    owner@example.com / admin123" -ForegroundColor White

Write-Host ""
Write-Host "✅ System started with REAL services!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Service Modes:" -ForegroundColor Cyan
Write-Host "   - PostgreSQL: ✅ Real Database" -ForegroundColor Green
Write-Host "   - IPFS: ✅ Real IPFS Network" -ForegroundColor Green
Write-Host "   - Blockchain: ✅ Real Hyperledger Fabric" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Useful Commands:" -ForegroundColor Cyan
Write-Host "   View logs:     docker-compose -f docker-compose.production.yml logs -f" -ForegroundColor Gray
Write-Host "   Stop services: docker-compose -f docker-compose.production.yml down" -ForegroundColor Gray
Write-Host "   Restart:       docker-compose -f docker-compose.production.yml restart" -ForegroundColor Gray
Write-Host ""

