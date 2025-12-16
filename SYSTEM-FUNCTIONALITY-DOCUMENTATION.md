# 📚 TrustChain LTO System - Comprehensive Functionality Documentation

**Version:** 1.0  
**Last Updated:** 2025-01-XX  
**System:** TrustChain LTO - Blockchain-based Vehicle Registration System

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Vehicle Registration Flow](#vehicle-registration-flow)
3. [Document Management](#document-management)
4. [Transfer of Ownership](#transfer-of-ownership)
5. [LTO Requests to External Organizations](#lto-requests-to-external-organizations)
6. [Blockchain Integration](#blockchain-integration)
7. [Blockchain History Tracing](#blockchain-history-tracing)
8. [Service Configuration](#service-configuration)
9. [API Endpoints Reference](#api-endpoints-reference)
10. [Database Schema](#database-schema)
11. [Troubleshooting](#troubleshooting)

---

## 1. System Overview

### 1.1 Architecture

The TrustChain LTO system is a **blockchain-based vehicle registration platform** that uses:

- **Hyperledger Fabric 2.5** - Permissioned blockchain network for immutable vehicle records
- **IPFS (InterPlanetary File System)** - Decentralized document storage (REQUIRED, no fallbacks)
- **PostgreSQL** - Relational database for application state and metadata
- **Node.js/Express** - Backend API server
- **Vanilla JavaScript** - Frontend application

### 1.2 Key Principles

- ✅ **Real Services Only** - No mocks, no fallbacks
- ✅ **IPFS Required** - All documents must be stored on IPFS
- ✅ **Blockchain First** - All vehicle registrations are recorded on blockchain immediately
- ✅ **Immutable Records** - Blockchain provides audit trail and tamper-proof history

---

## 2. Vehicle Registration Flow

### 2.1 Registration Process Overview

```
User Registration → Document Upload → Vehicle Registration → Blockchain Recording → Admin Approval
```

### 2.2 Detailed Registration Steps

#### **Step 1: User Account Creation**
- **Endpoint:** `POST /api/auth/register`
- **Process:**
  - User provides: email, password, firstName, lastName, phone
  - System creates user account with role: `vehicle_owner`
  - Password is hashed using bcrypt (12 rounds)
  - User receives JWT token for authentication

#### **Step 2: Document Upload (During Registration Wizard)**
- **Endpoint:** `POST /api/documents/upload`
- **Required Documents:**
  - `registrationCert` - Vehicle registration certificate
  - `insuranceCert` - Insurance certificate
  - `emissionCert` - Emission test certificate
  - `ownerId` - Owner identification document
- **Process:**
  1. User selects document file (PDF, JPG, PNG - max 10MB)
  2. File is uploaded via multipart/form-data
  3. **IPFS Storage (REQUIRED):**
     - File is stored on IPFS network
     - IPFS returns Content Identifier (CID)
     - CID is stored in database (`documents.ipfs_cid`)
  4. Document record created in database:
     - `vehicle_id` = NULL (will be linked later)
     - `ipfs_cid` = IPFS CID
     - `filename`, `original_name`, `file_path`, `file_size`, `mime_type`
  5. Response includes:
     - `documentId` - Database record ID
     - `cid` - IPFS Content Identifier
     - `filename` - Stored filename
     - `storageMode` - Always `ipfs` (no fallbacks)

**⚠️ Important:** If IPFS is unavailable, document upload returns `503 Service Unavailable`. Registration cannot proceed without documents.

#### **Step 3: Vehicle Registration Submission**
- **Endpoint:** `POST /api/vehicles/register`
- **Request Body:**
  ```json
  {
    "vehicle": {
      "vin": "ABC1234567890XYZ",
      "plateNumber": "ABC-1234",
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "color": "White",
      "engineNumber": "ENG123456",
      "chassisNumber": "CHS123456",
      "vehicleType": "PASSENGER",
      "fuelType": "GASOLINE",
      "transmission": "AUTOMATIC",
      "engineDisplacement": "2.5L"
    },
    "owner": {
      "email": "owner@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890"
    },
    "documents": {
      "registrationCert": { "id": "uuid", "cid": "QmXXX...", "filename": "..." },
      "insuranceCert": { "id": "uuid", "cid": "QmYYY...", "filename": "..." },
      "emissionCert": { "id": "uuid", "cid": "QmZZZ...", "filename": "..." },
      "ownerId": { "id": "uuid", "cid": "QmAAA...", "filename": "..." }
    }
  }
  ```

- **Process:**
  1. **Owner Account Resolution:**
     - If owner email exists, use existing account
     - If not, create new user account with role `vehicle_owner`
  
  2. **Vehicle Record Creation:**
     - Create vehicle in PostgreSQL database
     - Status: `SUBMITTED`
     - Link to owner via `owner_id`
  
  3. **Document Linking:**
     - For each document in `registrationData.documents`:
       - **Method 1:** Find by document ID (if provided)
       - **Method 2:** Find by filename or CID (for unlinked documents)
       - **Method 3:** Create new document record if not found
     - Update document record:
       - Set `vehicle_id` = new vehicle ID
       - Set `document_type` = mapped type (registration_cert, insurance_cert, etc.)
       - Set `uploaded_by` = owner user ID
     - Collect IPFS CIDs for blockchain registration
  
  4. **Blockchain Registration (IMMEDIATE):**
     - **Status Change:** `SUBMITTED` → `PENDING_BLOCKCHAIN`
     - **Blockchain Data Prepared:**
       ```json
       {
         "vin": "ABC1234567890XYZ",
         "plateNumber": "ABC-1234",
         "make": "Toyota",
         "model": "Camry",
         "year": 2023,
         "color": "White",
         "engineNumber": "ENG123456",
         "chassisNumber": "CHS123456",
         "vehicleType": "PASSENGER",
         "fuelType": "GASOLINE",
         "transmission": "AUTOMATIC",
         "engineDisplacement": "2.5L",
         "owner": {
           "id": "user-uuid",
           "email": "owner@example.com",
           "firstName": "John",
           "lastName": "Doe"
         },
         "documents": {
           "registrationCert": { "cid": "QmXXX...", "filename": "...", "documentType": "registration_cert" },
           "insuranceCert": { "cid": "QmYYY...", "filename": "...", "documentType": "insurance_cert" },
           "emissionCert": { "cid": "QmZZZ...", "filename": "...", "documentType": "emission_cert" },
           "ownerId": { "cid": "QmAAA...", "filename": "...", "documentType": "owner_id" }
         }
       }
       ```
     - **Chaincode Invocation:**
       - Function: `RegisterVehicle`
       - Parameters: JSON stringified vehicle data
       - Returns: Transaction ID (Fabric TX ID)
     - **Transaction Status Polling:**
       - Poll Fabric for transaction commit status
       - If `committed`: Status → `SUBMITTED` (awaiting admin approval)
       - If `pending`: Status → `PENDING_BLOCKCHAIN` (keep polling)
     - **History Record:**
       - Action: `BLOCKCHAIN_REGISTERED`
       - Description: "Vehicle registered on blockchain (awaiting admin approval)"
       - Transaction ID: Fabric TX ID
       - Metadata: Full blockchain result and transaction status

**✅ Answer: YES, ALL registrations (even pending approval) are recorded on blockchain IMMEDIATELY upon submission.**

#### **Step 4: Admin Approval**
- **Endpoint:** `POST /api/lto/approve-clearance`
- **Prerequisites:**
  - All verifications complete:
    - HPG Clearance: `COMPLETED`
    - Insurance Verification: `APPROVED`
    - Emission Verification: `APPROVED`
- **Process:**
  1. Admin reviews vehicle and verifications
  2. Admin approves clearance
  3. Vehicle status: `APPROVED`
  4. Vehicle is now fully registered and operational

### 2.3 Registration Status Flow

```
SUBMITTED → PENDING_BLOCKCHAIN → SUBMITTED → APPROVED
   ↓              ↓                  ↓           ↓
[Created]  [Blockchain TX]    [Awaiting]  [Fully]
           [In Progress]      [Admin]      [Registered]
```

### 2.4 Error Handling

#### **Document Upload Failure (503)**
- **Cause:** IPFS service unavailable
- **Response:** `503 Service Unavailable`
- **Message:** "IPFS storage is required (STORAGE_MODE=ipfs) but IPFS service is unavailable"
- **Action Required:** Start IPFS service, then retry upload

#### **Blockchain Registration Failure**
- **Cause:** Fabric network unavailable or chaincode error
- **Response:** Vehicle record is **DELETED** (rollback)
- **Error:** "Blockchain registration required but failed"
- **Action Required:** Fix Fabric network, then retry registration

#### **Duplicate VIN (409)**
- **Cause:** Vehicle with same VIN already exists
- **Response:** `409 Conflict`
- **Message:** "Vehicle with this VIN already exists"
- **Action Required:** Use different VIN or contact admin

---

## 3. Document Management

### 3.1 Document Storage Architecture

```
User Upload → Multer (File Handler) → IPFS Service → IPFS Network
                ↓                           ↓
         Temporary File            IPFS CID Generated
                ↓                           ↓
         Storage Service ← ← ← ← ← ← ← ← ← ←
                ↓
         Database Record
         (vehicle_id, ipfs_cid, filename, etc.)
```

### 3.2 Document Types

| Document Type | Database Enum | Description |
|--------------|---------------|-------------|
| `registrationCert` | `registration_cert` | Vehicle registration certificate |
| `insuranceCert` | `insurance_cert` | Insurance certificate |
| `emissionCert` | `emission_cert` | Emission test certificate |
| `ownerId` | `owner_id` | Owner identification document |

### 3.3 Document Linking During Registration

When a vehicle is registered, documents are linked using **four methods** (in order):

1. **By Document ID (Primary Method):**
   - If `docData.id` is provided and not `TEMP_*`
   - Query: `SELECT * FROM documents WHERE id = $1`
   - Update: `UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4`
   - **Most reliable method** - uses document ID from upload response

2. **By Filename or CID (Secondary Method):**
   - If document not found by ID
   - Query: `SELECT * FROM documents WHERE (filename = $1 OR ipfs_cid = $2) AND (vehicle_id IS NULL OR vehicle_id = $3)`
   - Update: Link to vehicle
   - **Useful when:** Document ID not provided but filename/CID is known

3. **By Recent Unlinked Documents (Fallback Method):**
   - If document not found by ID, filename, or CID
   - Query: `SELECT * FROM documents WHERE vehicle_id IS NULL AND uploaded_by = $1 AND document_type = $2 AND uploaded_at > NOW() - INTERVAL '1 hour'`
   - Update: Link most recent unlinked document of matching type
   - **Useful when:** Documents were uploaded but upload response wasn't included in registration request
   - **Limitation:** Only matches documents uploaded within last hour by same owner

4. **Create New Record (Last Resort):**
   - If document not found by any method AND filename or CID is provided
   - Create new document record with provided data
   - Link to vehicle immediately
   - **Note:** Only creates if at least filename or CID is available

### 3.4 Document Retrieval

- **From IPFS:** Use CID to retrieve from IPFS gateway
- **From Database:** Query by `vehicle_id` or `document_id`
- **URL Format:** `https://ipfs.io/ipfs/{CID}` or local gateway `http://ipfs:8080/ipfs/{CID}`

### 3.5 Document Issues and Fixes

**Issue:** Documents not linking to vehicles during registration

**Root Causes:**
1. Document upload failed (503 - IPFS unavailable)
2. Document ID not included in registration request
3. Document CID mismatch

**Solution:**
- Ensure IPFS is running before document upload
- Include document IDs in registration request
- Verify CIDs match between upload and registration

---

## 4. Transfer of Ownership

### 4.1 Transfer Request Flow

```
Owner Creates Request → Admin Reviews → Admin Approves → Blockchain Update → Ownership Transferred
```

### 4.2 Transfer Request Creation

- **Endpoint:** `POST /api/vehicles/transfer/requests`
- **Required Fields:**
  - `vehicleId` - Vehicle UUID
  - `buyerId` OR `buyerInfo` - Buyer user ID or buyer information
  - `documentIds` (optional) - Array of document IDs for transfer

- **Process:**
  1. **Validation:**
     - Vehicle exists
     - User is vehicle owner (or admin)
     - No pending transfer request exists
  
  2. **Transfer Request Creation:**
     - Status: `PENDING`
     - `seller_id` = Current owner ID
     - `buyer_id` = Buyer user ID (if provided)
     - `buyer_info` = Buyer information JSON (if buyer not registered)
  
  3. **Document Linking:**
     - Link transfer documents (OR/CR, seller ID, buyer ID)
     - Store in `transfer_documents` table
  
  4. **History Record:**
     - Action: `TRANSFER_REQUESTED`
     - Description: "Transfer request submitted by {email}"

### 4.3 Transfer Request Approval

- **Endpoint:** `POST /api/vehicles/transfer/requests/:id/approve`
- **Required Role:** `admin`

- **Process:**
  1. **Validation:**
     - Transfer request exists and is `PENDING`
     - Vehicle exists
     - Buyer information available
  
  2. **Buyer Account Creation (if needed):**
     - If `buyer_info` provided but no `buyer_id`:
       - Create new user account
       - Role: `vehicle_owner`
       - Temporary password generated
  
  3. **Database Ownership Update:**
     - Update vehicle: `owner_id` = `buyerId`
     - Update transfer request: Status = `APPROVED`
  
  4. **Blockchain Ownership Transfer:**
     - **Chaincode Function:** `TransferOwnership`
     - **Parameters:**
       - VIN
       - New owner data: `{ email, firstName, lastName }`
       - Transfer data: `{ reason, transferDate, approvedBy }`
     - **Returns:** Transaction ID
  
  5. **Verification Reset:**
     - Reset all verifications to `PENDING` for new owner
     - New owner must complete verifications again
  
  6. **History Records:**
     - Action: `OWNERSHIP_TRANSFERRED`
     - Description: "Ownership transferred via transfer request {id}. Approved by {email}"
     - Transaction ID: Blockchain TX ID
  
  7. **Notifications:**
     - Seller: "Transfer Request Approved"
     - Buyer: "Vehicle Ownership Transferred"

### 4.4 Transfer Request Rejection

- **Endpoint:** `POST /api/vehicles/transfer/requests/:id/reject`
- **Required Role:** `admin`
- **Process:**
  - Update status: `REJECTED`
  - Store rejection reason
  - Notify seller

### 4.5 Direct Ownership Transfer (Legacy)

- **Endpoint:** `PUT /api/vehicles/:vin/transfer`
- **Note:** This endpoint does NOT use blockchain (legacy implementation)
- **Use:** Transfer request flow instead (recommended)

---

## 5. LTO Requests to External Organizations

### 5.1 Request Types

The system supports three types of external organization requests:

1. **HPG Clearance Request** - Highway Patrol Group clearance
2. **Insurance Verification Request** - Insurance company verification
3. **Emission Verification Request** - Emission testing center verification

### 5.2 HPG Clearance Request

- **Endpoint:** `POST /api/lto/send-to-hpg`
- **Required Role:** `admin`
- **Required Fields:**
  - `vehicleId` - Vehicle UUID
  - `purpose` (optional) - Purpose of clearance request
  - `notes` (optional) - Additional notes

- **Process:**
  1. **Validation:**
     - Vehicle exists
     - No existing pending HPG request
  
  2. **Clearance Request Creation:**
     - Type: `hpg`
     - Status: `PENDING`
     - Assigned to: HPG admin user (if exists)
  
  3. **History Record:**
     - Action: `HPG_CLEARANCE_REQUESTED`
     - Description: "HPG clearance requested by {email}. Purpose: {purpose}"
  
  4. **Notification:**
     - HPG admin receives notification (if assigned)

- **HPG Admin Actions:**
  - View request: `GET /api/hpg/requests`
  - Approve/Reject: `POST /api/hpg/requests/:id/approve` or `/reject`
  - Update status: `COMPLETED` when clearance verified

### 5.3 Insurance Verification Request

- **Endpoint:** `POST /api/lto/send-to-insurance`
- **Required Role:** `admin`
- **Process:**
  1. Create clearance request (type: `insurance`)
  2. Assign to insurance verifier user
  3. Update vehicle verification status: `insurance` → `PENDING`
  4. History: `INSURANCE_VERIFICATION_REQUESTED`
  5. Notification to insurance verifier

- **Insurance Verifier Actions:**
  - View requests: `GET /api/insurance/requests`
  - Approve/Reject: `POST /api/insurance/requests/:id/approve` or `/reject`
  - Updates vehicle verification status

### 5.4 Emission Verification Request

- **Endpoint:** `POST /api/lto/send-to-emission`
- **Required Role:** `admin`
- **Process:**
  1. Create clearance request (type: `emission`)
  2. Assign to emission verifier user
  3. Update vehicle verification status: `emission` → `PENDING`
  4. History: `EMISSION_VERIFICATION_REQUESTED`
  5. Notification to emission verifier

- **Emission Verifier Actions:**
  - View requests: `GET /api/emission/requests`
  - Approve/Reject: `POST /api/emission/requests/:id/approve` or `/reject`
  - Updates vehicle verification status

### 5.5 Clearance Approval (Final Step)

- **Endpoint:** `POST /api/lto/approve-clearance`
- **Required Role:** `admin`
- **Prerequisites:**
  - HPG Clearance: `COMPLETED`
  - Insurance Verification: `APPROVED`
  - Emission Verification: `APPROVED`

- **Process:**
  1. Validate all verifications complete
  2. Update vehicle status: `APPROVED`
  3. Vehicle is now fully registered

---

## 6. Blockchain Integration

### 6.1 Hyperledger Fabric Network

- **Network Name:** `ltochannel`
- **Chaincode:** `vehicle-registration`
- **Organization:** `LTOMSP`
- **Peer:** `peer0.lto.gov.ph:7051`
- **Orderer:** `orderer.lto.gov.ph:7050`

### 6.2 Chaincode Functions

#### **RegisterVehicle**
- **Purpose:** Register new vehicle on blockchain
- **Parameters:** JSON stringified vehicle data
- **Returns:** Transaction ID
- **When Called:** Immediately upon vehicle registration submission
- **Status:** Vehicle recorded on blockchain even if admin approval pending

#### **GetVehicle**
- **Purpose:** Retrieve vehicle from blockchain
- **Parameters:** VIN
- **Returns:** Vehicle record with full history

#### **TransferOwnership**
- **Purpose:** Transfer vehicle ownership on blockchain
- **Parameters:** VIN, new owner data, transfer data
- **Returns:** Transaction ID
- **When Called:** When admin approves transfer request

#### **UpdateVerificationStatus**
- **Purpose:** Update verification status on blockchain
- **Parameters:** VIN, verifier type, status, notes
- **Returns:** Transaction ID
- **When Called:** When verifier approves/rejects verification

### 6.3 Blockchain Data Structure

```json
{
  "vin": "ABC1234567890XYZ",
  "plateNumber": "ABC-1234",
  "make": "Toyota",
  "model": "Camry",
  "year": 2023,
  "color": "White",
  "engineNumber": "ENG123456",
  "chassisNumber": "CHS123456",
  "vehicleType": "PASSENGER",
  "fuelType": "GASOLINE",
  "transmission": "AUTOMATIC",
  "engineDisplacement": "2.5L",
  "owner": {
    "id": "user-uuid",
    "email": "owner@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "status": "REGISTERED",
  "verificationStatus": {
    "insurance": "PENDING",
    "emission": "PENDING",
    "admin": "PENDING"
  },
  "documents": {
    "registrationCert": {
      "cid": "QmXXX...",
      "filename": "registration.pdf",
      "documentType": "registration_cert"
    },
    "insuranceCert": {
      "cid": "QmYYY...",
      "filename": "insurance.pdf",
      "documentType": "insurance_cert"
    },
    "emissionCert": {
      "cid": "QmZZZ...",
      "filename": "emission.pdf",
      "documentType": "emission_cert"
    },
    "ownerId": {
      "cid": "QmAAA...",
      "filename": "owner_id.pdf",
      "documentType": "owner_id"
    }
  },
  "registrationDate": "2025-01-15T10:30:00Z",
  "lastUpdated": "2025-01-15T10:30:00Z",
  "history": [
    {
      "action": "REGISTERED",
      "timestamp": "2025-01-15T10:30:00Z",
      "performedBy": "LTOMSP",
      "details": "Vehicle registration submitted",
      "transactionId": "tx-abc123..."
    }
  ],
  "blockchainTxId": "tx-abc123...",
  "createdBy": "LTOMSP",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### 6.4 Blockchain Transaction Lifecycle

1. **Transaction Submission:**
   - Chaincode function invoked
   - Transaction ID generated by Fabric
   - Transaction sent to orderer

2. **Transaction Validation:**
   - Orderer validates transaction
   - Transaction added to block

3. **Block Commit:**
   - Block committed to ledger
   - Transaction status: `committed`
   - World state updated

4. **Status Polling:**
   - Application polls Fabric for transaction status
   - Updates database when committed

---

## 7. Blockchain History Tracing

### 7.1 History Sources

The system maintains history in two places:

1. **PostgreSQL Database** (`vehicle_history` table)
   - Application-level history
   - Includes all actions (registration, transfers, verifications)
   - Faster queries, searchable

2. **Hyperledger Fabric Ledger**
   - Immutable blockchain history
   - Tamper-proof audit trail
   - Complete transaction history

### 7.2 History Endpoints

#### **Get Vehicle History (Database)**
- **Endpoint:** `GET /api/vehicles/:vin/history`
- **Returns:** Array of history records from database
- **Fields:**
  - `action` - Action type (REGISTERED, TRANSFER_REQUESTED, etc.)
  - `description` - Human-readable description
  - `performedBy` - User ID who performed action
  - `performedAt` - Timestamp
  - `transactionId` - Blockchain transaction ID (if applicable)
  - `metadata` - Additional data (JSON)

#### **Get Blockchain Transactions**
- **Endpoint:** `GET /api/ledger/transactions`
- **Required Role:** `admin`
- **Returns:** All transactions from Fabric ledger
- **Source:** Hyperledger Fabric (real-time)

#### **Get Transactions by VIN**
- **Endpoint:** `GET /api/ledger/transactions/vin/:vin`
- **Returns:** All blockchain transactions for specific VIN
- **Source:** Hyperledger Fabric

#### **Get Transactions by Owner**
- **Endpoint:** `GET /api/ledger/transactions/owner/:ownerEmail`
- **Returns:** All blockchain transactions for specific owner
- **Source:** Hyperledger Fabric

#### **Get Transaction by ID**
- **Endpoint:** `GET /api/ledger/transactions/id/:transactionId`
- **Returns:** Specific transaction details
- **Source:** Hyperledger Fabric

#### **Get All Blocks**
- **Endpoint:** `GET /api/ledger/blocks`
- **Required Role:** `admin`
- **Returns:** All blocks from Fabric ledger
- **Source:** Hyperledger Fabric

#### **Get Block by Number**
- **Endpoint:** `GET /api/ledger/blocks/:blockNumber`
- **Required Role:** `admin`
- **Returns:** Specific block details
- **Source:** Hyperledger Fabric

### 7.3 History Action Types

| Action | Description | Blockchain Recorded |
|--------|-------------|---------------------|
| `REGISTERED` | Vehicle registration submitted | ❌ No (before blockchain) |
| `BLOCKCHAIN_REGISTERED` | Vehicle registered on blockchain | ✅ Yes |
| `BLOCKCHAIN_PENDING` | Blockchain transaction pending | ✅ Yes (pending) |
| `TRANSFER_REQUESTED` | Transfer request created | ❌ No |
| `OWNERSHIP_TRANSFERRED` | Ownership transferred | ✅ Yes |
| `HPG_CLEARANCE_REQUESTED` | HPG clearance requested | ❌ No |
| `INSURANCE_VERIFICATION_REQUESTED` | Insurance verification requested | ❌ No |
| `EMISSION_VERIFICATION_REQUESTED` | Emission verification requested | ❌ No |
| `VERIFICATION_APPROVED` | Verification approved | ✅ Yes (if blockchain updated) |
| `VERIFICATION_REJECTED` | Verification rejected | ✅ Yes (if blockchain updated) |

### 7.4 Blockchain History Tracing Workflow

```
1. User queries vehicle history
   ↓
2. System retrieves database history (fast)
   ↓
3. For each history record with transactionId:
   ↓
4. Query Fabric ledger for transaction details
   ↓
5. Combine database history + blockchain details
   ↓
6. Return complete audit trail
```

---

## 8. Service Configuration

### 8.1 Environment Variables

#### **Blockchain Configuration**
```bash
BLOCKCHAIN_MODE=fabric          # Required: 'fabric' (no mocks)
FABRIC_AS_LOCALHOST=false       # false for Docker network names
```

#### **Storage Configuration**
```bash
STORAGE_MODE=ipfs               # Required: 'ipfs' (no fallbacks)
IPFS_API_URL=http://ipfs:5001   # IPFS API endpoint
IPFS_GATEWAY_URL=http://ipfs:8080  # IPFS Gateway endpoint
```

#### **Database Configuration**
```bash
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=${POSTGRES_PASSWORD:-lto_password}
```

#### **Application Configuration**
```bash
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://ltoblockchain.duckdns.org
JWT_SECRET=your-secret-key
```

### 8.2 Docker Compose Services

#### **lto-app** (Main Application)
- **Image:** Built from `Dockerfile.production`
- **Ports:** 3001 (internal, proxied by Nginx)
- **Environment:** All configuration variables
- **Dependencies:** postgres, ipfs, orderer, peer

#### **postgres** (Database)
- **Image:** postgres:15-alpine
- **Ports:** 5432 (internal)
- **Volumes:** postgres-data
- **Health Check:** Yes

#### **ipfs** (Document Storage)
- **Image:** ipfs/kubo:latest
- **Ports:** 5001 (API), 8080 (Gateway)
- **Volumes:** ipfs-data
- **Health Check:** Yes

#### **orderer.lto.gov.ph** (Fabric Orderer)
- **Image:** hyperledger/fabric-orderer:2.5
- **Ports:** 7050 (internal)
- **Volumes:** crypto-config, channel-artifacts

#### **peer0.lto.gov.ph** (Fabric Peer)
- **Image:** hyperledger/fabric-peer:2.5
- **Ports:** 7051 (internal)
- **Volumes:** crypto-config, channel-artifacts, ledger-data

#### **couchdb** (Fabric State Database)
- **Image:** couchdb:3.3
- **Ports:** 5984 (internal)
- **Volumes:** couchdb-data

#### **nginx** (Reverse Proxy)
- **Image:** nginx:alpine
- **Ports:** 80, 443
- **Volumes:** nginx config, SSL certificates

### 8.3 Service Health Checks

All services have health checks configured:
- **lto-app:** HTTP GET `/api/health`
- **postgres:** `pg_isready`
- **ipfs:** API version check
- **orderer/peer:** Container status

---

## 9. API Endpoints Reference

### 9.1 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/logout` | Logout user | Yes |
| GET | `/api/auth/me` | Get current user | Yes |

### 9.2 Vehicle Endpoints

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| POST | `/api/vehicles/register` | Register vehicle | Optional | None |
| GET | `/api/vehicles` | Get all vehicles | Yes | admin |
| GET | `/api/vehicles/:vin` | Get vehicle by VIN | Yes | None |
| GET | `/api/vehicles/:vin/history` | Get vehicle history | Yes | None |
| PUT | `/api/vehicles/:vin/transfer` | Transfer ownership (legacy) | Yes | vehicle_owner, admin |

### 9.3 Document Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/documents/upload` | Upload document | Yes |
| GET | `/api/documents/:documentId` | Get document | Yes |
| GET | `/api/documents/vehicle/:vehicleId` | Get vehicle documents | Yes |

### 9.4 Transfer Endpoints

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| POST | `/api/vehicles/transfer/requests` | Create transfer request | Yes | vehicle_owner, admin |
| GET | `/api/vehicles/transfer/requests` | Get transfer requests | Yes | None |
| POST | `/api/vehicles/transfer/requests/:id/approve` | Approve transfer | Yes | admin |
| POST | `/api/vehicles/transfer/requests/:id/reject` | Reject transfer | Yes | admin |

### 9.5 LTO Admin Endpoints

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| POST | `/api/lto/send-to-hpg` | Send HPG clearance request | Yes | admin |
| POST | `/api/lto/send-to-insurance` | Send insurance request | Yes | admin |
| POST | `/api/lto/send-to-emission` | Send emission request | Yes | admin |
| POST | `/api/lto/approve-clearance` | Approve final clearance | Yes | admin |

### 9.6 Blockchain/Ledger Endpoints

| Method | Endpoint | Description | Auth Required | Role Required |
|--------|----------|-------------|---------------|---------------|
| GET | `/api/ledger/transactions` | Get all transactions | Yes | admin |
| GET | `/api/ledger/transactions/vin/:vin` | Get transactions by VIN | Yes | None |
| GET | `/api/ledger/transactions/owner/:email` | Get transactions by owner | Yes | None |
| GET | `/api/ledger/blocks` | Get all blocks | Yes | admin |
| GET | `/api/ledger/blocks/:blockNumber` | Get block by number | Yes | admin |

---

## 10. Database Schema

### 10.1 Core Tables

#### **users**
- `id` (UUID, PK)
- `email` (VARCHAR(255), UNIQUE)
- `password_hash` (VARCHAR(255))
- `first_name`, `last_name` (VARCHAR(100))
- `role` (ENUM: admin, staff, insurance_verifier, emission_verifier, vehicle_owner)
- `created_at`, `updated_at` (TIMESTAMP)

#### **vehicles**
- `id` (UUID, PK)
- `vin` (VARCHAR(17), UNIQUE)
- `plate_number` (VARCHAR(20), UNIQUE)
- `make`, `model` (VARCHAR(50))
- `year` (INTEGER)
- `color` (VARCHAR(30))
- `engine_number`, `chassis_number` (VARCHAR(50))
- `vehicle_type` (VARCHAR(30))
- `fuel_type` (VARCHAR(20))
- `transmission` (VARCHAR(20))
- `engine_displacement` (VARCHAR(20))
- `owner_id` (UUID, FK → users.id)
- `status` (ENUM: SUBMITTED, PENDING_BLOCKCHAIN, REGISTERED, APPROVED, REJECTED, SUSPENDED)
- `registration_date`, `last_updated` (TIMESTAMP)

#### **documents**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id, NULLABLE)
- `document_type` (ENUM: registration_cert, insurance_cert, emission_cert, owner_id)
- `filename`, `original_name` (VARCHAR(255))
- `file_path` (TEXT)
- `file_size` (BIGINT)
- `mime_type` (VARCHAR(100))
- `file_hash` (VARCHAR(255))
- `ipfs_cid` (VARCHAR(255), UNIQUE) **← IPFS Content Identifier**
- `uploaded_by` (UUID, FK → users.id)
- `uploaded_at` (TIMESTAMP)

#### **vehicle_history**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id)
- `action` (VARCHAR(50))
- `description` (TEXT)
- `performed_by` (UUID, FK → users.id)
- `performed_at` (TIMESTAMP)
- `transaction_id` (VARCHAR(255)) **← Blockchain TX ID**
- `metadata` (JSONB)

#### **vehicle_verifications**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id)
- `verification_type` (VARCHAR(20)): 'insurance', 'emission', 'admin'
- `status` (ENUM: PENDING, APPROVED, REJECTED)
- `verified_by` (UUID, FK → users.id)
- `verified_at` (TIMESTAMP)
- `notes` (TEXT)

#### **clearance_requests**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id)
- `request_type` (VARCHAR(20)): 'hpg', 'insurance', 'emission'
- `status` (VARCHAR(20)): 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'
- `requested_by` (UUID, FK → users.id)
- `assigned_to` (UUID, FK → users.id)
- `purpose` (TEXT)
- `notes` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

#### **transfer_requests**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id)
- `seller_id` (UUID, FK → users.id)
- `buyer_id` (UUID, FK → users.id, NULLABLE)
- `buyer_info` (JSONB) - Buyer information if not registered
- `status` (VARCHAR(20)): 'PENDING', 'APPROVED', 'REJECTED'
- `created_at`, `updated_at` (TIMESTAMP)

---

## 11. Troubleshooting

### 11.1 Document Upload Issues

#### **Problem:** Documents not linking to vehicles

**Symptoms:**
- Vehicle registered successfully
- Documents uploaded but not linked
- Documents show `vehicle_id = NULL` in database

**Causes:**
1. Document upload failed (503 - IPFS unavailable)
2. Document IDs not included in registration request
3. Document CIDs don't match

**Solutions:**
1. **Ensure IPFS is running:**
   ```bash
   docker compose -f docker-compose.unified.yml ps ipfs
   docker compose -f docker-compose.unified.yml restart ipfs
   ```

2. **Verify document IDs in registration:**
   - Check frontend sends document IDs in registration request
   - Verify document records exist in database before registration

3. **Check document CIDs:**
   ```sql
   SELECT id, filename, ipfs_cid, vehicle_id FROM documents WHERE vehicle_id IS NULL;
   ```

4. **Manually link documents:**
   ```sql
   UPDATE documents SET vehicle_id = '<vehicle_id>' WHERE id = '<document_id>';
   ```

### 11.2 Blockchain Registration Issues

#### **Problem:** Blockchain registration fails

**Symptoms:**
- Vehicle created in database
- Blockchain registration error
- Vehicle deleted (rollback)

**Causes:**
1. Fabric network unavailable
2. Chaincode not installed/instantiated
3. Wallet not configured
4. Network configuration incorrect

**Solutions:**
1. **Check Fabric services:**
   ```bash
   docker compose -f docker-compose.unified.yml ps orderer peer
   ```

2. **Verify chaincode:**
   ```bash
   docker exec cli peer chaincode list --installed
   docker exec cli peer chaincode list --instantiated -C ltochannel
   ```

3. **Check wallet:**
   ```bash
   ls -la wallet/
   # Should contain: admin.id
   ```

4. **Verify network config:**
   ```bash
   cat network-config.json
   # Check URLs point to correct service names
   ```

### 11.3 IPFS Issues

#### **Problem:** IPFS unavailable (503 errors)

**Symptoms:**
- Document upload returns 503
- Error: "IPFS storage is required but IPFS service is unavailable"

**Solutions:**
1. **Check IPFS container:**
   ```bash
   docker compose -f docker-compose.unified.yml ps ipfs
   docker compose -f docker-compose.unified.yml logs ipfs
   ```

2. **Restart IPFS:**
   ```bash
   docker compose -f docker-compose.unified.yml restart ipfs
   ```

3. **Check IPFS API:**
   ```bash
   docker exec ipfs curl -X POST http://localhost:5001/api/v0/version
   ```

4. **Fix IPFS volume (if version mismatch):**
   ```bash
   bash scripts/fix-ipfs-volume.sh
   ```

### 11.4 Database Issues

#### **Problem:** Transaction ID too long

**Symptoms:**
- Error: "value too long for type character varying(100)"
- History records fail to create

**Solution:**
```bash
# Run schema fix
bash scripts/fix-database-schema.sh

# Or manually:
docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE vehicle_history ALTER COLUMN transaction_id TYPE VARCHAR(255);"
```

---

## 12. Summary

### 12.1 Key Points

1. ✅ **ALL vehicle registrations are recorded on blockchain IMMEDIATELY** (even if pending approval)
2. ✅ **IPFS is REQUIRED** - No fallbacks, documents must be stored on IPFS
3. ✅ **Real services only** - No mocks, production-ready
4. ✅ **Complete audit trail** - Database history + Blockchain ledger
5. ✅ **Document linking** - Three methods ensure documents are linked to vehicles

### 12.2 Registration Flow Summary

```
1. User uploads documents → IPFS (CID generated)
2. User submits registration → Vehicle created in DB
3. Documents linked to vehicle → CIDs collected
4. Blockchain registration → IMMEDIATE (status: PENDING_BLOCKCHAIN)
5. Transaction committed → Status: SUBMITTED (awaiting admin)
6. Admin approves → Status: APPROVED (fully registered)
```

### 12.3 Blockchain Recording Timeline

| Event | Blockchain Recorded? | When |
|-------|---------------------|------|
| Vehicle Registration Submitted | ✅ **YES** | Immediately upon submission |
| Admin Approval | ✅ **YES** (if status updated) | When admin approves |
| Transfer Request Created | ❌ No | Not recorded |
| Transfer Approved | ✅ **YES** | When admin approves transfer |
| Verification Requested | ❌ No | Not recorded |
| Verification Approved | ✅ **YES** (if chaincode updated) | When verifier approves |

---

**End of Documentation**

