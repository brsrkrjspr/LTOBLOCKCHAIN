# Certificate Generator and Auto-Validation Trace

## 1. How the Certificate Generator Works

### 1.1 Entry points

- **Certificate Generator UI** (`certificate-generator.html`): Admin/insurance verifier can generate insurance (CTPL), HPG clearance, CSR, and (for transfer) combined certificates.
- **Backend routes**: `backend/routes/certificate-generation.js` — all generation goes through this module.

### 1.2 Insurance certificate flow (example)

| Step | Location | What happens |
|------|----------|--------------|
| 1 | **POST** `/api/certificate-generation/insurance/generate-and-send` | Body: ownerId/ownerEmail, vehicleVIN, policyNumber, coverageType, coverageAmount, effectiveDate, expiryDate. Owner resolved from DB. |
| 2 | `certificatePdfGenerator.generateInsuranceCertificate(...)` | Builds PDF buffer, returns `{ pdfBuffer, fileHash, certificateNumber }`. `fileHash` = SHA-256 of PDF content. |
| 3 | `certificatePdfGenerator.generateCompositeHash(certificateNumber, finalVIN, finalExpiryDate, fileHash)` | Composite hash = SHA-256(certificateNumber \| VIN \| expiryDate \| fileHash). Used for uniqueness and duplicate detection. |
| 4 | **DB write** `issued_certificates` | Insert: issuer_id, certificate_type=`insurance`, certificate_number, vehicle_vin, owner_name, file_hash, composite_hash, issued_at, expires_at, metadata. |
| 5 | **Email** | `certificateEmailService.sendInsuranceCertificate(...)` — PDF attached, sent to owner email. |
| 6 | **Response** | Returns certificateNumber, vehicleVIN, fileHash, compositeHash, expiryDate, emailSent. |

So: **certificates** are generated as PDFs, hashed (file + composite), stored in **issued_certificates**, and sent by email. Same pattern applies to HPG, CSR, and transfer bundles (see same file for `/hpg/generate-and-send`, `/csr/...`, transfer batch endpoints).

### 1.3 What happens to the certificates

- **issued_certificates** is the source of truth for “who issued what”: file_hash, composite_hash, certificate_number, vehicle_vin, expires_at, certificate_type (`insurance`, `hpg_clearance`, `csr`, `sales_invoice`).
- **certificates** (clearance workflow) can also store hashes when a cert is approved during registration/transfer.
- **Blockchain**: When a vehicle is REGISTERED, certificate hashes can be stored on Fabric via `certificateBlockchain.storeCertificateHashOnBlockchain` (and during auto-approval; see below).
- **User flow**: Owner/downloader gets the PDF (e.g. CTPL). They upload that PDF (or a copy) when submitting registration or transfer. Backend then runs **auto-validation** on that upload.

### 1.4 Certificate generator ↔ insurance verification (where data lives and how it’s linked)

**How the certificate generator relates to insurance auto-verify**

- The **certificate generator** is the **issuer** of CTPL (and other) certificates. When someone later submits that same certificate (or a re-saved copy) during registration or transfer, **insurance auto-verification** must decide: “Is this the certificate we issued?”  
- That link is implemented by **one shared table**: **`issued_certificates`**. The certificate generator **writes** there when it issues a cert; insurance verification **reads** from there to check authenticity and to run the data-based fallback.

**Where the certificate generator stores the generated certificate**

| Where | What is stored |
|-------|----------------|
| **`issued_certificates`** (DB table) | One row per issued cert: `issuer_id`, `certificate_type` (e.g. `'insurance'`), `certificate_number`, `vehicle_vin`, `owner_name`, **`file_hash`**, **`composite_hash`**, `issued_at`, `expires_at`, `metadata`. This is the **only** place the generator persists certificate data for verification. |
| **Email** | The PDF is sent to the owner; no DB link. The user keeps the file and later uploads it. |
| **PDF file** | Generated in memory and either attached to email or returned; not stored in a “certificate store” by the app. Uploaded copies end up in **documents** (e.g. `documents` table / uploads / IPFS) when the user submits registration. |

**When is data actually written to `issued_certificates`?**

- Only if an **active issuer** exists for that type. Before each insert, the code runs:
  - `SELECT id FROM external_issuers WHERE issuer_type = 'insurance' AND is_active = true LIMIT 1`
- If that returns a row → insert into `issued_certificates` (with that `issuer_id`).  
- If it returns **no row** → log “No active issuer found, skipping database storage” and **do not** insert. Then insurance verification will **never** find that cert in `issued_certificates` (no hash match, no data-based match).

**How it’s linked (certificate generator → insurance verification)**

