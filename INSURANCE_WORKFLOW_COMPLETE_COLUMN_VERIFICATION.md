# Insurance Workflow - Complete Column Verification

## Summary
This document verifies ALL tables and columns used by the Insurance verification workflow, including:
- API endpoints
- Database service functions
- Auto-verification service
- Clearance service
- Test request creation

## Tables Used by Insurance Workflow

### 1. `clearance_requests` ✅ VERIFIED
**Used in**: All insurance endpoints

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `vehicle_id` (UUID) - Foreign key to vehicles
- ✅ `request_type` (VARCHAR) - Must be 'insurance'
- ✅ `status` (VARCHAR) - 'PENDING', 'SENT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED'
- ✅ `requested_by` (UUID) - Foreign key to users
- ✅ `requested_at` (TIMESTAMP)
- ✅ `assigned_to` (UUID, nullable) - Foreign key to users
- ✅ `completed_at` (TIMESTAMP, nullable) - **Used in stats queries**
- ✅ `purpose` (VARCHAR, nullable)
- ✅ `notes` (TEXT, nullable)
- ✅ `metadata` (JSONB) - **Stores documents, auto-verification results**
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)

**Queries**:
```sql
-- Stats endpoint
SELECT COUNT(*) FROM clearance_requests 
WHERE request_type = 'insurance' 
AND (status = 'PENDING' OR status = 'SENT' OR status = 'IN_PROGRESS')

SELECT COUNT(*) FROM clearance_requests 
WHERE request_type = 'insurance' 
AND status = 'COMPLETED' 
AND completed_at >= $1

-- Approve/Reject
UPDATE clearance_requests SET status = 'APPROVED', completed_at = CURRENT_TIMESTAMP, metadata = ...
WHERE id = $1
```

### 2. `vehicles` ✅ VERIFIED (with one issue)
**Used in**: Get request details, approve/reject, test request creation

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `vin` (VARCHAR) - Vehicle identification number
- ✅ `plate_number` (VARCHAR) - License plate
- ✅ `make` (VARCHAR) - Manufacturer
- ✅ `model` (VARCHAR) - Model
- ✅ `year` (INTEGER) - Year
- ✅ `color` (VARCHAR, nullable)
- ✅ `engine_number` (VARCHAR, nullable)
- ✅ `chassis_number` (VARCHAR, nullable)
- ✅ `vehicle_type` (VARCHAR) - Vehicle type
- ✅ `owner_id` (UUID, nullable) - **Foreign key to users** - Current owner
- ✅ `status` (vehicle_status ENUM) - Registration status
- ✅ `registration_date` (TIMESTAMP, nullable)
- ✅ `last_updated` (TIMESTAMP)

**⚠️ ISSUE FOUND**: Test request creation uses `current_owner_id` but column is `owner_id`
- **File**: `backend/routes/insurance.js:377`
- **Line**: `INSERT INTO vehicles (..., current_owner_id)`
- **Should be**: `INSERT INTO vehicles (..., owner_id)`

**Queries**:
```sql
-- Get vehicle with owner
SELECT v.*, u.id as owner_id, u.first_name, u.last_name, u.email, u.phone, u.address, u.organization
FROM vehicles v
LEFT JOIN users u ON v.owner_id = u.id
WHERE v.id = $1
```

### 3. `users` ✅ VERIFIED
**Used in**: Get owner info, get admin for notifications, approve/reject user tracking

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `email` (VARCHAR) - User email
- ✅ `first_name` (VARCHAR) - First name
- ✅ `last_name` (VARCHAR) - Last name
- ✅ `phone` (VARCHAR, nullable) - Phone number
- ✅ `address` (VARCHAR/TEXT, nullable) - Address
- ✅ `organization` (VARCHAR, nullable) - Organization
- ✅ `role` (user_role ENUM) - User role ('admin', 'insurance_verifier', etc.)
- ✅ `is_active` (BOOLEAN) - Account status

