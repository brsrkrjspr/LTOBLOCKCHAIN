# Manual Verification Plan for Insurance and Emission

## Overview
Add manual verification capability for LTO admins to review and approve/reject insurance and emission verifications that were flagged as PENDING by auto-verification.

## Requirements

### 1. When Manual Verify Should Appear
- ✅ Only show "Manual Verify" button when:
  - Verification status is `PENDING`
  - Auto-verification has been run (`automated: true` or `verificationMetadata` exists)
  - Verification result is `FAILED` or has flag reasons
- ❌ Do NOT show if:
  - Status is already `APPROVED` or `REJECTED`
  - No auto-verification was performed
  - Auto-verification passed (`verificationResult: 'PASSED'`)

### 2. User Interface Flow

#### Step 1: View Verification Details Modal
- Current: Shows auto-verification results (if available)
- **Add**: "Manual Verify" button at bottom (only if PENDING + auto-verified + failed)

#### Step 2: Manual Verification Modal
When "Manual Verify" button is clicked, show a modal with:

**Left Panel - Auto-Verification Results (Read-only)**
- Verification Score (percentage)
- Result Status (PASSED/FAILED)
- Issues Detected (list of flag reasons)
- Detailed Checks:
  - Pattern Validation status
  - Certificate Authenticity status
  - Document Uniqueness status
  - Expiry Date status
  - Test Compliance (emission only)
- OCR Extracted Data (collapsible section)

**Right Panel - Manual Review**
- Document Preview/Viewer
  - View the uploaded insurance/emission document
  - Download option
- Manual Decision Section:
  - Radio buttons: Approve / Reject
  - Notes/Reason textarea (required for rejection, optional for approval)
  - Submit button

**Bottom Section**
- Action buttons:
  - "Cancel" - Close modal without changes
  - "Submit Manual Verification" - Process the decision

### 3. Backend Implementation

#### API Endpoint (New or Modify Existing)
**Option A: Use existing endpoint**
- `PUT /api/vehicles/:vin/verification` (already exists)
- Modify to handle manual verification with metadata

**Option B: Create new endpoint**
- `POST /api/admin/verifications/manual-verify`
- Body:
  ```json
  {
    "vehicleId": "uuid",
    "verificationType": "insurance" | "emission",
    "decision": "APPROVED" | "REJECTED",
    "notes": "string",
    "clearanceRequestId": "uuid" // Optional, for updating clearance request
  }
  ```

#### Database Updates
When manual verification is submitted:
1. Update `vehicle_verifications`:
   - `status`: APPROVED or REJECTED
   - `verified_by`: Admin user ID
   - `verified_at`: Current timestamp
   - `notes`: Admin's notes/reason
   - `automated`: Keep as `true` (was auto-verified, then manually reviewed)
   - `verification_metadata`: Add `manualReview` object:
     ```json
     {
       "manualReviewed": true,
       "manualReviewedBy": "admin_user_id",
       "manualReviewedAt": "timestamp",
       "manualDecision": "APPROVED" | "REJECTED",
       "manualNotes": "string",
       "autoVerificationResult": "FAILED",
       "autoVerificationScore": 45,
       "autoFlagReasons": ["reason1", "reason2"]
     }
     ```

2. Update `clearance_requests`:
   - `status`: APPROVED or REJECTED
   - `completed_at`: Current timestamp
   - `metadata`: Add manual review info

3. Add to `vehicle_history`:
   - Action: `INSURANCE_MANUAL_VERIFICATION` or `EMISSION_MANUAL_VERIFICATION`
   - Description: Include both auto-verification results and manual decision

### 4. Frontend Implementation

#### Files to Modify

**`js/admin-dashboard.js`**
1. `viewVerificationDetails()` function:
   - Add "Manual Verify" button conditionally
   - Button should only appear when:
     - `orgType === 'insurance' || orgType === 'emission'`
     - `verification.status === 'PENDING'`
     - `verificationMetadata.autoVerified === true`
     - `verificationMetadata.verificationResult === 'FAILED'` OR `flagReasons.length > 0`

2. New function: `showManualVerificationModal(verificationType, vehicleId, requestId, verification, verificationMetadata)`
   - Creates modal with two-panel layout
   - Shows auto-verification results (read-only)
   - Shows document viewer
   - Form for manual decision
   - Handles form submission

