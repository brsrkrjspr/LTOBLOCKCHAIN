# Vehicle Information Fields Analysis

## Summary
This document identifies vehicle information fields that are stored in the database but are either:
1. Not collected in the registration form (making them default to placeholder values)
2. Displaying "N/A" unnecessarily
3. Using incorrect field name mappings

## Issues Found

### 1. Fields NOT Collected in Registration Form (But Stored in Database)

These fields have default values set in `js/registration-wizard.js` but are **never collected from users**:

#### a) `fuelType` / `fuel_type`
- **Location**: `js/registration-wizard.js:1038`
- **Default Value**: `'GASOLINE'`
- **Database**: Stored in `vehicles.fuel_type` (VARCHAR(20), DEFAULT 'GASOLINE')
- **Issue**: Always defaults to 'GASOLINE' regardless of actual vehicle fuel type
- **Display**: Used in `js/certificate-generator.js:275` where it shows 'N/A' if not present

#### b) `transmission`
- **Location**: `js/registration-wizard.js:1039`
- **Default Value**: `'AUTOMATIC'`
- **Database**: Stored in `vehicles.transmission` (VARCHAR(20), DEFAULT 'MANUAL')
- **Issue**: Always defaults to 'AUTOMATIC' regardless of actual transmission type
- **Display**: Not commonly displayed in UI, but included in API responses

#### c) `engineDisplacement` / `engine_displacement`
- **Location**: `js/registration-wizard.js:1040`
- **Default Value**: `'1.5L'`
- **Database**: Stored in `vehicles.engine_displacement` (VARCHAR(20))
- **Issue**: Always defaults to '1.5L' regardless of actual engine size
- **Display**: Used in certificate generator but with wrong field name mapping (see below)

### 2. Fields That Show "N/A" But Are Never Collected

These fields are referenced in code but **never collected** in the registration form:

#### a) `grossWeight` / `gross_weight`
- **Location**: `js/certificate-generator.js:277`
- **Display**: Shows 'N/A' in certificates
- **Database**: Not found in main vehicles table schema
- **Issue**: Field is referenced but never collected or stored

#### b) `netWeight` / `net_weight`
- **Location**: `js/certificate-generator.js:278`
- **Display**: Shows 'N/A' in certificates
- **Database**: Added via migration (`database/separate-or-cr.sql:22`)
- **Issue**: Field exists in database but never collected from users

#### c) `vehicleClassification` / `vehicle_classification`
- **Location**: `js/certificate-generator.js:280`
- **Display**: Shows 'N/A' in certificates
- **Database**: Added via migration (`database/separate-or-cr.sql:24`)
- **Issue**: Field exists in database but never collected from users

### 3. Field Name Mapping Issues

#### `displacement` vs `engine_displacement`
- **Location**: `js/certificate-generator.js:276`
- **Code**: `const displacement = vehicle.displacement || vehicle.piston_displacement || 'N/A';`
- **Actual Field**: `vehicle.engine_displacement`
- **Issue**: Certificate generator looks for `displacement` or `piston_displacement`, but the actual database field is `engine_displacement`
- **Result**: Always shows 'N/A' even when `engine_displacement` has a value

## Files Involved

### Registration Form
- `registration-wizard.html` (lines 1208-1296) - Vehicle information form
- `js/registration-wizard.js` (lines 1028-1041) - Data collection with defaults

### Database Schema
- `database/init-laptop.sql` (lines 36-58) - Main vehicles table
- `database/separate-or-cr.sql` (lines 22-24) - Additional fields migration

### Display/API Files
- `js/certificate-generator.js` (lines 270-280) - Certificate generation with N/A fields
- `backend/routes/vehicles.js` (lines 1972-2077) - API response formatting
- `js/admin-transfer-details.js` (lines 535-630) - Admin transfer details display
- `js/my-vehicle-ownership.js` (lines 179-324) - Vehicle ownership cards
- `js/owner-dashboard.js` (lines 1700-1732) - Owner dashboard vehicle display
- `js/admin-dashboard.js` (lines 3003-3036) - Admin dashboard vehicle display

### Backend Services
- `backend/database/services.js` (lines 89-103) - Vehicle creation service
- `backend/routes/vehicles.js` (lines 790-1338) - Vehicle registration endpoint

## Recommendations

### Option 1: Remove Unnecessary Fields (Recommended)
If these fields are not required for LTO registration:
1. Remove `fuelType`, `transmission`, `engineDisplacement` from registration data collection
2. Remove `grossWeight`, `netWeight`, `vehicleClassification` from certificate generator
3. Update database schema to make these fields nullable or remove them
4. Update API responses to exclude these fields

### Option 2: Collect Missing Fields
If these fields are required:
1. Add form fields in `registration-wizard.html` for:
   - Fuel Type (dropdown: GASOLINE, DIESEL, ELECTRIC, HYBRID, etc.)
   - Transmission (dropdown: AUTOMATIC, MANUAL, CVT, etc.)
   - Engine Displacement (input field)
   - Net Weight (input field, optional)
   - Vehicle Classification (dropdown, optional)
2. Update validation in `js/registration-wizard.js`
3. Remove default values and require user input

### Option 3: Fix Field Name Mapping
1. Update `js/certificate-generator.js:276` to use correct field name:
   ```javascript
   const displacement = vehicle.engine_displacement || vehicle.engineDisplacement || 'N/A';
   ```

## Priority Fixes

### High Priority
1. **Fix displacement field mapping** in `js/certificate-generator.js:276`
2. **Remove or collect `fuelType`** - Currently always 'GASOLINE'
3. **Remove or collect `transmission`** - Currently always 'AUTOMATIC'
4. **Remove or collect `engineDisplacement`** - Currently always '1.5L'

### Medium Priority
5. **Remove `grossWeight`** from certificate generator (not in database)
6. **Remove or collect `netWeight`** - Shows N/A
7. **Remove or collect `vehicleClassification`** - Shows N/A

## Impact Assessment

### Current State
- Users cannot provide accurate fuel type, transmission, or engine displacement
- Certificates show incorrect or 'N/A' values for these fields
- Database stores default/placeholder values that may not reflect actual vehicle specs

### After Fixes
- Either fields will be properly collected from users OR removed if unnecessary
- Certificates will show accurate information or omit unnecessary fields
- Database will contain only relevant, user-provided data
