# TrustChain LTO - Complete Service Alignment Verification
# Verifies database schema, service connections, and code alignment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Service Alignment Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true
$issues = @()

# ============================================
# 1. DATABASE SCHEMA VERIFICATION
# ============================================
Write-Host "1. DATABASE SCHEMA" -ForegroundColor Yellow
Write-Host "-------------------" -ForegroundColor Yellow

# Check PostgreSQL connection
$pgStatus = docker exec postgres pg_isready -U lto_user -d lto_blockchain 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PostgreSQL: Connected" -ForegroundColor Green
    
    # Check if ipfs_cid column exists
    $ipfsCidCheck = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='documents' AND column_name='ipfs_cid';" 2>&1
    $ipfsCidCheck = $ipfsCidCheck.ToString().Trim()
    if ($ipfsCidCheck -eq "ipfs_cid") {
        Write-Host "  ipfs_cid column: EXISTS" -ForegroundColor Green
    } else {
        Write-Host "  ipfs_cid column: MISSING" -ForegroundColor Red
        $issues += "Missing ipfs_cid column in documents table"
        $allGood = $false
    }
    
    # Check index
    $indexCheck = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT indexname FROM pg_indexes WHERE indexname='idx_documents_ipfs_cid';" 2>&1
    $indexCheck = $indexCheck.ToString().Trim()
    if ($indexCheck -eq "idx_documents_ipfs_cid") {
        Write-Host "  idx_documents_ipfs_cid index: EXISTS" -ForegroundColor Green
    } else {
        Write-Host "  idx_documents_ipfs_cid index: MISSING" -ForegroundColor Yellow
    }
    
    # Count records
    $vehicleCount = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM vehicles;" 2>&1
    $docCount = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM documents;" 2>&1
    $ipfsDocCount = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM documents WHERE ipfs_cid IS NOT NULL;" 2>&1
    Write-Host "  Records: $($vehicleCount.Trim()) vehicles, $($docCount.Trim()) documents ($($ipfsDocCount.Trim()) with IPFS CIDs)" -ForegroundColor Cyan
} else {
    Write-Host "  PostgreSQL: NOT ACCESSIBLE" -ForegroundColor Red
    $issues += "PostgreSQL not accessible"
    $allGood = $false
}

Write-Host ""

# ============================================
# 2. IPFS SERVICE VERIFICATION
# ============================================
Write-Host "2. IPFS SERVICE" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow

try {
    $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5
    Write-Host "  IPFS API: Connected (v$($ipfsVersion.Version))" -ForegroundColor Green
    
    # Check API configuration
    $apiAddr = docker exec ipfs ipfs config Addresses.API 2>&1
    if ($apiAddr -match "0.0.0.0") {
        Write-Host "  API Address: Correctly configured (0.0.0.0)" -ForegroundColor Green
    } else {
        Write-Host "  API Address: May not be accessible from host" -ForegroundColor Yellow
        $issues += "IPFS API not configured for host access"
    }
    
    # Check pinned files
    try {
        $pins = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/pin/ls" -Method POST -TimeoutSec 5
        $pinCount = ($pins.Keys | Measure-Object).Count
        Write-Host "  Pinned Files: $pinCount" -ForegroundColor Cyan
    } catch {
        Write-Host "  Pinned Files: Could not retrieve" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  IPFS API: NOT ACCESSIBLE" -ForegroundColor Red
    $issues += "IPFS service not accessible"
    $allGood = $false
}

Write-Host ""

# ============================================
# 3. BACKEND APPLICATION VERIFICATION
# ============================================
Write-Host "3. BACKEND APPLICATION" -ForegroundColor Yellow
Write-Host "----------------------" -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health/detailed" -Method GET -TimeoutSec 5
    Write-Host "  Backend: Running" -ForegroundColor Green
    Write-Host "    Database: $($health.services.database.status)" -ForegroundColor $(if ($health.services.database.status -eq 'connected') { 'Green' } else { 'Red' })
    Write-Host "    Blockchain: $($health.services.blockchain.status) ($($health.services.blockchain.mode))" -ForegroundColor $(if ($health.services.blockchain.status -eq 'connected') { 'Green' } else { 'Yellow' })
    Write-Host "    Storage: $($health.services.storage.status) ($($health.services.storage.mode))" -ForegroundColor $(if ($health.services.storage.status -eq 'connected') { 'Green' } else { 'Yellow' })
    
    if ($health.services.database.status -ne 'connected') {
        $issues += "Backend cannot connect to database"
        $allGood = $false
    }
    
    if ($health.services.storage.status -ne 'connected' -and $health.services.storage.mode -eq 'ipfs') {
        $issues += "Backend cannot connect to IPFS (required for STORAGE_MODE=ipfs)"
        $allGood = $false
    }
} catch {
    Write-Host "  Backend: NOT RUNNING" -ForegroundColor Red
    $issues += "Backend application not running"
    $allGood = $false
}

Write-Host ""

# ============================================
# 4. CODE-SERVICE ALIGNMENT VERIFICATION
# ============================================
Write-Host "4. CODE-SERVICE ALIGNMENT" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow

