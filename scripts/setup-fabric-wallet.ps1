# TrustChain LTO - Setup Fabric Wallet
# Creates wallet with admin identity for application connection

Write-Host "🔐 Setting up Fabric wallet for application..." -ForegroundColor Cyan

# Check if crypto materials exist
if (-not (Test-Path "fabric-network\crypto-config\peerOrganizations\lto.gov.ph\users\Admin@lto.gov.ph")) {
    Write-Host "❌ Admin user certificates not found!" -ForegroundColor Red
    Write-Host "💡 Please run generate-crypto.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Run wallet setup script
Write-Host "🔧 Creating wallet..." -ForegroundColor Cyan

node scripts/setup-fabric-wallet.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Wallet setup complete!" -ForegroundColor Green
    Write-Host "💡 Next step: Run .\scripts\deploy-chaincode.ps1" -ForegroundColor Yellow
} else {
    Write-Host "❌ Wallet setup failed" -ForegroundColor Red
    exit 1
}

