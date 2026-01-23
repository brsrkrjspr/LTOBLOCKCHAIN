# Transfer Certificate Generator – End-to-End Trace

Traces the flow from the Transfer Certificate Generator UI through API, PDF generation, storage, DB, and email.

---

## 1. Entry Points & Route Mount

| Item | Location |
|------|----------|
| **UI** | `transfer-certificate-generator.html` |
| **Frontend logic** | `js/transfer-certificate-generator.js` |
| **API prefix** | `/api/certificate-generation` |
| **Route mount** | `server.js:103` → `require('./backend/routes/certificate-generation')` |

---

## 2. API Endpoints (Certificate-Generation)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/transfer/vehicles` | List APPROVED/REGISTERED vehicles for dropdown | `admin` |
| GET | `/transfer/requests` | List transfer requests for optional link | `admin` |
| GET | `/transfer/vehicle/:vehicleId` | Vehicle + owner for autofill | `admin` |
| GET | `/transfer/context/:transferRequestId` | Transfer context (vehicle, seller, buyer) for autofill | `admin` |
| **POST** | **`/transfer/generate-compliance-documents`** | **Generate PDFs, store, optionally link, email** | `admin` |

---

## 3. Frontend Flow (`js/transfer-certificate-generator.js`)

### 3.1 Page Load

1. **DOMContentLoaded**
   - `authManager.init()`, redirect to `login-signup.html` if not authenticated
   - `initializeForm()`, `loadVehicles()`, `loadTransferRequests()`
   - Default `saleDate` = today

### 3.2 Load Data

| Action | API | Result |
|--------|-----|--------|
| Load vehicles | `GET /api/certificate-generation/transfer/vehicles` | Populate `#vehicleSelect` |
| Load transfer requests | `GET /api/certificate-generation/transfer/requests` | Populate `#transferRequestSelect` (optional) |
| Vehicle selected | `GET /api/certificate-generation/transfer/vehicle/:vehicleId` | `transferContext = { vehicle, seller: owner }`, `displayAutofillPreview()` |
| Transfer request selected | `GET /api/certificate-generation/transfer/context/:transferRequestId` | `transferContext = { vehicle, seller, buyer }`, hide buyer email section |
| Buyer email blur | `GET /api/auth/users/lookup?email=...` | `transferContext.buyer`, `displayAutofillPreview()` |

### 3.3 Form Submit → Generate

**Handler:** `generateCertificates()` (on `#transferCertificateForm` submit)

1. **Validate**
   - `vehicleId` required
   - `transferRequestId` optional
   - If no `transferRequestId`: `buyerEmail` required and must have been validated (buyer preview visible)

2. **Build `formData`**
   - `vehicleId`, `transferRequestId` (or null)
   - `sellerDocuments.deedOfSale`: `purchasePrice`, `saleDate`, `odometerReading`, `notaryName`, `notaryCommission`
   - `buyerDocuments`: `email` (if standalone), `hpgClearance`, `ctplInsurance`, `mvir` (each with type-specific fields)

3. **Request**
   - `POST /api/certificate-generation/transfer/generate-compliance-documents` with `formData`

4. **Response**
   - Success: `showSuccess()` with `results.sellerDocuments`, `results.buyerDocuments`
   - Error: `showError()` (supports `response.errors[]`, `response.details`)

---

## 4. Backend: POST `/transfer/generate-compliance-documents`

**File:** `backend/routes/certificate-generation.js` (from ~1614)

### 4.1 Resolve Vehicle, Seller, Buyer

**Option A – `vehicleId` (direct vehicle, “standalone”):**

- `db.getVehicleById(vehicleId)` → `vehicle`
- Seller: `db.getUserById(vehicle.owner_id)` → `seller`
- Buyer: `lookupAndValidateOwner(buyerId|email)` from `buyerDocuments` → `buyer`

**Option B – `transferRequestId`:**

- `db.getTransferRequestById(transferRequestId)` → `request`
- `db.getVehicleById(request.vehicle_id)` → `vehicle`
- `seller = request.seller`, `buyer = request.buyer || request.buyer_info`

If neither `vehicleId` nor `transferRequestId`: **400** `Either vehicleId or transferRequestId is required`.

### 4.2 5‑Day Seller Rule (Audit Only)

If `sellerDocuments.deedOfSale.saleDate` is >5 days before now: log warning; generation continues.

### 4.3 Helpers

- **`storePdfAndCreateDocument(pdfBuffer, fileHash, fileName, documentType, vehicleId, uploaderEmail)`**
  - Writes PDF to `uploads/temp/transfer-cert-{ts}-{rand}.pdf`
  - `storageService.storeDocument(fileObj, documentType, vehicle.vin, uploaderEmail)` → IPFS or local
  - `db.createDocument({ vehicleId, documentType, filename, filePath, fileSize, mimeType, fileHash, uploadedBy, ipfsCid })`
  - Deletes temp file
  - Returns `documentRecord.id`

