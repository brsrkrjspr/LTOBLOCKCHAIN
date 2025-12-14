# Project Architecture Summary
## TrustChain: Blockchain-based Vehicle Registration System for LTO

**Generated:** $(date)  
**Purpose:** Comprehensive onboarding documentation for new team members

---

## 1. Project Purpose

**TrustChain** is a blockchain-based vehicle registration and verification system for the Land Transportation Office (LTO) that enables secure, tamper-proof vehicle registration, multi-organizational clearance workflows (LTO, HPG, Insurance, Emission), and transparent document verification using Hyperledger Fabric blockchain, IPFS decentralized storage, and PostgreSQL database.

**Key Capabilities:**
- **LTO Admin** can verify documents submitted by users (insurance, emission, HPG clearance) directly OR delegate verification to external organizations
- **LTO Admin** can approve or reject vehicle registration applications independently based on document verification
- **Multi-organizational workflow** allows LTO to request clearance from HPG, Insurance, and Emission organizations when needed
- **Blockchain integration** ensures all approvals and verifications are immutably recorded on Hyperledger Fabric

---

## 2. Tech Stack

### **Core Technologies**
- **Runtime:** Node.js 16+ (Express.js framework)
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database:** PostgreSQL 14+ (with connection pooling)
- **Blockchain:** Hyperledger Fabric v2.5 (permissioned blockchain)
- **Storage:** IPFS (InterPlanetary File System) for decentralized document storage
- **Containerization:** Docker & Docker Compose
- **Authentication:** JWT (JSON Web Tokens) with bcryptjs password hashing

### **Key Dependencies**
```json
{
  "express": "^4.18.2",           // Web framework
  "fabric-network": "^2.2.20",    // Hyperledger Fabric SDK
  "fabric-ca-client": "^2.2.20",  // Fabric CA client
  "ipfs-http-client": "^60.0.1", // IPFS client
  "pg": "^8.11.3",                // PostgreSQL driver
  "jsonwebtoken": "^9.0.2",       // JWT authentication
  "bcryptjs": "^2.4.3",           // Password hashing
  "multer": "^1.4.5-lts.1",       // File upload handling
  "helmet": "^7.1.0",             // Security headers
  "express-rate-limit": "^7.1.5", // Rate limiting
  "cors": "^2.8.5",               // CORS middleware
  "nodemailer": "^6.9.7",         // Email notifications
  "twilio": "^4.19.0",            // SMS notifications
  "uuid": "^9.0.0",               // UUID generation
  "dotenv": "^16.3.1"             // Environment variables
}
```

### **External Services**
- **Hyperledger Fabric Network:** Orderer, Peer, CouchDB (state database)
- **IPFS Node:** Decentralized file storage (fallback to local storage)
- **PostgreSQL:** Relational database for application data
- **Redis:** Optional caching (configured but not required)

---

## 3. Project Structure

