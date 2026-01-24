# Role Mismatch Issue: Database vs Backend Authorization

## Problem Summary

**Database Reality:**
- `admin@lto.gov.ph` has `role = 'lto_admin'` (not `'admin'`)

**Backend Authorization:**
- Many routes use `authorizeRole(['admin'])` which **ONLY** accepts `'admin'` role
- This means `lto_admin` users get **403 Forbidden** errors on many admin routes

**Result:** 
- Login works correctly (reads `lto_admin` from database)
- But many admin routes **reject** `lto_admin` users because they only check for `'admin'`

---

## Evidence

### Database Query Results
```sql
SELECT email, role, employee_id FROM users 
WHERE email IN ('admin@lto.gov.ph', 'ltoofficer@lto.gov.ph', 'hpg@hpg.gov.ph', 'insurance@insurance.gov.ph') 
ORDER BY email;

           email            |        role        |  employee_id
----------------------------+--------------------+---------------
 admin@lto.gov.ph           | lto_admin          | LTO-ADMIN-001  ← lto_admin, not admin!
 hpg@hpg.gov.ph             | admin              |
 insurance@insurance.gov.ph | insurance_verifier |
 ltoofficer@lto.gov.ph      | lto_officer        | LTO-OFF-001
```

### Routes That Only Accept `'admin'` (Problem)

These routes will **REJECT** `lto_admin` users:

#### Certificate Routes
- `POST /api/certificates/generate` → `authorizeRole(['admin'])`

#### Certificate Generation Routes
- `POST /api/certificate-generation/hpg/generate-and-send` → `authorizeRole(['admin'])`
- `POST /api/certificate-generation/sales-invoice/generate-and-send` → `authorizeRole(['admin'])`
- `POST /api/certificate-generation/batch/generate-all` → `authorizeRole(['admin'])`
- `GET /api/certificate-generation/transfer/context/:transferRequestId` → `authorizeRole(['admin'])`
- `GET /api/certificate-generation/transfer/vehicles` → `authorizeRole(['admin'])`
- `GET /api/certificate-generation/transfer/vehicle/:vehicleId` → `authorizeRole(['admin'])`
- `GET /api/certificate-generation/transfer/requests` → `authorizeRole(['admin'])`
- `POST /api/certificate-generation/transfer/generate-compliance-documents` → `authorizeRole(['admin'])`

#### Document Routes
- `GET /api/documents/search` → `authorizeRole(['admin'])`
- `PATCH /api/documents/:documentId/type` → `authorizeRole(['admin'])`

#### Document Requirements Routes (All)
- `GET /api/document-requirements` → `authorizeRole(['admin'])`
- `GET /api/document-requirements/id/:id` → `authorizeRole(['admin'])`
- `POST /api/document-requirements` → `authorizeRole(['admin'])`
- `PUT /api/document-requirements/:id` → `authorizeRole(['admin'])`
- `DELETE /api/document-requirements/:id` → `authorizeRole(['admin'])`

#### Auth Routes
- `GET /api/auth/users/lookup` → `authorizeRole(['admin'])`

#### Integrity Routes
- `GET /api/integrity/vehicle/:vehicleId` → `authorizeRole(['admin'])`
- `POST /api/integrity/batch` → `authorizeRole(['admin'])`

#### Monitoring Routes (All)
- `GET /api/monitoring/metrics` → `authorizeRole(['admin'])`
- `GET /api/monitoring/stats` → `authorizeRole(['admin'])`
- `GET /api/monitoring/logs` → `authorizeRole(['admin'])`
- `GET /api/monitoring/health` → `authorizeRole(['admin'])`
- `POST /api/monitoring/cleanup` → `authorizeRole(['admin'])`
- `POST /api/monitoring/log` → `authorizeRole(['admin'])`

### Routes That Accept Both `'admin'` AND `'lto_admin'` (Correct)

These routes **WORK** for `lto_admin` users:

#### Admin Routes
- `GET /api/admin/stats` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `GET /api/admin/clearance-requests` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `POST /api/admin/create-user` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `GET /api/admin/users` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `POST /api/admin/verifications/manual-verify` → `authorizeRole(['admin', 'lto_admin'])` ✅

#### Transfer Routes
- `GET /api/transfer/requests/stats` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `POST /api/transfer/requests/expire-stale` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `POST /api/transfer/requests/bulk-approve` → `authorizeRole(['admin', 'lto_admin'])` ✅
- `POST /api/transfer/requests/bulk-reject` → `authorizeRole(['admin', 'lto_admin'])` ✅

#### LTO Routes
- `POST /api/lto/scrap/:vehicleId` → `authorizeRole(['admin', 'lto_admin'])` ✅

