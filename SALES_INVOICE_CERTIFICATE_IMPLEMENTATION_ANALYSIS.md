# Sales Invoice Certificate Implementation - Comprehensive Analysis

**Date:** 2026-01-XX  
**Status:** 📋 ANALYSIS COMPLETE - READY FOR IMPLEMENTATION

---

## Executive Summary

This document provides a comprehensive analysis of all files and components that need to be modified to add **Sales Invoice** as the 5th certificate alongside the existing 4 certificates:
1. Insurance Certificate (CTPL)
2. Emission Certificate (ETC)
3. HPG Clearance
4. CSR Certificate (Certificate of Stock Report)
5. **Sales Invoice** (NEW)

---

## Current Certificate Architecture

### Certificate Generation Flow
1. **Route Handler** (`backend/routes/certificate-generation.js`) - Receives API request
2. **PDF Generator Service** (`backend/services/certificatePdfGenerator.js`) - Generates PDF from HTML template
3. **Email Service** (`backend/services/certificateEmailService.js`) - Sends certificate via email
4. **Database Storage** (`issued_certificates` table) - Stores certificate metadata
5. **Blockchain Storage** - Stores composite hash for verification

### Batch Generation Endpoint
- **Route:** `POST /api/certificate-generation/batch/generate-all`
- **Current Certificates:** Insurance, Emission, HPG, CSR (4 certificates)
- **Target:** Add Sales Invoice (5 certificates total)

---

## Affected Files & Implementation Requirements

### 🔴 **CRITICAL - Core Certificate Generation**

#### 1. `backend/services/certificatePdfGenerator.js`
**Status:** ⚠️ **MUST MODIFY**

**Changes Required:**
- Add `async generateSalesInvoice(data)` method
- Follow pattern of existing methods (`generateInsuranceCertificate`, `generateEmissionCertificate`, `generateHpgClearance`, `generateCsrCertificate`)
- Load template from `mock_certs/Sales Invoice/sales-invoice.html`
- Load CSS from `mock_certs/Sales Invoice/sales-invoice.css`
- Replace template placeholders with actual data:
  - Invoice number (auto-generate: `INV-YYYYMMDD-XXXXXX`)
  - Date of sale
  - Buyer name (ownerName)
  - Vehicle details (make, model, year, body type, color, fuel type, engine, chassis/VIN, plate)
  - Purchase price
  - Seller information
  - Authentication date
- Generate PDF using Puppeteer
- Return `{ pdfBuffer, fileHash, certificateNumber }`

**Template Path:**
```javascript
const templatePath = path.join(this.templatesPath, 'Sales Invoice', 'sales-invoice.html');
const cssPath = path.join(this.templatesPath, 'Sales Invoice', 'sales-invoice.css');
```

**Template Fields to Replace:**
- `#buyer-name` → ownerName
- `#vehicle-make` → vehicleMake
- `#vehicle-model` → vehicleModel
- `#vehicle-year` → vehicleYear
- `#vehicle-body` → bodyType
- `#vehicle-color` → color
- `#vehicle-fuel` → fuelType
- `#vehicle-engine` → engineNumber
- `#vehicle-chassis` → vehicleVIN
- `#vehicle-plate` → vehiclePlate
- `#date-sale` → dateOfSale
- `#date-auth` → authenticationDate
- `#stamp-date` → authenticationDate
- `#seller-date` → dateOfSale
- Invoice number in `.meta` section
- Total amount paid (if provided)

---

#### 2. `backend/routes/certificate-generation.js`
**Status:** ⚠️ **MUST MODIFY**

**Changes Required:**

**A. Add Individual Sales Invoice Endpoint:**
- Add `POST /api/certificate-generation/sales-invoice/generate-and-send`
- Follow pattern of `/insurance/generate-and-send`, `/emission/generate-and-send`, `/hpg/generate-and-send`
- Required fields: `ownerEmail`, `ownerName`
- Optional fields: `vehicleVIN`, `vehiclePlate`, `vehicleMake`, `vehicleModel`, `vehicleYear`, `bodyType`, `color`, `fuelType`, `engineNumber`, `invoiceNumber`, `dateOfSale`, `purchasePrice`, `sellerName`, `sellerPosition`, `dealerName`, `dealerTin`, `dealerAccreditationNo`
- Auto-generate invoice number: `INV-YYYYMMDD-XXXXXX`
- Call `certificatePdfGenerator.generateSalesInvoice()`
- Generate composite hash
- Store in `issued_certificates` table (certificate_type: `'sales_invoice'`)
- Send email via `certificateEmailService.sendSalesInvoice()`

