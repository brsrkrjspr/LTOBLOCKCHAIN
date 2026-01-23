# ✅ Query Fabric Vehicles - Fixed Command

## The Problem

The previous command had issues:
1. Bash interprets `!` as history expansion
2. Contract was null (connection not established)

## ✅ Solution: Use a Script File

I've created a script file. Use this instead:

```bash
# Copy the script to container
docker cp backend/scripts/query-fabric-vehicles.js lto-app:/app/backend/scripts/query-fabric-vehicles.js

# Run it
docker exec lto-app node backend/scripts/query-fabric-vehicles.js
```

## Alternative: Fixed One-Liner (No History Expansion)

If you prefer a one-liner, use this (escapes the `!`):

```bash
docker exec lto-app node -e "const fs=require('./backend/services/optimizedFabricService');(async()=>{if(!fs.isConnected)await fs.initialize();const r=await fs.contract.evaluateTransaction('GetAllVehicles');console.log('Vehicles:',r.toString().substring(0,500));})().catch(e=>{console.error('Error:',e.message);process.exit(1);});"
```

## Or: Check Database Instead (Simpler)

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_registered,
    COUNT(blockchain_tx_id) FILTER (WHERE blockchain_tx_id IS NOT NULL AND blockchain_tx_id != '') as with_blockchain_txid,
    COUNT(*) FILTER (WHERE blockchain_tx_id IS NULL OR blockchain_tx_id = '') as without_blockchain_txid
FROM vehicles 
WHERE status = 'REGISTERED';
"
```

This will show you how many vehicles have blockchain transaction IDs!
