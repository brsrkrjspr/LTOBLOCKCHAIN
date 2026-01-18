# Missing Calls Analysis - Summary

## Hypotheses Generated

**Hypothesis A: API endpoints called from frontend that don't exist in backend routes**
- Frontend calls `/api/vehicles/transfer/requests/stats` but backend route is `/api/vehicles/transfer/requests/stats` (should match)
- Some endpoints might have path mismatches
- Some endpoints might be missing entirely

**Hypothesis B: Function calls that reference undefined functions**
- Functions called but not defined in scope
- Functions removed but still referenced
- Window functions called before they're defined

**Hypothesis C: Method calls on objects that don't have those methods**
- Methods called on objects that don't support them
- API client methods that don't exist

**Hypothesis D: Route path mismatches**
- Frontend calls `/api/vehicles/transfer/requests/stats` but backend might expect different path
- Query parameter mismatches

**Hypothesis E: Missing route registrations**
- Routes defined but not registered in server.js
- Routes registered with wrong path prefix

## Instrumentation Added

1. **API Client Logging** (`js/api-client.js`):
   - Logs all API requests initiated (endpoint, method)
   - Logs all API responses (status, URL, success/failure)
   - Logs 404 errors (endpoint not found)
   - Logs all API errors (error message, status)

2. **Global Error Tracker** (`js/error-tracker.js`):
   - Catches window errors (undefined functions, property access)
   - Catches unhandled promise rejections (API errors)
   - Overrides console.error to track errors
   - Detects undefined function calls

3. **Error Tracker Added To**:
   - `owner-dashboard.html`
   - `admin-dashboard.html`
   - `hpg-admin-dashboard.html`
   - `verifier-dashboard.html`
   - `insurance-verifier-dashboard.html`

## Routes Verified

✅ `/api/blockchain/status` - EXISTS in `backend/routes/blockchain.js`
✅ `/api/vehicles/transfer/requests` - EXISTS in `backend/routes/transfer.js`
✅ `/api/vehicles/transfer/requests/stats` - EXISTS in `backend/routes/transfer.js`
✅ `/api/vehicles/transfer/requests/bulk-approve` - EXISTS in `backend/routes/transfer.js`
✅ `/api/vehicles/transfer/requests/bulk-reject` - EXISTS in `backend/routes/transfer.js`
✅ `/api/vehicles/my-vehicles/ownership-history` - EXISTS in `backend/routes/vehicles.js`
✅ `/api/integrity/check/:vin` - EXISTS in `backend/routes/integrity.js`

## Next Steps

1. User should navigate through the application
2. Logs will capture all API calls and errors
3. Analyze logs to identify missing calls