**B. Update Batch Generation Endpoint:**
- **Line ~716:** Add `salesInvoice` to request body destructuring
- **Line ~855:** Add sales invoice certificate number generation:
  ```javascript
  salesInvoice: salesInvoice?.invoiceNumber || `INV-${year}${month}${day}-${randomSuffix()}`
  ```
- **Line ~1193:** Update success count check from `4` to `5`:
  ```javascript
  const allSuccess = successCount === 5 && !hasErrors;
  ```
- **Line ~1195:** Update log message:
  ```javascript
  console.log(`[Batch Certificate Generation] Completed: ${successCount}/5 certificates generated`);
  ```
- **After CSR generation (after line ~1188):** Add Sales Invoice generation block:
  ```javascript
  // Generate Sales Invoice
  try {
      console.log(`[Batch] Generating Sales Invoice: ${certificateNumbers.salesInvoice}`);
      const salesInvoiceData = {
          ownerName: sharedVehicleData.ownerName,
          vehicleVIN: sharedVehicleData.vin,
          vehiclePlate: sharedVehicleData.plate,
          vehicleMake: sharedVehicleData.make,
          vehicleModel: sharedVehicleData.model,
          vehicleYear: sharedVehicleData.year,
          bodyType: sharedVehicleData.bodyType,
          color: sharedVehicleData.color,
          fuelType: sharedVehicleData.fuelType,
          engineNumber: sharedVehicleData.engineNumber,
          invoiceNumber: certificateNumbers.salesInvoice,
          dateOfSale: salesInvoice?.dateOfSale || issuanceDate,
          purchasePrice: salesInvoice?.purchasePrice,
          sellerName: salesInvoice?.sellerName,
          sellerPosition: salesInvoice?.sellerPosition,
          dealerName: salesInvoice?.dealerName,
          dealerTin: salesInvoice?.dealerTin,
          dealerAccreditationNo: salesInvoice?.dealerAccreditationNo
      };

      const salesInvoiceResult = await certificatePdfGenerator.generateSalesInvoice(salesInvoiceData);
      const salesInvoiceCompositeHash = certificatePdfGenerator.generateCompositeHash(
          certificateNumbers.salesInvoice,
          sharedVehicleData.vin,
          salesInvoiceData.dateOfSale.split('T')[0],
          salesInvoiceResult.fileHash
      );

      // Store in database
      try {
          const issuerQuery = await db.query(
              `SELECT id FROM external_issuers WHERE issuer_type = 'sales_invoice' AND is_active = true LIMIT 1`
          );
          if (issuerQuery.rows.length > 0) {
              await db.query(
                  `INSERT INTO issued_certificates 
                  (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, 
                   file_hash, composite_hash, certificate_data, effective_date)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                  [
                      issuerQuery.rows[0].id,
                      'sales_invoice',
                      certificateNumbers.salesInvoice,
                      sharedVehicleData.vin,
                      sharedVehicleData.ownerName,
                      salesInvoiceResult.fileHash,
                      salesInvoiceCompositeHash,
                      JSON.stringify({
                          purchasePrice: salesInvoiceData.purchasePrice,
                          dealerName: salesInvoiceData.dealerName,
                          dealerTin: salesInvoiceData.dealerTin,
                          dealerAccreditationNo: salesInvoiceData.dealerAccreditationNo
                      }),
                      salesInvoiceData.dateOfSale.split('T')[0]
                  ]
              );
          }
      } catch (dbError) {
          console.error(`[Batch] Sales Invoice database error:`, dbError);
      }

      // Send email
      await certificateEmailService.sendSalesInvoice({
          to: ownerEmail,
          ownerName: sharedVehicleData.ownerName,
          invoiceNumber: certificateNumbers.salesInvoice,
          vehicleVIN: sharedVehicleData.vin,
          vehicleMake: sharedVehicleData.make,
          vehicleModel: sharedVehicleData.model,
          pdfBuffer: salesInvoiceResult.pdfBuffer
      });

      results.certificates.salesInvoice = {
          invoiceNumber: certificateNumbers.salesInvoice,
          fileHash: salesInvoiceResult.fileHash,
          compositeHash: salesInvoiceCompositeHash,
          emailSent: true
      };
      console.log(`[Batch] Sales Invoice generated and sent`);
  } catch (error) {
      console.error('[Batch] Sales Invoice error:', error);
      results.errors.push({ type: 'salesInvoice', error: error.message });
  }
  ```

---

#### 3. `backend/services/certificateEmailService.js`
**Status:** ⚠️ **MUST MODIFY**

**Changes Required:**
- Add `async sendSalesInvoice({ to, ownerName, invoiceNumber, vehicleVIN, vehicleMake, vehicleModel, pdfBuffer })` method
- Follow pattern of `sendInsuranceCertificate`, `sendEmissionCertificate`, `sendHpgClearance`, `sendCsrCertificate`
- Create HTML email template with:
  - Subject: `Sales Invoice - Invoice ${invoiceNumber}`
  - Professional email body with invoice details
  - Attach PDF buffer
- Use `gmailApiService.sendEmailWithAttachment()`

**Email Template Structure:**
```javascript
const subject = `Sales Invoice - Invoice ${invoiceNumber}`;
const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        /* Similar styling to other certificate emails */
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Sales Invoice Issued</h1>
            <p>Your vehicle sales invoice is ready</p>
        </div>
        <div class="content">
            <p>Dear ${ownerName},</p>
            <p>Your sales invoice has been successfully issued...</p>
            <div class="info-box">
                <p><span class="info-label">Invoice Number:</span> ${invoiceNumber}</p>
                <p><span class="info-label">Vehicle:</span> ${vehicleMake} ${vehicleModel}</p>
                <p><span class="info-label">VIN:</span> ${vehicleVIN}</p>
            </div>
        </div>
    </div>
