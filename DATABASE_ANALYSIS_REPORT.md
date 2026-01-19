# Database Analysis Report
**Generated:** 2026-01-19  
**Database:** lto_blockchain  
**Total Tables:** 20 tables + 3 views

## Executive Summary

The database inspection reveals several critical issues preventing the vehicle registration workflow from completing:

1. **All 7 vehicles are stuck in `PENDING_BLOCKCHAIN` status** - Blockchain transactions may not be completing
2. **No certificates have been issued** - Certificate generation workflow is not executing
3. **41 documents exist but none are verified** - Document verification workflow is incomplete
4. **HPG auto-verification returning 0% confidence** - Likely due to missing file hashes or authenticity check failures
5. **Clearance requests pending** - 7 HPG requests pending, 4 insurance requests pending

---

## 1. Database Structure Overview

### Tables Summary
- **20 base tables** + **3 views**
- **138 indexes** across all tables
- **47 foreign key constraints**
- **8 triggers** for automated updates
- **3 PostgreSQL extensions**: uuid-ossp, pg_trgm, plpgsql

### Key Tables & Row Counts

| Table | Rows | Inserts | Updates | Status |
|-------|------|---------|---------|--------|
| `users` | 10 | 10 | 148 | ✅ Active |
| `vehicles` | 7 | 7 | 7 | ⚠️ All PENDING_BLOCKCHAIN |
| `documents` | 41 | 41 | 29 | ⚠️ 0 verified |
| `clearance_requests` | 14 | 14 | 41 | ⚠️ Mixed statuses |
| `vehicle_verifications` | 14 | 14 | 2 | ⚠️ Low activity |
| `vehicle_history` | 58 | 58 | 0 | ✅ Active |
| `certificates` | 0 | 0 | 0 | ❌ Empty |
| `issued_certificates` | 19 | 19 | 0 | ✅ Has data |
| `transfer_requests` | 0 | 0 | 0 | ✅ Empty (expected) |
| `sessions` | 117 | 136 | 202 | ✅ Active |
| `refresh_tokens` | 120 | 139 | 0 | ✅ Active |

---

## 2. Critical Issues Identified

### Issue #1: Vehicles Stuck in PENDING_BLOCKCHAIN Status

**Problem:**
- All 7 vehicles have status `PENDING_BLOCKCHAIN`
- Expected flow: `SUBMITTED` → `PENDING_BLOCKCHAIN` → (poll blockchain) → `SUBMITTED` → (admin approval) → `REGISTERED`
- Vehicles are not progressing past blockchain registration

**Root Cause Analysis:**
Based on code analysis (`backend/routes/vehicles.js:1323-1376`):
1. Vehicle registration sets status to `PENDING_BLOCKCHAIN` before blockchain submission
2. Code polls for transaction status: `await fabricService.getTransactionStatus(blockchainTxId, vehicle.vin)`
3. If transaction is `committed`, status should change to `SUBMITTED`
4. If transaction is `pending`, status remains `PENDING_BLOCKCHAIN`

**Possible Causes:**
- Blockchain transactions are not committing (network issues, chaincode errors)
- Transaction polling is failing silently
- Fabric service connection is lost
- Transaction IDs are not being stored correctly

**Evidence from History:**
```
BLOCKCHAIN_PENDING: 7 records
REGISTERED: 7 records
```
- History shows vehicles were registered, but status never updated

**Recommendation:**
1. Check blockchain transaction status for all 7 vehicles
2. Verify Fabric network connectivity
3. Review transaction polling logic for error handling
4. Consider manual status update script if transactions are committed

---

### Issue #2: HPG Auto-Verification Returning 0% Confidence

**Problem:**
- 21 `HPG_AUTO_VERIFY` actions in vehicle_history
- All showing "Confidence: 0%. Recommendation: MANUAL_REVIEW"
- Auto-verification is not providing useful pre-fill data

**Root Cause Analysis:**
Based on code analysis (`backend/services/autoVerificationService.js:606-1031`):

**Confidence Score Breakdown:**
- Certificate Authenticity: 30 points (blockchain-based)
- Data Extraction: 30 points (OCR engine/chassis numbers)
- Hash Uniqueness: 20 points
- Document Completeness: 15 points
- Data Match: 5 points

**Why 0% Confidence:**
1. **Missing File Hash** (lines 687-695):
   - If `fileHash` is missing, returns immediately with 0% confidence
   - Error: "File hash missing for HPG document. Cannot verify issuer authenticity automatically."

2. **Certificate Authenticity Check Failing** (lines 712-733):
   - `certificateBlockchain.checkCertificateAuthenticity()` may be returning `authentic: false`
   - If no original certificate found, only 15 points awarded (partial)

3. **OCR Extraction Failing** (lines 652-665):
   - OCR may not be extracting engine/chassis numbers
   - If extraction fails, `dataExtraction` score = 0

