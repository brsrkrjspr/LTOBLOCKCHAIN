#!/bin/bash
# Update .env file for Codespace deployment

ENV_FILE=".env"

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup"
    echo "Backed up existing .env to .env.backup"
fi

# Update or add Codespace-specific values
cat >> "$ENV_FILE" << 'EOF'

# Codespace Configuration (added by update script)
# Database - use container names in Codespace
DB_HOST=postgres
DB_PORT=5432

# IPFS - use localhost (app runs on host, IPFS port is exposed)
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs

# Redis - use container name
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Blockchain - Fabric mode required
BLOCKCHAIN_MODE=fabric
FABRIC_NETWORK_CONFIG=./network-config.json
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration
EOF

echo "Updated .env file for Codespace deployment"
echo "Please review and adjust values as needed"

