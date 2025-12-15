#!/bin/bash
# Fix permissions for Docker volumes
# Run this before starting docker-compose

set -e

echo "🔧 Fixing permissions for Docker volumes..."

# Create directories if they don't exist
mkdir -p logs
mkdir -p wallet
mkdir -p fabric-network/crypto-config

# Set ownership to match Docker container user (UID 1001)
# This matches the 'lto' user in Dockerfile.production
chown -R 1001:1001 logs wallet 2>/dev/null || echo "⚠️  Could not change ownership (may need sudo)"

# Set permissions
chmod -R 755 logs wallet 2>/dev/null || true

# Ensure crypto-config is readable
chmod -R 755 fabric-network/crypto-config 2>/dev/null || true

echo "✅ Permissions fixed!"
echo ""
echo "If you see permission errors, run with sudo:"
echo "  sudo bash scripts/fix-permissions.sh"