4. **Document Not Found** (lines 633-640):
   - If HPG clearance document not found, returns 0% confidence

**Evidence from Database:**
- Documents exist: 7 `hpg_clearance` documents
- But `verified = false` for all documents
- File hashes may not be stored correctly

**Recommendation:**
1. Check if documents have `file_hash` populated
2. Verify OCR service is working correctly
3. Check certificate authenticity service connectivity
4. Review document type mapping (should be `hpg_clearance`)

---

### Issue #3: No Certificates Issued

**Problem:**
- `certificates` table is empty (0 rows)
- `issued_certificates` table has 19 rows (external issuers)
- Certificate generation workflow is not executing

**Expected Flow:**
1. All verifications approved (Insurance, Emission, HPG)
2. Admin approves clearance via `/api/lto/approve-clearance`
3. Certificate generation triggered
4. Certificate stored in `certificates` table

**Root Cause Analysis:**
Based on code analysis (`backend/routes/lto.js:369-655`):
- Certificate generation happens in `approve-clearance` endpoint
- Requires all verifications to be `APPROVED`
- Requires blockchain transaction to succeed

**Current State:**
- 3 insurance clearance requests: `APPROVED`
- 1 HPG clearance request: `SENT` (not approved)
- 7 HPG clearance requests: `PENDING`
- 4 insurance clearance requests: `PENDING`

**Recommendation:**
1. Verify clearance approval workflow is completing
2. Check if certificate generation endpoint is being called
3. Review certificate generation service for errors
4. Ensure all verifications are approved before certificate generation

---

### Issue #4: Documents Not Verified

**Problem:**
- 41 documents exist
- 0 documents have `verified = true`
- Document verification workflow is not executing

**Document Breakdown:**
- `owner_id`: 10 documents (0 verified)
- `insurance_cert`: 10 documents (0 verified)
- `hpg_clearance`: 7 documents (0 verified)
- `csr`: 7 documents (0 verified)
- `sales_invoice`: 7 documents (0 verified)

**Expected Flow:**
1. Documents uploaded during registration
2. Auto-verification runs (Insurance/Emission)
3. Manual verification for HPG
4. Documents marked as `verified = true` when approved

