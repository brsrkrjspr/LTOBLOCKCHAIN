# Registration & Transfer of Ownership Workflow Trace

**Date:** 2026-01-24  
**Purpose:** Complete frontend-to-backend trace of registration and transfer workflows

---

## Table of Contents

1. [Vehicle Registration Workflow](#1-vehicle-registration-workflow)
2. [Transfer of Ownership Workflow](#2-transfer-of-ownership-workflow)
3. [Key Differences & Common Patterns](#3-key-differences--common-patterns)

---

## 1. Vehicle Registration Workflow

### Frontend Flow

#### **Entry Point:** `registration-wizard.html`
- **File:** `registration-wizard.html`
- **JavaScript:** `js/registration-wizard.js`
- **User Action:** User fills out multi-step wizard form

#### **Step 1: Form Data Collection**
**Function:** `collectApplicationData()` (Line 1776-1857)

**Location:** `js/registration-wizard.js`

**Data Collected:**
```javascript
{
    id: 'APP-YYYY-XXXXXX',  // Generated application ID
    vehicle: {
        make, model, year, color,
        engineNumber, chassisNumber,
        vin, plateNumber,
        vehicleType, carType,
        vehicleCategory,  // PNS Code (L1-L5, M1-M3, N1-N3, O1-O4)
        passengerCapacity,
        grossVehicleWeight,
        netWeight,
        classification  // Private, For Hire, Government, Exempt
    },
    owner: {
        firstName, lastName, email,
        phone, address,
        idType, idNumber,
        dateOfBirth, nationality
    },
    status: 'SUBMITTED',
    verificationStatus: {
        insurance: 'PENDING',
        hpg: 'PENDING'
    }
}
```

#### **Step 2: Document Upload**
**Function:** `uploadDocuments(signal)` (Line 1605-1724)

**Location:** `js/registration-wizard.js`

**Process:**
1. Finds all file inputs in document upload container
2. Maps frontend document types to logical types using `data-document-type` attribute
3. Uploads documents in parallel via `DocumentUploadUtils.uploadDocument()`
4. Each document uploaded to `/api/documents/upload` endpoint
5. Returns document IDs and IPFS CIDs

**Document Types Uploaded:**
- `certificateOfStockReport` → CSR Certificate
- `insuranceCertificate` → Insurance Certificate
- `pnpHpgClearance` → HPG Clearance
- `salesInvoice` → Sales Invoice
- `ownerValidId` → Owner ID
- `affidavitOfAttachment` → (Tricycle only)

**Error Handling:**
- If upload fails, registration continues with empty documents object
- User sees warning but can proceed

#### **Step 3: Form Submission**
**Function:** `submitApplication()` (Line 1296-1493)

**Location:** `js/registration-wizard.js`

**Process:**
1. **Validation:**
   - Checks terms agreement checkbox
   - Validates OCR conflicts (if any)
   - Shows confirmation dialog
   - Validates required fields (VIN, plate, make, model)

2. **Document Upload:**
   - Calls `uploadDocuments(signal)`
   - Attaches document IDs to `applicationData.documents`

3. **API Submission:**
   ```javascript
   const result = await apiClient.post('/api/vehicles/register', applicationData);
   ```

4. **Success Handling:**
   - Clears form persistence
   - Shows success message
   - Redirects to dashboard or stays on page

---

### Backend Flow

#### **Endpoint:** `POST /api/vehicles/register`
**File:** `backend/routes/vehicles.js`  
**Function:** Router handler (Line 935-1655)

#### **Step 1: Request Validation**
**Lines:** 939-961

**Validates:**
- Required fields: `vehicle`, `owner`
- Vehicle fields: `vin`, `plateNumber`, `make`, `model`
- Owner fields: `firstName`, `lastName`, `email`

#### **Step 2: Duplicate Check**
**Lines:** 963-1002

**Checks:**
- Vehicle by VIN (blocks if status: SUBMITTED, REGISTERED, APPROVED)
- Vehicle by plate number (same blocking logic)
- Allows re-registration if vehicle is REJECTED/SUSPENDED/SCRAPPED/FOR_TRANSFER

#### **Step 3: Owner Account Resolution**
**Lines:** 1004-1076

**Process:**
1. **If user is authenticated:**
   - Uses logged-in user account
   - Verifies email matches (logs warning if mismatch)
   - Updates user info if provided

2. **If not authenticated:**
   - Searches for user by email
   - If not found, creates new user account with:
     - Role: `vehicle_owner`
     - Temporary password: `temp_password_${timestamp}`
     - Organization: `Individual`

#### **Step 4: Vehicle Data Validation**
**Lines:** 1078-1142

**Validates:**
- Vehicle category (PNS Code): L1-L5, M1-M3, N1-N3, O1-O4
- Passenger capacity: positive integer
- Gross vehicle weight: positive number
- Net weight: positive number, must be < GVW
- Classification: Private, For Hire, Government, Exempt

#### **Step 5: Vehicle Creation**
**Lines:** 1144-1173

**Creates vehicle record:**
```javascript
const newVehicle = await db.createVehicle({
    vin, plateNumber, make, model, year, color,
    engineNumber, chassisNumber,
    vehicleType, vehicleCategory,
    passengerCapacity, grossVehicleWeight, netWeight,
    classification,
    ownerId: ownerUser.id,
    status: 'SUBMITTED',
    originType: 'NEW_REG'
});
```

#### **Step 6: Vehicle History**
**Lines:** 1175-1189

**Adds history entry:**
- Action: `REGISTERED`
- Description: "Vehicle registration submitted"
- Metadata: Safe registration metadata (sanitized)

#### **Step 7: Document Linking**
**Lines:** 1191-1366

**Process:**
1. Iterates through `registrationData.documents` object
2. Maps frontend keys to database types using `documentTypes` config:
   ```javascript
   const logicalType = docTypes.mapLegacyType(frontendKey);
   const dbDocType = docTypes.mapToDbType(logicalType);
   ```
3. Finds document by ID or filename/CID
4. Links document to vehicle:
   - Sets `vehicle_id` = new vehicle ID
   - Sets `document_type` = mapped DB type
   - Sets `uploaded_by` = owner user ID
5. Collects IPFS CIDs for blockchain registration

**Document Type Mapping:**
- `certificateOfStockReport` → `csr_cert`
- `insuranceCertificate` → `insurance_cert`
- `pnpHpgClearance` → `hpg_clearance`
- `salesInvoice` → `sales_invoice`
- `ownerValidId` → `owner_id`

#### **Step 8: Auto-Send Clearance Requests**
**Lines:** 1551-1569

**Calls:** `clearanceService.autoSendClearanceRequests()`

**Process:**
1. **HPG Request:**
   - Checks if HPG documents exist (owner_id OR hpg_clearance)
   - Creates clearance request if documents found
   - Performs Phase 1 automation (OCR extraction, database checks)
   - **Does NOT trigger full auto-verification** (manual only)

2. **Insurance Request:**
   - Checks if insurance document exists
   - Creates clearance request if found
   - **Triggers auto-verification automatically**
   - If auto-approved, sets clearance request status to `APPROVED`

**Result:**
```javascript
{
    hpg: { sent: true/false, requestId, autoVerification: null },
    insurance: { sent: true/false, requestId, autoVerification: {...} }
}
```

#### **Step 9: Response**
**Lines:** 1593-1603

**Returns:**
```json
{
    "success": true,
    "message": "Vehicle registration submitted successfully",
    "vehicle": { /* formatted vehicle data */ },
    "blockchainStatus": "PENDING",
    "clearanceRequests": {
        "hpg": true/false,
        "insurance": true/false
    },
    "autoVerification": {
        "insurance": { /* if auto-verified */ }
    }
}
```

---

## 2. Transfer of Ownership Workflow

### Frontend Flow

#### **Entry Point:** `transfer-ownership.html`
- **File:** `transfer-ownership.html`
- **JavaScript:** Inline script in HTML (Line 1682-2553)
- **User Action:** Seller initiates transfer request

#### **Step 1: Vehicle Selection**
**Function:** Vehicle selection handler

**Process:**
1. Loads seller's vehicles via API
2. Seller selects vehicle to transfer
3. Stores `vehicleId` in `transferData.vehicleId`

#### **Step 2: Buyer Information**
**Function:** Buyer info collection

**Data Collected:**
```javascript
transferData.buyer = {
    email: buyerEmail,  // Required
    name: buyerName,    // Optional
    phone: buyerPhone,  // Optional
    address: buyerAddress  // Optional
}
```

#### **Step 3: Seller Document Upload**
**Function:** `handleTransferUpload(input, docType)` (Line 2109-2220)

**Documents Uploaded:**
- `deedOfSale` → Deed of Sale (Required)
- `sellerId` → Seller Valid ID (Required)
- `orCr` → OR/CR (Optional - can be pulled from vehicle)

**Process:**
1. Maps transfer doc types to logical types:
   ```javascript
   const docTypeMap = {
       'deedOfSale': DocumentUploadUtils.DOCUMENT_TYPES.DEED_OF_SALE,
       'sellerId': DocumentUploadUtils.DOCUMENT_TYPES.SELLER_ID
   };
   ```
2. Uploads via `DocumentUploadUtils.uploadDocument()`
3. Stores document IDs in `transferData.documents[docType]`

#### **Step 4: Transfer Request Submission**
**Function:** `submitTransfer()` (Line 2417-2498)

**Process:**
1. **Validation:**
   - Checks `vehicleId` exists
   - Checks `buyer.email` exists
   - Validates required documents: `deedOfSale`, `sellerId`

2. **Request Data Preparation:**
   ```javascript
   const requestData = {
       vehicleId: transferData.vehicleId,
       buyerEmail: transferData.buyer.email,
       documents: {
           deedOfSale: transferData.documents.deedOfSale?.id,
           sellerId: transferData.documents.sellerId?.id,
           orCr: transferData.documents.orCr?.id  // Optional
       }
   };
   ```

3. **API Submission:**
   ```javascript
   const response = await window.apiClient.post('/api/vehicles/transfer/requests', requestData);
   ```

4. **Success Handling:**
   - Shows confirmation message
   - Displays request ID
   - Option to return to dashboard

---

### Backend Flow - Transfer Request Creation

#### **Endpoint:** `POST /api/vehicles/transfer/requests`
**File:** `backend/routes/transfer.js`  
**Function:** Router handler (Line 1530-1944)

#### **Step 1: Request Validation**
**Lines:** 1544-1557

**Validates:**
- `vehicleId` required
- `buyerEmail` OR `buyerId` required

#### **Step 2: Vehicle & Seller Verification**
**Lines:** 1559-1600

**Process:**
1. Gets vehicle by ID
2. Verifies vehicle exists and is not already transferred
3. Gets seller (current owner) from vehicle
4. Verifies seller is authenticated user

#### **Step 3: Buyer Account Resolution**
**Lines:** 1602-1650

**Process:**
1. Searches for buyer by email
2. If not found, creates new user account:
   - Role: `vehicle_owner`
   - Temporary password: `temp_password_${timestamp}`
   - Email: buyer email
   - Name: from `buyerInfo` or defaults

#### **Step 4: Transfer Request Creation**
**Lines:** 1652-1720

**Creates transfer request:**
```javascript
const transferRequest = await db.createTransferRequest({
    vehicleId,
    sellerId: seller.id,
    buyerId: buyerUser.id,
    buyerInfo: {
        email: buyerEmail,
        name: buyerName,
        phone: buyerPhone,
        address: buyerAddress
    },
    status: TRANSFER_STATUS.PENDING,
    expiresAt: computeExpiresAt(3),  // 3 days
    metadata: {
        vehicleVin: vehicle.vin,
        vehiclePlate: vehicle.plate_number,
        // ... vehicle details
    }
});
```

#### **Step 5: Document Linking**
**Lines:** 1722-1790

**Calls:** `linkTransferDocuments()`

**Process:**
1. Maps frontend document keys to transfer roles:
   ```javascript
   const documentRoleMap = {
       'deedOfSale': 'DEED_OF_SALE',
       'sellerId': 'SELLER_ID',
       'buyerId': 'BUYER_ID',
       'buyerTin': 'BUYER_TIN',
       'buyerCtpl': 'BUYER_CTPL',
       'buyerMvir': 'BUYER_MVIR',
       'buyerHpgClearance': 'BUYER_HPG_CLEARANCE'
   };
   ```
2. Links documents to `transfer_documents` table with roles
3. Updates document records with `uploaded_by` = seller ID

#### **Step 6: Email Invitation**
**Lines:** 1792-1810

**Process:**
1. Generates JWT invite token:
   ```javascript
   const inviteToken = jwt.sign({
       transferRequestId: transferRequest.id,
       buyerEmail: buyerEmail,
       expiresAt: expiresAt
   }, INVITE_TOKEN_SECRET);
   ```
2. Sends email via `sendTransferInviteEmail()`
3. Email includes:
   - Vehicle details
   - Confirmation link with token
   - 3-day deadline reminder

#### **Step 7: Blockchain Registration**
**Lines:** 1812-1830

**Process:**
1. Records transfer request on blockchain
2. Stores blockchain transaction ID in metadata
3. Creates blockchain history entry

#### **Step 8: Response**
**Lines:** 1832-1842

**Returns:**
```json
{
    "success": true,
    "message": "Transfer request created successfully",
    "transferRequest": { /* transfer request data */ },
    "buyerEmail": buyerEmail,
    "expiresAt": expiresAt
}
```

---

### Backend Flow - Buyer Acceptance

#### **Endpoint:** `POST /api/vehicles/transfer/requests/:id/accept`
**File:** `backend/routes/transfer.js`  
**Function:** Router handler (Line 1946-2245)

#### **Step 1: Request Validation**
**Lines:** 1950-1964

**Validates:**
- Transfer request exists
- Status is `PENDING` or `AWAITING_BUYER_DOCS`
- Current user is designated buyer (by ID or email)

#### **Step 2: Buyer Document Upload**
**Lines:** 1976-2110

**Process:**
1. Extracts documents from request body:
   ```javascript
   const {
       documents = {},  // { buyerId, buyerTin, buyerCtpl, buyerMvir, buyerHpgClearance }
       buyerInfo = {}
   } = req.body;
   ```
2. Links buyer documents via `linkTransferDocuments()`
3. Updates buyer info if provided

#### **Step 3: Status Update**
**Lines:** 2112-2120

**Updates transfer request:**
- Status: `UNDER_REVIEW` (if documents provided)
- Status: `AWAITING_BUYER_DOCS` (if documents missing)

#### **Step 4: Auto-Forward to Organizations**
**Lines:** 2122-2150

**If auto-forward enabled:**
1. **HPG Forward:**
   - Checks if buyer HPG clearance document exists
   - Creates HPG clearance request
   - Triggers auto-verification
   - Links clearance request to transfer

2. **Insurance Forward:**
   - Checks if buyer CTPL document exists
   - Creates insurance clearance request
   - Triggers auto-verification
   - Links clearance request to transfer

#### **Step 5: Email Notifications**
**Lines:** 2152-2170

**Sends:**
- Email to seller: "Buyer accepted transfer request"
- Email to buyer: "Transfer request accepted, awaiting review"

#### **Step 6: Blockchain Update**
**Lines:** 2172-2185

**Process:**
1. Records buyer acceptance on blockchain
2. Updates blockchain transaction ID
3. Creates blockchain history entry

#### **Step 7: Response**
**Lines:** 2187-2205

**Returns:**
```json
{
    "success": true,
    "message": "Transfer request accepted",
    "transferRequest": { /* updated transfer request */ },
    "clearanceRequests": {
        "hpg": { /* if forwarded */ },
        "insurance": { /* if forwarded */ }
    }
}
```

---

### Backend Flow - Admin Approval

#### **Endpoint:** `POST /api/vehicles/transfer/requests/:id/approve`
**File:** `backend/routes/transfer.js`  
**Function:** Router handler (Line 2772-3301)

#### **Step 1: Authorization Check**
**Lines:** 2778-2798

**Validates:**
- User role: `admin`, `lto_admin`, or `lto_officer`
- Transfer value limits (if implemented)
- Transfer request exists and is approvable

#### **Step 2: Organization Approval Check**
**Lines:** 2800-2850

**Checks:**
- HPG approval status (if forwarded)
- Insurance approval status (if forwarded)
- MVIR verification status (if applicable)

**Requires:**
- All forwarded organizations must be `APPROVED`
- MVIR must be verified (if applicable)

#### **Step 3: Ownership Transfer**
**Lines:** 2852-2950

**Process:**
1. Updates vehicle owner:
   ```javascript
   await db.updateVehicle(vehicleId, {
       ownerId: buyerId,
       status: VEHICLE_STATUS.REGISTERED
   });
   ```
2. Generates new OR/CR numbers
3. Updates vehicle history

#### **Step 4: Certificate Generation**
**Lines:** 2952-3050

**Generates:**
- Transfer Certificate
- New OR/CR Certificate
- Compliance Documents

#### **Step 5: Blockchain Finalization**
**Lines:** 3052-3100

**Process:**
1. Records transfer completion on blockchain
2. Updates vehicle blockchain record
3. Creates final blockchain transaction

#### **Step 6: Status Update**
**Lines:** 3102-3120

**Updates:**
- Transfer request status: `COMPLETED`
- Vehicle status: `REGISTERED`
- All related clearance requests: `COMPLETED`

#### **Step 7: Email Notifications**
**Lines:** 3122-3150

**Sends:**
- Email to seller: "Transfer completed"
- Email to buyer: "Transfer completed, new certificates available"

#### **Step 8: Response**
**Lines:** 3152-3170

**Returns:**
```json
{
    "success": true,
    "message": "Transfer request approved and completed",
    "transferRequest": { /* completed transfer */ },
    "certificates": { /* generated certificates */ }
}
```

---

## 3. Key Differences & Common Patterns

### **Common Patterns**

1. **Document Upload:**
   - Both workflows use `DocumentUploadUtils.uploadDocument()`
   - Documents stored in `documents` table
   - IPFS CIDs collected for blockchain

2. **User Account Creation:**
   - Both workflows create user accounts if email not found
   - Temporary password: `temp_password_${timestamp}`
   - Role: `vehicle_owner`

3. **Document Type Mapping:**
   - Both use `documentTypes` config for type mapping
   - Frontend keys → Logical types → Database types

4. **Blockchain Integration:**
   - Both record transactions on blockchain
   - Store transaction IDs in metadata
   - Create blockchain history entries

5. **Email Notifications:**
   - Both send email notifications
   - Use `gmailApiService.sendMail()`

### **Key Differences**

| Aspect | Registration | Transfer |
|--------|-------------|----------|
| **Document Roles** | Single role per document | Multiple roles (seller/buyer) |
| **Document Linking** | Direct to vehicle | Via `transfer_documents` table |
| **Auto-Verification** | Insurance: Auto, HPG: Manual | Both: Auto (if forwarded) |
| **Status Flow** | SUBMITTED → APPROVED | PENDING → UNDER_REVIEW → COMPLETED |
| **Multi-Party** | Single user | Seller + Buyer |
| **Expiration** | None | 3-day deadline |
| **Organization Forwarding** | Automatic on registration | Manual or auto-forward |
| **Certificate Generation** | After approval | After completion |

### **Document Type Mapping**

**Registration:**
- Frontend key → Logical type → Database type
- Example: `insuranceCertificate` → `insuranceCert` → `insurance_cert`

**Transfer:**
- Frontend key → Transfer role → Database type
- Example: `deedOfSale` → `DEED_OF_SALE` → `deed_of_sale`
- Stored in `transfer_documents` table with role

---

## Summary

### **Registration Workflow:**
1. User fills form → Uploads documents → Submits
2. Backend creates vehicle → Links documents → Auto-sends clearance requests
3. Insurance auto-verified, HPG requires manual verification
4. Admin approves → Vehicle registered

### **Transfer Workflow:**
1. Seller initiates → Uploads seller documents → Submits
2. Buyer receives email → Accepts → Uploads buyer documents
3. Auto-forwarded to HPG/Insurance (if enabled)
4. Admin approves → Ownership transferred → Certificates generated

Both workflows follow similar patterns but differ in:
- Multi-party involvement (transfer)
- Document role management (transfer)
- Organization forwarding (transfer)
- Certificate generation timing