**Queries**:
```sql
-- Get user by ID
SELECT id, email, first_name, last_name, role, organization, phone, address, is_active, email_verified, created_at
FROM users WHERE id = $1

-- Get admin for notifications
SELECT id FROM users WHERE role = 'admin' LIMIT 1
```

### 4. `vehicle_verifications` ✅ VERIFIED
**Used in**: Approve/reject endpoints, auto-verification

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `vehicle_id` (UUID) - Foreign key to vehicles
- ✅ `verification_type` (VARCHAR) - Must be 'insurance'
- ✅ `status` (verification_status ENUM) - 'PENDING', 'APPROVED', 'REJECTED'
- ✅ `verified_by` (UUID, nullable) - Foreign key to users (or 'system' for auto)
- ✅ `verified_at` (TIMESTAMP, nullable) - Verification timestamp
- ✅ `notes` (TEXT, nullable) - Verification notes
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)
- ✅ `clearance_request_id` (UUID, nullable) - Foreign key to clearance_requests

**Auto-Verification Columns** (optional, gracefully handled):
- ✅ `automated` (BOOLEAN) - Auto-verification flag
- ✅ `verification_score` (INTEGER) - Verification score (0-100)
- ✅ `verification_metadata` (JSONB) - Detailed verification data
- ✅ `auto_verified_at` (TIMESTAMP) - Auto-verification timestamp

**Queries**:
```sql
-- Check if verification exists
SELECT id FROM vehicle_verifications 
WHERE vehicle_id = $1 AND verification_type = 'insurance'

-- Update existing
UPDATE vehicle_verifications 
SET status = $1, verified_by = $2, verified_at = CURRENT_TIMESTAMP, notes = $3, updated_at = CURRENT_TIMESTAMP
WHERE vehicle_id = $4 AND verification_type = $5

-- Insert new
INSERT INTO vehicle_verifications (vehicle_id, verification_type, status, verified_by, notes, ...)
VALUES ($1, 'insurance', $2, $3, $4, ...)
```

### 5. `transfer_requests` ✅ VERIFIED
**Used in**: Approve/reject endpoints (if clearance request is linked to transfer)

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `vehicle_id` (UUID) - Foreign key to vehicles
- ✅ `insurance_clearance_request_id` (UUID, nullable) - **Foreign key to clearance_requests**
- ✅ `insurance_approval_status` (VARCHAR) - 'PENDING', 'APPROVED', 'REJECTED'
- ✅ `insurance_approved_at` (TIMESTAMP, nullable) - Approval timestamp
- ✅ `insurance_approved_by` (UUID, nullable) - Foreign key to users
- ✅ `updated_at` (TIMESTAMP) - Last update timestamp

**Queries**:
```sql
-- Find linked transfer requests
SELECT id FROM transfer_requests 
WHERE insurance_clearance_request_id = $1

-- Update approval status
UPDATE transfer_requests 
SET insurance_approval_status = 'APPROVED',
    insurance_approved_at = CURRENT_TIMESTAMP,
    insurance_approved_by = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $2
```

### 6. `vehicle_history` ✅ VERIFIED
**Used in**: Approve/reject endpoints, auto-verification

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `vehicle_id` (UUID) - Foreign key to vehicles
- ✅ `action` (VARCHAR) - Action type ('INSURANCE_VERIFICATION_APPROVED', 'INSURANCE_VERIFICATION_REJECTED', 'TRANSFER_INSURANCE_APPROVED', 'TRANSFER_INSURANCE_REJECTED')
- ✅ `description` (TEXT) - Action description
- ✅ `performed_by` (UUID) - Foreign key to users
- ✅ `performed_at` (TIMESTAMP) - Action timestamp
- ✅ `transaction_id` (VARCHAR, nullable) - Blockchain transaction ID
- ✅ `metadata` (JSONB, nullable) - Additional metadata

**Queries**:
```sql
-- Add history record
INSERT INTO vehicle_history (vehicle_id, action, description, performed_by, metadata)
VALUES ($1, 'INSURANCE_VERIFICATION_APPROVED', $2, $3, $4)
```

