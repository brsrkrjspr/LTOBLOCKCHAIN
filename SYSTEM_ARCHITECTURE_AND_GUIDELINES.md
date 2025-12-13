# System Architecture & Guidelines
## TrustChain: Blockchain-based Vehicle Registration System

**Generated:** 2024  
**Purpose:** Comprehensive architectural documentation for developers and system architects  
**Status:** Production-ready system with Hyperledger Fabric integration

---

## 1. Project Overview

### Core Value Proposition
**TrustChain** is a blockchain-based vehicle registration and verification system for the Land Transportation Office (LTO) that provides:

- **Tamper-Proof Records:** All vehicle registrations and verifications are immutably recorded on Hyperledger Fabric blockchain
- **Multi-Organizational Workflow:** Seamless coordination between LTO, HPG (Highway Patrol Group), Insurance, and Emission organizations
- **Decentralized Document Storage:** Documents stored on IPFS with cryptographic verification
- **Permissioned Blockchain:** Enterprise-grade security with role-based access control
- **Audit Trail:** Complete transaction history with cryptographic proof of all actions

### Key Capabilities
1. **Vehicle Registration:** Owners submit vehicle information and documents through a multi-step wizard
2. **Document Verification:** LTO Admin can verify documents directly OR delegate to external organizations
3. **Application Approval/Rejection:** LTO Admin has authority to approve/reject applications with blockchain audit trail
4. **Clearance Workflows:** LTO can request clearance from HPG, Insurance, and Emission organizations
5. **Blockchain Integration:** All critical operations are recorded on Hyperledger Fabric with transaction IDs
6. **Document Management:** Secure document upload, storage (IPFS/local), and verification

### Target Users
- **Vehicle Owners:** Register vehicles, track application status
- **LTO Admin:** Verify documents, approve/reject applications, manage clearances
- **HPG Admin:** Review and approve/reject HPG clearance requests
- **Insurance Verifiers:** Verify insurance certificates
- **Emission Verifiers:** Verify emission certificates

---

## 2. Tech Stack

### Core Technologies

#### **Backend**
- **Runtime:** Node.js 16+ (ES6+)
- **Framework:** Express.js 4.18.2
- **Database:** PostgreSQL 14+ (with connection pooling)
- **Blockchain:** Hyperledger Fabric v2.5 (permissioned blockchain)
- **Storage:** IPFS (InterPlanetary File System) v0.39.0
- **Authentication:** JWT (JSON Web Tokens) with bcryptjs password hashing

#### **Frontend**
- **Language:** Vanilla JavaScript (ES6+), no frameworks
- **Markup:** HTML5
- **Styling:** CSS3 (custom stylesheet, no CSS frameworks)
- **State Management:** localStorage for authentication tokens and user data

#### **Infrastructure**
- **Containerization:** Docker & Docker Compose
- **Orchestration:** Docker Compose for multi-container deployment
- **Network:** Custom Docker network (`trustchain`) for service isolation

### Key Dependencies

```json
{
  "express": "^4.18.2",              // Web framework
  "fabric-network": "^2.2.20",       // Hyperledger Fabric SDK
  "fabric-ca-client": "^2.2.20",     // Fabric CA client
  "ipfs-http-client": "^60.0.1",     // IPFS client
  "pg": "^8.11.3",                   // PostgreSQL driver
  "jsonwebtoken": "^9.0.2",          // JWT authentication
  "bcryptjs": "^2.4.3",              // Password hashing
  "multer": "^1.4.5-lts.1",          // File upload handling
  "helmet": "^7.1.0",                // Security headers
  "express-rate-limit": "^7.1.5",    // Rate limiting
  "cors": "^2.8.5",                  // CORS middleware
  "dotenv": "^16.3.1",               // Environment variables
  "uuid": "^9.0.0"                   // UUID generation
}
```

### External Services

1. **Hyperledger Fabric Network**
   - Orderer: Transaction ordering service
   - Peer: Endorsing and committing peers
   - CouchDB: State database for rich queries
   - Chaincode: Smart contracts (vehicle-registration)

2. **IPFS Node**
   - Decentralized file storage
   - Fallback to local storage if IPFS unavailable
   - Content-addressed storage (CID-based)

3. **PostgreSQL Database**
   - Relational database for application data
   - Connection pooling (max 20 connections)
   - Transaction support