**Root Cause:**
- Auto-verification may be failing (see Issue #2)
- Manual verification may not be updating document status
- Document verification status update logic may be missing

**Recommendation:**
1. Review document verification status update logic
2. Ensure `verified` flag is set when clearance requests are approved
3. Check if document verification is tied to clearance approval

---

## 3. Clearance Requests Analysis

### Status Breakdown

**HPG Clearance Requests:**
- `PENDING`: 6 requests
- `SENT`: 1 request
- `APPROVED`: 0 requests

**Insurance Clearance Requests:**
- `PENDING`: 4 requests
- `APPROVED`: 3 requests

**Emission Clearance Requests:**
- None found (expected for NEW registrations)

### Issues:
1. **HPG requests not progressing**: 6 pending, 1 sent, 0 approved
2. **Insurance requests partially approved**: 3 approved, 4 pending
3. **No HPG approvals**: HPG workflow may be stuck

---

## 4. User Activity Analysis

### User Distribution
- **vehicle_owner**: 4 users
- **staff**: 2 users
- **hpg_admin**: 1 user
- **emission_verifier**: 1 user
- **admin**: 1 user
- **insurance_verifier**: 1 user

### Active Sessions
- **hpgadmin@hpg.gov.ph**: 40 active sessions (most active)
- **latagjoshuaivan@gmail.com**: 17 sessions
- **admin@lto.gov.ph**: 15 sessions
- **dullajasperdave@gmail.com**: 13 sessions
- **emission@lto.gov.ph**: 11 sessions
- **insurance@lto.gov.ph**: 10 sessions

**Observation:** HPG admin has many sessions, suggesting active use but workflow may be stuck.

---

## 5. Vehicle History Analysis

### Action Types (58 total records)

| Action | Count | Description |
|--------|-------|-------------|
| `HPG_AUTO_VERIFY` | 21 | Auto-verification attempts (all 0% confidence) |
| `REGISTERED` | 7 | Vehicle registration submitted |
| `HPG_AUTOMATION_PHASE1` | 7 | HPG Phase 1 automation completed |
| `BLOCKCHAIN_PENDING` | 7 | Blockchain registration pending |
| `HPG_CLEARANCE_REQUESTED` | 7 | HPG clearance automatically requested |
| `INSURANCE_VERIFICATION_REQUESTED` | 7 | Insurance verification automatically requested |
| `INSURANCE_VERIFICATION_APPROVED` | 1 | Insurance verification approved |
| `HPG_VERIFICATION_APPROVED` | 1 | HPG verification approved |

**Key Observations:**
- Many auto-verification attempts but low success rate
- Only 1 insurance and 1 HPG verification approved
- Blockchain transactions pending for all vehicles

---

## 6. Database Health Metrics

### Indexes
- **138 indexes** total
- **Most indexed tables:**
  - `issued_certificates`: 18 indexes
  - `certificates`: 15 indexes
  - `certificate_submissions`: 11 indexes
  - `vehicles`: 11 indexes

### Foreign Keys
- **47 foreign key constraints** properly configured
- All relationships validated

### Triggers
- **8 triggers** for automated updates:
  - `update_updated_at_column` (users, vehicles, vehicle_verifications)
  - `update_clearance_requests_updated_at`
  - `update_transfer_requests_updated_at`
  - `update_certificate_application_status`
  - `auto_cleanup_old_tokens`
  - `verify_certificate_submission`

---

## 7. Recommendations

### Immediate Actions

1. **Fix PENDING_BLOCKCHAIN Status**
   ```sql
   -- Check blockchain transaction status for all vehicles
   SELECT v.vin, v.status, vh.transaction_id, vh.action, vh.description
   FROM vehicles v
   LEFT JOIN vehicle_history vh ON v.id = vh.vehicle_id 
     AND vh.action = 'BLOCKCHAIN_PENDING'
   WHERE v.status = 'PENDING_BLOCKCHAIN';
   ```

2. **Investigate HPG Auto-Verification**
   ```sql
   -- Check document file hashes
   SELECT id, document_type, filename, file_hash, verified
   FROM documents
   WHERE document_type = 'hpg_clearance';
   ```

3. **Review Clearance Request Workflow**
   ```sql
   -- Check clearance request statuses
   SELECT request_type, status, COUNT(*) as count
   FROM clearance_requests
   GROUP BY request_type, status
   ORDER BY request_type, status;
   ```

### Long-term Fixes

1. **Improve Error Handling**
   - Add better error logging for blockchain transactions
   - Add retry logic for failed blockchain operations
   - Add monitoring for stuck workflows

2. **Fix Document Verification**
   - Ensure documents are marked verified when clearance approved
   - Add verification status sync between clearance and documents

3. **Improve Auto-Verification**
   - Fix file hash storage
   - Improve OCR extraction reliability
   - Add fallback mechanisms for authenticity checks

4. **Certificate Generation**
   - Ensure certificate generation triggers after all approvals
   - Add certificate generation status tracking
   - Add retry logic for failed certificate generation

---

## 8. Database Schema Validation

### ✅ Verified Tables
- All core tables exist and have correct structure
- Foreign keys properly configured
- Indexes optimized for queries
- Triggers functioning correctly

### ⚠️ Missing/Incomplete Data
- No certificates issued (workflow incomplete)
- Documents not verified (verification workflow incomplete)
- Vehicles stuck in PENDING_BLOCKCHAIN (blockchain workflow incomplete)

---

## 9. Next Steps

1. **Immediate**: Investigate blockchain transaction status for all 7 vehicles
2. **Short-term**: Fix HPG auto-verification file hash issue
3. **Short-term**: Review and fix document verification status updates
4. **Medium-term**: Improve error handling and monitoring
5. **Long-term**: Add comprehensive workflow monitoring and alerting

---

## Appendix: Key Queries for Investigation

### Check Vehicle Blockchain Status
```sql
SELECT 
    v.vin,
    v.plate_number,
    v.status,
    vh.transaction_id,
    vh.action,
    vh.performed_at
FROM vehicles v
LEFT JOIN vehicle_history vh ON v.id = vh.vehicle_id 
    AND vh.action IN ('BLOCKCHAIN_PENDING', 'BLOCKCHAIN_REGISTERED')
WHERE v.status = 'PENDING_BLOCKCHAIN'
ORDER BY vh.performed_at DESC;
```

### Check Document Verification Status
```sql
SELECT 
    d.document_type,
    COUNT(*) as total,
    COUNT(CASE WHEN d.verified = true THEN 1 END) as verified_count,
    COUNT(CASE WHEN d.file_hash IS NULL THEN 1 END) as missing_hash
FROM documents d
GROUP BY d.document_type
ORDER BY d.document_type;
```

### Check Clearance Request Status
```sql
SELECT 
    cr.request_type,
    cr.status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (NOW() - cr.requested_at))/3600) as avg_hours_pending
FROM clearance_requests cr
GROUP BY cr.request_type, cr.status
ORDER BY cr.request_type, cr.status;
```

### Check HPG Auto-Verification Results
```sql
SELECT 
    vh.vehicle_id,
    v.vin,
    vh.action,
    vh.description,
    vh.performed_at,
    vh.metadata->>'confidence' as confidence,
    vh.metadata->>'recommendation' as recommendation
FROM vehicle_history vh
JOIN vehicles v ON vh.vehicle_id = v.id
WHERE vh.action = 'HPG_AUTO_VERIFY'
ORDER BY vh.performed_at DESC
LIMIT 10;
```
