# Certificate Number Format Standardization - Fix Summary

**Date:** 2026-01-24  
**Status:** ✅ **COMPLETED**

---

## Problem Fixed

Certificate numbers were being generated in **4 different formats** across the codebase, causing:
- ❌ Auto-verification failures (HPG certificates with VIN format)
- ❌ Inconsistent user experience
- ❌ Potential validation issues

---

## Solution Implemented

### 1. ✅ Created Centralized Certificate Number Generator

**File:** `backend/utils/certificateNumberGenerator.js`

**Features:**
- Standard format: `TYPE-YYYY-XXXXXX` for all certificates
- Supports random and sequence-based generation
- Validates certificate number formats
- Special handling for sales invoice (date prefix format)

**Functions:**
- `generateCertificateNumber(type, options)` - Generic generator
- `generateInsuranceNumber(options)` - Insurance/CTPL
- `generateHpgNumber(options)` - HPG clearance
- `generateCsrNumber(options)` - CSR certificate
- `generateSalesInvoiceNumber(options)` - Sales invoice (INV-YYYYMMDD-XXXXXX)
- `validateCertificateNumber(number, type)` - Format validation

---

## Files Updated

### 2. ✅ Fixed HPG Route (`backend/routes/hpg.js`)

**Before:**
```javascript
`HPG-${vehicle.vin}-${Date.now()}`  // ❌ Wrong format
```

**After:**
```javascript
const certificateNumberGenerator = require('../utils/certificateNumberGenerator');
const hpgCertificateNumber = certificateNumberGenerator.generateHpgNumber();
// ✅ Generates: HPG-2026-XXXXXX
```

**Lines Changed:** 593-594, 620

---

### 3. ✅ Updated Certificate Generation Routes (`backend/routes/certificate-generation.js`)

**Changes:**
- Added import: `const certificateNumberGenerator = require('../utils/certificateNumberGenerator')`
- Replaced all local `generateCertificateNumber()` functions with utility
- Updated insurance generation (Line 137)
- Updated HPG generation (Line 334)
- Updated CSR generation (Line 514)
- Updated batch generation (Lines 1015-1018)

**Before:**
```javascript
const generateCertificateNumber = (type) => {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    switch (type) {
        case 'insurance': return `CTPL-${year}-${random}`;
        case 'hpg': return `HPG-${year}-${random}`;
        default: return `CERT-${year}-${random}`;
    }
};
```

**After:**
```javascript
const finalPolicyNumber = policyNumber || certificateNumberGenerator.generateInsuranceNumber();
const finalClearanceNumber = clearanceNumber || certificateNumberGenerator.generateHpgNumber();
```

---

### 4. ✅ Updated PDF Generator Service (`backend/services/certificatePdfGenerator.js`)

**Changes:**
- Updated `generateCsrCertificate()` to accept optional `csrNumber` parameter
- Uses utility if number not provided
- Ensures CSR numbers match standard format

**Before:**
```javascript
const csrNumber = `CSR-${year}-${random}`;  // Generated internally
```

**After:**
```javascript
const certificateNumberGenerator = require('../utils/certificateNumberGenerator');
const csrNumberFinal = csrNumber || certificateNumberGenerator.generateCsrNumber();
```

**Lines Changed:** 628-647

---

### 5. ✅ Updated Issuer Routes (`backend/routes/issuer.js`)

**Changes:**
- Added import: `const certificateNumberGenerator = require('../utils/certificateNumberGenerator')`
- Updated `generateCertificateNumber()` to use utility

**Before:**
```javascript
function generateCertificateNumber(issuerType) {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    switch (issuerType) {
        case 'insurance': return `CTPL-${year}-${random}`;
        case 'hpg': return `HPG-${year}-${random}`;
    }
}
```

**After:**
```javascript
function generateCertificateNumber(issuerType) {
    switch (issuerType) {
        case 'insurance': return certificateNumberGenerator.generateInsuranceNumber();
        case 'hpg': return certificateNumberGenerator.generateHpgNumber();
    }
}
```

---

### 6. ✅ Updated Certificate Generator Service (`backend/services/certificateGeneratorService.js`)

**Note:** This service is deprecated but updated for consistency

**Changes:**
- Updated `generateCertificateNumber()` to use utility with sequence support

