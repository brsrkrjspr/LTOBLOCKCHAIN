#!/bin/bash
# Quick check of Fabric network status

echo "🔍 Checking Fabric Network Status..."
echo ""

# Check containers
echo "📦 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "orderer|peer|cli" || echo "❌ No Fabric containers found"

echo ""
echo "🔗 Testing Connections:"

# Test peer
echo -n "  Peer (7051): "
if timeout 2 bash -c "echo > /dev/tcp/localhost/7051" 2>/dev/null; then
    echo "✅ Accessible"
else
    echo "❌ Not accessible"
fi

# Test orderer
echo -n "  Orderer (7050): "
if timeout 2 bash -c "echo > /dev/tcp/localhost/7050" 2>/dev/null; then
    echo "✅ Accessible"
else
    echo "❌ Not accessible"
fi

echo ""
echo "📋 Next Steps:"
echo "  1. If containers not running: docker-compose -f docker-compose.unified.yml up -d"
echo "  2. If containers running but not accessible: bash scripts/codespace-restart.sh"
echo "  3. Check logs: docker logs peer0.lto.gov.ph --tail 20"

