# Fix: No Applications Showing in Admin Dashboard

## Root Cause Analysis

### Issue 1: Trust Proxy Warning
- **Problem:** `trust proxy: true` is too permissive for rate limiting
- **Fix:** Changed to `trust proxy: 1` (trust only first proxy) and added custom keyGenerator

### Issue 2: No Applications Showing
**Root Cause:** Vehicles are being registered directly on blockchain with status `REGISTERED`, bypassing the `SUBMITTED` status that admin dashboard queries for.

**Flow Analysis:**
1. User submits registration → Status: `SUBMITTED` ✅
2. Vehicle registered on blockchain → Status changed to `REGISTERED` ❌ (too fast!)
3. Admin dashboard queries: `status=SUBMITTED` → Returns empty ❌

**The Problem:**
In `backend/routes/vehicles.js` line ~600, after blockchain registration succeeds, the status is immediately changed to `REGISTERED`, so admin never sees `SUBMITTED` applications.

## Solution

### Option 1: Keep Status as SUBMITTED Until Admin Approval (Recommended)
- Don't change status to `REGISTERED` immediately after blockchain registration
- Keep status as `SUBMITTED` until admin approves
- Change to `REGISTERED` only after admin approval

### Option 2: Show Both SUBMITTED and PENDING Applications
- Admin dashboard should show vehicles with status `SUBMITTED` OR `PENDING_*`
- Include vehicles that are registered on blockchain but not yet approved

### Option 3: Separate Blockchain Registration from Application Status
- Blockchain registration is just for audit trail
- Application status (`SUBMITTED`, `APPROVED`, `REJECTED`) is separate
- Admin can see all `SUBMITTED` applications regardless of blockchain status

## Recommended Fix

**Keep vehicles as `SUBMITTED` until admin explicitly approves them.**

1. When vehicle is registered on blockchain, keep status as `SUBMITTED`
2. Only change to `REGISTERED` when admin approves via `/api/lto/approve-clearance` or `/api/vehicles/id/:id/status`
3. This ensures admin dashboard always shows pending applications

