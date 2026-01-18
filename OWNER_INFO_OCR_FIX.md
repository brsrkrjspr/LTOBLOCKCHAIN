# Owner Information OCR Fix

## Issue Identified
The Owner Information section in vehicle registration was incorrectly extracting personal information (firstName, lastName, address, phone) from the uploaded Owner's ID document via OCR. This is a security and data integrity issue.

## Correct Behavior
- **Owner Personal Information** (firstName, lastName, email, phone, address) should ONLY come from the logged-in user's account profile
- **ID Type and ID Number** can be extracted from the Owner's ID document via OCR
- The system should NOT use personal information extracted from documents in the Owner Information section

## Changes Made

### 1. Frontend: `js/registration-wizard.js`

#### Change 1: Modified OCR data storage for owner ID documents (Lines ~1900-1950)
**Before:** Stored all owner data including firstName, lastName, address, phone from OCR
```javascript
const ownerData = {
    idType: data.extractedData.idType,
    idNumber: data.extractedData.idNumber,
    firstName: data.extractedData.firstName,
    lastName: data.extractedData.lastName,
    address: data.extractedData.address,
    phone: data.extractedData.phone
};
```

**After:** Only store ID type and number from OCR
```javascript
const ownerIdData = {
    idType: data.extractedData.idType,
    idNumber: data.extractedData.idNumber
};
```

#### Change 2: Updated field mapping (Lines ~2070-2075)
**Before:** Included all personal info fields in mapping
```javascript
'firstName': 'firstName',
'lastName': 'lastName',
'address': 'address',
'phone': 'phone',
'idType': 'idType',
'idNumber': 'idNumber'
```

**After:** Only ID fields in mapping with clear comment
```javascript
// Owner ID fields - ONLY ID type and number from documents
// Personal info (firstName, lastName, address, phone) should come from account profile
'idType': 'idType',
'idNumber': 'idNumber'
```

#### Change 3: Added filter in autoFillFromOCRData function (Lines ~2095-2115)
Added logic to skip personal information fields when processing owner ID documents:
```javascript
// For owner ID documents, skip personal information fields (they come from account)
const personalInfoFields = ['firstName', 'lastName', 'address', 'phone', 'email'];

// CRITICAL: For owner ID documents, skip personal information
// Only extract ID type and number from documents; personal info comes from account
if ((documentType === 'ownerValidId' || documentType === 'owner_id' || documentType === 'ownerId') &&
    personalInfoFields.includes(ocrField)) {
    console.log(`[OCR AutoFill] Skipping personal info field for owner ID: ${ocrField} (data comes from account, not document)`);
    return;
}
```

#### Change 4: Updated Step 3 OCR data re-application (Lines ~135-160 and ~190-210)
Modified both forward navigation and backward navigation to Step 3 to only re-apply ID info:
```javascript
const ownerIdDataFromStorage = {
    idType: storedOCRExtractedData.idType,
    idNumber: storedOCRExtractedData.idNumber
    // Note: firstName, lastName, address, phone excluded - these come from account profile
};
```

### 2. Backend: `backend/services/ocrService.js`

#### Change 1: Added warning in owner ID processing (Lines ~874-885)
Added clear note in debug logging:
```javascript
console.log('[OCR Debug] Processing owner ID document type:', {
    documentType,
    textLength: text ? text.length : 0,
    textType: typeof text,
    textSample: text ? text.substring(0, 500) : 'NO TEXT',
    note: 'IMPORTANT: Personal info (name, address, phone) extracted here should NOT be used in Owner Information section. Only ID type and number should be used. Personal info must come from user account.'
});
```

#### Change 2: Added warning in final extraction log (Lines ~1270-1275)
Added note in the final extracted data log:
```javascript
console.log('[OCR Debug] Final extracted data for owner_id:', {
    hasIdType: !!extracted.idType,
    hasIdNumber: !!extracted.idNumber,
    idType: extracted.idType,
    idNumber: extracted.idNumber,
    allExtractedFields: Object.keys(extracted),
    extractionSuccess: !!(extracted.idType && extracted.idNumber),
    note: 'CRITICAL: Personal info (firstName, lastName, address, phone) should NOT be used in Owner Information section. Only idType and idNumber should be used. Personal info must come from user account profile.'
});
```

### 3. UI: `registration-wizard.html`

#### Updated user-facing message (Lines ~1401-1403)
**Before:**
```html
<p style="color: #7f8c8d; margin-bottom: 1.5rem;">Information will be auto-filled from your profile. Please verify and complete any missing fields.</p>
```

**After:**
```html
<p style="color: #7f8c8d; margin-bottom: 1.5rem;">Information is auto-filled from your account profile. Please verify and complete any missing fields. <strong>Note:</strong> Personal details (name, email, phone, address) are retrieved from your account, not from uploaded documents.</p>
```

## How It Works Now

1. **User uploads Owner's ID document**
   - OCR extracts all data including name, address, phone, ID type, and ID number
   - Frontend only stores **idType** and **idNumber**
   - Personal information fields are discarded

2. **Step 3 (Owner Information) is displayed**
   - `autoFillOwnerInfo()` function loads personal information from user's account profile
   - OCR-extracted **idType** and **idNumber** are applied to those specific fields
   - Personal information fields (firstName, lastName, email, phone, address) remain populated from account

3. **User sees**
   - Personal info from their account profile
   - ID type and number from their uploaded ID document
   - Clear message that personal info comes from account, not documents

## Benefits

1. **Data Integrity**: Personal information always matches the logged-in user's account
2. **Security**: Prevents data mismatch or potential identity issues
3. **User Experience**: ID fields are auto-filled from document (convenient), while personal info is pre-filled from account (secure)
4. **Compliance**: Ensures owner information is tied to the authenticated user account

## Testing Recommendations

1. **Test OCR extraction**: Upload an Owner's ID and verify only idType and idNumber are auto-filled from document
2. **Test account auto-fill**: Verify firstName, lastName, email, phone, and address are loaded from user profile
3. **Test Step navigation**: Navigate forward and backward to Step 3, verify behavior is consistent
4. **Test with different ID types**: Try Driver's License, Passport, National ID to ensure ID type detection works
5. **Check console logs**: Verify the warning messages appear when processing owner ID documents

## Files Modified

- `js/registration-wizard.js` - Frontend OCR logic and auto-fill functions
- `backend/services/ocrService.js` - Backend OCR extraction service
- `registration-wizard.html` - User-facing message in Owner Information section

---

**Date**: January 18, 2026  
**Status**: Completed ✓