| Link | How |
|------|-----|
| **Hash-based (exact file)** | Insurance computes SHA-256 of the uploaded PDF → `checkCertificateAuthenticity(fileHash, vehicleId, 'insurance')` → SELECT from **`issued_certificates`** WHERE `file_hash` = … AND `certificate_type` = `'insurance'`. Match ⇒ certificate is the one issued by the generator. |
| **Data-based (re-saved/renamed file)** | Insurance uses OCR (policy number, expiry) and registration vehicle VIN → `findIssuedCertificateByExtractedData(vehicle.vin, policyNumber, 'insurance', expiry)` → SELECT from **`issued_certificates`** WHERE `vehicle_vin` = …, `certificate_number` = …, `certificate_type` = `'insurance'` (and optional expiry). Match ⇒ same logical certificate even if file hash changed. |

So: **same table, same columns**. Generator writes `file_hash`, `composite_hash`, `certificate_number`, `vehicle_vin`, `expires_at`; insurance reads them for authenticity and data-based fallback.

**Where the data is (summary)**

| Data | Location |
|------|----------|
| “This certificate was issued by the system” | **`issued_certificates`** (file_hash, composite_hash, certificate_number, vehicle_vin, expires_at, certificate_type). |
| “Who is allowed to issue” | **`external_issuers`** (issuer_type = `'insurance'`, `'hpg'`, `'csr'`, etc.; `is_active`). Certificate generator uses this to decide whether to insert into `issued_certificates`. |
| Uploaded PDF (for OCR and hashing) | **Documents** (e.g. `documents` table, file path or IPFS CID). Not in `issued_certificates`. |

**Is insurance properly configured to verify these?**

| Requirement | Status |
|-------------|--------|
| **Insurance verification reads `issued_certificates`** | Yes. `checkCertificateAuthenticity` and `findIssuedCertificateByExtractedData` both query `issued_certificates` (and `certificates` for hash). |
| **Certificate generator writes to `issued_certificates` for insurance** | Yes, but **only if** there is an active insurance issuer: `external_issuers` must have a row with `issuer_type = 'insurance'` and `is_active = true`. Seed data in `database/all data.sql` includes such a row (e.g. “LTO Insurance Services”). If that row is missing or `is_active = false`, the generator will **not** store insurance certs and insurance will never auto-approve from this system’s issued certs. |
| **Same certificate_type** | Yes. Generator inserts `certificate_type = 'insurance'`; verification looks up `certificate_type = 'insurance'`. |
| **Same identifiers** | Yes. Verification uses `vehicle_vin`, `certificate_number`, `file_hash`, and (for data fallback) expiry; generator stores all of these. |

**Practical check**

- To have insurance auto-verify certificates produced by the certificate generator:
  1. Ensure **`external_issuers`** has an active row with **`issuer_type = 'insurance'`** and **`is_active = true`**.
  2. Generate the CTPL via the certificate generator (UI or API); then check that a row appears in **`issued_certificates`** with that `certificate_number` and `vehicle_vin`.
  3. Submit registration (or transfer) with that same vehicle and the same certificate (or a re-saved copy). Insurance will then either match by **file_hash** (exact file) or by **data** (VIN + policy number + expiry in `issued_certificates`).

---

## 2. Auto-Validation / Auto-Approval / Auto-Rejection (Insurance)

Insurance uses **hashes** and **extracted data** (OCR) to validate. Logic lives in **backend/services/autoVerificationService.js** (`autoVerifyInsurance`) and is triggered from **backend/services/clearanceService.js** (`sendToInsurance`) when a vehicle is submitted (and from **backend/routes/transfer.js** when forwarding to insurance in transfer).

### 2.1 Sequence (insurance)

| Step | What happens |
|------|--------------|
| 1 | Resolve insurance document file (file_path, storageService, or path construction). |
| 2 | **OCR** `ocrService.extractInsuranceInfo(filePath)` → policy number, expiry, etc. |
| 3 | **Pattern** `validateDocumentNumberFormat(policyNumber, 'insurance')` — e.g. CTPL-YYYY-XXXXXX. |
| 4 | **Expiry** `checkExpiry(ocrData.insuranceExpiry \|\| ocrData.expiryDate)`. |
| 5 | **File hash** From doc or SHA-256(file content). |
| 6 | **Authenticity** `certificateBlockchain.checkCertificateAuthenticity(fileHash, vehicleId, 'insurance')`: lookup by **file_hash** in issued_certificates and certificates. If match → authentic. |
| 7 | **Composite hash** `generateCompositeHash(policyNumber, vehicle.vin, expiryDateISO, fileHash)`. |
| 8 | **Duplicate** `certificateBlockchain.checkHashDuplicate(compositeHash)` — if composite already used (same doc reused), reject. |
| 9 | **Score** `calculatePatternBasedScore(...)` — pattern (50), hash unique (30), not expired (20). |
| 10 | **Decision** (see below). |

