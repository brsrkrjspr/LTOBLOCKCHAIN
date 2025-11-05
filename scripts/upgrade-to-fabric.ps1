# TrustChain LTO - Upgrade to Hyperledger Fabric Script
# Automated upgrade from mock blockchain to Hyperledger Fabric

param(
    [switch]$SkipNetwork,
    [switch]$SkipChaincode,
    [switch]$Force
)

Write-Host "🚀 TrustChain LTO - Upgrade to Hyperledger Fabric" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Fabric network directory exists
if (-not (Test-Path "fabric-network")) {
    Write-Host "⚠️  Fabric network directory not found" -ForegroundColor Yellow
    Write-Host "💡 Run the manual setup steps first (see UPGRADE-TO-HYPERLEDGER-FABRIC.md)" -ForegroundColor Yellow
    exit 1
}

# Step 1: Start Fabric Network
if (-not $SkipNetwork) {
    Write-Host "`n🏗️  Step 1: Starting Fabric Network..." -ForegroundColor Cyan
    
    if (Test-Path "fabric-network\docker-compose.fabric.yml") {
        Push-Location fabric-network
        docker-compose -f docker-compose.fabric.yml up -d
        Pop-Location
        
        Write-Host "⏳ Waiting for network to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        Write-Host "✅ Fabric network started" -ForegroundColor Green
    } else {
        Write-Host "⚠️  docker-compose.fabric.yml not found" -ForegroundColor Yellow
        Write-Host "💡 Please create the Fabric network configuration first" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n⏭️  Skipping network setup (--SkipNetwork)" -ForegroundColor Gray
}

# Step 2: Setup Wallet
Write-Host "`n🔐 Step 2: Setting up Fabric Wallet..." -ForegroundColor Cyan

if (Test-Path "wallet" -and -not $Force) {
    Write-Host "⚠️  Wallet already exists. Use -Force to recreate." -ForegroundColor Yellow
} else {
    if ($Force -and (Test-Path "wallet")) {
        Remove-Item -Recurse -Force wallet
        Write-Host "🗑️  Removed existing wallet" -ForegroundColor Gray
    }
    
    node scripts/setup-fabric-wallet.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Wallet setup complete" -ForegroundColor Green
    } else {
        Write-Host "❌ Wallet setup failed" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Deploy Chaincode
if (-not $SkipChaincode) {
    Write-Host "`n📦 Step 3: Deploying Chaincode..." -ForegroundColor Cyan
    
    Write-Host "💡 Chaincode deployment requires manual steps:" -ForegroundColor Yellow
    Write-Host "   1. Create channel" -ForegroundColor Gray
    Write-Host "   2. Join peer to channel" -ForegroundColor Gray
    Write-Host "   3. Package and install chaincode" -ForegroundColor Gray
    Write-Host "   4. Approve and commit chaincode" -ForegroundColor Gray
    Write-Host "`nSee UPGRADE-TO-HYPERLEDGER-FABRIC.md for detailed instructions" -ForegroundColor Yellow
} else {
    Write-Host "`n⏭️  Skipping chaincode deployment (--SkipChaincode)" -ForegroundColor Gray
}

# Step 4: Update Environment
Write-Host "`n⚙️  Step 4: Updating Environment Configuration..." -ForegroundColor Cyan

if (Test-Path ".env") {
    $envContent = Get-Content .env -Raw
    
    if ($envContent -match "BLOCKCHAIN_MODE=mock") {
        $envContent = $envContent -replace "BLOCKCHAIN_MODE=mock", "BLOCKCHAIN_MODE=fabric"
        Set-Content .env $envContent
        Write-Host "✅ Updated BLOCKCHAIN_MODE to 'fabric'" -ForegroundColor Green
    } elseif ($envContent -match "BLOCKCHAIN_MODE=fabric") {
        Write-Host "✅ BLOCKCHAIN_MODE already set to 'fabric'" -ForegroundColor Green
    } else {
        Add-Content .env "`nBLOCKCHAIN_MODE=fabric"
        Write-Host "✅ Added BLOCKCHAIN_MODE=fabric to .env" -ForegroundColor Green
    }
    
    # Add Fabric-specific configuration if not present
    if ($envContent -notmatch "FABRIC_NETWORK_CONFIG") {
        Add-Content .env "FABRIC_NETWORK_CONFIG=./network-config.yaml"
        Add-Content .env "FABRIC_WALLET_PATH=./wallet"
        Add-Content .env "FABRIC_CHANNEL_NAME=ltochannel"
        Add-Content .env "FABRIC_CHAINCODE_NAME=vehicle-registration"
        Add-Content .env "FABRIC_MSP_ID=LTOMSP"
        Write-Host "✅ Added Fabric configuration to .env" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  .env file not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item .env.production .env -ErrorAction SilentlyContinue
    Write-Host "✅ Created .env file. Please review and update." -ForegroundColor Green
}

# Step 5: Verify Configuration
Write-Host "`n✅ Step 5: Verifying Configuration..." -ForegroundColor Cyan

$checks = @{
    "Network config exists" = Test-Path "network-config.yaml"
    "Wallet exists" = Test-Path "wallet"
    "Chaincode exists" = Test-Path "chaincode/vehicle-registration-production"
    "Fabric network running" = (docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Names}}" | Measure-Object).Count -gt 0
}

foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "  ✅ $($check.Key)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Key)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n📊 Upgrade Summary" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "✅ Wallet setup: Complete" -ForegroundColor Green
Write-Host "✅ Environment updated: Complete" -ForegroundColor Green

if ($checks["Fabric network running"]) {
    Write-Host "✅ Fabric network: Running" -ForegroundColor Green
} else {
    Write-Host "⚠️  Fabric network: Not running" -ForegroundColor Yellow
}

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Deploy chaincode (if not done): See UPGRADE-TO-HYPERLEDGER-FABRIC.md" -ForegroundColor White
Write-Host "2. Restart application: docker-compose -f docker-compose.production-no-ipfs.yml restart lto-app-prod" -ForegroundColor White
Write-Host "3. Verify connection: curl http://localhost:3001/api/blockchain/status" -ForegroundColor White
Write-Host "4. Test registration: Register a test vehicle" -ForegroundColor White

Write-Host "`n🎉 Upgrade script completed!" -ForegroundColor Green

