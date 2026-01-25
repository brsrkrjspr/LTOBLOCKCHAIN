#!/bin/bash

# Fix Peer FABRIC_CFG_PATH Error
# This script creates the required config directory and core.yaml file,
# then restarts the Docker containers.

set -e  # Exit on error

echo "=========================================="
echo "Fixing Peer FABRIC_CFG_PATH Error"
echo "=========================================="

# Change to project directory
cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Step 1: Create config directory
echo ""
echo "Step 1: Creating config directory..."
mkdir -p fabric-network/config

# Step 2: Create core.yaml file
echo "Step 2: Creating core.yaml file..."
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
    bootstrap: 127.0.0.1:7051
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
    clientKey:
      file:
    clientCert:
      file:
  fileSystemPath: /var/hyperledger/production
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256
      FileKeyStore:
        KeyStore:
vm:
  endpoint: unix:///host/var/run/docker.sock
chaincode:
  builder: $(DOCKER_NS)/fabric-ccenv:$(ARCH)-$(PROJECT_VERSION)
  pull: false
  golang:
    runtime: $(BASE_DOCKER_NS)/fabric-baseos:$(ARCH)-$(BASE_VERSION)
    dynamicLink: false
  java:
    runtime: $(BASE_DOCKER_NS)/fabric-javaenv:$(ARCH)-$(BASE_VERSION)
  node:
    runtime: $(BASE_DOCKER_NS)/fabric-nodeenv:$(ARCH)-$(BASE_VERSION)
  startuptimeout: 300s
  executetimeout: 30s
  mode: net
  keepalive: 0
  system:
    cscc: enable
    lscc: enable
    escc: enable
    vscc: enable
    qscc: enable
  systemPlugins: ~
  logging:
    level: INFO
    shim: WARNING
    format: '%{color}%{time:2006-01-02 15:04:05.000 MST} [%{module}] %{shortfunc} -> %{level:.4s} %{id:03x}%{color:reset} %{message}'
ledger:
  blockchain: ~
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
  statsd:
    network: udp
    address: 127.0.0.1:8125
    writeInterval: 10s
    prefix: ""
EOF

echo "✓ core.yaml created successfully"

# Step 3: Stop containers
echo ""
echo "Step 3: Stopping containers..."
docker-compose -f docker-compose.unified.yml down

# Step 4: Start containers
echo ""
echo "Step 4: Starting containers..."
docker-compose -f docker-compose.unified.yml up -d

# Step 5: Wait for containers to start
echo ""
echo "Step 5: Waiting for containers to start (30 seconds)..."
sleep 30

# Step 6: Check container status
echo ""
echo "=========================================="
echo "Container Status:"
echo "=========================================="
docker ps

# Step 7: Check peer logs
echo ""
echo "=========================================="
echo "Peer Logs (last 30 lines):"
echo "=========================================="
docker logs peer0.lto.gov.ph 2>&1 | tail -30

# Step 8: Verify peer is running
echo ""
echo "=========================================="
echo "Verification:"
echo "=========================================="
if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "✓ Peer container is running!"
    
    # Check for FABRIC_CFG_PATH errors
    if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "FABRIC_CFG_PATH.*does not exist"; then
        echo "✗ ERROR: FABRIC_CFG_PATH error still present!"
        echo "Check logs above for details."
        exit 1
    else
        echo "✓ No FABRIC_CFG_PATH errors found!"
    fi
else
    echo "✗ ERROR: Peer container is not running!"
    echo "Check logs above for details."
    exit 1
fi

echo ""
echo "=========================================="
echo "Fix completed successfully!"
echo "=========================================="
