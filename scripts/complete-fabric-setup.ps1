# TrustChain LTO - Complete Fabric Setup Script
# Runs all setup steps in sequence

Write-Host "🚀 TrustChain LTO - Complete Hyperledger Fabric Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate crypto materials
Write-Host "STEP 1/5: Generating cryptographic materials..." -ForegroundColor Yellow
& .\scripts\generate-crypto.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup failed at Step 1" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Generate channel artifacts
Write-Host "STEP 2/5: Generating channel artifacts..." -ForegroundColor Yellow
& .\scripts\generate-channel-artifacts.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup failed at Step 2" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Start Fabric network
Write-Host "STEP 3/5: Starting Fabric network..." -ForegroundColor Yellow
& .\scripts\start-fabric-network.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup failed at Step 3" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wait a bit for network to stabilize
Write-Host "⏳ Waiting for network to stabilize (20 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Step 4: Create and join channel
Write-Host "STEP 4/5: Creating and joining channel..." -ForegroundColor Yellow
& .\scripts\create-channel.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup failed at Step 4" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Setup wallet
Write-Host "STEP 5/5: Setting up application wallet..." -ForegroundColor Yellow
& .\scripts\setup-fabric-wallet.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup failed at Step 5" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Deploy chaincode
Write-Host "BONUS STEP: Deploying chaincode..." -ForegroundColor Yellow
& .\scripts\deploy-chaincode.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Chaincode deployment failed (you can deploy it later)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Chaincode deployed successfully" -ForegroundColor Green
}
Write-Host ""

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 Fabric Network Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Next steps:" -ForegroundColor Yellow
Write-Host "   1. Update .env file: Set BLOCKCHAIN_MODE=fabric" -ForegroundColor White
Write-Host "   2. Restart your application: npm start" -ForegroundColor White
Write-Host "   3. Your app will now use the real Fabric network!" -ForegroundColor White
Write-Host ""
Write-Host "📊 Check network status:" -ForegroundColor Cyan
Write-Host "   docker-compose -f docker-compose.fabric.yml ps" -ForegroundColor White
Write-Host ""

