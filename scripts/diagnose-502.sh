#!/bin/bash
# Diagnose 502 Bad Gateway Error

echo "=========================================="
echo "502 Bad Gateway - Diagnostic Script"
echo "=========================================="
echo ""

echo "1. Checking container status..."
echo "----------------------------------------"
docker compose ps | grep -E "lto-app|nginx|postgres"
echo ""

echo "2. Checking backend container logs (last 50 lines)..."
echo "----------------------------------------"
docker compose logs lto-app --tail=50
echo ""

echo "3. Testing backend health endpoint..."
echo "----------------------------------------"
docker exec lto-app curl -s http://localhost:3001/api/health 2>&1 || echo "❌ Backend not responding"
echo ""

echo "4. Checking if backend is listening on port 3001..."
echo "----------------------------------------"
docker exec lto-app netstat -tuln 2>/dev/null | grep 3001 || docker exec lto-app ss -tuln 2>/dev/null | grep 3001 || echo "❌ Port 3001 not listening"
echo ""

echo "5. Checking nginx error logs..."
echo "----------------------------------------"
docker logs nginx --tail=20 2>&1 | grep -i error || echo "No errors in nginx logs"
echo ""

echo "6. Testing nginx -> backend connection..."
echo "----------------------------------------"
docker exec nginx ping -c 2 lto-app 2>&1 || echo "❌ Cannot reach lto-app from nginx"
echo ""

echo "7. Checking for syntax errors in modified files..."
echo "----------------------------------------"
echo "Checking insurance.js..."
docker exec lto-app node -c backend/routes/insurance.js 2>&1 && echo "✅ insurance.js syntax OK" || echo "❌ insurance.js has syntax errors"

echo "Checking emission.js..."
docker exec lto-app node -c backend/routes/emission.js 2>&1 && echo "✅ emission.js syntax OK" || echo "❌ emission.js has syntax errors"

echo "Checking hpg.js..."
docker exec lto-app node -c backend/routes/hpg.js 2>&1 && echo "✅ hpg.js syntax OK" || echo "❌ hpg.js has syntax errors"
echo ""

echo "8. Checking database connection..."
echo "----------------------------------------"
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.query('SELECT NOW()').then(() => {
  console.log('✅ Database connected');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database error:', err.message);
  process.exit(1);
});
" 2>&1
echo ""

echo "=========================================="
echo "Diagnosis Complete"
echo "=========================================="
echo ""
echo "If backend is not running, try:"
echo "  docker compose restart lto-app"
echo ""
echo "If syntax errors found, check the files listed above"
echo ""
