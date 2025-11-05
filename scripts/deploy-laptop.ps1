# TrustChain LTO - Laptop Deployment Script

Write-Host "TrustChain LTO Laptop Deployment" -ForegroundColor Blue
Write-Host "===================================" -ForegroundColor Blue

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.laptop.yml down

# Remove old images (optional)
if ($args -contains "--clean") {
    Write-Host "Cleaning up old images..." -ForegroundColor Yellow
    docker system prune -f
}

# Build and start services
Write-Host "Building and starting services..." -ForegroundColor Yellow
docker-compose -f docker-compose.laptop.yml up -d --build

# Wait for services to start
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check health
Write-Host "Checking service health..." -ForegroundColor Yellow
& ".\scripts\health-check-laptop.ps1"

Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "Access the application at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Admin panel: http://localhost:3001/admin-dashboard.html" -ForegroundColor Cyan
