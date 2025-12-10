#!/bin/bash

# Quick fix: Change IPFS_HOST from 'ipfs' to 'localhost'
# (App runs on host, not in container, so needs localhost)

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found"
    exit 1
fi

echo "🔧 Fixing IPFS_HOST in .env file..."

# Backup
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Replace IPFS_HOST=ipfs with IPFS_HOST=localhost
sed -i 's/^IPFS_HOST=ipfs$/IPFS_HOST=localhost/' "$ENV_FILE" 2>/dev/null || \
sed -i 's/^IPFS_HOST=.*/IPFS_HOST=localhost/' "$ENV_FILE" 2>/dev/null

# If IPFS_HOST doesn't exist, add it
if ! grep -q "^IPFS_HOST=" "$ENV_FILE"; then
    echo "IPFS_HOST=localhost" >> "$ENV_FILE"
fi

# Ensure STORAGE_MODE=ipfs
sed -i 's/^STORAGE_MODE=.*/STORAGE_MODE=ipfs/' "$ENV_FILE" 2>/dev/null || \
if ! grep -q "^STORAGE_MODE=" "$ENV_FILE"; then
    echo "STORAGE_MODE=ipfs" >> "$ENV_FILE"
fi

echo "✅ Updated .env file:"
echo ""
grep -E "^IPFS_HOST=|^STORAGE_MODE=" "$ENV_FILE" | head -2
echo ""
echo "Now restart the application: npm start"

