# Resolving "Blockchain transfer failed" (500) on Transfer Approval

When admin clicks **Approve** on a transfer request, the API returns **500 Internal Server Error** with message `Blockchain transfer failed`. This document explains the cause and resolution steps.

---

## Root Cause

The 500 occurs in **POST `/api/vehicles/transfer/requests/:id/approve`** when the mandatory Hyperledger Fabric `transferOwnership` call fails. Common causes:

1. **Fabric discovery/chaincode errors** – Discovery cannot locate chaincode or build endorsement plan
2. **Endorsement policy requires multiple orgs** – Current policy `AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))` requires LTO + (HPG or Insurance). If HPG/Insurance peers have connectivity issues, endorsement fails
3. **Fabric not connected** – `fabricService.isConnected` is false (would return 503, not 500)
4. **No transaction ID returned** – Chaincode executes but SDK doesn't return a transaction ID

---

## Resolution Steps (in order)

### Step 1: Get the exact error from backend logs

On your server:

```bash
docker logs lto-app --tail 100 2>&1 | grep -A 5 "Blockchain transfer failed\|CRITICAL\|transferOwnership\|DiscoveryService"
```

Note the exact error message. If it mentions **DiscoveryService** or **failed constructing descriptor**, proceed to Step 2.

---

### Step 2: Verify Fabric connectivity from the app

```bash
# Run the built-in diagnostic
bash scripts/diagnose-approval-failure.sh
```

Or manually test Fabric connection:

```bash
docker exec lto-app node -e "
const fabricService = require('./services/optimizedFabricService');
fabricService.initialize()
  .then(() => {
    console.log('SUCCESS: Fabric connected');
    console.log('isConnected:', fabricService.isConnected);
    process.exit(0);
  })
  .catch(err => {
    console.log('ERROR:', err.message);
    process.exit(1);
  });
"
```

If this fails, check:
- `BLOCKCHAIN_MODE=fabric` in lto-app environment
- `network-config.json` exists and is mounted
- `wallet` directory exists with admin identity
- All Fabric containers are on the same Docker network (`trustchain`)

---

### Step 3: Simplify endorsement policy (most common fix)

The current policy **requires LTO + (HPG or Insurance)**. If HPG/Insurance peers have gossip/connectivity issues, discovery or endorsement can fail.

**Fix: Use OR policy** so LTO alone can endorse:

```bash
cd ~/LTOBLOCKCHAIN   # or your project root
bash scripts/fix-endorsement-policy.sh
```

This re-commits the chaincode with `OR('LTOMSP.peer', 'HPGMSP.peer', 'InsuranceMSP.peer')` – any single org can endorse.

Then restart the app:

```bash
docker compose -f docker-compose.unified.yml restart lto-app
```

---

### Step 4: Restart Fabric components (refresh discovery)

If the endorsement policy fix doesn't resolve it:

```bash
# Restart peer to refresh discovery cache
docker restart peer0.lto.gov.ph
sleep 5

# Restart HPG and Insurance peers (if they had connectivity warnings)
docker restart peer0.hpg.gov.ph peer0.insurance.gov.ph
sleep 5

# Restart chaincode container
docker restart chaincode-vehicle-reg
sleep 5

# Restart app to re-establish Fabric connection
docker compose -f docker-compose.unified.yml restart lto-app
```

---

### Step 5: Verify chaincode is invokable

From the CLI container:

```bash
docker exec cli bash -c "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'
"
```

If this fails, the chaincode is not properly installed/committed on the peer.

---

### Step 6: Quick checklist

| Check | Command |
|-------|---------|
| BLOCKCHAIN_MODE | `docker exec lto-app printenv BLOCKCHAIN_MODE` |
| Fabric containers | `docker ps \| grep -E "peer\|chaincode\|orderer"` |
| Chaincode committed | `docker exec cli peer lifecycle chaincode querycommitted -C ltochannel -n vehicle-registration` |
| App health | `curl -s https://ltoblockchain.duckdns.org/api/health \| jq` |

---

## Summary

1. **Get exact error** from `docker logs lto-app`
2. **Run** `scripts/diagnose-approval-failure.sh`
3. **Apply** `scripts/fix-endorsement-policy.sh` (OR policy)
4. **Restart** all Fabric components and lto-app
5. **Retry** transfer approval

The OR endorsement policy is the most likely fix when discovery or multi-org endorsement fails.
