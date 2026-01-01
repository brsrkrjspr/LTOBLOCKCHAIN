#!/bin/bash

echo "=========================================="
echo "Blockchain Connection Status Check"
echo "=========================================="
echo ""

echo "1. Checking Fabric containers status..."
docker ps | grep -E "peer|orderer|couchdb|chaincode"
echo ""

echo "2. Checking backend logs for Fabric connection..."
docker logs lto-app --tail 100 2>&1 | grep -iE "fabric|blockchain|connected|disconnected" | tail -20
echo ""

echo "3. Testing blockchain status API endpoint..."
docker exec lto-app curl -s http://localhost:3001/api/blockchain/status 2>/dev/null | python3 -m json.tool 2>/dev/null || docker exec lto-app curl -s http://localhost:3001/api/blockchain/status
echo ""

echo "4. Checking if network-config.json exists in container..."
docker exec lto-app ls -la network-config.json 2>/dev/null || echo "network-config.json not found in container root"
echo ""

echo "5. Checking if wallet directory exists..."
docker exec lto-app ls -la wallet/ 2>/dev/null | head -10 || echo "wallet directory not found or empty"
echo ""

echo "6. Checking backend environment variables..."
docker exec lto-app env | grep -iE "BLOCKCHAIN|FABRIC" || echo "No blockchain-related environment variables found"
echo ""

echo "7. Checking if backend can access Fabric peer..."
docker exec lto-app ping -c 1 peer0.lto.gov.ph 2>/dev/null || echo "Cannot ping peer (may be normal if using Docker network)"
echo ""

echo "=========================================="
echo "Check complete!"
echo "=========================================="

