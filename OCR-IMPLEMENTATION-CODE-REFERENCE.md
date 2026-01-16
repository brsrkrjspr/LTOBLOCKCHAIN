# OCR Philippine Document Update - Code Examples & Implementation Details

---

## Complete Pattern Library

### VIN/Chassis Number Pattern
**Purpose:** Extract 17-character VIN from compound labels in Philippine documents

```javascript
// Pattern handles: "Chassis/VIN: XXXX", "Chassis No. XXXX", "VIN: XXXX"
const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
const vinMatches = text.match(vinPattern);
if (vinMatches && vinMatches[1]) {
    extracted.vin = vinMatches[1].trim();
    extracted.chassisNumber = vinMatches[1].trim();  // DUAL ASSIGNMENT (Philippine docs)
    console.debug('[Document] VIN extracted (compound-label-aware):', extracted.vin);
}
```

**Pattern Breakdown:**
- `(?:Chassis\/VIN|Chassis\s*No\.?|VIN)` - Match ANY of: "Chassis/VIN", "Chassis No", "Chassis No.", "VIN"
- `\s*[:.]?\s*` - Optional spacing + optional colon or period + optional spacing
- `([A-HJ-NPR-Z0-9]{17})` - Capture exactly 17 alphanumeric characters (excluding I, O, Q per ISO standard)
- `/i` - Case-insensitive flag

**Test Cases:**
```
"Chassis/VIN: 4T1BF1AK5CU123456" → ✅ Matches
"Chassis No.: 4T1BF1AK5CU123456" → ✅ Matches
"VIN . 4T1BF1AK5CU123456" → ✅ Matches
"chassis/vin 4t1bf1ak5cu123456" → ✅ Matches (case-insensitive)
"Engine No.: 4T1BF1AK5CU123456" → ❌ Wrong label
```

---

### Make/Brand Pattern (Compound Label Aware)
**Purpose:** Extract vehicle make/brand from labels like "Make/Brand"

```javascript
// Pattern handles: "Make/Brand: TOYOTA", "Make: TOYOTA", "Make/Brand: TOYOTA COROLLA"
const makePattern = /(?:Make\/Brand|Make)\s*[:.]?\s*([A-Z\s]+?)(?=\n|$|Model|Series)/i;
const makeMatches = text.match(makePattern);
if (makeMatches && makeMatches[1]) {
    const fullMake = makeMatches[1].trim();
    extracted.makeComplete = fullMake;
    extracted.make = fullMake.split(/\s+/)[0];  // First word as primary make
    console.debug('[Document] Make extracted:', extracted.make, '(full:', extracted.makeComplete + ')');
}
```

**Pattern Breakdown:**
- `(?:Make\/Brand|Make)` - Match: "Make/Brand" OR "Make"
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `([A-Z\s]+?)` - Capture one or more uppercase letters/spaces (non-greedy)
- `(?=\n|$|Model|Series)` - Lookahead: stop at newline, end of string, "Model", or "Series"
- `/i` - Case-insensitive

**Test Cases:**
```
"Make/Brand: TOYOTA" → make: "TOYOTA", makeComplete: "TOYOTA"
"Make: TOYOTA COROLLA" → make: "TOYOTA", makeComplete: "TOYOTA COROLLA"
"Make: Ford F-150\nModel: F-150" → make: "FORD", makeComplete: "FORD" (stops at newline)
```

---

### Series/Model Pattern (Compound Label Aware)
**Purpose:** Extract vehicle series/model from compound labels

```javascript
// Pattern handles: "Model/Series: COROLLA", "Series / Model: COROLLA", "Model: COROLLA"
const seriesPattern = /(?:Model\/Series|Series\s*\/\s*Model|Model)\s*[:.]?\s*([A-Z0-9\s-]+?)(?=\n|$|Variant|Body|Year)/i;
const seriesMatches = text.match(seriesPattern);
if (seriesMatches && seriesMatches[1]) {
    extracted.series = seriesMatches[1].trim();
    extracted.model = seriesMatches[1].trim();  // Backwards compatibility
    console.debug('[Document] Series/Model extracted:', extracted.series);
}
```

