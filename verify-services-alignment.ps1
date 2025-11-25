# TrustChain LTO - Service Alignment Verification Script
# Verifies that all services are properly configured and aligned with code expectations

Write-Host "🔍 Verifying Service Alignment..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$allGood = $true

# 1. Check PostgreSQL
Write-Host "`n📦 Checking PostgreSQL..." -ForegroundColor Yellow
$pgStatus = docker exec postgres pg_isready -U lto_user -d lto_blockchain 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL: Connected" -ForegroundColor Green
    
    # Verify schema
    $hasIpfsCid = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='ipfs_cid';" 2>&1
    if ($hasIpfsCid -match "1") {
        Write-Host "✅ PostgreSQL Schema: ipfs_cid column exists" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL Schema: Missing ipfs_cid column" -ForegroundColor Red
        Write-Host "   Run: docker exec postgres psql -U lto_user -d lto_blockchain -c `"ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);`"" -ForegroundColor Yellow
        $allGood = $false
    }
    
    # Check table counts
    $vehicleCount = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM vehicles;" 2>&1
    $docCount = docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM documents;" 2>&1
    Write-Host "   Vehicles: $($vehicleCount.Trim()) | Documents: $($docCount.Trim())" -ForegroundColor Cyan
} else {
    Write-Host "❌ PostgreSQL: Not accessible" -ForegroundColor Red
    Write-Host "   Check: docker ps | findstr postgres" -ForegroundColor Yellow
    $allGood = $false
}

# 2. Check IPFS
Write-Host "`n🌐 Checking IPFS..." -ForegroundColor Yellow
try {
    $ipfsVersion = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 5
    Write-Host "✅ IPFS: Connected (Version $($ipfsVersion.Version))" -ForegroundColor Green
    
    # Check API address configuration
    $apiAddr = docker exec ipfs ipfs config Addresses.API 2>&1
    if ($apiAddr -match "0.0.0.0") {
        Write-Host "✅ IPFS Config: API accessible from host ($apiAddr)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ IPFS Config: API may not be accessible from host ($apiAddr)" -ForegroundColor Yellow
        Write-Host "   Run: docker exec ipfs ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001" -ForegroundColor Yellow
    }
    
    # Check Gateway configuration
    $gatewayAddr = docker exec ipfs ipfs config Addresses.Gateway 2>&1
    if ($gatewayAddr -match "0.0.0.0") {
        Write-Host "✅ IPFS Config: Gateway accessible from host ($gatewayAddr)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ IPFS Config: Gateway may not be accessible ($gatewayAddr)" -ForegroundColor Yellow
    }
    
    # Check pinned files
    try {
        $pins = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/pin/ls" -Method POST -TimeoutSec 5
        $pinCount = ($pins.Keys | Measure-Object).Count
        Write-Host "   Pinned Files: $pinCount" -ForegroundColor Cyan
    } catch {
        Write-Host "   Could not retrieve pin list" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ IPFS: Not accessible - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Check: docker ps | findstr ipfs" -ForegroundColor Yellow
    Write-Host "   Check: docker logs ipfs --tail 20" -ForegroundColor Yellow
    $allGood = $false
}

# 3. Check Hyperledger Fabric (if enabled)
Write-Host "`n⛓️ Checking Hyperledger Fabric..." -ForegroundColor Yellow
if (Test-Path .env) {
    $envContent = Get-Content .env
    $blockchainMode = ($envContent | Select-String "BLOCKCHAIN_MODE")
    if ($blockchainMode) {
        $blockchainMode = $blockchainMode.ToString().Split("=")[1].Trim()
        Write-Host "   Mode: $blockchainMode" -ForegroundColor Cyan
        
        if ($blockchainMode -eq "fabric") {
            $peerRunning = docker ps | Select-String "peer0"
            if ($peerRunning) {
                Write-Host "✅ Fabric Peer: Running" -ForegroundColor Green
                
                # Check if peer can be queried
                try {
                    $peerStatus = docker exec peer0.lto.gov.ph peer node status 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ Fabric Peer: Healthy" -ForegroundColor Green
                    } else {
                        Write-Host "⚠️ Fabric Peer: Running but may not be ready" -ForegroundColor Yellow
                    }
                } catch {
                    Write-Host "⚠️ Could not check peer status" -ForegroundColor Yellow
                }
            } else {
                Write-Host "❌ Fabric Peer: Not running" -ForegroundColor Red
                Write-Host "   Start with: docker-compose -f docker-compose.fabric.yml up -d" -ForegroundColor Yellow
                $allGood = $false
            }
            
            # Check CouchDB
            $couchRunning = docker ps | Select-String "couchdb"
            if ($couchRunning) {
                Write-Host "✅ CouchDB: Running" -ForegroundColor Green
            } else {
                Write-Host "⚠️ CouchDB: Not running" -ForegroundColor Yellow
            }
        } else {
            Write-Host "ℹ️ Fabric: Using mock mode (BLOCKCHAIN_MODE=$blockchainMode)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "⚠️ BLOCKCHAIN_MODE not set in .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ .env file not found" -ForegroundColor Yellow
}

# 4. Check Backend Application
Write-Host "`n🔧 Checking Backend Application..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health/detailed" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend: Running" -ForegroundColor Green
    Write-Host "   Database: $($health.services.database.status)" -ForegroundColor $(if ($health.services.database.status -eq 'connected') { 'Green' } else { 'Red' })
    Write-Host "   Blockchain: $($health.services.blockchain.status) ($($health.services.blockchain.mode))" -ForegroundColor $(if ($health.services.blockchain.status -eq 'connected') { 'Green' } else { 'Yellow' })
    Write-Host "   Storage: $($health.services.storage.status) ($($health.services.storage.mode))" -ForegroundColor $(if ($health.services.storage.status -eq 'connected') { 'Green' } else { 'Yellow' })
    
    if ($health.services.database.status -ne 'connected') {
        $allGood = $false
    }
    if ($health.services.storage.status -ne 'connected' -and $health.services.storage.mode -eq 'ipfs') {
        $allGood = $false
    }
} catch {
    Write-Host "❌ Backend: Not accessible - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Check: Is node server.js running?" -ForegroundColor Yellow
    $allGood = $false
}

# 5. Verify Environment Variables
Write-Host "`n⚙️ Checking Environment Variables..." -ForegroundColor Yellow
if (Test-Path .env) {
    $envContent = Get-Content .env
    $storageMode = ($envContent | Select-String "STORAGE_MODE")
    $blockchainMode = ($envContent | Select-String "BLOCKCHAIN_MODE")
    
    if ($storageMode) {
        $storageMode = $storageMode.ToString().Split("=")[1].Trim()
        Write-Host "   STORAGE_MODE: $storageMode" -ForegroundColor Cyan
        
        if ($storageMode -eq "ipfs") {
            try {
                $ipfsAvailable = Invoke-RestMethod -Uri "http://localhost:5001/api/v0/version" -Method POST -TimeoutSec 2 -ErrorAction Stop
                Write-Host "✅ IPFS is accessible (required for STORAGE_MODE=ipfs)" -ForegroundColor Green
            } catch {
                Write-Host "❌ WARNING: STORAGE_MODE=ipfs but IPFS is not accessible!" -ForegroundColor Red
                Write-Host "   Documents will fail to upload. Fix IPFS or change STORAGE_MODE=auto" -ForegroundColor Yellow
                $allGood = $false
            }
        }
    } else {
        Write-Host "⚠️ STORAGE_MODE not set in .env (defaults to 'auto')" -ForegroundColor Yellow
    }
    
    if ($blockchainMode) {
        $blockchainMode = $blockchainMode.ToString().Split("=")[1].Trim()
        Write-Host "   BLOCKCHAIN_MODE: $blockchainMode" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️ BLOCKCHAIN_MODE not set in .env (defaults to 'mock')" -ForegroundColor Yellow
    }
    
    # Check database connection string
    $dbHost = ($envContent | Select-String "DB_HOST")
    if ($dbHost) {
        $dbHost = $dbHost.ToString().Split("=")[1].Trim()
        Write-Host "   DB_HOST: $dbHost" -ForegroundColor Cyan
        if ($dbHost -ne "localhost" -and $dbHost -ne "127.0.0.1" -and $dbHost -ne "postgres") {
            Write-Host "⚠️ DB_HOST should be 'localhost' or 'postgres' for Docker setup" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    Write-Host "   Create .env from .env.example" -ForegroundColor Yellow
    $allGood = $false
}

# 6. Check Container Network
Write-Host "`n🌐 Checking Container Network..." -ForegroundColor Yellow
$networkExists = docker network ls | Select-String "lto-network"
if ($networkExists) {
    Write-Host "✅ Docker network 'lto-network' exists" -ForegroundColor Green
} else {
    Write-Host "⚠️ Docker network 'lto-network' not found" -ForegroundColor Yellow
    Write-Host "   It will be created when starting docker-compose" -ForegroundColor Cyan
}

# 7. Summary
Write-Host "`n=================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ All Services: Properly Aligned" -ForegroundColor Green
    Write-Host "`nYou can now:" -ForegroundColor Cyan
    Write-Host "  1. Register vehicles via frontend" -ForegroundColor White
    Write-Host "  2. Upload documents (will use IPFS if STORAGE_MODE=ipfs)" -ForegroundColor White
    Write-Host "  3. View documents from application records" -ForegroundColor White
    Write-Host "  4. Query blockchain (if BLOCKCHAIN_MODE=fabric)" -ForegroundColor White
} else {
    Write-Host "⚠️ Some Issues Found" -ForegroundColor Yellow
    Write-Host "`nPlease fix the issues above before proceeding." -ForegroundColor Yellow
    Write-Host "`nCommon fixes:" -ForegroundColor Cyan
    Write-Host "  - Missing ipfs_cid column: Run the ALTER TABLE command shown above" -ForegroundColor White
    Write-Host "  - IPFS not accessible: Check IPFS container and API configuration" -ForegroundColor White
    Write-Host "  - Backend not running: Start with 'node server.js'" -ForegroundColor White
    Write-Host "  - Fabric not running: Start with docker-compose -f docker-compose.fabric.yml up -d" -ForegroundColor White
}

Write-Host ""

