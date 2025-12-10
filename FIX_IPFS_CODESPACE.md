# Fix IPFS for Real Service in Codespace

## Quick Fix (One Command)

Run this to configure IPFS for real service (no fallbacks):

```bash
bash scripts/configure-ipfs-real.sh
```

This will:
1. ✅ Verify IPFS container is running
2. ✅ Test IPFS connectivity
3. ✅ Configure `.env` with `STORAGE_MODE=ipfs` and `IPFS_HOST=ipfs`
4. ✅ Verify configuration

---

## Manual Fix

If you prefer to do it manually:

### Step 1: Verify IPFS is Running

```bash
docker ps | grep ipfs
```

Should show IPFS container running.

### Step 2: Test IPFS (Correct Method)

The IPFS API requires **POST** requests, not GET:

```bash
# Correct way (POST):
curl -X POST http://localhost:5001/api/v0/version

# Should return: {"Version":"0.39.0",...}
```

### Step 3: Configure Environment Variables

Edit or create `.env` file:

```bash
# Add or update these lines in .env:
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs
```

**Important:**
- `IPFS_HOST=localhost` (app runs on host, IPFS port is exposed to host)
- `STORAGE_MODE=ipfs` (not `auto` or `local`) - no fallbacks, real service only

### Step 4: Verify Configuration

```bash
# Check your .env file
grep -E "^IPFS_|^STORAGE_MODE=" .env
```

Should show:
```
IPFS_HOST=ipfs
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs
```

### Step 5: Restart Application

```bash
npm start
```

### Step 6: Verify IPFS is Being Used

Check application logs for:
- ✅ `🌐 Using IPFS storage mode` - IPFS is working
- ❌ `❌ IPFS initialization failed` - IPFS connection failed (app will exit)

---

## Verification

After starting the app, you should see in logs:

```
🔗 Connecting to IPFS at http://ipfs:5001...
✅ Connected to IPFS version 0.39.0
📦 Storage service initialized: ipfs mode
```

If you see:
```
❌ IPFS initialization failed
❌ CRITICAL: IPFS mode required but initialization failed
```

Then IPFS connection failed. Check:
1. IPFS container is running: `docker ps | grep ipfs`
2. IPFS is accessible: `docker exec ipfs ipfs version`
3. Network connectivity: `docker network inspect trustchain`

---

## Troubleshooting

### IPFS Container Not Running

```bash
docker-compose -f docker-compose.unified.yml up -d ipfs
sleep 15
docker exec ipfs ipfs version
```

### IPFS Not Accessible from Application

The application connects via container name `ipfs`, not `localhost`. Verify:

```bash
# Test from inside Docker network
docker run --rm --network trustchain curlimages/curl:latest curl -X POST http://ipfs:5001/api/v0/version
```

### Wrong STORAGE_MODE

If `STORAGE_MODE` is `auto` or `local`, change it:

```bash
# Edit .env and change:
STORAGE_MODE=ipfs
```

### Application Still Using Local Storage

1. Check `.env` file has `STORAGE_MODE=ipfs`
2. Restart application: `npm start`
3. Check logs for storage mode message
4. If still using local, IPFS connection is failing - check IPFS logs: `docker logs ipfs`

---

## Expected Behavior

With `STORAGE_MODE=ipfs`:
- ✅ Application **requires** IPFS to be available
- ✅ Application will **exit** if IPFS is not available (no fallback)
- ✅ All documents stored on IPFS
- ✅ All documents get IPFS CID
- ✅ No local file storage fallback

This ensures you're using **real IPFS service only**.

