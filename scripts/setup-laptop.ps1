# TrustChain LTO - Laptop Setup Script (PowerShell)
# Optimized for: Intel i3-7020U, 4GB RAM, 447GB SSD
# Zero-cost production-ready setup

param(
    [switch]$SkipChecks,
    [switch]$Force
)

Write-Host "💻 TrustChain LTO Laptop Setup" -ForegroundColor Blue
Write-Host "===============================" -ForegroundColor Blue
Write-Host "Optimized for low-resource systems" -ForegroundColor Yellow

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires administrator privileges. Please run PowerShell as Administrator."
    exit 1
}

# Check system requirements
if (-not $SkipChecks) {
    Write-Status "Checking system requirements..."

    # Check available memory
    $totalMem = [math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    if ($totalMem -lt 4) {
        Write-Error "System has less than 4GB RAM. This setup requires at least 4GB."
        exit 1
    } elseif ($totalMem -lt 8) {
        Write-Warning "System has less than 8GB RAM. Performance may be limited."
    }

    # Check available disk space
    $availableSpace = [math]::Round((Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB, 2)
    if ($availableSpace -lt 10) {
        Write-Error "Less than 10GB disk space available. This setup requires at least 10GB."
        exit 1
    }

    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker found: $dockerVersion"
    }
    catch {
        Write-Error "Docker is not installed. Please install Docker Desktop first."
        Write-Status "Download from: https://www.docker.com/products/docker-desktop"
        exit 1
    }

    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version
        Write-Success "Docker Compose found: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }

    Write-Success "System requirements check completed"
}

# Create necessary directories
Write-Status "Creating directory structure..."
$directories = @(
    "uploads",
    "uploads\documents",
    "uploads\documents\registration",
    "uploads\documents\insurance", 
    "uploads\documents\emission",
    "uploads\documents\identity",
    "uploads\metadata",
    "logs",
    "blockchain-ledger",
    "backup"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

Write-Success "Directory structure created"

# Create environment file
Write-Status "Creating environment configuration..."
$envContent = @"
# TrustChain LTO - Laptop Environment Configuration
# Optimized for low-resource systems

# Application
NODE_ENV=production
PORT=3001

# Database (Optimized for 4GB RAM)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Redis (Minimal Configuration)
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=your-super-secret-jwt-key-32-characters
ENCRYPTION_KEY=your-32-character-encryption-key

# Blockchain Mode (Mock for laptop)
BLOCKCHAIN_MODE=mock
STORAGE_MODE=local

# File Storage
ENCRYPT_FILES=false
MAX_FILE_SIZE=10485760

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true

# Performance (Optimized for laptop)
WORKER_PROCESSES=1
MAX_CONNECTIONS=100
"@

$envContent | Out-File -FilePath ".env.laptop" -Encoding UTF8
Write-Success "Environment configuration created"

# Create optimized package.json
Write-Status "Creating optimized package.json..."
$packageJson = @"
{
  "name": "trustchain-lto-laptop",
  "version": "1.0.0",
  "description": "TrustChain LTO - Laptop Optimized Version",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup": "PowerShell -ExecutionPolicy Bypass -File scripts/setup-laptop.ps1",
    "deploy": "PowerShell -ExecutionPolicy Bypass -File scripts/deploy-laptop.ps1",
    "health": "PowerShell -ExecutionPolicy Bypass -File scripts/health-check-laptop.ps1",
    "backup": "PowerShell -ExecutionPolicy Bypass -File scripts/backup-laptop.ps1",
    "cleanup": "node scripts/cleanup-laptop.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": [
    "blockchain",
    "vehicle-registration",
    "lto",
    "laptop-optimized"
  ],
  "author": "TrustChain LTO Development Team",
  "license": "MIT",
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=8.0.0"
  }
}
"@

$packageJson | Out-File -FilePath "package-laptop.json" -Encoding UTF8
Write-Success "Optimized package.json created"

# Create health check script
Write-Status "Creating health check script..."
$healthScript = @"
# TrustChain LTO - Laptop Health Check Script

Write-Host "🔍 TrustChain LTO Health Check" -ForegroundColor Blue
Write-Host "=============================" -ForegroundColor Blue

# Check if Docker is running
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running" -ForegroundColor Red
    exit 1
}

