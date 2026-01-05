#!/bin/bash
# Quick check of all services

echo "🔍 Checking Service Status..."
echo ""

# Check Docker containers
echo "📦 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -1
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "ipfs|postgres|orderer|peer|cli" || echo "❌ No Fabric/services containers found"

echo ""
echo "🔗 Testing Connections:"

# Test IPFS
echo -n "  IPFS (5001): "
if timeout 2 bash -c "echo > /dev/tcp/localhost/5001" 2>/dev/null || curl -s http://localhost:5001/api/v0/version > /dev/null 2>&1; then
    echo "✅ Accessible"
else
    echo "❌ Not accessible"
fi

# Test PostgreSQL
echo -n "  PostgreSQL (5432): "
if timeout 2 bash -c "echo > /dev/tcp/localhost/5432" 2>/dev/null; then
    echo "✅ Accessible"
else
    echo "❌ Not accessible"
fi

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
echo "  If containers not running: docker-compose -f docker-compose.unified.yml up -d"
echo "  If containers running but not accessible: bash scripts/fresh-start-fabric.sh"

