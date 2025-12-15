#!/bin/bash
# TrustChain LTO - Stop All Services
# Stops all Docker containers to save resources/credits

set -e

echo "🛑 Stopping all TrustChain LTO services..."

# Stop all containers
echo "📦 Stopping Docker containers..."
docker compose -f docker-compose.unified.yml down

# Verify all containers are stopped
echo ""
echo "📋 Checking container status..."
RUNNING=$(docker ps --format "{{.Names}}" | grep -E "(lto|peer|orderer|couchdb|postgres|ipfs)" || true)

if [ -z "$RUNNING" ]; then
    echo "✅ All containers stopped successfully"
else
    echo "⚠️  Some containers are still running:"
    echo "$RUNNING"
    echo ""
    echo "Force stopping..."
    docker ps --format "{{.Names}}" | grep -E "(lto|peer|orderer|couchdb|postgres|ipfs)" | xargs -r docker stop
fi

# Show resource usage
echo ""
echo "💾 Current Docker resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || echo "No containers running"

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 To start again:"
echo "   docker compose -f docker-compose.unified.yml up -d"
echo ""
echo "💡 To remove everything (including volumes - WARNING: deletes data):"
echo "   docker compose -f docker-compose.unified.yml down -v"