4. **Docker Services**
   - All services containerized
   - Network isolation via Docker networks
   - Volume persistence for data

---

## 3. Architecture & Structure

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                        │
│  (Vanilla JS, HTML5, CSS3 - Static files served by Express) │
├─────────────────────────────────────────────────────────────┤
│                        API LAYER                             │
│  (Express.js Routes - RESTful API endpoints)                │
├─────────────────────────────────────────────────────────────┤
│                      MIDDLEWARE LAYER                        │
│  (Authentication, Authorization, Error Handling)            │
├─────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                           │
│  (Business Logic: Fabric, Storage, Database Services)        │
├─────────────────────────────────────────────────────────────┤
│                      DATA LAYER                              │
│  (PostgreSQL, Hyperledger Fabric, IPFS)                      │
└─────────────────────────────────────────────────────────────┘
```

### Folder Structure

```
LTOBLOCKCHAIN/
│
├── 📄 Root HTML Files (Frontend Pages)
│   ├── index.html                          # Landing page
│   ├── login-signup.html                   # Authentication
│   ├── registration-wizard.html            # Vehicle registration form
│   ├── owner-dashboard.html                # Vehicle owner dashboard
│   ├── admin-dashboard.html                # LTO admin dashboard
│   ├── hpg-admin-dashboard.html            # HPG admin dashboard
│   ├── verifier-dashboard.html             # Emission verifier dashboard
│   ├── insurance-verifier-dashboard.html  # Insurance verifier dashboard
│   ├── document-viewer.html                # Document viewer with blockchain verification
│   ├── search.html                         # Public document verification
│   └── admin-blockchain-viewer.html        # Blockchain ledger viewer
│
├── 📁 backend/                             # Backend Application
│   ├── routes/                              # Express route handlers (REST API)
│   │   ├── auth.js                          # Authentication endpoints
│   │   ├── vehicles.js                     # Vehicle CRUD operations
│   │   ├── documents.js                    # Document upload/download
│   │   ├── blockchain.js                   # Chaincode invocations
│   │   ├── ledger.js                       # Transaction history
│   │   ├── notifications.js                # Email/SMS notifications
│   │   ├── lto.js                          # LTO admin workflow APIs
│   │   ├── hpg.js                          # HPG verification APIs
│   │   ├── insurance.js                    # Insurance verification APIs
│   │   ├── emission.js                     # Emission verification APIs
│   │   ├── health.js                       # Health check endpoints
│   │   └── monitoring.js                   # System metrics
│   │
│   ├── services/                            # Business logic services
│   │   ├── optimizedFabricService.js       # Hyperledger Fabric integration
│   │   ├── storageService.js               # Unified storage (IPFS/local)
│   │   ├── ipfsService.js                  # IPFS client wrapper
│   │   ├── localStorageService.js          # Local file storage fallback
│   │   ├── blockchainLedger.js             # Ledger management
│   │   └── monitoringService.js            # System metrics
│   │
│   ├── database/                            # Database layer
│   │   ├── db.js                           # PostgreSQL connection pool
│   │   └── services.js                     # High-level DB operations
│   │
│   ├── middleware/                          # Express middleware
│   │   ├── auth.js                         # JWT authentication
│   │   └── authorize.js                    # Role-based authorization
│   │
│   └── uploads/                             # Local file storage (fallback)
│
├── 📁 js/                                   # Frontend JavaScript
│   ├── api-client.js                       # Centralized HTTP client
│   ├── auth-utils.js                       # Authentication utilities
│   ├── utils.js                            # Shared utilities (Toast, Loading, etc.)
│   ├── owner-dashboard.js                  # Owner dashboard logic
│   ├── admin-dashboard.js                  # Admin dashboard logic
│   ├── registration-wizard.js              # Registration form logic
│   ├── document-viewer.js                  # Document viewer logic
│   ├── hpg-admin.js                        # HPG admin dashboard logic
│   ├── insurance-verifier-dashboard.js     # Insurance verifier logic
│   ├── verifier-dashboard.js               # Emission verifier logic
│   └── search.js                           # Public search logic
│
├── 📁 database/                             # Database scripts
│   ├── init-laptop.sql                     # Main database schema
│   ├── create-real-accounts.sql           # User account creation
│   └── [migration scripts]                 # Database migrations
│
├── 📁 chaincode/                            # Hyperledger Fabric Smart Contracts
│   └── vehicle-registration-production/
│       ├── index.js                        # Chaincode implementation
│       └── package.json                    # Chaincode dependencies
│
├── 📁 config/                                # Configuration files
│   ├── configtx.yaml                       # Channel configuration
│   ├── crypto-config.yaml                  # Cryptographic materials
│   └── network-config.json                 # Fabric network config
│
├── 📁 scripts/                               # Automation scripts
│   ├── codespace-restart.sh                # Codespace deployment
│   ├── setup-all-accounts.sh               # Account setup
│   └── [deployment scripts]                # Various deployment scripts
│
├── 📁 fabric-network/                        # Fabric network artifacts
│   └── [crypto materials, channel artifacts]
│
├── 📁 wallet/                                # Fabric wallet (user identities)
│
├── docker-compose.unified.yml               # Main Docker Compose file
├── server.js                                # Express server entry point
├── package.json                             # Node.js dependencies
└── .env                                     # Environment variables (not in repo)
```

### Architecture Pattern: **Layered Architecture with Service Layer**

The system follows a **layered architecture** pattern with clear separation of concerns:

1. **Presentation Layer:** HTML/CSS/JS frontend
2. **API Layer:** Express routes (thin controllers)
3. **Service Layer:** Business logic and orchestration
4. **Data Access Layer:** Database and blockchain services

### Entry Points

1. **Server Entry:** `server.js`
   - Initializes Express app
   - Configures middleware
   - Registers routes
   - Connects to services (Fabric, IPFS, Database)

2. **Frontend Entry:** HTML files in root directory
   - Each page is self-contained
   - JavaScript loaded via `<script>` tags
   - No build process (vanilla JS)

3. **API Entry:** Routes in `backend/routes/`
   - Mounted on `/api/*` paths
   - Protected by authentication middleware

---

## 4. Key Data Flows

### 4.1 Vehicle Registration Flow

```
1. User fills registration form (registration-wizard.html)
   ↓
2. Frontend: registration-wizard.js collects form data + documents
   ↓
3. POST /api/documents/upload (for each document)
   → Multer saves file temporarily
   → StorageService stores in IPFS (or local)
   → Returns document ID and CID
   ↓
4. POST /api/vehicles/register
   → Route: vehicles.js
   → Service: db.createVehicle() → PostgreSQL
   → Service: fabricService.registerVehicle() → Hyperledger Fabric
   → Returns vehicle ID and transaction ID
   ↓
5. Frontend stores vehicle ID in localStorage
   ↓
6. User redirected to owner-dashboard.html
```

### 4.2 Authentication Flow

```
1. User submits login form (login-signup.html)
   ↓
2. POST /api/auth/login
   → Route: auth.js
   → Service: db.getUserByEmail() → PostgreSQL
   → bcryptjs.compare() validates password
   → jwt.sign() generates JWT token
   → Returns token + user data
   ↓
3. Frontend: APIClient stores token in localStorage
   ↓
4. Subsequent requests: APIClient adds "Authorization: Bearer <token>" header
   ↓
5. Middleware: auth.js validates token
   → jwt.verify() checks token validity
   → Sets req.user with user data
   ↓
6. Route handler executes with authenticated user
```

### 4.3 Admin Approval/Rejection Flow

```
1. Admin views application (admin-dashboard.html)
   ↓
2. GET /api/vehicles/id/:id
   → Route: vehicles.js
   → Service: db.getVehicleById() → PostgreSQL
   → Service: db.getDocumentsByVehicle() → PostgreSQL
   → Returns vehicle + documents
   ↓
3. Admin clicks "Approve" or "Reject"
   ↓
4. PUT /api/vehicles/id/:id/status
   → Route: vehicles.js
   → Middleware: authenticateToken, authorizeRole(['admin'])
   → Service: db.updateVehicleStatus() → PostgreSQL
   → Service: fabricService.updateVerificationStatus() → Hyperledger Fabric
   → Service: db.addVehicleHistory() → PostgreSQL (audit trail)
   → Returns updated vehicle
   ↓
5. Frontend updates UI to show new status
```

### 4.4 Document Verification Flow (LTO → External Org)

```
1. LTO Admin clicks "Send HPG Clearance Request"
   ↓
2. POST /api/lto/send-to-hpg
   → Route: lto.js
   → Service: db.createClearanceRequest() → PostgreSQL
   → Service: db.createNotification() → PostgreSQL (for HPG admin)
   → Returns request ID
   ↓
3. HPG Admin views requests (hpg-admin-dashboard.html)
   ↓
4. GET /api/hpg/requests?status=PENDING
   → Route: hpg.js
   → Service: db.getClearanceRequestsByType('hpg') → PostgreSQL
   → Returns pending requests
   ↓
5. HPG Admin approves/rejects
   ↓
6. POST /api/hpg/approve or /api/hpg/reject
   → Route: hpg.js
   → Service: db.updateClearanceRequest() → PostgreSQL
   → Service: fabricService.updateVerificationStatus() → Hyperledger Fabric
   → Returns updated request
```

### 4.5 Document Retrieval Flow

```
1. User clicks "View Document"
   ↓
2. GET /api/documents/:documentId
   → Route: documents.js
   → Service: db.getDocumentById() → PostgreSQL
   → Service: storageService.getFile() → IPFS or local storage
   → Returns file buffer or URL
   ↓
3. Frontend displays document (PDF viewer or image)
```

---

## 5. Design Patterns & Conventions

### 5.1 Naming Conventions

#### **Files & Directories**
- **Routes:** `kebab-case.js` (e.g., `vehicle-registration.js`)
- **Services:** `camelCase.js` (e.g., `optimizedFabricService.js`)
- **Frontend JS:** `kebab-case.js` (e.g., `owner-dashboard.js`)
- **HTML:** `kebab-case.html` (e.g., `admin-dashboard.html`)
- **Database Scripts:** `kebab-case.sql` (e.g., `init-laptop.sql`)

#### **Code**
- **Variables:** `camelCase` (e.g., `vehicleId`, `transactionId`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`, `JWT_SECRET`)
- **Classes:** `PascalCase` (e.g., `OptimizedFabricService`, `APIClient`)
- **Database Tables:** `snake_case` (e.g., `vehicle_verifications`, `clearance_requests`)
- **Database Columns:** `snake_case` (e.g., `plate_number`, `created_at`)
- **API Endpoints:** `kebab-case` (e.g., `/api/vehicles/id/:id`)

### 5.2 Architectural Patterns

#### **1. Service Layer Pattern**
- **Routes** (`backend/routes/`) handle HTTP requests/responses (thin controllers)
- **Services** (`backend/services/`) contain business logic
- **Database** (`backend/database/`) handles data access
- **Separation:** Routes → Services → Database

**Example:**
```javascript
// Route (thin controller)
router.post('/register', async (req, res) => {
    const vehicle = await db.createVehicle(req.body);
    await fabricService.registerVehicle(vehicle);
    res.json({ success: true, vehicle });
});

// Service (business logic)
async function createVehicle(vehicleData) {
    // Validation, transformation, etc.
    return await db.query('INSERT INTO vehicles ...');
}
```

#### **2. Singleton Pattern**
- **Services:** Exported as singleton instances
- **Database Pool:** Single connection pool instance
- **Fabric Service:** Single gateway connection

**Example:**
```javascript
// backend/services/optimizedFabricService.js
class OptimizedFabricService {
    constructor() {
        this.gateway = new Gateway();
        this.isConnected = false;
    }
}
const optimizedFabricService = new OptimizedFabricService();
module.exports = optimizedFabricService;
```

#### **3. Factory Pattern**
- **Storage Service:** Factory pattern for IPFS vs Local storage
- **Service Selection:** Based on environment variables

**Example:**
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
- **Error Handling:** Centralized error handler at end of chain

**Example:**
```javascript
router.post('/endpoint', 
    authenticateToken,           // JWT validation
    authorizeRole(['admin']),     // Role check
    async (req, res) => { ... }  // Handler
);
```

#### **5. Repository Pattern**
- **Database Services:** High-level database operations
- **Abstraction:** Hides SQL complexity from routes

**Example:**
```javascript
// backend/database/services.js
async function getVehicleById(id) {
    return await db.query('SELECT ... FROM vehicles WHERE id = $1', [id]);
}
```

### 5.3 Error Handling Patterns

#### **Consistent Error Response Format**
```javascript
res.status(500).json({
    success: false,
    error: 'Error message',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
});
```

#### **Try-Catch Blocks**
- All async functions wrapped in try-catch
- Errors logged to console
- User-friendly error messages returned

#### **Error Propagation**
- Service errors bubble up to routes
- Routes format errors for API response
- Frontend APIClient handles HTTP errors

### 5.4 State Management

#### **Frontend**
- **Authentication:** `localStorage.getItem('authToken')`
- **User Data:** `localStorage.getItem('currentUser')`
- **Form Data:** `localStorage` (FormPersistence class)
- **No Global State:** Each page manages its own state

#### **Backend**
- **Database:** PostgreSQL (persistent state)
- **Blockchain:** Hyperledger Fabric (immutable state)
- **Session:** Stateless (JWT tokens)

### 5.5 Code Organization Patterns

#### **Frontend JavaScript**
- **APIClient Class:** Centralized HTTP client (`js/api-client.js`)
  - Automatic token injection
  - Error handling
  - Token expiration handling
- **Dashboard Files:** Page-specific logic (e.g., `owner-dashboard.js`)
- **Utility Files:** Shared functions (`js/utils.js`, `js/auth-utils.js`)
- **No Module System:** Global variables and `window` object

#### **Backend Structure**
- **Route Files:** Thin controllers, delegate to services
- **Service Files:** Business logic, orchestrate database/Fabric calls
- **Database Files:** SQL queries, connection management
- **Middleware:** Reusable authentication/authorization logic

#### **Chaincode Structure**
- **Class-Based:** `VehicleRegistrationContract extends Contract`
- **Methods:** Async functions for each transaction type
- **Error Handling:** Try-catch with descriptive errors
- **Events:** Emit events for transaction tracking

### 5.6 API Design Conventions

#### **RESTful Endpoints**
- **GET:** Retrieve resources
- **POST:** Create resources
- **PUT:** Update resources
- **DELETE:** Delete resources

#### **Response Format**
```javascript
{
    success: true/false,
    data: { ... },           // On success
    error: "Error message",   // On error
    message: "Description"    // Additional info
}
```

#### **Status Codes**
- **200:** Success
- **201:** Created
- **400:** Bad Request
- **401:** Unauthorized
- **403:** Forbidden
- **404:** Not Found
- **409:** Conflict
- **500:** Internal Server Error

---

## 6. External Dependencies

### 6.1 Hyperledger Fabric Network

**Components:**
- **Orderer:** `orderer.lto.gov.ph` (port 7050)
- **Peer:** `peer0.lto.gov.ph` (port 7051)
- **CouchDB:** State database (port 5984)
- **Channel:** `ltochannel`
- **Chaincode:** `vehicle-registration`

**Connection:**
- **SDK:** `fabric-network` v2.2.20
- **Wallet:** File system wallet in `/wallet` directory
- **Network Config:** `network-config.json`
- **Identity:** `admin` user enrolled in wallet

**Key Operations:**
- `RegisterVehicle()`: Register new vehicle on blockchain
- `GetVehicle()`: Query vehicle by VIN
- `UpdateVerificationStatus()`: Update verification status
- `TransferOwnership()`: Transfer vehicle ownership

### 6.2 IPFS (InterPlanetary File System)

**Configuration:**
- **Host:** `localhost` (Codespace) or `ipfs` (Docker network)
- **Port:** `5001` (API), `8080` (Gateway)
- **Client:** `ipfs-http-client` v60.0.1

**Storage Modes:**
- **IPFS Mode:** Documents stored on IPFS, CID stored in database
- **Local Mode:** Documents stored in `backend/uploads/`, file path in database
- **Auto Mode:** Try IPFS first, fallback to local

**Key Operations:**
- `addFile()`: Upload file to IPFS, returns CID
- `getFile()`: Retrieve file from IPFS by CID
- `pinFile()`: Pin file to prevent garbage collection

### 6.3 PostgreSQL Database

**Configuration:**
- **Host:** `localhost` or `postgres` (Docker)
- **Port:** `5432`
- **Database:** `lto_blockchain`
- **Pool:** Max 20 connections

**Key Tables:**
- `users`: User accounts and authentication
- `vehicles`: Vehicle registration data
- `documents`: Document metadata and storage references
- `vehicle_verifications`: Verification status per organization
- `clearance_requests`: Requests to external organizations
- `vehicle_history`: Audit trail of all vehicle actions
- `notifications`: User notifications

**Connection:**
- **Driver:** `pg` v8.11.3
- **Pool:** Connection pooling for performance
- **Transactions:** Support for multi-query transactions

### 6.4 Authentication & Authorization

**JWT Tokens:**
- **Library:** `jsonwebtoken` v9.0.2
- **Secret:** `JWT_SECRET` environment variable
- **Expiration:** 24 hours
- **Payload:** `{ userId, email, role }`

**Password Hashing:**
- **Library:** `bcryptjs` v2.4.3
- **Rounds:** 10 (default)

**Roles:**
- `admin`: LTO Admin (full access)
- `vehicle_owner`: Vehicle owner (limited access)
- `insurance_verifier`: Insurance organization verifier
- `emission_verifier`: Emission organization verifier
- `hpg_admin`: HPG Admin (via email pattern matching)

### 6.5 File Upload

**Multer:**
- **Library:** `multer` v1.4.5-lts.1
- **Storage:** Disk storage in `backend/uploads/`
- **Max Size:** 10MB (configurable via `MAX_FILE_SIZE`)
- **Allowed Types:** PDF, JPG, JPEG, PNG (configurable)

**File Processing:**
1. Multer saves file temporarily
2. Calculate SHA-256 hash
3. Store in IPFS (or local)
4. Save metadata to database
5. Delete temporary file

---

## 7. Environment Variables

### Required Variables

```bash
# Server
PORT=3001
NODE_ENV=development|production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Authentication
JWT_SECRET=your-secret-key-here

# Blockchain
BLOCKCHAIN_MODE=fabric  # Must be 'fabric' (no fallbacks)

# Storage
STORAGE_MODE=auto|ipfs|local  # 'auto' tries IPFS first, falls back to local
IPFS_HOST=localhost  # or 'ipfs' for Docker network
IPFS_PORT=5001
IPFS_GATEWAY_PORT=8080

# File Upload
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# Frontend
FRONTEND_URL=http://localhost:3001
```

### Optional Variables

```bash
# Development
VERBOSE_DB_ERRORS=true
NODE_ENV=development

# Security
TRUST_PROXY=1  # For Codespace/GitHub forwarding
```

---

## 8. Deployment Architecture

### Docker Compose Services

**Core Services:**
- `orderer.lto.gov.ph`: Hyperledger Fabric orderer
- `peer0.lto.gov.ph`: Hyperledger Fabric peer
- `couchdb`: State database for Fabric
- `ipfs`: IPFS node (optional)
- `postgres`: PostgreSQL database
- `app`: Node.js application (via `npm start`)

**Network:**
- **Name:** `trustchain`
- **Type:** Bridge network
- **Isolation:** Services communicate via service names

**Volumes:**
- `postgres-data`: PostgreSQL data persistence
- `ipfs-data`: IPFS data persistence
- `peer-data`: Fabric peer data
- `orderer-data`: Fabric orderer data
- `couchdb-data`: CouchDB data

### Codespace Deployment

**Specific Considerations:**
- **IPFS Host:** `localhost` (app runs on host, IPFS in container)
- **Port Forwarding:** GitHub Codespace forwards ports automatically
- **Trust Proxy:** Enabled for correct IP detection
- **Network:** Services accessible via `localhost` from host

---

## 9. Security Considerations

### Authentication & Authorization
- **JWT Tokens:** Secure token-based authentication
- **Password Hashing:** bcrypt with salt rounds
- **Role-Based Access:** Middleware enforces role permissions
- **Token Expiration:** 24-hour expiration with refresh capability

### Data Security
- **HTTPS:** Recommended for production (not enforced in code)
- **Helmet:** Security headers middleware
- **Rate Limiting:** `express-rate-limit` prevents abuse
- **Input Validation:** SQL parameterized queries prevent injection
- **File Validation:** File type and size validation

### Blockchain Security
- **Permissioned Network:** Only authorized organizations can participate
- **MSP Identity:** Cryptographic identity verification
- **Transaction Signing:** All transactions cryptographically signed
- **Immutable Records:** Blockchain prevents tampering

### Storage Security
- **IPFS:** Content-addressed storage (tamper-proof)
- **File Hashing:** SHA-256 hash verification
- **Access Control:** Documents only accessible to authorized users

---

## 10. Development Guidelines

### Adding a New Feature

1. **Backend Route:**
   - Create route in `backend/routes/[feature].js`
   - Add middleware: `authenticateToken`, `authorizeRole([roles])`
   - Delegate to service layer
   - Return consistent JSON response

2. **Service Layer:**
   - Add business logic in `backend/services/[feature]Service.js`
   - Use database services for data access
   - Use Fabric service for blockchain operations
   - Handle errors gracefully

3. **Database:**
   - Add tables/columns in migration script
   - Update `backend/database/services.js` with new functions
   - Use parameterized queries

4. **Frontend:**
   - Create HTML page if needed
   - Add JavaScript file in `js/` directory
   - Use `APIClient` for API calls
   - Follow existing UI patterns

5. **Testing:**
   - Test authentication/authorization
   - Test error cases
   - Test blockchain integration
   - Test database operations

### Code Style Guidelines

1. **Use async/await** for asynchronous operations
2. **Wrap async functions** in try-catch blocks
3. **Use consistent error handling** (see Error Handling Patterns)
4. **Follow naming conventions** (see Naming Conventions)
5. **Add comments** for complex logic
6. **Keep functions small** and focused
7. **Use service layer** for business logic (not in routes)

### Database Guidelines

1. **Use parameterized queries** to prevent SQL injection
2. **Use transactions** for multi-step operations
3. **Add indexes** for frequently queried columns
4. **Use foreign keys** for referential integrity
5. **Add `created_at` and `updated_at`** timestamps

### Blockchain Guidelines

1. **Always check connection** before Fabric operations
2. **Handle errors gracefully** (network issues, timeouts)
3. **Emit events** for important transactions
4. **Use composite keys** for efficient queries
5. **Validate input** before submitting to chaincode

---

## 11. Key Files Reference

### Critical Files for Understanding

#### **Backend**
- `server.js`: Application entry point, middleware setup
- `backend/routes/vehicles.js`: Vehicle CRUD, status updates
- `backend/routes/lto.js`: LTO admin workflows
- `backend/services/optimizedFabricService.js`: Fabric integration
- `backend/database/services.js`: Database operations
- `backend/middleware/auth.js`: Authentication logic
- `backend/middleware/authorize.js`: Authorization logic

#### **Frontend**
- `js/api-client.js`: HTTP client wrapper
- `js/owner-dashboard.js`: Owner dashboard logic
- `js/admin-dashboard.js`: Admin dashboard logic
- `js/registration-wizard.js`: Registration form logic

#### **Blockchain**
- `chaincode/vehicle-registration-production/index.js`: Smart contract
- `backend/services/optimizedFabricService.js`: SDK usage
- `network-config.json`: Fabric network configuration

#### **Database**
- `database/init-laptop.sql`: Database schema
- `backend/database/db.js`: Connection pool
- `backend/database/services.js`: High-level operations

---

## 12. Conclusion

This system demonstrates a **production-ready, enterprise-grade blockchain application** with:

- **Clear Architecture:** Layered architecture with service layer
- **Separation of Concerns:** Routes, services, and data access are distinct
- **Security:** JWT authentication, role-based authorization, blockchain immutability
- **Scalability:** Connection pooling, Docker containerization
- **Maintainability:** Consistent patterns, clear naming conventions
- **Extensibility:** Easy to add new features following existing patterns

### For New Developers

1. **Start with:** `server.js` → `backend/routes/vehicles.js` → `backend/services/optimizedFabricService.js`
2. **Understand:** Authentication flow, database schema, blockchain operations
3. **Follow:** Existing patterns and conventions
4. **Test:** All error cases and edge cases
5. **Document:** Complex logic and architectural decisions

### For System Architects

- **Architecture:** Layered with service layer (scalable, maintainable)
- **Blockchain:** Permissioned network (enterprise-grade security)
- **Storage:** IPFS with local fallback (resilient)
- **Database:** PostgreSQL with connection pooling (performant)
- **Deployment:** Docker Compose (portable, reproducible)

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** Development Team