- **`linkDocumentToTransfer(documentId, transferRole)`**
  - `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by) VALUES ($1,$2,$3,$4)`
  - **Issue:** `transfer_request_id` is NOT NULL. In standalone mode `transferRequestId` is null → **INSERT fails** (e.g. `null value in column "transfer_request_id"`).

- **`writeIssuedCertificate(...)`**
  - Resolves `external_issuers` by mapped `issuer_type` (e.g. `hpg`, `insurance`, `csr`)
  - `INSERT INTO issued_certificates (issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, file_hash, composite_hash, issued_at, expires_at, metadata)`

---

## 5. Document Generation (per type)

All PDFs are created by **`backend/services/certificatePdfGenerator`** using **Puppeteer** (Chromium) to render HTML and `page.pdf()`.

### 5.1 Seller: Deed of Sale

| Step | Component | File:Line / Detail |
|------|-----------|---------------------|
| 1 | Check | `sellerDocuments?.deedOfSale` |
| 2 | PDF | `certificatePdfGenerator.generateDeedOfSale({ sellerName, sellerAddress, buyerName, buyerAddress, vehicleVIN, vehiclePlate, vehicleMake, vehicleModel, vehicleYear, engineNumber, chassisNumber, purchasePrice, saleDate, odometerReading, notaryName, notaryCommission })` |
| 3 | Template | `mock_certs/Sales Invoice/sales-invoice.html` (title changed to “DEED OF ABSOLUTE SALE”) |
| 4 | Store | `storePdfAndCreateDocument(..., docTypes.DB_TYPES.DEED_OF_SALE, ...)` → `documents` |
| 5 | Link | `linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.DEED_OF_SALE)` → `transfer_documents` (fails if `transferRequestId` null) |
| 6 | Issued | `writeIssuedCertificate('deed_of_sale', ...)` → `issued_certificates` |
| 7 | Result | `results.sellerDocuments.deedOfSale = { documentId, fileHash }` |

### 5.2 Buyer: HPG Clearance

| Step | Component | File:Line / Detail |
|------|-----------|---------------------|
| 1 | Check | `buyerDocuments?.hpgClearance` |
| 2 | PDF | `certificatePdfGenerator.generateHpgClearance({ ownerName: buyerName, vehicleVIN, vehiclePlate, vehicleMake, vehicleModel, vehicleYear, engineNumber, clearanceNumber, issueDate, verificationDetails })` |
| 3 | Store | `storePdfAndCreateDocument(..., docTypes.DB_TYPES.HPG_CLEARANCE, ...)` |
| 4 | Link | `linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE)` |
| 5 | Issued | `writeIssuedCertificate('hpg_clearance', ...)` |
| 6 | Result | `results.buyerDocuments.hpgClearance = { documentId, fileHash, clearanceNumber }` |

### 5.3 Buyer: CTPL Insurance

| Step | Component | File:Line / Detail |
|------|-----------|---------------------|
| 1 | Check | `buyerDocuments?.ctplInsurance` |
| 2 | PDF | `certificatePdfGenerator.generateInsuranceCertificate({ ownerName: buyerName, vehicleVIN, vehiclePlate, vehicleMake, vehicleModel, engineNumber, chassisNumber, policyNumber, coverageType: 'CTPL', coverageAmount, effectiveDate, expiryDate })` |
| 3 | Store | `storePdfAndCreateDocument(..., docTypes.DB_TYPES.CTPL, ...)` |
| 4 | Link | `linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_CTPL)` |
| 5 | Issued | `writeIssuedCertificate('insurance', ...)` (CTPL as insurance subtype) |
| 6 | Result | `results.buyerDocuments.ctplInsurance = { documentId, fileHash, policyNumber }` |

### 5.4 Buyer: MVIR

| Step | Component | File:Line / Detail |
|------|-----------|---------------------|
| 1 | Check | `buyerDocuments?.mvir` |
| 2 | PDF | `certificatePdfGenerator.generateMvir({ vehicleVIN, vehiclePlate, vehicleMake, vehicleModel, vehicleYear, engineNumber, chassisNumber, inspectionDate, mvirNumber, inspectionResult, inspectorName })` |
| 3 | Store | `storePdfAndCreateDocument(..., docTypes.DB_TYPES.MVIR, ...)` |
| 4 | Link | `linkDocumentToTransfer(docId, docTypes.TRANSFER_ROLES.BUYER_MVIR)` |
| 5 | Issued | `writeIssuedCertificate('mvir_cert', ...)` |
| 6 | Result | `results.buyerDocuments.mvir = { documentId, fileHash, mvirNumber }` |

