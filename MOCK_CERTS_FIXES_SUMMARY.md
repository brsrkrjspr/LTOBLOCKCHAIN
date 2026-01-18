# Mock Certs Folder Rename & Certificate Randomization - Implementation Summary

**Date:** January 18, 2026  
**Status:** ✅ COMPLETED

---

## Changes Made

### 1. ✅ Folder Name Updates: "Mock Certs" → "mock_certs"

**Files Updated:**
- ✅ `backend/services/certificatePdfGenerator.js` (line 13)
- ✅ `docker-compose.unified.yml` (line 325)
- ✅ `docker-compose.production.yml` (line 279)
- ✅ `docker-compose.laptop.yml` (line 34)
- ✅ `Dockerfile.production` (line 58) - Already updated by user
- ✅ `Dockerfile.laptop` (line 48)

**Changes:**
- Updated all references from `"Mock Certs"` to `"mock_certs"`
- Updated Docker volume mounts to use new folder name
- Updated Dockerfile COPY commands to use JSON array syntax: `["/app/mock_certs", "./mock_certs/"]`

---

### 2. ✅ Random Generation Functions Added

**File:** `backend/services/certificatePdfGenerator.js`

**New Methods:**
```javascript
generateRandomVIN()           // 17-char VIN (excludes I, O, Q)
generateRandomEngineNumber()  // Format: XXX-XX######
generateRandomChassisNumber() // 10-17 alphanumeric
generateRandomPlateNumber()   // Format: ABC-1234
```

**Usage:**
- All certificate generation methods now use these functions when values are not provided
- Ensures unique, randomized values for each certificate

---

### 3. ✅ Auto-Generated Certificate Numbers

**File:** `backend/routes/certificate-generation.js`

**Insurance Certificates:**
- Auto-generates: `CTPL-YYYY-XXXXXX` (random 6-char suffix)
- Only requires: `ownerEmail`, `ownerName`
- Optional: `policyNumber`, `vehicleVIN`, `coverageType`, `coverageAmount`, `effectiveDate`, `expiryDate`

**Emission Certificates:**
- Auto-generates: `ETC-YYYYMMDD-XXXXXX` (date + random 6-char suffix)
- Only requires: `ownerEmail`, `ownerName`
- Optional: `certificateNumber`, `vehicleVIN`, `vehiclePlate`, `testDate`, `expiryDate`, `testResults`

**HPG Clearance:**
- Auto-generates: `HPG-YYYY-XXXXXX` (random 6-char suffix)
- Only requires: `ownerEmail`, `ownerName`
- Optional: `clearanceNumber`, `vehicleVIN`, `vehiclePlate`, `issueDate`, `verificationDetails`

**CSR Certificates:**
- Auto-generates: `CSR-YYYY-XXXXXX` (random 6-char suffix) - already implemented in service
- Only requires: `dealerEmail`, `dealerName`
- Optional: `vehicleVIN`, `engineNumber`, `vehicleMake`, `vehicleModel`, `vehicleYear`, etc.

---

### 4. ✅ Randomized Vehicle Details

**When Not Provided, Auto-Generates:**
- **VIN:** 17-character random VIN (excludes I, O, Q)
- **Engine Number:** Format `XXX-XX######` (e.g., `2NR-FE123456`)
- **Chassis Number:** 10-17 alphanumeric characters
- **Plate Number:** Format `ABC-1234` (3 letters, 4 numbers)

**Implementation:**
- All certificate types (Insurance, Emission, HPG, CSR) now use randomized values
- Values are generated in the service layer (`certificatePdfGenerator.js`)
- Routes pass through provided values or let service generate random ones

---

## Certificate Generation Flow

### Before (Fixed Values):
```
API Request → Uses provided values OR fixed fallbacks
  ↓
Certificate PDF with fixed/duplicate values
```

### After (Randomized):
```
API Request → Only requires ownerEmail + ownerName
  ↓
Auto-generate:
  - Certificate Number (randomized)
  - VIN (if not provided)
  - Engine Number (if not provided)
  - Plate Number (if not provided)
  - Chassis Number (if not provided)
  ↓
Certificate PDF with unique randomized values
```

---

## API Changes

### Insurance Certificate
**Before:**
```json
{
  "ownerEmail": "required",
  "ownerName": "required",
  "vehicleVIN": "required",
  "policyNumber": "required",
  ...
}
```

**After:**
```json
{
  "ownerEmail": "required",
  "ownerName": "required",
  "vehicleVIN": "optional (auto-generated if missing)",
  "policyNumber": "optional (auto-generated if missing)",
  "coverageType": "optional (defaults to CTPL)",
  "coverageAmount": "optional (defaults to PHP 200,000 / PHP 50,000)",
  "effectiveDate": "optional (defaults to today)",
  "expiryDate": "optional (defaults to 1 year from today)"
}
```

