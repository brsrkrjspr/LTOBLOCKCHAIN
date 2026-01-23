# Why TLS Errors After Reset? - Explanation & Fix

## The Problem

After resetting Fabric, you're seeing TLS certificate errors because:

1. **Certificates were regenerated** - New certificates = new keys
2. **Orderer is configured for Raft clustering** - It tries to connect to itself
3. **Orderer's MSP missing TLS CA** - The orderer can't verify its own certificate

## What's Happening

The orderer logs show:
```
tls: failed to verify certificate: x509: certificate signed by unknown authority
```

This happens because:
- Orderer has new TLS certificates after reset
- Orderer's MSP (`/var/hyperledger/orderer/msp/tlscacerts/`) doesn't have the TLS CA certificate
- When orderer tries to cluster/replicate with itself, it can't verify its own certificate

## The Fix

Run this script to fix the orderer's MSP:

```bash
bash scripts/fix-orderer-tls-errors.sh
```

**What it does:**
1. Copies orderer's TLS CA certificate to orderer's MSP `tlscacerts` directory
2. Restarts orderer to apply changes
3. Verifies the fix worked

## Manual Fix (if script doesn't work)

```bash
# 1. Copy TLS CA to orderer MSP
cp fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt \
   fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# 2. Restart orderer
docker compose -f docker-compose.unified.yml restart orderer.lto.gov.ph

# 3. Wait for orderer to be ready
docker logs -f orderer.lto.gov.ph
# Wait for "Beginning to serve requests", then Ctrl+C
```

## Why This Happens After Reset

**Normal flow:**
1. Generate certificates → TLS CA created
2. Setup TLS certs → Copies certs to TLS directories
3. Fix MSP → Should copy TLS CA to MSP tlscacerts
4. Start orderer → Orderer trusts its own certificate ✅

**What went wrong:**
- Step 3 (`fix-fabric-ca-chain.sh`) may have run before TLS certs were fully set up
- Or the orderer MSP tlscacerts wasn't properly configured
- Result: Orderer can't verify its own certificate ❌

## Verification

After running the fix, check:

```bash
# 1. Check if TLS CA is in MSP
ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/

# Should show: tlsca.lto.gov.ph-cert.pem

# 2. Check orderer logs (should see fewer TLS errors)
docker logs orderer.lto.gov.ph --tail 30 | grep -i tls

# 3. Wait for orderer to be ready
docker logs orderer.lto.gov.ph | grep "Beginning to serve requests"
```

## Important Note

**The channel already exists!** ✅
- Line 55 shows: `Channels peers has joined: ltochannel`
- This means channel creation actually succeeded
- The TLS errors are just orderer clustering issues, not blocking channel operations

## Next Steps

1. **Fix orderer TLS** (run the script above)
2. **Continue with chaincode deployment** - Channel is ready!
3. **Ignore clustering errors** - They're warnings, not blocking errors

The system is functional - the TLS errors are just noise from orderer trying to cluster with itself.
