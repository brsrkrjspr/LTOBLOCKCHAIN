# Multi-Organization Approval Implementation

## Overview
This document describes the implementation of multi-organization approval requirement for transfer requests. LTO admin can no longer approve/reject transfer requests until HPG, Insurance, and Emission organizations have approved.

## Changes Made

### 1. Database Schema (`database/add-multi-org-approval.sql`)
Added columns to `transfer_requests` table:
- `hpg_approval_status` (PENDING, APPROVED, REJECTED)
- `insurance_approval_status` (PENDING, APPROVED, REJECTED)
- `emission_approval_status` (PENDING, APPROVED, REJECTED)
- `hpg_approved_at`, `insurance_approved_at`, `emission_approved_at`
- `hpg_approved_by`, `insurance_approved_by`, `emission_approved_by`
- `insurance_clearance_request_id`, `emission_clearance_request_id`

### 2. Backend Changes (`backend/routes/transfer.js`)

#### Modified `/api/vehicles/transfer/requests/:id/approve`
- Added validation to check all org approvals are complete
- Returns error if any org hasn't approved yet
- Returns error if any org has rejected

#### New Endpoints Added:
- `POST /api/vehicles/transfer/requests/:id/hpg-approve` - HPG approves transfer
- `POST /api/vehicles/transfer/requests/:id/insurance-approve` - Insurance approves transfer
- `POST /api/vehicles/transfer/requests/:id/emission-approve` - Emission approves transfer
- `POST /api/vehicles/transfer/requests/:id/forward-insurance` - Forward to Insurance
- `POST /api/vehicles/transfer/requests/:id/forward-emission` - Forward to Emission

#### Modified `/api/vehicles/transfer/requests/:id/forward-hpg`
- Sets `hpg_approval_status` to PENDING when forwarding

## Workflow

### Required Flow:
```
1. Seller creates transfer request → Status: PENDING
2. Buyer accepts → Status: REVIEWING
3. LTO Admin forwards to HPG → Status: FORWARDED_TO_HPG, hpg_approval_status: PENDING
4. LTO Admin forwards to Insurance → insurance_approval_status: PENDING
5. LTO Admin forwards to Emission → emission_approval_status: PENDING
6. HPG approves → hpg_approval_status: APPROVED
7. Insurance approves → insurance_approval_status: APPROVED
8. Emission approves → emission_approval_status: APPROVED
9. LTO Admin can now approve → Status: APPROVED
```

### Error Cases:
- If LTO tries to approve before all orgs approve → Error: "Pending organization approvals required"
- If any org rejects → Error: "Some organizations have rejected"

## Frontend Updates Needed

### `admin-transfer-details.html`
- Display org approval status indicators
- Show pending/approved/rejected status for each org
- Disable approve/reject buttons until all orgs approve
- Add "Forward to Insurance" and "Forward to Emission" buttons

### `js/admin-transfer-details.js`
- Update `updateActionButtons()` to check org approval status
- Add functions to call org approval endpoints
- Update UI based on approval status

## Testing Checklist

- [ ] Run database migration: `add-multi-org-approval.sql`
- [ ] Test LTO approval without org approvals → Should fail
- [ ] Test forwarding to HPG → Sets hpg_approval_status to PENDING
- [ ] Test HPG approval → Sets hpg_approval_status to APPROVED
- [ ] Test forwarding to Insurance → Sets insurance_approval_status to PENDING
- [ ] Test Insurance approval → Sets insurance_approval_status to APPROVED
- [ ] Test forwarding to Emission → Sets emission_approval_status to PENDING
- [ ] Test Emission approval → Sets emission_approval_status to APPROVED
- [ ] Test LTO approval after all orgs approve → Should succeed
- [ ] Test org rejection → LTO approval should fail

## Next Steps

1. Update frontend UI to show org approval status
2. Add buttons for forwarding to Insurance and Emission
3. Add org approval UI for HPG, Insurance, and Emission admins
4. Test complete workflow end-to-end