### Emission Certificate
**Before:**
```json
{
  "ownerEmail": "required",
  "ownerName": "required",
  "vehicleVIN": "required",
  "certificateNumber": "required",
  ...
}
```

**After:**
```json
{
  "ownerEmail": "required",
  "ownerName": "required",
  "vehicleVIN": "optional (auto-generated if missing)",
  "certificateNumber": "optional (auto-generated if missing)",
  "vehiclePlate": "optional (auto-generated if missing)",
  "testDate": "optional (defaults to today)",
  "expiryDate": "optional (defaults to 1 year from today)",
  "testResults": "optional"
}
```

### HPG Clearance
**Before:**
```json
{
  "ownerEmail": "required",
  "ownerName": "required",
  "vehicleVIN": "required",
  "clearanceNumber": "required",
  ...
}
```

**After:**
```json
{
  "ownerEmail": "required",
  "ownerName": "required",
  "vehicleVIN": "optional (auto-generated if missing)",
  "clearanceNumber": "optional (auto-generated if missing)",
  "vehiclePlate": "optional (auto-generated if missing)",
  "issueDate": "optional (defaults to today)",
  "verificationDetails": "optional"
}
```

### CSR Certificate
**Before:**
```json
{
  "dealerEmail": "required",
  "dealerName": "required",
  "vehicleVIN": "required",
  "vehicleMake": "required",
  ...
}
```

**After:**
```json
{
  "dealerEmail": "required",
  "dealerName": "required",
  "vehicleVIN": "optional (auto-generated if missing)",
  "engineNumber": "optional (auto-generated if missing)",
  "vehicleMake": "optional (defaults to Toyota)",
  "vehicleModel": "optional (defaults to Vios)",
  "vehicleYear": "optional (defaults to current year)",
  "dealerLtoNumber": "optional (auto-generated if missing)",
  "issuanceDate": "optional (defaults to today)"
}
```

---

## Testing

### Verify Folder Name Update:
```bash
# Check service can find templates
docker exec lto-app node -e "
const path = require('path');
const templatesPath = path.join('/app', 'mock_certs');
const fs = require('fs');
console.log('Templates path exists:', fs.existsSync(templatesPath));
console.log('Insurance template exists:', fs.existsSync(path.join(templatesPath, 'Insurance Cert', 'index.html')));
"
```

### Verify Random Generation:
```bash
# Test certificate generation with minimal data
curl -X POST https://ltoblockchain.duckdns.org/api/certificate-generation/insurance/generate-and-send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerEmail": "test@example.com",
    "ownerName": "John Doe"
  }'
```

**Expected:** Certificate generated with:
- Auto-generated policy number (e.g., `CTPL-2026-ABC123`)
- Auto-generated VIN (17 characters)
- Default coverage type and amounts
- Default dates (today + 1 year expiry)

---

## Files Modified

1. ✅ `backend/services/certificatePdfGenerator.js`
   - Updated folder path: `"Mock Certs"` → `"mock_certs"`
   - Added 4 random generation methods
   - Updated all certificate methods to use random values when not provided

2. ✅ `backend/routes/certificate-generation.js`
   - Updated all 4 certificate routes (Insurance, Emission, HPG, CSR)
   - Made vehicle details optional
   - Added auto-generation for certificate numbers
   - Updated validation to only require email + name

3. ✅ `docker-compose.unified.yml`
   - Updated volume mount: `./Mock Certs` → `./mock_certs`

4. ✅ `docker-compose.production.yml`
   - Updated volume mount: `./Mock Certs` → `./mock_certs`

5. ✅ `docker-compose.laptop.yml`
   - Updated volume mount: `./Mock Certs` → `./mock_certs`

6. ✅ `Dockerfile.laptop`
   - Updated COPY command: JSON array syntax for path with spaces

---

## Next Steps

1. **Rebuild Docker image:**
   ```bash
   docker compose -f docker-compose.unified.yml up -d --build lto-app
   ```

2. **Verify templates are accessible:**
   ```bash
   docker exec lto-app ls -la /app/mock_certs
   ```

3. **Test certificate generation:**
   - Generate certificate with only email + name
   - Verify randomized values are unique
   - Verify certificate numbers follow correct format

---

## Summary

✅ **All folder name references updated**  
✅ **Random generation functions implemented**  
✅ **Certificate numbers auto-generated**  
✅ **Vehicle details randomized when not provided**  
✅ **API simplified - only email + name required**

**Result:** Certificates now generate with unique, randomized values instead of fixed/duplicate data, while maintaining the ability to provide specific values when needed.