3. New function: `submitManualVerification(vehicleId, verificationType, decision, notes, requestId)`
   - Calls API endpoint
   - Shows success/error notification
   - Refreshes verification details
   - Closes modal

#### Modal Structure
```html
<div class="manual-verification-modal">
  <div class="modal-header">
    <h3>Manual Verification - {Insurance/Emission}</h3>
  </div>
  <div class="modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
    <!-- Left Panel: Auto-Verification Results -->
    <div class="auto-verify-results-panel">
      <h4>Auto-Verification Results</h4>
      <!-- Display all auto-verification data -->
    </div>
    
    <!-- Right Panel: Manual Review -->
    <div class="manual-review-panel">
      <h4>Document Review</h4>
      <!-- Document viewer -->
      <div class="manual-decision-form">
        <!-- Approve/Reject radio -->
        <!-- Notes textarea -->
        <!-- Submit button -->
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button onclick="closeModal()">Cancel</button>
    <button onclick="submitManualVerification()">Submit</button>
  </div>
</div>
```

### 5. Visual Design

#### Manual Verify Button
- Style: `btn-primary` or `btn-warning`
- Icon: `fa-user-check` or `fa-clipboard-check`
- Text: "Manual Verify"
- Position: Bottom of verification details modal, in action buttons section

#### Manual Verification Modal
- Width: `max-width: 1200px` (wider than normal modal)
- Layout: Two-column grid (50/50 split)
- Left panel: Auto-verification results (read-only, gray background)
- Right panel: White background, form elements
- Responsive: Stack columns on mobile

### 6. User Flow Diagram

```
Admin Dashboard
    ↓
Click "View Status Details" for Insurance/Emission
    ↓
Verification Details Modal Opens
    ↓
Shows Auto-Verification Results (if PENDING + failed)
    ↓
"Manual Verify" Button Appears (if conditions met)
    ↓
Admin Clicks "Manual Verify"
    ↓
Manual Verification Modal Opens
    ├─ Left: Auto-Verification Results (read-only)
    └─ Right: Document Viewer + Manual Decision Form
    ↓
Admin Reviews:
    - Reads auto-verification issues
    - Views document
    - Makes decision (Approve/Reject)
    - Adds notes
    ↓
Admin Clicks "Submit Manual Verification"
    ↓
API Call → Update Database
    ↓
Success Notification
    ↓
Modal Closes
    ↓
Verification Details Refreshed (shows new status)
```

### 7. Edge Cases to Handle

1. **Concurrent Updates**: If another admin verifies while modal is open
   - Check status before submission
   - Show error if already processed

2. **Missing Data**: If auto-verification metadata is incomplete
   - Show available data
   - Don't block manual verification

3. **Document Not Found**: If document file is missing
   - Show error message
   - Still allow manual verification based on auto-results

4. **Network Errors**: If API call fails
   - Show error notification
   - Keep modal open
   - Allow retry

### 8. Testing Checklist

- [ ] Manual Verify button appears only when status is PENDING
- [ ] Manual Verify button appears only when auto-verification failed
- [ ] Manual Verify button does NOT appear when already APPROVED/REJECTED
- [ ] Modal shows all auto-verification results correctly
- [ ] Document viewer loads correctly
- [ ] Form validation works (notes required for rejection)
- [ ] API call succeeds and updates database
- [ ] Status updates correctly after manual verification
- [ ] History entry is created
- [ ] Clearance request status updates
- [ ] Success notification appears
- [ ] Modal closes after successful submission
- [ ] Error handling works for all edge cases

### 9. Implementation Steps

1. **Backend** (if new endpoint needed):
   - Create `POST /api/admin/verifications/manual-verify` endpoint
   - Handle vehicle_verifications update
   - Handle clearance_requests update
   - Handle vehicle_history creation

2. **Frontend**:
   - Add "Manual Verify" button to `viewVerificationDetails()`
   - Create `showManualVerificationModal()` function
   - Create `submitManualVerification()` function
   - Add CSS for two-panel layout
   - Test all flows

3. **Integration**:
   - Test with real PENDING verifications
   - Verify database updates
   - Check notifications
   - Test error scenarios

## Summary

This plan adds manual verification capability that:
- ✅ Only appears when needed (PENDING + auto-verified + failed)
- ✅ Shows auto-verification results for context
- ✅ Allows admin to make informed decision
- ✅ Preserves auto-verification data in metadata
- ✅ Updates both verification and clearance request status
- ✅ Creates proper audit trail
