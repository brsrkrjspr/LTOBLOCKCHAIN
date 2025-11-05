# TrustChain LTO - Extract Hyperledger Fabric Components
# Downloads all necessary open source components

param(
    [switch]$SkipDocker,
    [switch]$SkipNPM,
    [switch]$SkipBinaries
)

Write-Host "📦 Extracting Hyperledger Fabric Components..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

# Step 1: Pull Docker Images
if (-not $SkipDocker) {
    Write-Host "`n🐳 Step 1: Pulling Docker Images..." -ForegroundColor Yellow
    
    $images = @(
        "hyperledger/fabric-peer:2.5",
        "hyperledger/fabric-orderer:2.5",
        "hyperledger/fabric-ca:1.5",
        "hyperledger/fabric-tools:2.5",
        "couchdb:3.2"
    )
    
    foreach ($image in $images) {
        Write-Host "  Pulling $image..." -ForegroundColor Gray
        try {
            docker pull $image
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ $image" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Failed to pull $image" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ Error pulling $image : $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`n✅ Docker images extraction complete" -ForegroundColor Green
} else {
    Write-Host "`nSkipping Docker images (--SkipDocker)" -ForegroundColor Gray
}

# Step 2: Install npm packages
if (-not $SkipNPM) {
    Write-Host "`nStep 2: Installing npm Packages..." -ForegroundColor Yellow
    
    $packages = @(
        "fabric-network@^2.2.19",
        "fabric-ca-client@^2.2.19"
    )
    
    foreach ($package in $packages) {
        Write-Host "  Installing $package..." -ForegroundColor Gray
        try {
            npm install $package --save
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ $package" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Failed to install $package" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ Error installing $package : $_" -ForegroundColor Red
        }
    }
    
    # Check chaincode dependencies
    if (Test-Path "chaincode/vehicle-registration-production/package.json") {
        Write-Host "  Installing chaincode dependencies..." -ForegroundColor Gray
        Push-Location chaincode/vehicle-registration-production
        try {
            npm install
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ Chaincode dependencies installed" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ⚠️  Chaincode dependencies installation failed" -ForegroundColor Yellow
        }
        Pop-Location
    }
    
    Write-Host "`n✅ npm packages extraction complete" -ForegroundColor Green
} else {
    Write-Host "`nSkipping npm packages (--SkipNPM)" -ForegroundColor Gray
}

# Step 3: Download Fabric binaries (optional)
if (-not $SkipBinaries) {
    Write-Host "`n🔧 Step 3: Downloading Fabric Binaries (Optional)..." -ForegroundColor Yellow
    Write-Host "  This step is optional - binaries are only needed for:" -ForegroundColor Gray
    Write-Host "    - Generating crypto material (cryptogen)" -ForegroundColor Gray
    Write-Host "    - Generating network config (configtxgen)" -ForegroundColor Gray
    Write-Host "    - CLI operations (peer command)" -ForegroundColor Gray
    
    $downloadBinaries = Read-Host "  Do you want to download Fabric binaries? (y/n)"
    
    if ($downloadBinaries -eq 'y' -or $downloadBinaries -eq 'Y') {
        Write-Host "  Downloading Fabric binaries..." -ForegroundColor Gray
        Write-Host "  This may take a few minutes..." -ForegroundColor Gray
        
        try {
            # Create fabric-samples directory if it doesn't exist
            $fabricSamplesPath = "$env:USERPROFILE\fabric-samples"
            if (-not (Test-Path $fabricSamplesPath)) {
                New-Item -ItemType Directory -Path $fabricSamplesPath -Force | Out-Null
            }
            
            # Download using official script (Linux/Mac style, need to adapt for Windows)
            Write-Host "  ⚠️  For Windows, you can:" -ForegroundColor Yellow
            Write-Host "    1. Use WSL to run: curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.2" -ForegroundColor Gray
            Write-Host "    2. Or use Docker container with fabric-tools image" -ForegroundColor Gray
            Write-Host "    3. Or download manually from GitHub releases" -ForegroundColor Gray
            
            Write-Host "`n  💡 Recommended: Use Docker fabric-tools container instead" -ForegroundColor Cyan
            Write-Host "     docker run --rm hyperledger/fabric-tools:2.5 peer version" -ForegroundColor Gray
            
        } catch {
            Write-Host "  ❌ Error downloading binaries: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  ⏭️  Skipping binaries download" -ForegroundColor Gray
        Write-Host "  💡 You can use Docker containers for Fabric operations instead" -ForegroundColor Cyan
    }
} else {
    Write-Host "`nSkipping binaries (--SkipBinaries)" -ForegroundColor Gray
}

# Step 4: Verify installation
Write-Host "`n✅ Step 4: Verifying Installation..." -ForegroundColor Yellow

$verification = @{
    "Docker Images" = $false
    "npm Packages" = $false
}

# Check Docker images
if (-not $SkipDocker) {
    try {
        $peerImage = docker images hyperledger/fabric-peer:2.5 --format "{{.Repository}}:{{.Tag}}"
        if ($peerImage) {
            $verification["Docker Images"] = $true
            Write-Host "  ✅ Docker images available" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️  Could not verify Docker images" -ForegroundColor Yellow
    }
}

# Check npm packages
if (-not $SkipNPM) {
    try {
        if (Test-Path "node_modules/fabric-network") {
            $verification["npm Packages"] = $true
            Write-Host "  ✅ npm packages installed" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  npm packages not found in node_modules" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  Could not verify npm packages" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n📊 Extraction Summary" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

foreach ($check in $verification.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "  ✅ $($check.Key): Ready" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $($check.Key): Not verified" -ForegroundColor Yellow
    }
}

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Review extracted components" -ForegroundColor White
Write-Host "2. Continue with network setup (see UPGRADE-TO-HYPERLEDGER-FABRIC.md)" -ForegroundColor White
Write-Host "3. Design your custom components (chaincode, configs, etc.)" -ForegroundColor White

Write-Host "`n🎉 Component extraction completed!" -ForegroundColor Green

