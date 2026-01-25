#!/bin/bash

# Final Fix: Create minimal core.yaml with mode: dev
# Fabric 2.5 peer requires a config file, but we can use a minimal one with mode: dev
# This allows built-in handlers for system chaincodes (escc, vscc, etc.)

set -e

echo "=========================================="
echo "Final Fix: Create Minimal core.yaml with mode: dev"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Creating config directory..."
mkdir -p fabric-network/config

echo ""
echo "Step 2: Creating minimal core.yaml with mode: dev..."
cat > fabric-network/config/core.yaml << 'EOF'
peer:
  id: peer0.lto.gov.ph
  networkId: dev
  listenAddress: 0.0.0.0:7051
  chaincodeListenAddress: 0.0.0.0:7052
  address: peer0.lto.gov.ph:7051
  addressAutoDetect: false
  gomaxprocs: 2
  keepalive:
    minInterval: 60s
    client:
      interval: 60s
      timeout: 20s
    deliveryClient:
      interval: 60s
      timeout: 20s
  gossip:
    bootstrap: peer0.lto.gov.ph:7051
    useLeaderElection: true
    orgLeader: false
    membershipTrackerInterval: 5s
  events:
    address: 0.0.0.0:7053
    buffersize: 100
    timeout: 10s
    timewindow: 15m
    keepalive:
      minInterval: 60s
    sendTimeout: 60s
  tls:
    enabled: true
    clientAuthRequired: false
    cert:
      file: /etc/hyperledger/fabric/tls/server.crt
    key:
      file: /etc/hyperledger/fabric/tls/server.key
    rootcert:
      file: /etc/hyperledger/fabric/tls/ca.crt
    clientRootCAs:
      files: []
  fileSystemPath: /var/hyperledger/production
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256
vm:
  endpoint: unix:///host/var/run/docker.sock
chaincode:
  builder: $(DOCKER_NS)/fabric-ccenv:$(ARCH)-$(PROJECT_VERSION)
  pull: false
  startuptimeout: 300s
  executetimeout: 300s
  mode: dev
  keepalive: 0
  system:
    cscc: enable
    lscc: enable
    escc: enable
    vscc: enable
    qscc: enable
  logging:
    level: INFO
    shim: WARNING
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
ledger:
  state:
    stateDatabase: CouchDB
    couchDBConfig:
      couchDBAddress: couchdb:5984
      username: admin
      password: adminpw
      maxRetries: 3
      maxRetriesOnStartup: 10
      requestTimeout: 35s
      queryLimit: 10000
      maxBatchUpdateSize: 1000
      warmIndexesAfterNBlocks: 1
      createGlobalChangesDB: false
metrics:
  provider: disabled
EOF

echo "✓ core.yaml created with mode: dev"

echo ""
echo "Step 3: Verifying docker-compose.unified.yml has config mount..."
if grep -q "fabric-network/config:/var/hyperledger/fabric/config" docker-compose.unified.yml; then
    echo "✓ Config mount found in docker-compose.unified.yml"
else
    echo "⚠ Config mount not found - please update docker-compose.unified.yml"
    exit 1
fi

if grep -q "FABRIC_CFG_PATH=/var/hyperledger/fabric/config" docker-compose.unified.yml; then
    echo "✓ FABRIC_CFG_PATH found in docker-compose.unified.yml"
else
    echo "⚠ FABRIC_CFG_PATH not found - please update docker-compose.unified.yml"
    exit 1
fi

echo ""
echo "Step 4: Stopping containers completely..."
docker-compose -f docker-compose.unified.yml down

echo ""
echo "Step 5: Starting all containers with new config..."
docker-compose -f docker-compose.unified.yml up -d

echo ""
echo "Step 6: Waiting for peer to start (30 seconds)..."
sleep 30

echo ""
echo "Step 7: Checking peer status..."
if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "✓ Peer container is running"
else
    echo "✗ Peer container is not running!"
    echo "Checking logs..."
    docker logs peer0.lto.gov.ph 2>&1 | tail -30
    exit 1
fi

echo ""
echo "Step 8: Checking peer logs for errors..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "FABRIC_CFG_PATH\|config file.*not found\|fatal error"; then
    echo "⚠ WARNING: Still seeing config file errors"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "FABRIC_CFG_PATH\|config file.*not found\|fatal error" | tail -5
else
    echo "✓ No config file errors found"
fi

echo ""
echo "Step 9: Checking chaincode mode..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -q "mode: dev"; then
    echo "✓ Chaincode mode is 'dev' (correct)"
else
    echo "⚠ WARNING: Chaincode mode might not be 'dev'"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "mode:" | tail -3
fi

echo ""
echo "Step 10: Checking system chaincodes..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -q "Deployed system chaincodes"; then
    echo "✓ System chaincodes deployed successfully"
else
    echo "⚠ WARNING: System chaincodes might not be deployed"
fi

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Now test the query:"
echo "  docker exec -it cli bash"
echo "  peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'"
echo ""
