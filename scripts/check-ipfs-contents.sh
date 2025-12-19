#!/bin/bash
# TrustChain LTO - IPFS Contents Inspection Script
# Shows what's stored in IPFS

echo "🔍 Checking IPFS Contents..."
echo ""

# IPFS connection details
IPFS_HOST="${IPFS_HOST:-localhost}"
IPFS_PORT="${IPFS_PORT:-5001}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to call IPFS API
ipfs_api() {
    curl -s -X POST "http://$IPFS_HOST:$IPFS_PORT/api/v0/$1" ${@:2} 2>/dev/null
}

# Check if IPFS is accessible
echo "📋 IPFS Node Status:"
echo ""

VERSION=$(ipfs_api "version")
if [ -n "$VERSION" ]; then
    echo -e "${GREEN}✅ IPFS is accessible${NC}"
    echo "  Version: $VERSION"
else
    echo -e "${RED}❌ IPFS is not accessible${NC}"
    echo "  Check if IPFS container is running: docker ps | grep ipfs"
    exit 1
fi

echo ""
echo "📋 IPFS Node Information:"
echo ""

NODE_ID=$(ipfs_api "id")
if [ -n "$NODE_ID" ]; then
    echo "$NODE_ID" | python3 -m json.tool 2>/dev/null || echo "$NODE_ID"
else
    echo "  Could not retrieve node ID"
fi

echo ""
echo "📋 IPFS Pinned Files:"
echo ""

PINNED=$(ipfs_api "pin/ls" --data-urlencode "type=recursive")
if [ -n "$PINNED" ]; then
    PIN_COUNT=$(echo "$PINNED" | grep -o '"Keys"' | wc -l || echo "0")
    echo "  Pinned items: $PIN_COUNT"
    echo ""
    echo "  Pinned CIDs:"
    echo "$PINNED" | python3 -m json.tool 2>/dev/null | grep -A 1 "Keys" || echo "$PINNED"
else
    echo "  No pinned files found or error retrieving pins"
fi

echo ""
echo "📋 IPFS Repository Statistics:"
echo ""

STATS=$(ipfs_api "stats/repo")
if [ -n "$STATS" ]; then
    echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
else
    echo "  Could not retrieve repository statistics"
fi

echo ""
echo "📋 IPFS Connected Peers:"
echo ""

PEERS=$(ipfs_api "swarm/peers")
if [ -n "$PEERS" ]; then
    PEER_COUNT=$(echo "$PEERS" | grep -o "addr" | wc -l || echo "0")
    echo "  Connected peers: $PEER_COUNT"
    if [ "$PEER_COUNT" -gt 0 ]; then
        echo "$PEERS" | python3 -m json.tool 2>/dev/null | head -20 || echo "$PEERS" | head -20
    fi
else
    echo "  No peers connected (this is normal for local IPFS node)"
fi

echo ""
echo "✅ IPFS contents check complete!"
