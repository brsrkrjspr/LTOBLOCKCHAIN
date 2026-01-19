# Diagnose 502 Bad Gateway Error (PowerShell)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "502 Bad Gateway - Diagnostic Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking container status..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker compose ps | Select-String -Pattern "lto-app|nginx|postgres"
Write-Host ""

Write-Host "2. Checking backend container logs (last 50 lines)..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker compose logs lto-app --tail=50
Write-Host ""

Write-Host "3. Testing backend health endpoint..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker exec lto-app curl -s http://localhost:3001/api/health 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend not responding" -ForegroundColor Red
}
Write-Host ""

Write-Host "4. Checking if backend is listening on port 3001..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
$portCheck = docker exec lto-app netstat -tuln 2>&1 | Select-String "3001"
if ($portCheck) {
    Write-Host "✅ Port 3001 is listening" -ForegroundColor Green
    $portCheck
} else {
    Write-Host "❌ Port 3001 not listening" -ForegroundColor Red
}
Write-Host ""

Write-Host "5. Checking nginx error logs..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
$nginxErrors = docker logs nginx --tail=20 2>&1 | Select-String -Pattern "error" -CaseSensitive:$false
if ($nginxErrors) {
    $nginxErrors
} else {
    Write-Host "No errors in nginx logs" -ForegroundColor Gray
}
Write-Host ""

Write-Host "6. Testing nginx -> backend connection..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker exec nginx ping -c 2 lto-app 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cannot reach lto-app from nginx" -ForegroundColor Red
}
Write-Host ""

Write-Host "7. Checking for syntax errors in modified files..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
Write-Host "Checking insurance.js..."
docker exec lto-app node -c backend/routes/insurance.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ insurance.js syntax OK" -ForegroundColor Green
} else {
    Write-Host "❌ insurance.js has syntax errors" -ForegroundColor Red
}

Write-Host "Checking emission.js..."
docker exec lto-app node -c backend/routes/emission.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ emission.js syntax OK" -ForegroundColor Green
} else {
    Write-Host "❌ emission.js has syntax errors" -ForegroundColor Red
}

Write-Host "Checking hpg.js..."
docker exec lto-app node -c backend/routes/hpg.js 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ hpg.js syntax OK" -ForegroundColor Green
} else {
    Write-Host "❌ hpg.js has syntax errors" -ForegroundColor Red
}
Write-Host ""

Write-Host "8. Checking database connection..." -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker exec lto-app node -e @"
const db = require('./backend/database/db');
db.query('SELECT NOW()').then(() => {
  console.log('✅ Database connected');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database error:', err.message);
  process.exit(1);
});
"@ 2>&1
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Diagnosis Complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If backend is not running, try:" -ForegroundColor Yellow
Write-Host "  docker compose restart lto-app" -ForegroundColor White
Write-Host ""
Write-Host "If syntax errors found, check the files listed above" -ForegroundColor Yellow
Write-Host ""
