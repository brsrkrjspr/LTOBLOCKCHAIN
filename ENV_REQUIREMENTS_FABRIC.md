# Required .env Variables for Fabric Connection

## Critical Variables (MUST BE SET)

### 1. **BLOCKCHAIN_MODE** (REQUIRED)
```env
BLOCKCHAIN_MODE=fabric
```
- **MUST be exactly `"fabric"`** - no other values allowed
- Application will exit if this is not set or set to anything else
- No fallback modes - system requires real Hyperledger Fabric

### 2. **JWT_SECRET** (REQUIRED)
```env
JWT_SECRET=your-strong-random-secret-key-minimum-32-characters
```
- Required for authentication
- Generate with: `openssl rand -base64 32`
- Application will exit if missing

### 3. **STORAGE_MODE** (REQUIRED)
```env
STORAGE_MODE=ipfs
# OR
STORAGE_MODE=local
```
- Must be either `"ipfs"` or `"local"` (no `"auto"` mode)
- Application will exit if missing or invalid

### 4. **FABRIC_AS_LOCALHOST** (IMPORTANT for Docker)
```env
FABRIC_AS_LOCALHOST=false
```
- **Set to `false` when running in Docker** (like your DigitalOcean setup)
- Set to `true` only if running Fabric locally on your machine
- Defaults to `true` if not set, which will cause connection failures in Docker

## Fabric-Specific Variables (Optional - Have Defaults)

These have defaults but can be overridden:

```env
# Network configuration file path (default: ./network-config.json)
FABRIC_NETWORK_CONFIG=./network-config.json

# Channel name (default: ltochannel)
FABRIC_CHANNEL=ltochannel

# Chaincode name (default: vehicle-registration)
FABRIC_CHAINCODE=vehicle-registration

# Chaincode version (default: 1.0)
FABRIC_CHAINCODE_VERSION=1.0

# Network name (default: trustchain-network)
FABRIC_NETWORK_NAME=trustchain-network
```

## Database Variables (Optional - Set in docker-compose)

These are set in `docker-compose.unified.yml` but can be overridden:

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password
```

## IPFS Variables (Optional - Set in docker-compose)

```env
IPFS_HOST=ipfs
IPFS_PORT=5001
IPFS_PROTOCOL=http
```

## Complete Minimal .env for DigitalOcean/Docker

```env
# ============================================
# REQUIRED - Must be set
# ============================================
BLOCKCHAIN_MODE=fabric
JWT_SECRET=CHANGE-THIS-TO-A-STRONG-RANDOM-SECRET-KEY-MINIMUM-32-CHARACTERS
STORAGE_MODE=ipfs

# ============================================
# CRITICAL for Docker - Set to false
# ============================================
FABRIC_AS_LOCALHOST=false

# ============================================
# Optional - Database (defaults in docker-compose)
# ============================================
# DB_HOST=postgres
# DB_PORT=5432
# DB_NAME=lto_blockchain
# DB_USER=lto_user
# DB_PASSWORD=lto_password

# ============================================
# Optional - IPFS (defaults in docker-compose)
# ============================================
# IPFS_HOST=ipfs
# IPFS_PORT=5001
# IPFS_PROTOCOL=http

# ============================================
# Optional - Server
# ============================================
# PORT=3001
# NODE_ENV=production
```

## What Happens If Variables Are Missing?

### Missing `BLOCKCHAIN_MODE` or `BLOCKCHAIN_MODE != "fabric"`:
```
❌ CRITICAL: Fabric initialization failed: BLOCKCHAIN_MODE must be set to "fabric"
⚠️  System requires real Hyperledger Fabric network.
```
**Result:** Application exits immediately

### Missing `JWT_SECRET`:
```
Error: JWT_SECRET environment variable is required. Set it in .env file.
```
**Result:** Application exits immediately

### Missing `STORAGE_MODE` or invalid value:
```
❌ Invalid: STORAGE_MODE=... (expected: either "ipfs" or "local")
```
**Result:** Application exits immediately

### `FABRIC_AS_LOCALHOST=true` in Docker:
```
❌ Failed to connect to Fabric network: DiscoveryService: ltochannel error: access denied
```
**Result:** Application can't connect to Fabric (tries to use `localhost` instead of Docker service names)

## Verification Commands

Check if your .env is correct:

```bash
# Validate environment variables
node backend/validate-env.js

# Check if Fabric can connect
docker logs lto-app --tail 50 | grep -i "fabric\|connected\|error"
```

## Common Issues

### Issue: "BLOCKCHAIN_MODE must be set to fabric"
**Fix:** Add `BLOCKCHAIN_MODE=fabric` to `.env`

### Issue: "Fabric connection failed: DiscoveryService error"
**Fix:** Set `FABRIC_AS_LOCALHOST=false` in `.env` and restart app

### Issue: "Admin user not found in wallet"
**Fix:** Run `bash scripts/fix-creator-org-unknown.sh` or `node scripts/setup-fabric-wallet.js`

### Issue: "Network configuration file not found"
**Fix:** Ensure `network-config.json` exists in project root

## Quick Check Script

Create a file `check-env.sh`:

```bash
#!/bin/bash
echo "Checking .env variables..."
echo ""

if [ -f .env ]; then
    echo "✅ .env file exists"
    
    # Check required vars
    if grep -q "^BLOCKCHAIN_MODE=fabric" .env; then
        echo "✅ BLOCKCHAIN_MODE=fabric"
    else
        echo "❌ BLOCKCHAIN_MODE not set to 'fabric'"
    fi
    
    if grep -q "^JWT_SECRET=" .env && ! grep -q "^JWT_SECRET=CHANGE-THIS" .env; then
        echo "✅ JWT_SECRET is set"
    else
        echo "❌ JWT_SECRET not set or using default"
    fi
    
    if grep -q "^STORAGE_MODE=" .env; then
        STORAGE_MODE=$(grep "^STORAGE_MODE=" .env | cut -d'=' -f2)
        if [ "$STORAGE_MODE" = "ipfs" ] || [ "$STORAGE_MODE" = "local" ]; then
            echo "✅ STORAGE_MODE=$STORAGE_MODE"
        else
            echo "❌ STORAGE_MODE must be 'ipfs' or 'local'"
        fi
    else
        echo "❌ STORAGE_MODE not set"
    fi
    
    if grep -q "^FABRIC_AS_LOCALHOST=false" .env; then
        echo "✅ FABRIC_AS_LOCALHOST=false (correct for Docker)"
    else
        echo "⚠️  FABRIC_AS_LOCALHOST not set to 'false' (may cause Docker connection issues)"
    fi
else
    echo "❌ .env file not found"
    echo "   Copy ENV.example to .env and configure it"
fi
```

Run: `bash check-env.sh`