---

## 6. Certificate PDF Generator (`certificatePdfGenerator.js`)

| Method | Template / behavior | Returns |
|--------|---------------------|---------|
| `generateDeedOfSale` | Sales Invoice HTML → “DEED OF ABSOLUTE SALE” | `{ pdfBuffer, fileHash, certificateNumber }` |
| `generateHpgClearance` | HPG clearance HTML | `{ pdfBuffer, fileHash }` |
| `generateInsuranceCertificate` | Insurance template, `coverageType: 'CTPL'` | `{ pdfBuffer, fileHash }` |
| `generateMvir` | MVIR HTML | `{ pdfBuffer, fileHash }` |

- `calculateFileHash(pdfBuffer)` = SHA‑256 hex of buffer  
- `generateCompositeHash(...)` used for `issued_certificates.composite_hash`  
- `getPuppeteerLaunchOptions()`: prefers `chromium`/`chromium-browser` on Linux

---

## 7. Storage & DB

### 7.1 Storage

- **Service:** `backend/services/storageService`
- **`storeDocument(file, documentType, vehicleVin, ownerEmail)`**
  - If IPFS: `ipfsService.storeDocument(file.path, metadata)` → CID
  - Else: `localStorageService.storeDocument(...)`
- **DB:** `db.createDocument(...)` → `documents` (id, vehicle_id, document_type, filename, file_path, file_hash, ipfs_cid, uploaded_by, etc.)

### 7.2 `transfer_documents` (when `transferRequestId` is present)

- **Schema:** `transfer_request_id UUID NOT NULL`, `document_type`, `document_id` → `documents(id)`, `uploaded_by` → `users(id)`
- **Roles used:** `deed_of_sale`, `buyer_hpg_clearance`, `buyer_ctpl`, `buyer_mvir` (from `documentTypes.TRANSFER_ROLES`)

---

## 8. Email

- **Service:** `backend/services/gmailApiService.sendMail({ to, subject, html, text, attachments })`
- **Seller:** Deed of Sale (and historically Seller ID; IDs removed). Attachments: `Deed_of_Sale_${transferRequestId}.pdf` (or `..._null.pdf` if standalone).
- **Buyer:** HPG, CTPL, MVIR. Attachments: `HPG_Clearance_${transferRequestId}.pdf`, `CTPL_Insurance_${transferRequestId}.pdf`, `MVIR_${transferRequestId}.pdf`.
- **PDF source for email:** `getPdfBufferFromDocument(documentId)` reads `documents.file_path` from DB and `fs.readFileSync`. With IPFS, `file_path` may not be a local path; email may fail if no local file.

---

## 9. Response

- **200** if no `results.errors`
- **207** if `results.errors.length > 0` (e.g. `linkDocumentToTransfer` or email failures)
- Body: `{ success, message, results: { sellerDocuments, buyerDocuments, errors }, transferRequestId }`

---

## 10. Data Flow Summary (Table)

| Step | UI / Trigger | API | Service / DB | Data |
|------|--------------|-----|--------------|------|
| 1 | Select vehicle | `GET /transfer/vehicle/:id` | `db.getVehicleById`, `db.getUserById` | vehicle, seller (owner) |
| 2 | Select transfer (opt.) | `GET /transfer/context/:id` | `db.getTransferRequestById`, `db.getVehicleById` | vehicle, seller, buyer |
| 3 | Submit form | `POST /transfer/generate-compliance-documents` | — | `vehicleId`, `transferRequestId?`, `sellerDocuments`, `buyerDocuments` |
| 4 | Resolve party | — | `db.getVehicleById` / `getTransferRequestById`, `lookupAndValidateOwner` | `vehicle`, `seller`, `buyer` |
| 5 | Deed of Sale | — | `certificatePdfGenerator.generateDeedOfSale` | `{ pdfBuffer, fileHash }` |
| 6 | HPG / CTPL / MVIR | — | `generateHpgClearance`, `generateInsuranceCertificate`, `generateMvir` | `{ pdfBuffer, fileHash }` |
| 7 | Store PDF | — | `storageService.storeDocument` | IPFS CID or local path |
| 8 | Document row | — | `db.createDocument` | `documents` |
| 9 | Link to transfer | — | `linkDocumentToTransfer` → `INSERT transfer_documents` (skipped when `transferRequestId` is null) | `transfer_documents` (only if `transferRequestId` present) |
| 10 | Issued cert | — | `writeIssuedCertificate` → `INSERT issued_certificates` | `issued_certificates` |
| 11 | Email | — | `gmailApiService.sendMail` | Seller: Deed; Buyer: HPG, CTPL, MVIR |

