# Resolving "Blockchain transfer failed" (500) on Transfer Approval

When admin clicks **Approve** on a transfer request, the API returns **500 Internal Server Error** with message `Blockchain transfer failed`. This document explains the cause and resolution steps.

---

## Root Cause

The 500 occurs in **POST `/api/vehicles/transfer/requests/:id/approve`** when the mandatory Hyperledger Fabric `transferOwnership` call fails. Common causes:

1. **Chaincode not installed on HPG/Insurance peers** – The endorsement policy `AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))` requires LTO + (HPG or Insurance) to endorse. If the chaincode is only installed on LTO, discovery cannot satisfy the policy.
2. **Fabric discovery/chaincode errors** – Discovery cannot build endorsement plan because required peers lack the chaincode.
3. **Fabric not connected** – `fabricService.isConnected` is false (would return 503, not 500)
4. **No transaction ID returned** – Chaincode executes but SDK doesn't return a transaction ID

---

## Resolution Steps (in order)

### Step 1: Get the exact error from backend logs

On your server:

```bash
docker logs lto-app --tail 100 2>&1 | grep -A 5 "Blockchain transfer failed\|CRITICAL\|transferOwnership\|DiscoveryService"
```

If you see **"no peer combination can satisfy the endorsement policy"** or **"failed constructing descriptor"**, the chaincode is likely missing on HPG and/or Insurance peers.

---

### Step 2: Install chaincode on ALL peers (recommended fix)

The endorsement policy requires HPG and Insurance to participate. Install the chaincode on their peers:

```bash
cd ~/LTOBLOCKCHAIN   # or your project root
bash scripts/install-chaincode-on-all-peers.sh
```

This installs the chaincode on HPG and Insurance peers. If you need a full reinstall (including LTO), run:

```bash
bash scripts/install-chaincode-ccaas.sh
```

The updated `install-chaincode-ccaas.sh` now installs on **all three** peers (LTO, HPG, Insurance) by default.

---

### Step 3: Restart Fabric components (refresh discovery)

```bash
docker restart peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph
sleep 5
docker restart chaincode-vehicle-reg
sleep 5
docker compose -f docker-compose.unified.yml restart lto-app
```

---

### Step 4: Verify chaincode on all peers

```bash
# Check LTO
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=LTOMSP CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051 CORE_PEER_TLS_ENABLED=true CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp; peer lifecycle chaincode queryinstalled"

# Check HPG (switch CORE_PEER_* to hpg)
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=HPGMSP CORE_PEER_ADDRESS=peer0.hpg.gov.ph:8051 CORE_PEER_TLS_ENABLED=true CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/peers/peer0.hpg.gov.ph/tls/ca.crt CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/hpg.gov.ph/users/Admin@hpg.gov.ph/msp; peer lifecycle chaincode queryinstalled"

# Check Insurance (switch to insurance)
docker exec cli bash -c "export CORE_PEER_LOCALMSPID=InsuranceMSP CORE_PEER_ADDRESS=peer0.insurance.gov.ph:9051 CORE_PEER_TLS_ENABLED=true CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/peers/peer0.insurance.gov.ph/tls/ca.crt CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/insurance.gov.ph/users/Admin@insurance.gov.ph/msp; peer lifecycle chaincode queryinstalled"
```

Each should list `vehicle-registration_1.0`.

---

### Step 5: Alternative – OR policy (fallback only)

If you cannot get HPG/Insurance peers to work (e.g. crypto/config issues), you can temporarily use an OR policy so LTO alone can endorse:

```bash
bash scripts/fix-endorsement-policy.sh
```

**Note:** This bypasses HPG and Insurance participation. Use only as a fallback; the proper fix is installing chaincode on all peers.

---

## Summary

1. **Install chaincode on HPG and Insurance peers** – `scripts/install-chaincode-on-all-peers.sh`
2. **Restart** peers, chaincode container, and lto-app
3. **Verify** chaincode is installed on all three peers
4. **Retry** transfer approval

The endorsement policy `AND(LTOMSP, OR(HPGMSP, InsuranceMSP))` is intentional so HPG and Insurance participate. Ensure the chaincode is installed on all peers.
