# TrustChain LTO Server Startup Script
Write-Host "========================================" -ForegroundColor Green
Write-Host "🚀 Starting TrustChain LTO Server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Cyan

# Try to find Node.js in common locations
$nodePaths = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe",
    "$env:APPDATA\npm\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
)

$nodeExe = $null
foreach ($path in $nodePaths) {
    if (Test-Path $path) {
        $nodeExe = $path
        break
    }
}

# Try to get node from PATH
if (-not $nodeExe) {
    try {
        $nodeExe = (Get-Command node -ErrorAction Stop).Source
    } catch {
        # Node not in PATH
    }
}

if ($nodeExe) {
    $nodeVersion = & $nodeExe --version
    Write-Host "✅ Node.js found: $nodeExe" -ForegroundColor Green
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    $env:PATH = "$(Split-Path $nodeExe);$env:PATH"
} else {
    Write-Host "❌ Node.js not found!" -ForegroundColor Red
    Write-Host "Installing Node.js via winget..." -ForegroundColor Yellow
    try {
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        Write-Host "✅ Node.js installed! Refreshing PATH..." -ForegroundColor Green
        $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Start-Sleep -Seconds 3
        $nodeExe = (Get-Command node -ErrorAction Stop).Source
        Write-Host "✅ Node.js ready: $nodeExe" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install Node.js automatically." -ForegroundColor Red
        Write-Host "Please install Node.js manually from: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
}

# Check if port is in use
Write-Host "`nChecking port 3001..." -ForegroundColor Cyan
$portInUse = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  Port 3001 is already in use!" -ForegroundColor Yellow
    Write-Host "   Stopping existing processes..." -ForegroundColor Yellow
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Check dependencies
Write-Host "`nChecking dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start server
Write-Host "`nStarting server..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Start server in current window
if ($nodeExe) {
    & $nodeExe server.js
} else {
    node server.js
}

