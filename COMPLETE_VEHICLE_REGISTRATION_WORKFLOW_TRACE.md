# Vehicle Registration Workflow - Complete End-to-End Trace

**Date:** 2026-01-23  
**Purpose:** Comprehensive audit of vehicle registration workflow from frontend submission through backend processing, document linking, clearance requests, and auto-verification.

---

## Executive Summary

This trace identifies **5 critical database schema issues (BLOCKING)**, **7 critical inconsistencies**, **5 missing error handling points**, and **3 workflow gaps** in the vehicle registration system. Key findings:

**🔴 CRITICAL BLOCKING ISSUES (Must Fix Immediately):**
1. **Missing `ipfs_cid` Column:** `documents` table lacks `ipfs_cid` column, causing ALL document inserts to fail. Documents uploaded to IPFS but not saved to database.
2. **Missing Enum Values:** `document_type` enum missing `'hpg_clearance'`, `'csr'`, `'sales_invoice'`, causing document queries/inserts to fail for these types.
3. **Invalid UUID Format:** Frontend sends document IDs like `"doc_1769269982792_yd72egzld"` (not UUIDs) when database save fails, causing document lookup failures.
4. **All Fallback Methods Fail:** All 4 document linking fallback methods fail due to schema issues, leaving 0 documents linked.
5. **Registration Succeeds Despite Failure:** Registration completes successfully even when 0 documents linked, with no user notification.

**⚠️ CRITICAL INCONSISTENCIES:**
4. **Document Key Mismatch:** Frontend uses camelCase keys (`insuranceCert`, `hpgClearance`) while backend expects database ENUMs (`insurance_cert`, `hpg_clearance`). Mapping layer exists but has edge cases.
5. **Silent Failures:** Document linking failures don't block registration (by design), but errors are logged without user notification.
6. **Race Condition:** Clearance requests are created immediately after vehicle creation, but documents may not be fully committed to DB (100ms delay added, but not foolproof).
7. **Missing Auto-Verification Trigger:** Insurance auto-verification only triggers if clearance request creation succeeds. If it fails silently, auto-verification never runs.
8. **Status Transition Gap:** Vehicle status goes `SUBMITTED` → (clearance approvals) → `APPROVED` → `REGISTERED`, but there's no intermediate status for "awaiting clearance" vs "clearance complete, awaiting LTO approval".
9. **Email Mismatch Allowed:** Registration proceeds even if logged-in user email doesn't match registration email.
10. **Missing Status:** No `AWAITING_CLEARANCE` status to track clearance request state.

---

