#!/bin/bash

# Quick Test: Query Fabric Through Backend API
# This avoids needing to configure CLI, but still requires Discovery service

set -e

echo "=========================================="
echo "Query Fabric Through Backend API"
echo "=========================================="
echo ""
echo "This approach uses the backend API which uses Fabric SDK."
echo "No CLI configuration needed, but Discovery service must be enabled."
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

echo "Step 1: Checking if backend is running..."
if docker ps | grep -q "lto-app.*Up"; then
    echo "  ✓ Backend is running"
else
    echo "  ✗ Backend is not running!"
    echo "  Start it with: docker-compose -f docker-compose.unified.yml up -d lto-app"
    exit 1
fi

echo ""
echo "Step 2: Checking backend health..."
HEALTH_RESPONSE=$(docker exec lto-app curl -s http://localhost:3001/api/health 2>/dev/null || echo "")
if [ -n "$HEALTH_RESPONSE" ]; then
    echo "  ✓ Backend is healthy"
    echo "  Response: $HEALTH_RESPONSE" | head -c 100
    echo ""
else
    echo "  ✗ Backend health check failed"
    exit 1
fi

echo ""
echo "Step 3: Testing API endpoint (requires authentication)..."
echo ""
echo "To query through API, you need:"
echo "  1. Authentication token (login first)"
echo "  2. Discovery service enabled (run: bash scripts/fix-enable-discovery.sh)"
echo ""
echo "Example API calls:"
echo ""
echo "  # 1. Login to get token"
echo "  curl -X POST http://localhost:3001/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"admin@example.com\",\"password\":\"password\"}'"
echo ""
echo "  # 2. Query vehicle (replace TOKEN and VIN)"
echo "  curl -H 'Authorization: Bearer TOKEN' \\"
echo "    http://localhost:3001/api/vehicles/VIN123"
echo ""
echo "  # 3. Query ownership history"
echo "  curl -H 'Authorization: Bearer TOKEN' \\"
echo "    http://localhost:3001/api/vehicles/VIN123/ownership-history"
echo ""

echo "Step 4: Checking if Discovery service is enabled..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -q "Discovery service must be enabled"; then
    echo "  ⚠ Discovery service is NOT enabled"
    echo "  Run: bash scripts/fix-enable-discovery.sh"
else
    echo "  ✓ Discovery service appears to be enabled (or not mentioned in logs)"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "To query without CLI:"
echo "  1. Enable Discovery service: bash scripts/fix-enable-discovery.sh"
echo "  2. Use backend API endpoints (see examples above)"
echo ""
echo "Note: The API still needs Discovery service enabled because"
echo "      Fabric SDK uses Discovery to find peers automatically."
echo ""
