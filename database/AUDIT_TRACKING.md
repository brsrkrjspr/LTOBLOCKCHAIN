# Database Schema Audit - Complete Tracking Document
**Date:** 2026-01-24  
**Status:** ✅ **COMPREHENSIVE AUDIT IN PROGRESS**

---

## Files Examined

### Frontend Files (35 files)
1. `js/auth-utils.js`
2. `js/login-signup.js`
3. `js/lto-officer-dashboard.js`
4. `js/admin-dashboard.js`
5. `js/lto-inspection-form.js`
6. `js/my-vehicle-ownership.js`
7. `js/admin-transfer-details.js`
8. `js/transfer-certificate-generator.js`
9. `js/owner-dashboard.js`
10. `js/utils.js`
11. `js/toast-notification.js`
12. `js/registration-wizard.js`
13. `js/status-utils.js`
14. `js/error-tracker.js`
15. `js/document-upload-utils.js`
16. `js/certificate-generator.js`
17. `js/insurance-verifier-dashboard.js`
18. `js/auth-manager.js`
19. `js/verifier-dashboard.js`
20. `js/api-client.js`
21. `js/document-modal.js`
22. `js/hpg-admin.js`
23. `js/admin-transfer-verification.js`
24. `js/search.js`
25. `js/admin-settings.js`
26. `js/vehicle-ownership-trace.js`
27. `js/mobile-nav.js`
28. `js/settings.js`
29. `js/models/vehicle-mapper.js`
30. `js/admin-transfer-requests.js`
31. `js/insurance-database.js`
32. `js/emission-database.js`
33. `js/error-handler.js`
34. `js/admin-login-helper.js`
35. `js/admin-modals.js`

### Backend Files (30+ files)

#### Routes
1. `backend/routes/vehicles.js`
2. `backend/routes/transfer.js`
3. `backend/routes/lto.js`
4. `backend/routes/admin.js`
5. `backend/routes/auth.js`
6. `backend/routes/documents.js`
7. `backend/routes/hpg.js`
8. `backend/routes/insurance.js`
9. `backend/routes/issuer.js`
10. `backend/routes/certificate-generation.js`
11. `backend/routes/certificate-upload.js`
12. `backend/routes/certificates.js`
13. `backend/routes/notifications.js`
14. `backend/routes/blockchain.js`
15. `backend/routes/ledger.js`
16. `backend/routes/monitoring.js`
17. `backend/routes/health.js`
18. `backend/routes/document-requirements.js`

#### Services
19. `backend/database/services.js`
20. `backend/services/autoVerificationService.js`
21. `backend/services/clearanceService.js`
22. `backend/services/monitoringService.js`
23. `backend/services/certificateBlockchainService.js`
24. `backend/services/certificateEmailService.js`
25. `backend/services/emailVerificationToken.js`
26. `backend/services/refreshToken.js`
27. `backend/services/activityLogger.js`
28. `backend/services/hpgDatabaseService.js`
29. `backend/services/expiryService.js`
30. `backend/services/transferAutoValidationService.js`
31. `backend/services/localStorageService.js`

#### Migrations
32. `backend/migrations/add_email_verification.sql`
33. `backend/migrations/add_refresh_tokens.sql`
34. `backend/migrations/add_token_blacklist.sql`
35. `backend/migrations/add-expiry-tracking.sql`
36. `backend/migrations/add-inspection-columns.sql`
37. `backend/migrations/add-verification-mode.sql`
38. `backend/migrations/add-scrapped-status.sql`
39. `backend/migrations/add_origin_type_to_vehicles.sql`

#### Scripts
40. `backend/scripts/remove-vehicles-missing-blockchain.js`
41. `backend/scripts/register-missing-vehicles-on-blockchain.js`
42. `backend/scripts/backfill-blockchain-registered.js`
43. `backend/scripts/backfill-blockchain-tx-ids.js`
44. `backend/scripts/diagnose-transferred-vehicle-detailed.js`
45. `backend/scripts/diagnose-transferred-vehicle-qr.js`
46. `backend/scripts/check-transferred-vehicle-txids.js`

#### Config
47. `backend/config/blacklist.js`
48. `backend/config/documentTypes.js`

### Database Files
49. `database/Complete Schema.sql`
50. `database/Complete Data.sql`
51. `database/FIX_MISSING_SCHEMA_ELEMENTS.sql`

---

## Issues Found and Fixed

### ✅ Fixed Issues (16 total)

#### Tables (2)
1. ✅ `external_issuers` - Certificate issuance workflow
2. ✅ `certificate_submissions` - Certificate upload/verification workflow