```
LTOBLOCKCHAIN/
│
├── 📄 Root HTML Files (Frontend Pages)
│   ├── index.html                    # Landing page
│   ├── login-signup.html             # Authentication
│   ├── registration-wizard.html      # Vehicle registration form
│   ├── owner-dashboard.html          # Vehicle owner dashboard
│   ├── admin-dashboard.html          # LTO admin dashboard
│   ├── hpg-admin-dashboard.html     # HPG admin dashboard
│   ├── verifier-dashboard.html       # Emission verifier dashboard
│   ├── insurance-verifier-dashboard.html
│   ├── document-viewer.html          # Document viewer with blockchain verification
│   ├── search.html                   # Public document verification
│   └── admin-blockchain-viewer.html  # Blockchain ledger viewer
│
├── 📁 backend/                       # Backend Application
│   ├── routes/                       # Express route handlers
│   │   ├── auth.js                   # Authentication endpoints
│   │   ├── vehicles.js               # Vehicle CRUD operations
│   │   ├── documents.js              # Document upload/download
│   │   ├── blockchain.js             # Chaincode invocations
│   │   ├── ledger.js                 # Transaction history
│   │   ├── notifications.js          # Email/SMS notifications
│   │   ├── lto.js                    # LTO admin workflow APIs (send requests, approve/reject)
│   │   ├── hpg.js                    # HPG verification APIs (approve/reject, release certificates)
│   │   ├── insurance.js              # Insurance verification APIs (approve/reject)
│   │   └── emission.js               # Emission verification APIs (approve/reject)
│   │
│   ├── services/                     # Business logic services
│   │   ├── optimizedFabricService.js # Hyperledger Fabric integration
│   │   ├── storageService.js         # Unified storage (IPFS/local)
│   │   ├── ipfsService.js            # IPFS client wrapper
│   │   ├── localStorageService.js    # Local file storage fallback
│   │   ├── blockchainLedger.js       # Ledger management
│   │   └── monitoringService.js      # System metrics
│   │
│   ├── database/                     # Database layer
│   │   ├── db.js                     # PostgreSQL connection pool
│   │   └── services.js               # High-level DB operations
│   │
│   ├── middleware/                   # Express middleware
│   │   ├── auth.js                   # JWT authentication
│   │   └── authorize.js              # Role-based authorization
│   │
│   └── uploads/                      # Temporary file storage
│
├── 📁 js/                            # Frontend JavaScript
│   ├── api-client.js                 # Centralized API client
│   ├── auth-utils.js                 # Authentication utilities
│   ├── owner-dashboard.js            # Owner dashboard logic
│   ├── admin-dashboard.js            # Admin dashboard logic
│   ├── registration-wizard.js       # Registration form logic
│   ├── document-viewer.js           # Document viewer logic
│   ├── hpg-admin.js                 # HPG admin logic
│   └── [other dashboard files]
│
├── 📁 chaincode/                     # Hyperledger Fabric Smart Contracts
│   └── vehicle-registration-production/
│       ├── index.js                  # Main chaincode (VehicleRegistrationContract)
│       └── package.json              # Chaincode dependencies
│
├── 📁 config/                        # Configuration Files
│   ├── network-config.json          # Fabric network connection profile
│   ├── configtx.yaml                 # Channel configuration
│   └── crypto-config.yaml            # Cryptographic material config
│
├── 📁 fabric-network/                # Fabric Network Artifacts
│   ├── crypto-config/                # Generated certificates & keys
│   └── channel-artifacts/            # Genesis block & channel transactions
│
├── 📁 database/                      # Database Migrations
│   ├── init-laptop.sql              # Main database schema
│   ├── add-clearance-workflow.sql   # Clearance workflow tables
│   └── [other migration files]
│
├── 📁 scripts/                       # Automation Scripts
│   ├── codespace-restart.sh         # Complete Codespace restart script
│   ├── setup-fabric-wallet.js        # Wallet setup
│   ├── redeploy-chaincode.sh        # Chaincode redeployment
│   └── [other setup/utility scripts]
│
├── 📁 docker-compose files           # Docker Compose Configurations
│   ├── docker-compose.unified.yml   # Unified Codespace deployment
│   ├── docker-compose.production.yml # Production deployment
│   └── [other compose variants]
│
├── 📁 css/                           # Stylesheets
│   └── styles.css                    # Main stylesheet (2905+ lines)
│
├── 📁 wallet/                        # Fabric Wallet (generated)
│   └── admin.id                      # Admin identity
│
├── server.js                         # Main Express server entry point
├── package.json                      # Node.js dependencies
└── README.md                         # Project documentation
```

---

## 4. Key Entry Points

### **Main Application Entry Point**
**File:** `server.js`

**Initialization Flow:**
1. **Express App Setup** (lines 1-15)
   - Loads environment variables (`dotenv`)
   - Creates Express app instance
   - Sets trust proxy for Codespace/GitHub forwarding

2. **Security Middleware** (lines 17-68)
   - Helmet (CSP headers)
   - CORS configuration
   - Rate limiting (1000 req/15min)

3. **Body Parsing** (lines 70-72)
   - JSON parser (10MB limit)
   - URL-encoded parser

4. **Static File Serving** (line 75)
   - Serves HTML/CSS/JS from root directory

5. **API Route Registration** (lines 85-100)
   ```javascript
   app.use('/api/auth', require('./backend/routes/auth'));
   app.use('/api/vehicles', require('./backend/routes/vehicles'));
   app.use('/api/documents', require('./backend/routes/documents'));
   app.use('/api/blockchain', require('./backend/routes/blockchain'));
   app.use('/api/ledger', require('./backend/routes/ledger'));
   app.use('/api/notifications', require('./backend/routes/notifications'));
   app.use('/api/lto', require('./backend/routes/lto'));        // LTO: send requests, approve/reject
   app.use('/api/hpg', require('./backend/routes/hpg'));       // HPG: verify, approve/reject, release certificates
   app.use('/api/insurance', require('./backend/routes/insurance')); // Insurance: verify, approve/reject
   app.use('/api/emission', require('./backend/routes/emission'));   // Emission: verify, approve/reject
   app.use('/api/vehicles/transfer', require('./backend/routes/transfer')); // Transfer ownership
   app.use('/api/admin', require('./backend/routes/admin'));            // Admin statistics
   app.use('/api/health', require('./backend/routes/health'));          // Health checks
   app.use('/api/monitoring', require('./backend/routes/monitoring'));   // System monitoring
   ```