### 2.2 Decision logic (insurance)

- **Hash-authentic path (original file):**  
  `shouldApproveByHash` = pattern valid **and** authenticity (file hash match) **and** hash unique **and** not expired **and** score ≥ 80%  
  → **Auto-approve** (and optionally store hash on blockchain), note: “Pattern valid, Certificate authentic, Hash unique, …”.

- **Data-validated path (hash mismatch, e.g. re-saved/renamed file):**  
  If authenticity fails (no file_hash match) but pattern valid, not duplicate, not expired:  
  - Call `certificateBlockchain.findIssuedCertificateByExtractedData(vehicle.vin, policyNumber, 'insurance', expiryFromOCR)`.  
  - This looks up **issued_certificates** by vehicle_vin + certificate_type + certificate_number (and optional expiry).  
  - If a row is found, extracted data is considered to match the backend.  
  `shouldApproveByData` = that match **and** score ≥ 80% **and** pattern valid **and** hash unique **and** not expired  
  → **Auto-approve** with note: “Auto-approved: extracted data matched backend (hash mismatch, e.g. re-saved or renamed file).”

- **Final:**  
  `shouldApprove = shouldApproveByHash || shouldApproveByData`.

- If **not** approved: status set to **PENDING** (not auto-rejected), with full metadata (ocrData, patternCheck, hashCheck, expiryCheck, authenticityCheck, flagReasons) so the insurance verifier can manually approve or reject.

So: **auto-approval** happens when either the file hash matches an issued certificate or the extracted data (policy number, VIN, expiry) matches an issued certificate. **Auto-rejection** is not used; failures result in **PENDING** with reasons. Clearance request status is updated to APPROVED or REJECTED when the backend explicitly does so (e.g. auto-approve or manual action); REJECTED is set when auto-verification returns status REJECTED (e.g. from clearanceService/transfer).

### 2.3 Hash vs extracted data (Insurance org requirement)

- **Hash** can change if the file is re-saved, printed-and-scanned, or renamed in a way that changes bytes. The system still requires authenticity **or** a strong alternative.
- **Extracted data** (OCR): policy number, VIN, expiry, etc. If this **exactly** matches what is in the backend (**issued_certificates** for that vehicle and type), the implementation treats the submission as valid even when the file hash does not match, and **auto-approves with a reason** stating that data matched and hash differed (e.g. re-saved or renamed file).
- Implemented in:
  - **certificateBlockchainService.findIssuedCertificateByExtractedData(vehicleVin, certificateNumber, certificateType, expiryDate)** — lookup by VIN + certificate number + type (+ optional expiry).
  - **autoVerificationService.autoVerifyInsurance** — after authenticity check, if not authentic, runs this data-based lookup; if match and other checks pass, `shouldApproveByData` is true and approval note/metadata include `dataValidatedMatch` and `dataValidatedReason`.

---

## 3. HPG auto-verification (brief)

- **autoVerifyHPG** also uses file hash, composite hash, authenticity (issued_certificates/certificates), and duplicate check. It does **not** auto-approve; it returns a recommendation and pre-filled data. Final approval is manual (HPG officer). Data extraction (OCR) is used for pre-fill and comparison with vehicle/DB.

---

## 4. Where certificates are stored and used

| Store | Purpose |
|-------|--------|
| **issued_certificates** | Issued by certificate generator; key for authenticity (file_hash) and data-based fallback (certificate_number, vehicle_vin, expires_at). |
| **certificates** | Clearance workflow; also queried by file_hash for authenticity. |
| **Blockchain (Fabric)** | Optional storage of certificate hash when vehicle is registered / when auto-approval runs. |
| **Documents / IPFS** | Uploaded PDFs stored as files or by CID; used for OCR and hashing. |

---

## 5. Summary

- **Certificate generator**: Produces PDFs, computes file_hash and composite_hash, writes to **issued_certificates**, sends email. Certificates are then submitted by users and validated by insurance (and HPG) flows.
- **Insurance auto-validation**: Uses OCR (extracted data), pattern, expiry, file hash, authenticity (hash match in issued_certificates/certificates), composite hash, and duplicate check. **Auto-approval** occurs when either (1) file hash matches an issued certificate, or (2) extracted data matches an issued certificate (same VIN, policy number, type, expiry) even when hash does not match — with an explicit reason for the data-validated case. Otherwise the case is left in **PENDING** with full metadata for manual review.
