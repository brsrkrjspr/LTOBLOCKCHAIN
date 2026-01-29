# TrustChain LTO - Fabric CA Admin Enrollment Script (PowerShell)
# Enrolls bootstrap CA admins for LTO, HPG, and Insurance organizations
# This script should be run AFTER Fabric CA services are started

Write-Host "🔐 Fabric CA Admin Enrollment Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env file
$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# CA URLs (defaults if not in .env)
$caLtoUrl = if ($env:FABRIC_CA_LTO_URL) { $env:FABRIC_CA_LTO_URL } else { "https://ca-lto:7054" }
$caHpgUrl = if ($env:FABRIC_CA_HPG_URL) { $env:FABRIC_CA_HPG_URL } else { "https://ca-hpg:7054" }
$caInsuranceUrl = if ($env:FABRIC_CA_INSURANCE_URL) { $env:FABRIC_CA_INSURANCE_URL } else { "https://ca-insurance:7054" }

# CA Admin credentials
$caAdminUser = if ($env:FABRIC_CA_ADMIN_USERNAME) { $env:FABRIC_CA_ADMIN_USERNAME } else { "admin" }
$caAdminPass = if ($env:FABRIC_CA_ADMIN_PASSWORD) { $env:FABRIC_CA_ADMIN_PASSWORD } else { "adminpw" }

# Wallet path
$walletPath = if ($env:WALLET_PATH) { $env:WALLET_PATH } else { "./wallet" }

Write-Host "📁 Wallet path: $walletPath" -ForegroundColor Yellow
Write-Host ""

# Function to enroll CA admin
function Enroll-CaAdmin {
    param(
        [string]$OrgName,
        [string]$CaUrl,
        [string]$MspId,
        [string]$AdminUsername
    )
    
    Write-Host "🔐 Enrolling CA admin for $OrgName..." -ForegroundColor Green
    Write-Host "   CA URL: $CaUrl"
    Write-Host "   MSP ID: $MspId"
    Write-Host "   Admin username: $AdminUsername"
    Write-Host ""
    Write-Host "   ⚠️  Note: This script is a template." -ForegroundColor Yellow
    Write-Host "   ⚠️  Actual enrollment should be done via:" -ForegroundColor Yellow
    Write-Host "       1. fabric-ca-client CLI (if available)"
    Write-Host "       2. Node.js script using fabric-ca-client SDK"
    Write-Host "       3. Backend enrollment service (fabricEnrollmentService.js)"
    Write-Host ""
    Write-Host "   Example fabric-ca-client command:"
    Write-Host "   fabric-ca-client enroll -u https://${caAdminUser}:${caAdminPass}@$CaUrl \"
    Write-Host "     --caname ca-$OrgName \"
    Write-Host "     --mspdir $walletPath/$AdminUsername"
    Write-Host ""
}

# Enroll LTO CA admin
Enroll-CaAdmin -OrgName "lto" -CaUrl $caLtoUrl -MspId "LTOMSP" -AdminUsername "admin-lto"

# Enroll HPG CA admin
Enroll-CaAdmin -OrgName "hpg" -CaUrl $caHpgUrl -MspId "HPGMSP" -AdminUsername "admin-hpg"

# Enroll Insurance CA admin
Enroll-CaAdmin -OrgName "insurance" -CaUrl $caInsuranceUrl -MspId "InsuranceMSP" -AdminUsername "admin-insurance"

Write-Host "✅ CA admin enrollment script completed" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Ensure Fabric CA services are running (docker-compose up ca-lto ca-hpg ca-insurance)"
Write-Host "   2. Run actual enrollment using fabric-ca-client or Node.js SDK"
Write-Host "   3. Verify identities exist in wallet: $walletPath"
Write-Host "   4. Test connection: node scripts/test-fabric-network.js"