### 7. `notifications` ✅ VERIFIED
**Used in**: Approve/reject endpoints (notify LTO admin)

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `user_id` (UUID) - Foreign key to users (recipient)
- ✅ `title` (VARCHAR) - Notification title
- ✅ `message` (TEXT) - Notification message
- ✅ `type` (VARCHAR) - Notification type ('success', 'warning', 'info')
- ✅ `read` (BOOLEAN) - Read status
- ✅ `sent_at` (TIMESTAMP) - Sent timestamp
- ✅ `read_at` (TIMESTAMP, nullable) - Read timestamp

**Queries**:
```sql
-- Create notification
INSERT INTO notifications (user_id, title, message, type)
VALUES ($1, 'Insurance Verification Approved', $2, 'success')
```

### 8. `documents` ✅ VERIFIED (indirectly)
**Used in**: Auto-verification service, clearance service

**Columns Used**:
- ✅ `id` (UUID) - Primary key
- ✅ `vehicle_id` (UUID) - Foreign key to vehicles
- ✅ `document_type` (document_type ENUM) - Document type
- ✅ `filename` (VARCHAR) - File name
- ✅ `original_name` (VARCHAR) - Original file name
- ✅ `file_path` (VARCHAR) - File storage path
- ✅ `file_size` (BIGINT) - File size
- ✅ `mime_type` (VARCHAR) - MIME type
- ✅ `file_hash` (VARCHAR) - File hash
- ✅ `uploaded_by` (UUID) - Foreign key to users
- ✅ `uploaded_at` (TIMESTAMP) - Upload timestamp

**Note**: Documents are accessed via `clearance_requests.metadata.documents` array, not directly queried in insurance routes.

## Issues Found

### ⚠️ Issue 1: Wrong Column Name in Test Request
**File**: `backend/routes/insurance.js`
**Line**: 377
**Problem**: Uses `current_owner_id` but column is `owner_id`
**Impact**: Test request creation will fail
**Fix Required**: Change `current_owner_id` to `owner_id`

### ✅ Issue 2: All Other Columns Verified
All other columns used by the insurance workflow exist and are correctly referenced.

## Verification Summary

| Table | Status | Columns Verified | Issues |
|-------|--------|------------------|--------|
| `clearance_requests` | ✅ | All 13 columns | None |
| `vehicles` | ⚠️ | All columns exist | Wrong column name in test request |
| `users` | ✅ | All columns | None |
| `vehicle_verifications` | ✅ | All columns (including auto-verification) | None |
| `transfer_requests` | ✅ | All approval columns | None |
| `vehicle_history` | ✅ | All columns | None |
| `notifications` | ✅ | All columns | None |
| `documents` | ✅ | All columns (indirect use) | None |

## Required Fix

### Fix Test Request Column Name
**File**: `backend/routes/insurance.js`
**Line**: 377

**Change**:
```javascript
// BEFORE (WRONG)
INSERT INTO vehicles (id, vin, plate_number, engine_number, make, model, year, vehicle_type, status, current_owner_id)

// AFTER (CORRECT)
INSERT INTO vehicles (id, vin, plate_number, engine_number, make, model, year, vehicle_type, status, owner_id)
```

## Verification Commands

```sql
-- Verify all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'clearance_requests', 'vehicles', 'users', 'vehicle_verifications', 
    'transfer_requests', 'vehicle_history', 'notifications', 'documents'
);

-- Verify clearance_requests columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clearance_requests' 
ORDER BY ordinal_position;

-- Verify vehicles columns (check for owner_id)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('id', 'vin', 'plate_number', 'owner_id', 'status')
ORDER BY column_name;

-- Verify vehicle_verifications auto-verification columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicle_verifications' 
AND column_name IN ('automated', 'verification_score', 'verification_metadata', 'auto_verified_at');
```

## Conclusion

✅ **All tables and columns exist** (except one bug in test request)
⚠️ **One fix required**: Change `current_owner_id` to `owner_id` in test request creation
