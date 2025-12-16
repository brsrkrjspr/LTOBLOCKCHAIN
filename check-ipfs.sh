#!/bin/bash
# TrustChain LTO - Complete IPFS Diagnostic Script
# Run this to diagnose all IPFS-related issues

echo "🔍 TrustChain LTO - IPFS Diagnostic Report"
echo "=========================================="
echo ""

# Check if running in correct directory
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.unified.yml" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# 1. Check Docker Containers
echo "1️⃣ Checking Docker containers..."
echo "-----------------------------------"
if docker compose ps | grep -q "ipfs.*Up"; then
    echo "✅ IPFS container is running"
else
    echo "❌ IPFS container is NOT running"
    docker compose ps ipfs
fi

if docker compose ps | grep -q "lto-app.*Up"; then
    echo "✅ Application container is running"
else
    echo "❌ Application container is NOT running"
    docker compose ps lto-app
fi

if docker compose ps | grep -q "lto-db.*Up"; then
    echo "✅ Database container is running"
else
    echo "❌ Database container is NOT running"
    docker compose ps lto-db
fi
echo ""

# 2. Check Environment Variables
echo "2️⃣ Checking environment variables..."
echo "-----------------------------------"
if [ -f ".env" ]; then
    echo "📄 .env file exists"
    
    if grep -q "^STORAGE_MODE=ipfs" .env; then
        echo "✅ STORAGE_MODE=ipfs (active)"
    elif grep -q "^#.*STORAGE_MODE=ipfs" .env; then
        echo "⚠️  STORAGE_MODE=ipfs (COMMENTED OUT - needs to be uncommented)"
    else
        echo "❌ STORAGE_MODE not set to ipfs"
    fi
    
    if grep -q "^IPFS_HOST=" .env; then
        IPFS_HOST=$(grep "^IPFS_HOST=" .env | cut -d'=' -f2)
        echo "✅ IPFS_HOST=$IPFS_HOST (active)"
    elif grep -q "^#.*IPFS_HOST=" .env; then
        echo "⚠️  IPFS_HOST (COMMENTED OUT - needs to be uncommented)"
    else
        echo "❌ IPFS_HOST not set"
    fi
    
    if grep -q "^IPFS_PORT=" .env; then
        IPFS_PORT=$(grep "^IPFS_PORT=" .env | cut -d'=' -f2)
        echo "✅ IPFS_PORT=$IPFS_PORT (active)"
    elif grep -q "^#.*IPFS_PORT=" .env; then
        echo "⚠️  IPFS_PORT (COMMENTED OUT - needs to be uncommented)"
    else
        echo "❌ IPFS_PORT not set"
    fi
else
    echo "❌ .env file not found"
fi
echo ""

# 3. Check Environment Variables in Container
echo "3️⃣ Checking environment in application container..."
echo "-----------------------------------"
if docker compose ps | grep -q "lto-app.*Up"; then
    CONTAINER_STORAGE_MODE=$(docker exec lto-app printenv STORAGE_MODE 2>/dev/null || echo "NOT SET")
    CONTAINER_IPFS_HOST=$(docker exec lto-app printenv IPFS_HOST 2>/dev/null || echo "NOT SET")
    CONTAINER_IPFS_PORT=$(docker exec lto-app printenv IPFS_PORT 2>/dev/null || echo "NOT SET")
    
    echo "STORAGE_MODE: $CONTAINER_STORAGE_MODE"
    echo "IPFS_HOST: $CONTAINER_IPFS_HOST"
    echo "IPFS_PORT: $CONTAINER_IPFS_PORT"
    
    if [ "$CONTAINER_STORAGE_MODE" = "ipfs" ]; then
        echo "✅ Container has STORAGE_MODE=ipfs"
    else
        echo "❌ Container does NOT have STORAGE_MODE=ipfs"
    fi
else
    echo "❌ Application container not running"
fi
echo ""

