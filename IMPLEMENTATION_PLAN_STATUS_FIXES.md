# Implementation Plan: Status Normalization, Rejection Reasons, and Transfer Document Updates

## Current Status Check

### ✅ Already Implemented
1. **Status Normalization** - `js/owner-dashboard.js:1653` ✅
2. **Rejection Reason Display** - `js/owner-dashboard.js:1728-1735` ✅
3. **Backend rejectionReason** - `backend/database/services.js:855` ✅
4. **In-app notifications** - `backend/routes/admin.js:770-779` ✅

### ❌ Needs Implementation
1. **Transfer Request Document Update UI** - Missing in `my-vehicle-ownership.js`
2. **Backend rejectionReason in transfer requests list** - Need to verify it's included

---

## Implementation Steps

### Step 1: Verify Backend Includes rejectionReason
- ✅ `getTransferRequestById` includes `rejectionReason` (services.js:855)
- ✅ Transfer request endpoint returns it (transfer.js:2457-2460)
- ⚠️ Need to verify `getTransferRequests` (list endpoint) includes it

### Step 2: Add Transfer Request Section to my-vehicle-ownership.html
- Add "My Transfer Requests" section (for seller)
- Display transfer requests with status, vehicle info, rejection reason
- Show documents for each transfer request
- Add "Update Document" buttons for rejected/pending transfers

### Step 3: Add Transfer Request Functions to my-vehicle-ownership.js
- `loadMyTransferRequests()` - Load transfer requests where user is seller
- `displayTransferRequests()` - Display transfer requests with documents
- `showTransferRequestDetails()` - Show transfer request details modal
- `updateTransferDocument()` - Update document for transfer request
- Reuse document update modal from owner-dashboard.js

### Step 4: Link Transfer Documents
- When updating a document for a transfer request, link it to the transfer request
- Use `transfer_documents` table to link documents to transfer requests

---

## Files to Modify

1. `my-vehicle-ownership.html` - Add transfer requests section
2. `my-vehicle-ownership.js` - Add transfer request loading and document update functions
3. `backend/routes/transfer.js` - Verify rejectionReason is included in list responses
4. `backend/database/services.js` - Verify getTransferRequests includes rejectionReason

---

## Implementation Details

### Transfer Request Document Update Flow
1. User views "My Transfer Requests" section
2. Sees rejected/pending transfer requests
3. Clicks "View Details" on a transfer request
4. Sees documents with "Update Document" buttons
5. Clicks "Update Document" → Opens modal (reuse from owner-dashboard.js)
6. Uploads new document
7. Document is linked to transfer request via `transfer_documents` table
8. Transfer request status may need to be updated if it was rejected

### Document Linking
- When uploading a document for a transfer request, we need to:
  1. Upload document to `/api/documents/upload` (with vehicleId)
  2. Link document to transfer request via `/api/vehicles/transfer/requests/:id/documents` or similar
  3. Or use `transfer_documents` table directly