</body>
</html>
`;
```

---

### 🟡 **IMPORTANT - Database & Configuration**

#### 4. `backend/config/documentTypes.js`
**Status:** ✅ **ALREADY CONFIGURED**

**Current Status:**
- Sales Invoice is already defined:
  - `LOGICAL_TYPES.SALES_INVOICE = 'salesInvoice'`
  - `DB_TYPES.SALES_INVOICE = 'sales_invoice'`
  - Mapping functions already include sales invoice
- **No changes needed** ✅

---

#### 5. Database Schema - `external_issuers` table
**Status:** ⚠️ **MUST UPDATE**

**File:** `database/add-external-issuer-certificates.sql` (Line 7)

**Current Constraint:**
```sql
issuer_type VARCHAR(20) NOT NULL CHECK (issuer_type IN ('insurance', 'emission', 'hpg', 'csr'))
```

**Changes Required:**
- Update CHECK constraint to include `'sales_invoice'`
- **Update to:** `CHECK (issuer_type IN ('insurance', 'emission', 'hpg', 'csr', 'sales_invoice'))`

**SQL Migration Needed:**
```sql
-- Add sales_invoice to external_issuers issuer_type constraint
ALTER TABLE external_issuers 
DROP CONSTRAINT IF EXISTS external_issuers_issuer_type_check;

ALTER TABLE external_issuers 
ADD CONSTRAINT external_issuers_issuer_type_check 
CHECK (issuer_type IN ('insurance', 'emission', 'hpg', 'csr', 'sales_invoice'));
```

---

#### 6. Database Schema - `issued_certificates` table
**Status:** ⚠️ **MUST UPDATE**

**File:** `database/add-external-issuer-certificates.sql` (Line 26)

**Current Constraint:**
```sql
certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr'))
```

**Changes Required:**
- Update CHECK constraint to include `'sales_invoice'`
- **Update to:** `CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'))`

**SQL Migration Needed:**
```sql
-- Add sales_invoice to issued_certificates certificate_type constraint
ALTER TABLE issued_certificates 
DROP CONSTRAINT IF EXISTS issued_certificates_certificate_type_check;

ALTER TABLE issued_certificates 
ADD CONSTRAINT issued_certificates_certificate_type_check 
CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'));
```

---

#### 7. Database Schema - `certificate_submissions` table
**Status:** ⚠️ **MUST UPDATE**

**File:** `database/add-external-issuer-certificates.sql` (Line 54)

**Current Constraint:**
```sql
certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr'))
```

**Changes Required:**
- Update CHECK constraint to include `'sales_invoice'`
- **Update to:** `CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'))`

