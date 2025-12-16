#!/bin/bash
# TrustChain LTO - Enable Swap for DigitalOcean Server
# Creates 2GB swap file to prevent memory issues during Docker builds

set -e

echo "🔧 Enabling Swap (2GB) for DigitalOcean Server..."
echo "=================================================="
echo ""

# Check if swap already exists
if swapon --show | grep -q "/swapfile"; then
    echo "✅ Swap already enabled:"
    swapon --show
    echo ""
    echo "Current swap status:"
    free -h | grep Swap
    exit 0
fi

# Check if swapfile already exists
if [ -f /swapfile ]; then
    echo "⚠️  /swapfile already exists. Removing old swapfile..."
    swapoff /swapfile 2>/dev/null || true
    rm -f /swapfile
fi

# Create 2GB swap file
echo "📦 Creating 2GB swap file..."
sudo fallocate -l 2G /swapfile

# Set correct permissions
echo "🔒 Setting permissions..."
sudo chmod 600 /swapfile

# Format as swap
echo "💾 Formatting as swap..."
sudo mkswap /swapfile

# Enable swap
echo "✅ Enabling swap..."
sudo swapon /swapfile

# Make it permanent
if ! grep -q "/swapfile" /etc/fstab; then
    echo "💾 Making swap permanent..."
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
    echo "ℹ️  Swap already in /etc/fstab"
fi

# Verify
echo ""
echo "✅ Swap enabled successfully!"
echo ""
echo "Current memory status:"
free -h
echo ""
echo "Swap status:"
swapon --show
echo ""
echo "🎉 Swap configuration complete!"
echo ""
echo "Next steps:"
echo "  1. Pull latest changes: git pull origin main"
echo "  2. Restart CLI container: docker compose -f docker-compose.unified.yml restart cli"
echo "  3. Retry chaincode installation: bash scripts/unified-setup.sh"

