# TrustChain LTO - Complete Service Verification Script
# Verifies all services are running and functional

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TrustChain LTO - Service Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. PostgreSQL
Write-Host "1. PostgreSQL Database..." -ForegroundColor Yellow
$pgReady = docker exec postgres pg_isready -U lto_user 2>&1
if ($pgReady -like "*accepting connections*") {
    $tables = docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt" 2>&1
    if ($tables -like "*vehicles*") {
        Write-Host "   SUCCESS: PostgreSQL running with tables" -ForegroundColor Green
    } else {
        Write-Host "   WARNING: PostgreSQL running but tables may not be initialized" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ERROR: PostgreSQL not ready" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 2. Redis
Write-Host "2. Redis Cache..." -ForegroundColor Yellow
$redisReady = docker exec redis redis-cli -a redis_password ping 2>&1
if ($redisReady -like "*PONG*") {
    Write-Host "   SUCCESS: Redis running and responding" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Redis not responding" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 3. IPFS
Write-Host "3. IPFS Storage..." -ForegroundColor Yellow
try {
    $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5 2>&1
    Write-Host "   SUCCESS: IPFS running (v$($ipfsVersion.Version))" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: IPFS not accessible - $_" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 4. Fabric CA
Write-Host "4. Hyperledger Fabric CA..." -ForegroundColor Yellow
$caRunning = docker ps --filter "name=ca.lto.gov.ph" --format "{{.Status}}" 2>&1
if ($caRunning -like "*Up*") {
    Write-Host "   SUCCESS: Fabric CA running" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Fabric CA not running" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 5. Fabric Orderers
Write-Host "5. Hyperledger Fabric Orderers..." -ForegroundColor Yellow
$orderersRunning = docker ps --filter "name=orderer" --format "{{.Names}}" 2>&1
$ordererCount = ($orderersRunning -split "`n" | Where-Object { $_ -like "*orderer*" }).Count
if ($ordererCount -ge 3) {
    Write-Host "   SUCCESS: $ordererCount/3 Orderers running" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Only $ordererCount/3 Orderers running" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 6. Fabric Peer
Write-Host "6. Hyperledger Fabric Peer..." -ForegroundColor Yellow
$peerRunning = docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Status}}" 2>&1
if ($peerRunning -like "*Up*") {
    $channels = docker exec peer0.lto.gov.ph peer channel list 2>&1
    if ($channels -like "*ltochannel*") {
        Write-Host "   SUCCESS: Fabric Peer running with channel" -ForegroundColor Green
    } else {
        Write-Host "   WARNING: Fabric Peer running but no channel found" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ERROR: Fabric Peer not running" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 7. CouchDB
Write-Host "7. CouchDB..." -ForegroundColor Yellow
$couchRunning = docker ps --filter "name=couchdb0" --format "{{.Status}}" 2>&1
if ($couchRunning -like "*Up*") {
    Write-Host "   SUCCESS: CouchDB running" -ForegroundColor Green
} else {
    Write-Host "   ERROR: CouchDB not running" -ForegroundColor Red
    $allGood = $false
}
Write-Host ""

# 8. Application Server
Write-Host "8. Application Server..." -ForegroundColor Yellow
try {
    $serverHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 3 2>&1
    Write-Host "   SUCCESS: Application server running" -ForegroundColor Green
} catch {
    Write-Host "   WARNING: Application server not running (start with: node server.js)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "RESULT: All core services are running!" -ForegroundColor Green
} else {
    Write-Host "RESULT: Some services have issues - check above" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

