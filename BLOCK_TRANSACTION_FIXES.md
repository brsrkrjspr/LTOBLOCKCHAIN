# Block and Transaction Display Fixes

## Issues Identified

1. **Blocks show 0 transactions** - `extractTxIdsFromBlock()` wasn't properly decoding protobuf envelopes
2. **History records not loading** - Endpoint was filtering from Fabric transactions instead of querying PostgreSQL
3. **Transactions missing block numbers** - Transactions from chaincode queries don't include block numbers
4. **50 transactions are real Fabric** - Yes, they're real Fabric transactions (64-char hex IDs)

## Fixes Applied

### 1. Fixed `extractTxIdsFromBlock()` - Proper Protobuf Decoding

**Problem:** The function was trying to access `block?.data?.data` directly, but in fabric-protos, `data.data` is an array of **bytes** (envelopes), not decoded objects.

**Solution:** Decode each envelope using `fabric-protos.common.Envelope.decode()`, then extract the transaction ID from the channel header.

```javascript
extractTxIdsFromBlock(block) {
    const envelopeBytes = block?.data?.data || [];
    const txIds = [];
    const fabricProtos = require('fabric-protos');
    
    for (const envelopeBytesItem of envelopeBytes) {
        const envelope = fabricProtos.common.Envelope.decode(envelopeBytesItem);
        const payload = fabricProtos.common.Payload.decode(envelope.payload);
        const channelHeader = fabricProtos.common.ChannelHeader.decode(payload.header.channel_header);
        
        if (channelHeader.tx_id) {
            txIds.push(channelHeader.tx_id);
        }
    }
    
    return txIds;
}
```

### 2. Fixed History Records Endpoint - Query PostgreSQL Directly

**Problem:** The endpoint was filtering from `getAllTransactions()`, but if all transactions have 64-char hex IDs (real Fabric), there would be no history records.

**Solution:** Query PostgreSQL `vehicle_history` table directly for records that are NOT real Fabric transactions (non-64-char hex IDs or NULL).

```javascript
// Query vehicle_history where transaction_id is NOT a 64-char hex
const result = await db.query(`
    SELECT vh.*, v.vin, v.plate_number, ...
    FROM vehicle_history vh
    WHERE (vh.transaction_id IS NULL 
       OR vh.transaction_id NOT SIMILAR TO '[a-f0-9]{64}'
       OR LENGTH(COALESCE(vh.transaction_id, '')) != 64)
    ...
`);
```

### 3. Added Block Number Lookup for Transactions

**Problem:** Transactions from `getAllTransactions()` come from chaincode queries, which don't include block numbers.

**Solution:** When building transactions, query all blocks and create a map of `txId -> blockNumber`, then assign block numbers to transactions.

```javascript
// Get all blocks to map transactions to block numbers
const blocks = await this.getAllBlocks();
const blockMap = new Map(); // txId -> blockNumber
blocks.forEach(block => {
    block.txIds.forEach(txId => {
        blockMap.set(txId, block.blockNumber);
    });
});

// Assign block numbers to transactions
transactions.push({
    ...
    blockNumber: blockMap.get(vehicle.blockchainTxId) || null,
    ...
});
```

### 4. Fixed Timestamp Extraction in `summarizeBlock()`

**Problem:** Timestamp extraction wasn't working for protobuf blocks.

**Solution:** Decode envelopes and extract timestamp from channel header, converting protobuf Timestamp to JavaScript Date.

## Expected Results After Rebuild

1. **Blocks should show transaction counts** - Each block will display the actual number of transactions it contains
2. **History records should load** - Will show off-chain history records from PostgreSQL
3. **Transactions should have block numbers** - Real Fabric transactions will show which block they're in
4. **50 transactions confirmed** - These are real Fabric transactions with 64-char hex IDs

## Testing After Rebuild

1. **Check Blocks Tab:**
   - Blocks should show `Tx Count: X` where X > 0 (not 0)
   - Each block should list transaction IDs

2. **Check History Records Tab:**
   - Should show history records from PostgreSQL
   - Should NOT show the loading spinner indefinitely

3. **Check Blockchain Transactions Tab:**
   - Transactions should show block numbers (not "N/A")
   - All 50 transactions should be real Fabric (64-char hex IDs)

4. **Check Transaction Details:**
   - Click on a transaction - should show block number
   - "View Proof" button should work

## Notes

- Block number lookup adds a small performance overhead (queries all blocks once)
- History records are limited to 1000 most recent
- If blocks still show 0 transactions, check server logs for protobuf decoding errors
