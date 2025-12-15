#!/bin/bash

# Quick IPFS verification script

echo "🔍 Verifying IPFS Connection..."
echo ""

# Test 1: Container status
echo "1. Container Status:"
if docker ps | grep -q "ipfs"; then
    echo "   ✅ IPFS container is running"
else
    echo "   ❌ IPFS container is NOT running"
    exit 1
fi

# Test 2: IPFS version (inside container)
echo ""
echo "2. IPFS Version (inside container):"
VERSION=$(docker exec ipfs ipfs version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ $VERSION"
else
    echo "   ❌ Failed to get version"
    exit 1
fi

# Test 3: IPFS API (POST request - correct method)
echo ""
echo "3. IPFS API Test (POST /api/v0/version):"
API_RESPONSE=$(curl -s -X POST http://localhost:5001/api/v0/version 2>/dev/null)
if [ $? -eq 0 ] && echo "$API_RESPONSE" | grep -q "Version"; then
    VERSION_JSON=$(echo "$API_RESPONSE" | grep -o '"Version":"[^"]*"' | cut -d'"' -f4)
    echo "   ✅ API accessible - Version: $VERSION_JSON"
else
    echo "   ❌ API not accessible"
    echo "   Response: $API_RESPONSE"
    exit 1
fi

# Test 4: IPFS ID (node info)
echo ""
echo "4. IPFS Node ID:"
NODE_ID=$(docker exec ipfs ipfs id 2>/dev/null | grep -o '"ID":"[^"]*"' | cut -d'"' -f4 | head -1)
if [ -n "$NODE_ID" ]; then
    echo "   ✅ Node ID: $NODE_ID"
else
    echo "   ⚠️  Could not get node ID"
fi

# Test 5: Environment variables
echo ""
echo "5. Environment Configuration:"
if [ -f ".env" ]; then
    IPFS_HOST=$(grep "^IPFS_HOST" .env | cut -d'=' -f2 | tr -d ' ' || echo "not set")
    STORAGE_MODE=$(grep "^STORAGE_MODE" .env | cut -d'=' -f2 | tr -d ' ' || echo "not set")
    
    echo "   IPFS_HOST: $IPFS_HOST"
    echo "   STORAGE_MODE: $STORAGE_MODE"
    
    if [ "$IPFS_HOST" = "ipfs" ] || [ "$IPFS_HOST" = "localhost" ]; then
        echo "   ✅ IPFS_HOST is correctly configured"
    else
        echo "   ⚠️  IPFS_HOST should be 'ipfs' for Docker network or 'localhost' for local access"
    fi
    
    if [ "$STORAGE_MODE" = "ipfs" ]; then
        echo "   ✅ STORAGE_MODE is 'ipfs' (no fallbacks)"
    else
        echo "   ⚠️  STORAGE_MODE is '$STORAGE_MODE' (should be 'ipfs' for real service)"
    fi
else
    echo "   ⚠️  .env file not found"
fi

echo ""
echo "✅ IPFS is fully operational!"
echo ""
echo "To ensure application uses IPFS:"
echo "  1. Set STORAGE_MODE=ipfs in .env"
echo "  2. Set IPFS_HOST=ipfs in .env (for Docker network) or IPFS_HOST=localhost (for local)"
echo "  3. Restart application: npm start"