**SQL Migration Needed:**
```sql
-- Add sales_invoice to certificate_submissions certificate_type constraint
ALTER TABLE certificate_submissions 
DROP CONSTRAINT IF EXISTS certificate_submissions_certificate_type_check;

ALTER TABLE certificate_submissions 
ADD CONSTRAINT certificate_submissions_certificate_type_check 
CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'));
```

---

#### 8. Database Schema - `certificates` table
**Status:** ⚠️ **MUST UPDATE**

**File:** `database/add-clearance-workflow.sql` (Line 35)

**Current Constraint:**
```sql
certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('hpg_clearance', 'insurance', 'emission'))
```

**Changes Required:**
- Update CHECK constraint to include `'csr'` and `'sales_invoice'`
- **Update to:** `CHECK (certificate_type IN ('hpg_clearance', 'insurance', 'emission', 'csr', 'sales_invoice'))`

**Note:** This table appears to be used for clearance workflow certificates. Sales Invoice may or may not be part of clearance workflow, but constraint should be updated for consistency.

---

### 🟢 **OPTIONAL - Frontend & UI Updates**

#### 7. `js/certificate-generator.js` (if exists)
**Status:** ⚠️ **CHECK IF USED**

**Changes Required (if file exists and is used):**
- Add Sales Invoice option to certificate type selector
- Add Sales Invoice form fields
- Add Sales Invoice to batch generation UI

---

#### 8. Frontend Certificate Generator HTML
**Status:** ⚠️ **CHECK IF EXISTS**

**Files to Check:**
- `certificate-generator.html` (if exists)
- Any admin dashboard certificate generation UI

**Changes Required:**
- Add Sales Invoice checkbox/option
- Add Sales Invoice-specific form fields:
  - Invoice Number (optional, auto-generated)
  - Date of Sale
  - Purchase Price
  - Seller Name
  - Seller Position
  - Dealer Name
  - Dealer TIN
  - Dealer Accreditation Number

---

### 🔵 **VERIFICATION & VALIDATION**

#### 9. `backend/services/autoVerificationService.js`
**Status:** ⚠️ **MAY NEED UPDATE**

**Changes Required (if sales invoice needs auto-verification):**
- Add sales invoice pattern validation in `getDocumentNumberPatterns()`
- Add sales invoice format validation in `validateDocumentNumberFormat()`
- Invoice number format: `INV-YYYYMMDD-XXXXXX` (similar to emission)

**Pattern to Add:**
```javascript
sales_invoice: {
    patterns: [
        /^INV-\d{8}-[A-Z0-9]{6}$/i, // INV-YYYYMMDD-XXXXXX
    ],
    description: 'Sales Invoice Number (INV-YYYYMMDD-XXXXXX)'
}
```

---

#### 10. `backend/services/ocrService.js`
**Status:** ⚠️ **MAY NEED UPDATE**

**Changes Required (if sales invoice documents need OCR extraction):**
- Add sales invoice number extraction pattern
- Pattern: `INV-\d{8}-[A-Z0-9]{6}` or similar
- Add to document type detection logic

---

### 🟣 **DOCUMENTATION & TEMPLATES**

#### 11. Certificate Template Files
**Status:** ✅ **ALREADY EXISTS**

**Files:**
- `mock_certs/Sales Invoice/sales-invoice.html` ✅
- `mock_certs/Sales Invoice/sales-invoice.css` ✅

**No changes needed** - Templates already exist ✅

---

#### 12. Database Migration Files
**Status:** ⚠️ **CREATE NEW**

**File to Create:** `database/add-sales-invoice-certificate.sql`

