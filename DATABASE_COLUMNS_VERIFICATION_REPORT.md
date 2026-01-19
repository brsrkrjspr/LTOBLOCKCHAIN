# Database Columns Verification Report

## Summary
This document verifies all columns and tables required by Insurance, Emission, and HPG verification workflows.

## Tables and Columns Required

### 1. `clearance_requests` Table
**Status**: ✅ ALL COLUMNS EXIST

**Required Columns**:
- ✅ `id` (UUID, PRIMARY KEY)
- ✅ `vehicle_id` (UUID, FOREIGN KEY)
- ✅ `request_type` (VARCHAR(20)) - 'hpg', 'insurance', 'emission'
- ✅ `status` (VARCHAR(20)) - 'PENDING', 'SENT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED'
- ✅ `requested_by` (UUID, FOREIGN KEY)
- ✅ `requested_at` (TIMESTAMP)
- ✅ `assigned_to` (UUID, FOREIGN KEY, nullable)
- ✅ `completed_at` (TIMESTAMP, nullable) - **Used when status is APPROVED/REJECTED/COMPLETED**
- ✅ `certificate_id` (UUID, nullable)
- ✅ `purpose` (VARCHAR(255), nullable)
- ✅ `notes` (TEXT, nullable)
- ✅ `metadata` (JSONB, DEFAULT '{}') - **Stores auto-verification results**
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)

**Metadata Structure** (stored in JSONB):
```json
{
  "autoVerified": true,
  "autoVerificationResult": {
    "automated": true,
    "status": "APPROVED",
    "score": 95,
    "confidence": 0.95,
    "basis": {...},
    "ocrData": {...},
    "patternCheck": {...},
    "hashCheck": {...},
    "compositeHash": "...",
    "blockchainTxId": "..."
  },
  "verifiedBy": "system" | "user-uuid",
  "verifiedAt": "2024-01-19T00:00:00.000Z",
  "documents": [...],
  "extractedData": {...},
  "hpgDatabaseCheck": {...},
  "engineNumber": "...",
  "chassisNumber": "...",
  "macroEtching": false,
  "photos": [],
  "stencil": null,
  "remarks": "...",
  "testResult": {...}
}
```

### 2. `vehicle_verifications` Table
**Status**: ⚠️ NEEDS VERIFICATION - Auto-verification columns may be missing

**Base Columns** (from init-laptop.sql):
- ✅ `id` (UUID, PRIMARY KEY)
- ✅ `vehicle_id` (UUID, FOREIGN KEY)
- ✅ `verification_type` (VARCHAR(20)) - 'insurance', 'emission', 'hpg'
- ✅ `status` (verification_status ENUM) - 'PENDING', 'APPROVED', 'REJECTED'
- ✅ `verified_by` (UUID, FOREIGN KEY, nullable)
- ✅ `verified_at` (TIMESTAMP, nullable)
- ✅ `notes` (TEXT, nullable)
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)
- ✅ `clearance_request_id` (UUID, FOREIGN KEY, nullable) - Added by add-clearance-workflow.sql

**Auto-Verification Columns** (from add-auto-verification-metadata.sql):
- ⚠️ `automated` (BOOLEAN, DEFAULT false) - **REQUIRED for auto-verification**
- ⚠️ `verification_score` (INTEGER, nullable) - **REQUIRED for auto-verification**
- ⚠️ `verification_metadata` (JSONB, DEFAULT '{}') - **REQUIRED for auto-verification**
- ⚠️ `auto_verified_at` (TIMESTAMP, nullable) - **REQUIRED for auto-verification**

**Usage**:
- `updateVerificationStatus()` tries to set these columns when `metadata.automated === true`
- Auto-verification service passes: `{ automated: true, verificationScore: 95, verificationMetadata: {...} }`

### 3. `transfer_requests` Table
**Status**: ✅ ALL COLUMNS EXIST (from add-multi-org-approval.sql)

**Required Columns for Approval**:
- ✅ `id` (UUID, PRIMARY KEY)
- ✅ `vehicle_id` (UUID, FOREIGN KEY)
- ✅ `seller_id` (UUID, FOREIGN KEY)
- ✅ `buyer_id` (UUID, FOREIGN KEY, nullable)
- ✅ `status` (VARCHAR(20))
- ✅ `hpg_clearance_request_id` (UUID, FOREIGN KEY, nullable)
- ✅ `insurance_clearance_request_id` (UUID, FOREIGN KEY, nullable) - **Used by Insurance approve**
- ✅ `emission_clearance_request_id` (UUID, FOREIGN KEY, nullable) - **Used by Emission approve**
- ✅ `hpg_approval_status` (VARCHAR(20), DEFAULT 'PENDING') - **Used by HPG approve**
- ✅ `insurance_approval_status` (VARCHAR(20), DEFAULT 'PENDING') - **Used by Insurance approve**
- ✅ `emission_approval_status` (VARCHAR(20), DEFAULT 'PENDING') - **Used by Emission approve**
- ✅ `hpg_approved_at` (TIMESTAMP, nullable)
- ✅ `insurance_approved_at` (TIMESTAMP, nullable)
- ✅ `emission_approved_at` (TIMESTAMP, nullable)
- ✅ `hpg_approved_by` (UUID, FOREIGN KEY, nullable)
- ✅ `insurance_approved_by` (UUID, FOREIGN KEY, nullable)
- ✅ `emission_approved_by` (UUID, FOREIGN KEY, nullable)

## Column Usage by Workflow

### Insurance Approval Workflow

**When Approve Button Clicked** (Manual):
1. `updateClearanceRequestStatus(requestId, 'APPROVED', { verifiedBy, verifiedAt, notes })`
   - Updates: `status`, `completed_at`, `metadata` (adds verifiedBy, verifiedAt, notes)
