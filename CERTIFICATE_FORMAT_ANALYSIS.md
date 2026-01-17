# 📋 Certificate Format Analysis - Mock Certs vs Current System

**Generated:** January 18, 2026

---

## 📄 Mock Certificates Overview

The Mock Certs folder contains **4 types of certificates** in HTML format with embedded CSS and JavaScript:

### 1️⃣ **Insurance Certificate (CTPL)**
**File:** `Insurance Cert/index.html`

**Format Structure:**
```
┌─────────────────────────────────────────┐
│  Insurance Certificate of Cover         │
│  (Third-Party Liability / CTPL)         │
├─────────────────────────────────────────┤
│                                         │
│  Insurance Company Details              │
│  ├─ Company Name                        │
│  ├─ Address                             │
│  ├─ Contact                             │
│  └─ License No.                         │
│                                         │
│  Policy Details                         │
│  ├─ Policy/Certificate No.              │
│  ├─ Effective & Expiry Dates            │
│  ├─ Coverage Limits                     │
│  └─ Coverage Type                       │
│                                         │
│  Vehicle Information                    │
│  ├─ Vehicle Type                        │
│  ├─ Make/Brand/Model                    │
│  ├─ Engine No.                          │
│  ├─ Chassis No.                         │
│  └─ Plate No.                           │
│                                         │
│  Owner Information                      │
│  ├─ Name                                │
│  └─ Address                             │
│                                         │
│  Authorized Signatory                   │
│  ├─ Name & Position                     │
│  └─ Signature Line                      │
│                                         │
│  ⚖️ Official Note                        │
└─────────────────────────────────────────┘
```

**Key Features:**
- Simple, clean design
- Editable input fields
- Print-to-PDF capability
- No special watermarks or seals

**Sample Data:**
```
Company: ABC Insurance Co., Inc.
Policy No.: CTPL-2026-00012345
Owner: Juan dela Cruz
Vehicle: Honda TMX 155 Alpha
Effective: 01-Jan-2026
Expires: 31-Dec-2026
```

---

### 2️⃣ **Emission Test Certificate**
**File:** `Emission Cert/emission-certificate.html`

**Format Structure:**
```
┌─────────────────────────────────────────┐
│  Republic of the Philippines            │
│  Department of Environment and          │
│  Natural Resources / Land               │
│  Transportation Office                  │
│                                         │
│  VEHICLE EMISSION TEST CERTIFICATE      │
├─────────────────────────────────────────┤
│                                         │
│  Certificate Ref No.: ETC-20260113-001  │
│                                         │
│  [DENR/LTO Watermark - Semi-transparent]│
│                                         │
│  Owner Information                      │
│  ├─ Name: Juan Dela Cruz                │
│  ├─ Address: Sampaguita St., QC         │
│                                         │
│  Vehicle Information                    │
│  ├─ Make/Model: Toyota Corolla Altis    │
│  ├─ Year: 2025                          │
│  ├─ Body Type: Sedan                    │
│  ├─ Color: White                        │
│  ├─ Engine No.: 2NR-FE123456            │
│  ├─ VIN: 1HGBH41JXMN109186              │
│  ├─ Plate No.: ABC1234                  │
│  └─ Fuel Type: Gasoline                 │
│                                         │
│  Emission Test Results                  │
│  ├─ CO Level: 0.20% - Pass              │
│  ├─ HC Level: 120 ppm - Pass            │
│  ├─ NOx Level: 0.25% - Pass             │
│  ├─ Smoke Opacity: 18% - Pass           │
│  └─ ✅ Overall Result: PASS             │
│                                         │
│  Certification Statement                │
│  "Certified by authorized inspector..." │
│                                         │
│  Signature Section                      │
│  ├─ Canvas Signature Area               │
│  ├─ Inspector: Engr. Maria Santos       │
│  ├─ Position: Authorized Inspector      │
│  └─ Official Seal/Stamp (graphic)       │
│                                         │
│  Footer                                 │
│  ├─ Certificate No.: ETC-20260113-001   │
│  ├─ Date of Issue: [auto-populated]     │
│  └─ Valid Until: [auto-calculated]      │
└─────────────────────────────────────────┘
```

**Key Features:**
- Official government header (DENR/LTO)
- Watermark (semi-transparent "DENR/LTO")
- Double border (6px + 2px styling)
- Canvas-based signature drawing
- Automatic date/expiry calculation
- Interactive controls (Edit/Preview/Download)
- Detailed emission test results table
- Official seal graphic

**Technology Used:**
- Canvas API for signature drawing
- Touch event support (mobile)
- Editable fields with preview mode
- Print-to-PDF optimization