## Complete Workflow Trace Table

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Error Handling/Logging | Notes |
|------|--------------|-----------|---------------------------|--------------|------------------------|-------|
| **1. Form Initialization** | `registration-wizard.html` | N/A | `js/registration-wizard.js:66-145` | `currentStep = 1`, Form state | ✅ Logs initialization | Auto-save enabled via FormPersistence |
| **2. Car Type Selection** | `#carType` select | N/A | `js/registration-wizard.js:104-115` | `storedVehicleType`, Document visibility | ⚠️ No validation if invalid value | Triggers document requirements load |
| **3. Document Requirements Load** | Dynamic container | `GET /api/document-requirements/:registrationType` | `js/registration-wizard.js:2057-2093` | Renders upload fields | ⚠️ Falls back silently if API fails | Uses `NEW` as default registration type |
| **4. Document Upload** | File inputs `[data-document-type]` | `POST /api/documents/upload` | `js/registration-wizard.js:1605-1748` | `documentUploads` object | ⚠️ **CRITICAL:** Upload failures logged but registration continues | Returns `{id, filename, cid, url}` per document |
| **5. OCR Extraction** | After upload | N/A | `js/registration-wizard.js:2206-2251` | `storedOCRExtractedData`, `ocrDataSource` | ⚠️ OCR failures silent, no user feedback | Auto-fills form fields, tracks conflicts |
| **6. Form Validation** | Step 4 Review | N/A | `js/registration-wizard.js:1296-1400` | Validates required fields | ✅ Shows user-friendly errors | Checks VIN format, required fields |
| **7. Conflict Detection** | Before submit | N/A | `js/registration-wizard.js:166-302` | `window._ocrHadConflicts` flag | ⚠️ Conflicts detected but user can proceed | Compares OCR vs form values |
| **8. Submit Registration** | `submitApplication()` | `POST /api/vehicles/register` | `js/registration-wizard.js:1401` | Sends `applicationData` | ✅ Try-catch with user notification | AbortController for cancellation |
| **9. Backend Validation** | N/A | `backend/routes/vehicles.js:935-1164` | `router.post('/register')` | Validates request body | ✅ Returns 400 with specific errors | Checks VIN/plate uniqueness, required fields |
| **10. Owner User Resolution** | N/A | Same | `vehicles.js:1004-1076` | Creates/updates `users` table | ⚠️ **GAP:** Email mismatch logged but allowed | Prioritizes logged-in user, falls back to email lookup |
| **11. Vehicle Creation** | N/A | Same | `vehicles.js:1145-1164` | `vehicles` table INSERT | ✅ Validates creation success | Status = `SUBMITTED`, `originType = 'NEW_REG'` |
| **12. Vehicle History** | N/A | Same | `vehicles.js:1176-1189` | `vehicle_history` INSERT | ⚠️ **SILENT FAILURE:** History errors logged but don't fail registration | Action = `REGISTERED` (confusing name for submission) |
| **13. Document Linking** | N/A | Same | `vehicles.js:1191-1366` | `documents` table UPDATE | ⚠️ **CRITICAL:** Multiple fallback methods, all failures silent | 4 methods: by ID → filename/CID → recent unlinked → create new |
| **14. Document Type Mapping** | N/A | Same | `vehicles.js:1207-1229` | Maps frontend keys → logical → DB types | ⚠️ **INCONSISTENCY:** Unknown types logged but skipped | Uses `documentTypes.mapLegacyType()` and `mapToDbType()` |
| **15. CID Collection** | N/A | Same | `vehicles.js:1335-1355` | `documentCids` object | ⚠️ Missing CIDs logged but not user-notified | Only collects if `ipfs_cid` exists and logical type valid |
| **16. Email Notification** | N/A | Same | `vehicles.js:1409-1549` | Sends email via Gmail API | ⚠️ **SILENT FAILURE:** Email errors logged, registration succeeds | Uses `sendMail()` helper |
| **17. Auto-Send Clearance Requests** | N/A | Same | `vehicles.js:1551-1569` | Calls `clearanceService.autoSendClearanceRequests()` | ⚠️ **SILENT FAILURE:** Errors logged, registration succeeds | Passes `registrationData.documents` (may be outdated) |
| **18. Clearance Service Entry** | N/A | `backend/services/clearanceService.js:17` | `autoSendClearanceRequests()` | Queries vehicle and documents | ✅ Validates vehicle exists | 100ms delay to avoid race condition |
| **19. Document Detection (HPG)** | N/A | Same | `clearanceService.js:64-114` | Checks `allDocuments` array | ⚠️ **INCONSISTENCY:** Checks both DB type and logical type, may miss | Looks for `owner_id` OR `hpg_clearance` for NEW_REG |
| **20. Document Detection (Insurance)** | N/A | Same | `clearanceService.js:118-150` | Checks `allDocuments` array | ⚠️ **INCONSISTENCY:** Same dual-check logic | Looks for `insurance_cert` OR `insurance` |
| **21. HPG Clearance Request** | N/A | Same | `clearanceService.js:152-397` | `clearance_requests` INSERT | ✅ Error handling with try-catch | Creates request, updates verification status to PENDING |
| **22. HPG Auto-Verification** | N/A | Same | `clearanceService.js:407-608` | Calls `autoVerificationService.autoVerifyHPG()` | ⚠️ **GAP:** Only runs if request creation succeeds | OCR extraction + database check + fraud detection |
| **23. Insurance Clearance Request** | N/A | Same | `clearanceService.js:609-710` | `clearance_requests` INSERT | ✅ Error handling with try-catch | Creates request, triggers auto-verification |
| **24. Insurance Auto-Verification** | N/A | Same | `clearanceService.js:658-709` | Calls `autoVerificationService.autoVerifyInsurance()` | ⚠️ **GAP:** Only runs if request creation succeeds | OCR extraction + policy number validation + database lookup |
| **25. Auto-Verification Service (Insurance)** | N/A | `backend/services/autoVerificationService.js:29` | `autoVerifyInsurance()` | Updates `vehicle_verifications` | ⚠️ **SILENT FAILURE:** File not found returns PENDING, no notification | Requires document file path, falls back to storageService |
| **26. OCR Extraction (Insurance)** | N/A | Same | `autoVerificationService.js:56` | Calls `ocrService.extractInsuranceInfo()` | ⚠️ OCR errors return PENDING status | Extracts policy number, expiry, etc. |
| **27. Policy Number Validation** | N/A | Same | `autoVerificationService.js:59-99` | Validates policy number exists | ✅ Returns PENDING if missing | Sets verification status with metadata |
| **28. Database Lookup** | N/A | Same | `autoVerificationService.js:100-200` | Queries `issued_certificates` table | ⚠️ Database errors return PENDING | Checks policy number, VIN, expiry |
| **29. Fraud Detection** | N/A | Same | `autoVerificationService.js:200-300` | Calls `fraudDetectionService.checkPattern()` | ⚠️ Pattern check failures return PENDING | Validates certificate format, signatures |
| **30. Verification Status Update** | N/A | Same | `autoVerificationService.js:66-88` | `vehicle_verifications` UPDATE | ✅ Stores full metadata | Status = APPROVED/PENDING/REJECTED based on score |
| **31. Response Assembly** | N/A | `backend/routes/vehicles.js:1593-1603` | Returns JSON response | Includes `autoVerification` summary | ✅ Includes clearance request status | Returns vehicle, blockchain status, clearance requests, auto-verification |
| **32. Frontend Success Handler** | `js/registration-wizard.js:1403-1458` | N/A | Handles API response | Shows success/warning dialog | ✅ Handles OCR conflicts | Redirects to dashboard or stays on page |