**Content:**
```sql
-- Migration: Add Sales Invoice certificate support
-- Date: 2026-01-XX

-- Update external_issuers issuer_type constraint
ALTER TABLE external_issuers 
DROP CONSTRAINT IF EXISTS external_issuers_issuer_type_check;

ALTER TABLE external_issuers 
ADD CONSTRAINT external_issuers_issuer_type_check 
CHECK (issuer_type IN ('insurance', 'emission', 'hpg', 'csr', 'sales_invoice'));

-- Update issued_certificates certificate_type constraint
ALTER TABLE issued_certificates 
DROP CONSTRAINT IF EXISTS issued_certificates_certificate_type_check;

ALTER TABLE issued_certificates 
ADD CONSTRAINT issued_certificates_certificate_type_check 
CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'));

-- Update certificate_submissions certificate_type constraint
ALTER TABLE certificate_submissions 
DROP CONSTRAINT IF EXISTS certificate_submissions_certificate_type_check;

ALTER TABLE certificate_submissions 
ADD CONSTRAINT certificate_submissions_certificate_type_check 
CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'));

-- Update certificates table certificate_type constraint (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'certificates') THEN
        ALTER TABLE certificates 
        DROP CONSTRAINT IF EXISTS certificates_certificate_type_check;

        ALTER TABLE certificates 
        ADD CONSTRAINT certificates_certificate_type_check 
        CHECK (certificate_type IN ('hpg_clearance', 'insurance', 'emission', 'csr', 'sales_invoice'));
        
        RAISE NOTICE 'Updated certificates table constraint';
    ELSE
        RAISE NOTICE 'certificates table does not exist, skipping';
    END IF;
END $$;

-- Create index for sales invoice lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_issued_certificates_sales_invoice 
ON issued_certificates(certificate_type, vehicle_vin) 
WHERE certificate_type = 'sales_invoice';

-- Seed test issuer for sales invoice (optional)
INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, contact_email)
VALUES ('sales_invoice', 'LTO Sales Invoice Service', 'SI-2026-001', 'test_sales_invoice_api_key_xyz', 'sales@lto.gov.ph')
ON CONFLICT (license_number) DO NOTHING;
```

---

## Implementation Checklist

### Phase 1: Core Generation (CRITICAL)
- [ ] Add `generateSalesInvoice()` method to `certificatePdfGenerator.js`
- [ ] Test PDF generation with sample data
- [ ] Verify template rendering and field replacement
- [ ] Test PDF buffer validation

### Phase 2: API Endpoints (CRITICAL)
- [ ] Add individual Sales Invoice endpoint (`/sales-invoice/generate-and-send`)
- [ ] Update batch generation endpoint to include Sales Invoice
- [ ] Update success count from 4 to 5
- [ ] Test individual endpoint
- [ ] Test batch endpoint with all 5 certificates

### Phase 3: Email Service (CRITICAL)
- [ ] Add `sendSalesInvoice()` method to `certificateEmailService.js`
- [ ] Create email template HTML
- [ ] Test email sending with PDF attachment

### Phase 4: Database (IMPORTANT)
- [ ] Create migration file for database constraints
- [ ] Run migration to update CHECK constraints
- [ ] Verify database accepts `'sales_invoice'` as valid type
- [ ] Test certificate storage in `issued_certificates` table

### Phase 5: Verification (OPTIONAL)
- [ ] Add sales invoice pattern validation (if needed)
- [ ] Add OCR extraction for sales invoice (if needed)
- [ ] Test auto-verification flow (if applicable)

### Phase 6: Frontend (OPTIONAL)
- [ ] Update certificate generator UI (if exists)
- [ ] Add Sales Invoice form fields
- [ ] Test UI integration

### Phase 7: Testing & Validation
- [ ] Test individual Sales Invoice generation
- [ ] Test batch generation with all 5 certificates
- [ ] Verify email delivery
- [ ] Verify database storage
- [ ] Verify blockchain hash storage (if applicable)
- [ ] Test error handling
- [ ] Test edge cases (missing fields, invalid data)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  API Request (POST /api/certificate-generation/...)         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  certificate-generation.js (Route Handler)                  │
│  - Validates input                                          │
│  - Auto-generates invoice number (INV-YYYYMMDD-XXXXXX)      │
│  - Calls PDF generator                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  certificatePdfGenerator.js                                  │
│  - Loads sales-invoice.html template                        │
│  - Loads sales-invoice.css                                  │
│  - Replaces template fields with data                       │
│  - Generates PDF using Puppeteer                            │
│  - Calculates file hash (SHA-256)                           │
│  - Returns { pdfBuffer, fileHash, certificateNumber }       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Generate Composite Hash                                    │
│  - certificateNumber | vehicleVIN | dateOfSale | fileHash   │
│  - SHA-256 hash for blockchain storage                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ├─────────────────────────────────────┐
                        │                                     │
                        ▼                                     ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  Database Storage                    │  │  Email Service                       │
│  - Store in issued_certificates      │  │  - Send PDF via email                │
│  - certificate_type: 'sales_invoice' │  │  - Include invoice details           │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

---

## Certificate Number Format

**Sales Invoice:** `INV-YYYYMMDD-XXXXXX`
- `INV` - Prefix
- `YYYYMMDD` - Date (8 digits)
- `XXXXXX` - Random alphanumeric (6 characters)

