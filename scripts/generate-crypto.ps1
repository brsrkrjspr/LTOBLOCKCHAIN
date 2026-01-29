# TrustChain LTO - Generate Fabric Cryptographic Materials
# Uses Docker to avoid installing Fabric binaries

Write-Host "🔐 Generating Hyperledger Fabric cryptographic materials..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Create directories
$cryptoDir = "fabric-network\crypto-config"
if (Test-Path $cryptoDir) {
    Write-Host "⚠️  Crypto directory exists. Removing old materials..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $cryptoDir
}

New-Item -ItemType Directory -Force -Path $cryptoDir | Out-Null
Write-Host "✅ Created crypto-config directory" -ForegroundColor Green

# Use cryptogen via Docker
Write-Host "🔧 Generating certificates using Docker..." -ForegroundColor Cyan

# Copy crypto-config.yaml to a location Docker can access
# Check multiple possible locations
if (Test-Path "config\crypto-config.yaml") {
    Copy-Item "config\crypto-config.yaml" "fabric-network\crypto-config.yaml"
    Write-Host "✅ Copied crypto-config.yaml from config/" -ForegroundColor Green
} elseif (Test-Path "crypto-config.yaml") {
    Copy-Item "crypto-config.yaml" "fabric-network\crypto-config.yaml"
    Write-Host "✅ Copied crypto-config.yaml from root" -ForegroundColor Green
} else {
    Write-Host "❌ crypto-config.yaml not found in config/ or root directory" -ForegroundColor Red
    exit 1
}

# Run cryptogen in Docker container
docker run --rm `
    -v "${PWD}\fabric-network:/workspace" `
    -w /workspace `
    hyperledger/fabric-tools:2.5 `
    cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cryptographic materials generated successfully!" -ForegroundColor Green
    Write-Host "📁 Materials saved to: fabric-network\crypto-config" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to generate cryptographic materials" -ForegroundColor Red
    exit 1
}

# Clean up temporary file
Remove-Item "fabric-network\crypto-config.yaml" -ErrorAction SilentlyContinue

Write-Host "Crypto generation complete!" -ForegroundColor Green

