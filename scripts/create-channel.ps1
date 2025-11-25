# TrustChain LTO - Create and Join Channel
# Creates the ltochannel and joins the peer to it

Write-Host "📺 Creating Hyperledger Fabric channel..." -ForegroundColor Cyan

# Check if Fabric network is running
$peerRunning = docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Names}}"
if (-not $peerRunning) {
    Write-Host "❌ Fabric network is not running!" -ForegroundColor Red
    Write-Host "💡 Please run start-fabric-network.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Check if channel artifacts exist
if (-not (Test-Path "fabric-network\channel-artifacts\channel.tx")) {
    Write-Host "❌ Channel transaction not found!" -ForegroundColor Red
    Write-Host "💡 Please run generate-channel-artifacts.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔧 Creating channel 'ltochannel'..." -ForegroundColor Cyan

# Create channel
docker exec cli peer channel create `
    -o orderer1.lto.gov.ph:7050 `
    -c ltochannel `
    -f ./channel-artifacts/channel.tx `
    --tls `
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Channel may already exist, continuing..." -ForegroundColor Yellow
} else {
    Write-Host "✅ Channel created successfully" -ForegroundColor Green
}

Write-Host "🔗 Joining peer to channel..." -ForegroundColor Cyan

# Join peer to channel
docker exec cli peer channel join -b ./channel-artifacts/ltochannel.block

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Peer joined channel successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to join peer to channel" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Updating anchor peers..." -ForegroundColor Cyan

# Update anchor peers
docker exec cli peer channel update `
    -o orderer1.lto.gov.ph:7050 `
    -c ltochannel `
    -f ./channel-artifacts/LTOMSPanchors.tx `
    --tls `
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Anchor peers updated successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Anchor peer update failed (may already be updated)" -ForegroundColor Yellow
}

Write-Host "🎉 Channel setup complete!" -ForegroundColor Green
Write-Host "💡 Next step: Run .\scripts\setup-fabric-wallet.ps1" -ForegroundColor Yellow

