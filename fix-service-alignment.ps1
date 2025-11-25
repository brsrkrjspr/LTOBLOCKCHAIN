# TrustChain LTO - Service Alignment Fix Script
# Fixes common alignment issues automatically

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service Alignment Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$fixed = @()

# ============================================
# 1. FIX DATABASE SCHEMA
# ============================================
Write-Host "1. Fixing Database Schema..." -ForegroundColor Yellow

# Check if ipfs_cid column exists
$ipfsCidCheck = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='documents' AND column_name='ipfs_cid';" 2>&1
$ipfsCidCheck = $ipfsCidCheck.ToString().Trim()

if ($ipfsCidCheck -ne "ipfs_cid") {
    Write-Host "  Adding ipfs_cid column..." -ForegroundColor Cyan
    docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);" 2>&1 | Out-Null
    Write-Host "  ipfs_cid column: ADDED" -ForegroundColor Green
    $fixed += "Added ipfs_cid column to documents table"
} else {
    Write-Host "  ipfs_cid column: Already exists" -ForegroundColor Green
}

# Check if index exists
$indexCheck = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT indexname FROM pg_indexes WHERE indexname='idx_documents_ipfs_cid';" 2>&1
$indexCheck = $indexCheck.ToString().Trim()

if ($indexCheck -ne "idx_documents_ipfs_cid") {
    Write-Host "  Adding idx_documents_ipfs_cid index..." -ForegroundColor Cyan
    docker exec postgres psql -U lto_user -d lto_blockchain -c "CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);" 2>&1 | Out-Null
    Write-Host "  idx_documents_ipfs_cid index: ADDED" -ForegroundColor Green
    $fixed += "Added idx_documents_ipfs_cid index"
} else {
    Write-Host "  idx_documents_ipfs_cid index: Already exists" -ForegroundColor Green
}

Write-Host ""

# ============================================
# 2. FIX IPFS CONFIGURATION
# ============================================
Write-Host "2. Fixing IPFS Configuration..." -ForegroundColor Yellow

# Check if IPFS container is running
$ipfsRunning = docker ps | Select-String "ipfs"
if (-not $ipfsRunning) {
    Write-Host "  Starting IPFS container..." -ForegroundColor Cyan
    docker-compose -f docker-compose.core.yml up -d ipfs 2>&1 | Out-Null
    Start-Sleep -Seconds 10
    Write-Host "  IPFS container: STARTED" -ForegroundColor Green
    $fixed += "Started IPFS container"
} else {
    Write-Host "  IPFS container: Running" -ForegroundColor Green
}

# Check API configuration
$apiAddr = docker exec ipfs ipfs config Addresses.API 2>&1
if ($apiAddr -notmatch "0.0.0.0") {
    Write-Host "  Configuring IPFS API address..." -ForegroundColor Cyan
    docker exec ipfs ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001 2>&1 | Out-Null
    docker exec ipfs ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080 2>&1 | Out-Null
    
    # Configure CORS
    docker exec ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]' 2>&1 | Out-Null
    docker exec ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET", "OPTIONS"]' 2>&1 | Out-Null
    docker exec ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["*"]' 2>&1 | Out-Null
    docker exec ipfs ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]' 2>&1 | Out-Null
    
    Write-Host "  Restarting IPFS..." -ForegroundColor Cyan
    docker restart ipfs 2>&1 | Out-Null
    Start-Sleep -Seconds 10
    Write-Host "  IPFS configuration: UPDATED" -ForegroundColor Green
    $fixed += "Updated IPFS API and Gateway configuration"
} else {
    Write-Host "  IPFS API configuration: Correct" -ForegroundColor Green
}

# Verify IPFS is accessible
Start-Sleep -Seconds 5
try {
    $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5
    Write-Host "  IPFS API: ACCESSIBLE (v$($ipfsVersion.Version))" -ForegroundColor Green
} catch {
    Write-Host "  IPFS API: Still not accessible - may need manual intervention" -ForegroundColor Yellow
    Write-Host "    Check: docker logs ipfs --tail 50" -ForegroundColor Cyan
}

Write-Host ""

# ============================================
# 3. VERIFY BACKEND ALIGNMENT
# ============================================
Write-Host "3. Verifying Backend Alignment..." -ForegroundColor Yellow

# Check if backend is running
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health/detailed" -Method GET -TimeoutSec 5
    Write-Host "  Backend: Running" -ForegroundColor Green
    
    # Check storage mode alignment
    if ($health.services.storage.mode -eq "ipfs") {
        if ($health.services.storage.ipfsAvailable) {
            Write-Host "  Storage Alignment: CORRECT (IPFS mode, IPFS available)" -ForegroundColor Green
        } else {
            Write-Host "  Storage Alignment: MISMATCH (IPFS mode but IPFS not available)" -ForegroundColor Red
            Write-Host "    Backend needs to be restarted to detect IPFS" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Storage Alignment: OK (using $($health.services.storage.mode) mode)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Backend: Not running" -ForegroundColor Yellow
    Write-Host "    Start with: node server.js" -ForegroundColor Cyan
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
if ($fixed.Count -gt 0) {
    Write-Host "FIXES APPLIED:" -ForegroundColor Green
    foreach ($fix in $fixed) {
        Write-Host "  - $fix" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart backend if it's running: Stop and run 'node server.js'" -ForegroundColor White
    Write-Host "  2. Run verification: .\verify-complete-alignment.ps1" -ForegroundColor White
    Write-Host "  3. Test document upload via registration wizard" -ForegroundColor White
} else {
    Write-Host "No fixes needed - system appears aligned" -ForegroundColor Green
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

