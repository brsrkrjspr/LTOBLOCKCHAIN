# Fix "Creator Org Unknown" Error - Quick Guide

## The Problem

You're seeing:
```
Error: access denied: channel [ltochannel] creator org unknown, creator is malformed
```

**Root Cause:** After reset, the MSP `admincerts` directories are missing or incorrect, so the peer can't validate identities.

## Quick Fix

Run this script:

```bash
bash scripts/fix-creator-org-unknown.sh
```

**What it does:**
1. ✅ Removes old chaincode containers (v1.0.2)
2. ✅ Fixes MSP admincerts at all levels (user, peer, organization)
3. ✅ Regenerates wallet with correct identity
4. ✅ Restarts peer to apply changes

## Manual Fix (if script doesn't work)

```bash
# 1. Stop old chaincode containers
docker ps -a | grep "dev-peer0.lto.gov.ph-vehicle-registration" | awk '{print $1}' | xargs docker rm -f

# 2. Fix admincerts
ADMIN_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/Admin@lto.gov.ph-cert.pem"

# User-level
mkdir -p fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/admincerts
cp "$ADMIN_CERT" fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/admincerts/

# Peer-level
mkdir -p fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts
cp "$ADMIN_CERT" fabric-network/crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp/admincerts/

# Organization-level (CRITICAL!)
mkdir -p fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/admincerts
cp "$ADMIN_CERT" fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/admincerts/

# 3. Regenerate wallet
rm -rf wallet
mkdir -p wallet
node scripts/setup-fabric-wallet.js

# 4. Restart peer
docker compose -f docker-compose.unified.yml restart peer0.lto.gov.ph
sleep 15

# 5. Test
docker exec peer0.lto.gov.ph peer lifecycle chaincode querycommitted --channelID ltochannel
```

## After Fix

1. **Restart application:**
   ```bash
   docker compose -f docker-compose.unified.yml restart lto-app
   ```

2. **Check logs:**
   ```bash
   docker logs lto-app --tail 30 | grep -i "fabric\|connected"
   ```

3. **Should see:**
   - ✅ `Connected to Hyperledger Fabric network successfully`
   - ✅ No more "access denied" errors

## Why This Happens

After reset:
- Certificates are regenerated
- MSP `admincerts` directories may be empty
- Peer can't validate identities without admincerts
- Wallet may have old identity

The fix ensures all MSP levels have the admin certificate, allowing proper identity validation.
