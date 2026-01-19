# Certificate Generation - Owner Account Implementation

## Overview
Updated all certificate generation endpoints to require existing owner accounts from the database instead of accepting owner details directly from API requests.

## Changes Summary

### 1. New Helper Function
Added `lookupOwner(ownerId, ownerEmail)` helper function that:
- Accepts either `ownerId` (UUID) or `ownerEmail` for owner identification
- Validates email format if provided
- Looks up owner in database using `getUserById()` or `getUserByEmail()`
- Verifies owner exists and is active (`is_active = true`)
- Constructs owner name from `first_name + last_name`
- Returns structured owner object with: `id`, `name`, `email`, `address`, `phone`, `raw`

### 2. Updated API Request Format

**OLD (Before):**
```json
{
  "ownerEmail": "test@example.com",
  "ownerName": "Test User",  // ❌ Manually provided
  // ... other fields
}
```

**NEW (After):**
```json
{
  "ownerId": "uuid-here",           // ✅ Preferred: User UUID
  // OR
  "ownerEmail": "user@example.com", // ✅ Alternative: Lookup by email
  // ❌ REMOVED: "ownerName" - fetched from database
  // ... other fields
}
```

### 3. Updated Endpoints

All 6 endpoints have been updated:

1. **POST `/api/certificate-generation/insurance/generate-and-send`**
   - Now requires `ownerId` OR `ownerEmail` (removed `ownerName`)
   - Uses database owner data for certificate generation

2. **POST `/api/certificate-generation/emission/generate-and-send`**
   - Now requires `ownerId` OR `ownerEmail` (removed `ownerName`)
   - Uses database owner data for certificate generation

3. **POST `/api/certificate-generation/hpg/generate-and-send`**
   - Now requires `ownerId` OR `ownerEmail` (removed `ownerName`)
   - Uses database owner data for certificate generation

4. **POST `/api/certificate-generation/csr/generate-and-send`**
   - Now requires `ownerId` OR `ownerEmail` (removed `dealerName`)
   - Backward compatible: still accepts `dealerEmail` (maps to `ownerEmail`)
   - Uses database owner data for certificate generation

5. **POST `/api/certificate-generation/batch/generate-all`**
   - Now requires `ownerId` OR `ownerEmail` (removed `ownerName`)
   - Uses database owner data for all 5 certificate types

6. **Sales Invoice** (generated in batch endpoint only)
   - Uses owner data from database lookup

## Error Handling

The implementation provides clear error messages:

- **400 Bad Request**: Missing `ownerId` or `ownerEmail`, or invalid email format
- **404 Not Found**: Owner not found in database
- **403 Forbidden**: Owner account is inactive

Example error responses:
```json
{
  "success": false,
  "error": "Missing required field: ownerId or ownerEmail is required"
}
```

```json
{
  "success": false,
  "error": "Owner not found. User must be registered in the system."
}
```

```json
{
  "success": false,
  "error": "Owner account is inactive. Cannot generate certificates."
}
```

## Benefits

1. **Data Consistency**: Owner information always matches database records
2. **Security**: Prevents generating certificates for non-existent users
3. **Audit Trail**: Certificates are linked to actual user accounts via `ownerId`
4. **Data Integrity**: Owner name, email, and address are accurate and up-to-date
5. **Account Verification**: Ensures owner account is active before certificate generation

## Database Schema Used

The implementation uses the following fields from the `users` table:
- `id` (UUID) - Primary key
- `email` (VARCHAR) - Unique email address
- `first_name` (VARCHAR) - First name
- `last_name` (VARCHAR) - Last name
- `address` (VARCHAR/TEXT) - Owner address
- `phone` (VARCHAR) - Phone number
- `is_active` (BOOLEAN) - Account active status

## Response Changes

All endpoints now include owner information in the response:
```json
{
  "success": true,
  "certificate": {
    "certificateNumber": "...",
    "vehicleVIN": "...",
    "ownerName": "John Doe",      // ✅ From database
    "ownerEmail": "john@example.com", // ✅ From database
    "ownerId": "uuid-here",       // ✅ New field
    // ... other fields
  }
}
```

## Migration Notes

### For API Consumers

**Before:**
```javascript
POST /api/certificate-generation/insurance/generate-and-send
{
  "ownerEmail": "user@example.com",
  "ownerName": "User Name",
  // ...
}
```

**After:**
```javascript
POST /api/certificate-generation/insurance/generate-and-send
{
  "ownerEmail": "user@example.com",  // User must exist in database
  // OR
  "ownerId": "123e4567-e89b-12d3-a456-426614174000",
  // ownerName is no longer accepted
  // ...
}
```

### Backward Compatibility

- **CSR endpoint**: Still accepts `dealerEmail` for backward compatibility (maps to `ownerEmail`)
- **All endpoints**: Will return clear error messages if old format is used

## Testing Recommendations

1. Test with valid `ownerId` (UUID format)
2. Test with valid `ownerEmail` (existing user)
3. Test with non-existent `ownerId` (should return 404)
4. Test with non-existent `ownerEmail` (should return 404)
5. Test with inactive user account (should return 403)
6. Test with invalid email format (should return 400)
7. Test with missing both `ownerId` and `ownerEmail` (should return 400)
8. Verify owner name in generated certificates matches database
9. Verify email delivery uses database email address

## Implementation Date
2024-12-19

## Files Modified
- `backend/routes/certificate-generation.js` - All 6 endpoints updated with owner lookup
