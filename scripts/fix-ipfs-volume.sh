#!/bin/bash
# Fix IPFS volume version mismatch issues
# Run this if IPFS container is restarting due to version errors

set -e

echo "🔧 Fixing IPFS volume version mismatch..."

# Stop IPFS container
echo "Stopping IPFS container..."
docker compose -f docker-compose.unified.yml stop ipfs 2>/dev/null || true
docker compose -f docker-compose.unified.yml rm -f ipfs 2>/dev/null || true

# Find IPFS volume name
VOLUME_NAME=$(docker volume ls | grep ipfs-data | awk '{print $2}' || echo "lto-blockchain_ipfs-data")

if [ -z "$VOLUME_NAME" ]; then
    echo "⚠️  Could not find IPFS volume. It will be created on next start."
else
    echo "Found IPFS volume: $VOLUME_NAME"
    read -p "⚠️  This will DELETE all IPFS data. Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing IPFS volume..."
        docker volume rm "$VOLUME_NAME" 2>/dev/null || echo "Volume already removed or doesn't exist"
        echo "✅ IPFS volume removed"
    else
        echo "❌ Aborted. IPFS volume not removed."
        exit 1
    fi
fi

echo ""
echo "✅ IPFS volume fix complete!"
echo ""
echo "Next steps:"
echo "  1. Start IPFS: docker compose -f docker-compose.unified.yml up -d ipfs"
echo "  2. Check logs: docker compose -f docker-compose.unified.yml logs -f ipfs"
echo "  3. Verify: curl http://localhost:5001/api/v0/version"

