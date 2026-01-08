# Analyzing Transaction Proof Error - Step by Step Guide

## Step 1: Check Server Logs (Diagnostic)

### **Command to Run:**

```bash
# Option A: If using docker-compose
docker-compose logs -f lto-app

# Option B: If using docker directly
docker logs -f lto-app

# Option C: View last 100 lines with timestamps
docker logs -t lto-app --tail 100
```

### **What to Look For:**

When you click "View Proof" in the browser, watch the server logs for:

1. **Error Details Object:**
   ```
   Error details: {
     channelExists: true/false,
     channelType: '...',
     hasQueryTransaction: true/false,
     hasQueryBlockByTxID: true/false,
     hasQueryBlock: true/false,
     errorMessage: '...',
     errorStack: '...'
   }
   ```

2. **Specific Error Messages:**
   - `TypeError: this.channel.queryTransaction is not a function`
   - `TypeError: this.channel.queryBlockByTxID is not a function`
   - `Failed to get chain info: ...`
   - `Transaction ... not found in any block`

3. **Warning Messages:**
   - `⚠️ Native queryTransaction/queryBlockByTxID failed`
   - `⚠️ Using block-scan fallback for transaction proof`
   - `⚠️ Failed to summarize block`

### **Expected Output:**

The logs will tell us:
- ✅ **If methods exist:** `hasQueryTransaction: true/false`
- ✅ **What error occurred:** The actual error message
- ✅ **If fallback was used:** Block-scan warnings
- ✅ **Where it failed:** Error stack trace

---

## Step 2: Analyze the Results

Based on what you see in the logs, we'll determine which option to implement:

### **Scenario A: Methods Don't Exist**
```
hasQueryTransaction: false
hasQueryBlockByTxID: false
```
**→ Solution:** Implement **Option 3 (Pure Block-Scan)** - Most likely scenario

### **Scenario B: Methods Exist But Fail**
```
hasQueryTransaction: true
hasQueryBlockByTxID: true
errorMessage: "Transaction not found" or "Network error"
```
**→ Solution:** Fix the method calls or use **Option 2 (qscc)**

### **Scenario C: Block-Scan Also Fails**
```
⚠️ Using block-scan fallback
errorMessage: "Cannot determine chain height" or "Failed to query block"
```
**→ Solution:** Fix `getChainInfo()` or implement direct block querying

---

## Step 3: Implement the Fix

Once we know the root cause, we'll implement the appropriate solution.

---

## Quick Test Command

Run this to capture logs while testing:

```bash
# Terminal 1: Watch logs
docker logs -f lto-app | grep -i "proof\|transaction\|error\|warn"

# Terminal 2: Or capture to file
docker logs lto-app --tail 200 > proof-error-logs.txt 2>&1
```

Then click "View Proof" in the browser and check the output.