# 4. Check IPFS API
echo "4️⃣ Testing IPFS API..."
echo "-----------------------------------"
if docker compose ps | grep -q "ipfs.*Up"; then
    IPFS_VERSION=$(docker exec ipfs curl -s -X POST http://localhost:5001/api/v0/version 2>/dev/null | grep -o '"Version":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$IPFS_VERSION" ]; then
        echo "✅ IPFS API responding - Version: $IPFS_VERSION"
    else
        echo "❌ IPFS API not responding"
    fi
else
    echo "❌ IPFS container not running"
fi
echo ""

# 5. Check IPFS from Application
echo "5️⃣ Testing IPFS connection from application..."
echo "-----------------------------------"
if docker compose ps | grep -q "lto-app.*Up" && docker compose ps | grep -q "ipfs.*Up"; then
    if docker exec lto-app node -e "const http = require('http'); const req = http.request({hostname: 'ipfs', port: 5001, path: '/api/v0/version', method: 'POST'}, (res) => {console.log('Status:', res.statusCode); process.exit(res.statusCode === 200 ? 0 : 1);}); req.on('error', () => {console.log('Connection failed'); process.exit(1);}); req.end();" 2>&1 | grep -q "Status: 200"; then
        echo "✅ Application can connect to IPFS"
    else
        echo "❌ Application CANNOT connect to IPFS"
        docker exec lto-app node -e "const http = require('http'); const req = http.request({hostname: 'ipfs', port: 5001, path: '/api/v0/version', method: 'POST'}, (res) => {console.log('Status:', res.statusCode);}); req.on('error', (e) => {console.log('Error:', e.message);}); req.end();"
    fi
else
    echo "❌ Required containers not running"
fi
echo ""

# 6. Check Files
echo "6️⃣ Checking required files..."
echo "-----------------------------------"
if [ -f "backend/routes/documents.js" ]; then
    echo "✅ backend/routes/documents.js exists"
else
    echo "❌ backend/routes/documents.js MISSING"
fi

if [ -f "backend/services/ipfsService.js" ]; then
    echo "✅ backend/services/ipfsService.js exists"
else
    echo "❌ backend/services/ipfsService.js MISSING"
fi

if [ -f "backend/services/storageService.js" ]; then
    echo "✅ backend/services/storageService.js exists"
else
    echo "❌ backend/services/storageService.js MISSING"
fi
echo ""

# 7. Check Recent Logs
echo "7️⃣ Recent IPFS logs (last 10 lines)..."
echo "-----------------------------------"
if docker compose ps | grep -q "ipfs.*Up"; then
    docker compose logs ipfs --tail=10
else
    echo "❌ IPFS container not running"
fi
echo ""

echo "8️⃣ Recent Application logs (last 10 lines)..."
echo "-----------------------------------"
if docker compose ps | grep -q "lto-app.*Up"; then
    docker compose logs lto-app --tail=10
else
    echo "❌ Application container not running"
fi
echo ""

# 8. Summary
echo "📊 SUMMARY"
echo "=========================================="
ISSUES=0

if ! docker compose ps | grep -q "ipfs.*Up"; then
    echo "❌ IPFS container not running"
    ISSUES=$((ISSUES+1))
fi

if ! grep -q "^STORAGE_MODE=ipfs" .env 2>/dev/null; then
    echo "❌ STORAGE_MODE not set to ipfs in .env (or commented out)"
    ISSUES=$((ISSUES+1))
fi

if ! grep -q "^IPFS_HOST=" .env 2>/dev/null; then
    echo "❌ IPFS_HOST not set in .env (or commented out)"
    ISSUES=$((ISSUES+1))
fi

if [ ! -f "backend/routes/documents.js" ]; then
    echo "❌ documents.js route file missing"
    ISSUES=$((ISSUES+1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ No critical issues found!"
    echo "   If uploads still fail, check database columns and application logs"
else
    echo "⚠️  Found $ISSUES critical issue(s) that need to be fixed"
fi
echo ""
echo "=========================================="
echo "Diagnostic complete!"