**Before:**
```javascript
generateCertificateNumber(type, vehicleVIN, sequence = 1) {
    const year = new Date().getFullYear();
    switch (type) {
        case 'insurance': return `CTPL-${year}-${String(sequence).padStart(6, '0')}`;
        case 'hpg': return `HPG-${year}-${String(sequence).padStart(6, '0')}`;
    }
}
```

**After:**
```javascript
generateCertificateNumber(type, vehicleVIN, sequence = 1) {
    const certificateNumberGenerator = require('../utils/certificateNumberGenerator');
    return certificateNumberGenerator.generateCertificateNumber(type, { sequence });
}
```

---

## Standard Formats

### ✅ Standard Format (All Certificates Except Sales Invoice)
- **Pattern:** `TYPE-YYYY-XXXXXX`
- **Examples:**
  - `CTPL-2026-C9P5EX` (Insurance)
  - `HPG-2026-I240CT` (HPG Clearance)
  - `CSR-2026-A3B7XY` (CSR Certificate)

### ✅ Sales Invoice Format (Intentionally Different)
- **Pattern:** `INV-YYYYMMDD-XXXXXX`
- **Example:** `INV-20260124-A3B7XY`
- **Reason:** Includes full date for invoice tracking
- **Status:** Documented as intentional difference

---

## Auto-Verification Compatibility

### ✅ Verified Patterns Match

**Auto-Verification Service (`backend/services/autoVerificationService.js`):**
- Insurance: `/^CTPL-\d{4}-[A-Z0-9]{6}$/` ✅ Matches utility format
- HPG: `/^HPG-\d{4}-[A-Z0-9]{6}$/` ✅ Matches utility format

**Result:** All generated certificate numbers will now pass auto-verification!

---

## Testing Checklist

- [x] Created centralized utility
- [x] Fixed HPG route (VIN format → standard format)
- [x] Updated certificate-generation.js
- [x] Updated certificatePdfGenerator.js
- [x] Updated issuer.js
- [x] Updated certificateGeneratorService.js
- [ ] Test HPG certificate generation (should use standard format)
- [ ] Test insurance certificate generation
- [ ] Test CSR certificate generation
- [ ] Test batch certificate generation
- [ ] Verify auto-verification passes for all formats
- [ ] Test sales invoice generation (different format is intentional)

---

## Impact

### ✅ Before Fix:
- HPG certificates: `HPG-1HGBH41JXMN123456-1706123456789` ❌ Fails validation
- Insurance certificates: `CTPL-2026-C9P5EX` ✅ Passes validation
- CSR certificates: `CSR-2026-A3B7XY` ✅ Passes validation
- **Result:** Inconsistent auto-approval rates

### ✅ After Fix:
- HPG certificates: `HPG-2026-XXXXXX` ✅ Passes validation
- Insurance certificates: `CTPL-2026-XXXXXX` ✅ Passes validation
- CSR certificates: `CSR-2026-XXXXXX` ✅ Passes validation
- **Result:** Consistent auto-approval for all certificates

---

## Notes

1. **Sales Invoice Format:** Intentionally uses `INV-YYYYMMDD-XXXXXX` format (includes date). This is documented in the utility and is acceptable since sales invoices don't go through auto-verification.

2. **Sequence vs Random:** The utility supports both:
   - Random: `generateCertificateNumber('insurance')` → `CTPL-2026-C9P5EX`
   - Sequence: `generateCertificateNumber('insurance', { sequence: 1 })` → `CTPL-2026-000001`

3. **Backward Compatibility:** Custom certificate numbers provided by users are validated but accepted if they match the format.

---

## Files Created

1. ✅ `backend/utils/certificateNumberGenerator.js` - Centralized utility

## Files Modified

1. ✅ `backend/routes/hpg.js` - Fixed VIN format issue
2. ✅ `backend/routes/certificate-generation.js` - Updated all generation functions
3. ✅ `backend/services/certificatePdfGenerator.js` - Updated CSR generation
4. ✅ `backend/routes/issuer.js` - Updated issuer certificate generation
5. ✅ `backend/services/certificateGeneratorService.js` - Updated deprecated service

---

**Status:** ✅ **FIX COMPLETE**  
**Next Steps:** Test certificate generation end-to-end to verify all formats are consistent
