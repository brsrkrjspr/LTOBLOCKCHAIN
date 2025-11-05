# 🔍 Hyperledger Fabric: Peer and Orderer Explained

## 📋 Overview

Hyperledger Fabric uses a **distributed ledger architecture** with two main types of nodes:
- **Peers** - Store the ledger and run chaincode
- **Orderers** - Order transactions and create blocks

---

## 🖥️ PEER NODE - What It Contains

### Core Responsibilities
A peer is a **network node** that:
1. ✅ Maintains a copy of the ledger
2. ✅ Runs chaincode (smart contracts)
3. ✅ Endorses transactions
4. ✅ Validates transactions
5. ✅ Commits blocks to the ledger

### Internal Components

#### 1. **Ledger (Blockchain + World State)**
```
Peer
├── Blockchain (Immutable Transaction Log)
│   ├── Blocks (ordered sequence)
│   │   ├── Block Header
│   │   │   ├── Block Number
│   │   │   ├── Previous Hash
│   │   │   ├── Data Hash
│   │   │   └── Block Timestamp
│   │   └── Block Data
│   │       └── Transactions
│   │           ├── Transaction ID
│   │           ├── Chaincode Name
│   │           ├── Function & Arguments
│   │           ├── Read Set (what was read)
│   │           ├── Write Set (what was written)
│   │           └── Endorsements
│   └── Chain of Hashes (immutability)
│
└── World State (Current State Database)
    ├── Key-Value Pairs
    │   ├── VIN123 → Vehicle Data
    │   ├── VIN456 → Vehicle Data
    │   └── ...
    └── Indexes (CouchDB queries)
```

**In Your Project:**
- Stores vehicle records (VIN as key)
- Stores ownership information
- Stores verification status
- Maintains transaction history

#### 2. **Chaincode Runtime**
```
Peer
└── Chaincode Container
    ├── Your Chaincode (vehicle-registration-production)
    │   ├── RegisterVehicle()
    │   ├── UpdateVerificationStatus()
    │   ├── TransferOwnership()
    │   └── GetVehicle()
    ├── fabric-contract-api (runtime)
    └── State Access
        ├── ctx.stub.getState()
        ├── ctx.stub.putState()
        └── ctx.stub.getQueryResult()
```

**In Your Project:**
- Runs `chaincode/vehicle-registration-production/index.js`
- Executes your business logic
- Accesses vehicle data in world state

#### 3. **Endorsement Engine**
```
Peer
└── Endorsement Process
    ├── Receives transaction proposal
    ├── Simulates transaction (runs chaincode)
    ├── Checks read/write sets
    ├── Creates endorsement signature
    └── Returns signed proposal response
```

**What it does:**
- When you call `RegisterVehicle()`, the peer:
  1. Simulates the transaction
  2. Checks if VIN already exists
  3. Creates vehicle record
  4. Signs the endorsement
  5. Returns to client

#### 4. **State Database**
```
Peer
└── State Database (CouchDB in your project)
    ├── Vehicle Records
    │   ├── Key: VIN123
    │   │   Value: {
    │   │       vin: "VIN123",
    │   │       make: "Toyota",
    │   │       status: "REGISTERED",
    │   │       ...
    │   │   }
    │   └── Key: VIN456
    │       Value: {...}
    ├── Composite Keys
    │   ├── owner~vin (for owner lookups)
    │   └── plate~vin (for plate lookups)
    └── Indexes (for queries)
        └── CouchDB design documents
```

**In Your Project:**
- CouchDB stores all vehicle data
- Supports rich queries (by owner, by status, etc.)
- Maintains indexes for fast lookups

#### 5. **Membership Service Provider (MSP)**
```
Peer
└── MSP Configuration
    ├── Organization Identity (LTOMSP)
    ├── Certificates
    │   ├── CA Certificate
    │   ├── Peer Certificate
    │   └── Admin Certificate
    ├── Private Keys
    └── Policies
        └── Access control rules
```

**In Your Project:**
- `LTOMSP` - LTO organization identity
- Certificates stored in `crypto-config/peerOrganizations/lto.gov.ph/`
- Validates identities for transactions

#### 6. **Gossip Protocol**
```
Peer
└── Gossip Network
    ├── Peer Discovery
    ├── State Transfer (sync with other peers)
    ├── Ledger Distribution
    └── Membership Management
```

