#!/bin/bash
# Quick script to setup wallet only
# Use this if wallet setup failed during initial setup

set -e

echo "🔐 Setting up Fabric wallet..."

# Check if crypto materials exist
if [ ! -d "fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph" ]; then
    echo "❌ Crypto materials not found!"
    echo "💡 Run 'bash scripts/generate-crypto.sh' first"
    exit 1
fi

# Remove old wallet if it exists
if [ -d "wallet" ]; then
    echo "🧹 Cleaning old wallet..."
    rm -rf wallet/*
fi

# Run wallet setup
echo "📦 Creating wallet..."
node scripts/setup-fabric-wallet.js

if [ $? -eq 0 ]; then
    echo "✅ Wallet setup complete!"
    echo ""
    echo "You can now run: npm start"
else
    echo "❌ Wallet setup failed!"
    echo "Check the error messages above"
    exit 1
fi

