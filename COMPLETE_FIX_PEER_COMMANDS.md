# Complete Commands to Fix Peer FABRIC_CFG_PATH Error

## **Step 1: Create Config Directory and File**

```bash
cd ~/LTOBLOCKCHAIN

# Create config directory
mkdir -p fabric-network/config

# Create minimal core.yaml file (Fabric will use env vars from docker-compose)
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
```

## **Step 2: Stop Containers**

```bash
docker-compose -f docker-compose.unified.yml down
```

## **Step 3: Start Containers**

```bash
docker-compose -f docker-compose.unified.yml up -d
```

## **Step 4: Wait for Containers to Start**

```bash
sleep 30
```

## **Step 5: Check Container Status**

```bash
docker ps
```

**Expected output:** Should see `peer0.lto.gov.ph` running (not restarting)

## **Step 6: Check Peer Logs**

```bash
docker logs peer0.lto.gov.ph | tail -50
```

**Expected:** Should see peer starting successfully, no `FABRIC_CFG_PATH` errors

## **Step 7: Verify Peer is Healthy**

```bash
# Check if peer is listening on port 7051
docker exec peer0.lto.gov.ph netstat -tlnp | grep 7051 || echo "Peer not listening yet, wait a bit more"
```

---

## **If Peer Still Fails:**

### **Check if config directory exists:**
```bash
ls -la fabric-network/config/
```

### **Check if core.yaml exists:**
```bash
cat fabric-network/config/core.yaml | head -20
```

### **Check peer logs for other errors:**
```bash
docker logs peer0.lto.gov.ph 2>&1 | grep -i error
```

---

## **Quick All-in-One Command (Copy-Paste Everything):**

```bash
cd ~/LTOBLOCKCHAIN && \
mkdir -p fabric-network/config && \
cat > fabric-network/config/core.yaml << 'EOFYAML'
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
EOFYAML
docker-compose -f docker-compose.unified.yml down && \
docker-compose -f docker-compose.unified.yml up -d && \
sleep 30 && \
docker ps && \
echo "=== Peer Logs ===" && \
docker logs peer0.lto.gov.ph | tail -30
```

---

**After running these commands, the peer should start successfully!**
