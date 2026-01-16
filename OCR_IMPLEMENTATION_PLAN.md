# OCR Enhancement Plan: Support for Image-Only PDFs and All Document Types

**Date**: January 16, 2026  
**Status**: Ready for Implementation  
**Priority**: High (blocks vehicle registration for image-only documents)

---

## Executive Summary

Current OCR system fails for **image-only PDFs** (scanned documents with no text layer). This blocks registration when users upload driver's licenses, sales invoices, and similar documents as image-only PDFs.

**Solution**: Implement PDF-to-image OCR fallback using `pdftoppm` + `tesseract.js` + `sharp` for image preprocessing.

**Impact**: Enables 100% of document types (both text-layer and image-only PDFs) to be processed successfully.

---

## Problem Analysis

### Current State
- ✅ Works: PDFs with text layers (insurance certificates, CSR, HPG clearance)
- ❌ Fails: Image-only PDFs (driver's license, sales invoices, scanned documents)

### Root Cause
1. `pdf-parse` extracts only embedded text layers
2. When text layer is absent, `extractFromPDFAsImage()` is a stub returning empty string
3. No image OCR fallback exists
4. Result: `extractedData: {}` for image-only PDFs

### Impact
- Owner ID documents cannot be auto-filled
- Sales invoices cannot be auto-filled
- Users forced to manually enter data
- Poor UX for image-heavy document workflows

---

## Solution Architecture

### Pipeline Flow
```
User uploads PDF
    ↓
Check MIME type (application/pdf vs image/*)
    ↓
Primary: pdf-parse (extract text layer)
    ↓
Text extracted? Yes → Parse & return
    ↓
Text extracted? No → FALLBACK:
    ↓
PDF → Image conversion (pdftoppm)
    ↓
Image preprocessing (sharp: denoise, contrast, sharpen)
    ↓
Tesseract OCR on preprocessed image
    ↓
Parse extracted text by document type
    ↓
Return extractedData (or empty if all methods fail)
```

---

## Supported Document Types

### Vehicle Registration Documents
| Document Type | File Format | Text Layer? | Priority | Parser Rules |
|---|---|---|---|---|
| Certificate of Registration (CR) | PDF/Image | Mixed | High | VIN, Engine No, Plate, Make, Model, Year, Color |
| Official Receipt (OR) | PDF/Image | Mixed | High | VIN, Plate, Make, Model, Owner Name |
| Certificate of Stock Report (CSR) | PDF | Usually Yes | Medium | Engine No, Plate, Make, Model |
| Motor Vehicle Inspection Report (MVIR) | PDF | Usually Yes | Medium | VIN, Inspection Date, Results, Emission Status |

### Owner/Driver Documents
| Document Type | File Format | Text Layer? | Priority | Parser Rules |
|---|---|---|---|---|
| Driver's License | PDF/Image | Rarely (image-only) | **Critical** | ID Type, ID Number, Name, DOB, Address, License No |
| Passport | PDF/Image | Rarely (image-only) | High | ID Type, ID Number, Name, Nationality, DOB |
| National ID | PDF/Image | Rarely (image-only) | High | ID Type, ID Number, Name, Address |
| Postal ID | PDF/Image | Rarely (image-only) | Medium | ID Type, ID Number, Name, Address |
| Voter's ID | PDF/Image | Rarely (image-only) | Medium | ID Type, ID Number, Name, Precinct |
| SSS ID | PDF/Image | Rarely (image-only) | Medium | ID Type, ID Number, Name |

### Clearance/Approval Documents
| Document Type | File Format | Text Layer? | Priority | Parser Rules |
|---|---|---|---|---|
| PNP/HPG Clearance | PDF | Usually Yes | High | Engine No, Plate, Clearance Date, Status |
| Insurance Certificate (CTPL) | PDF | Usually Yes | High | Policy No, Vehicle Make/Model, Expiry, Coverage |
| Emission Certificate | PDF | Usually Yes | High | Emission Test Date, Results, Vehicle ID |

### Supporting Documents
| Document Type | File Format | Text Layer? | Priority | Parser Rules |
|---|---|---|---|---|
| Sales Invoice/Receipt | PDF/Image | Mixed | Medium | Make, Model, Year, Engine No, Sale Date, Seller Name |
| Deed of Sale | PDF/Image | Mixed | Medium | Seller Name, Buyer Name, Vehicle Details, Sale Date |
| Barangay Clearance | PDF/Image | Mixed | Low | Owner Name, Date, Barangay, Signatures |

---

## Implementation Details

### Phase 1: Core Dependencies

#### System Dependencies (Install on DigitalOcean Droplet)
```bash
# PDF-to-image conversion
sudo apt-get install -y poppler-utils

# OCR engine
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng

# Optional language support (for future multi-language)
# sudo apt-get install tesseract-ocr-fra tesseract-ocr-spa tesseract-ocr-deu

# Verify installations
pdftoppm --version    # Should show version 20.09.0+
tesseract --version   # Should show version 5.0+
```

#### NPM Dependencies (verify in package.json)
```json
{
  "pdf-parse": "^1.1.1",      // PDF text extraction
  "tesseract.js": "^5.0.4",   // OCR engine (JS binding to tesseract)
  "sharp": "^0.33.2"          // Image preprocessing
}
```

### Phase 2: Backend Implementation

#### File: `backend/services/ocrService.js`

**Changes Required**:
1. Replace stub `extractFromPDFAsImage()` with real PDF-to-image conversion
2. Enhance `extractFromImage()` with image preprocessing
3. Add `preprocessImage()` method for image quality enhancement
4. Add error handling for all fallback paths

**Key Methods to Implement**:

```javascript
/**
 * Extract text from PDF by converting to images and using Tesseract OCR
 * Fallback for image-only PDFs where pdf-parse returns no text
 * Supports up to 5 pages per PDF
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} Extracted text from all pages
 */
async extractFromPDFAsImage(filePath)

/**
 * Extract text from image file using Tesseract OCR with preprocessing
 * Applies denoise, contrast enhancement, sharpening before OCR
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} Extracted text
 */
async extractFromImage(filePath)

/**
 * Preprocess image for better OCR accuracy
 * Applies: normalize (enhance contrast), sharpen, resize (2000px width)
 * Handles: denoise, rotation detection (if library available)
 * @param {string} filePath - Path to source image
 * @returns {Promise<string>} Path to preprocessed image (PNG format)
 */
async preprocessImage(filePath)
```

**Error Handling Strategy**:
- Graceful degradation: If OCR fails, return empty string (not throw)
- All operations wrapped in try/catch
- Detailed console logging for debugging (`[OCR Debug]` prefix)
- Cleanup of temp files on success/failure

#### Document Type Parsing Enhancement

**File**: `backend/services/ocrService.js` → `parseVehicleInfo()` method

Expand parsing rules for all document types:

```javascript
// Owner ID documents: Extract name, ID type, ID number
if (documentType === 'owner_id' || documentType === 'ownerValidId' || ...) {
    // Name patterns (various formats)
    // ID Type patterns (Driver's License, Passport, National ID, etc.)
    // ID Number patterns (various lengths and formats)
    // DOB patterns (MM/DD/YYYY or DD/MM/YYYY)
    // Address patterns
}

// Vehicle documents: Extract VIN, engine, plate, make, model, year
if (documentType === 'registration_cert' || documentType === 'or_cr' || ...) {
    // VIN pattern (17 chars, alphanumeric excluding I, O, Q)
    // Engine number pattern
    // Plate number pattern (ABC-1234 or ABC 1234)
    // Make/brand extraction
    // Model extraction
    // Year extraction (4-digit)
}

// Clearance documents: Extract specific validation fields
if (documentType === 'pnpHpgClearance') {
    // Clearance date patterns
    // Status patterns (APPROVED, PENDING, etc.)
    // Vehicle identification patterns
}

// Insurance documents: Extract policy information
if (documentType === 'insuranceCertificate') {
    // Policy number patterns
    // Coverage type patterns
    // Expiry date patterns
    // Coverage amount patterns
}
```

### Phase 3: Frontend Updates

#### File: `js/registration-wizard.js`

**Ensure FormData includes `documentType`**:
```javascript
const formData = new FormData();
formData.append('document', file);
formData.append('documentType', documentType);  // CRITICAL: Must be sent
formData.append('vehicleId', vehicleId);       // Optional: for context

const response = await fetch('/api/documents/extract-info', {
    method: 'POST',
    headers: headers,
    body: formData
});
```

**Document type mapping** (for filename inference fallback):
```javascript
// Map filenames to document types for better inference
const filenamePatterns = {
    'drivers?.*license|dl|^dl-': 'ownerValidId',
    'passport|pp-|_pp': 'ownerValidId',
    'national.*id|nid|philid': 'ownerValidId',
    'postal.*id': 'ownerValidId',
    'voters?.*id': 'ownerValidId',
    'sss.*id': 'ownerValidId',
    'sales.*invoice|sales_invoice': 'salesInvoice',
    'csr|certificate.*stock|stock.*report': 'certificateOfStockReport',
    'hpg|clearance|pnp': 'pnpHpgClearance',
    'insurance|ctpl|policy': 'insuranceCertificate',
    'emission|emission.*cert': 'emissionCert',
    'registration|or|cr|certificate.*registration': 'registrationCert'
};
```

### Phase 4: Configuration Updates

#### File: `.env` (Environment Variables)

Add/verify OCR configuration:
```bash
# OCR Configuration
OCR_ENABLED=true                    # Enable/disable OCR
OCR_MAX_PAGES=5                     # Max PDF pages to process (avoid slowdown)
OCR_PREPROCESSING_ENABLED=true      # Enable image preprocessing (sharp)
OCR_TIMEOUT=30000                   # OCR timeout in milliseconds (30 seconds)
OCR_LANGUAGE=eng                    # Tesseract language code (eng, fra, spa, etc.)

# Storage for temp OCR files
OCR_TEMP_DIR=./temp-ocr             # Temp directory for PDF→image conversion
OCR_CLEANUP_ON_SUCCESS=true         # Delete temp files after processing
OCR_CLEANUP_ON_ERROR=true           # Delete temp files on error

# File upload limits
MAX_FILE_SIZE=10485760              # 10MB in bytes
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png # Comma-separated file extensions
```

---

## Testing Strategy

### Unit Testing (Backend)

**Test Cases for `ocrService.js`**:
```javascript
// Test 1: PDF with text layer
test('extractFromPDF returns text for text-layer PDF')

// Test 2: Image-only PDF
test('extractFromPDFAsImage returns text for image-only PDF')

// Test 3: Corrupt PDF
test('extractFromPDF returns empty string for corrupt PDF')

// Test 4: Owner ID parsing
test('parseVehicleInfo extracts name and ID number from driver license text')

// Test 5: Vehicle document parsing
test('parseVehicleInfo extracts VIN and engine number from registration certificate')

// Test 6: Graceful degradation
test('extractText returns empty string instead of throwing on unsupported format')
```

### Integration Testing (Full Pipeline)

#### Test Documents Required
| Document | Format | Type | Purpose |
|---|---|---|---|
| driver_license_with_text.pdf | PDF | Text layer | Positive case (existing support) |
| driver_license_image_only.pdf | PDF | Image-only | Fallback case (new feature) |
| registration_cert_text.pdf | PDF | Text layer | Positive case |
| registration_cert_scanned.pdf | PDF | Image-only | Fallback case |
| insurance_cert.pdf | PDF | Text layer | Existing support |
| hpg_clearance.pdf | PDF | Text layer | Existing support |
| sales_invoice_image.pdf | PDF | Image-only | Fallback case |

#### Manual Testing Procedure
```bash
# 1. SSH into DigitalOcean droplet
ssh root@139.59.117.203
cd /root/LTOBLOCKCHAIN

# 2. Install system dependencies
sudo apt-get install -y poppler-utils tesseract-ocr

# 3. Verify installations
pdftoppm --version
tesseract --version

# 4. Verify NPM packages
npm ls pdf-parse tesseract.js sharp

# 5. Deploy updated code
git pull origin main

# 6. Restart backend
docker-compose -f docker-compose.unified.yml restart lto-app

# 7. Monitor logs
docker-compose -f docker-compose.unified.yml logs lto-app --tail=50 -f

# 8. Test OCR via browser
# Go to http://localhost:3001/registration-wizard
# Upload test documents (image-only PDFs)
# Check browser console for extraction results
# Check server logs for [OCR Debug] messages
```

#### Expected Log Output (Success Case)
```
[OCR API Debug] Request received: { hasFile: true, fileName: 'driver_license.pdf', ... }
[OCR Debug] Text extraction result: { textLength: 0, hasText: false }
[OCR Debug] WARNING: PDF parsed but extracted text is empty! Attempting fallback method...
[OCR Debug] Starting PDF-to-image OCR fallback: { filePath: '...' }
[OCR Debug] Converting PDF to images: { outputPattern: '...' }
[OCR Debug] Generated images from PDF: { count: 1, files: ['driver_license-1.ppm'] }
[OCR Debug] Running Tesseract OCR on: driver_license-1.ppm
[OCR Debug] Tesseract OCR result: { textLength: 450, hasText: true }
[OCR Debug] parseVehicleInfo called: { documentType: 'ownerValidId', textLength: 450 }
[OCR Debug] Data parsing completed: { extractedDataKeys: ['idType', 'idNumber', 'lastName', 'firstName', 'address'], extractedFieldsCount: 5 }
[OCR API Debug] Sending response to frontend: { success: true, extractedDataKeys: ['idType', 'idNumber', 'lastName', 'firstName', 'address'], confidence: 'high' }
```

#### Expected API Response
```json
{
  "success": true,
  "extractedData": {
    "idType": "Driver's License",
    "idNumber": "D12-34-567890",
    "lastName": "Dulla",
    "firstName": "Jasper Dave",
    "address": "Complete Address",
    "dateOfBirth": "11/03/2002"
  },
  "confidence": "high",
  "documentType": "ownerValidId",
  "warnings": [],
  "extractedFieldsCount": 6
}
```

---

## Implementation Timeline

### Week 1: Preparation
- [ ] Review and finalize plan with team
- [ ] Prepare test documents (all types)
- [ ] Set up test environment on DigitalOcean droplet
- [ ] Backup current `ocrService.js`

### Week 2: Core Implementation
- [ ] Install system dependencies (`pdftoppm`, `tesseract-ocr`)
- [ ] Implement `extractFromPDFAsImage()` method
- [ ] Implement `preprocessImage()` method
- [ ] Enhance `parseVehicleInfo()` for all document types
- [ ] Add comprehensive error handling and logging

### Week 3: Testing & Refinement
- [ ] Unit test all OCR methods
- [ ] Integration test full pipeline
- [ ] Test with all document types
- [ ] Performance testing (measure OCR time)
- [ ] Fix edge cases and failures
- [ ] Optimize image preprocessing (balance quality vs speed)

### Week 4: Deployment & Monitoring
- [ ] Final code review
- [ ] Deploy to staging environment
- [ ] User acceptance testing (UAT)
- [ ] Deploy to production
- [ ] Monitor logs for 1 week
- [ ] Gather user feedback
- [ ] Make final optimizations

---

## Performance Considerations

### OCR Processing Time
- **Text-layer PDF**: 100-200ms (pdf-parse only)
- **Image-only PDF (1 page)**: 2-5 seconds (pdf-convert + tesseract)
- **Image-only PDF (5 pages)**: 10-25 seconds (proportional)

### Optimization Strategies
1. **Page Limiting**: Process max 5 pages per PDF (most docs are 1-2 pages)
2. **Image Preprocessing**: Cache preprocessed images to avoid reprocessing
3. **Tesseract Config**: Use `--psm 6` (assume uniform text blocks) for faster processing
4. **Async Processing**: Never block on OCR; use async/await
5. **Temp File Cleanup**: Delete temp images immediately after processing

### Resource Usage
- **CPU**: Single-threaded Tesseract (1 core per OCR operation)
- **Memory**: ~100MB per PDF→image conversion
- **Disk**: ~50MB temp space for image files (cleaned after processing)

---

## Failure Scenarios & Handling

| Scenario | Root Cause | Handling |
|---|---|---|
| pdftoppm not installed | System dependency missing | Log error, return empty, user sees warning |
| Tesseract not installed | System dependency missing | Log error, return empty, user sees warning |
| PDF is corrupted | File is damaged/invalid | pdf-parse fails, fallback also fails, return empty |
| Image-only PDF unreadable | Very poor quality scan | Preprocessing fails, Tesseract returns little/no text, return partial data |
| OCR timeout (>30 sec) | Very large PDF or slow system | Kill process, return empty, log timeout error |
| Temp directory full | Disk space exhausted | Cleanup fails, log error, subsequent OCRs fail until cleanup |
| Permission denied on temp dir | File permission issue | Log error, return empty, user sees warning |

**Universal Fallback**: If any OCR method fails, return `{ success: true, extractedData: {}, warnings: ['OCR extraction failed'] }` rather than throwing error.

---

## Success Metrics

### Functional
✅ 100% of document types (text-layer + image-only) process without errors  
✅ Image-only PDFs return `extractedData` with expected fields  
✅ No 500 errors; all failures gracefully degrade  
✅ Confidence scores accurately reflect extraction quality  

### Performance
✅ Text-layer PDFs processed in <500ms  
✅ Image-only PDFs processed in <10s (single page)  
✅ Temp files cleaned up after processing  
✅ No memory leaks from repeated OCR operations  

### User Experience
✅ Auto-fill works for all document types  
✅ Users can manually correct extracted data  
✅ Clear error messages for unsupported documents  
✅ No blocking/timeout for large documents  

---

## Rollback Plan

If critical issues arise post-deployment:

```bash
# 1. Revert to previous code
git revert <commit-hash-of-ocr-changes>

# 2. Deploy
docker-compose -f docker-compose.unified.yml restart lto-app

# 3. Verify
curl http://localhost:3001/api/health
docker-compose logs lto-app --tail=50

# 4. If needed, keep image-only PDFs disabled
# Set OCR_ENABLED=false in .env temporarily
```

---

## Future Enhancements

1. **Multi-Language Support**: Tesseract supports 100+ languages; add language detection
2. **Batch Processing**: Process multiple documents in parallel
3. **ML-Based Field Extraction**: Replace regex with trained models for higher accuracy
4. **Document Type Detection**: Auto-detect document type from content
5. **Rotation Detection**: Auto-rotate documents before OCR
6. **Table Extraction**: Extract structured data from tables (e.g., insurance coverage details)
7. **Handwriting Support**: Use specialized OCR for handwritten fields
8. **Caching**: Cache OCR results per file hash to avoid reprocessing

---

## Documentation & Knowledge Base

### Related Files to Review
- [backend/services/ocrService.js](backend/services/ocrService.js) - OCR implementation
- [backend/routes/documents.js](backend/routes/documents.js) - Document upload/extraction endpoints
- [js/registration-wizard.js](js/registration-wizard.js) - Frontend document upload
- [ENV.example](ENV.example) - Configuration template

### API Endpoints
- `POST /api/documents/extract-info` - Upload document and extract data
- `POST /api/documents/upload` - Upload document without OCR
- `GET /api/documents/ipfs/:cid` - View document by IPFS CID

### Database Tables
- `documents` - Document records
- `vehicle_verifications` - Document verification status
- `documents_ocr_cache` - (Optional) Cache OCR results per file hash

---

## Sign-Off & Approval

| Role | Name | Date | Status |
|---|---|---|---|
| Developer | [Your Name] | [Date] | ⏳ Pending |
| Tech Lead | [Name] | [Date] | ⏳ Pending |
| Project Manager | [Name] | [Date] | ⏳ Pending |

---

## Appendix: Document Type Reference

### Owner ID Documents - Extraction Patterns

**Driver's License**
```
License No: D12-34-567890
Full Name: Jasper Dave Dulla
Address: Complete Address
DOB: 11/03/2002
Expiration: 01/13/2027
```

**Passport**
```
Passport No: AA123456B
Full Name: Juan Dela Cruz
Nationality: Filipino
DOB: 05/15/1985
Expiration: 10/20/2030
```

**National ID (PhilID)**
```
CRN: 1234-5678-901-2
Full Name: Maria Santos
Address: Sample Address
DOB: 07/22/1990
Expiration: 07/22/2035
```

### Vehicle Documents - Extraction Patterns

**Certificate of Registration (CR)**
```
VIN: JMZA3C46H5100001
Plate: ABC 1234
Make: Mazda
Model: CX-5
Year: 2017
Engine No: PYJF123456
Color: Pearl White
```

**Motor Vehicle Inspection Report (MVIR)**
```
MVIR No: MV-2025-000123
VIN: JMZA3C46H5100001
Inspection Date: 01/15/2025
Emission Test: PASS
Roadworthiness: ROADWORTHY
```

### Clearance Documents - Extraction Patterns

**HPG/PNP Clearance**
```
Clearance No: HPG-2025-0001
Vehicle: Mazda CX-5
Engine No: PYJF123456
Plate: ABC 1234
Status: CLEARED
Date Issued: 01/10/2025
```

**Insurance Certificate (CTPL)**
```
Policy No: CTPL-2025-000123
Insurer: PhilAm/AXA/Cocolife
Vehicle: Toyota Vios
Coverage: ₱1,000,000
Expiry: 12/31/2025
```

---

**Document Version**: 1.0  
**Last Updated**: January 16, 2026  
**Next Review**: After successful deployment + 1 week monitoring