**Example:** `INV-20260118-A3B9C2`

---

## Required Data Fields

### Minimum Required:
- `ownerEmail` - Recipient email
- `ownerName` - Buyer name

### Auto-Generated (if not provided):
- `invoiceNumber` - Format: `INV-YYYYMMDD-XXXXXX`
- `vehicleVIN` - Random 17-character VIN
- `vehiclePlate` - Random plate number (ABC-1234)
- `dateOfSale` - Current date
- `engineNumber` - Random engine number
- `chassisNumber` - Random chassis number

### Optional Fields:
- `vehicleMake` - Default: 'Toyota'
- `vehicleModel` - Default: 'Vios'
- `vehicleYear` - Default: Current year
- `bodyType` - Default: 'Sedan'
- `color` - Default: 'White'
- `fuelType` - Default: 'Gasoline'
- `purchasePrice` - Total amount paid
- `sellerName` - Seller/Authorized signatory name
- `sellerPosition` - Seller position
- `dealerName` - Dealer/Company name
- `dealerTin` - Dealer TIN
- `dealerAccreditationNo` - Dealer accreditation number

---

## Security Considerations

1. **Authentication:** Sales Invoice endpoint should require authentication
2. **Authorization:** Determine appropriate role (admin, dealer, etc.)
3. **Input Validation:** Validate all input fields
4. **File Hash:** Ensure unique file hash to prevent duplicates
5. **Blockchain Storage:** Store composite hash on blockchain for verification
6. **Email Security:** Ensure email contains only necessary information

---

## Testing Strategy

### Unit Tests:
- Test `generateSalesInvoice()` with various data combinations
- Test template field replacement
- Test PDF buffer generation
- Test hash calculation

### Integration Tests:
- Test individual endpoint with valid data
- Test individual endpoint with missing required fields
- Test batch endpoint with all 5 certificates
- Test email delivery
- Test database storage

### Edge Cases:
- Missing optional fields (should use defaults)
- Invalid email format
- Invalid VIN format (if provided)
- Duplicate invoice number (should be unique)
- Large PDF file size
- Email delivery failure

---

## Rollback Plan

If issues occur:
1. Remove Sales Invoice from batch generation endpoint
2. Comment out individual Sales Invoice endpoint
3. Revert database constraints (if migration was run)
4. Remove `generateSalesInvoice()` method (or comment out)

---

## Notes

1. **Template Location:** Sales Invoice template already exists in `mock_certs/Sales Invoice/`
2. **Document Type:** Sales Invoice is already configured in `documentTypes.js`
3. **Certificate Count:** Update from 4 to 5 certificates in batch generation
4. **Issuer Type:** May need to create external issuer record for sales invoice (if using external issuer system)
5. **No Expiry Date:** Sales Invoice typically doesn't have an expiry date (unlike insurance/emission)

---

## Files Summary

### Must Modify (Critical):
1. ✅ `backend/services/certificatePdfGenerator.js` - Add generation method
2. ✅ `backend/routes/certificate-generation.js` - Add endpoint & update batch
3. ✅ `backend/services/certificateEmailService.js` - Add email method

### Should Modify (Important):
4. ✅ `database/add-external-issuer-certificates.sql` - Update 3 CHECK constraints (lines 7, 26, 54)
5. ✅ `database/add-clearance-workflow.sql` - Update CHECK constraint (line 35, if certificates table exists)
6. ✅ Create `database/add-sales-invoice-certificate.sql` - Migration file
7. ⚠️ `backend/services/autoVerificationService.js` - Add validation (if needed)
8. ⚠️ `backend/services/ocrService.js` - Add OCR extraction (if needed)

### Optional (Frontend):
7. ⚠️ `js/certificate-generator.js` - Update UI (if exists)
8. ⚠️ `certificate-generator.html` - Update UI (if exists)

### Already Configured:
9. ✅ `backend/config/documentTypes.js` - Sales Invoice already defined
10. ✅ `mock_certs/Sales Invoice/sales-invoice.html` - Template exists
11. ✅ `mock_certs/Sales Invoice/sales-invoice.css` - Styles exist

---

## Implementation Priority

1. **HIGH:** Core generation, API endpoints, email service
2. **MEDIUM:** Database constraints, verification (if needed)
3. **LOW:** Frontend updates, OCR extraction (if needed)

---

**End of Analysis Document**