---

### 3️⃣ **PNP-HPG Motor Vehicle Clearance**
**File:** `HPG certificate/pnp-hpg-clearance.html`

**Format Structure:**
```
┌─────────────────────────────────────────┐
│  Republic of the Philippines            │
│  PHILIPPINE NATIONAL POLICE             │
│  Highway Patrol Group (HPG)             │
│                                         │
│  MOTOR VEHICLE CLEARANCE CERTIFICATE    │
├─────────────────────────────────────────┤
│                                         │
│  Certificate No.: HPG-2026-000123       │
│  Date Issued: January 13, 2026          │
│                                         │
│  [Certification Statement]              │
│  "This is to certify that the motor     │
│   vehicle described below has been      │
│   verified by PNP-HPG and is found to   │
│   be FREE FROM ANY POLICE RECORD,       │
│   HOLD, LIEN, ENCUMBRANCE, OR          │
│   CRIMINAL CASE..."                     │
│                                         │
│  OWNER INFORMATION                      │
│  ├─ Registered Owner: Juan Dela Cruz    │
│  └─ Address: Sampaguita St., QC         │
│                                         │
│  VEHICLE INFORMATION                    │
│  ├─ Make/Model: Toyota Corolla Altis    │
│  ├─ Year Model: 2025                    │
│  ├─ Body Type: Sedan                    │
│  ├─ Color: White                        │
│  ├─ Engine Number: 2NR-FE123456         │
│  ├─ Chassis/VIN: 1HGBH41JXMN109186      │
│  └─ Plate Number: ABC-1234              │
│                                         │
│  [Purpose Statement]                    │
│  "This clearance is issued for the      │
│   purpose of vehicle registration,      │
│   transfer of ownership, and other      │
│   lawful transactions."                 │
│                                         │
│  Signature Section                      │
│  ├─ Canvas Signature Area               │
│  ├─ Officer: P/Supt. Maria Santos       │
│  ├─ Position: Authorized Officer,       │
│  │             PNP-HPG                  │
│  └─ Official PNP-HPG Seal (graphic)     │
│                                         │
│  Controls: Preview | Download           │
└─────────────────────────────────────────┘
```

**Key Features:**
- Government authority header (PNP-HPG)
- Official seal with gradient and decorative elements
- Canvas-based signature drawing
- Full-table layout for vehicle info
- Edit/Preview mode toggle
- Print-friendly styling
- Certificate-specific styling (centered layout)

---

### 4️⃣ **Certificate of Stock Reported (CSR)**
**File:** `csr cert/csr-certificate.html`

**Format Structure:**
```
┌─────────────────────────────────────────┐
│  Republic of the Philippines            │
│  LAND TRANSPORTATION OFFICE             │
│                                         │
│  [Dealer Company Name - editable]       │
│  [LTO Accredited Dealer No. - editable] │
│                                         │
│  CERTIFICATE OF STOCK REPORTED          │
├─────────────────────────────────────────┤
│                                         │
│  CSR No.: CSR-2026-000123               │
│  Date Issued: [auto-current-date]       │
│                                         │
│  Certification Statement                │
│  "This is to certify that the motor     │
│   vehicle described below has been      │
│   duly reported as stock to the LTO..."  │
│                                         │
│  VEHICLE INFORMATION                    │
│  ├─ Make/Brand: Toyota                  │
│  ├─ Model/Series: Corolla Altis         │
│  ├─ Variant/Type: 1.8 G CVT             │
│  ├─ Year Model: 2025                    │
│  ├─ Body Type: Sedan                    │
│  ├─ Color: White                        │
│  ├─ Fuel Type: Gasoline                 │
│  ├─ Engine Number: 2NR-FE123456         │
│  └─ Chassis/VIN: 1HGBH41JXMN109186      │
│                                         │
│  Purpose Statement                      │
│  "Issued for initial registration with  │
│   the LTO and for whatever legal        │
│   purpose it may serve."                │
│                                         │
│  Signature Section                      │
│  ├─ Canvas Signature Area               │
│  ├─ Signatory: Juan D. Manager          │
│  ├─ Position: Authorized Representative │
│  └─ Official Dealer Seal (SVG graphic)  │
│                                         │
│  Controls: Preview | Edit | Download    │
└─────────────────────────────────────────┘
```

**Key Features:**
- LTO header with dealer information
- Dealer-specific editable fields
- SVG-based decorative seal (gradient, decorative corners)
- Auto-populated date (JavaScript `new Date()`)
- Canvas signature drawing
- Interactive preview/edit modes

---

## 🎨 Common Design Patterns

