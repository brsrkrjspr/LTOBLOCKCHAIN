# Immediate Diagnostic Commands

Run these commands to check what happened:

## 1. Check if Channel Was Created
```bash
docker exec peer0.lto.gov.ph peer channel list
```

## 2. Check Orderer Status
```bash
docker logs orderer.lto.gov.ph --tail 30 | grep -E "Beginning|Raft|error|panic"
```

## 3. Check Peer Status  
```bash
docker logs peer0.lto.gov.ph --tail 30 | grep -E "error|failed|certificate"
```

## 4. Check if Channel Block Exists
```bash
docker exec peer0.lto.gov.ph ls -la /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block
```

## Quick Fix: Manual Channel Creation

If channel wasn't created, run this:

```bash
# Wait for orderer to be ready (check logs)
docker logs orderer.lto.gov.ph | tail -20

# Once you see "Beginning to serve requests", create channel:
docker exec peer0.lto.gov.ph peer channel create \
  -o orderer.lto.gov.ph:7050 \
  -c ltochannel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel.tx \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt \
  --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
  --timeout 60s

# Join channel:
docker exec peer0.lto.gov.ph peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/ltochannel.block \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/orderer-tls-ca.crt

# Verify:
docker exec peer0.lto.gov.ph peer channel list
```

Then continue with chaincode deployment manually or re-run the reset script (it will skip channel creation if it exists).
