#!/bin/bash

# Fix Peer FABRIC_CFG_PATH Error
# This script creates the required config directory and core.yaml file,
# then restarts the Docker containers.

set -e  # Exit on error

echo "=========================================="
echo "Fixing Peer Container Errors"
echo "=========================================="
echo "This script fixes:"
echo "  1. FABRIC_CFG_PATH error"
echo "  2. MSP config path error"
echo ""

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

# Step 3: Verify docker-compose file has MSP path
echo ""
echo "Step 3: Verifying docker-compose configuration..."
if grep -q "CORE_PEER_MSPCONFIGPATH" docker-compose.unified.yml; then
    echo "✓ MSP config path is set in docker-compose.unified.yml"
else
    echo "⚠ WARNING: CORE_PEER_MSPCONFIGPATH not found in docker-compose.unified.yml"
    echo "  You may need to add it manually:"
    echo "  - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp"
fi

# Step 4: Stop containers
echo ""
echo "Step 4: Stopping containers..."
docker-compose -f docker-compose.unified.yml down

# Step 5: Start containers
echo ""
echo "Step 5: Starting containers..."
docker-compose -f docker-compose.unified.yml up -d

# Step 6: Wait for containers to start
echo ""
echo "Step 6: Waiting for containers to start (30 seconds)..."
sleep 30

# Step 7: Check container status
echo ""
echo "=========================================="
echo "Container Status:"
echo "=========================================="
docker ps

# Step 8: Check peer logs
echo ""
echo "=========================================="
echo "Peer Logs (last 30 lines):"
echo "=========================================="
docker logs peer0.lto.gov.ph 2>&1 | tail -30

# Step 9: Verify peer is running
echo ""
echo "=========================================="
echo "Verification:"
echo "=========================================="
if docker ps | grep -q "peer0.lto.gov.ph.*Up"; then
    echo "✓ Peer container is running!"
    
    # Check for common errors
    if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "FABRIC_CFG_PATH.*does not exist"; then
        echo "✗ ERROR: FABRIC_CFG_PATH error still present!"
        echo "Check logs above for details."
        exit 1
    elif docker logs peer0.lto.gov.ph 2>&1 | grep -qi "cannot init crypto.*specified path.*does not exist"; then
        echo "✗ ERROR: MSP config path error still present!"
        echo "Make sure CORE_PEER_MSPCONFIGPATH is set in docker-compose.unified.yml"
        exit 1
    else
        echo "✓ No configuration errors found!"
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
