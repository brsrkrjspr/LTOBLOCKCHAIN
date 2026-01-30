$ErrorActionPreference = "Stop"

Write-Host "=========================================="
Write-Host "Start Chaincode Container (CCAAS)"
Write-Host "=========================================="
Write-Host ""

# Set working directory to project root
$ScriptPath = $MyInvocation.MyCommand.Path
$Root = Split-Path (Split-Path $ScriptPath -Parent) -Parent
Set-Location $Root

$ChaincodeService = "chaincode-vehicle-reg"

Write-Host "Step 1: Querying installed chaincode package ID..."

# Command to query installed chaincode from the peer container
$QueryCommand = "export CORE_PEER_LOCALMSPID=LTOMSP; " +
"export CORE_PEER_TLS_ENABLED=true; " +
"export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt; " +
"export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp; " +
"export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051; " +
"peer lifecycle chaincode queryinstalled 2>&1"

# Execute command inside CLI container
try {
    $QueryOutput = docker exec cli bash -c $QueryCommand
}
catch {
    Write-Error "Failed to execute query command in CLI container. Ensure 'cli' container is running."
}

# Parse output for Package ID
# Format: Package ID: vehicle-registration_1.0:abc123..., Label: vehicle-registration_1.0
$PackageId = $null
if ($QueryOutput -match "Package ID: (vehicle-registration_1\.0:[a-zA-Z0-9]+)") {
    $PackageId = $matches[1]
}

if (-not $PackageId) {
    Write-Warning "Could not find vehicle-registration package in installed chaincodes."
    Write-Host "Output from peer:"
    Write-Host $QueryOutput
    Write-Host ""
    Write-Host "Possible reasons:"
    Write-Host "1. Chaincode is not installed. Run scripts/install-chaincode-ccaas.sh first."
    Write-Host "2. Peer is not running."
    exit 1
}

Write-Host "Found Package ID: $PackageId"
Write-Host ""

Write-Host "Step 2: Starting chaincode container..."

# Check if container is already running
$ContainerStatus = docker inspect -f '{{.State.Running}}' $ChaincodeService 2>$null
if ($ContainerStatus -eq "true") {
    Write-Host "Container $ChaincodeService is already running. Restarting with correct Package ID..."
    docker compose -f docker-compose.unified.yml stop $ChaincodeService
    docker compose -f docker-compose.unified.yml rm -f $ChaincodeService
}

# Start container with env var
$Env:CHAINCODE_PACKAGE_ID = $PackageId
docker compose -f docker-compose.unified.yml up -d $ChaincodeService

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Chaincode container started successfully!"
    Write-Host "ID: $PackageId"
}
else {
    Write-Error 'Failed to start chaincode container.'
    exit 1
}
