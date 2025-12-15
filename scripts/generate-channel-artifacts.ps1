# TrustChain LTO - Generate Fabric Channel Artifacts
# Uses Docker to avoid installing Fabric binaries

Write-Host "📦 Generating Hyperledger Fabric channel artifacts..." -ForegroundColor Cyan

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

# Create channel-artifacts directory
$channelDir = "fabric-network\channel-artifacts"
if (Test-Path $channelDir) {
    Write-Host "⚠️  Channel artifacts directory exists. Removing old artifacts..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $channelDir
}

New-Item -ItemType Directory -Force -Path $channelDir | Out-Null
Write-Host "✅ Created channel-artifacts directory" -ForegroundColor Green

# Copy configtx.yaml to fabric-network directory
Copy-Item "configtx.yaml" "fabric-network\configtx.yaml"

# Set FABRIC_CFG_PATH environment variable
$env:FABRIC_CFG_PATH = "${PWD}\fabric-network"

Write-Host "🔧 Generating genesis block..." -ForegroundColor Cyan

# Generate genesis block using Docker
docker run --rm `
    -v "${PWD}\fabric-network:/workspace" `
    -w /workspace `
    -e FABRIC_CFG_PATH=/workspace `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile LTOGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate genesis block" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Genesis block generated" -ForegroundColor Green

Write-Host "🔧 Generating channel creation transaction..." -ForegroundColor Cyan

# Generate channel creation transaction
docker run --rm `
    -v "${PWD}\fabric-network:/workspace" `
    -w /workspace `
    -e FABRIC_CFG_PATH=/workspace `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile LTOChannel -channelID ltochannel -outputCreateChannelTx ./channel-artifacts/channel.tx

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate channel transaction" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Channel transaction generated" -ForegroundColor Green

Write-Host "🔧 Generating anchor peer update..." -ForegroundColor Cyan

# Generate anchor peer update
docker run --rm `
    -v "${PWD}\fabric-network:/workspace" `
    -w /workspace `
    -e FABRIC_CFG_PATH=/workspace `
    hyperledger/fabric-tools:2.5 `
    configtxgen -profile LTOChannel -channelID ltochannel -outputAnchorPeersUpdate ./channel-artifacts/LTOMSPanchors.tx -asOrg LTOMSP

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate anchor peer update" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Anchor peer update generated" -ForegroundColor Green

# Clean up temporary file
Remove-Item "fabric-network\configtx.yaml" -ErrorAction SilentlyContinue

Write-Host "🎉 Channel artifacts generation complete!" -ForegroundColor Green
Write-Host "📁 Artifacts saved to: fabric-network\channel-artifacts" -ForegroundColor Cyan