2. `updateVerificationStatus(vehicleId, 'insurance', 'APPROVED', userId, notes)`
   - Updates: `status`, `verified_by`, `verified_at`, `notes`
   - **Does NOT set automated columns** (manual approval)
3. Updates `transfer_requests` if linked:
   - `insurance_approval_status = 'APPROVED'`
   - `insurance_approved_at = CURRENT_TIMESTAMP`
   - `insurance_approved_by = userId`

**When Auto-Verification Approves** (Automatic):
1. `updateClearanceRequestStatus(requestId, 'APPROVED', { verifiedBy: 'system', verifiedAt, notes, autoVerified: true, autoVerificationResult })`
   - Updates: `status`, `completed_at`, `metadata` (adds auto-verification data)
2. `updateVerificationStatus(vehicleId, 'insurance', 'APPROVED', 'system', notes, { automated: true, verificationScore, verificationMetadata })`
   - Updates: `status`, `verified_by = 'system'`, `verified_at`, `notes`
   - **Sets**: `automated = true`, `verification_score`, `verification_metadata`, `auto_verified_at`
3. **Does NOT update transfer_requests** (auto-verification doesn't handle transfers)

### Emission Approval Workflow

**When Approve Button Clicked** (Manual):
1. `updateClearanceRequestStatus(requestId, 'APPROVED', { verifiedBy, verifiedAt, notes, testResult })`
   - Updates: `status`, `completed_at`, `metadata` (adds verifiedBy, verifiedAt, notes, testResult)
2. `updateVerificationStatus(vehicleId, 'emission', 'APPROVED', userId, notes)`
   - Updates: `status`, `verified_by`, `verified_at`, `notes`
   - **Does NOT set automated columns** (manual approval)
3. Updates `transfer_requests` if linked:
   - `emission_approval_status = 'APPROVED'`
   - `emission_approved_at = CURRENT_TIMESTAMP`
   - `emission_approved_by = userId`

**When Auto-Verification Approves** (Automatic):
1. `updateClearanceRequestStatus(requestId, 'APPROVED', { verifiedBy: 'system', verifiedAt, notes, autoVerified: true, autoVerificationResult })`
   - Updates: `status`, `completed_at`, `metadata` (adds auto-verification data)
2. `updateVerificationStatus(vehicleId, 'emission', 'APPROVED', 'system', notes, { automated: true, verificationScore, verificationMetadata })`
   - Updates: `status`, `verified_by = 'system'`, `verified_at`, `notes`
   - **Sets**: `automated = true`, `verification_score`, `verification_metadata`, `auto_verified_at`
3. **Does NOT update transfer_requests** (auto-verification doesn't handle transfers)

### HPG Approval Workflow

**When Approve Button Clicked** (Manual - Always Required):
1. `updateClearanceRequestStatus(requestId, 'APPROVED', { engineNumber, chassisNumber, macroEtching, photos, stencil, remarks, verifiedBy, verifiedAt })`
   - Updates: `status`, `completed_at`, `metadata` (adds inspection data)
2. `updateVerificationStatus(vehicleId, 'hpg', 'APPROVED', userId, remarks)`
   - Updates: `status`, `verified_by`, `verified_at`, `notes`
   - **Does NOT set automated columns** (HPG always requires manual)
3. Updates `transfer_requests` if linked:
   - `hpg_approval_status = 'APPROVED'`
   - `hpg_approved_at = CURRENT_TIMESTAMP`
   - `hpg_approved_by = userId`

**Auto-Verify** (Pre-fills data only):
- Stores results in `clearance_requests.metadata.autoVerify`
- Does NOT call `updateVerificationStatus`
- Does NOT set `automated` columns in `vehicle_verifications`
- Final approval still requires manual action

## Potential Issues

### Issue 1: Missing Auto-Verification Columns
**Risk**: If `vehicle_verifications` table doesn't have `automated`, `verification_score`, `verification_metadata`, `auto_verified_at` columns:
- Auto-verification will fail when calling `updateVerificationStatus()`
- Error: "column 'automated' does not exist"

**Solution**: Run migration `database/add-auto-verification-metadata.sql`

### Issue 2: Missing Transfer Request Columns
**Risk**: If `transfer_requests` table doesn't have approval status columns:
- Insurance/Emission/HPG approve endpoints will fail when updating transfer requests
- Error: "column 'insurance_approval_status' does not exist"

**Solution**: Run migration `database/add-multi-org-approval.sql`

### Issue 3: Missing completed_at Column
**Risk**: If `clearance_requests` table doesn't have `completed_at` column:
- `updateClearanceRequestStatus()` has fallback logic, but will log warnings
- Status updates will work, but completion timestamp won't be recorded

**Solution**: Column should exist from `add-clearance-workflow.sql`

## Verification Commands

```sql
-- Check vehicle_verifications columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'vehicle_verifications'
ORDER BY ordinal_position;

-- Check for auto-verification columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vehicle_verifications'
AND column_name IN ('automated', 'verification_score', 'verification_metadata', 'auto_verified_at');

-- Check transfer_requests approval columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transfer_requests'
AND column_name LIKE '%approval%';

-- Check clearance_requests columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'clearance_requests'
ORDER BY ordinal_position;
```

## Required Migrations

1. ✅ `database/add-clearance-workflow.sql` - Creates clearance_requests table
2. ⚠️ `database/add-auto-verification-metadata.sql` - Adds auto-verification columns to vehicle_verifications
3. ✅ `database/add-multi-org-approval.sql` - Adds approval status columns to transfer_requests
4. ✅ `database/add-transfer-ownership.sql` - Creates transfer_requests table