**Pattern Breakdown:**
- `(?:Model\/Series|Series\s*\/\s*Model|Model)` - Match: "Model/Series" or "Series / Model" (spaces) or "Model"
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `([A-Z0-9\s-]+?)` - Capture uppercase, digits, spaces, hyphens (non-greedy)
- `(?=\n|$|Variant|Body|Year)` - Lookahead: stop at newline, end, or next major field
- `/i` - Case-insensitive

**Test Cases:**
```
"Model/Series: COROLLA" → ✅ "COROLLA"
"Series / Model: COROLLA" → ✅ "COROLLA"
"Model: COROLLA SE" → ✅ "COROLLA SE"
"Model: COROLLA SE\nBody Type: Sedan" → ✅ "COROLLA SE" (stops at newline)
```

---

### Engine Number Pattern (Multiple Variants)
**Purpose:** Extract engine number from labels like "Engine Number", "Engine No.", or "Motor No."

```javascript
// Pattern handles: "Engine Number: ABC123", "Engine No.: ABC123", "Motor No.: ABC123"
const enginePattern = /(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)\s*[:.]?\s*([A-Z0-9]+)/i;
const engineMatches = text.match(enginePattern);
if (engineMatches && engineMatches[1]) {
    extracted.engineNumber = engineMatches[1].trim();
    console.debug('[Document] Engine Number extracted:', extracted.engineNumber);
}
```

**Pattern Breakdown:**
- `(?:Engine\s*Number|Engine\s*No\.?|Motor\s*No\.?)` - Match any of: "Engine Number", "Engine No", "Engine No.", "Motor No", "Motor No."
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `([A-Z0-9]+)` - Capture alphanumeric characters
- `/i` - Case-insensitive

**Test Cases:**
```
"Engine Number: K3VE123456" → ✅ "K3VE123456"
"Engine No.: K3VE123456" → ✅ "K3VE123456"
"Motor No.: K3VE123456" → ✅ "K3VE123456"
"motor no. k3ve123456" → ✅ "K3VE123456" (case-insensitive)
```

---

### Plate Number Pattern with "To be issued" Handling
**Purpose:** Extract plate number or detect "To be issued" status

```javascript
// Pattern handles: "Plate No.: ABC 1234", "Plate Number: ABC-1234", "To be issued"
const platePattern = /(?:Plate\s*(?:No\.?|Number))\s*[:.]?\s*([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)/i;
const plateMatches = text.match(platePattern);
if (plateMatches && plateMatches[1]) {
    if (plateMatches[1].toLowerCase().includes('to be issued')) {
        extracted.plateNumber = '';  // EMPTY STRING for unissued plates (Philippine docs)
        console.debug('[Document] Plate marked as "To be issued" - set to empty');
    } else {
        // Standardize format: remove spaces, add hyphens, uppercase
        extracted.plateNumber = plateMatches[1].replace(/\s/g, '-').toUpperCase().trim();
        console.debug('[Document] Plate Number extracted:', extracted.plateNumber);
    }
}
```

**Pattern Breakdown:**
- `(?:Plate\s*(?:No\.?|Number))` - Match: "Plate No", "Plate No.", "Plate Number"
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `([A-Z]{3}\s?[-]?\s?\d{3,4}|To\s*be\s*issued)` - Capture EITHER:
  - `[A-Z]{3}\s?[-]?\s?\d{3,4}` - 3 letters + optional space/hyphen + 3-4 digits (ABC 1234, ABC-1234)
  - `To\s*be\s*issued` - Exact text "To be issued" (spaces flexible)
- `/i` - Case-insensitive

