# TrustChain LTO - Start Hyperledger Fabric Network
# Starts all Fabric components using Docker Compose

Write-Host "🚀 Starting Hyperledger Fabric Network..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if crypto materials exist
if (-not (Test-Path "fabric-network\crypto-config")) {
    Write-Host "❌ Cryptographic materials not found!" -ForegroundColor Red
    Write-Host "💡 Please run generate-crypto.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Check if channel artifacts exist
if (-not (Test-Path "fabric-network\channel-artifacts\genesis.block")) {
    Write-Host "❌ Channel artifacts not found!" -ForegroundColor Red
    Write-Host "💡 Please run generate-channel-artifacts.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Starting Fabric containers..." -ForegroundColor Cyan

# Start Fabric network
docker-compose -f docker-compose.fabric.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fabric network started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Network Status:" -ForegroundColor Cyan
    docker-compose -f docker-compose.fabric.yml ps
    
    Write-Host ""
    Write-Host "⏳ Waiting for network to be ready (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    Write-Host ""
    Write-Host "🔍 Checking container status..." -ForegroundColor Cyan
    docker-compose -f docker-compose.fabric.yml ps
    
    Write-Host ""
    Write-Host "✅ Fabric network is running!" -ForegroundColor Green
    Write-Host "💡 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Run: .\scripts\create-channel.ps1" -ForegroundColor White
    Write-Host "   2. Run: .\scripts\setup-fabric-wallet.ps1" -ForegroundColor White
    Write-Host "   3. Run: .\scripts\deploy-chaincode.ps1" -ForegroundColor White
} else {
    Write-Host "❌ Failed to start Fabric network" -ForegroundColor Red
    Write-Host "💡 Check Docker logs: docker-compose -f docker-compose.fabric.yml logs" -ForegroundColor Yellow
    exit 1
}

