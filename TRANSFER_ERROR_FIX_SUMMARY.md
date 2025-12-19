# Transfer Submission Error Fix Summary

## Issues Fixed

### 1. ✅ `ON CONFLICT DO NOTHING` Error
**Problem**: PostgreSQL `ON CONFLICT DO NOTHING` requires a unique constraint, but `transfer_documents` table doesn't have one.

**Fix**: Replaced with explicit existence check:
```javascript
// Before (caused error):
INSERT INTO transfer_documents (...) VALUES (...) ON CONFLICT DO NOTHING

// After (fixed):
const existingDoc = await dbModule.query(
    `SELECT id FROM transfer_documents 
     WHERE transfer_request_id = $1 AND document_id = $2 AND document_type = $3`,
    [transferRequest.id, docId, transferRole]
);
if (existingDoc.rows.length === 0) {
    await dbModule.query(`INSERT INTO transfer_documents (...) VALUES (...)`, [...]);
}
```

### 2. ✅ Non-existent `TRANSFER_ROLES.OTHER`
**Problem**: Code referenced `docTypes.TRANSFER_ROLES.OTHER` which doesn't exist in the constants.

**Fix**: Removed fallback, added proper validation to skip unknown roles.

### 3. ✅ Enhanced Error Logging
**Problem**: Generic error messages made debugging difficult.

**Fix**: Added detailed logging in development mode:
- Error stack trace
- Request body
- User information
- Detailed error messages

## Files Modified

- ✅ `backend/routes/transfer.js` - Fixed document linking logic and error handling

## Testing

After restarting the backend server, test:
1. Submit a transfer request with all required documents
2. Check backend logs for any remaining errors
3. Verify transfer request is created successfully

## If Error Persists

Check backend logs for:
1. **Vehicle ID issues**: Is `vehicleId` a valid UUID? Does vehicle exist?
2. **Document ID issues**: Are document IDs valid UUIDs? Do documents exist?
3. **Database constraints**: Check foreign key constraints and CHECK constraints
4. **Authentication**: Verify JWT token and user permissions

## Database Queries to Verify

Run these to check database state:

```sql
-- Check if transfer_requests table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'transfer_requests'
);

-- Check if transfer_documents table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'transfer_documents'
);

-- Check transfer_documents constraint
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'transfer_documents';

-- Check if user has vehicles
SELECT id, plate_number, vin FROM vehicles WHERE owner_id = '<user_id>';
```