**Test Cases:**
```
"Plate No.: ABC 1234" → plateNumber: "ABC-1234"
"Plate Number: ABC-1234" → plateNumber: "ABC-1234"
"Plate No.: ABC1234" → plateNumber: "ABC-1234"
"Plate Number: To be issued" → plateNumber: "" (EMPTY STRING)
"Plate No. to  be   issued" → plateNumber: "" (spaces flexible, case-insensitive)
"Plate No.: XYZ 5678" → plateNumber: "XYZ-5678"
```

---

### Body Type Pattern
**Purpose:** Extract vehicle body type (Sedan, SUV, Truck, etc.)

```javascript
// Pattern handles: "Body Type: Sedan", "Body Type: SUV", stops at next major field
const bodyTypePattern = /(?:Body\s*Type)\s*[:.]?\s*([A-Z0-9\s]+?)(?=\n|$|Year|Color)/i;
const bodyTypeMatches = text.match(bodyTypePattern);
if (bodyTypeMatches && bodyTypeMatches[1]) {
    extracted.bodyType = bodyTypeMatches[1].trim();
    console.debug('[Document] Body Type extracted:', extracted.bodyType);
}
```

**Pattern Breakdown:**
- `(?:Body\s*Type)` - Match: "Body Type"
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `([A-Z0-9\s]+?)` - Capture uppercase letters, digits, spaces (non-greedy)
- `(?=\n|$|Year|Color)` - Lookahead: stop at newline, end, "Year", or "Color"
- `/i` - Case-insensitive

**Test Cases:**
```
"Body Type: Sedan" → ✅ "SEDAN"
"Body Type: SUV" → ✅ "SUV"
"Body Type: Pickup Truck" → ✅ "PICKUP TRUCK"
"Body Type: Sedan\nColor: Black" → ✅ "SEDAN" (stops at newline)
```

---

### Year Model Pattern
**Purpose:** Extract 4-digit year of vehicle model

```javascript
// Pattern handles: "Year Model: 2022", "Year: 2022", "Model Year: 2022"
const yearModelPattern = /(?:Year\s*Model|Model\s*Year|Year)\s*[:.]?\s*(\d{4})/i;
const yearModelMatches = text.match(yearModelPattern);
if (yearModelMatches && yearModelMatches[1]) {
    extracted.yearModel = yearModelMatches[1].trim();
    extracted.year = yearModelMatches[1].trim();  // Backwards compatibility
    console.debug('[Document] Year Model extracted:', extracted.yearModel);
}
```

**Pattern Breakdown:**
- `(?:Year\s*Model|Model\s*Year|Year)` - Match: "Year Model", "Model Year", or "Year"
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `(\d{4})` - Capture exactly 4 digits
- `/i` - Case-insensitive

**Test Cases:**
```
"Year Model: 2022" → ✅ "2022"
"Model Year: 2022" → ✅ "2022"
"Year: 2022" → ✅ "2022"
"year . 2022" → ✅ "2022"
```

---

### Weight Patterns (Numeric with Decimal Support)
**Purpose:** Extract gross weight or net capacity

```javascript
// Gross Weight: Supports "Gross Wt", "Gross Wt.", "Gross Weight"
const grossWeightPattern = /(?:Gross\s*(?:Wt|Weight)\.?)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
const grossWeightMatches = text.match(grossWeightPattern);
if (grossWeightMatches && grossWeightMatches[1]) {
    extracted.grossWeight = grossWeightMatches[1].trim();
    console.debug('[Document] Gross Weight extracted:', extracted.grossWeight);
}

// Net Capacity: Supports "Net Cap", "Net Capacity", "Net Wt", "Net Weight"
const netCapacityPattern = /(?:Net\s*(?:Cap|Capacity|Wt|Weight)\.?)\s*[:.]?\s*(\d+(?:\.\d+)?)/i;
const netCapacityMatches = text.match(netCapacityPattern);
if (netCapacityMatches && netCapacityMatches[1]) {
    extracted.netCapacity = netCapacityMatches[1].trim();
    extracted.netWeight = netCapacityMatches[1].trim();  // Backwards compatibility
    console.debug('[Document] Net Capacity extracted:', extracted.netCapacity);
}
```