**What it does:**
- Discovers other peers in the network
- Syncs ledger state with other peers
- Distributes blocks across the network

---

## 📦 ORDERER NODE - What It Contains

### Core Responsibilities
An orderer is a **consensus node** that:
1. ✅ Receives endorsed transactions
2. ✅ Orders transactions (determines sequence)
3. ✅ Creates blocks
4. ✅ Distributes blocks to peers
5. ✅ Manages channels

### Internal Components

#### 1. **Consensus Algorithm (Raft)**
```
Orderer
└── Raft Consensus
    ├── Leader Election
    │   └── One orderer is leader
    ├── Transaction Ordering
    │   ├── Receives transactions
    │   ├── Orders them (by timestamp)
    │   └── Creates block sequence
    ├── Replication
    │   └── Replicates to follower orderers
    └── Block Creation
        └── Creates immutable blocks
```

**In Your Project:**
- 3 orderer nodes (orderer1, orderer2, orderer3)
- One acts as leader, others as followers
- Ensures all peers see same transaction order

#### 2. **Block Creation Engine**
```
Orderer
└── Block Creation Process
    ├── Receives Endorsed Transactions
    │   └── From multiple peers
    ├── Orders Transactions
    │   └── Deterministic sequence
    ├── Creates Block
    │   ├── Block Header
    │   │   ├── Block Number
    │   │   ├── Previous Hash
    │   │   ├── Data Hash
    │   │   └── Timestamp
    │   └── Block Data
    │       └── Ordered Transactions
    └── Distributes Block
        └── Sends to all peers in channel
```

**What it does:**
- Collects transactions from peers
- Orders them chronologically
- Creates a block
- Sends block to all peers

#### 3. **Channel Management**
```
Orderer
└── Channel Registry
    ├── Channel: ltochannel
    │   ├── Configuration
    │   │   ├── Organizations
    │   │   ├── Policies
    │   │   └── Capabilities
    │   ├── Block Sequence
    │   │   ├── Block 0 (Genesis)
    │   │   ├── Block 1
    │   │   ├── Block 2
    │   │   └── ...
    │   └── Membership
    │       └── Which peers are in channel
    └── Channel Updates
        └── Configuration changes
```

**In Your Project:**
- Manages `ltochannel`
- Knows which peers are members
- Maintains channel configuration

#### 4. **Genesis Block**
```
Orderer
└── Genesis Block (Block 0)
    ├── Channel Configuration
    │   ├── Organizations (LTO)
    │   ├── Policies
    │   ├── Capabilities
    │   └── Consensus Type (Raft)
    └── Initial State
        └── Empty ledger
```

**In Your Project:**
- Created from `configtx.yaml`
- Stored in `channel-artifacts/genesis.block`
- Defines your network structure

#### 5. **Membership Service Provider (MSP)**
```
Orderer
└── MSP Configuration
    ├── Orderer Organization Identity (OrdererMSP)
    ├── Certificates
    │   ├── CA Certificate
    │   ├── Orderer Certificate
    │   └── Admin Certificate
    ├── Private Keys
    └── TLS Configuration
        ├── Server Certificate
        └── Server Key
```

**In Your Project:**
- `OrdererMSP` - Orderer organization identity
- Certificates in `crypto-config/ordererOrganizations/lto.gov.ph/`
- Used for TLS communication

#### 6. **Transaction Queue**
```
Orderer
└── Transaction Queue
    ├── Pending Transactions
    │   ├── Transaction 1 (from peer0)
    │   ├── Transaction 2 (from peer0)
    │   └── Transaction 3 (from peer0)
    ├── Batch Timer
    │   └── Creates block when:
    │       ├── Batch size reached, OR
    │       └── Timeout reached
    └── Block Output
        └── Ordered blocks
```

**What it does:**
- Queues transactions from peers
- Batches them into blocks
- Sends blocks in order

---

## 🔄 How They Work Together

### Transaction Flow

```
1. Client Application
   │
   ├─> Sends Transaction Proposal
   │   └─> To Peer(s)
   │
   │   2. Peer
   │   │   ├─> Runs Chaincode (simulation)
   │   │   ├─> Creates Read/Write Sets
   │   │   └─> Endorses Transaction
   │   │       └─> Returns to Client
   │
   │   3. Client
   │   │   └─> Collects Endorsements
   │   │       └─> Sends to Orderer
   │
   │       4. Orderer
   │       │   ├─> Receives Transaction
   │       │   ├─> Orders with other transactions
   │       │   ├─> Creates Block
   │       │   └─> Distributes Block
   │       │       └─> To All Peers
   │
   │           5. Peer
   │           │   ├─> Receives Block
   │           │   ├─> Validates Transactions
   │           │   ├─> Updates World State
   │           │   └─> Appends to Blockchain
```

