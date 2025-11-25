# TrustChain LTO - IPFS Setup Script
# Sets up IPFS node using Docker

Write-Host "🌐 Setting up IPFS Node..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Starting IPFS container..." -ForegroundColor Cyan

# Start IPFS using docker-compose
docker-compose -f docker-compose.laptop.yml up -d ipfs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ IPFS container started" -ForegroundColor Green
    
    Write-Host "⏳ Waiting for IPFS to initialize (15 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    
    # Test IPFS connection
    Write-Host "🔍 Testing IPFS connection..." -ForegroundColor Cyan
    
    $testResult = docker exec ipfs ipfs version 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ IPFS is ready!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 IPFS Information:" -ForegroundColor Cyan
        Write-Host "   API Port: 5001" -ForegroundColor White
        Write-Host "   Gateway Port: 8080" -ForegroundColor White
        Write-Host "   Swarm Port: 4001" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 Next steps:" -ForegroundColor Yellow
        Write-Host "   1. Update .env file with IPFS settings:" -ForegroundColor White
        Write-Host "      STORAGE_MODE=auto" -ForegroundColor Gray
        Write-Host "      IPFS_HOST=localhost" -ForegroundColor Gray
        Write-Host "      IPFS_PORT=5001" -ForegroundColor Gray
        Write-Host "      IPFS_PROTOCOL=http" -ForegroundColor Gray
        Write-Host "   2. Run database migration: Get-Content database\add-ipfs-cid.sql | docker exec -i postgres psql -U lto_user -d lto_blockchain" -ForegroundColor White
        Write-Host "   3. Restart your application: npm start" -ForegroundColor White
    } else {
        Write-Host "⚠️  IPFS connection test failed" -ForegroundColor Yellow
        Write-Host "💡 IPFS may still be initializing. Wait a bit longer and try again." -ForegroundColor Yellow
        Write-Host "   Check logs: docker-compose -f docker-compose.laptop.yml logs ipfs" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Failed to start IPFS container" -ForegroundColor Red
    Write-Host "💡 Check Docker logs: docker-compose -f docker-compose.laptop.yml logs ipfs" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎉 IPFS setup complete!" -ForegroundColor Green