**Pattern Breakdown:**
- `(?:Gross\s*(?:Wt|Weight)\.?)` - Match: "Gross Wt", "Gross Wt.", "Gross Weight"
- `\s*[:.]?\s*` - Optional spacing + optional colon/period + optional spacing
- `(\d+(?:\.\d+)?)` - Capture: one or more digits, optionally followed by decimal point + digits
  - `\d+` - One or more digits
  - `(?:\.\d+)?` - Optional group: period + one or more digits (for decimals)
- `/i` - Case-insensitive

**Test Cases:**
```
"Gross Wt: 1500" → ✅ "1500"
"Gross Weight: 1500.5" → ✅ "1500.5"
"Net Cap: 1200" → ✅ "1200"
"Net Capacity: 1200.75" → ✅ "1200.75"
"GROSS WT. 1500.0" → ✅ "1500.0"
```

---

## Frontend Dual VIN Mapping Implementation

```javascript
/**
 * Special handling for VIN field: Populates BOTH vin AND chassisNumber inputs
 * This is specific to Philippine vehicle documents where VIN = Chassis Number
 * 
 * Feature: OCR extraction creates vin field → Frontend maps to both HTML inputs
 */
if (ocrField === 'vin' && value) {
    // Get both form inputs
    const vinInput = document.getElementById('vin');
    const chassisInput = document.getElementById('chassisNumber');
    
    // Fill VIN input if empty
    if (vinInput && !vinInput.value) {
        vinInput.value = value.trim();
        vinInput.classList.add('ocr-auto-filled');  // Visual indicator
        vinInput.dispatchEvent(new Event('change', { bubbles: true }));
        vinInput.dispatchEvent(new Event('input', { bubbles: true }));
        fieldsFilled++;
        console.log(`[OCR AutoFill] VIN field filled: vin = "${value.trim()}"`);
    }
    
    // Fill Chassis Number input if empty (same value)
    if (chassisInput && !chassisInput.value) {
        chassisInput.value = value.trim();
        chassisInput.classList.add('ocr-auto-filled');  // Visual indicator
        chassisInput.dispatchEvent(new Event('change', { bubbles: true }));
        chassisInput.dispatchEvent(new Event('input', { bubbles: true }));
        fieldsFilled++;
        console.log(`[OCR AutoFill] Chassis Number field filled (from VIN): chassisNumber = "${value.trim()}"`);
    }
    
    return;  // Skip regular mapping for VIN
}
```

**Benefits:**
- Single OCR extraction populates two form fields
- Consistent data (both receive same VIN value)
- Events dispatched for validation/listeners
- CSS marking for visual feedback
- Prevents duplicate assignments through special handling

---

## Error Handling Pattern

**Applied to all 5 document types:**

```javascript
if (documentType === 'registration_cert' || documentType === 'registrationCert' || documentType === 'or_cr') {
    // Extract ALL LTO Vehicle Information fields with document-aware regex patterns
    try {
        // VIN Pattern
        const vinPattern = /(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i;
        const vinMatches = text.match(vinPattern);
        if (vinMatches && vinMatches[1]) {
            extracted.vin = vinMatches[1].trim();
            extracted.chassisNumber = vinMatches[1].trim();
            console.debug('[RegCert] VIN extracted (compound-label-aware):', extracted.vin);
        }
        
        // ... additional patterns ...
        
        // All extraction patterns wrapped in try block
    } catch (error) {
        // Comprehensive error logging
        console.error('[RegCert] Error during extraction:', error);
        // Extraction gracefully fails without crashing entire process
    }
}
```

