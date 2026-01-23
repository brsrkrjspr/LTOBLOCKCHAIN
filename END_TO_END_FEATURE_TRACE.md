# TrustChain LTO - End-to-End Feature Trace
## Complete Frontend → Backend → Database Verification

**Purpose:** Trace every feature from UI element → API endpoint → Database schema with exact naming, IDs, and field mappings.

**Last Updated:** 2026-01-23
**Verification Status:** Transfer of Ownership flow re-verified end-to-end (UI → API → DB). Other sections: in progress.

---

## Table of Contents

1. [User Management & Authentication](#1-user-management--authentication)
2. [Vehicle Registration](#2-vehicle-registration)
3. [Document Management](#3-document-management)
4. [Transfer of Ownership](#4-transfer-of-ownership)
5. [Verification Workflows](#5-verification-workflows)
6. [Certificate Generation](#6-certificate-generation)
7. [Blockchain Integration](#7-blockchain-integration)
8. [Admin Features](#8-admin-features)
9. [External Organization Integration](#9-external-organization-integration)
10. [Public Features](#10-public-features)
11. [Notifications & Communication](#11-notifications--communication)
12. [System Monitoring & Health](#12-system-monitoring--health)

---

## 1. User Management & Authentication

### 1.1 User Registration

#### Frontend Elements
**File:** `login-signup.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Signup Tab Button | `signupTab` | Button | Switch to signup form |
| Signup Form | `signupForm` | Form | Registration form container |
| First Name Input | `firstName` | Input | First name field |
| Last Name Input | `lastName` | Input | Last name field |
| Email Input | `signupEmail` | Input | Email address |
| Phone Input | `phone` | Input | Phone number |
| Address Textarea | `address` | Textarea | Complete address |
| Password Input | `signupPassword` | Input | Password (min 12 chars) |
| Confirm Password Input | `confirmPassword` | Input | Password confirmation |
| Terms Checkbox | `terms` | Checkbox | Terms acceptance |
| Submit Button | `btn-primary btn-full` | Button | Create account |

**JavaScript Function:** `validateSignup(event)` in `js/login-signup.js`

#### Backend Endpoint
**File:** `backend/routes/auth.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/register` | `router.post('/register', signupLimiter, async (req, res) => {...})` | No (Rate Limited) |

**Request Body:**
```javascript
{
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  organization?: string,
  phone?: string,
  address?: string
}
```

**Response:**
```javascript
{
  success: true,
  message: string,
  user: {
    id: uuid,
    email: string,
    firstName: string,
    lastName: string,
    role: 'vehicle_owner',
    organization: string,
    phone: string,
    address: string,
    emailVerified: boolean,
    createdAt: timestamp
  },
  token: string (JWT)
}
```

#### Database Schema
**Table:** `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | User identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Normalized lowercase |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash (12 rounds) |
| `first_name` | VARCHAR(100) | NOT NULL | From `firstName` |
| `last_name` | VARCHAR(100) | NOT NULL | From `lastName` |
| `role` | user_role ENUM | NOT NULL, DEFAULT 'vehicle_owner' | Hard-coded in backend |
| `organization` | VARCHAR(255) | NULL | From `organization` or 'Individual' |
| `phone` | VARCHAR(20) | NULL | From `phone` |
| `address` | VARCHAR(500) | NULL | From `address` |
| `is_active` | BOOLEAN | DEFAULT true | Account status |
| `email_verified` | BOOLEAN | DEFAULT false | Email verification status |
| `two_factor_enabled` | BOOLEAN | DEFAULT false | 2FA status |
| `last_login` | TIMESTAMP | NULL | Last login timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update (trigger) |

**Indexes:**
- `idx_users_email` ON `email`
- `idx_users_role` ON `role`
- `idx_users_active` ON `is_active`

**Triggers:**
- `update_users_updated_at` BEFORE UPDATE → Updates `updated_at`

**ENUM:** `user_role`
```sql
CREATE TYPE user_role AS ENUM (
    'admin',
    'staff',
    'insurance_verifier',
    'emission_verifier',  -- ⚠️ LEGACY: Role exists but emission verification workflow removed
    'vehicle_owner',
    'hpg_admin',
    'lto_admin',
    'lto_officer',
    'lto_supervisor'
);
```

**Note:** `emission_verifier` role exists in database but emission verification workflow has been **REMOVED**. LTO no longer administers emission verification. Emission certificates must be issued by external emission testing centers and uploaded by vehicle owners.

**Verification Checklist:**
- [ ] Frontend form fields match backend request body
- [ ] Backend validates all required fields
- [ ] Backend normalizes email (lowercase)
- [ ] Backend hashes password with bcrypt (12 rounds)
- [ ] Backend hard-codes role as 'vehicle_owner'
- [ ] Database stores all fields correctly
- [ ] Database enforces UNIQUE constraint on email
- [ ] Database triggers update `updated_at` automatically

---

### 1.2 User Login

#### Frontend Elements
**File:** `login-signup.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Login Tab Button | `loginTab` | Button | Switch to login form |
| Login Form | `loginForm` | Form | Login form container |
| Email Input | `loginEmail` | Input | Email address |
| Password Input | `loginPassword` | Input | Password |
| Remember Me Checkbox | `remember` | Checkbox | Remember session |
| Forgot Password Link | `.forgot-password` | Link | Password reset |
| Login Submit Button | `btn-primary btn-full` | Button | Submit login |

**JavaScript Function:** `validateLogin()` in `js/login-signup.js`

#### Backend Endpoint
**File:** `backend/routes/auth.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/login` | `router.post('/login', async (req, res) => {...})` | No |

**Request Body:**
```javascript
{
  email: string,
  password: string
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Login successful',
  user: {
    id: uuid,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    organization: string,
    phone: string,
    isActive: boolean,
    emailVerified: boolean,
    createdAt: timestamp
  },
  token: string (JWT access token)
}
```

**Cookies Set:**
- `refreshToken` (HttpOnly, Secure in production)
- `XSRF-TOKEN` (Readable, for CSRF protection)

#### Database Operations
**Table:** `users`

**Update:**
- `last_login` = CURRENT_TIMESTAMP WHERE `id` = userId

**Table:** `refresh_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Token record ID |
| `user_id` | UUID | FOREIGN KEY → users.id | User reference |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE | Hashed refresh token |
| `expires_at` | TIMESTAMP | NOT NULL | Token expiration |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `revoked_at` | TIMESTAMP | NULL | Revocation time |

**Table:** `sessions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Session ID |
| `user_id` | UUID | FOREIGN KEY → users.id | User reference |
| `refresh_token_id` | UUID | FOREIGN KEY → refresh_tokens.id | Token reference |
| `ip_address` | VARCHAR(45) | NULL | Client IP |
| `user_agent` | TEXT | NULL | Browser user agent |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Session start |
| `last_activity` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last activity |
| `expires_at` | TIMESTAMP | NOT NULL | Session expiration |

**Verification Checklist:**
- [ ] Frontend sends email and password
- [ ] Backend normalizes email (lowercase)
- [ ] Backend verifies password with bcrypt.compare()
- [ ] Backend generates JWT access token
- [ ] Backend generates refresh token
- [ ] Backend stores refresh token in database
- [ ] Backend creates/updates session record
- [ ] Backend updates `users.last_login`
- [ ] Backend sets HttpOnly cookies
- [ ] Backend sets CSRF token cookie

---

### 1.3 Email Verification

#### Frontend Elements
**File:** `email-verification.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Verification Token Input | `token` | Input (Query Param) | Verification token |
| Verify Button | `.btn-primary` | Button | Verify email |

**JavaScript Function:** Handles token from URL query parameter

#### Backend Endpoint
**File:** `backend/routes/auth.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/verify-email` | `router.post('/verify-email', async (req, res) => {...})` | No |

**Request Body/Query:**
```javascript
{
  token: string // From URL query or body
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Email verified successfully!',
  user: {
    id: uuid,
    email: string,
    emailVerified: true
  }
}
```

#### Database Schema
**Table:** `email_verification_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Token record ID |
| `user_id` | UUID | FOREIGN KEY → users.id | User reference |
| `token` | VARCHAR(255) | NOT NULL, UNIQUE | Verification token |
| `expires_at` | TIMESTAMP | NOT NULL | Token expiration (24 hours) |
| `used_at` | TIMESTAMP | NULL | Verification timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |

**Update:**
- `users.email_verified` = true WHERE `id` = userId
- `email_verification_tokens.used_at` = CURRENT_TIMESTAMP WHERE `token` = token

**Service:** `backend/services/emailVerificationToken.js`
- `generateVerificationToken(userId)` - Creates token
- `verifyToken(token, userIp)` - Verifies and marks as used
- `resendToken(userId, email)` - Generates new token (rate limited)

**Verification Checklist:**
- [ ] Frontend extracts token from URL query parameter
- [ ] Backend validates token exists and not expired
- [ ] Backend checks token not already used
- [ ] Backend updates `users.email_verified` = true
- [ ] Backend marks token as used (`used_at`)
- [ ] Backend returns success response

---

### 1.4 Profile Management

#### Frontend Elements
**File:** `settings.html` or `owner-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Profile Form | `profileForm` | Form | Profile update form |
| First Name Input | `firstName` | Input | First name |
| Last Name Input | `lastName` | Input | Last name |
| Organization Input | `organization` | Input | Organization |
| Phone Input | `phone` | Input | Phone number |
| Address Textarea | `address` | Textarea | Address |
| Save Button | `.btn-primary` | Button | Save changes |

#### Backend Endpoint
**File:** `backend/routes/auth.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/auth/profile` | `router.get('/profile', authenticateToken, async (req, res) => {...})` | Yes (JWT) |
| PUT | `/api/auth/profile` | `router.put('/profile', authenticateToken, async (req, res) => {...})` | Yes (JWT) |

**Request Body (PUT):**
```javascript
{
  firstName?: string,
  lastName?: string,
  organization?: string,
  phone?: string,
  address?: string
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Profile updated successfully',
  user: {
    id: uuid,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    organization: string,
    phone: string,
    address: string
  }
}
```

#### Database Operations
**Table:** `users`

**Update Query:**
```sql
UPDATE users 
SET 
  first_name = $1,
  last_name = $2,
  organization = $3,
  phone = $4,
  address = $5,
  updated_at = CURRENT_TIMESTAMP
WHERE id = $6
```

**Verification Checklist:**
- [ ] Frontend loads current profile data on page load
- [ ] Frontend sends only changed fields
- [ ] Backend validates field lengths and formats
- [ ] Backend updates only provided fields
- [ ] Backend triggers `updated_at` automatically
- [ ] Backend returns updated user data

---

### 1.5 Change Password

#### Frontend Elements
**File:** `settings.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Current Password Input | `currentPassword` | Input | Current password |
| New Password Input | `newPassword` | Input | New password |
| Confirm New Password Input | `confirmNewPassword` | Input | Confirm new password |
| Change Password Button | `.btn-primary` | Button | Update password |

#### Backend Endpoint
**File:** `backend/routes/auth.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| PUT | `/api/auth/change-password` | `router.put('/change-password', authenticateToken, async (req, res) => {...})` | Yes (JWT) |

**Request Body:**
```javascript
{
  currentPassword: string,
  newPassword: string
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Password changed successfully'
}
```

#### Database Operations
**Table:** `users`

**Update Query:**
```sql
UPDATE users 
SET 
  password_hash = $1,  -- New bcrypt hash
  updated_at = CURRENT_TIMESTAMP
WHERE id = $2
```

**Verification Checklist:**
- [ ] Frontend validates new password matches confirmation
- [ ] Frontend validates new password meets requirements
- [ ] Backend verifies current password with bcrypt.compare()
- [ ] Backend hashes new password with bcrypt (12 rounds)
- [ ] Backend updates `password_hash` in database
- [ ] Backend triggers `updated_at` automatically

---

## 2. Vehicle Registration

### 2.1 Registration Wizard - Step 1: Car Type Selection

#### Frontend Elements
**File:** `registration-wizard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Car Type Select | `carType` | Select | Vehicle category selection |
| Next Step Button | `.btn-primary` | Button | Proceed to Step 2 |

**JavaScript Function:** `handleCarTypeChange(value)` in `js/registration-wizard.js`

**Options:**
- `BRAND_NEW_4W` - Brand New 4-Wheeled Vehicle
- `USED_4W` - Used 4-Wheeled Vehicle
- `MOTORCYCLE` - Motorcycle
- `TRICYCLE` - Tricycle

#### Backend Endpoint
**N/A** - Frontend-only step, determines document requirements

**Service:** `backend/services/documentRequirements.js` (if used)
- Loads document requirements based on `carType`

#### Database Schema
**Table:** `registration_document_requirements`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Requirement ID |
| `registration_type` | VARCHAR(50) | NOT NULL | 'NEW', 'TRANSFER', 'RENEWAL' |
| `vehicle_category` | VARCHAR(50) | DEFAULT 'ALL' | 'BRAND_NEW_4W', 'USED_4W', etc. |
| `document_type` | VARCHAR(50) | NOT NULL | Document type required |
| `is_required` | BOOLEAN | DEFAULT true | Required or optional |
| `display_name` | VARCHAR(100) | NOT NULL | User-friendly name |
| `description` | TEXT | NULL | Document description |
| `accepted_formats` | VARCHAR(100) | DEFAULT 'pdf,jpg,jpeg,png' | Allowed file types |
| `max_file_size_mb` | INTEGER | DEFAULT 10 | Maximum file size |
| `display_order` | INTEGER | DEFAULT 0 | Display order |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Update time (trigger) |

**Verification Checklist:**
- [ ] Frontend stores selected `carType` in variable
- [ ] Frontend loads document requirements based on `carType`
- [ ] Frontend displays correct document types for selected category
- [ ] Database has requirements for all vehicle categories

---

### 2.2 Registration Wizard - Step 2: Vehicle Information

#### Frontend Elements
**File:** `registration-wizard.html` (Step 2: Vehicle Information)

| Element | ID/Class | Type | HTML Line | Purpose |
|---------|----------|------|-----------|---------|
| Make Input | `id="make"` | Input | Line 1648 | Vehicle manufacturer |
| Model Input | `id="model"` | Input | Line 1653 | Vehicle model/series |
| Year Input | `id="year"` | Input (number) | Line 1661 | Year model (1990-2024) |
| Color Input | `id="color"` | Input | Line 1666 | Vehicle color |
| Engine Number Input | `id="engineNumber"` | Input | Line 1674 | Engine number |
| Chassis Number Input | `id="chassisNumber"` | Input | Line 1679 | Chassis/VIN number |
| VIN Input | `id="vin"` | Input | Line 1687 | Vehicle Identification Number (maxlength=17) |
| Vehicle Type Input | `id="vehicleType"` | Input | Line 1695 | Body type (SEDAN, SUV, etc.) |
| Fuel Type Select | `id="fuelType"` | Select | Line 1700 | Fuel type dropdown |
| Vehicle Category Select | `id="vehicleCategory"` | Select | Line 1716 | Vehicle category |
| Passenger Capacity Input | `id="passengerCapacity"` | Input (number) | Line 1748 | Number of passengers (1-100) |
| Classification Input | `id="classification"` | Input | Line 1753 | Private, For Hire, Government |
| Gross Vehicle Weight Input | `id="grossVehicleWeight"` | Input (number) | Line 1761 | GVW in kg (step=0.01) |
| Net Weight Input | `id="netWeight"` | Input (number) | Line 1766 | Net weight in kg (step=0.01) |
| Plate Number Input | `id="plateNumber"` | Input | Line 1774 | License plate number |
| Previous Button | `.btn-secondary` | Button | - | Go to Step 1 |
| Next Step Button | `.btn-primary` | Button | - | Proceed to Step 3 |

**JavaScript Function:** `nextStep()` in `js/registration-wizard.js`
- Validates all required fields before proceeding
- Stores form data in `localStorage` via `FormPersistence.autoSave()`

**JavaScript Function:** `nextStep()` in `js/registration-wizard.js`

**OCR Auto-Fill:** `autoFillFromOCRData(extractedData, documentType)`
- Maps OCR fields to HTML input IDs
- Handles field name differences (e.g., `series` → `model`, `yearModel` → `year`)

#### Backend Endpoint
**N/A** - Data stored in frontend until final submission

**Verification Checklist:**
- [ ] All input IDs match backend expected field names
- [ ] OCR auto-fill correctly maps backend fields to HTML IDs
- [ ] Form validation prevents invalid data
- [ ] VIN format validation (17 characters, no I/O/Q)

---

### 2.3 Registration Wizard - Step 3: Owner Information

#### Frontend Elements
**File:** `registration-wizard.html` (Step 3: Owner Information)

| Element | ID/Class | Type | HTML Line | Purpose |
|---------|----------|------|-----------|---------|
| First Name Input | `id="firstName"` | Input | Line 1796 | Owner first name |
| Last Name Input | `id="lastName"` | Input | Line 1801 | Owner last name |
| Email Input | `id="email"` | Input (email) | Line 1809 | Owner email (auto-filled from profile) |
| Phone Input | `id="phone"` | Input (tel) | Line 1814 | Owner phone number |
| Address Textarea | `id="address"` | Textarea | Line 1821 | Owner complete address (rows=2) |
| ID Type Select | `id="idType"` | Select | Line 1828 | Government ID type dropdown |
| ID Number Input | `id="idNumber"` | Input | Line 1843 | ID number |
| Previous Button | `.btn-secondary` | Button | - | Go to Step 2 |
| Next Step Button | `.btn-primary` | Button | - | Proceed to Step 4 |

**JavaScript Function:** `autoFillOwnerInfo()` in `js/registration-wizard.js`
- Called on page load and when navigating to Step 3
- Fetches user profile via `GET /api/auth/profile`
- Auto-fills: firstName, lastName, email, phone, address
- Can be overridden by OCR data from Owner ID documents

**JavaScript Function:** `autoFillOwnerInfo()` in `js/registration-wizard.js`
- Auto-fills from user profile (`GET /api/auth/profile`)
- Can be overridden by OCR data from Owner ID document

**OCR Auto-Fill:** Extracts `idType` and `idNumber` from Owner ID documents

#### Backend Endpoint
**GET** `/api/auth/profile` - Loads owner info from user account

**Verification Checklist:**
- [ ] Frontend auto-fills owner info from user profile
- [ ] OCR can override owner info if extracted from documents
- [ ] ID type and ID number are captured correctly

---

### 2.4 Registration Wizard - Step 4: Document Upload

#### Frontend Elements
**File:** `registration-wizard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Document Upload Areas | `.document-upload-area` | Div | Upload containers |
| File Input | `fileInput-{docType}` | Input (file) | File selection |
| Upload Button | `.btn-upload` | Button | Upload document |
| Document Preview | `.document-preview` | Div | Uploaded document preview |
| Remove Document Button | `.btn-remove-doc` | Button | Remove uploaded document |
| Previous Button | `.btn-secondary` | Button | Go to Step 3 |
| Submit Registration Button | `.btn-primary` | Button | Submit registration |

**JavaScript Function:** 
- `handleDocumentUpload(docType, file)` in `js/registration-wizard.js`
- Uses `uploadDocument()` from `js/document-upload-utils.js`

**Document Types (based on carType):**
- `csr` - Certificate of Stock Report
- `insuranceCert` - Insurance Certificate
- `hpgClearance` - HPG Clearance
- `salesInvoice` - Sales Invoice
- `ownerId` - Owner Valid ID
- `ctplCert` - CTPL Certificate
- `mvirCert` - MVIR Certificate
- `tinId` - TIN ID

#### Backend Endpoint
**File:** `backend/routes/documents.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/documents/upload` | `router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {...})` | Yes (JWT) |

**Request:**
- Content-Type: `multipart/form-data`
- Field: `document` (file)
- Field: `documentType` (string) - Logical type (e.g., 'registrationCert')
- Field: `vehicleId` (UUID, optional) - Link to vehicle if exists

**Response:**
```javascript
{
  success: true,
  document: {
    id: uuid,
    documentType: string,
    filename: string,
    originalName: string,
    fileSize: number,
    mimeType: string,
    fileHash: string,
    ipfsCid: string,  // If IPFS mode
    filePath: string, // If local storage mode
    uploadedAt: timestamp
  }
}
```

**Service:** `backend/services/storageService.js`
- `uploadFile(file, options)` - Handles IPFS or local storage
- `generateFileHash(file)` - SHA-256 hash generation

**Service:** `backend/services/ipfsService.js` (if IPFS mode)
- `addFile(file)` - Uploads to IPFS, returns CID

#### Database Schema
**Table:** `documents`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Document ID |
| `vehicle_id` | UUID | FOREIGN KEY → vehicles.id | Vehicle reference (nullable) |
| `document_type` | document_type ENUM | NOT NULL | Document type |
| `filename` | VARCHAR(255) | NOT NULL | Stored filename |
| `original_name` | VARCHAR(255) | NOT NULL | Original filename |
| `file_path` | VARCHAR(500) | NOT NULL | File path (local) or IPFS CID |
| `file_size` | BIGINT | NOT NULL | File size in bytes |
| `mime_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_hash` | VARCHAR(64) | NOT NULL | SHA-256 hash |
| `ipfs_cid` | VARCHAR(255) | NULL | IPFS Content Identifier |
| `uploaded_by` | UUID | FOREIGN KEY → users.id | Uploader |
| `uploaded_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload time |
| `verified` | BOOLEAN | DEFAULT false | Verification status |
| `verified_at` | TIMESTAMP | NULL | Verification time |
| `verified_by` | UUID | FOREIGN KEY → users.id | Verifier |

**ENUM:** `document_type`
```sql
CREATE TYPE document_type AS ENUM (
    'registration_cert',
    'insurance_cert',
    'owner_id',
    'deed_of_sale',
    'seller_id',
    'buyer_id',
    'other',
    'csr',
    'hpg_clearance',
    'sales_invoice',
    'ctpl_cert',
    'mvir_cert',
    'tin_id',
    'transfer_package_pdf',
    'transfer_certificate'
);
```

**Verification Checklist:**
- [ ] Frontend maps logical document types to database ENUM values
- [ ] Frontend validates file size (max 10MB)
- [ ] Frontend validates file type (PDF, JPG, JPEG, PNG)
- [ ] Backend receives file via multipart/form-data
- [ ] Backend generates SHA-256 hash
- [ ] Backend stores file (IPFS or local)
- [ ] Backend stores IPFS CID if IPFS mode
- [ ] Backend creates document record in database
- [ ] Backend returns document ID to frontend
- [ ] Frontend stores document IDs for submission

---

### 2.5 Registration Submission

#### Frontend Elements
**File:** `registration-wizard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Submit Button | `.btn-primary` (Step 4) | Button | Submit registration |
| Review Summary | `.review-summary` | Div | Shows all entered data |

**JavaScript Function:** `submitRegistration()` in `js/registration-wizard.js`

**Data Collected:**
```javascript
{
  // Vehicle Info (Step 2)
  vin: string,
  chassisNumber: string,
  engineNumber: string,
  plateNumber: string,
  make: string,
  model: string,
  year: number,
  color: string,
  vehicleType: string,
  fuelType: string,
  transmission: string,
  engineDisplacement: string,
  grossVehicleWeight: number,
  netWeight: number,
  
  // Owner Info (Step 3)
  firstName: string,
  lastName: string,
  address: string,
  phone: string,
  idType: string,
  idNumber: string,
  
  // Documents (Step 4)
  documentIds: [uuid, ...]  // Array of document IDs
}
```

#### Backend Endpoint
**File:** `backend/routes/vehicles.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/vehicles/register` | `router.post('/register', optionalAuth, async (req, res) => {...})` | Optional (JWT) |

**Request Body:**
```javascript
{
  vin: string,
  chassisNumber: string,
  engineNumber: string,
  plateNumber?: string,
  make: string,
  model: string,
  year: number,
  color: string,
  vehicleType: string,
  fuelType: string,
  transmission: string,
  engineDisplacement?: string,
  grossVehicleWeight?: number,
  netWeight?: number,
  ownerFirstName: string,
  ownerLastName: string,
  ownerAddress: string,
  ownerPhone: string,
  ownerIdType: string,
  ownerIdNumber: string,
  documentIds: [uuid, ...]  // Array of document IDs
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Vehicle registration submitted successfully',
  vehicle: {
    id: uuid,
    vin: string,
    plateNumber: string,
    make: string,
    model: string,
    year: number,
    status: 'SUBMITTED',
    registrationDate: timestamp,
    blockchainTxId: null  // Set after blockchain registration
  }
}
```

#### Database Schema
**Table:** `vehicles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Vehicle ID |
| `vin` | VARCHAR(17) | UNIQUE, NOT NULL | Vehicle Identification Number |
| `plate_number` | VARCHAR(20) | UNIQUE, NULL | License plate (assigned later) |
| `make` | VARCHAR(50) | NOT NULL | Manufacturer |
| `model` | VARCHAR(50) | NOT NULL | Model/series |
| `year` | INTEGER | NOT NULL | Year model |
| `color` | VARCHAR(30) | NULL | Vehicle color |
| `engine_number` | VARCHAR(50) | NULL | Engine number |
| `chassis_number` | VARCHAR(50) | NULL | Chassis number |
| `vehicle_type` | VARCHAR(30) | DEFAULT 'PASSENGER' | Body type |
| `fuel_type` | VARCHAR(20) | DEFAULT 'GASOLINE' | Fuel type |
| `transmission` | VARCHAR(20) | DEFAULT 'MANUAL' | Transmission |
| `engine_displacement` | VARCHAR(20) | NULL | Engine size |
| `gross_vehicle_weight` | DECIMAL(10,2) | NULL | Gross weight |
| `net_weight` | DECIMAL(10,2) | NULL | Net weight |
| `owner_id` | UUID | FOREIGN KEY → users.id | Owner reference |
| `status` | vehicle_status ENUM | DEFAULT 'SUBMITTED' | Registration status |
| `registration_date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Registration date |
| `last_updated` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update (trigger) |
| `or_number` | VARCHAR(50) | NULL | Official Receipt number |
| `cr_number` | VARCHAR(50) | NULL | Certificate of Registration number |
| `mvir_number` | VARCHAR(50) | NULL | MVIR number (for transfers) |
| `blockchain_tx_id` | VARCHAR(255) | NULL | Blockchain transaction ID |
| `priority` | VARCHAR(10) | DEFAULT 'MEDIUM' | Processing priority |
| `notes` | TEXT | NULL | Admin notes |

**ENUM:** `vehicle_status`
```sql
CREATE TYPE vehicle_status AS ENUM (
    'SUBMITTED',
    'PENDING_BLOCKCHAIN',
    'REGISTERED',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
    'TRANSFER_IN_PROGRESS',
    'TRANSFER_COMPLETED',
    'PROCESSING'
);
```

**Table:** `vehicle_history`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | History record ID |
| `vehicle_id` | UUID | FOREIGN KEY → vehicles.id | Vehicle reference |
| `action` | VARCHAR(50) | NOT NULL | Action type |
| `description` | TEXT | NULL | Action description |
| `performed_by` | UUID | FOREIGN KEY → users.id | User who performed action |
| `performed_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Action timestamp |
| `transaction_id` | VARCHAR(100) | NULL | Blockchain transaction ID |
| `metadata` | JSONB | NULL | Additional metadata |

**Insert on Registration:**
```sql
INSERT INTO vehicle_history (vehicle_id, action, description, performed_by, metadata)
VALUES (
  vehicleId,
  'REGISTRATION_SUBMITTED',
  'Vehicle registration submitted by owner',
  ownerId,
  '{"step": "initial_submission", "documentCount": documentIds.length}'::jsonb
);
```

**Link Documents:**
```sql
UPDATE documents 
SET vehicle_id = vehicleId 
WHERE id IN (documentIds)
```

**Verification Checklist:**
- [ ] Frontend collects all vehicle information
- [ ] Frontend collects all owner information
- [ ] Frontend includes all uploaded document IDs
- [ ] Backend validates VIN format and uniqueness
- [ ] Backend validates all required fields
- [ ] Backend creates vehicle record with status 'SUBMITTED'
- [ ] Backend links documents to vehicle
- [ ] Backend creates vehicle_history record
- [ ] Backend returns vehicle ID and status
- [ ] Database enforces UNIQUE constraint on VIN
- [ ] Database enforces UNIQUE constraint on plate_number (if provided)
- [ ] Database triggers update `last_updated` automatically

---

## 3. Document Management

### 3.1 Document Upload (Standalone)

#### Frontend Elements
**File:** Various (admin-dashboard.html, owner-dashboard.html, etc.)

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| File Input | `fileInput` | Input (file) | File selection |
| Document Type Select | `documentType` | Select | Document type selection |
| Upload Button | `.btn-upload` | Button | Upload document |
| Progress Bar | `.upload-progress` | Div | Upload progress indicator |

**JavaScript Function:** `uploadDocument(docType, file, options)` in `js/document-upload-utils.js`

#### Backend Endpoint
**File:** `backend/routes/documents.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/documents/upload` | `router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {...})` | Yes (JWT) |
| POST | `/api/documents/upload-auth` | `router.post('/upload-auth', authenticateToken, upload.single('document'), async (req, res) => {...})` | Yes (JWT + Temp Token) |

**Request:**
- Content-Type: `multipart/form-data`
- Field: `document` (file)
- Field: `documentType` (string) - Logical type
- Field: `vehicleId` (UUID, optional)

**Response:**
```javascript
{
  success: true,
  document: {
    id: uuid,
    documentType: string,
    filename: string,
    originalName: string,
    fileSize: number,
    mimeType: string,
    fileHash: string,
    ipfsCid: string,
    uploadedAt: timestamp
  }
}
```

#### Database Schema
**Same as Section 2.4** - Uses `documents` table

**Verification Checklist:**
- [ ] Frontend validates file before upload
- [ ] Frontend shows upload progress
- [ ] Backend validates file size and type
- [ ] Backend generates file hash
- [ ] Backend stores file (IPFS or local)
- [ ] Backend creates document record
- [ ] Backend returns document metadata

---

### 3.2 Document View/Download

#### Frontend Elements
**File:** Various dashboards

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| View Document Button | `.btn-view-doc` | Button | View document |
| Download Document Button | `.btn-download-doc` | Button | Download document |
| Document Modal | `.document-modal` | Modal | Document viewer |

**JavaScript Function:** `viewDocument(documentId)` in `js/document-modal.js`

#### Backend Endpoint
**File:** `backend/routes/documents.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/documents/:id` | `router.get('/:id', authenticateTokenOrTemp, async (req, res) => {...})` | Yes (JWT or Temp Token) |
| GET | `/api/documents/:id/download` | `router.get('/:id/download', authenticateTokenOrTemp, async (req, res) => {...})` | Yes (JWT or Temp Token) |
| GET | `/api/documents/ipfs/:cid` | `router.get('/ipfs/:cid', authenticateToken, async (req, res) => {...})` | Yes (JWT) |

**Response (View):**
- Content-Type: Based on document MIME type
- Body: File stream

**Response (Download):**
- Content-Disposition: `attachment; filename="original_name"`
- Body: File stream

#### Database Operations
**Query:**
```sql
SELECT 
  id, document_type, filename, original_name, 
  file_path, ipfs_cid, file_size, mime_type,
  uploaded_at, verified, verified_at
FROM documents
WHERE id = $1
```

**Verification Checklist:**
- [ ] Frontend requests document with proper authentication
- [ ] Backend verifies user has access to document
- [ ] Backend retrieves file from storage (IPFS or local)
- [ ] Backend streams file to client
- [ ] Frontend displays document in modal or downloads

---

### 3.3 Document Verification

#### Frontend Elements
**File:** `admin-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Verify Button | `.btn-verify-doc` | Button | Verify document |
| Reject Button | `.btn-reject-doc` | Button | Reject document |
| Verification Notes Input | `verificationNotes` | Textarea | Verification notes |

#### Backend Endpoint
**File:** `backend/routes/documents.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/documents/:id/verify` | `router.post('/:id/verify', authenticateToken, authorizeRole(['admin']), async (req, res) => {...})` | Yes (Admin) |

**Request Body:**
```javascript
{
  verified: boolean,
  notes?: string
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Document verified successfully',
  document: {
    id: uuid,
    verified: true,
    verifiedAt: timestamp,
    verifiedBy: uuid
  }
}
```

#### Database Operations
**Update:**
```sql
UPDATE documents
SET 
  verified = $1,
  verified_at = CURRENT_TIMESTAMP,
  verified_by = $2
WHERE id = $3
```

**Verification Checklist:**
- [ ] Frontend sends verification status and notes
- [ ] Backend verifies admin role
- [ ] Backend updates document verification status
- [ ] Backend records verifier and timestamp
- [ ] Backend returns updated document

---

## 4. Transfer of Ownership

### 4.1 Create Transfer Request (Seller → LTO)

#### Frontend Elements
**Files:** `owner-dashboard.html`, `js/owner-dashboard.js`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Vehicle Select | `#transferVehicleSelect` | Select | Choose vehicle to transfer (must be owned by seller) |
| Buyer Email Input | `#transferBuyerEmail` | Input | Email of buyer (used to invite / link account) |
| Buyer Name Input (optional) | `#transferBuyerName` | Input | Display name for buyer (for email/preview) |
| Buyer Phone Input (optional) | `#transferBuyerPhone` | Input | Buyer contact number (stored in metadata) |
| Create Transfer Button | `.btn-create-transfer` | Button | Creates transfer request and sends buyer invite |

**JavaScript Function:** `createTransferRequest()` (final implementation is in `js/owner-dashboard.js` – calls `/api/vehicles/transfer/requests` with `vehicleId`, `buyerEmail`, `buyerName`, `buyerPhone`, and optional initial `documents`).

#### Backend Endpoint
**File:** `backend/routes/transfer.js` (mounted under `/api/vehicles/transfer`)

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/vehicles/transfer/requests` | `router.post('/requests', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {...})` | Yes (`vehicle_owner` / `admin`) |

**Request Body (current implementation):**
```javascript
{
  vehicleId: string,          // UUID - required
  buyerId?: string,           // Optional direct link if buyer already has account
  buyerInfo?: {               // Optional legacy payload (kept for backward compatibility)
    email?: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  },
  buyerEmail?: string,        // Required if buyerId not provided
  buyerName?: string,         // Optional display name for emails
  buyerPhone?: string,        // Optional contact number
  documentIds?: string[],     // Legacy array of document UUIDs (mapped to BUYER_ID)
  documents?: {               // NEW: Explicit transfer roles mapped to document IDs
    deedOfSale?: string,      // docTypes.TRANSFER_ROLES.DEED_OF_SALE
    sellerId?: string,        // SELLER_ID
    buyerId?: string,         // BUYER_ID (rare at creation time)
    // buyer_tin / buyer_ctpl / buyer_mvir / buyer_hpg_clearance
  }
}
```

**Key Backend Logic (summarized):**
- Verifies:
  - `vehicleId` exists and belongs to the authenticated seller (unless `admin`).
  - `buyerEmail` present if no `buyerId`.
  - Seller profile has `first_name` + `last_name` (profile completeness check).
  - No existing pending transfer for this vehicle (`PENDING`, `AWAITING_BUYER_DOCS`, `UNDER_REVIEW`).
- Resolves buyer:
  - If `buyerId` given → uses that user.
  - Else, looks up `buyerEmail` in `users`; if found, binds `buyer_id`.
  - If not found, stores `{ email: buyerEmail }` in `buyer_info` JSONB for later.
- Creates `transfer_requests` row with:
  - `status = 'PENDING'`
  - `expires_at` computed via `computeExpiresAt()`
  - `buyer_info` JSONB (email + optional name/phone)
- Links any initial documents (if `documents` or `documentIds` provided) via `linkTransferDocuments`.
- Sends email to buyer with secure preview / acceptance link via Gmail API (`sendTransferInviteEmail`).

**Database Schema (key columns) – `transfer_requests`:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `vehicle_id` | UUID | FK → `vehicles.id` (must be owned by seller) |
| `seller_id` | UUID | FK → `users.id` (authenticated seller) |
| `buyer_id` | UUID | FK → `users.id` (set once buyer account is linked) |
| `buyer_email` | VARCHAR(255) | Canonical buyer email snapshot |
| `buyer_info` | JSONB | `{ email, firstName, lastName, phone }` (invite metadata) |
| `status` | TEXT | See status list below |
| `expires_at` | TIMESTAMP | Computed expiry for handshake |
| `metadata` | JSONB | Stores validation, auto-forward, MVIR flags, etc. |
| `created_at` / `updated_at` | TIMESTAMP | Audit fields |

**Status Values (effective for transfer):**
- `PENDING` – Seller submitted request, waiting for buyer to accept / upload docs.
- `AWAITING_BUYER_DOCS` – Buyer accepted, but has not yet uploaded all documents.
- `UNDER_REVIEW` – Buyer docs submitted, LTO currently reviewing and/or waiting for HPG/Insurance.
- `APPROVED` – LTO admin approved transfer (before blockchain + OR/CR completion).
- `COMPLETED` – Transfer finalized, ownership and OR/CR updated, blockchain updated.
- `REJECTED` – Transfer rejected by LTO or buyer.
- (Internally in metadata: flags like `ltoInspectionRequired`, `autoForward`, etc.)

**Verification Checklist (re-verified 2026‑01‑23):**
- [x] Frontend uses `/api/vehicles/transfer/requests` (confirmed in `js/owner-dashboard.js`).
- [x] Backend enforces seller-owns-vehicle check (`vehicle.owner_id` vs `req.user.userId`).
- [x] Duplicate transfer prevention for active statuses.
- [x] Buyer resolution via `buyerId` or `buyerEmail` + `getUserByEmail`.
- [x] Initial documents correctly linked via `linkTransferDocuments`.
- [x] Email invite sent to `buyerEmail` with preview/accept link.

---

### 4.2 Buyer Accept Transfer Request (+ Optional Doc Upload)

#### Frontend Elements
**File:** `my-vehicle-ownership.html` / `js/my-vehicle-ownership.js`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Accept Button | `#acceptTransferBtn` | Button | Buyer accepts transfer |
| Reject Button | `#rejectTransferBtn` | Button | Buyer rejects transfer |
| Buyer Document Upload Inputs | Driven by `buyerDocumentsConfig` | File inputs | Upload buyer ID, TIN, CTPL, MVIR, HPG |

Buyer doc roles are configured in `js/my-vehicle-ownership.js`:

```javascript
buyerDocumentsConfig = [
  { key: 'buyer_id',   label: 'Buyer ID',   ... },
  { key: 'buyer_tin',  label: 'Buyer TIN', ... },
  { key: 'buyer_ctpl', label: 'Buyer CTPL', ... },
  { key: 'buyer_mvir', label: 'Buyer MVIR', ... },
  { key: 'buyer_hpg_clearance', label: 'Buyer HPG Clearance', ... }
];
```

These keys map directly to backend transfer roles via `documentRoleMap` in `backend/routes/transfer.js`.

#### Backend Endpoint
**File:** `backend/routes/transfer.js` (mounted under `/api/vehicles/transfer`)

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/vehicles/transfer/requests/:id/accept` | `router.post('/requests/:id/accept', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {...})` | Yes (`vehicle_owner` / `admin`) |

**Request Body (current buyer flow):**
```javascript
{
  documents?: {
    buyer_id?: string,             // document UUID
    buyer_tin?: string,
    buyer_ctpl?: string,
    buyer_mvir?: string,
    buyer_hpg_clearance?: string
  },
  documentIds?: string[]           // Legacy fallback (mapped to BUYER_ID)
}
```

**High-level Handler Logic:**
- Loads transfer request (`db.getTransferRequestById(id)`).
- Ensures status is `PENDING` or `AWAITING_BUYER_DOCS`.
- Confirms current user is the designated buyer:
  - by `buyer_id` / `buyer_user_id` OR
  - by `buyer_info.email` matching `req.user.email`.
- If `buyer_id` not set but email matches, binds `buyer_id` to current user and updates `buyer_info.email`.
- If `documents` provided:
  - Calls `linkTransferDocuments({ transferRequestId: id, documents, uploadedBy: currentUserId })`.
  - Runs `transferAutoValidationService.validateDocuments({ transferRequest, vehicle, documents })` for **presence/hash** checks on:
    - HPG (`BUYER_HPG_CLEARANCE`)
    - MVIR (`BUYER_MVIR`)
    - CTPL (`BUYER_CTPL`)
    - Buyer TIN (`BUYER_TIN`)
  - Runs `autoVerifyMVIR()` for MVIR if present (see §5).
  - Persists validation + MVIR auto-verification into `transfer_requests.metadata`.
  - Updates status → `UNDER_REVIEW`.
- If no documents yet, marks:
  - `status = 'AWAITING_BUYER_DOCS'`
  - `metadata.awaitingBuyerDocs = true`.
- Sends:
  - Email to seller (buyer accepted).
  - In‑app notification to seller.
- If status became `UNDER_REVIEW` and request is eligible, triggers **auto-forward** to HPG and Insurance (see §4.5).

**Response (simplified structure):**
```javascript
{
  success: true,
  message: string, // 'Buyer documents submitted. Awaiting LTO review.' or similar
  transferRequest: { ...updated row... },
  autoForward: { ... } | null,
  validation: { ... } | null      // Result from transferAutoValidationService
}
```

**Verification Checklist (re-verified 2026‑01‑23):**
- [x] Only designated buyer (ID or email) can accept.
- [x] Buyer docs map correctly from UI keys → `transfer_documents.document_type` roles.
- [x] `transfer_documents` rows created via `linkTransferDocuments`.
- [x] `transfer_requests.status` transitions:
  - `PENDING` → `UNDER_REVIEW` (when docs provided)
  - `PENDING` → `AWAITING_BUYER_DOCS` (when no docs yet)
- [x] Validation + MVIR auto‑verification stored in `metadata.validation` and `metadata.mvirAutoVerification`.
- [x] Seller notified via email + in‑app notification.

---

### 4.3 Transfer Documents (Schema & Roles)

There is no longer a separate `/documents` multipart endpoint for transfer; documents are:
- Uploaded via the **generic document upload** flow (`/api/documents`) and
- Then linked to a transfer via:
  - Buyer accept (`/requests/:id/accept` with `documents` mapping), or
  - Explicit link route (`/requests/:id/link-document`) when buyer/admin replaces or adds docs.

#### Link Document Endpoint
**File:** `backend/routes/transfer.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/vehicles/transfer/requests/:id/link-document` | `router.post('/requests/:id/link-document', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {...})` | Yes (Seller / Buyer / Admin) |

**Request Body:**
```javascript
{
  documents: {
    deed_of_sale?: string,
    seller_id?: string,
    buyer_id?: string,
    buyer_tin?: string,
    buyer_ctpl?: string,
    buyer_mvir?: string,
    buyer_hpg_clearance?: string,
    other?: string
  }
}
```

This uses the same `documentRoleMap` as buyer-accept; roles come from `backend/config/documentTypes.js` (`TRANSFER_ROLES`).

#### Database Schema – `transfer_documents`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Transfer-document link ID |
| `transfer_request_id` | UUID | FK → `transfer_requests.id` | Transfer reference |
| `document_type` | VARCHAR(30) | CHECK constraint | **Transfer role** (not DB document type) |
| `document_id` | UUID | FK → `documents.id` | Linked document record |
| `uploaded_by` | UUID | FK → `users.id` | Uploader user ID |
| `uploaded_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Link created time |

**Allowed `document_type` values (post‑migration `008_update_transfer_documents_constraint.sql`):**
- `deed_of_sale`        – Seller’s Deed of Sale
- `seller_id`           – Seller’s government ID
- `buyer_id`            – Buyer’s government ID
- `buyer_tin`           – Buyer’s TIN document
- `buyer_ctpl`          – Buyer’s CTPL insurance certificate
- `buyer_mvir`          – Buyer’s MVIR scan
- `buyer_hpg_clearance` – Buyer’s HPG clearance certificate
- `other`               – Edge cases / misc docs

Removed / deprecated roles:
- `or_cr` – OR/CR is auto‑linked from `documents` per vehicle, **not** uploaded in transfer.
- `emission_cert` – Emission workflow removed.
- `insurance_cert` – CTPL handled via `buyer_ctpl` + insurance issuer integration.
- `transfer_package_pdf`, `transfer_certificate` – System-generated, no longer stored as `transfer_documents`.

**Verification Checklist (re-verified 2026‑01‑23):**
- [x] CHECK constraint on `transfer_documents.document_type` matches `TRANSFER_ROLES` used by frontend (post‑migration).
- [x] Buyer and seller uploads use only the whitelisted roles.
- [x] `getTransferRequestDocuments` correctly distinguishes:
  - `td.document_type` (transfer role)
  - `d.document_type` (DB document type, exposed as `document_db_type`).

---

### 4.4 LTO Admin Transfer Review & Approval

#### Frontend Elements
**Files:** `admin-transfer-requests.html`, `admin-transfer-details.html`, `js/admin-transfer-details.js`

Key UI:
- Transfer list: `admin-transfer-requests.html` shows summary + a **View** button → `admin-transfer-details.html?id=<transferRequestId>`.
- Details screen:
  - Section: **Organization Approval Status** (HPG + Insurance status badges).
  - Section: **LTO MVIR Validation** (MVIR inspection + auto-verification status).
  - Section: Seller / Buyer / Vehicle info + uploaded documents.
  - Action panel:
    - Forward to HPG / Insurance.
    - Approve / Reject transfer (only when orgs approvals are satisfied).

#### Approval Endpoint
**File:** `backend/routes/transfer.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/vehicles/transfer/requests/:id/approve` | `router.post('/requests/:id/approve', authenticateToken, authorizeRole(['admin']), async (req, res) => {...})` | Yes (`admin`) |

**Key Preconditions in Handler (re-verified):**
1. **Organization approvals:**
   - If `hpg_clearance_request_id` present → `hpg_approval_status` must not be `PENDING` or `REJECTED`.
   - If `insurance_clearance_request_id` present → `insurance_approval_status` must not be `PENDING` or `REJECTED`.
   - If any are pending → returns `400` with `pendingApprovals`.
   - If any rejected → returns `400` with `rejectedApprovals`.
2. **LTO Inspection (MVIR):**
   - Loads `vehicle = db.getVehicleById(request.vehicle_id)`.
   - If `vehicle.mvir_number` is falsy:
     - Updates status to `UNDER_REVIEW` with `metadata.ltoInspectionRequired = true`.
     - Sends notifications to seller (and buyer if resolved) that **LTO inspection is required**.
     - Returns `400` with `code = 'LTO_INSPECTION_REQUIRED'`.
3. **Buyer identity:**
   - Ensures `buyer_id` is resolved; if only `buyer_info` exists, creates a new `vehicle_owner` user and updates `buyer_id`.
4. **Required documents:**
   - Loads `transferDocs = db.getTransferRequestDocuments(id)`.
   - Asserts presence of required roles:
     - Seller: `deed_of_sale`, `seller_id`.
     - Buyer: `buyer_id`, `buyer_tin`, `buyer_ctpl`, `buyer_mvir`, `buyer_hpg_clearance`.
   - If missing roles exist → returns `400` listing missing seller/buyer roles.

**Core Effects on Approval:**
- Updates `transfer_requests.status` → `APPROVED`, plus:
  - `approved_at`, `approved_by`.
  - `metadata` extended with inspection + org approval context.
- Updates `vehicles`:
  - Changes `owner_id` to buyer.
  - Maintains inspection fields (`mvir_number`, `inspection_date`, etc.).
  - Assigns OR/CR numbers if not already assigned (via LTO approval path, see §2/§8).
- Links buyer’s documents to vehicle:
  - For all `transfer_documents` with role starting `buyer_`:
    - Updates the underlying `documents.vehicle_id = request.vehicle_id` (append-only history for blockchain).
  - Attempts to mark old seller docs `is_active = false` (best-effort, tolerant if column missing).

**Response (simplified):**
```javascript
{
  success: true,
  message: 'Transfer request approved and ownership updated',
  transferRequest: { ...updated row... }
}
```

**Verification Checklist (re-verified 2026‑01‑23):**
- [x] HPG + Insurance approvals must be complete (no lingering `PENDING`) before approval.
- [x] LTO inspection (`vehicle.mvir_number`) is mandatory; otherwise approval is blocked with clear 400 error + notifications.
- [x] All required transfer document roles present (`deed_of_sale`, `seller_id`, `buyer_id`, `buyer_tin`, `buyer_ctpl`, `buyer_mvir`, `buyer_hpg_clearance`).
- [x] Buyer is fully resolved (`buyer_id` present), creating an account if only `buyer_info` existed.
- [x] Vehicle ownership, OR/CR, and document links are updated atomically within the approval path.


**Update Vehicle:**
```sql
UPDATE vehicles
SET 
  owner_id = $1,  -- New owner (buyer)
  status = 'TRANSFER_COMPLETED',
  last_updated = CURRENT_TIMESTAMP
WHERE id = $2
```

**Generate New OR/CR:**
- Backend generates new OR number
- Backend generates new CR number
- Backend stores in `vehicles.or_number` and `vehicles.cr_number`

**Generate MVIR:**
- Backend generates MVIR number
- Backend stores in `vehicles.mvir_number`

**Blockchain Update:**
- Backend calls blockchain service to transfer ownership
- Backend stores transaction ID in `vehicles.blockchain_tx_id`

**Vehicle History:**
```sql
INSERT INTO vehicle_history (vehicle_id, action, description, performed_by, transaction_id)
VALUES (
  vehicleId,
  'OWNERSHIP_TRANSFERRED',
  'Vehicle ownership transferred from seller to buyer',
  adminId,
  blockchainTxId
)
```

**Verification Checklist:**
- [ ] Frontend sends approval request
- [ ] Backend verifies admin role
- [ ] Backend verifies all required documents uploaded
- [ ] Backend updates transfer request status
- [ ] Backend updates vehicle owner
- [ ] Backend generates new OR/CR numbers
- [ ] Backend generates MVIR number
- [ ] Backend updates blockchain
- [ ] Backend creates vehicle history record
- [ ] Backend notifies buyer and seller

---

## 5. Verification Workflows

### 5.1 Insurance Verification

#### Frontend Elements
**File:** `insurance-verifier-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Verification Requests List | `.verification-requests` | Div | List of requests |
| Approve Button | `.btn-approve-insurance` | Button | Approve insurance |
| Reject Button | `.btn-reject-insurance` | Button | Reject insurance |
| Verification Notes Input | `insuranceNotes` | Textarea | Verification notes |

#### Backend Endpoint
**File:** `backend/routes/insurance.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/insurance/requests` | Get insurance verification requests | Yes (Insurance Verifier/Admin) |
| POST | `/api/insurance/approve` | Approve insurance verification | Yes (Insurance Verifier/Admin) |
| POST | `/api/insurance/reject` | Reject insurance verification | Yes (Insurance Verifier/Admin) |

#### Database Schema
**Table:** `clearance_requests`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Clearance request ID |
| `vehicle_id` | UUID | FOREIGN KEY → vehicles.id | Vehicle reference |
| `request_type` | VARCHAR(50) | NOT NULL | 'insurance', 'emission' (deprecated), 'hpg' |
| `status` | VARCHAR(50) | DEFAULT 'PENDING' | Request status |
| `requested_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Request time |
| `approved_at` | TIMESTAMP | NULL | Approval time |
| `approved_by` | UUID | FOREIGN KEY → users.id | Approver |
| `rejected_at` | TIMESTAMP | NULL | Rejection time |
| `rejected_by` | UUID | FOREIGN KEY → users.id | Rejector |
| `rejection_reason` | TEXT | NULL | Rejection reason |
| `completed_at` | TIMESTAMP | NULL | Completion time |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Update time (trigger) |

**Table:** `vehicle_verifications`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Verification ID |
| `vehicle_id` | UUID | FOREIGN KEY → vehicles.id | Vehicle reference |
| `verification_type` | VARCHAR(20) | NOT NULL | 'insurance', 'emission' (deprecated), 'admin' |
| `status` | verification_status ENUM | DEFAULT 'PENDING' | Verification status |
| `verified_by` | UUID | FOREIGN KEY → users.id | Verifier |
| `verified_at` | TIMESTAMP | NULL | Verification time |
| `notes` | TEXT | NULL | Verification notes |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Update time (trigger) |

**ENUM:** `verification_status`
```sql
CREATE TYPE verification_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);
```

**Verification Checklist:**
- [ ] Frontend displays insurance verification requests
- [ ] Frontend allows approve/reject actions
- [ ] Backend verifies insurance verifier role
- [ ] Backend updates clearance_requests status
- [ ] Backend updates vehicle_verifications status
- [ ] Backend records verifier and timestamp
- [ ] Backend notifies vehicle owner

---

### 5.2 Emission Verification

⚠️ **STATUS: DEPRECATED/REMOVED** ⚠️

**Note:** Emission verification workflow has been **REMOVED** from the system. LTO cannot generate or verify emission certificates. These must be issued by authorized external emission testing centers.

#### What Was Removed:
- ❌ `backend/routes/emission.js` - **FILE DOES NOT EXIST**
- ❌ Emission certificate generation endpoint
- ❌ Emission issuer API endpoint (`/api/issuer/emission/issue-certificate`)

#### Current Architecture:
- ✅ Emission certificates issued by external organizations
- ✅ Vehicle owners upload certificates via `/api/certificate-uploads/submit`
- ✅ System verifies by hash matching against blockchain records
- ✅ No LTO-administered emission verification workflow

#### Legacy Components (Still in Database):
- ⚠️ `emission_verifier` role in `user_role` ENUM (for existing users)
- ⚠️ `emission` in `verification_type` (vehicle_verifications table)
- ⚠️ `emission_clearance_request_id` in `transfer_requests` table
- ⚠️ `emission_approval_status` in `transfer_requests` table
- ⚠️ `emission_approved_at` in `transfer_requests` table
- ⚠️ `emission_approved_by` in `transfer_requests` table
- ⚠️ `emission_compliance` in `vehicles` table
- ⚠️ Frontend: `verifier-dashboard.html` (may need removal/update)

#### Frontend Elements (Legacy - May Be Disabled)
**File:** `verifier-dashboard.html`

| Element | ID/Class | Type | Purpose | Status |
|---------|----------|------|---------|--------|
| Verification Requests List | `.verification-requests` | Div | List of requests | ⚠️ Legacy |
| Approve Button | `.btn-approve-emission` | Button | Approve emission | ⚠️ Non-functional |
| Reject Button | `.btn-reject-emission` | Button | Reject emission | ⚠️ Non-functional |

**Verification Checklist:**
- [ ] ⚠️ **DEPRECATED** - Feature removed, no verification needed
- [ ] ⚠️ Frontend should show "Feature Deprecated" message
- [ ] ⚠️ Database columns should be reviewed for cleanup

---

### 5.3 HPG Clearance

#### Frontend Elements
**File:** `hpg-admin-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| HPG Requests List | `.hpg-requests` | Div | List of HPG requests |
| Approve Button | `.btn-approve-hpg` | Button | Approve HPG clearance |
| Reject Button | `.btn-reject-hpg` | Button | Reject HPG clearance |
| Release Certificate Button | `.btn-release-certificate` | Button | Release HPG certificate |

#### Backend Endpoint
**File:** `backend/routes/hpg.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/hpg/requests` | Get HPG clearance requests | Yes (HPG Admin/Admin) |
| POST | `/api/hpg/verify/approve` | Approve HPG clearance | Yes (HPG Admin/Admin) |
| POST | `/api/hpg/verify/reject` | Reject HPG clearance | Yes (HPG Admin/Admin) |
| POST | `/api/hpg/certificate/release` | Release HPG certificate | Yes (HPG Admin/Admin) |

**Verification Checklist:**
- [ ] Frontend displays HPG requests
- [ ] Frontend allows approve/reject/release actions
- [ ] Backend verifies HPG admin role
- [ ] Backend updates clearance_requests status
- [ ] Backend generates HPG certificate on release
- [ ] Database records all actions

---

### 5.4 Admin Clearance Approval

#### Frontend Elements
**File:** `admin-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Approve Clearance Button | `.btn-approve-clearance` | Button | Final clearance approval |
| Reject Clearance Button | `.btn-reject-clearance` | Button | Reject clearance |

#### Backend Endpoint
**File:** `backend/routes/lto.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/lto/approve-clearance` | `router.post('/approve-clearance', authenticateToken, authorizeRole(['admin']), async (req, res) => {...})` | Yes (Admin) |

**Request Body:**
```javascript
{
  vehicleId: uuid,
  notes?: string
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Clearance approved successfully',
  vehicle: {
    id: uuid,
    status: 'APPROVED',
    orNumber: string,
    crNumber: string
  }
}
```

#### Database Operations
**Update Vehicle:**
```sql
UPDATE vehicles
SET 
  status = 'APPROVED',
  or_number = $1,  -- Generated OR number
  cr_number = $2,  -- Generated CR number
  last_updated = CURRENT_TIMESTAMP
WHERE id = $3
```

**Blockchain Registration:**
- Backend calls blockchain service to register vehicle
- Backend stores transaction ID
- Backend updates status to 'REGISTERED' if blockchain succeeds

**Verification Checklist:**
- [ ] Frontend sends approval request
- [ ] Backend verifies all verifications complete
- [ ] Backend generates OR/CR numbers
- [ ] Backend updates vehicle status to 'APPROVED'
- [ ] Backend registers vehicle on blockchain
- [ ] Backend updates status to 'REGISTERED' after blockchain
- [ ] Database stores OR/CR numbers
- [ ] Database stores blockchain transaction ID

---

## 6. Certificate Generation

### 6.1 OR/CR Certificate Generation

#### Frontend Elements
**File:** `certificate-generator.html` or `owner-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Generate Certificate Button | `.btn-generate-cert` | Button | Generate OR/CR certificate |
| Download Certificate Button | `.btn-download-cert` | Button | Download certificate PDF |

#### Backend Endpoint
**File:** `backend/routes/certificate-generation.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/certificate-generation/or-cr/generate` | Generate OR/CR certificate | Yes |

#### Database Schema
**Table:** `certificates`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Certificate ID |
| `vehicle_id` | UUID | FOREIGN KEY → vehicles.id | Vehicle reference |
| `certificate_type` | VARCHAR(50) | NOT NULL | 'or_cr', 'transfer', etc. |
| `certificate_number` | VARCHAR(100) | NULL | Certificate number |
| `or_number` | VARCHAR(50) | NULL | OR number |
| `cr_number` | VARCHAR(50) | NULL | CR number |
| `status` | VARCHAR(50) | DEFAULT 'ISSUED' | Certificate status |
| `issued_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Issue time |
| `expires_at` | TIMESTAMP | NULL | Expiration time |
| `file_path` | TEXT | NULL | Certificate file path |
| `qr_code_data` | TEXT | NULL | QR code data |
| `blockchain_tx_id` | VARCHAR(255) | NULL | Blockchain transaction ID |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Update time |

**Service:** `backend/services/certificateGeneratorService.js`
- `generateORCRCertificate(vehicleId, options)` - Generates OR/CR certificate
- `generateQRCode(data)` - Generates QR code for verification

**Verification Checklist:**
- [ ] Frontend requests certificate generation
- [ ] Backend verifies vehicle is approved/registered
- [ ] Backend generates certificate PDF
- [ ] Backend generates QR code
- [ ] Backend stores certificate record
- [ ] Backend returns certificate download link
- [ ] Database stores certificate metadata

---

## 7. Blockchain Integration

### 7.1 Vehicle Registration on Blockchain

#### Frontend Elements
**N/A** - Automatic on admin approval

#### Backend Endpoint
**File:** `backend/routes/blockchain.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/blockchain/vehicles/register` | `router.post('/vehicles/register', authenticateToken, async (req, res) => {...})` | Yes |

**Service:** `backend/services/optimizedFabricService.js`
- `registerVehicle(vehicleData)` - Registers vehicle on Hyperledger Fabric
- Returns transaction ID

#### Database Operations
**Update Vehicle:**
```sql
UPDATE vehicles
SET 
  blockchain_tx_id = $1,
  status = 'REGISTERED',
  last_updated = CURRENT_TIMESTAMP
WHERE id = $2
```

**Verification Checklist:**
- [ ] Backend prepares vehicle data for blockchain
- [ ] Backend invokes Fabric chaincode
- [ ] Backend receives transaction ID
- [ ] Backend stores transaction ID in database
- [ ] Backend updates vehicle status to 'REGISTERED'

---

### 7.2 Blockchain Ledger Viewer

#### Frontend Elements
**File:** `admin-blockchain-viewer.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Blocks List | `.blocks-list` | Div | List of blocks |
| Transactions List | `.transactions-list` | Div | List of transactions |
| Block Details Modal | `.block-details-modal` | Modal | Block details |
| Transaction Details Modal | `.transaction-details-modal` | Modal | Transaction details |

#### Backend Endpoint
**File:** `backend/routes/ledger.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/ledger/blocks` | Get blockchain blocks | Yes (Admin) |
| GET | `/api/ledger/blocks/:id` | Get block details | Yes (Admin) |
| GET | `/api/ledger/transactions` | Get transactions | Yes (Admin) |
| GET | `/api/ledger/transactions/:id` | Get transaction details | Yes (Admin) |

**Service:** `backend/services/blockchainLedger.js`
- `getBlocks(options)` - Retrieves blocks from Fabric
- `getTransaction(txId)` - Retrieves transaction details

**Verification Checklist:**
- [ ] Frontend displays blockchain blocks
- [ ] Frontend displays transactions
- [ ] Backend queries Fabric ledger
- [ ] Backend returns block/transaction data
- [ ] Frontend shows details in modals

---

## 8. Admin Features

### 8.1 Admin Dashboard Statistics

#### Frontend Elements
**File:** `admin-dashboard.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Statistics Cards | `.stat-card` | Div | Statistics display |
| Applications Count | `.applications-count` | Span | Total applications |
| Transfers Count | `.transfers-count` | Span | Total transfers |
| Users Count | `.users-count` | Span | Total users |

#### Backend Endpoint
**File:** `backend/routes/admin.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/admin/stats` | `router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {...})` | Yes (Admin) |

**Response:**
```javascript
{
  success: true,
  stats: {
    vehicles: {
      total: number,
      submitted: number,
      registered: number,
      approved: number,
      rejected: number
    },
    transfers: {
      total: number,
      pending: number,
      approved: number,
      rejected: number,
      completed: number
    },
    users: {
      total: number,
      byRole: {
        vehicle_owner: number,
        admin: number,
        // ...
      }
    },
    clearances: {
      total: number,
      hpg: { total, pending, approved, rejected },
      insurance: { total, pending, approved, rejected }
    }
  }
}
```

#### Database Queries
**Vehicles Stats:**
```sql
SELECT status, COUNT(*) as count 
FROM vehicles 
GROUP BY status
```

**Transfers Stats:**
```sql
SELECT status, COUNT(*) as count 
FROM transfer_requests 
GROUP BY status
```

**Users Stats:**
```sql
SELECT role, COUNT(*) as count 
FROM users 
WHERE is_active = true
GROUP BY role
```

**Verification Checklist:**
- [ ] Frontend loads statistics on page load
- [ ] Backend aggregates data from multiple tables
- [ ] Backend returns formatted statistics
- [ ] Frontend displays statistics in cards

---

### 8.2 User Management

#### Frontend Elements
**File:** `user-management.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Users List | `.users-list` | Table | List of users |
| Create User Button | `.btn-create-user` | Button | Create new user |
| Edit User Button | `.btn-edit-user` | Button | Edit user |
| Deactivate User Button | `.btn-deactivate-user` | Button | Deactivate user |
| Role Select | `userRole` | Select | Assign role |

#### Backend Endpoint
**File:** `backend/routes/admin.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/admin/users` | Get all users | Yes (Admin) |
| POST | `/api/admin/create-user` | Create user | Yes (Admin) |
| PUT | `/api/admin/users/:id` | Update user | Yes (Admin) |
| PUT | `/api/admin/users/:id/activate` | Activate/deactivate user | Yes (Admin) |

**Verification Checklist:**
- [ ] Frontend displays user list
- [ ] Frontend allows user creation
- [ ] Frontend allows role assignment
- [ ] Frontend allows user activation/deactivation
- [ ] Backend verifies admin role
- [ ] Backend creates/updates users
- [ ] Database stores user data correctly

---

## 9. External Organization Integration

### 9.1 External Issuer Registration

#### Frontend Elements
**File:** `admin-settings.html` or issuer registration page

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Issuer Type Select | `issuerType` | Select | Insurance, HPG, etc. |
| Company Name Input | `companyName` | Input | Company name |
| License Number Input | `licenseNumber` | Input | License number |
| API Key Input | `apiKey` | Input | API key |
| Register Button | `.btn-register-issuer` | Button | Register issuer |

#### Backend Endpoint
**File:** `backend/routes/issuer.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/issuer/register` | Register external issuer | Yes (Admin) |

#### Database Schema
**Table:** `external_issuers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Issuer ID |
| `issuer_type` | VARCHAR(20) | NOT NULL | 'insurance', 'hpg', etc. |
| `company_name` | VARCHAR(255) | NOT NULL | Company name |
| `license_number` | VARCHAR(100) | NOT NULL | License number |
| `api_key` | VARCHAR(255) | NULL | API key |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Update time |

**Verification Checklist:**
- [ ] Frontend collects issuer information
- [ ] Backend validates issuer data
- [ ] Backend creates issuer record
- [ ] Database stores issuer data

---

### 9.2 Certificate Issuance by External Organizations

#### Backend Endpoint
**File:** `backend/routes/issuer.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/issuer/insurance/issue-certificate` | Issue insurance certificate | Yes (API Key) |
| POST | `/api/issuer/hpg/issue-clearance` | Issue HPG clearance | Yes (API Key) |

#### Database Schema
**Table:** `issued_certificates`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Certificate ID |
| `issuer_id` | UUID | FOREIGN KEY → external_issuers.id | Issuer reference |
| `certificate_type` | VARCHAR(20) | NOT NULL | 'insurance', 'hpg_clearance', etc. |
| `certificate_number` | VARCHAR(100) | NOT NULL | Certificate number |
| `vehicle_vin` | VARCHAR(17) | NOT NULL | Vehicle VIN |
| `file_hash` | VARCHAR(64) | NOT NULL | SHA-256 hash |
| `composite_hash` | VARCHAR(64) | NOT NULL | Composite hash for verification |
| `issued_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Issue time |
| `expires_at` | TIMESTAMP | NULL | Expiration time |
| `blockchain_tx_id` | VARCHAR(255) | NULL | Blockchain transaction ID |
| `is_revoked` | BOOLEAN | DEFAULT false | Revocation status |
| `revoked_at` | TIMESTAMP | NULL | Revocation time |
| `revocation_reason` | TEXT | NULL | Revocation reason |

**Verification Checklist:**
- [ ] External issuer authenticates with API key
- [ ] Backend validates API key
- [ ] Backend creates issued_certificate record
- [ ] Backend stores certificate hash on blockchain
- [ ] Database stores certificate metadata

---

## 10. Public Features

### 10.1 Public Document Verification

#### Frontend Elements
**File:** `search.html`

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| VIN Search Input | `vinSearch` | Input | Search by VIN |
| Plate Search Input | `plateSearch` | Input | Search by plate |
| Transaction ID Input | `txIdSearch` | Input | Search by transaction ID |
| Search Button | `.btn-search` | Button | Execute search |
| Results Display | `.search-results` | Div | Display results |

#### Backend Endpoint
**File:** `backend/routes/certificates-public.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/certificates-public/search` | Public search | No |

**Query Parameters:**
- `vin` - Vehicle VIN
- `plate` - License plate
- `txId` - Transaction ID

**Response:**
```javascript
{
  success: true,
  vehicle: {
    vin: string,
    plateNumber: string,
    make: string,
    model: string,
    year: number,
    status: string,
    blockchainTxId: string
  },
  certificate: {
    orNumber: string,
    crNumber: string,
    issuedAt: timestamp
  }
}
```

**Verification Checklist:**
- [ ] Frontend allows public search
- [ ] Backend searches by VIN/plate/txId
- [ ] Backend returns public vehicle data
- [ ] Frontend displays verification results

---

## 11. Notifications & Communication

### 11.1 In-App Notifications

#### Frontend Elements
**File:** All dashboards

| Element | ID/Class | Type | Purpose |
|---------|----------|------|---------|
| Notification Bell | `.notification-bell` | Button | Open notifications |
| Notification Badge | `.notification-badge` | Span | Unread count |
| Notification Modal | `.notification-modal` | Modal | Notification list |
| Mark as Read Button | `.btn-mark-read` | Button | Mark notification read |

#### Backend Endpoint
**File:** `backend/routes/notifications.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/notifications` | Get user notifications | Yes (JWT) |
| PUT | `/api/notifications/:id/read` | Mark as read | Yes (JWT) |
| PUT | `/api/notifications/read-all` | Mark all as read | Yes (JWT) |

#### Database Schema
**Table:** `notifications`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY | Notification ID |
| `user_id` | UUID | FOREIGN KEY → users.id | User reference |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `message` | TEXT | NOT NULL | Notification message |
| `type` | VARCHAR(50) | DEFAULT 'info' | Notification type |
| `read` | BOOLEAN | DEFAULT false | Read status |
| `sent_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Send time |
| `read_at` | TIMESTAMP | NULL | Read time |

**Verification Checklist:**
- [ ] Frontend displays notification bell with badge
- [ ] Frontend loads notifications on page load
- [ ] Backend returns user notifications
- [ ] Frontend marks notifications as read
- [ ] Backend updates read status
- [ ] Database stores all notifications

---

## 12. System Monitoring & Health

### 12.1 Health Check

#### Frontend Elements
**N/A** - Backend endpoint only

#### Backend Endpoint
**File:** `backend/routes/health.js`

| Method | Endpoint | Handler | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/health` | Basic health check | No |
| GET | `/api/health/detailed` | Detailed health status | No |

**Response:**
```javascript
{
  status: 'healthy',
  timestamp: timestamp,
  services: {
    database: 'connected',
    blockchain: 'connected',
    ipfs: 'connected'
  }
}
```

**Verification Checklist:**
- [ ] Backend checks database connection
- [ ] Backend checks blockchain connection
- [ ] Backend checks IPFS connection
- [ ] Backend returns health status

---

## Verification Summary

### Overall Status

| Phase | Frontend | Backend | Database | Status |
|-------|----------|---------|----------|--------|
| 1. User Management | ✅ | ✅ | ✅ | Complete |
| 2. Vehicle Registration | ✅ | ✅ | ✅ | Complete |
| 3. Document Management | ✅ | ✅ | ✅ | Complete |
| 4. Transfer of Ownership | ✅ | ✅ | ✅ | Complete |
| 5. Verification Workflows | ⚠️ | ⚠️ | ⚠️ | ⚠️ **Emission Deprecated** |
| 6. Certificate Generation | ✅ | ✅ | ✅ | Complete |
| 7. Blockchain Integration | ✅ | ✅ | ✅ | Complete |
| 8. Admin Features | ✅ | ✅ | ✅ | Complete |
| 9. External Organizations | ✅ | ✅ | ✅ | Complete |
| 10. Public Features | ✅ | ✅ | ✅ | Complete |
| 11. Notifications | ✅ | ✅ | ✅ | Complete |
| 12. System Monitoring | ✅ | ✅ | ✅ | Complete |

**⚠️ Note on Phase 5:** Emission verification workflow has been **REMOVED**. See Section 5.2 for details. Database contains legacy emission columns that should be reviewed for cleanup.

### Critical Verification Points

1. **Field Name Mapping:** All frontend field IDs match backend expected field names
2. **ENUM Values:** All database ENUMs match backend constants
3. **Status Transitions:** All status changes are properly tracked
4. **Authentication:** All protected endpoints require proper authentication
5. **Authorization:** All role-based access controls are enforced
6. **Data Integrity:** All foreign keys and constraints are properly enforced
7. **Blockchain Integration:** All blockchain operations store transaction IDs
8. **Document Storage:** All documents are properly stored and linked
9. **Notifications:** All important actions trigger notifications
10. **Audit Trail:** All actions are logged in vehicle_history

### ⚠️ Known Issues & Inconsistencies

1. **Emission Verification:** 
   - ❌ **REMOVED** - Backend route file `emission.js` does not exist
   - ⚠️ **LEGACY** - Database contains emission columns in `transfer_requests` and `vehicles` tables
   - ⚠️ **LEGACY** - `emission_verifier` role exists in database but workflow removed
   - See `TRACE_VERIFICATION_ERRORS.md` for full details

---

## Next Steps

1. Execute verification queries on database
2. Test each API endpoint with proper authentication
3. Verify frontend elements load and function correctly
4. Check all status transitions work end-to-end
5. Validate document upload/download flows
6. Test blockchain integration
7. Verify certificate generation
8. Test transfer workflow completely
9. Validate all role-based access controls
10. Check notification delivery

---

**Document Status:** Initial Draft - Requires Field-by-Field Verification
**Last Updated:** 2026-01-XX
**Next Review:** After database verification queries executed
