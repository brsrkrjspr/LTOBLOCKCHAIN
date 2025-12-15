#!/bin/bash
# Quick status check script for deployment
# Run this after SSH connection to see what needs to be done

set -e

echo "=========================================="
echo "  TrustChain LTO - Deployment Status"
echo "=========================================="
echo ""

cd ~/LTOBLOCKCHAIN 2>/dev/null || cd /root/LTOBLOCKCHAIN 2>/dev/null || {
    echo "❌ Cannot find project directory"
    echo "   Expected: ~/LTOBLOCKCHAIN or /root/LTOBLOCKCHAIN"
    exit 1
}

echo "📁 Project Directory: $(pwd)"
echo ""

# Check essential files
echo "1. Essential Files:"
[ -f "docker-compose.unified.yml" ] && echo "   ✅ docker-compose.unified.yml" || echo "   ❌ docker-compose.unified.yml MISSING"
[ -f "Dockerfile.production" ] && echo "   ✅ Dockerfile.production" || echo "   ❌ Dockerfile.production MISSING"
[ -f "network-config.json" ] && echo "   ✅ network-config.json" || echo "   ❌ network-config.json MISSING"
[ -f ".env" ] && echo "   ✅ .env file" || echo "   ❌ .env file MISSING (run: cp ENV.example .env)"
[ -d "node_modules" ] && echo "   ✅ node_modules" || echo "   ❌ node_modules MISSING (run: npm install)"

echo ""
echo "2. Fabric Setup:"
[ -d "fabric-network/crypto-config" ] && echo "   ✅ Crypto materials" || echo "   ❌ Crypto materials MISSING (run: bash scripts/generate-crypto.sh)"
[ -f "fabric-network/channel-artifacts/genesis.block" ] && echo "   ✅ Channel artifacts" || echo "   ❌ Channel artifacts MISSING (run: bash scripts/generate-channel-artifacts.sh)"
[ -f "wallet/admin.id" ] && echo "   ✅ Wallet" || echo "   ❌ Wallet MISSING (run: bash scripts/setup-wallet-only.sh)"

echo ""
echo "3. Docker Services:"
if command -v docker >/dev/null 2>&1; then
    docker compose -f docker-compose.unified.yml ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | head -10 || echo "   ⚠️  No containers running"
    
    echo ""
    echo "4. Service Health:"
    if docker compose -f docker-compose.unified.yml ps ipfs 2>/dev/null | grep -q "Restarting"; then
        echo "   ⚠️  IPFS is restarting (check logs: docker compose logs ipfs)"
        echo "   💡 Fix: bash scripts/fix-ipfs-volume.sh"
    fi
    
    if docker compose -f docker-compose.unified.yml ps lto-app 2>/dev/null | grep -q "healthy"; then
        echo "   ✅ Application is healthy"
    elif docker compose -f docker-compose.unified.yml ps lto-app 2>/dev/null | grep -q "Up"; then
        echo "   ⚠️  Application is running (check health: curl http://localhost:3001/api/health)"
    else
        echo "   ❌ Application not running"
    fi
else
    echo "   ❌ Docker not installed or not accessible"
fi

echo ""
echo "=========================================="
echo "  Next Steps:"
echo "=========================================="
echo ""
echo "If anything is missing, follow these steps:"
echo ""
echo "1. Pull latest code:"
echo "   git pull"
echo ""
echo "2. Install dependencies:"
echo "   npm install"
echo ""
echo "3. Setup Fabric (if missing):"
echo "   bash scripts/generate-crypto.sh"
echo "   bash scripts/setup-tls-certs.sh"
echo "   bash scripts/generate-channel-artifacts.sh"
echo "   bash scripts/setup-wallet-only.sh"
echo ""
echo "4. Fix permissions:"
echo "   sudo bash scripts/fix-permissions.sh"
echo ""
echo "5. Start services:"
echo "   docker compose -f docker-compose.unified.yml up -d"
echo ""
echo "6. Check status:"
echo "   docker compose -f docker-compose.unified.yml ps"
echo "   docker compose -f docker-compose.unified.yml logs lto-app --tail=30"
echo ""