---

## 11. Standalone Mode (`transferRequestId` = null) – Behavior

When the user chooses **only** `vehicleId` (no transfer request):

- **`linkDocumentToTransfer`** is **skipped** when `!transferRequestId` (standalone: documents stay in `documents` only, not in `transfer_documents`). Log: `Skipping transfer_documents link: no transferRequestId (standalone generation)`.
- **Deed certificate number:** `DEED-standalone-{random}` (e.g. `DEED-standalone-A1B2C3`) to avoid duplicate `issued_certificates.certificate_number` (no more `DEED-null`).
- **Stored and email filenames:** `transferRequestId || vehicle.id` for Deed, HPG, CTPL, MVIR (e.g. `Deed_of_Sale_<vehicleId>.pdf` in standalone instead of `..._null.pdf`).

---

## 12. Files Reference

| Role | Path |
|------|------|
| UI | `transfer-certificate-generator.html` |
| Frontend | `js/transfer-certificate-generator.js` |
| API | `backend/routes/certificate-generation.js` |
| PDF | `backend/services/certificatePdfGenerator.js` |
| Storage | `backend/services/storageService.js`, `ipfsService.js`, `localStorageService.js` |
| DB | `backend/database/services.js` (`getVehicleById`, `getTransferRequestById`, `createDocument`), `backend/database/db.js` (raw `query`) |
| Config | `backend/config/documentTypes.js` |
| Email | `backend/services/gmailApiService.js` |
| Schema | `database/migrations/007_registration_workflow_and_transfer_ownership.sql` (`transfer_documents`) |

---

## 13. Auto-Verification (When Transfer Is Forwarded to HPG / Insurance)

Auto-verification runs **when the transfer is forwarded to HPG and/or Insurance**, not when the transfer request is first submitted.

### When it runs

1. **Seller** creates a transfer request (can attach Deed of Sale, Seller ID, etc.).
2. **Buyer** accepts and submits documents: HPG Clearance, CTPL, MVIR, Buyer ID, etc. (via `documents: { buyerHpgClearance, buyerCtpl, buyerMvir, ... }`).
3. An **admin** (or the system via auto-forward on buyer acceptance) **forwards** the transfer to **HPG** and/or **Insurance**.

On forward:

- **HPG:** `forwardTransferToHPG` finds `BUYER_HPG_CLEARANCE` in `transfer_documents`, loads the document, and runs `autoVerificationService.autoVerifyHPG(vehicleId, documents, vehicle)`.
- **Insurance:** `forwardTransferToInsurance` finds `BUYER_CTPL`, loads the document, and runs `autoVerificationService.autoVerifyInsurance(vehicleId, insuranceDoc, vehicle)`.

### What it needs

| Requirement | HPG | Insurance |
|------------|-----|-----------|
| **Document in `transfer_documents`** | `BUYER_HPG_CLEARANCE` with `document_id` | `BUYER_CTPL` with `document_id` |
| **`issued_certificates` match** | `checkCertificateAuthenticity(fileHash, vehicleId, 'hpg_clearance')` finds a row with same `file_hash` | Same for `'insurance'` |
| **Readable file** | Optional if `document.file_hash` is set (hash-only authenticity; OCR is best-effort) | **Required** for OCR (policy number, expiry). With IPFS, `autoVerificationService.autoVerifyInsurance` uses `storageService.getDocument(doc.id)` when `file_path` is missing or not on disk. |
| **`AUTO_VERIFICATION_ENABLED`** | Not `'false'` | Not `'false'` |

### Link to Transfer Certificate Generator

The generator writes Deed of Sale, HPG, CTPL, and MVIR into `issued_certificates` with `file_hash` (and `composite_hash`). For authenticity to pass:

- **With `transferRequestId`:** generated docs are linked to the transfer via `linkDocumentToTransfer`. The HPG/CTPL in `transfer_documents` are the generated ones → same `file_hash` as in `issued_certificates` → authenticity can pass.
- **Standalone:** generated docs are not linked. Seller/buyer must upload the PDFs (e.g. from email). The uploaded file’s `file_hash` must match `issued_certificates` (i.e. byte-identical PDF) for authenticity to pass.

### Files

| Role | Path |
|------|------|
| Transfer forward + auto-verify | `backend/routes/transfer.js` (`forwardTransferToHPG`, `forwardTransferToInsurance`) |
| HPG auto-verify | `backend/services/autoVerificationService.js` (`autoVerifyHPG`) |
| Insurance auto-verify | `backend/services/autoVerificationService.js` (`autoVerifyInsurance`) |
| Authenticity check | `backend/services/certificateBlockchainService.js` (`checkCertificateAuthenticity`) |