6. **Service Initialization** (lines 163-175)
   - **Storage Service:** Initializes IPFS or local storage
   - **Fabric Service:** Initialized in `backend/routes/blockchain.js` (mandatory, no fallbacks)

7. **Server Start** (lines 177-185)
   - Listens on PORT (default: 3001)
   - Logs environment, API URL, storage mode, blockchain mode

### **Frontend Entry Points**
- **Landing:** `index.html` → Public information page
- **Authentication:** `login-signup.html` → Login/registration
- **Owner:** `owner-dashboard.html` → Vehicle owner interface
- **Admin:** `admin-dashboard.html` → LTO admin interface
- **Registration:** `registration-wizard.html` → Multi-step vehicle registration

### **Blockchain Entry Point**
**File:** `backend/routes/blockchain.js`
- Initializes `optimizedFabricService` on module load
- **Critical:** Exits process if Fabric connection fails (no fallbacks)
- Requires `BLOCKCHAIN_MODE=fabric` in environment

---

## 5. Data Flow

### **Vehicle Registration Flow**
```
1. Frontend (registration-wizard.html)
   ↓ POST /api/vehicles/register
   
2. Backend Route (backend/routes/vehicles.js)
   ↓ Validates request, uploads documents
   
3. Storage Service (backend/services/storageService.js)
   ↓ Uploads to IPFS (or local fallback)
   ↓ Returns IPFS CID
   
4. Database Service (backend/database/services.js)
   ↓ Inserts vehicle record into PostgreSQL
   ↓ Status: 'SUBMITTED'
   
5. Fabric Service (backend/services/optimizedFabricService.js)
   ↓ Invokes chaincode: RegisterVehicle()
   ↓ Writes to Hyperledger Fabric ledger
   
6. Response
   ↓ Returns vehicle ID, transaction ID, IPFS CID
   ↓ Frontend updates UI
```

### **Document Verification Flow**
```
1. Public Search (search.html)
   ↓ GET /api/documents/verify?cid=<IPFS_CID>
   Note: Public verification endpoint may need separate implementation
   
2. Backend Route (backend/routes/documents.js)
   ↓ Retrieves document from IPFS/local storage
   ↓ Queries blockchain for verification
   
3. Fabric Service
   ↓ Queries chaincode: GetVehicle(vin)
   ↓ Returns blockchain record
   
4. Verification
   ↓ Compares document hash with blockchain record
   ↓ Returns verification status
```

**Note:** Document upload endpoint (`POST /api/documents/upload`) now requires authentication. If registration wizard needs to upload documents before user registration, consider a separate public endpoint with rate limiting.

### **Clearance Workflow Flow** (Multi-Organizational)
```
1. Owner submits application
   ↓ Status: 'SUBMITTED'
   ↓ Documents uploaded to IPFS/local storage
   
2. LTO Admin reviews application and documents
   ↓ LTO Admin can:
      a) Verify documents directly (LTO has verification authority)
         - POST /api/vehicles/:vin/verification (verification_type: 'insurance', 'emission', 'admin')
         - LTO can verify insurance, emission, and admin verifications (per chaincode authorization)
      b) Request external verification
         - POST /api/lto/send-to-hpg (or insurance/emission)
         - Creates clearance_request record
         - Status: 'PENDING_HPG' (or PENDING_INSURANCE/PENDING_EMISSION)
   
3. External Org (HPG/Insurance/Emission) verifies (if requested)
   ↓ POST /api/hpg/verify/approve (or /api/insurance/verify/approve, /api/emission/verify/approve)
   ↓ Updates clearance_request status
   ↓ Updates vehicle_verifications table
   ↓ Note: LTO can also perform these verifications directly (dual authority)
   
4. LTO Admin approves or rejects application
   ↓ Option A: Direct approval/rejection
      - POST /api/vehicles/id/:id/status (status: 'APPROVED' or 'REJECTED')
      - Can approve/reject without external verification if LTO verified documents
   
   ↓ Option B: Final approval after external verification
      - POST /api/lto/approve-clearance
      - Validates all verifications are complete (HPG, Insurance, Emission)
      - Updates vehicle status to 'APPROVED'
      - Invokes chaincode: RegisterVehicle() or UpdateVerificationStatus()
      - Blockchain record updated
   
5. If approved, vehicle registered on blockchain
   ↓ Status: 'REGISTERED'
   ↓ Transaction ID recorded
   ↓ Owner notified
```

