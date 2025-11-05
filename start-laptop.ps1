# TrustChain LTO - Quick Start Script

Write-Host "Starting TrustChain LTO..." -ForegroundColor Blue

# Check if already running
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "Application is already running" -ForegroundColor Green
    Write-Host "Access at: http://localhost:3001" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "Starting services..." -ForegroundColor Yellow
}

# Start services
docker-compose -f docker-compose.laptop.yml up -d

# Wait and check
Start-Sleep -Seconds 20
& ".\scripts\health-check-laptop.ps1"
