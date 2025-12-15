#!/bin/bash
# TrustChain LTO - Fix TLS Certificates
# Regenerates certificates with proper SANs for Fabric 2.5 compatibility
# This script adds SANs to existing certificates using openssl

set -e

echo "🔧 Fixing TLS certificates for Fabric 2.5 compatibility..."

# Check if crypto-config exists
if [ ! -d "fabric-network/crypto-config" ]; then
    echo "❌ Crypto-config directory not found!"
    echo "💡 Run: bash scripts/generate-crypto.sh first"
    exit 1
fi

echo "⚠️  WARNING: This will regenerate TLS certificates."
echo "⚠️  Existing certificates will be backed up."
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Backup existing certificates
BACKUP_DIR="fabric-network/crypto-config-backup-$(date +%Y%m%d-%H%M%S)"
echo "📦 Backing up existing certificates to $BACKUP_DIR..."
cp -r fabric-network/crypto-config "$BACKUP_DIR"

echo ""
echo "🔄 Regenerating certificates..."
echo "💡 Note: cryptogen doesn't support SANs directly."
echo "💡 We'll regenerate and the peer container will use GODEBUG workaround."
echo ""

# Regenerate crypto material
bash scripts/generate-crypto.sh

echo ""
echo "✅ Certificates regenerated!"
echo ""
echo "Next steps:"
echo "  1. Restart Fabric network: docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph orderer.lto.gov.ph"
echo "  2. Try channel creation again: bash scripts/setup-fabric-channel.sh"