---

### 0.3. **All Document Linking Fallback Methods Fail** 🔴 **CRITICAL**

**Location:** `backend/routes/vehicles.js:1236-1333`

**Issue:**
- **Method 1 (by ID):** Fails because frontend sends invalid UUID format (`"doc_1769269982792_yd72egzld"`)
- **Method 2 (by filename/CID):** Fails because `ipfs_cid` column doesn't exist (query: `WHERE ipfs_cid = $2`)
- **Method 3 (recent unlinked):** Fails because enum values missing (`invalid input value for enum document_type: "hpg_clearance"`)
- **Method 4 (create new):** Fails because `ipfs_cid` column doesn't exist (INSERT statement)

**Error Pattern:**
```
❌ Error querying document by ID doc_1769269982792_yd72egzld: invalid input syntax for type uuid
❌ Error querying document by filename/CID: column "ipfs_cid" does not exist
❌ Error querying recent unlinked documents: invalid input value for enum document_type: "hpg_clearance"
❌ Error creating document record: column "ipfs_cid" of relation "documents" does not exist
```

**Impact:**
- **ALL 4 fallback methods fail** - No documents can be linked regardless of fallback strategy
- Registration proceeds with 0 documents linked
- User sees "Registration Successful" but no documents are associated
- Clearance requests cannot be created (no documents found)

**Root Cause:** All fallback methods depend on schema fixes. Without `ipfs_cid` column and enum values, no method can succeed.

**Recommendation:** 
1. Apply schema migrations FIRST (blocks all methods)
2. Add validation: Fail registration if 0 documents linked (or require explicit user confirmation)
3. Return document linking status in API response so frontend can warn user

---

### 0.4. **Registration Succeeds Despite Complete Document Failure** ⚠️ **CRITICAL DESIGN ISSUE**

**Location:** `backend/routes/vehicles.js:1368-1372`

**Issue:**
- Logs show: `📄 Document linking summary: 0 document(s) linked`
- Registration continues: `✅ Vehicle registration submitted successfully. Status: SUBMITTED`
- No user notification that documents failed to link
- Frontend receives success response

**Impact:**
- User believes documents are uploaded and linked
- Vehicle registered without any documents
- Clearance requests cannot be created (no documents)
- Blockchain registration will fail (no document CIDs)
- User has no indication of failure until much later

**Recommendation:**
- Return `documentLinkingStatus` in API response with count of linked vs failed documents
- Frontend should show warning if any documents failed to link
- Consider failing registration if critical documents (HPG, Insurance) fail to link
- At minimum, return partial success with clear warnings

---

## Critical Database Schema Issues (BLOCKING)

### 0. **Missing `ipfs_cid` Column in `documents` Table** 🔴 **CRITICAL**

**Location:** `backend/database/services.js:360`, `backend/routes/documents.js:487`

**Issue:**
- Code attempts to INSERT `ipfs_cid` column: `INSERT INTO documents (..., ipfs_cid) VALUES (..., $10)`
- Database schema (`Complete Schema.sql:489-506`) shows `documents` table **does NOT have `ipfs_cid` column**
- Only `certificates` table has `ipfs_cid` (line 399)
- Migration script exists: `database/fix-missing-columns.sql` (not applied)