### **Certificate Page Size:**
- **Standard:** 8.5" × 11" (US Letter)
- **Layout:** Centered with 1-inch margins
- **Width:** 8.5 inches max
- **Background:** White (#fff) on gray page background

### **Typography:**
- **Primary Font:** Times New Roman / Georgia (serif)
- **Headings:** Bold, uppercase, 15-20px
- **Body Text:** 14px, justified alignment
- **Line Height:** 1.6

### **Borders & Styling:**
- **Insurance:** Simple (no borders)
- **Emission:** Double border (6px outer + 2px inner)
- **HPG:** Standard borders with seal
- **CSR:** Standard borders with dealer seal

### **Editable Fields:**
- **Input Type:** HTML `<input>` with underline only
- **Styling:** No box shadow, border-bottom: 1px solid #000
- **Width:** Full-width or fixed (300px for narrow fields)
- **Font:** Inherit from parent, 14px

### **Signatures:**
- **Method:** Canvas API (`getContext('2d')`)
- **Drawing Style:** Black strokes, 2px width, rounded corners
- **Features:** Touch support, mouse support, clear button
- **Size Handling:** Dynamic (matches container)

### **Official Seals/Stamps:**
- **Emission:** PNG/SVG circular seal with text
- **HPG:** SVG seal with gradient (PNP colors: #003366)
- **CSR:** SVG seal with decorative elements and gradient

### **Print Optimization:**
- **Media Query:** `@media print { ... }`
- **Buttons Hidden:** Action buttons don't print
- **Styles:** Box shadows removed, margins adjusted
- **Full Content:** All fields print as filled

### **Interactive Features:**
- **Edit Mode:** All fields editable (readOnly = false)
- **Preview Mode:** All fields read-only (readOnly = true)
- **Download:** Triggers browser print dialog (window.print())
- **Canvas:** Only drawable in edit mode

---

## 📊 Data Fields by Certificate Type

### **Insurance Certificate**
```javascript
{
  companyName: "ABC Insurance Co., Inc.",
  address: "123 Insurance Ave., Makati City",
  contact: "(02) 1234-5678",
  licenseNo: "001-CTPL-2025",
  
  policyNo: "CTPL-2026-00012345",
  effectiveDate: "01-Jan-2026",
  expiryDate: "31-Dec-2026",
  coverageLimit: {
    bodily_injury: "PHP 100,000 per person",
    property_damage: "PHP 50,000 per accident"
  },
  
  vehicleType: "Motorcycle",
  make: "Honda",
  model: "TMX 155 Alpha",
  engineNo: "ENG123456789",
  chassisNo: "CHS987654321",
  plateNo: "To be issued",
  
  ownerName: "Juan dela Cruz",
  ownerAddress: "456 Sample St., Quezon City",
  
  signatoryName: "Maria Santos",
  signatoryPosition: "CTPL Department Manager"
}
```

### **Emission Certificate**
```javascript
{
  certRefNo: "ETC-20260113-001",
  dateIssued: "[auto-populated]",
  dateExpiry: "[auto-calculated: 1 year]",
  
  ownerName: "Juan Dela Cruz",
  ownerAddress: "456 Sampaguita St., Quezon City",
  
  make: "Toyota Corolla Altis",
  yearModel: "2025",
  bodyType: "Sedan",
  color: "White",
  engineNo: "2NR-FE123456",
  vin: "1HGBH41JXMN109186",
  plateNo: "ABC1234",
  fuelType: "Gasoline",
  
  testResults: {
    coLevel: "0.20% - Pass",
    hcLevel: "120 ppm - Pass",
    noxLevel: "0.25% - Pass",
    smokeOpacity: "18% - Pass",
    overallResult: "PASS"
  },
  
  inspectorName: "Engr. Maria Santos",
  inspectorTitle: "Authorized Inspector",
  signature: "[canvas-drawn]"
}
```

### **HPG Clearance**
```javascript
{
  certNumber: "HPG-2026-000123",
  dateIssued: "January 13, 2026",
  
  ownerName: "Juan Dela Cruz",
  ownerAddress: "456 Sampaguita St., Quezon City",
  
  make: "Toyota Corolla Altis",
  yearModel: "2025",
  bodyType: "Sedan",
  color: "White",
  engineNumber: "2NR-FE123456",
  vin: "1HGBH41JXMN109186",
  plateNumber: "ABC-1234",
  
  officerName: "P/Supt. Maria Santos",
  officerPosition: "Authorized Officer, PNP-HPG",
  signature: "[canvas-drawn]",
  
  statement: "FREE FROM ANY POLICE RECORD...",
  purpose: "For vehicle registration..."
}
```

### **CSR (Certificate of Stock Reported)**
```javascript
{
  dealerName: "ABC MOTOR VEHICLE DEALER, INC.",
  accreditedNo: "LTO Accredited Dealer No. 12345",
  
  csrNo: "CSR-2026-000123",
  dateIssued: "[auto-current-date]",
  
  make: "Toyota",
  model: "Corolla Altis",
  variant: "1.8 G CVT",
  yearModel: "2025",
  bodyType: "Sedan",
  color: "White",
  fuelType: "Gasoline",
  engineNumber: "2NR-FE123456",
  vin: "1HGBH41JXMN109186",
  
  signatoryName: "Juan D. Manager",
  signatoryPosition: "Authorized Representative",
  signature: "[canvas-drawn]"
}
```

---

## ✅ Comparison: Mock Certs vs Current System

| Aspect | Mock Certs | Current System | Status |
|--------|-----------|----------------|--------|
| **Format** | HTML with CSS | PDF via Puppeteer | ⚠️ Different |
| **Editability** | Interactive fields | Generated from templates | ⚠️ Different |
| **Signatures** | Canvas-drawn | Embedded/optional | ⚠️ Different |
| **Seals** | SVG/Graphic | Template-based | ⚠️ Different |
| **Fields** | Custom inputs | Template placeholders | ✅ Similar |
| **Data Structure** | HTML inputs | JavaScript objects | ✅ Similar |
| **Vehicle Info** | Complete | Complete | ✅ Match |
| **Owner Info** | Included | Included | ✅ Match |
| **Test Results** | Emission-specific | Available | ✅ Match |

---

## 🔄 How Mock Certs Should Work in New System

### **Flow 1: External Organization Issues Certificate**
```
1. Insurance company fills out Insurance Cert form
   ├─ Editable HTML fields
   ├─ Canvas signature
   └─ Official seal/stamp

2. System converts to PDF (Puppeteer)
   ├─ Renders HTML to PDF
   ├─ Preserves all styling
   └─ Generates file hash (SHA-256)

3. System stores:
   ├─ PDF file: /uploads/certs/insurance/CTPL-2026-00012345.pdf
   ├─ File Hash: abc123def456...
   ├─ Composite Hash: Stored on blockchain
   └─ Metadata: In issued_certificates table

4. Certificate delivered to owner:
   ├─ PDF file
   ├─ Verification code
   └─ Blockchain TX ID
```

### **Flow 2: Owner Uploads Certificate**
```
1. Owner receives PDF certificate from issuer

2. Owner uploads via LTO portal:
   ├─ POST /api/certificate-uploads/submit
   ├─ Uploads PDF file
   ├─ Selects certificate type
   └─ System calculates file hash

3. System auto-verifies:
   ├─ Calculates SHA-256 of uploaded PDF
   ├─ Compares to file_hash in issued_certificates
   ├─ ✅ If match: VERIFIED
   └─ ❌ If no match: REJECTED

4. Result stored:
   ├─ Submission status updated
   ├─ Verification result: VERIFIED/REJECTED/PENDING
   └─ Blockchain query logged
```

---

## 💡 Recommendation

The **Mock Certs use the correct template structure** for the new certificate architecture:

1. **✅ HTML + CSS Format:** Perfect for external organizations to generate certificates
2. **✅ Editable Fields:** Allows custom data entry for each certificate
3. **✅ Canvas Signatures:** Professional signature drawing capability
4. **✅ Official Seals:** Professional appearance with government seals
5. **✅ Print-to-PDF:** Easy conversion to PDF for verification

### **Next Steps:**

**For Integration:**
1. Store Mock Cert templates in system
2. Create template engine to populate fields with real data
3. Implement Puppeteer conversion: HTML → PDF
4. Calculate file hash after PDF generation
5. Store hash on blockchain for verification

**File Structure:**
```
/templates/
├── insurance-certificate.html
├── emission-certificate.html
├── hpg-clearance.html
├── csr-certificate.html
├── styles/
│   ├── insurance.css
│   ├── emission.css
│   ├── hpg.css
│   └── csr.css
```

**Data Flow:**
```
External Org API
  ↓
(Receive certificate data)
  ↓
Template Engine
  (Populate HTML template with data)
  ↓
Puppeteer
  (Render HTML → PDF)
  ↓
Calculate Hash (SHA-256)
  ↓
Store: issuer_certificates table
  ↓
Store: Blockchain (composite_hash)
  ↓
Return to External Org
```

---

**Status:** ✅ Mock Certs format is **COMPATIBLE** with new certificate architecture

Generated: January 18, 2026
