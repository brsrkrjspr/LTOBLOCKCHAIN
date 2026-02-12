#!/usr/bin/env bash
set +e

header () {
  echo ""
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

header "1) Running Fabric containers"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

header "2) Peer + Orderer containers"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "peer0\.lto|peer0\.hpg|peer0\.insurance|orderer"

header "3) Ledger persistence volumes"
docker volume ls --format "{{.Name}}" | grep -E "peer-data|peer-hpg-data|peer-insurance-data|orderer-data|couchdb-data"

header "4) Peer ledger mount points"
docker inspect -f "{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}" peer0.lto.gov.ph

header "5) CouchDB configured as state DB (peer env)"
docker exec peer0.lto.gov.ph env | grep -E "CORE_LEDGER_STATE|COUCHDB"

header "6) CouchDB health check"
curl -s http://127.0.0.1:5984/_up

header "7) Channel list (CLI container)"
docker exec cli bash -c "peer channel list"

header "8) Chaincode committed on channel"
docker exec cli bash -c "peer lifecycle chaincode querycommitted -C ltochannel"

header "9) Latest block info"
docker exec cli bash -c "peer channel getinfo -c ltochannel"

echo ""
echo "Done."
