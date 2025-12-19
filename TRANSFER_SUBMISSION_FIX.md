# Transfer Submission 500 Error - Fix

## Issue
Transfer ownership submission returns 500 error with "Internal server error"

## Root Causes Identified

### 1. ✅ Fixed: `ON CONFLICT DO NOTHING` without unique constraint
- **Problem**: PostgreSQL requires a unique constraint for `ON CONFLICT` clause
- **Fix**: Replaced with explicit existence check before INSERT

### 2. ✅ Fixed: Reference to non-existent `TRANSFER_ROLES.OTHER`
- **Problem**: Code referenced `docTypes.TRANSFER_ROLES.OTHER` which doesn't exist
- **Fix**: Removed fallback, added proper validation

### 3. ✅ Fixed: Better error logging
- **Problem**: Generic error messages made debugging difficult
- **Fix**: Added detailed error logging in development mode

## Changes Made

### `backend/routes/transfer.js`

1. **Document Linking (Lines 230-241)**
   - Removed `ON CONFLICT DO NOTHING`
   - Added explicit existence check before INSERT
   - Better error handling for unknown document roles

2. **Legacy Document Linking (Lines 250-280)**
   - Removed reference to `TRANSFER_ROLES.OTHER`
   - Added proper validation for transfer roles
   - Added existence check before INSERT

3. **Error Handling (Lines 321-332)**
   - Added detailed error logging
   - Added request body and user info logging
   - Better error messages in development mode

## Testing Steps

1. **Test Transfer Submission**
   - Select a vehicle
   - Fill buyer information
   - Upload all required documents
   - Submit transfer request
   - Check backend logs for detailed error if it fails

2. **Check Backend Logs**
   - Look for "Create transfer request error:" messages
   - Check error stack trace
   - Verify request body structure
   - Check user authentication

3. **Verify Database**
   - Ensure `transfer_requests` table exists
   - Ensure `transfer_documents` table exists
   - Ensure multi-org approval columns exist (if migration was run)

## Potential Remaining Issues

### If error persists, check:

1. **Vehicle ID Format**
   - Ensure `vehicleId` is a valid UUID
   - Check if vehicle exists in database
   - Verify user owns the vehicle

2. **Document IDs**
   - Ensure document IDs are valid UUIDs
   - Check if documents exist in database
   - Verify documents belong to the vehicle/user

3. **Database Constraints**
   - Check foreign key constraints
   - Verify `transfer_documents` CHECK constraint allows the document types
   - Check if any NOT NULL constraints are violated

4. **Authentication**
   - Verify JWT token is valid
   - Check user role permissions
   - Ensure user is authenticated

## Next Steps

1. Restart backend server to apply changes
2. Test transfer submission
3. Check backend logs for detailed error messages
4. Report specific error if issue persists
