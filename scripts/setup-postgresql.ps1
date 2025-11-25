# TrustChain LTO - PostgreSQL Setup Script
# Sets up PostgreSQL database using Docker

Write-Host "🐘 Setting up PostgreSQL Database..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if database init file exists
if (-not (Test-Path "database\init-laptop.sql")) {
    Write-Host "❌ Database initialization file not found!" -ForegroundColor Red
    Write-Host "💡 Expected: database\init-laptop.sql" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Starting PostgreSQL container..." -ForegroundColor Cyan

# Start PostgreSQL using docker-compose
docker-compose -f docker-compose.laptop.yml up -d postgres

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL container started" -ForegroundColor Green
    
    Write-Host "⏳ Waiting for PostgreSQL to be ready (10 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Test connection
    Write-Host "🔍 Testing database connection..." -ForegroundColor Cyan
    
    $testResult = docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Database Information:" -ForegroundColor Cyan
        Write-Host "   Host: localhost" -ForegroundColor White
        Write-Host "   Port: 5432" -ForegroundColor White
        Write-Host "   Database: lto_blockchain" -ForegroundColor White
        Write-Host "   User: lto_user" -ForegroundColor White
        Write-Host "   Password: lto_password" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 Next steps:" -ForegroundColor Yellow
        Write-Host "   1. Update .env file with database credentials" -ForegroundColor White
        Write-Host "   2. Install npm packages: npm install" -ForegroundColor White
        Write-Host "   3. Restart your application: npm start" -ForegroundColor White
    } else {
        Write-Host "⚠️  Database connection test failed" -ForegroundColor Yellow
        Write-Host "💡 Database may still be initializing. Wait a bit longer and try again." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Failed to start PostgreSQL container" -ForegroundColor Red
    Write-Host "💡 Check Docker logs: docker-compose -f docker-compose.laptop.yml logs postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎉 PostgreSQL setup complete!" -ForegroundColor Green

