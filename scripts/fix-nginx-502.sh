#!/bin/bash

# Quick Fix: Nginx 502 Bad Gateway
# Backend is healthy but nginx can't reach it

set -e

echo "=========================================="
echo "Fixing Nginx 502 Bad Gateway"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || exit 1

echo ""
echo "Step 1: Testing nginx connection to backend..."
if docker exec nginx wget -q -O- --timeout=5 http://lto-app:3001/api/health > /dev/null 2>&1; then
    echo "  ✓ Nginx can reach backend"
else
    echo "  ✗ Nginx cannot reach backend - checking network..."
    docker network inspect trustchain | grep -A 3 lto-app || echo "  lto-app not found in network"
fi

echo ""
echo "Step 2: Checking nginx error logs..."
echo "Recent errors:"
docker logs nginx 2>&1 | tail -20 | grep -i "502\|bad gateway\|upstream\|connect\|refused" || echo "  No obvious errors"

echo ""
echo "Step 3: Checking if backend is actually listening..."
if docker exec lto-app netstat -tuln 2>/dev/null | grep -q ":3001"; then
    echo "  ✓ Backend is listening on port 3001"
else
    echo "  ✗ Backend is NOT listening on port 3001"
    docker exec lto-app ss -tuln 2>/dev/null | grep 3001 || echo "  Port check failed"
fi

echo ""
echo "Step 4: Testing backend directly from host..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "  ✓ Backend accessible from host"
else
    echo "  ⚠ Backend not exposed to host (this is OK if using docker network)"
fi

echo ""
echo "Step 5: Restarting nginx..."
docker-compose -f docker-compose.unified.yml restart nginx
sleep 5

echo ""
echo "Step 6: Testing HTTP (should redirect to HTTPS)..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
echo "  HTTP status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "  ✓ HTTP redirects correctly"
elif [ "$HTTP_STATUS" = "502" ]; then
    echo "  ✗ HTTP still returns 502"
fi

echo ""
echo "Step 7: Testing HTTPS..."
HTTPS_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" https://localhost/ 2>&1 || echo "000")
echo "  HTTPS status: $HTTPS_STATUS"
if [ "$HTTPS_STATUS" = "200" ] || [ "$HTTPS_STATUS" = "301" ] || [ "$HTTPS_STATUS" = "302" ]; then
    echo "  ✓ HTTPS works!"
else
    echo "  ✗ HTTPS still failing"
    echo "  Checking SSL certificate..."
    docker exec nginx ls -la /etc/letsencrypt/live/ltoblockchain.duckdns.org/ 2>&1 | head -5 || echo "  Certificate path not found"
fi

echo ""
echo "Step 8: Checking nginx can resolve lto-app..."
docker exec nginx nslookup lto-app 2>&1 | grep -i "name\|address" || echo "  DNS resolution failed"

echo ""
echo "=========================================="
echo "Diagnosis complete!"
echo "=========================================="
echo ""
echo "If still getting 502, check:"
echo "  1. docker logs nginx --tail=50"
echo "  2. docker logs lto-app --tail=50"
echo "  3. docker network inspect trustchain"
echo ""