#### Vehicle Columns (14)
3. ✅ `vehicle_category`
4. ✅ `passenger_capacity`
5. ✅ `gross_vehicle_weight`
6. ✅ `net_weight`
7. ✅ `registration_type`
8. ✅ `origin_type`
9. ✅ `or_number`
10. ✅ `cr_number`
11. ✅ `or_issued_at`
12. ✅ `cr_issued_at`
13. ✅ `date_of_registration`
14. ✅ `scrapped_at`
15. ✅ `scrap_reason`
16. ✅ `scrapped_by`

#### User Columns (3)
17. ✅ `users.address`
18. ✅ `users.is_trusted_partner`
19. ✅ `users.trusted_partner_type`

#### Sequences (2)
20. ✅ `or_number_seq`
21. ✅ `cr_number_seq`

#### Enum Values (2)
22. ✅ `vehicle_status.SCRAPPED`
23. ✅ `vehicle_status.FOR_TRANSFER`

#### Optional Tables/Columns (2)
24. ✅ `request_logs` table (optional)
25. ✅ `clearance_requests.verification_mode` (optional)

---

## Script Fixes Applied

### Fix Script Order Issue
**Problem:** Index creation with `WHERE status = 'SCRAPPED'` was attempted before enum value existed  
**Solution:** Moved index creation to after STEP 11 (after enum values are added)  
**File:** `database/FIX_MISSING_SCHEMA_ELEMENTS.sql`  
**Status:** ✅ Fixed

---

## Reports Generated

1. `database/COMPLETE_IRREGULARITIES_REPORT.md` - Initial comprehensive audit
2. `database/ADDITIONAL_FINDINGS_REPORT.md` - New findings from frontend/backend audit
3. `database/FINAL_COMPREHENSIVE_REPORT.md` - Complete consolidated report
4. `database/SCHEMA_VERIFICATION_REPORT.md` - Initial workflow verification
5. `database/FINAL_VERIFICATION_SUMMARY.md` - Summary of all findings

---

## Next: Deep Dive for More Inconsistencies

Now searching for:
- INSERT statements referencing non-existent columns
- UPDATE statements referencing non-existent columns
- SELECT statements with JOINs to non-existent columns
- Foreign key references to non-existent tables/columns
- Function calls referencing non-existent database objects
- API endpoints expecting columns that don't exist

---

## 🔴 NEW CRITICAL ISSUES FOUND

### Issue #26: Missing `transfer_requests.expires_at` Column

**Severity:** 🔴 **CRITICAL**

**Referenced In:**
- `backend/database/services.js:812` - INSERT INTO transfer_requests includes `expires_at`
- `backend/routes/transfer.js:3188` - Accessing `request.expires_at`

**Impact:**
- ❌ Transfer request creation will fail
- ❌ Transfer request expiration checking will fail

**Schema Check:**
- ❌ Column `expires_at` NOT found in `transfer_requests` table (lines 669-700)

**Fix Required:**
```sql
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
```

**Status:** ✅ **ADDED TO FIX SCRIPT**

---

### Issue #27: Missing `transfer_requests.remarks` Column

**Severity:** 🔴 **CRITICAL**

**Referenced In:**
- `backend/database/services.js:812` - INSERT INTO transfer_requests includes `remarks`

**Impact:**
- ❌ Transfer request creation will fail if remarks are provided

**Schema Check:**
- ❌ Column `remarks` NOT found in `transfer_requests` table (lines 669-700)

**Fix Required:**
```sql
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS remarks TEXT;
```

**Status:** ✅ **ADDED TO FIX SCRIPT**

---

## 🟡 Code Bugs Found (Not Schema Issues)

### Code Bug: Invalid vehicle_status Value

**Severity:** 🟡 **CODE BUG** (Not a schema issue, but will cause runtime errors)

**Referenced In:**
- `backend/routes/hpg.js:997` - INSERT with `status = 'pending'` (lowercase)
- `backend/routes/insurance.js:416` - INSERT with `status = 'pending'` (lowercase)

**Issue:**
- Code inserts `'pending'` (lowercase) but `vehicle_status` enum only accepts uppercase values
- Valid enum values: 'SUBMITTED', 'PENDING_BLOCKCHAIN', 'REGISTERED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'SCRAPPED', 'FOR_TRANSFER'
- 'pending' is not a valid enum value

**Impact:**
- ❌ Vehicle creation in HPG/Insurance routes will fail with enum constraint violation

**Fix Required:**
- Change code to use valid enum value (e.g., 'SUBMITTED' instead of 'pending')
- **Note:** This is a code fix, not a schema fix

---
