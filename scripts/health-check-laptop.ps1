# TrustChain LTO - Laptop Health Check Script

Write-Host "TrustChain LTO Health Check" -ForegroundColor Blue
Write-Host "=============================" -ForegroundColor Blue

# Check if Docker is running
try {
    docker ps | Out-Null
    Write-Host "SUCCESS: Docker is running" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not running" -ForegroundColor Red
    exit 1
}

# Check application health
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET
    Write-Host "SUCCESS: Application is healthy" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Cyan
    Write-Host "   Version: $($response.version)" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR: Application is not responding" -ForegroundColor Red
}

# Check database connection
try {
    $dbResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/health/database" -Method GET
    Write-Host "SUCCESS: Database is connected" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Database connection failed" -ForegroundColor Red
}

# Check system resources
$totalMem = [math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
$freeMem = [math]::Round((Get-WmiObject -Class Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$memUsage = [math]::Round((($totalMem - $freeMem) / $totalMem) * 100, 2)

Write-Host "System Resources:" -ForegroundColor Yellow
Write-Host "   Total Memory: $totalMem GB" -ForegroundColor Cyan
Write-Host "   Free Memory: $freeMem GB" -ForegroundColor Cyan
Write-Host "   Memory Usage: $memUsage%" -ForegroundColor Cyan

if ($memUsage -gt 90) {
    Write-Host "WARNING: High memory usage detected" -ForegroundColor Yellow
} elseif ($memUsage -gt 80) {
    Write-Host "WARNING: Elevated memory usage" -ForegroundColor Yellow
} else {
    Write-Host "SUCCESS: Memory usage is normal" -ForegroundColor Green
}

Write-Host "Health check completed!" -ForegroundColor Green
