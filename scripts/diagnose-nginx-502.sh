#!/bin/bash

# Fix Nginx 502 Bad Gateway
# Backend is healthy but nginx can't reach it

set -e

echo "=========================================="
echo "Fixing Nginx 502 Bad Gateway"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || exit 1

echo ""
echo "Step 1: Checking nginx configuration..."
if docker exec nginx nginx -t 2>&1 | grep -q "successful"; then
    echo "  ✓ Nginx config is valid"
else
    echo "  ✗ Nginx config has errors:"
    docker exec nginx nginx -t
    exit 1
fi

echo ""
echo "Step 2: Checking nginx can resolve lto-app hostname..."
if docker exec nginx ping -c 2 lto-app > /dev/null 2>&1; then
    echo "  ✓ Nginx can ping lto-app"
else
    echo "  ✗ Nginx cannot ping lto-app"
    echo "  Checking network..."
    docker network inspect trustchain | grep -A 5 lto-app || echo "  lto-app not in network"
fi

echo ""
echo "Step 3: Testing nginx connection to backend..."
if docker exec nginx wget -q -O- --timeout=5 http://lto-app:3001/api/health > /dev/null 2>&1; then
    echo "  ✓ Nginx can reach backend"
else
    echo "  ✗ Nginx cannot reach backend"
    echo "  Trying curl..."
    docker exec nginx curl -s --max-time 5 http://lto-app:3001/api/health || echo "  Failed"
fi

echo ""
echo "Step 4: Checking nginx error logs..."
echo "Recent nginx errors:"
docker logs nginx 2>&1 | grep -i "502\|bad gateway\|upstream\|connect" | tail -10

echo ""
echo "Step 5: Checking which nginx config is being used..."
docker exec nginx cat /etc/nginx/nginx.conf | grep -E "upstream|proxy_pass|lto" | head -10

echo ""
echo "Step 6: Restarting nginx..."
docker-compose -f docker-compose.unified.yml restart nginx
sleep 5

echo ""
echo "Step 7: Testing again..."
if curl -s -I http://localhost/ 2>&1 | grep -q "200\|301\|302"; then
    echo "  ✓ HTTP works!"
else
    echo "  ✗ HTTP still failing"
    curl -I http://localhost/ 2>&1 | head -5
fi

echo ""
echo "=========================================="
echo "Diagnosis complete!"
echo "=========================================="