**Key Points:**
- **LTO has dual verification authority**: Can verify documents directly OR delegate to external organizations
- **LTO can approve/reject independently**: Can approve/reject applications based on LTO's own verification
- **Chaincode authorization**: LTO (LTOMSP) is authorized to verify insurance, emission, admin, and HPG clearances
- **Flexible workflow**: LTO can choose to verify in-house or request external verification based on requirements
- **Blockchain audit trail**: All approvals/rejections are recorded on Hyperledger Fabric with:
  - Transaction ID (immutable reference)
  - Timestamp (when decision was made)
  - Admin identity (who made the decision - MSPID)
  - Full history (all verification steps leading to decision)
  - Cryptographic proof (cannot be tampered with or denied later)

### **Authentication Flow**
```
1. Login (login-signup.html)
   ↓ POST /api/auth/login
   
2. Auth Route (backend/routes/auth.js)
   ↓ Validates credentials against PostgreSQL
   ↓ Generates JWT token (expires in 24h)
   
3. Token Storage
   ↓ Frontend stores in localStorage as 'authToken'
   
4. Subsequent Requests
   ↓ APIClient (js/api-client.js) adds token to headers
   ↓ Middleware (backend/middleware/auth.js) validates token
   ↓ Route handler executes
```

---

## 6. Conventions

### **Naming Conventions**

#### **Files & Directories**
- **Routes:** `kebab-case.js` (e.g., `vehicle-registration.js`)
- **Services:** `camelCase.js` (e.g., `optimizedFabricService.js`)
- **Frontend JS:** `kebab-case.js` (e.g., `owner-dashboard.js`)
- **HTML:** `kebab-case.html` (e.g., `admin-dashboard.html`)