**Error Handling Features:**
- Wraps all extraction in try/catch block
- Prevents malformed OCR text from crashing service
- Logs errors with document type prefix
- Allows partial extraction (some fields may succeed even if others fail)
- Console error visible in server/browser logs for debugging

---

## Debug Logging Examples

### Successful Extraction
```
[RegCert] VIN extracted (compound-label-aware): 4T1BF1AK5CU123456
[RegCert] Engine Number extracted: K3VE123456
[RegCert] Make extracted: TOYOTA (full: TOYOTA COROLLA)
[RegCert] Plate marked as "To be issued" - set to empty
[RegCert] Series/Model extracted: COROLLA
[RegCert] Year Model extracted: 2022
[RegCert] Gross Weight extracted: 1545.5
```

### Frontend Auto-Fill
```
[OCR AutoFill] Processing extracted data: {vin: "4T1BF1AK5CU123456", make: "TOYOTA", ...} Document type: registration_cert
[OCR AutoFill] VIN field filled: vin = "4T1BF1AK5CU123456"
[OCR AutoFill] Chassis Number field filled (from VIN): chassisNumber = "4T1BF1AK5CU123456"
[OCR AutoFill] Field filled: make → make = "TOYOTA"
[OCR AutoFill] Field filled: series → model = "COROLLA"
[OCR AutoFill] Successfully auto-filled 5 field(s) from document type: registration_cert
```

### Error Scenarios
```
[RegCert] Error during extraction: SyntaxError: Invalid regular expression
[OCR AutoFill] No mapping found for OCR field: unknownField
[OCR AutoFill] HTML element not found: vehicleTypee (typo in ID)
[OCR AutoFill] Field already has value, skipping: vin
```

---

## Validation Rules

### VIN Format
- **Length:** Exactly 17 characters
- **Characters:** A-Z (except I, O, Q), 0-9
- **Dual Assignment:** Must populate both `vin` AND `chassisNumber` fields

### Plate Number Format
- **Format:** 3 letters + 3-4 digits (e.g., "ABC-1234")
- **Special Case:** "To be issued" → Returns empty string ""
- **Standardization:** Convert to uppercase, remove spaces, add hyphens

### Engine Number
- **Format:** Alphanumeric string
- **Variants Supported:** "Engine Number", "Engine No.", "Motor No."

### Year Model
- **Format:** Exactly 4 digits (1900-2099)
- **Range:** Typically 2000-2030 for vehicle registrations

### Make/Brand
- **Format:** Alphanumeric with spaces allowed
- **Compound Labels:** "Make/Brand" supported with split logic
- **Storage:** Primary make (first word) + complete make (full value)

### Weights
- **Format:** Numeric with optional decimal places
- **Examples:** "1500", "1500.5", "1200.75"
- **Regex Support:** `(\d+(?:\.\d+)?)` allows both integer and decimal

---

## Migration Checklist

### Backend Deployment
- [ ] Backup current `ocrService.js`
- [ ] Replace VIN pattern with `/(?:Chassis\/VIN|Chassis\s*No\.?|VIN)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{17})/i`
- [ ] Add "To be issued" handling for plate numbers
- [ ] Implement Make/Brand compound label recognition
- [ ] Add try/catch error handling to all document types
- [ ] Enable debug logging
- [ ] Test with sample Philippine documents
- [ ] Verify dual VIN assignment (vin + chassisNumber)
- [ ] Test error scenarios (malformed OCR text)
- [ ] Deploy to staging environment
- [ ] Monitor error logs for 24 hours
- [ ] Deploy to production

### Frontend Deployment
- [ ] Backup current `registration-wizard.js`
- [ ] Add special VIN handling block (lines 2003-2043)
- [ ] Verify both form input IDs exist: `vin` and `chassisNumber`
- [ ] Test OCR form submission
- [ ] Verify both fields auto-populate
- [ ] Check CSS class `ocr-auto-filled` applied
- [ ] Test validation triggers (events dispatched)
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

