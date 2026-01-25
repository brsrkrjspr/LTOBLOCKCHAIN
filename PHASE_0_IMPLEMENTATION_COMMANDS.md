# Phase 0 Implementation - Commands Ready to Execute

## Prerequisites Check

### Option A: If running on server with Docker
```bash
# Check if containers are running
docker ps | grep -E "lto-app|postgres"
```

### Option B: If running locally without Docker
```bash
# Check if Node.js and database connection work
node -e "require('dotenv').config(); console.log('DB_HOST:', process.env.DB_HOST)"
```

---

## Step 1: Check Scope (Count vehicles needing backfill)

### Via Docker (Server):
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(DISTINCT v.id) as vehicles_needing_backfill FROM vehicles v JOIN vehicle_history vh ON v.id = vh.vehicle_id WHERE v.status = 'REGISTERED' AND (v.blockchain_tx_id IS NULL OR v.blockchain_tx_id = '') AND vh.action = 'BLOCKCHAIN_REGISTERED' AND vh.transaction_id IS NOT NULL AND vh.transaction_id != '' AND vh.transaction_id NOT LIKE '%-%';"
```

### Direct PostgreSQL (if accessible):
```bash
psql -U lto_user -d lto_blockchain -c "SELECT COUNT(DISTINCT v.id) as vehicles_needing_backfill FROM vehicles v JOIN vehicle_history vh ON v.id = vh.vehicle_id WHERE v.status = 'REGISTERED' AND (v.blockchain_tx_id IS NULL OR v.blockchain_tx_id = '') AND vh.action = 'BLOCKCHAIN_REGISTERED' AND vh.transaction_id IS NOT NULL AND vh.transaction_id != '' AND vh.transaction_id NOT LIKE '%-%';"
```

---

## Step 2: Create Database Backup (SAFETY FIRST)

### Via Docker:
```bash
docker exec postgres pg_dump -U lto_user lto_blockchain > backup_before_phase0_$(date +%Y%m%d_%H%M%S).sql
```

### Direct:
```bash
pg_dump -U lto_user lto_blockchain > backup_before_phase0_$(date +%Y%m%d_%H%M%S).sql
```

**Verify backup:**
```bash
ls -lh backup_before_phase0_*.sql
```

---

## Step 3: Execute Backfill Script

### ⚠️ IMPORTANT: Script Not in Container Yet

Since the script was just created, it's not in the Docker image. Use one of these methods:

### Option A: Copy Script to Container (Quick Fix - Recommended):
```bash
# Copy the script into the running container
docker cp backend/scripts/backfill-vehicles-blockchain-tx-id.js lto-app:/app/backend/scripts/backfill-vehicles-blockchain-tx-id.js

# Ensure the scripts directory exists
docker exec lto-app mkdir -p /app/backend/scripts

# Now execute the script
docker exec lto-app node /app/backend/scripts/backfill-vehicles-blockchain-tx-id.js
```

### Option B: Rebuild Container (Permanent Fix):
```bash
# Rebuild the container to include the new script
docker compose -f docker-compose.unified.yml build lto-app

# Restart the container
docker compose -f docker-compose.unified.yml up -d lto-app

# Wait for container to start
sleep 10

# Execute the script
docker exec lto-app node /app/backend/scripts/backfill-vehicles-blockchain-tx-id.js
```

### Option C: Direct Node.js (If running locally without Docker):
```bash
# Make sure you're in the project root
cd /path/to/LTOBLOCKCHAIN
node backend/scripts/backfill-vehicles-blockchain-tx-id.js
```

---

## Step 4: Verify Results

### Check all REGISTERED vehicles now have blockchain_tx_id:

**Via Docker:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_registered, COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_tx_id, COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as missing_tx_id FROM vehicles WHERE status = 'REGISTERED';"
```

**Direct:**
```bash
psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_registered, COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_tx_id, COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as missing_tx_id FROM vehicles WHERE status = 'REGISTERED';"
```

**Expected Result:** `missing_tx_id = 0`

### Cross-reference verification (verify blockchain_tx_id matches history):

**Via Docker:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT v.id, v.vin, v.blockchain_tx_id as vehicles_tx_id, vh.transaction_id as history_tx_id, CASE WHEN v.blockchain_tx_id = vh.transaction_id THEN 'MATCH' ELSE 'MISMATCH' END as status FROM vehicles v JOIN vehicle_history vh ON v.id = vh.vehicle_id WHERE v.status = 'REGISTERED' AND vh.action = 'BLOCKCHAIN_REGISTERED' AND v.blockchain_tx_id IS NOT NULL ORDER BY vh.performed_at DESC LIMIT 20;"
```

**Expected Result:** All rows should show `status = 'MATCH'`

---

## Troubleshooting

### If script fails with "Cannot find module":
```bash
# Make sure you're in the correct directory
cd /path/to/LTOBLOCKCHAIN

# Check if script exists
ls -la backend/scripts/backfill-vehicles-blockchain-tx-id.js

# Install dependencies if needed
npm install
```

### If database connection fails:
```bash
# Check .env file has correct database credentials
cat .env | grep DB_

# Test database connection
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT 1;"
```

### If no vehicles found:
- This is actually **GOOD** - means all vehicles already have `blockchain_tx_id`
- Proceed to Phase 1 implementation

---

## Success Criteria

✅ **Phase 0 Complete when:**
- [ ] Backup created successfully
- [ ] Backfill script executed without errors
- [ ] Verification query shows `missing_tx_id = 0`
- [ ] Cross-reference verification shows all `MATCH`
- [ ] No errors in script output

**Next Step:** Proceed to Phase 1 implementation
