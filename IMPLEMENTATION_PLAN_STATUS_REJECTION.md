# Implementation Plan: Status Normalization, Rejection Reasons & Transfer Document Updates

## Overview
This plan addresses three critical issues:
1. **Status case mismatch** between frontend and backend
2. **Missing rejection reasons** in UI
3. **Missing transfer request document update UI**

---

## Task 1: Normalize Status Comparison (HIGH PRIORITY)

### Problem
- Frontend checks: `status === 'rejected'` (lowercase)
- Backend returns: `status: 'REJECTED'` (uppercase from enum)
- Impact: Update button may not appear for rejected applications

### Solution
**File**: `js/owner-dashboard.js:1650`
- Normalize status before comparison
- Use case-insensitive check

### Implementation
```javascript
// Before
const canUpdate = status === 'submitted' || status === 'processing' || status === 'rejected' || status === 'pending';

// After
const normalizedStatus = (status || '').toLowerCase();
const canUpdate = ['submitted', 'processing', 'rejected', 'pending'].includes(normalizedStatus);
```

---

## Task 2: Backend - Include Rejection Reason in API Responses (HIGH PRIORITY)

### Problem
- Backend stores rejection reasons but doesn't include them in API responses
- Frontend can't display rejection reasons

### Solution
**Files to modify**:
1. `backend/routes/vehicles.js` - GET `/my-vehicles` endpoint
2. `backend/routes/transfer.js` - GET `/requests` endpoint
3. `backend/database/services.js` - `getVehiclesByOwner()` and `getTransferRequestById()`

### Implementation Details

#### For Vehicle Applications:
- Check `vehicle_verifications` table for `REJECTED` status
- Extract `verification_metadata.manualReview.manualNotes` or `notes` field
- Include in response as `rejectionReason`

#### For Transfer Requests:
- Check `transfer_requests.metadata.rejectionReason` or `rejection_reason` field
- Include in response as `rejectionReason`

---

## Task 3: Frontend - Display Rejection Reasons (HIGH PRIORITY)

### Problem
- Frontend shows generic "Please review the notes" message
- No actual rejection reason displayed

### Solution
**File**: `js/owner-dashboard.js:1717-1721`
- Add rejection reason display section after status banner
- Show when status is `rejected` (case-insensitive)

### Implementation
```javascript
${normalizedStatus === 'rejected' ? `
    <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0;">
        <h4 style="margin-top: 0; color: #721c24;"><i class="fas fa-exclamation-triangle"></i> Reason for Rejection</h4>
        <p style="margin: 0; white-space: pre-wrap;">${application.rejectionReason || application.notes || application.rejection_reason || 'No reason provided. Please contact LTO for details.'}</p>
    </div>
` : ''}
```

---

## Task 4: Frontend - Add Transfer Request Document Update UI (MEDIUM PRIORITY)

### Problem
- `my-vehicle-ownership.html` only shows vehicle history
- No way to update documents for rejected/pending transfer requests

### Solution
**Files to modify**:
1. `js/my-vehicle-ownership.js` - Add transfer request loading and display
2. `my-vehicle-ownership.html` - Add UI section for transfer requests
3. Reuse document update modal from `owner-dashboard.js`

### Implementation Details

#### Step 1: Load Transfer Requests
- Add API call to `/api/vehicles/transfer/requests?status=REJECTED,UNDER_REVIEW,AWAITING_BUYER_DOCS`
- Filter by current user (seller or buyer)

#### Step 2: Display Transfer Requests
- Show transfer request cards with:
  - Vehicle details
  - Status badge
  - Rejection reason (if rejected)
  - Documents list
  - "Update Document" button (when applicable)

#### Step 3: Document Update Functionality
- Reuse `showDocumentUpdateModal()` and `submitDocumentUpdate()` from `owner-dashboard.js`
- Link documents to `transfer_requests` via `transfer_documents` table

---

## Task 5: Backend - Add In-App Notification for Manual Verification Rejections (LOW PRIORITY)

### Problem
- Manual verification rejections don't create in-app notifications
- Only transfer rejections have notifications

### Solution
**File**: `backend/routes/admin.js:750` (after email sending)
- Add notification creation when `decision === 'REJECTED'`

---

## Implementation Order

1. ✅ **Fix 1**: Normalize status comparison (Frontend)
2. ✅ **Fix 2**: Backend - Include rejectionReason in responses
3. ✅ **Fix 3**: Frontend - Display rejection reasons
4. ✅ **Fix 4**: Frontend - Transfer request document update UI
5. ✅ **Fix 5**: Backend - In-app notifications

---

## Testing Checklist

- [ ] Status normalization works for uppercase/lowercase status values
- [ ] Rejection reasons display in registration application modal
- [ ] Rejection reasons display in transfer request UI
- [ ] Document update button appears for rejected applications
- [ ] Document update works for registration applications
- [ ] Document update works for transfer requests
- [ ] In-app notifications created for manual verification rejections
- [ ] Backend API includes rejectionReason field in responses