**Error:**
```
Database query error: error: column "ipfs_cid" of relation "documents" does not exist
```

**Impact:** 
- **ALL document inserts fail** - Documents uploaded to IPFS but not saved to database
- Document linking fails (no records to link)
- Auto-send clearance requests fails (no documents found)
- Blockchain registration fails (no document CIDs)

**Recommendation:** Apply migration `database/fix-missing-columns.sql` immediately.

---

### 0.1. **Missing `document_type` Enum Values** 🔴 **CRITICAL**

**Location:** `backend/routes/vehicles.js:1283`, `backend/services/clearanceService.js:260`

**Issue:**
- Code attempts to use enum values: `'hpg_clearance'`, `'csr'`, `'sales_invoice'`
- Database enum (`Complete Schema.sql:63-68`) only defines:
  - `'registration_cert'`
  - `'insurance_cert'`
  - `'emission_cert'`
  - `'owner_id'`
- Migration script exists: `database/add-vehicle-registration-document-types.sql` (not applied)

**Error:**
```
Database query error: error: invalid input value for enum document_type: "hpg_clearance"
Database query error: error: invalid input value for enum document_type: "csr"
Database query error: error: invalid input value for enum document_type: "sales_invoice"
```

**Impact:**
- Document queries fail for HPG, CSR, and Sales Invoice documents
- Document linking fails for these document types
- Clearance request creation fails (can't find documents)

**Recommendation:** Apply migration `database/add-vehicle-registration-document-types.sql` immediately.

---

### 0.2. **Invalid UUID Format for Document IDs** 🔴 **CRITICAL**

**Location:** `backend/routes/vehicles.js:1236-1254`, `backend/routes/documents.js:501`

**Issue:**
- Frontend sends document IDs like `"doc_1769269982792_yd72egzld"` (not UUID format)
- Code checks for `TEMP_` prefix (line 1236) but not `doc_` prefix
- Database expects UUID format: `uuid DEFAULT uuid_generate_v4()`
- When database save fails (due to missing `ipfs_cid`), response includes temporary ID
- Frontend uses this temporary ID in registration submission
- Backend tries to query: `SELECT * FROM documents WHERE id = $1` with invalid UUID

**Error:**
```
Database query error: error: invalid input syntax for type uuid: "doc_1769269982792_yd72egzld"
```

**Impact:**
- Document lookup by ID fails
- Falls back to filename/CID lookup (which also fails due to missing `ipfs_cid` column)
- Document linking fails completely

**Recommendation:** 
1. Add UUID validation before querying: Check if ID matches UUID format before querying
2. Fix root cause: Apply `ipfs_cid` migration so database saves succeed and return valid UUIDs
3. Add validation in frontend: Reject document IDs that aren't UUIDs

---

## Critical Inconsistencies Found

### 1. **Document Key Mismatch (Frontend ↔ Backend)**

**Location:** `vehicles.js:1207-1229`, `clearanceService.js:64-114`

**Issue:**
- Frontend sends: `{insuranceCert: {...}, hpgClearance: {...}}` (camelCase)
- Backend expects: Database ENUMs `insurance_cert`, `hpg_clearance` (snake_case)
- Mapping layer (`documentTypes.mapLegacyType()`) handles most cases, but:
  - Unknown keys are logged and skipped (line 1212)
  - `'other'` type is explicitly rejected (line 1218)
  - No user notification when mapping fails

**Impact:** Documents may be uploaded but not linked to vehicle if key mapping fails.

**Recommendation:** Add validation in frontend before submit to ensure all document keys map to valid DB types. Show user-friendly error if mapping fails.

---

### 2. **Document Linking Race Condition**

**Location:** `vehicles.js:1191-1366`, `clearanceService.js:30-47`

**Issue:**
- Documents are linked to vehicle in registration endpoint (step 13)
- Clearance service queries documents immediately after (step 18)
- 100ms delay added (line 32), but documents may still be committing
- Retry logic exists (line 38-46), but only retries once

**Impact:** Clearance requests may be created without documents if DB commit is slow.

**Recommendation:** Use database transaction or add retry loop with exponential backoff. Alternatively, query documents by `uploaded_by` + `uploaded_at` window instead of `vehicle_id`.

---

### 3. **Status Naming Confusion**

**Location:** `vehicles.js:1180`

**Issue:**
- Vehicle history action is `'REGISTERED'` when vehicle is submitted (line 1180)
- Actual registration (blockchain commit) happens later during LTO approval
- This creates confusion: history says "REGISTERED" but status is "SUBMITTED"

**Impact:** Audit trail is misleading. History shows "REGISTERED" action before actual blockchain registration.

**Recommendation:** Change history action to `'REGISTRATION_SUBMITTED'` or `'SUBMITTED'` to match status.

---

### 4. **Silent Document Linking Failures**

**Location:** `vehicles.js:1356-1362`

**Issue:**
- Document linking errors are caught and logged (line 1356)
- Registration continues even if all documents fail to link
- No user notification that documents weren't linked
- Only console warnings (line 1331, 1349-1354)

**Impact:** User thinks documents are uploaded, but they're not linked to vehicle. Clearance requests may fail silently.

**Recommendation:** Return document linking status in API response. Frontend should show warning if any documents failed to link.

---

### 5. **Auto-Verification Dependency Chain**

**Location:** `clearanceService.js:407-608`, `658-709`

**Issue:**
- Auto-verification only runs if clearance request creation succeeds
- If request creation fails (e.g., missing assigned user), auto-verification never runs
- No fallback: documents exist but aren't verified automatically

**Impact:** Valid documents may require manual verification even if they could be auto-verified.

**Recommendation:** Decouple auto-verification from clearance request creation. Run auto-verification independently, then create request with results.

---

### 6. **Email Mismatch Allowed**

**Location:** `vehicles.js:1012-1015`

**Issue:**
- If logged-in user email doesn't match registration email, warning is logged but registration proceeds
- Uses logged-in user account regardless of email mismatch
- No user confirmation or error

**Impact:** Registration may be associated with wrong user account if email mismatch occurs.

**Recommendation:** Require email match or show confirmation dialog. Alternatively, use registration email to find/create user instead of logged-in user.

---

### 7. **Missing Status: "AWAITING_CLEARANCE"**

**Location:** Workflow design gap

**Issue:**
- Vehicle status goes: `SUBMITTED` → `APPROVED` → `REGISTERED`
- No intermediate status for "clearance requests sent, awaiting organization approval"
- Admin can't easily filter "awaiting HPG" vs "awaiting insurance" vs "both complete"

**Impact:** Admin dashboard can't show clear workflow state. All vehicles in `SUBMITTED` may be at different clearance stages.

**Recommendation:** Add status `AWAITING_CLEARANCE` or use `vehicle_verifications` table to determine clearance status instead of vehicle status.

---

## Missing or Weak Error Handling

### 1. **Document Upload Failures** (Step 4)
- **Location:** `js/registration-wizard.js:1384-1398`
- **Issue:** Upload failures logged but registration continues
- **Impact:** User may submit registration without documents
- **Recommendation:** Show user which documents failed. Allow retry or proceed with warning.

### 2. **Vehicle History Creation Failure** (Step 12)
- **Location:** `vehicles.js:1186-1189`
- **Issue:** History errors caught but don't fail registration
- **Impact:** Audit trail incomplete, but registration succeeds
- **Recommendation:** Log error but continue (acceptable for audit trail, not critical path).

### 3. **Email Notification Failure** (Step 16)
- **Location:** `vehicles.js:1545-1549`
- **Issue:** Email errors logged but registration succeeds
- **Impact:** User doesn't receive confirmation email
- **Recommendation:** Queue email for retry. Show in-app notification if email fails.

### 4. **Clearance Request Creation Failure** (Step 17)
- **Location:** `vehicles.js:1565-1569`
- **Issue:** Errors logged but registration succeeds
- **Impact:** Clearance requests not sent, but vehicle is registered
- **Recommendation:** Return partial success response. Admin can manually send requests later.

### 5. **Auto-Verification File Not Found** (Step 25)
- **Location:** `autoVerificationService.js:40-53`
- **Issue:** Returns PENDING status if file not found, no notification
- **Impact:** Auto-verification silently fails, requires manual review
- **Recommendation:** Log error with vehicle ID and document ID. Create admin notification for manual review.

---

## Workflow Gaps

### 1. **No User Feedback on Document Linking Status**
- Documents may fail to link, but user sees "Registration Successful"
- **Recommendation:** Return `documentLinkingStatus` in API response. Frontend shows which documents linked successfully.

### 2. **No Retry Mechanism for Failed Clearance Requests**
- If clearance request creation fails, there's no automatic retry
- **Recommendation:** Add admin dashboard action to "Retry Clearance Requests" for vehicles in SUBMITTED status.

### 3. **Auto-Verification Not Triggered on Document Re-Upload**
- If user uploads documents after registration, auto-verification doesn't run
- **Recommendation:** Add trigger in document upload endpoint to check if vehicle needs auto-verification.

---

## Recommendations Summary

### High Priority

1. **🔴 FIX DATABASE SCHEMA (BLOCKING):** Apply migrations `database/fix-missing-columns.sql` and `database/add-vehicle-registration-document-types.sql` immediately. These are blocking ALL document operations.
2. **Fix Document ID Validation:** Add UUID format validation before querying documents. Reject non-UUID IDs or convert to proper lookup method.
3. **Add Document Linking Validation:** Return document linking status in API response. Fail registration (or require explicit confirmation) if 0 documents linked.
4. **Fix Document Key Mapping:** Add frontend validation before submit. Show error if any document keys don't map to valid DB types.
5. **Fix Race Condition:** Use database transaction for vehicle + document linking, or add retry loop with backoff.
6. **Add User Feedback:** Return document linking status in API response. Show warnings in UI if documents failed to link.
7. **Decouple Auto-Verification:** Run auto-verification independently of clearance request creation. Create request with results.

### Medium Priority

5. **Fix Status Naming:** Change history action from `'REGISTERED'` to `'REGISTRATION_SUBMITTED'` for clarity.
6. **Add Status: AWAITING_CLEARANCE:** Or use `vehicle_verifications` table to determine clearance status in UI.
7. **Email Queue:** Queue failed emails for retry. Show in-app notification if email fails.

### Low Priority

8. **Retry Mechanism:** Add admin action to retry failed clearance requests.
9. **Document Re-Upload Trigger:** Trigger auto-verification when documents are uploaded after registration.
10. **Enhanced Logging:** Add structured logging with correlation IDs for better traceability.

---

## Data Flow Diagram

```
Frontend (registration-wizard.js)
    ↓ submitApplication()
    ↓ uploadDocuments() → POST /api/documents/upload
    ↓ Collects: {insuranceCert: {id, cid, ...}, hpgClearance: {...}}
    ↓ POST /api/vehicles/register
    ↓
Backend (vehicles.js)
    ↓ Validate request
    ↓ Create/update owner user
    ↓ Create vehicle (status = SUBMITTED)
    ↓ Link documents (4 fallback methods)
    ↓ Map document keys: frontend → logical → DB type
    ↓ Collect CIDs for blockchain
    ↓ Send email notification
    ↓ Call clearanceService.autoSendClearanceRequests()
    ↓
Clearance Service (clearanceService.js)
    ↓ Query vehicle documents (with 100ms delay + retry)
    ↓ Detect HPG documents (owner_id OR hpg_clearance)
    ↓ Create HPG clearance request
    ↓ Trigger HPG auto-verification (if request created)
    ↓ Detect insurance documents (insurance_cert)
    ↓ Create insurance clearance request
    ↓ Trigger insurance auto-verification (if request created)
    ↓
Auto-Verification Service (autoVerificationService.js)
    ↓ Get document file path
    ↓ Extract data via OCR
    ↓ Validate policy number / certificate number
    ↓ Query issued_certificates database
    ↓ Run fraud detection checks
    ↓ Update vehicle_verifications table
    ↓ Return result to clearance service
    ↓
Response Assembly (vehicles.js)
    ↓ Format response with vehicle, clearance status, auto-verification results
    ↓ Return to frontend
    ↓
Frontend Success Handler
    ↓ Show success/warning dialog
    ↓ Redirect to dashboard or stay on page
```

---

## Testing Recommendations

1. **Test Document Key Mapping:** Submit registration with invalid document keys. Verify error handling.
2. **Test Race Condition:** Submit registration with slow DB. Verify documents are found on retry.
3. **Test Auto-Verification Failure:** Upload invalid insurance document. Verify PENDING status and admin notification.
4. **Test Email Failure:** Disable email service. Verify registration succeeds and error is logged.
5. **Test Clearance Request Failure:** Submit without required documents. Verify registration succeeds but clearance requests not created.

---

**Document Status:** Complete  
**Last Updated:** 2026-01-24 (Added Critical Database Schema Issues)  
**Next Review:** After applying database migrations and implementing high-priority recommendations