### Example: Register Vehicle

**Step 1: Client → Peer**
```javascript
// Your application calls:
await contract.submitTransaction('RegisterVehicle', vehicleData);
```

**Step 2: Peer Endorsement**
```
Peer receives:
- Chaincode: vehicle-registration
- Function: RegisterVehicle
- Arguments: vehicleData

Peer executes:
1. Runs chaincode (simulation)
2. Checks: Does VIN exist? (read)
3. Creates: Vehicle record (write)
4. Signs: Endorsement signature
5. Returns: Endorsed proposal
```

**Step 3: Client → Orderer**
```
Client collects endorsement
Client sends to orderer:
- Transaction with endorsement
```

**Step 4: Orderer Processing**
```
Orderer:
1. Receives transaction
2. Adds to queue
3. Orders with other transactions
4. Creates block (when batch ready)
5. Sends block to all peers
```

**Step 5: Peer Commitment**
```
Peer receives block:
1. Validates all transactions
2. Checks endorsements
3. Applies to world state:
   - putState("VIN123", vehicleData)
4. Appends block to blockchain
5. Transaction committed!
```

---

## 📊 Comparison Table

| Feature | Peer | Orderer |
|---------|------|---------|
| **Stores Ledger** | ✅ Yes | ❌ No |
| **Runs Chaincode** | ✅ Yes | ❌ No |
| **Orders Transactions** | ❌ No | ✅ Yes |
| **Creates Blocks** | ❌ No | ✅ Yes |
| **Endorses Transactions** | ✅ Yes | ❌ No |
| **Validates Transactions** | ✅ Yes | ❌ No |
| **Manages Channels** | ❌ No | ✅ Yes |
| **Gossip Protocol** | ✅ Yes | ❌ No |
| **Consensus Algorithm** | ❌ No | ✅ Yes (Raft) |
| **State Database** | ✅ Yes (CouchDB) | ❌ No |

---

## 🏗️ In Your Project

### Your Peer Configuration
```yaml
peer0.lto.gov.ph:
  - Ledger: Stores all vehicle records
  - Chaincode: vehicle-registration
  - State DB: CouchDB
  - MSP: LTOMSP
  - Channel: ltochannel
```

### Your Orderer Configuration
```yaml
orderer1.lto.gov.ph:
  - Consensus: Raft
  - Channels: ltochannel
  - MSP: OrdererMSP
  - Blocks: Creates and distributes blocks
```

### Data Flow in Your System
```
1. User registers vehicle
   ↓
2. Peer0 runs chaincode (RegisterVehicle)
   ↓
3. Orderer orders transaction
   ↓
4. Orderer creates block
   ↓
5. Peer0 receives block, commits to ledger
   ↓
6. Vehicle stored in CouchDB world state
```

---

## 🔍 Key Takeaways

### Peer Contains:
- ✅ **Ledger** (blockchain + world state)
- ✅ **Chaincode runtime** (your smart contract)
- ✅ **Endorsement engine** (signs transactions)
- ✅ **State database** (CouchDB with vehicle data)
- ✅ **MSP** (organization identity)
- ✅ **Gossip protocol** (peer communication)

### Orderer Contains:
- ✅ **Consensus algorithm** (Raft)
- ✅ **Block creation engine**
- ✅ **Channel management**
- ✅ **Transaction queue**
- ✅ **Genesis block**
- ✅ **MSP** (orderer identity)

### Simple Analogy:
- **Peer** = Database Server (stores data, runs queries)
- **Orderer** = Transaction Manager (orders operations, creates batches)

---

## 📚 References

- [Fabric Architecture](https://hyperledger-fabric.readthedocs.io/en/latest/architecture/architecture.html)
- [Peers and Orderers](https://hyperledger-fabric.readthedocs.io/en/latest/peers/peers.html)
- [Ordering Service](https://hyperledger-fabric.readthedocs.io/en/latest/orderer/ordering_service.html)

---

**Last Updated:** 2025-01-XX

