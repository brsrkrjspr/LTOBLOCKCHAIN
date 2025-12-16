#!/bin/bash
# TrustChain LTO - Check Backend Logs
# Shows recent backend application logs for debugging

set -e

echo "=== Backend Application Logs (Last 50 lines) ==="
echo ""
docker compose -f docker-compose.unified.yml logs --tail=50 lto-app

echo ""
echo "=== Checking for Errors ==="
echo ""
docker compose -f docker-compose.unified.yml logs --tail=100 lto-app | grep -i "error\|exception\|failed" || echo "No errors found in recent logs"

echo ""
echo "=== Database Connection Test ==="
echo ""
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    console.log(result ? '✅ Database connection OK' : '❌ Database connection FAILED');
    process.exit(result ? 0 : 1);
}).catch(err => {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
});
" || echo "⚠️  Could not test database connection"

echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.unified.yml ps lto-app

