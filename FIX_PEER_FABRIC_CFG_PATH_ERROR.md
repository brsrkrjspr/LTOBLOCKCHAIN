# Fix: Peer Container FABRIC_CFG_PATH Error

**Error:** `FABRIC_CFG_PATH /var/hyperledger/fabric/config does not exist`

**Solution:** Create the config directory or unset FABRIC_CFG_PATH

---

## 🔧 **Quick Fix**

### **Option 1: Create Config Directory (Recommended)**

```bash
# Create config directory structure
mkdir -p fabric-network/config

# Create minimal core.yaml (Fabric will use env vars as overrides)
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

# Update docker-compose.unified.yml to mount config directory
# Add to peer volumes:
# - ./fabric-network/config:/var/hyperledger/fabric/config
```

### **Option 2: Unset FABRIC_CFG_PATH (Simpler)**

Update `docker-compose.unified.yml` peer section to explicitly unset FABRIC_CFG_PATH:

```yaml
environment:
  # ... existing vars ...
  - FABRIC_CFG_PATH=  # Empty value - use env vars only
```

---

## ✅ **Applied Fix**

I've updated `docker-compose.unified.yml` to set `FABRIC_CFG_PATH=` (empty) which tells Fabric to use environment variables instead of looking for a config file.

**Now restart the containers:**

```bash
# Stop containers
docker-compose -f docker-compose.unified.yml down

# Start again
docker-compose -f docker-compose.unified.yml up -d

# Check peer logs
docker logs peer0.lto.gov.ph
```

The peer should now start successfully!