# Check .env configuration
if (Test-Path .env) {
    $envContent = Get-Content .env
    $storageMode = ($envContent | Select-String "STORAGE_MODE")
    $blockchainMode = ($envContent | Select-String "BLOCKCHAIN_MODE")
    $dbHost = ($envContent | Select-String "DB_HOST")
    
    if ($storageMode) {
        $storageMode = $storageMode.ToString().Split("=")[1].Trim()
        Write-Host "  STORAGE_MODE: $storageMode" -ForegroundColor Cyan
        
        if ($storageMode -eq "ipfs") {
            try {
                $ipfsTest = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 2 -ErrorAction Stop
                Write-Host "    IPFS Alignment: CORRECT (IPFS accessible)" -ForegroundColor Green
            } catch {
                Write-Host "    IPFS Alignment: MISMATCH (STORAGE_MODE=ipfs but IPFS not accessible)" -ForegroundColor Red
                $issues += "STORAGE_MODE=ipfs but IPFS service not accessible"
                $allGood = $false
            }
        } else {
            Write-Host "    IPFS Alignment: OK (using $storageMode mode)" -ForegroundColor Green
        }
    }
    
    if ($blockchainMode) {
        $blockchainMode = $blockchainMode.ToString().Split("=")[1].Trim()
        Write-Host "  BLOCKCHAIN_MODE: $blockchainMode" -ForegroundColor Cyan
    }
    
    if ($dbHost) {
        $dbHost = $dbHost.ToString().Split("=")[1].Trim()
        Write-Host "  DB_HOST: $dbHost" -ForegroundColor Cyan
        if ($dbHost -ne "localhost" -and $dbHost -ne "127.0.0.1" -and $dbHost -ne "postgres") {
            Write-Host "    Database Alignment: WARNING (should be 'localhost' or 'postgres')" -ForegroundColor Yellow
        } else {
            Write-Host "    Database Alignment: CORRECT" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  .env file: NOT FOUND" -ForegroundColor Red
    $issues += ".env file not found"
    $allGood = $false
}

Write-Host ""

# ============================================
# 5. BACKEND CODE VERIFICATION
# ============================================
Write-Host "5. BACKEND CODE ALIGNMENT" -ForegroundColor Yellow
Write-Host "-------------------------" -ForegroundColor Yellow

# Check if backend code uses ipfs_cid
$documentsRoute = Get-Content "backend/routes/documents.js" -Raw -ErrorAction SilentlyContinue
if ($documentsRoute -match "ipfs_cid|ipfsCid") {
    Write-Host "  documents.js: Uses ipfs_cid" -ForegroundColor Green
} else {
    Write-Host "  documents.js: May not use ipfs_cid" -ForegroundColor Yellow
}

$dbServices = Get-Content "backend/database/services.js" -Raw -ErrorAction SilentlyContinue
if ($dbServices -match "ipfs_cid|ipfsCid") {
    Write-Host "  services.js: Uses ipfs_cid" -ForegroundColor Green
} else {
    Write-Host "  services.js: May not use ipfs_cid" -ForegroundColor Yellow
}

$storageService = Get-Content "backend/services/storageService.js" -Raw -ErrorAction SilentlyContinue
if ($storageService -match "ipfs|IPFS") {
    Write-Host "  storageService.js: Uses IPFS" -ForegroundColor Green
} else {
    Write-Host "  storageService.js: May not use IPFS" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# 6. INTEGRATION TEST
# ============================================
Write-Host "6. INTEGRATION TEST" -ForegroundColor Yellow
Write-Host "-------------------" -ForegroundColor Yellow

# Test document retrieval flow
try {
    # Get a document with IPFS CID from database
    $testDoc = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT id, filename, ipfs_cid FROM documents WHERE ipfs_cid IS NOT NULL LIMIT 1;" 2>&1
    $testDoc = $testDoc.ToString().Trim()
    
    if ($testDoc -and $testDoc -ne "") {
        Write-Host "  Test Document with IPFS CID: Found" -ForegroundColor Green
        $parts = $testDoc -split '\|'
        if ($parts.Length -ge 3) {
            $docId = $parts[0].Trim()
            $cid = $parts[2].Trim()
            Write-Host "    Document ID: $docId" -ForegroundColor Cyan
            Write-Host "    IPFS CID: $cid" -ForegroundColor Cyan
            
            # Test IPFS retrieval
            try {
                $ipfsTest = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/pin/ls?arg=$cid" -Method POST -TimeoutSec 5
                Write-Host "    IPFS Retrieval: SUCCESS" -ForegroundColor Green
            } catch {
                Write-Host "    IPFS Retrieval: FAILED (CID may not be pinned)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  Test Document: No documents with IPFS CIDs found" -ForegroundColor Yellow
        Write-Host "    (This is OK if no documents have been uploaded yet)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  Integration Test: Could not run" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "STATUS: ALL SYSTEMS ALIGNED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your system is ready for:" -ForegroundColor Cyan
    Write-Host "  - Vehicle registration with document uploads" -ForegroundColor White
    Write-Host "  - Document storage in IPFS (if STORAGE_MODE=ipfs)" -ForegroundColor White
    Write-Host "  - Document viewing from application records" -ForegroundColor White
    Write-Host "  - Blockchain integration (if BLOCKCHAIN_MODE=fabric)" -ForegroundColor White
} else {
    Write-Host "STATUS: ISSUES FOUND" -ForegroundColor Red
    Write-Host ""
    Write-Host "Issues to fix:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Run the suggested fixes above to resolve issues." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

