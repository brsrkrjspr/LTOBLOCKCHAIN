# TrustChain LTO - Laptop Backup Script

Write-Host "TrustChain LTO Backup" -ForegroundColor Blue
Write-Host "=======================" -ForegroundColor Blue

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup\$timestamp"

# Create backup directory
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Backup database
Write-Host "Backing up database..." -ForegroundColor Yellow
docker-compose -f docker-compose.laptop.yml exec -T postgres pg_dump -U lto_user -d lto_blockchain > "$backupDir\database.sql"

# Backup blockchain ledger
Write-Host "Backing up blockchain ledger..." -ForegroundColor Yellow
Copy-Item -Path "blockchain-ledger" -Destination "$backupDir\blockchain-ledger" -Recurse

# Backup uploads
Write-Host "Backing up uploads..." -ForegroundColor Yellow
Copy-Item -Path "uploads" -Destination "$backupDir\uploads" -Recurse

# Backup logs
Write-Host "Backing up logs..." -ForegroundColor Yellow
Copy-Item -Path "logs" -Destination "$backupDir\logs" -Recurse

# Create backup info
$backupInfo = @{
    timestamp = $timestamp
    date = Get-Date
    version = "1.0.0"
    size = (Get-ChildItem -Path $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum
}

$backupInfo | ConvertTo-Json | Out-File -FilePath "$backupDir\backup-info.json" -Encoding UTF8

Write-Host "Backup completed: $backupDir" -ForegroundColor Green
Write-Host "Backup size: $([math]::Round($backupInfo.size / 1MB, 2)) MB" -ForegroundColor Cyan
