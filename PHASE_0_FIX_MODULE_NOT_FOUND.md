# Phase 0 Fix - MODULE_NOT_FOUND Error

## Problem
The script `backend/scripts/backfill-vehicles-blockchain-tx-id.js` was not found in the container because it was created after the Docker image was built.

## Solution: Copy Script to Container

Run these commands on your server:

```bash
# Step 1: Ensure scripts directory exists in container
docker exec lto-app mkdir -p /app/backend/scripts

# Step 2: Copy the script from host to container
docker cp backend/scripts/backfill-vehicles-blockchain-tx-id.js lto-app:/app/backend/scripts/backfill-vehicles-blockchain-tx-id.js

# Step 3: Verify script is in container
docker exec lto-app ls -la /app/backend/scripts/backfill-vehicles-blockchain-tx-id.js

# Step 4: Execute the backfill script
docker exec lto-app node /app/backend/scripts/backfill-vehicles-blockchain-tx-id.js
```

## Alternative: Rebuild Container (Permanent Fix)

If you want the script permanently in the container:

```bash
# Rebuild container with new script
docker compose -f docker-compose.unified.yml build lto-app

# Restart container
docker compose -f docker-compose.unified.yml up -d lto-app

# Wait for startup
sleep 10

# Execute script
docker exec lto-app node /app/backend/scripts/backfill-vehicles-blockchain-tx-id.js
```

## After Script Execution

Once the script runs successfully, verify results:

```bash
# Verify all REGISTERED vehicles now have blockchain_tx_id
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_registered, COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_tx_id, COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as missing_tx_id FROM vehicles WHERE status = 'REGISTERED';"
```

**Expected Result:** `missing_tx_id = 0`
