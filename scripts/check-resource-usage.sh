#!/bin/bash
# TrustChain LTO - Check Resource Usage
# Shows current Docker container resource consumption

echo "📊 TrustChain LTO Resource Usage"
echo "================================"
echo ""

# Check running containers
RUNNING=$(docker ps --format "{{.Names}}" | grep -E "(lto|peer|orderer|couchdb|postgres|ipfs)" || true)

if [ -z "$RUNNING" ]; then
    echo "✅ No containers running"
    echo ""
    echo "💾 System memory usage:"
    free -h
    echo ""
    echo "💾 Disk usage:"
    df -h / | tail -1
else
    echo "📦 Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|lto|peer|orderer|couchdb|postgres|ipfs"
    echo ""
    echo "💾 Container resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -10
    echo ""
    echo "💾 System memory usage:"
    free -h
    echo ""
    echo "💾 Disk usage:"
    df -h / | tail -1
fi

echo ""
echo "💡 To stop all services:"
echo "   bash scripts/stop-all-services.sh"
echo ""
echo "💡 To see detailed logs:"
echo "   docker compose -f docker-compose.unified.yml ps"