#### **Code**
- **Variables:** `camelCase` (e.g., `vehicleId`, `transactionId`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`, `JWT_SECRET`)
- **Classes:** `PascalCase` (e.g., `OptimizedFabricService`, `APIClient`)
- **Database Tables:** `snake_case` (e.g., `vehicle_verifications`, `clearance_requests`)
- **Database Columns:** `snake_case` (e.g., `plate_number`, `created_at`)

### **Architectural Patterns**

#### **1. Service Layer Pattern**
- **Routes** (`backend/routes/`) handle HTTP requests/responses
- **Services** (`backend/services/`) contain business logic
- **Database** (`backend/database/`) handles data access
- **Separation of Concerns:** Routes → Services → Database

#### **2. Singleton Pattern**
- **Services:** Exported as singleton instances
  ```javascript
  // backend/services/optimizedFabricService.js
  const optimizedFabricService = new OptimizedFabricService();
  module.exports = optimizedFabricService;
  ```

#### **3. Factory Pattern**
- **Storage Service:** Factory pattern for IPFS vs Local storage
  ```javascript
  // backend/services/storageService.js
  if (this.storageMode === 'ipfs') {
      return ipfsService;
  } else {
      return localStorageService;
  }
  ```

#### **4. Middleware Chain Pattern**
- **Express Middleware:** Authentication → Authorization → Route Handler
  ```javascript
  router.post('/endpoint', 
      authenticateToken,      // JWT validation
      authorizeRole(['admin']), // Role check
      async (req, res) => { ... } // Handler
  );
  ```

#### **5. Error Handling Pattern**
- **Try-Catch Blocks:** All async functions wrapped
- **Error Responses:** Consistent JSON format
  ```javascript
  res.status(500).json({
      success: false,
      error: 'Error message',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
  ```

### **Code Organization Patterns**

#### **Frontend JavaScript**
- **APIClient Class:** Centralized HTTP client (`js/api-client.js`)
  - Automatic token injection
  - Error handling
  - Token expiration handling
- **Dashboard Files:** Page-specific logic (e.g., `owner-dashboard.js`)
- **Utility Files:** Shared functions (`js/utils.js`, `js/auth-utils.js`)

#### **Backend Structure**
- **Route Files:** Thin controllers, delegate to services
- **Service Files:** Business logic, orchestrate database/Fabric calls
- **Database Files:** SQL queries, connection management

#### **Chaincode Structure**
- **Class-Based:** `VehicleRegistrationContract extends Contract`
- **Methods:** Async functions for each transaction type
- **Error Handling:** Try-catch with descriptive errors
- **Events:** Emit events for transaction tracking

### **Environment Variables**
```bash
# Required
BLOCKCHAIN_MODE=fabric          # Must be 'fabric' (no fallbacks)
PORT=3001                       # Server port
DB_HOST=localhost              # PostgreSQL host
DB_NAME=lto_blockchain          # Database name
DB_USER=lto_user               # Database user
DB_PASSWORD=lto_password       # Database password
JWT_SECRET=<random-secret>     # JWT signing secret

# Optional
STORAGE_MODE=auto              # 'ipfs', 'local', or 'auto'
NODE_ENV=development           # 'development' or 'production'
FRONTEND_URL=http://localhost:3001
```

### **API Response Format**
```javascript
// Success Response
{
    "success": true,
    "data": { ... },
    "message": "Optional message"
}

// Error Response
{
    "success": false,
    "error": "Error type",
    "message": "Human-readable error message"
}
```

### **Database Conventions**
- **Timestamps:** `created_at`, `updated_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- **UUIDs:** Primary keys use `uuid_generate_v4()`
- **Foreign Keys:** Named as `{table}_id` (e.g., `vehicle_id`, `owner_id`)
- **Status Fields:** Use ENUM types (e.g., `vehicle_status`, `verification_status`)

### **Git Conventions**
- **Commits:** Descriptive messages (e.g., "Fix syntax error in owner-dashboard.js")
- **Branches:** Feature branches for new functionality
- **Crypto Materials:** Committed to repository (required for Codespace deployment)

---

## 7. Key Architectural Decisions

### **1. No Fallback Mode for Blockchain**
- **Decision:** `BLOCKCHAIN_MODE` must be `fabric`
- **Rationale:** Ensures production-ready blockchain integration
- **Impact:** Application exits if Fabric connection fails

### **2. Unified Storage Service**
- **Decision:** Single interface for IPFS and local storage
- **Rationale:** Simplifies code, allows graceful degradation
- **Implementation:** `storageService.js` abstracts storage backend

### **3. Single Orderer Architecture**
- **Decision:** One orderer (`orderer.lto.gov.ph`) instead of Raft cluster
- **Rationale:** Simplified deployment for development/Codespace
- **Note:** Production should use Raft consensus (3+ orderers)

### **4. Frontend as Static Files**
- **Decision:** Vanilla HTML/JS/CSS, not React/Vue
- **Rationale:** Simpler deployment, no build step required
- **Trade-off:** More manual DOM manipulation

### **5. PostgreSQL for Application Data**
- **Decision:** Relational database for vehicles, users, documents
- **Rationale:** Complex queries, relationships, reporting
- **Blockchain:** Used for immutable audit trail, not primary data store

### **6. LTO Dual Verification Authority**
- **Decision:** LTO can verify documents directly OR delegate to external organizations
- **Rationale:** Flexibility - LTO can verify in-house when capable, or request external verification when specialized expertise is needed
- **Implementation:** Chaincode authorizes LTOMSP for insurance, emission, admin, and HPG verifications
- **Impact:** LTO has final approval authority regardless of who performed verification

### **7. Admin Approval/Rejection with Blockchain Audit Trail**
- **Decision:** LTO Admin can approve/reject applications, with all decisions recorded on blockchain
- **Rationale:** Hyperledger Fabric is a **permissioned blockchain** designed for enterprise/government use cases where centralized authority is required
- **Why This Doesn't Negate Blockchain's Purpose:**
  1. **Immutable Audit Trail:** Every approval/rejection is permanently recorded on-chain with transaction ID, timestamp, and admin identity
  2. **Transparency:** All parties (LTO, HPG, Insurance, Emission, Vehicle Owners) can verify who made decisions and when
  3. **Tamper-Proof:** Admin cannot later deny or alter their decision - blockchain provides cryptographic proof
  4. **Multi-Party Trust:** While admin makes final decision, blockchain records all verification steps from different organizations
  5. **Accountability:** Every action is cryptographically signed by the admin's MSP identity, ensuring non-repudiation
  6. **Audit Compliance:** Government/enterprise systems require audit trails - blockchain provides this automatically
- **Blockchain Value:** Not about eliminating intermediaries, but creating **trust, transparency, and accountability** between known parties
- **Real-World Analogy:** Like a notary public - they have authority to approve/reject, but the notarization is recorded in a public ledger that can't be tampered with

### **8. Comprehensive Authentication and Authorization (UPDATED - December 2024)**
- **Decision:** All sensitive endpoints require authentication; admin operations require role-based authorization
- **Rationale:** Security best practices - defense in depth, prevent unauthorized access
- **Implementation:**
  - JWT token authentication via `authenticateToken` middleware
  - Role-based access control via `authorizeRole` middleware
  - Permission checks for resource access (owners can only access their own vehicles)
- **Security Fixes Applied:**
  1. **Document Upload:** `POST /api/documents/upload` now requires authentication
  2. **Ledger Routes:** All 9 endpoints now require authentication (admin-only for sensitive operations)
  3. **Monitoring Routes:** All 6 endpoints now require admin authentication
- **Impact:** Prevents unauthorized access to sensitive data and operations, significantly improves security posture
- **Status:** ✅ All authentication bypasses fixed (December 2024)

---

## 8. Critical Files to Understand

### **For Backend Development**
1. `server.js` - Application entry point
2. `backend/routes/vehicles.js` - Vehicle CRUD operations, status updates (approve/reject)
3. `backend/routes/lto.js` - LTO admin workflows (send requests, approve clearance)
4. `backend/services/optimizedFabricService.js` - Fabric integration
5. `backend/database/services.js` - Database operations
6. `backend/middleware/auth.js` - Authentication logic

### **For Frontend Development**
1. `js/api-client.js` - HTTP client wrapper
2. `js/owner-dashboard.js` - Owner dashboard logic
3. `js/admin-dashboard.js` - Admin dashboard logic
4. `js/registration-wizard.js` - Registration form logic

### **For Blockchain Development**
1. `chaincode/vehicle-registration-production/index.js` - Smart contract
2. `backend/services/optimizedFabricService.js` - SDK usage
3. `config/network-config.json` - Network configuration
4. `scripts/setup-fabric-wallet.js` - Wallet setup

### **For DevOps/Deployment**
1. `docker-compose.unified.yml` - Codespace deployment
2. `scripts/codespace-restart.sh` - Complete restart script
3. `config/crypto-config.yaml` - Crypto material generation
4. `database/init-laptop.sql` - Database schema

---

## 9. Common Development Workflows

### **Adding a New API Endpoint**
1. Add route handler in `backend/routes/{module}.js`
2. Add business logic in `backend/services/{service}.js` (if needed)
3. Add database operations in `backend/database/services.js` (if needed)
4. Update frontend to call new endpoint (if needed)
5. Test with Postman/curl

### **Modifying Chaincode**
1. Edit `chaincode/vehicle-registration-production/index.js`
2. Run `bash scripts/redeploy-chaincode.sh`
3. Test via `/api/blockchain` endpoints

### **Adding a New Frontend Page**
1. Create `{page-name}.html` in root
2. Create `js/{page-name}.js` for logic
3. Add route in `server.js` (if needed)
4. Link from navigation

### **Database Migration**
1. Create SQL file in `database/` directory
2. Run: `docker exec -i postgres psql -U lto_user -d lto_blockchain < database/{migration}.sql`
3. Update `backend/database/services.js` if schema changes

---

## 10. Testing & Debugging

### **Health Checks**
- **API:** `GET /api/health`
- **Database:** `docker exec postgres pg_isready -U lto_user`
- **IPFS:** `curl http://localhost:5001/api/v0/version`
- **Fabric:** Check container logs: `docker logs peer0.lto.gov.ph`

### **Logging**
- **Server:** Console logs with emoji prefixes (✅, ❌, ⚠️, 📡)
- **Frontend:** `console.log()` for debugging (check browser DevTools)
- **Fabric:** Container logs via `docker logs`

### **Common Debugging Steps**
1. Check Docker containers: `docker ps`
2. Check container logs: `docker logs {container-name}`
3. Check database: `docker exec -it postgres psql -U lto_user -d lto_blockchain`
4. Check Fabric wallet: `ls wallet/`
5. Check browser console (F12) for frontend errors

---

## 11. Codespace Deployment Considerations

### **Overview**
This project is designed to run in **GitHub Codespace**, a cloud-based development environment. Codespace deployment has specific requirements and considerations that differ from local development.

### **Key Codespace Differences**

#### **1. Networking & Service Discovery**
- **Local Development:** Services connect via `localhost`
- **Codespace:** Services connect via **container names** (Docker Compose service names)
  - Database: `postgres` (not `localhost`)
  - IPFS: `ipfs` (not `localhost`)
  - Redis: `redis` (not `localhost`)
- **Impact:** Environment variables must use container names in Codespace

#### **2. Port Forwarding**
- **Codespace:** GitHub automatically forwards ports and provides public URLs
- **Format:** `https://{workspace-id}-{port}.app.github.dev`
- **Trust Proxy:** Express `app.set('trust proxy', true)` is required for correct IP detection
- **Impact:** Rate limiting and security features work correctly with forwarded requests

#### **3. Crypto Materials Persistence**
- **Critical:** Crypto materials (`fabric-network/crypto-config/`) **must be committed to Git**
- **Reason:** Codespace starts fresh - crypto materials are not generated automatically
- **Impact:** Without committed crypto materials, Fabric network cannot start
- **Note:** This is different from local development where crypto can be regenerated

#### **4. Single Orderer Architecture**
- **Decision:** One orderer (`orderer.lto.gov.ph`) instead of Raft cluster
- **Rationale:** Simplified deployment for Codespace (limited resources)
- **Trade-off:** Single point of failure (acceptable for development/demo)
- **Production:** Should use 3+ orderers with Raft consensus

#### **5. Docker Compose Configuration**
- **File:** `docker-compose.unified.yml` - Unified deployment for Codespace
- **Contains:** All services in one file (Fabric, PostgreSQL, IPFS, Redis, CLI)
- **Purpose:** Single command deployment (`docker-compose -f docker-compose.unified.yml up -d`)

### **Codespace-Specific Files**

| File | Purpose | Codespace-Specific |
|------|---------|-------------------|
| `docker-compose.unified.yml` | Unified service deployment | ✅ Codespace-optimized |
| `scripts/codespace-restart.sh` | Complete restart script | ✅ Codespace-specific |
| `scripts/codespace-setup.sh` | Initial setup script | ✅ Codespace-specific |
| `scripts/update-env-codespace.sh` | Environment configuration | ✅ Codespace-specific |
| `config/network-config.json` | Fabric connection profile | ⚠️ Uses `localhost` (works via port forwarding) |

### **Codespace Deployment Workflow**

#### **Initial Setup (First Time)**
```bash
# 1. Pull repository (automatic in Codespace)
git pull origin main

# 2. Run complete setup
bash scripts/codespace-restart.sh

# This script:
# - Starts all Docker containers
# - Creates Fabric channel
# - Deploys chaincode
# - Sets up wallet
# - Verifies all services
```

#### **After Codespace Restart**
```bash
# Codespace restarts - containers are stopped
# Run restart script to bring everything back up
bash scripts/codespace-restart.sh
```

#### **After Docker Restart**
```bash
# If Docker was restarted in Codespace
docker-compose -f docker-compose.unified.yml up -d
bash scripts/codespace-restart.sh
```

### **Codespace Environment Variables**

#### **Required for Codespace**
```bash
# Database - use container names
DB_HOST=postgres              # Not 'localhost'
DB_PORT=5432

# IPFS - use container name
IPFS_HOST=ipfs                # Not 'localhost'
IPFS_PORT=5001
IPFS_PROTOCOL=http

# Redis - use container name
REDIS_HOST=redis              # Not 'localhost'
REDIS_PORT=6379

# Blockchain - Fabric mode required
BLOCKCHAIN_MODE=fabric        # No fallbacks
FABRIC_NETWORK_CONFIG=./network-config.json
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration

# Storage
STORAGE_MODE=ipfs             # or 'auto' (tries IPFS first)
```

#### **Auto-Configuration**
- Script `scripts/update-env-codespace.sh` can update `.env` file automatically
- Or manually configure based on above values

### **Codespace-Specific Considerations**

#### **1. Resource Limitations**
- **RAM:** Codespace has limited RAM (varies by plan)
- **Impact:** Single orderer architecture chosen to reduce memory usage
- **Mitigation:** Monitor container memory usage: `docker stats`

#### **2. Ephemeral Storage**
- **Codespace:** Storage is ephemeral - data may be lost on restart
- **Impact:** 
  - Crypto materials must be in Git (committed)
  - Database data persists in Docker volumes
  - IPFS data persists in Docker volumes
- **Best Practice:** Commit all generated artifacts to Git

#### **3. Port Availability**
- **Codespace:** Automatically forwards ports
- **Default Ports:**
  - Application: `3001` → `https://{workspace}-3001.app.github.dev`
  - PostgreSQL: `5432` (internal only)
  - IPFS: `5001`, `8080` (internal only)
  - Fabric: `7050`, `7051` (internal only)
- **Access:** Use GitHub-provided URLs, not localhost

#### **4. Network Configuration**
- **Fabric Network Config:** `config/network-config.json` uses `localhost`
- **Why It Works:** Docker port forwarding makes `localhost` accessible from containers
- **Alternative:** Could use container names, but `localhost` works via Docker networking

#### **5. Wallet Persistence**
- **Location:** `wallet/` directory
- **Persistence:** Should be committed to Git (contains admin identity)
- **Generation:** Created by `scripts/setup-fabric-wallet.js`
- **Note:** Wallet is required for application to connect to Fabric

### **Codespace Troubleshooting**

#### **Common Issues**

1. **Containers Not Starting**
   ```bash
   # Check container status
   docker ps -a
   
   # Check logs
   docker logs orderer.lto.gov.ph --tail 50
   docker logs peer0.lto.gov.ph --tail 50
   ```

2. **Crypto Materials Missing**
   ```bash
   # Verify crypto materials exist
   ls -la fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/signcerts/
   
   # If missing, pull from Git
   git pull origin main
   ```

3. **Channel Creation Fails**
   ```bash
   # Check if channel already exists
   docker exec cli peer channel list
   
   # Recreate if needed
   docker exec cli peer channel create -o orderer.lto.gov.ph:7050 -c ltochannel -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem
   ```

4. **Wallet Missing**
   ```bash
   # Check if wallet exists
   ls wallet/
   
   # Recreate if missing
   node scripts/setup-fabric-wallet.js
   ```

5. **Services Not Accessible**
   ```bash
   # Verify containers are running
   docker ps
   
   # Check network connectivity
   docker exec postgres pg_isready -U lto_user
   curl http://ipfs:5001/api/v0/version
   ```

### **Codespace vs Local Development**

| Aspect | Local Development | Codespace |
|--------|------------------|-----------|
| **Service Discovery** | `localhost` | Container names (`postgres`, `ipfs`) |
| **Port Access** | Direct `localhost:PORT` | GitHub-forwarded URLs |
| **Crypto Materials** | Can regenerate | Must be in Git |
| **Storage** | Persistent | Ephemeral (use volumes) |
| **Resource Limits** | Machine-dependent | Plan-dependent |
| **Network Config** | `localhost` or container names | `localhost` (via Docker forwarding) |
| **Restart Procedure** | Manual Docker restart | `codespace-restart.sh` script |

### **Best Practices for Codespace**

1. ✅ **Commit crypto materials** - Required for Fabric to start
2. ✅ **Commit wallet** - Required for application to connect
3. ✅ **Use `codespace-restart.sh`** - Ensures proper startup sequence
4. ✅ **Monitor container resources** - Codespace has limits
5. ✅ **Use Docker volumes** - Persist database and IPFS data
6. ✅ **Test port forwarding** - Verify GitHub URLs work
7. ✅ **Check logs regularly** - Debug issues early

---

## 12. Security Updates (December 2024)

### **Authentication Bypass Fixes**

**Critical vulnerabilities fixed:**

1. **Document Upload Endpoint** - Now requires authentication
2. **Ledger Routes (9 endpoints)** - All now require authentication (admin-only for sensitive)
3. **Monitoring Routes (6 endpoints)** - All now require admin authentication

**Security Status:** ✅ **SECURE** - All authentication bypasses fixed

See `COMPREHENSIVE_WORKSPACE_SUMMARY.md` for detailed security documentation.

---

## ✅ Indexing Confirmation

**I have successfully indexed the following understanding:**

- ✅ Project purpose and domain (vehicle registration system)
- ✅ Complete tech stack (Node.js, Express, Fabric, IPFS, PostgreSQL)
- ✅ Project structure and file organization
- ✅ Entry points (server.js, HTML pages, chaincode)
- ✅ Data flow (registration, verification, clearance workflows)
- ✅ Code conventions (naming, patterns, architecture)
- ✅ Key architectural decisions and rationale
- ✅ Critical files and their purposes
- ✅ Common development workflows
- ✅ Testing and debugging approaches
- ✅ Security architecture and authentication requirements

**You can now ask me to:**
- Implement new features based on this architecture
- Fix bugs with full context awareness
- Refactor code following established patterns
- Add new API endpoints or frontend pages
- Modify chaincode or database schema
- Troubleshoot issues with understanding of the full system
- Review and improve security measures

**I'm ready to work on this codebase with comprehensive context!** 🚀

---

**Document Version:** 2.0  
**Last Updated:** December 2024  
**See Also:** `COMPREHENSIVE_WORKSPACE_SUMMARY.md` for complete workspace overview

