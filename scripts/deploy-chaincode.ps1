# TrustChain LTO - Deploy Chaincode
# Packages, installs, and instantiates the vehicle registration chaincode

Write-Host "📦 Deploying vehicle registration chaincode..." -ForegroundColor Cyan

# Check if Fabric network is running
$peerRunning = docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Names}}"
if (-not $peerRunning) {
    Write-Host "❌ Fabric network is not running!" -ForegroundColor Red
    Write-Host "💡 Please run start-fabric-network.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Check if channel exists
$channelExists = docker exec cli peer channel list 2>&1 | Select-String "ltochannel"
if (-not $channelExists) {
    Write-Host "❌ Channel 'ltochannel' not found!" -ForegroundColor Red
    Write-Host "💡 Please run create-channel.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Packaging chaincode..." -ForegroundColor Cyan

# Package chaincode
docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz `
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production `
    --lang node `
    --label vehicle-registration_1.0

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to package chaincode" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Chaincode packaged" -ForegroundColor Green

Write-Host "📤 Installing chaincode on peer..." -ForegroundColor Cyan

# Install chaincode
docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install chaincode" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Chaincode installed" -ForegroundColor Green

# Get package ID
Write-Host "🔍 Getting package ID..." -ForegroundColor Cyan
$packageId = docker exec cli peer lifecycle chaincode queryinstalled | Select-String "vehicle-registration_1.0" | ForEach-Object { ($_ -split '\s+')[1] -replace ':', '' }

if (-not $packageId) {
    Write-Host "❌ Failed to get package ID" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Package ID: $packageId" -ForegroundColor Cyan

Write-Host "✅ Approving chaincode for organization..." -ForegroundColor Cyan

# Approve chaincode
docker exec cli peer lifecycle chaincode approveformyorg `
    -o orderer1.lto.gov.ph:7050 `
    --channelID ltochannel `
    --name vehicle-registration `
    --version 1.0 `
    --package-id $packageId `
    --sequence 1 `
    --tls `
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to approve chaincode" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Chaincode approved" -ForegroundColor Green

Write-Host "🚀 Committing chaincode to channel..." -ForegroundColor Cyan

# Commit chaincode
docker exec cli peer lifecycle chaincode commit `
    -o orderer1.lto.gov.ph:7050 `
    --channelID ltochannel `
    --name vehicle-registration `
    --version 1.0 `
    --sequence 1 `
    --tls `
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to commit chaincode" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Chaincode committed" -ForegroundColor Green

Write-Host "🧪 Testing chaincode..." -ForegroundColor Cyan

# Test chaincode (query)
docker exec cli peer chaincode query `
    -C ltochannel `
    -n vehicle-registration `
    -c '{"function":"GetSystemStats","Args":[]}'

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Chaincode is working!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Chaincode test failed (may need initialization)" -ForegroundColor Yellow
}

Write-Host "Chaincode deployment complete!" -ForegroundColor Green
Write-Host "Your Fabric network is now ready to use!" -ForegroundColor Cyan

