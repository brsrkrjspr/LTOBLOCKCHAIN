# MVIR Validation Implementation

## Overview

MVIR (Motor Vehicle Inspection Report) validation ensures that buyer-uploaded MVIR documents match the official LTO inspection record stored in the system.

## Where MVIR Validation Happens

### 1. **Buyer Acceptance** (`POST /api/vehicles/transfer/requests/:id/accept`)

**Location:** `backend/routes/transfer.js` (lines ~2057-2120)

**When:** After buyer uploads documents and accepts the transfer request

**Process:**
1. Buyer uploads MVIR document (`buyer_mvir`)
2. Documents are linked to transfer request
3. `autoVerifyMVIR()` is called automatically
4. Result stored in `transfer_requests.metadata.mvirAutoVerification`
5. If validation fails, buyer receives notification

**Code:**
```javascript
const mvirTransferDoc = transferDocs.find(td => 
    td.document_type === docTypes.TRANSFER_ROLES.BUYER_MVIR && td.document_id
);
if (mvirTransferDoc && mvirTransferDoc.document_id) {
    const autoVerificationService = require('../services/autoVerificationService');
    const mvirDoc = await db.getDocumentById(mvirTransferDoc.document_id);
    mvirAutoVerificationResult = await autoVerificationService.autoVerifyMVIR(
        request.vehicle_id,
        mvirDoc,
        vehicle
    );
}
```

### 2. **Transfer Approval** (`POST /api/vehicles/transfer/requests/:id/approve`)

**Location:** `backend/routes/transfer.js` (lines ~2884-2904)

**When:** LTO admin attempts to approve the transfer

**Process:**
1. Checks if MVIR document exists (required)
2. Checks MVIR auto-verification status from metadata
3. Logs warning if validation failed (doesn't block approval - admin can manually verify)
4. Logs success if auto-verified

**Code:**
```javascript
const mvirDoc = transferDocs.find(td => 
    td.document_type === docTypes.TRANSFER_ROLES.BUYER_MVIR && td.document_id
);
if (!mvirDoc) {
    return res.status(400).json({
        error: 'Cannot approve transfer request. Buyer MVIR document is required.',
        code: 'MVIR_DOCUMENT_REQUIRED'
    });
}

const mvirAutoVerification = request.metadata?.mvirAutoVerification;
if (mvirAutoVerification && mvirAutoVerification.status === 'PENDING' && mvirAutoVerification.automated === false) {
    console.warn(`[Transfer Approval] MVIR auto-verification failed: ${mvirAutoVerification.reason}`);
}
```

## MVIR Auto-Verification Logic

**Location:** `backend/services/autoVerificationService.js` (`autoVerifyMVIR` method)

### Validation Steps:

1. **Check LTO Inspection Record**
   - Verifies `vehicle.mvir_number` exists
   - If missing, returns `PENDING` with reason: "Vehicle does not have LTO inspection record"

2. **Extract MVIR Number from Document**
   - Uses OCR to extract MVIR number from buyer-uploaded PDF/image
   - Patterns supported:
     - `MVIR-YYYY-XXXXXX` (6 alphanumeric)
     - `MVIR Number: XXXXXX`
     - `Inspection Number: XXXXXX`

3. **Compare MVIR Numbers**
   - Normalizes extracted number and vehicle's `mvir_number` (removes spaces/dashes, uppercase)
   - If match → `APPROVED` (confidence: 100%)

4. **Hash Verification (Fallback)**
   - If MVIR number doesn't match, checks file hash against issued certificate
   - Looks up `issued_certificates` table for `mvir_cert` type
   - Compares file hash and composite hash
   - If match → `APPROVED` (confidence: 95%)

5. **Update Verification Status**
   - Updates `vehicle_verifications` table with status
   - Stores metadata: extracted MVIR number, match result, hash check, etc.

### Return Values:

```javascript
{
    status: 'APPROVED' | 'PENDING',
    automated: true | false,
    confidence: 0.0 - 1.0,
    reason: 'string',
    flagReasons: ['string'],
    extractedMvirNumber: 'string',
    vehicleMvirNumber: 'string',
    mvirNumberMatch: boolean,
    hashMatch: boolean,
    originalCertificateFound: boolean
}
```

## MVIR Workflow Summary

### Complete Flow:

1. **LTO Inspection** (`POST /api/lto/inspect`)
   - LTO admin performs physical vehicle inspection
   - System assigns `mvir_number` to vehicle
   - Vehicle record updated: `mvir_number`, `inspection_date`, `inspection_result`

2. **Buyer Uploads MVIR** (`POST /api/vehicles/transfer/requests/:id/accept`)
   - Buyer uploads MVIR certificate document
   - Document stored in `documents` table
   - Linked to transfer request via `transfer_documents` table

3. **Auto-Verification** (automatic on buyer acceptance)
   - Extracts MVIR number from uploaded document
   - Compares with vehicle's `mvir_number`
   - Updates verification status
   - Sends notification if validation fails

4. **Transfer Approval** (`POST /api/vehicles/transfer/requests/:id/approve`)
   - Checks MVIR document exists (required)
   - Reviews auto-verification status
   - LTO admin can manually verify if auto-verification failed
   - Proceeds with transfer approval

## Key Differences from Insurance/HPG Validation

| Aspect | Insurance/HPG | MVIR |
|--------|---------------|------|
| **Validator** | External organization (Insurance Co. / HPG) | LTO (internal) |
| **Forwarding** | Documents forwarded to external org | No forwarding needed |
| **Auto-Approval** | Can auto-approve if hash matches | Can auto-approve if MVIR number matches |
| **Blocking** | Blocks transfer if not approved | Doesn't block (admin can manually verify) |
| **Verification Method** | Hash matching + OCR + database lookup | MVIR number matching + hash fallback |

## Database Tables Involved

- `vehicles` - Stores `mvir_number` from LTO inspection
- `documents` - Stores buyer-uploaded MVIR document
- `transfer_documents` - Links MVIR document to transfer request
- `issued_certificates` - Stores auto-generated MVIR certificates (for hash comparison)
- `vehicle_verifications` - Stores MVIR verification status and metadata
- `transfer_requests` - Stores auto-verification result in `metadata.mvirAutoVerification`

## Notification Flow

**When MVIR validation fails:**
- Buyer receives in-app notification: "MVIR Document Issue Detected"
- Message includes reason for failure
- Buyer can re-upload corrected document

**When MVIR validation succeeds:**
- No notification (silent success)
- Status logged in transfer request metadata

## Testing Checklist

- [ ] Buyer uploads MVIR document during transfer acceptance
- [ ] MVIR number is extracted via OCR
- [ ] MVIR number matches vehicle's `mvir_number` → auto-approved
- [ ] MVIR number mismatch → status `PENDING`, buyer notified
- [ ] Hash fallback works when MVIR number extraction fails
- [ ] Transfer approval checks MVIR document exists
- [ ] Transfer approval logs auto-verification status
- [ ] LTO inspection assigns `mvir_number` correctly
- [ ] Vehicle without `mvir_number` blocks transfer approval

## Files Modified

1. `backend/services/autoVerificationService.js` - Added `autoVerifyMVIR()` method
2. `backend/routes/transfer.js` - Added MVIR auto-verification on buyer acceptance and validation check on approval
