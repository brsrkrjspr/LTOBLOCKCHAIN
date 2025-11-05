# TrustChain LTO - Production Start Script (Without IPFS)

Write-Host "🚀 Starting TrustChain LTO Production System (Without IPFS)..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env not found. Creating from template..." -ForegroundColor Yellow
    if (Test-Path ".env.production") {
        Copy-Item ".env.production" ".env"
        Write-Host "✅ Created .env from .env.production template" -ForegroundColor Green
        Write-Host "⚠️  IMPORTANT: Update .env with your production secrets!" -ForegroundColor Yellow
    } else {
        Write-Host "❌ .env.production template not found. Please create .env manually." -ForegroundColor Red
        exit 1
    }
}

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Cyan
$directories = @("uploads", "logs", "backup", "blockchain-ledger", "monitoring/grafana/dashboards", "monitoring/grafana/datasources")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   Created: $dir" -ForegroundColor Gray
    }
}

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.production-no-ipfs.yml down

# Start services
Write-Host "🚀 Starting production services..." -ForegroundColor Cyan
docker-compose -f docker-compose.production-no-ipfs.yml up -d

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check service health
Write-Host "`n📊 Service Status:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

# Check PostgreSQL
try {
    $pgStatus = docker exec postgres-prod pg_isready -U lto_user
    if ($pgStatus) {
        Write-Host "✅ PostgreSQL: Healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  PostgreSQL: Starting..." -ForegroundColor Yellow
}

# Check Redis
try {
    $redisStatus = docker exec redis-prod redis-cli --raw incr ping 2>&1
    if ($redisStatus -eq "1") {
        Write-Host "✅ Redis: Healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Redis: Starting..." -ForegroundColor Yellow
}

# Check Application
Start-Sleep -Seconds 15
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Application: Healthy" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Application: Starting..." -ForegroundColor Yellow
}

# Display access information
Write-Host "`n🌐 Access Information:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host "Application:  http://localhost:3001" -ForegroundColor White
Write-Host "Prometheus:   http://localhost:9090" -ForegroundColor White
Write-Host "Grafana:      http://localhost:3000 (admin/admin)" -ForegroundColor White
Write-Host "PostgreSQL:   localhost:5432" -ForegroundColor White
Write-Host "Redis:        localhost:6379" -ForegroundColor White

Write-Host "`n📝 Default Login Credentials:" -ForegroundColor Cyan
Write-Host "Admin:    admin@lto.gov.ph / admin123" -ForegroundColor White
Write-Host "Owner:    owner@example.com / admin123" -ForegroundColor White

Write-Host "`n✅ Production system started successfully!" -ForegroundColor Green
Write-Host "`nTo view logs: docker-compose -f docker-compose.production-no-ipfs.yml logs -f" -ForegroundColor Gray
Write-Host "To stop:      docker-compose -f docker-compose.production-no-ipfs.yml down" -ForegroundColor Gray

