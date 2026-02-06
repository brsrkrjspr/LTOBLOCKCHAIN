#!/usr/bin/env bash
set -euo pipefail

echo "== Peer container health =="
docker ps | grep -E "(peer0|orderer|chaincode|cli|couchdb)"

echo "== Peer logs (LTO/HPG/Insurance) last 200 lines =="
for p in peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph; do
  echo "--- $p ---"
  docker logs "$p" --tail 200 || true
done

echo "== Chaincode logs (vehicle-registration) last 200 lines =="
docker logs chaincode-vehicle-reg --tail 200 || true

echo "== Check chaincode error lines =="
docker logs chaincode-vehicle-reg 2>&1 | grep -i error | tail -n 50 || true

echo "== Channel/chaincode query smoke tests =="
docker exec cli peer chaincode query -C ltochannel -n vehicle-registration -c '{"function":"GetSystemStats","Args":[]}' || true
docker exec cli peer chaincode query -C ltochannel -n vehicle-registration -c '{"function":"GetAllVehicles","Args":[]}' | head -c 1000 || true

echo "== If endorsement errors appear, consider re-committing with OR policy via scripts/fix-endorsement-policy.sh =="