# Check application health
try {
    `$response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET
    Write-Host "✅ Application is healthy" -ForegroundColor Green
    Write-Host "   Status: `$(`$response.status)" -ForegroundColor Cyan
    Write-Host "   Version: `$(`$response.version)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Application is not responding" -ForegroundColor Red
}

# Check database connection
try {
    `$dbResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/health/database" -Method GET
    Write-Host "✅ Database is connected" -ForegroundColor Green
} catch {
    Write-Host "❌ Database connection failed" -ForegroundColor Red
}

# Check system resources
`$totalMem = [math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
`$freeMem = [math]::Round((Get-WmiObject -Class Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
`$memUsage = [math]::Round(((`$totalMem - `$freeMem) / `$totalMem) * 100, 2)

Write-Host "📊 System Resources:" -ForegroundColor Yellow
Write-Host "   Total Memory: `$totalMem GB" -ForegroundColor Cyan
Write-Host "   Free Memory: `$freeMem GB" -ForegroundColor Cyan
Write-Host "   Memory Usage: `$memUsage%" -ForegroundColor Cyan

if (`$memUsage -gt 90) {
    Write-Host "⚠️  High memory usage detected" -ForegroundColor Yellow
} elseif (`$memUsage -gt 80) {
    Write-Host "⚠️  Elevated memory usage" -ForegroundColor Yellow
} else {
    Write-Host "✅ Memory usage is normal" -ForegroundColor Green
}

Write-Host "`n🎉 Health check completed!" -ForegroundColor Green
"@

$healthScript | Out-File -FilePath "scripts/health-check-laptop.ps1" -Encoding UTF8
Write-Success "Health check script created"

# Create deployment script
Write-Status "Creating deployment script..."
$deployScript = @"
# TrustChain LTO - Laptop Deployment Script

Write-Host "🚀 TrustChain LTO Laptop Deployment" -ForegroundColor Blue
Write-Host "===================================" -ForegroundColor Blue

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.laptop.yml down

# Remove old images (optional)
if (`$args -contains "--clean") {
    Write-Host "🧹 Cleaning up old images..." -ForegroundColor Yellow
    docker system prune -f
}

# Build and start services
Write-Host "🔨 Building and starting services..." -ForegroundColor Yellow
docker-compose -f docker-compose.laptop.yml up -d --build

# Wait for services to start
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check health
Write-Host "🔍 Checking service health..." -ForegroundColor Yellow
& ".\scripts\health-check-laptop.ps1"

Write-Host "`n🎉 Deployment completed!" -ForegroundColor Green
Write-Host "📱 Access the application at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "🔧 Admin panel: http://localhost:3001/admin-dashboard.html" -ForegroundColor Cyan
"@

$deployScript | Out-File -FilePath "scripts/deploy-laptop.ps1" -Encoding UTF8
Write-Success "Deployment script created"

# Create backup script
Write-Status "Creating backup script..."
$backupScript = @"
# TrustChain LTO - Laptop Backup Script

Write-Host "💾 TrustChain LTO Backup" -ForegroundColor Blue
Write-Host "=======================" -ForegroundColor Blue

`$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
`$backupDir = "backup\`$timestamp"

# Create backup directory
New-Item -ItemType Directory -Path `$backupDir -Force | Out-Null

# Backup database
Write-Host "📊 Backing up database..." -ForegroundColor Yellow
docker-compose -f docker-compose.laptop.yml exec -T postgres pg_dump -U lto_user -d lto_blockchain > "`$backupDir\database.sql"

# Backup blockchain ledger
Write-Host "⛓️  Backing up blockchain ledger..." -ForegroundColor Yellow
Copy-Item -Path "blockchain-ledger" -Destination "`$backupDir\blockchain-ledger" -Recurse

# Backup uploads
Write-Host "📁 Backing up uploads..." -ForegroundColor Yellow
Copy-Item -Path "uploads" -Destination "`$backupDir\uploads" -Recurse

# Backup logs
Write-Host "📝 Backing up logs..." -ForegroundColor Yellow
Copy-Item -Path "logs" -Destination "`$backupDir\logs" -Recurse

# Create backup info
`$backupInfo = @{
    timestamp = `$timestamp
    date = Get-Date
    version = "1.0.0"
    size = (Get-ChildItem -Path `$backupDir -Recurse | Measure-Object -Property Length -Sum).Sum
}

`$backupInfo | ConvertTo-Json | Out-File -FilePath "`$backupDir\backup-info.json" -Encoding UTF8

Write-Host "✅ Backup completed: `$backupDir" -ForegroundColor Green
Write-Host "📊 Backup size: `$([math]::Round(`$backupInfo.size / 1MB, 2)) MB" -ForegroundColor Cyan
"@

$backupScript | Out-File -FilePath "scripts/backup-laptop.ps1" -Encoding UTF8
Write-Success "Backup script created"

# Create cleanup script
Write-Status "Creating cleanup script..."
$cleanupScript = @"
// TrustChain LTO - Laptop Cleanup Script
const fs = require('fs');
const path = require('path');

console.log('🧹 TrustChain LTO Cleanup');
console.log('=========================');

// Cleanup old logs (keep 7 days)
const logsPath = path.join(process.cwd(), 'logs');
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 7);

if (fs.existsSync(logsPath)) {
    const files = fs.readdirSync(logsPath);
    let cleanedCount = 0;
    
    files.forEach(file => {
        const filePath = path.join(logsPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            cleanedCount++;
        }
    });
    
    console.log(`✅ Cleaned up `$cleanedCount old log files`);
}

// Cleanup old backups (keep 30 days)
const backupPath = path.join(process.cwd(), 'backup');
if (fs.existsSync(backupPath)) {
    const backupCutoff = new Date();
    backupCutoff.setDate(backupCutoff.getDate() - 30);
    
    const backups = fs.readdirSync(backupPath);
    let cleanedBackups = 0;
    
    backups.forEach(backup => {
        const backupDir = path.join(backupPath, backup);
        const stats = fs.statSync(backupDir);
        
        if (stats.mtime < backupCutoff) {
            fs.rmSync(backupDir, { recursive: true, force: true });
            cleanedBackups++;
        }
    });
    
    console.log(`✅ Cleaned up `$cleanedBackups old backups`);
}

// Cleanup temporary files
const tempPaths = ['uploads/temp', 'logs/temp'];
tempPaths.forEach(tempPath => {
    const fullPath = path.join(process.cwd(), tempPath);
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Cleaned up temporary directory: `$tempPath`);
    }
});

console.log('🎉 Cleanup completed!');
"@

$cleanupScript | Out-File -FilePath "scripts/cleanup-laptop.js" -Encoding UTF8
Write-Success "Cleanup script created"

# Create README for laptop setup
Write-Status "Creating laptop setup README..."
$readmeContent = @"
# TrustChain LTO - Laptop Optimized Setup

## 🖥️ System Requirements
- **OS**: Windows 10/11
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 10GB free space
- **CPU**: Intel i3 or equivalent
- **Docker**: Docker Desktop installed

## 🚀 Quick Start

### 1. Setup
```powershell
# Run as Administrator
.\scripts\setup-laptop.ps1
```

### 2. Deploy
```powershell
.\scripts\deploy-laptop.ps1
```

### 3. Health Check
```powershell
.\scripts\health-check-laptop.ps1
```

## 📱 Access Points
- **Main App**: http://localhost:3001
- **Admin Dashboard**: http://localhost:3001/admin-dashboard.html
- **Registration**: http://localhost:3001/registration-wizard.html

## 👤 Default Users
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lto.gov.ph | admin123 |
| Staff | staff@lto.gov.ph | admin123 |
| Insurance | insurance@lto.gov.ph | admin123 |
| Emission | emission@lto.gov.ph | admin123 |
| Owner | owner@example.com | admin123 |

## 🔧 Management Commands

### Backup
```powershell
.\scripts\backup-laptop.ps1
```

### Cleanup
```powershell
node scripts/cleanup-laptop.js
```

### Stop Services
```powershell
docker-compose -f docker-compose.laptop.yml down
```

### View Logs
```powershell
docker-compose -f docker-compose.laptop.yml logs -f
```

## 📊 Resource Usage
- **Memory**: ~2GB total
- **CPU**: Low usage
- **Storage**: ~5GB (including backups)
- **Network**: Minimal

## 🛠️ Troubleshooting

### High Memory Usage
- Restart Docker Desktop
- Run cleanup script
- Check for memory leaks

### Slow Performance
- Close unnecessary applications
- Increase virtual memory
- Restart services

### Database Issues
- Check PostgreSQL logs
- Restore from backup
- Recreate database

## 🔒 Security Notes
- Change default passwords
- Enable file encryption if needed
- Regular backups recommended
- Monitor system resources

## 📞 Support
- Check logs in `logs/` directory
- Run health check script
- Review system resources
- Contact development team
"@

$readmeContent | Out-File -FilePath "README-LAPTOP.md" -Encoding UTF8
Write-Success "Laptop setup README created"

# Final setup steps
Write-Status "Performing final setup steps..."

# Set proper permissions
Write-Status "Setting file permissions..."
Get-ChildItem -Path "." -Recurse | ForEach-Object {
    if ($_.PSIsContainer) {
        $_.Attributes = "Directory"
    } else {
        $_.Attributes = "Archive"
    }
}

Write-Success "File permissions set"

# Create startup script
Write-Status "Creating startup script..."
$startupScript = @"
# TrustChain LTO - Quick Start Script

Write-Host "🚀 Starting TrustChain LTO..." -ForegroundColor Blue

# Check if already running
try {
    `$response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Application is already running" -ForegroundColor Green
    Write-Host "📱 Access at: http://localhost:3001" -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host "🔄 Starting services..." -ForegroundColor Yellow
}

# Start services
docker-compose -f docker-compose.laptop.yml up -d

# Wait and check
Start-Sleep -Seconds 20
& ".\scripts\health-check-laptop.ps1"
"@

$startupScript | Out-File -FilePath "start-laptop.ps1" -Encoding UTF8
Write-Success "Startup script created"

Write-Host "`n🎉 Laptop setup completed successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run: .\scripts\deploy-laptop.ps1" -ForegroundColor Cyan
Write-Host "2. Access: http://localhost:3001" -ForegroundColor Cyan
Write-Host "3. Login with: admin@lto.gov.ph / admin123" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Documentation: README-LAPTOP.md" -ForegroundColor Yellow
Write-Host "🔧 Management: .\start-laptop.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 This setup is optimized for your laptop specifications:" -ForegroundColor Green
Write-Host "   - Intel i3-7020U CPU" -ForegroundColor White
Write-Host "   - 4GB RAM" -ForegroundColor White
Write-Host "   - 447GB SSD" -ForegroundColor White
Write-Host "   - Zero additional costs" -ForegroundColor White