#### Ledger Routes
- `GET /api/ledger/stats` → `authorizeRole(['admin', 'lto_admin'])` ✅

---

## Impact

### What Works
1. ✅ **Login** - Reads `lto_admin` from database correctly
2. ✅ **Frontend Redirect** - Redirects `lto_admin` to `admin-dashboard.html`
3. ✅ **Frontend Dashboard** - `admin-dashboard.js` accepts both `'admin'` and `'lto_admin'`
4. ✅ **Some Admin Routes** - Routes that use `authorizeRole(['admin', 'lto_admin'])`

### What Doesn't Work
1. ❌ **Certificate Generation** - All certificate routes reject `lto_admin`
2. ❌ **Document Management** - Document search and type updates reject `lto_admin`
3. ❌ **Document Requirements** - All CRUD operations reject `lto_admin`
4. ❌ **Monitoring** - All monitoring routes reject `lto_admin`
5. ❌ **Integrity Checks** - Integrity routes reject `lto_admin`
6. ❌ **User Lookup** - Auth user lookup rejects `lto_admin`

---

## Root Cause

The issue is **inconsistent authorization** across routes:

1. **Some routes** correctly use: `authorizeRole(['admin', 'lto_admin'])`
2. **Many routes** incorrectly use: `authorizeRole(['admin'])` only

This suggests:
- Routes were created at different times
- Some developers knew about `lto_admin`, others didn't
- No consistent pattern was enforced

---

## Solution Options

### Option 1: Update Database (Quick Fix)

Change `admin@lto.gov.ph` role from `lto_admin` to `admin`:

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@lto.gov.ph';
```

**Pros:**
- Quick fix - works immediately
- No code changes needed

**Cons:**
- Doesn't fix the underlying issue
- Other `lto_admin` users will still have problems
- Doesn't align with the role structure (LTO-specific admin vs general admin)

### Option 2: Update All Routes (Proper Fix)

Change all `authorizeRole(['admin'])` to `authorizeRole(['admin', 'lto_admin'])`:

**Files to Update:**
1. `backend/routes/certificates.js`
2. `backend/routes/certificate-generation.js`
3. `backend/routes/documents.js`
4. `backend/routes/document-requirements.js`
5. `backend/routes/auth.js`
6. `backend/routes/integrity.js`
7. `backend/routes/monitoring.js`

**Change Pattern:**
```javascript
// Before
authorizeRole(['admin'])

// After
authorizeRole(['admin', 'lto_admin'])
```

**Pros:**
- Fixes the root cause
- Makes `lto_admin` work everywhere `admin` works
- Aligns with permission definitions in `authorize.js`

**Cons:**
- Requires code changes in multiple files
- Need to test all routes

### Option 3: Create Helper Function (Best Practice)

Create a helper function for admin authorization:

**File:** `backend/middleware/authorize.js`

```javascript
// Helper function for admin routes (accepts both admin and lto_admin)
function authorizeAdmin() {
    return authorizeRole(['admin', 'lto_admin']);
}

module.exports = {
    authorizeRole,
    authorizeAdmin,  // ← New helper
    authorizePermission,
    ...
};
```

Then update routes:
```javascript
// Before
authorizeRole(['admin'])

// After
authorizeAdmin()
```

**Pros:**
- Consistent pattern
- Easy to maintain
- Single place to change if needed

**Cons:**
- Still requires updating all routes
- Need to import new function

---

## Recommended Approach

**Use Option 2 + Option 3 Combined:**

1. **Create helper function** (`authorizeAdmin()`)
2. **Update all routes** to use the helper
3. **Keep database as-is** (`lto_admin` is correct for LTO-specific admin)

This ensures:
- ✅ `lto_admin` works everywhere
- ✅ Consistent authorization pattern
- ✅ Easy to maintain going forward
- ✅ Proper role separation (LTO admin vs general admin)

---

## Testing Checklist

After fixing, test these scenarios:

1. ✅ Login as `admin@lto.gov.ph` (role: `lto_admin`)
2. ✅ Access admin dashboard
3. ✅ Generate certificates
4. ✅ Search documents
5. ✅ Manage document requirements
6. ✅ View monitoring metrics
7. ✅ Run integrity checks
8. ✅ Lookup users

---

## Current Status

**Database:** ✅ Correct (`lto_admin` for LTO admin)
**Login:** ✅ Correct (reads from database)
**Frontend:** ✅ Correct (accepts `lto_admin`)
**Backend Routes:** ❌ **INCONSISTENT** (some accept `lto_admin`, many don't)

**Action Required:** Update routes to accept both `'admin'` and `'lto_admin'` roles.
