# Implementation Phases: Insurance (CTPL) & HPG Clearance with Hotlist

**Project:** Vehicle Registration System with Hyperledger Fabric  
**Scope:** Insurance (CTPL) issuance from Insurance org; HPG Clearance flow with hotlist check and report.  
**No implementation yet** — plan only.

**Purpose:** Replace the “certificate generator” (which cannot be shown to panelists) with issuance integrated into organizational and user flows: HPG issues clearance from HPG UI; owner/buyer obtains CTPL from a one-stop shop in owner UI. Issued certificates must be stored so that when the user submits those documents in **initial registration** or **transfer of ownership**, the system can use their **hashes and extracted data for auto-verification**, leading to auto-approval/rejection when documents are auto-sent to respective orgs.

---

## Existing UI / Flow Confirmations

| Question | Answer | Where in doc / codebase |
| :--- | :--- | :--- |
| Is there already a part where **CSR is submitted in HPG** to generate HPG clearance? | **Yes.** The plan covers HPG generating MV clearance from the HPG UI by uploading **CSR** (initial registration) or **OR/CR** (transfer of ownership), running hotlist check, confirming stencil, then generating and emailing the clearance. | Phase B.6 "Issue MV Clearance"; POST `/api/hpg/clearance/extract-document` (CSR or OR/CR), `/api/hpg/clearance/hotlist-check`, `/api/hpg/clearance/issue`. |
| Is there a **form or UI to enter vehicle details** to put them in the hotlist? | **Yes.** "Report Vehicle to Hot List" form in HPG admin dashboard: plate, VIN, engine, chassis, report number, officer, location, type, description. Form exists (`#hotListReportModal` / `#hotListReportForm`); submit is currently UI-only — backend wiring is in Phase B.3 and B.5.3. | `hpg-admin-dashboard.html` → `#hotListReportModal`, `#hotListReportForm`; Phase B.3 (POST `/api/hpg/hotlist/report`) and B.5.3 (wire form to API). |
| Must **OR/CR** also be accepted to generate HPG clearance (for transfer)? | **Yes.** For **transfer of ownership** the vehicle is already registered; the buyer/applicant presents **OR/CR** to HPG to obtain clearance. CSR is for initial (brand-new) registration only. HPG clearance generation therefore accepts **OR/CR** in addition to CSR; backend extracts vehicle data from either. | Phase B.6: Step 1 = upload **CSR or OR/CR**; backend uses `extract-document` and ocrService for both document types. |
| One-stop shop for **transfer**: can **OR/CR** be submitted alongside payment and ID? | **Yes.** Transfer has different requirements than initial registration. The one-stop shop for insurance (CTPL) accepts **OR/CR + payment screenshot + ID** for the transfer path: OR/CR identifies the vehicle; payment and ID satisfy transfer requirements. Buyer can get CTPL without an active transfer request in the system by submitting those. | Phase A.4: for transfer, one-stop shop accepts OR/CR (vehicle identity) + payment screenshot + ID; see A.4.3.1 and A.4.4.1. |

---

## Issued Certificates and Auto-Verification (Critical for Panel Demo)

**Question:** Can the certificates (HPG clearance, CTPL) issued in these flows use their hashes and extracted data for auto-verification in initial registration and transfer?

**Answer: Yes — but only if we store them in the same place auto-verification looks.**

When the user submits documents, selected documents are **auto-sent** to HPG and Insurance. Auto-verification then runs (e.g. `autoVerificationService.autoVerifyHPG`, `autoVerificationService.autoVerifyInsurance`). It uses:

- **Certificate authenticity:** `certificateBlockchainService.checkCertificateAuthenticity(fileHash, certificateType)` looks up **issued_certificates** (and **certificates**) by **file_hash** and certificate_type. If the submitted document’s file hash matches an issued certificate’s file_hash, the certificate is considered authentic → supports auto-approval.
- **Duplicate check:** `checkHashDuplicate(compositeHash)` uses **composite_hash** to block reuse of the same certificate for another vehicle.
- **Extracted data:** OCR and metadata (VIN, policy number, expiry, etc.) are used for scoring and pre-fill.

So when we **issue** HPG clearance (Phase B.6) or CTPL (Phase A.4), we must:

1. **Store the issued certificate** in a table that auto-verification queries: **issued_certificates** (or **certificates**) with at least **file_hash**, **composite_hash**, **certificate_type**, **vehicle_vin** (or vehicle_id), **certificate_number**.
2. Use the same **certificate_type** values that auto-verification expects: `hpg_clearance` for HPG clearance, `insurance` (or the type used for CTPL) for one-stop CTPL.

Then when the user **submits** that same PDF in initial registration (as insurance_cert / hpg_clearance) or in transfer (as buyer_ctpl / buyer_hpg_clearance), the document is auto-sent to Insurance/HPG; auto-verification computes the uploaded file’s hash, finds a match in issued_certificates/certificates, and can **auto-approve** (or recommend auto-approval). No certificate generator is shown; issuance is in HPG UI and one-stop shop; verification is automatic when the issued doc is submitted.

**Concrete requirement (added to phases below):** In Phase B.6 (HPG-originated clearance) and Phase A.4 (one-stop CTPL), when generating and storing the certificate, **insert a row into issued_certificates** (or ensure **certificates** row has file_hash and composite_hash) with the same schema and certificate_type that `checkCertificateAuthenticity` and duplicate-check use, so that auto-verification in initial registration and transfer can match and result in auto-approval.

---

## Confirmations

| Confirmation | Answer | Notes |
| :--- | :--- | :--- |
| User still has to submit HPG clearance? | **Yes** | User uploads HPG clearance document when doing registration (either received by email from HPG-originated issuance or obtained offline). Clearance request is created and sent to HPG for verification. Alternatively, HPG can **generate** clearance in HPG UI (CSR + hotlist + stencil) and email it to the recipient; that recipient then has the PDF to submit. |
| HPG can check in their UI whether the car is carnapped? | **Yes** | HPG UI will show hotlist check result (on-chain stolen status + optional off-chain hotlist) when verifying a clearance request, and will have a dedicated “Check hotlist” / “View hotlist” capability. |
| How do we implement HPG checking the hotlist? | See [Phase B: HPG Hotlist Implementation](#phase-b-hpg-clearance--hotlist) below. | Two sources: (1) **On-chain:** vehicles with `status = STOLEN` on Fabric (ReportStolen). (2) **Off-chain:** existing `hpgDatabaseService.checkHotList()` (mock or future external API). HPG UI runs the combined check and displays result. |

---

## Transfer of Ownership: Seller vs Buyer Submission — Analysis & Recommendation

**Current implementation:** Seller submits (deed of sale, seller ID) when transfer is initiated; buyer submits (buyer ID, TIN, CTPL, HPG clearance) when transfer is accepted.

**Panel concern:** “Buyer has no way to get CTPL through one-stop shop since OR/CR is with the seller; same for HPG clearance. How do we justify this?”

### Critical analysis

| Document | Who needs it | Who has OR/CR? | Can buyer obtain it? |
| :--- | :--- | :--- | :--- |
| **CTPL** | Buyer | Seller (current owner) | **Yes** — one-stop shop for transfer uses **vehicle pre-filled from “My transfer requests”** (transferRequestId). No OR/CR required. Buyer selects the pending transfer → vehicle (VIN, plate, etc.) is pre-filled → Generate CTPL → attach as buyer_ctpl. |
| **HPG clearance** | Buyer | Seller (or anyone with OR/CR) | **Yes — resolved.** Clearances are generated **inside HPG UI** where CSR or OR/CR is submitted and hotlist is checked. **We just need to input the email of who receives the certificate.** Whoever has OR/CR (e.g. seller) goes to HPG UI → Issue MV Clearance → upload OR/CR → hotlist check → stencil → enter **buyer’s email** as recipient → HPG emails clearance to buyer; buyer uploads as buyer_hpg_clearance. No seller upload of OR/CR to the transfer request is required. |

**HPG clearance for transfer is already resolved:** Clearance is generated **inside the HPG UI** where CSR or OR/CR is submitted and the hotlist is checked. The only extra input needed is **the email of who receives the certificate** (Phase B.6 Step 4). For transfer: whoever has OR/CR (e.g. the **seller**) goes to **HPG UI** → Issue MV Clearance → uploads OR/CR → hotlist check → stencil → enters **buyer's email** as recipient → HPG emails clearance to the buyer; buyer uploads that PDF as buyer_hpg_clearance. No seller-upload of OR/CR to the transfer request is required.

### Recommended flow (split submission)

- **Seller initiates:** Uploads deed of sale, seller ID. No OR/CR upload to the transfer is required.
- **Buyer:** Gets invite → sees “My transfer requests” with vehicle pre-filled.
- **Buyer gets CTPL:** One-stop shop → select this transfer → vehicle pre-filled → Generate CTPL → attach as buyer_ctpl. No OR/CR needed.
- **Buyer gets HPG clearance:** Whoever has OR/CR (e.g. seller) goes to **HPG UI** → Issue MV Clearance → uploads CSR or OR/CR → hotlist check → stencil → enters **buyer’s email** as recipient → HPG emails clearance to buyer; buyer uploads as buyer_hpg_clearance. **The only extra input in HPG UI is the recipient email.**
- **Buyer uploads** buyer_id, buyer_tin, buyer_ctpl, buyer_hpg_clearance and clicks **Accept and submit**.

**Panel story:** “Buyer obtains CTPL from the one-stop shop (vehicle pre-filled from transfer). HPG clearance is generated in HPG UI where CSR/OR/CR is submitted and hotlist is checked; the system only needs the email of who receives the certificate. Buyer receives clearance by email and uploads it. Buyer then submits his documents and accepts.”

**Implementation:** (1) One-stop shop for transfer accepts `transferRequestId` and pre-fills vehicle (no OR/CR); (2) HPG clearance: clearances are generated in HPG UI (CSR or OR/CR + hotlist + stencil); **input the recipient email** (e.g. buyer’s) and HPG emails the certificate — no seller upload of OR/CR to the transfer request required.

### Option B: Seller submits “all at once,” buyer only accepts

- **Seller initiates:** Uploads deed of sale, seller ID, and buyer email. Transfer created (e.g. PENDING).
- **Buyer:** Gets invite; gets CTPL (one-stop, vehicle from transfer), gets HPG (using OR/CR from transfer). Buyer **uploads** buyer_id, buyer_tin, buyer_ctpl, buyer_hpg_clearance to the transfer but does **not** click “Submit for review.”
- **Seller** sees “Buyer has uploaded all documents” and clicks **“Submit transfer package”** (moves to UNDER_REVIEW, triggers auto-forward to Insurance/HPG).
- **Buyer** then only clicks **“I accept”** (confirms agreement).

**Panel story:** “Seller is responsible for submitting the complete transfer package; buyer provides his documents to the transfer and only confirms acceptance.”

**Trade-off:** Same documents and same flow for obtaining CTPL/HPG; only difference is who triggers “Submit for review” (seller instead of buyer). Slightly more complex UX (two “submit” moments: buyer uploads, seller finalizes).

### Recommendation

- **Prefer Option A** (keep current “buyer accepts and submits”): HPG clearance is **already resolved**: clearances are generated inside HPG UI where CSR or OR/CR is submitted and hotlist is checked. **We just need to input the email of who receives the certificate** (Phase B.6 Step 4). Seller does not need to upload OR/CR to the transfer; whoever has OR/CR uses HPG UI and enters the buyer’s email. Buyer uses transfer context for CTPL (vehicle pre-filled) and receives HPG clearance by email.
- **Optional Option B** if panelists insist on “seller submits everything”: Implement “Seller submits transfer package” (seller clicks final submit after buyer has uploaded docs); buyer only “Accepts.”

**Concrete doc updates (Option A):** In the proposed transfer workflow below, seller uploads deed_of_sale and seller_id only. Buyer obtains CTPL from one-stop (transfer context) and HPG clearance via HPG UI (recipient email) — no seller OR/CR upload to transfer required.

---

## Schema Alignment (`database/all schema.sql`)

The current schema supports the Insurance (CTPL) and HPG clearance flows **without structural changes**. Reference: `database/all schema.sql`.

| Area | Schema support | Notes |
| :--- | :--- | :--- |
| **Document types** | `document_type` enum: `registration_cert`, `insurance_cert`, `emission_cert`, `owner_id`, `csr`, `hpg_clearance`, `sales_invoice`, `deed_of_sale`, `seller_id`, `buyer_id`, `other`, `tin_id` | CTPL and HPG clearance use `insurance_cert` / `hpg_clearance`; transfer uses `deed_of_sale`, `seller_id`, `buyer_id`, `tin_id`, `buyer_ctpl`, `buyer_hpg_clearance` in `transfer_documents`. |
| **Transfer documents** | `transfer_documents.document_type` CHECK: `deed_of_sale`, `seller_id`, `buyer_id`, `buyer_tin`, `buyer_ctpl`, `buyer_mvir`, `buyer_hpg_clearance`, `other` | Buyer CTPL and HPG clearance map to `buyer_ctpl`, `buyer_hpg_clearance`. No new enum values required. |
| **Certificates** | `certificates`: `vehicle_id`, `certificate_type` (hpg_clearance, insurance, emission), `file_hash`, `composite_hash`, `clearance_request_id`, `document_id`, `issued_by`, etc. | HPG-originated and one-stop CTPL write to `certificates` and/or `issued_certificates` for auto-verification. |
| **Issued certificates** | `issued_certificates`: `file_hash`, `composite_hash`, `certificate_type`, `vehicle_vin`, `certificate_number`, `issuer_id` (external_issuers) | Auto-verification (`checkCertificateAuthenticity`) matches submitted doc hash to these; required for Phase A.4 and B.6. |
| **Clearance requests** | `clearance_requests`: `request_type` (hpg, insurance, emission), `status`, `vehicle_id`, `requested_by`, `assigned_to`, `certificate_id`, `metadata` | Used for request-originated verification and optional HPG-originated audit row. |
| **Transfer requests** | `transfer_requests`: `seller_id`, `buyer_id`, `vehicle_id`, status, `insurance_approval_status`, `hpg_approval_status`, `emission_approval_status`, clearance request FKs | Supports transfer workflow and clearance linkage; no changes needed. |

**Conclusion:** No schema migrations are required for the finalized CTPL one-stop shop (Phase A.4) or HPG-originated clearance (Phase B.6). Ensure application code uses existing `document_type` and `transfer_documents.document_type` values and that issued certificates are stored in `certificates` / `issued_certificates` with correct `file_hash` and `composite_hash` for auto-verification.

---

## Current State (Fact-Based)

### Insurance (CTPL)

| Component | Current State | Gap |
| :--- | :--- | :--- |
| User flow | User submits registration/transfer with insurance document; clearance request `request_type = 'insurance'` is created. | — |
| Insurance routes | `backend/routes/insurance.js`: GET /requests, GET /requests/:id, POST /verify/approve, POST /verify/reject. | — |
| Postgres | `db.updateVerificationStatus(vehicle_id, 'insurance', 'APPROVED' \| 'REJECTED')` on approve/reject. | — |
| Blockchain | `fabricService.updateVerificationStatus(vin, 'insurance', status, notes)` called on approve/reject; chaincode allows **InsuranceMSP** only for `verifierType === 'insurance'`. | CTPL certificate is **not** issued by Insurance org nor bound on-chain by Insurance. |
| Certificate issuance | `POST /api/issuer/insurance/issue-certificate` in `backend/routes/issuer.js` — LTO issuer generates PDF and stores; certificate type is `insurance`. | Issuance is from LTO issuer, not from Insurance org; no `UpdateCertificateHash` by InsuranceMSP. |
| Chaincode | `UpdateVerificationStatus(insurance)` → InsuranceMSP. `UpdateCertificateHash` → **LTOMSP** only. | No chaincode path for Insurance to bind CTPL hash/CID to vehicle. |
| Auto-verification | `autoVerificationService.autoVerifyInsurance()` — OCR, expiry, pattern; updates **Postgres** (and optionally blockchain via existing approve path). | Simulated; no CTPL PDF generated by Insurance org or stored in IPFS and bound on-chain by Insurance. |

### HPG Clearance & Hotlist

| Component | Current State | Gap |
| :--- | :--- | :--- |
| User flow | User submits HPG clearance document; `clearanceService.sendToHPG()` creates clearance request `request_type = 'hpg'`. | — |
| HPG routes | `backend/routes/hpg.js`: verify/approve, verify/reject; update Postgres + `fabricService.updateVerificationStatus(vin, 'hpg', APPROVED \| REJECTED)`. | — |
| Hotlist check (backend) | `hpgDatabaseService.checkVehicle()` → `checkHotList()` (mock list in code). Used in `clearanceService` and `transfer.forwardTransferToHPG()`; result stored in `clearance_requests.metadata.hpgDatabaseCheck`. | Not combined with on-chain `vehicle.status === 'STOLEN'`; HPG UI does not yet show this in request detail. |
| Chaincode | `ReportStolen(ctx, vin, reportData)` — HPG/LTO set `vehicle.status = 'STOLEN'`, `vehicle.stolenReport`. `MarkRecovered(ctx, vin, recoveryData)` — clear stolen. | — |
| Backend Fabric | **No** `reportStolen` or `markRecovered` in `optimizedFabricService.js`; no API route for ReportStolen/MarkRecovered. | HPG cannot report stolen from app. |
| HPG UI | `hpg-admin-dashboard.html`: “Report Vehicle to Hot List” button → `#hotListReportModal` with form (plate, VIN, engine, chassis, report number, officer, location, type, description). | Form **not** wired to any API (no handler in `js/hpg-admin.js` for submit). No “Check hotlist” or “View hotlist” UI. |

---

## Phase A: Insurance (CTPL) — Issuance from Insurance Org & On-Chain Binding

**Objective:** Have Insurance org issue CTPL (or simulated CTPL) and bind its hash/CID on-chain, while keeping user submission and verification flow unchanged.

### A.1 Chaincode

| Task | Detail | Verification |
| :--- | :--- | :--- |
| A.1.1 | Extend certificate binding for Insurance: either allow **InsuranceMSP** to call `UpdateCertificateHash` for type `ctpl` (or `insurance`), or add a new function e.g. `SetInsuranceCertificateHash(vin, fileHash, ipfsCid)` restricted to InsuranceMSP. | Chaincode unit test; only InsuranceMSP can set insurance certificate. |
| A.1.2 | Ensure vehicle asset has a field for insurance/CTPL certificate (e.g. `documents.ctplHash`, `documents.ctplIpfsCid`) or reuse existing certificate structure keyed by type. | Same as current pattern for CSR/sales_invoice. |

### A.2 Backend

| Task | Detail | Verification |
| :--- | :--- | :--- |
| A.2.1 | Add CTPL PDF generation in Insurance flow: when Insurance verifier **approves** a request, optionally generate a CTPL certificate PDF (template, vehicle/owner data), store in IPFS, then call chaincode to set CTPL hash/CID for that VIN using **Insurance identity** (admin-insurance / InsuranceMSP). | Approval response includes certificate link or CID; on-chain vehicle has CTPL hash/CID. |
| A.2.2 | Ensure `fabricService` uses Insurance identity when calling the new/updated certificate hash setter for CTPL (same pattern as LTO identity for CSR). | Logs or test show InsuranceMSP used for the transaction. |
| A.2.3 | Keep existing behavior: user still uploads insurance document; Insurance verify/approve/reject unchanged; Postgres and `UpdateVerificationStatus(insurance)` unchanged. | No regression in current Insurance approval/rejection. |

### A.3 Frontend / UX

| Task | Detail | Verification |
| :--- | :--- | :--- |
| A.3.1 | No separate “Certificate Generator” for Insurance. CTPL issuance is part of Insurance verification workflow (e.g. after approval, show “CTPL certificate issued” or download link if generated). | UX matches “issuance from organizational counterpart.” |

### Trace: Insurance Approval with CTPL Binding

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Insurance dashboard – Approve | POST /api/insurance/verify/approve | insurance.js (approve handler) | clearance_requests.status, vehicle_verifications | Mandatory |
| 2 | (same) | (same) | db.updateVerificationStatus(vehicle_id, 'insurance', 'APPROVED') | vehicle_verifications | Mandatory |
| 3 | (same) | (same) | fabricService.updateVerificationStatus(vin, 'insurance', 'APPROVED', notes) | Fabric: vehicle.verificationStatus.insurance | Mandatory |
| 4 | (same) | (same) | Generate CTPL PDF → IPFS → fabricService.setInsuranceCertificateHash(vin, hash, cid) [new] | Fabric: vehicle.documents.ctpl* / certificates | Optional (Phase A) |

---

## Phase A.4: Insurance One-Stop Shop (Owner/User UI)

**Objective:** One-stop shop in owner/user UI where the user obtains CTPL on the spot: submit CSR (initial registration) or use vehicle context (transfer), select one insurance company (for now), mock payment (screenshot), then CTPL is generated and attached or downloaded. No separate “certificate generator” page; issuance is integrated into the user flow.

### A.4.1 Critical Analysis & Confirmations

**Does this only work for initial registration?**  
**No.** It can serve both:

- **Initial registration:** User (owner) submits **CSR** (Original LTO Sales of Stock Reported) at the one-stop shop. Vehicle data is extracted from CSR (VIN, make, model, etc.). One insurance company, mock payment screenshot, CTPL generated on the spot. The generated CTPL is then used when submitting registration (attach to vehicle as `insurance_cert` or auto-attach if same session).
- **Transfer of ownership:** The **buyer** needs CTPL (current code: `buyer_ctpl` is required; `backend/routes/transfer.js` and `vehicles.js` require buyer_id, buyer_tin, **buyer_ctpl**, buyer_hpg_clearance). So the one-stop shop for transfer is used by the **buyer**: vehicle is already known (from the transfer request: vehicle_id, VIN, plate). Buyer opens one-stop shop (optionally in context of “my transfer” so vehicle is pre-filled), selects insurance company, mock payment screenshot, CTPL generated → buyer downloads or attaches that document as **buyer_ctpl** to the transfer request via existing `linkTransferDocuments` (e.g. upload the generated PDF and link as `buyer_ctpl`).

**Transfer workflow (seller vs buyer) — traced:**

| Actor | Action | Documents |
| :--- | :--- | :--- |
| **Seller** | Creates transfer request; uploads deed of sale, seller ID. | seller_id, deed_of_sale |
| **Buyer** | Accepts invite; must upload buyer ID, TIN, **CTPL**, HPG clearance. | buyer_id, buyer_tin, **buyer_ctpl**, buyer_hpg_clearance |
| System | When buyer has uploaded docs, can auto-forward to Insurance (using buyer’s CTPL doc) and HPG. | clearance_requests (insurance, hpg) |
| LTO | Approves transfer only when all required docs present (including buyer_ctpl). | — |

So CTPL in transfer is **buyer’s** CTPL. The one-stop shop for transfer is therefore **buyer-facing**: buyer gets CTPL there (vehicle from transfer context), then attaches it as buyer_ctpl.

**Proposed transfer workflow (seller and buyer):**

| Step | Actor | Action | Documents |
| :--- | :--- | :--- | :--- |
| 1 | **Seller** | Initiates transfer; uploads deed of sale, seller ID. | deed_of_sale, seller_id |
| 2 | **System** | Creates transfer request; sends invite to buyer. Buyer sees vehicle (pre-filled from transfer). | — |
| 3 | **Buyer** | Obtains CTPL and HPG clearance, then uploads: buyer ID, TIN, CTPL, HPG clearance. | buyer_id, buyer_tin, buyer_ctpl, buyer_hpg_clearance |
| 4 | **Buyer** | **CTPL:** One-stop shop → select this transfer (vehicle pre-filled) → Generate CTPL → attach as buyer_ctpl. **HPG clearance:** Whoever has OR/CR (e.g. seller) goes to **HPG UI** → Issue MV Clearance → upload CSR or OR/CR → hotlist check → stencil → enter **buyer's email** as recipient → HPG emails clearance; buyer uploads as buyer_hpg_clearance. | — |
| 5 | **System** | When buyer has uploaded required docs, auto-forwards to Insurance and HPG for clearance. | clearance_requests |
| 6 | **LTO** | Approves transfer when all required docs and clearances are satisfied; ownership updated; OR/CR (or completion) available after mock payment for that application. | — |

**Transfer entry for one-stop CTPL:** From **“My transfer requests”** (buyer view). Buyer selects the transfer they accepted; vehicle (VIN, plate, etc.) is **pre-filled** from that transfer request. No standalone “Get CTPL for a vehicle” with manual VIN/transfer id entry required; entry is from the list of transfer requests where the user is the buyer.

**Insurance company confirmation: skip or include?**  
**Recommendation: Skip** for the one-stop shop. CTPL is generated on the spot and issued immediately; no Insurance verifier approval step in Insurance UI. For audit, optionally create a clearance_request with status COMPLETED and link the issued certificate. This keeps the “instant CTPL” UX. If you later need Insurance org to confirm every policy, add **Include** as an optional mode (e.g. config or checkbox).

**Mock payment (application-level, not CTPL-specific):**  
Mock payment is **not** specific to the one-stop CTPL flow. It applies to the **application** (initial registration or transfer of ownership):

- **When:** Once the **transaction is approved** (LTO has approved registration, or transfer is approved), the user/owner must complete **payment for that specific application** by submitting a payment screenshot (mock).
- **Effect:** After payment screenshot is submitted for that application, **OR/CR can be accessed** (for registration) or transfer completion is fully unlocked. No real payment gateway; screenshot is stored and used as the gate for OR/CR access.
- **One-stop CTPL:** No separate payment step is required inside the CTPL flow. Payment is for the application (registration/transfer), not for CTPL issuance. CTPL one-stop shop can proceed without payment screenshot if desired; keep it minimal (optional or omit in one-stop CTPL).

### A.4.2 Flow Summary

| Context | Who | Input | Steps | Output |
| :--- | :--- | :--- | :--- | :--- |
| **Initial registration** | Owner | CSR (upload) | Select insurance company (one for now) → [optional mock payment] → Generate CTPL | CTPL PDF; attach to registration as insurance_cert (or auto-attach) |
| **Transfer** | Buyer | Vehicle pre-filled from **“My transfer requests”** | Select insurance company → [optional mock payment] → Generate CTPL | CTPL PDF; buyer attaches as **buyer_ctpl** to transfer request |

Mock payment for **the application** (registration or transfer) is done **after** the transaction is approved: user submits payment screenshot for that application → then OR/CR (or completion) can be accessed. No payment step required inside the one-stop CTPL flow.

### A.4.3 Backend Tasks

| Task | Detail | Verification |
| :--- | :--- | :--- |
| A.4.3.1 | **POST `/api/insurance/one-stop/init`** or **`/api/insurance/one-stop/quote`** (auth: vehicle_owner). Body for **initial:** `{ csrDocumentId }` or multipart CSR file (then OCR extract VIN, make, model, year, etc.). Body for **transfer:** either `{ transferRequestId }` (vehicle pre-filled from “My transfer requests”) or `{ orCrDocumentId }` / multipart **OR/CR** + **payment screenshot** + **ID** (transfer path: OR/CR identifies vehicle, payment and ID satisfy transfer requirements). Backend returns vehicle data (from transfer request or from OR/CR extraction), list of insurance companies (one for now), session or quote id. | UI can show vehicle and “Select insurance” → Generate CTPL; transfer can use OR/CR + payment + ID. |
| A.4.3.2 | **POST `/api/insurance/one-stop/issue`** (auth: vehicle_owner). Body: `{ sessionId or quoteId, insuranceCompanyId }` (and for initial: vehicle/owner from session; for transfer: vehicle_id + buyer as “owner” for CTPL). Generate CTPL PDF (reuse certificate generator / issuer logic), compute **file_hash** and **composite_hash**, store in IPFS/local, create document (type `insurance_cert`) and optionally `certificates` row. **Store in `issued_certificates`** (file_hash, composite_hash, certificate_type = `insurance`, vehicle_vin, certificate_number, issuer_id if applicable) so that when the user attaches that CTPL to registration (insurance_cert) or to transfer (buyer_ctpl), **auto-verification** (`checkCertificateAuthenticity`) can match and result in auto-approval when documents are auto-sent to Insurance. If **initial registration:** return document id so frontend can attach to vehicle registration. If **transfer:** return document id so frontend can call `linkTransferDocuments` with that document as `buyer_ctpl`. Optionally create clearance_request (status COMPLETED; skip Insurance confirmation). No payment screenshot required for CTPL issuance. | User receives CTPL PDF and document id; can attach to registration or transfer; auto-verification can match hash and auto-approve. |
| A.4.3.3 | **Mock payment (application-level):** Separate from one-stop CTPL. After registration or transfer is **approved**, user submits payment screenshot for **that application** (vehicle_id or transfer_request_id); backend stores it (e.g. document type `payment_screenshot` or `other`). Gate OR/CR download (or transfer completion) on “payment received” for that application. No real payment validation. | OR/CR (or completion) accessible only after mock payment for the application. |
| A.4.3.4 | **Insurance company:** For now single company (e.g. from `external_issuers` where issuer_type = 'insurance' or config). No “select from many” until multiple companies are supported. | One insurance company to select (or auto-selected). |

### A.4.4 Frontend: Owner/User UI

| Task | Detail | Verification |
| :--- | :--- | :--- |
| A.4.4.1 | **One-stop shop page/section** (e.g. “Get CTPL” or “Insurance” in owner dashboard). Entry: (1) **For new registration:** “I’m registering a new vehicle” → upload CSR → show extracted vehicle → select insurance → Generate → download CTPL and/or “Attach to my registration.” (2) **For transfer:** either “My transfer requests” → buyer selects the transfer (vehicle pre-filled) → select insurance → Generate; or **simplified transfer path:** submit **OR/CR + payment screenshot + ID** (OR/CR identifies vehicle; transfer has different requirements) → select insurance → Generate → download CTPL and “Attach to transfer” (link as buyer_ctpl). | Single entry point; both flows supported; transfer can use “My transfer requests” or OR/CR + payment + ID. |
| A.4.4.2 | **Mock payment (application-level):** Shown **after** registration or transfer is approved. User submits payment screenshot for that application → OR/CR (or completion) becomes accessible. Separate UI (e.g. “Pay for this application” / “Submit payment proof”) on vehicle or transfer detail. | Payment is for the application, not for CTPL. |
| A.4.4.3 | **After generation:** For initial registration, either auto-attach document to current registration draft (if same session) or show “Download CTPL” + “Go to registration and upload this document.” For transfer, “Attach to transfer” → use existing transfer document link as buyer_ctpl (document id from one-stop issue response). | CTPL is used in registration or transfer as required. |

### A.4.5 Insurance Verifier Confirmation (Recommendation: Skip)

| Option | When | Effect |
| :--- | :--- | :--- |
| **Skip** (recommended) | One-stop shop issues CTPL immediately; no clearance sent to Insurance UI. | Instant CTPL; optionally create clearance_request COMPLETED for audit. |
| **Include** | One-stop shop creates clearance_request PENDING and sends to Insurance; Insurance verifier approves in their UI (existing flow). | Insurance org “confirms” the policy; may delay issuance until approved. |

**Recommendation: Skip** for the one-stop shop so CTPL is generated on the spot. Add **Include** as an optional mode later if Insurance org must confirm every policy.

### Trace: Insurance One-Stop Shop — Initial Registration

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | One-stop shop – Upload CSR | POST /api/insurance/one-stop/init (or quote) | ocrService (CSR extract); return vehicle data | — | Mandatory |
| 2 | One-stop shop – Generate CTPL | POST /api/insurance/one-stop/issue | Generate CTPL PDF; store; create document (insurance_cert); optional certificates/clearance_request | documents, optional certificates/clearance_requests | Mandatory |
| 3 | Registration – Attach CTPL | (existing) registration submit with documents | registrationData.documents includes insurance_cert (from one-stop doc id) | vehicles, documents, clearance when submitted | Mandatory |
| (later) | After approval – Mock payment | POST payment screenshot for application | Store screenshot; gate OR/CR access on “payment received” | documents, application payment state | Application-level |

### Trace: Insurance One-Stop Shop — Transfer (Buyer)

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | One-stop shop – Select transfer (“My transfer requests”) | POST /api/insurance/one-stop/init (transferRequestId) | Load transfer request + vehicle; return vehicle + buyer info (vehicle pre-filled) | — | Mandatory |
| 2 | One-stop shop – Generate CTPL | POST /api/insurance/one-stop/issue | Generate CTPL; return document id | documents, optional certificates | Mandatory |
| 3 | Transfer – Attach CTPL as buyer | POST /api/transfer/requests/:id/documents/link | linkTransferDocuments with document_id and buyer_ctpl | transfer_documents | Mandatory |
| 4 | (existing) Buyer accepts / LTO approves | Existing transfer flow | forwardTransferToInsurance uses buyer’s CTPL doc | clearance_requests (insurance) | Mandatory |
| (later) | After approval – Mock payment | POST payment screenshot for transfer application | Store screenshot; gate completion/OR/CR on “payment received” | documents, application payment state | Application-level |

---

## Phase B: HPG Clearance & Hotlist

**Objective:** (1) User still submits HPG clearance; (2) HPG can check in their UI whether the vehicle is carnapped/stolen (hotlist); (3) HPG can report a vehicle to the hotlist (on-chain + optional local list for unminted vehicles).

### B.1 Hotlist Definition

- **On-chain hotlist:** Vehicles with `vehicle.status === 'STOLEN'` on Fabric (set via `ReportStolen`).
- **Off-chain hotlist:** Current `hpgDatabaseService.checkHotList()` — mock list in code; replaceable later by external HPG API (e.g. plate/engine/chassis check).

**Combined check:** For a given clearance request (with VIN/plate/engine/chassis), backend runs both and merges results; store in `clearance_requests.metadata` and show in HPG UI.

### B.2 Backend: Hotlist Check (for a clearance request)

| Task | Detail | Verification |
| :--- | :--- | :--- |
| B.2.1 | New or extended API used by HPG UI when viewing a request, e.g. GET `/api/hpg/requests/:id/hotlist-check` or include hotlist result in existing GET `/api/hpg/requests/:id`. | Response includes `hotlistCheck: { onChain: CLEAN \| FLAGGED, offChain: CLEAN \| FLAGGED \| ERROR, combined: CLEAN \| FLAGGED, details }`. |
| B.2.2 | Implementation: (1) Load clearance request and vehicle (VIN, plate, engine, chassis). (2) If VIN present, call `fabricService.getVehicle(vin)`; if `vehicle.status === 'STOLEN'`, set `onChain: FLAGGED` and include `stolenReport`. (3) Call `hpgDatabaseService.checkVehicle({ plateNumber, engineNumber, chassisNumber, vin })`; use existing `status` (CLEAN/FLAGGED) for `offChain`. (4) Combine: if either FLAGGED → `combined: FLAGGED`. (5) Store result in `clearance_requests.metadata.hpgHotlistCheck` (and keep existing `hpgDatabaseCheck` if already used elsewhere). | Metadata updated; HPG request detail shows FLAGGED/CLEAN and details. |
| B.2.3 | Optionally run this check automatically when request is assigned or opened (e.g. in GET request/:id), so HPG always sees the latest hotlist result. | No extra “Run check” required for basic UX. |

### B.3 Backend: Report to Hotlist (ReportStolen)

| Task | Detail | Verification |
| :--- | :--- | :--- |
| B.3.1 | Add to `optimizedFabricService.js`: `reportStolen(vin, reportData)` and `markRecovered(vin, recoveryData)` calling chaincode `ReportStolen` and `MarkRecovered` using **HPG identity** (admin-hpg / HPGMSP). | Only HPG (or LTO) identity used; chaincode allows HPGMSP. |
| B.3.2 | New route: POST `/api/hpg/hotlist/report` (auth: HPG admin). Body: VIN (optional if not on chain), plate, engine, chassis, reportNumber, officerId, location, reportType (STOLEN/CARNAPPED/etc.), description. | 201 with transaction ID when vehicle on Fabric; clear error when VIN not found on chain. |
| B.3.3 | Logic: If VIN provided and vehicle exists on Fabric, call `fabricService.reportStolen(vin, reportData)`. If VIN not provided or vehicle not on chain, optionally insert into a local table e.g. `vehicle_hotlist` (plate, engine, chassis, vin, reason, reported_at, reported_by) so that `hpgDatabaseService.checkHotList()` can source from DB instead of mock (future). | On-chain vehicle → Fabric updated; off-chain-only → local hotlist table (optional). |
| B.3.4 | New route: POST `/api/hpg/hotlist/recover` (body: vin, recoveryData) calling `markRecovered` for HPG. | Vehicle status restored on Fabric. |

### B.4 Backend: View Hotlist (List Stolen Vehicles)

| Task | Detail | Verification |
| :--- | :--- | :--- |
| B.4.1 | Option A: Add chaincode rich query (e.g. `GetVehiclesByStatus('STOLEN')`) if CouchDB supports it. Backend: GET `/api/hpg/hotlist` → call query, return list. | HPG UI can show on-chain stolen list. |
| B.4.2 | Option B: Without new chaincode, maintain a local cache/sync: e.g. table `vehicle_hotlist` updated when ReportStolen/MarkRecovered is called (and optionally by event listener). GET `/api/hpg/hotlist` returns from DB. | Same UX; implementation avoids rich query. |
| B.4.3 | If using local `vehicle_hotlist` table for off-chain reports (B.3.3), merge on-chain and DB list in GET `/api/hpg/hotlist` (e.g. “On-chain” vs “Local” or single combined list). | HPG sees one hotlist view. |

### B.5 Frontend: HPG UI

| Task | Detail | Verification |
| :--- | :--- | :--- |
| B.5.1 | **Request detail (e.g. hpg-request-detail or inline in list):** Show hotlist check result (CLEAN/FLAGGED, on-chain and off-chain details). If FLAGGED, show reason and recommend reject or manual review. | HPG can see “car is carnapped/stolen” per request. |
| B.5.2 | **“Check hotlist” button (optional):** If not auto-running on load, add button to run GET hotlist-check and refresh the result. | Same data, on demand. |
| B.5.3 | **Report to hotlist:** Wire `#hotListReportForm` in `hpg-admin-dashboard.html` to POST `/api/hpg/hotlist/report`. On success, show message and optionally refresh hotlist view. | HPG can report stolen/carnapped from UI. |
| B.5.4 | **View hotlist:** New page or section “View hotlist” that calls GET `/api/hpg/hotlist` and displays table (VIN, plate, engine, chassis, report number, date, status). | HPG can open hotlist and see all flagged vehicles. |
| B.5.5 | **Mark recovered (optional):** From hotlist view, action “Mark recovered” for a VIN → POST `/api/hpg/hotlist/recover`. | Completes lifecycle. |

### Trace: HPG Verification with Hotlist Check

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | HPG request detail | GET /api/hpg/requests/:id | hpg.js (get request) | — | Mandatory |
| 2 | (same) | GET /api/hpg/requests/:id or .../hotlist-check | hpgDatabaseService.checkVehicle; fabricService.getVehicle(vin) | clearance_requests.metadata.hpgHotlistCheck | Mandatory |
| 3 | HPG Approve | POST /api/hpg/verify/approve | hpg.js (approve) | clearance_requests, vehicle_verifications, Fabric verificationStatus.hpg | Mandatory |
| 4 | HPG Reject | POST /api/hpg/verify/reject | hpg.js (reject) | Same | Mandatory |

### Trace: HPG Report to Hotlist

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Hot list report modal – Submit | POST /api/hpg/hotlist/report | hpg.js (new) → fabricService.reportStolen(vin, reportData) | Fabric: vehicle.status = STOLEN, vehicle.stolenReport | Mandatory |
| 2 | (optional) No VIN / not on chain | (same) | Insert into vehicle_hotlist | vehicle_hotlist | Optional |

---

## Phase B.6: HPG-Originated Clearance — Issue MV Clearance from CSR or OR/CR

**Objective:** Integrate HPG clearance **generation** into the HPG UI (no separate certificate generator). HPG uploads **CSR** (for initial registration) or **OR/CR** (for transfer of ownership), runs hotlist check, confirms stencil (physical compliance attested digitally), then generates the MV clearance PDF and emails it to the recipient. The recipient then has the clearance document to submit when doing registration or transfer.

- **CSR** (“Original LTO Sales of Stock Reported”): used for **brand-new local registration** (vehicle not yet registered).
- **OR/CR** (Official Receipt / Certificate of Registration): used when the vehicle is **already registered** (e.g. **transfer of ownership**); the buyer or applicant presents OR/CR to obtain HPG clearance. OR/CR must be accepted so HPG can issue clearance for transfer.

**Two ways to obtain HPG clearance (after implementation):**

1. **Request-originated (existing):** Owner/LTO creates a clearance request with uploaded docs → HPG verifies → HPG releases certificate (hpg-verification-form + hpg-release-certificate).
2. **HPG-originated (new):** HPG starts from **CSR or OR/CR** upload → hotlist check → stencil confirmation → generate clearance → email recipient. Recipient uses that PDF in registration (initial) or transfer.

### B.6.1 Workflow Summary

| Step | HPG UI | Backend / Data |
| :--- | :--- | :--- |
| 1 | Upload **CSR or OR/CR** (CSR for initial registration, OR/CR for transfer) | OCR/extract VIN, engine number, chassis number, plate (reuse `ocrService` CSR extraction for CSR; use or_cr/registration_cert extraction for OR/CR). Return extracted data for confirmation/edit. |
| 2 | Hotlist check | Run combined check: `fabricService.getVehicle(vin)` for STOLEN; `hpgDatabaseService.checkVehicle(...)`. If **FLAGGED**: show result, do **not** allow generating clearance. If **CLEAN**: enable next step. |
| 3 | Stencil confirmation | Checkbox: “Stencil of engine and chassis number verified” (optional: officer ID, date). Physical compliance is not digitized; this is a digital attestation. |
| 4 | Recipient + Generate | Input: recipient email (and optionally name). Action: “Generate clearance and send email”. Backend: resolve/create vehicle, generate PDF, store, create certificate, email recipient. |

### B.6.2 Backend Tasks

| Task | Detail | Verification |
| :--- | :--- | :--- |
| B.6.2.1 | **POST `/api/hpg/clearance/extract-document`** (auth: HPG admin). Body: multipart file (**CSR or OR/CR** PDF) and optional `documentType: 'csr' | 'or_cr'`. Use existing CSR extraction in `ocrService.js` for CSR; use or_cr/registration_cert extraction for OR/CR to return `{ vin, engineNumber, chassisNumber, plateNumber, make, model, year, ... }`. Return extracted data for UI to display/edit. | UI can show and correct extracted identifiers; supports both initial (CSR) and transfer (OR/CR). |
| B.6.2.2 | **POST `/api/hpg/clearance/hotlist-check`** (auth: HPG admin). Body: `{ vin, plateNumber, engineNumber, chassisNumber }` (from Step 1). Run combined hotlist check (on-chain + off-chain). Return `{ combined: CLEAN \| FLAGGED, onChain, offChain, details }`. If FLAGGED, frontend must not allow “Generate clearance”. | Same logic as B.2.2 but for standalone check (no clearance_request required). |
| B.6.2.3 | **POST `/api/hpg/clearance/issue`** (auth: HPG admin). Body: `{ documentId or extractedData, documentType: 'csr' | 'or_cr', recipientEmail, recipientName (optional), stencilVerified: true, stencilOfficerId (optional), stencilDate (optional) }`. Validate: hotlist combined === CLEAN, stencilVerified === true. Resolve or create **vehicle**: if vehicle exists by VIN use it; else create **minimal vehicle** from extracted data (VIN, engine, chassis, make, model, year; status e.g. `PENDING_REGISTRATION` or `HPG_CLEARANCE_ISSUED`) because `certificates.vehicle_id` is NOT NULL. Generate HPG clearance PDF (reuse or mirror logic from hpg release/issuer), compute **file_hash** and **composite_hash**, store in IPFS/local, create row in **`certificates`** (vehicle_id, type `hpg_clearance`, file_hash, composite_hash, clearance_request_id NULL or link to new HPG-originated clearance_request). **Store in `issued_certificates`** (file_hash, composite_hash, certificate_type = `hpg_clearance`, vehicle_vin, certificate_number, issuer_id if applicable) so that when the recipient submits that PDF in registration or transfer, **auto-verification** (`checkCertificateAuthenticity`) can match and result in auto-approval. Optionally create **HPG-originated clearance_request** for audit. Send email to recipient with link/download to clearance PDF. Return certificate id and recipient email. | Recipient receives email; certificate stored; user has PDF to submit; auto-verification can match hash and auto-approve. |
| B.6.2.4 | Reuse existing certificate number generator, composite hash, and duplicate-check logic (e.g. `certificateBlockchainService`) so issued clearance is unique and traceable. | No duplicate certificate reuse. |

### B.6.3 Frontend: HPG UI — “Issue MV Clearance”

| Task | Detail | Verification |
| :--- | :--- | :--- |
| B.6.3.1 | New page or section **“Issue MV Clearance”** (e.g. `hpg-issue-clearance.html` or new section in dashboard). Step 1: Upload **CSR or OR/CR** (selector or auto-detect from file); call POST `/api/hpg/clearance/extract-document`; display extracted VIN, engine, chassis, plate (editable if needed). | HPG can upload CSR (initial) or OR/CR (transfer) and see/edit extracted data. |
| B.6.3.2 | Step 2: Button “Check hotlist”. Call POST `/api/hpg/clearance/hotlist-check` with current identifiers. Display result (CLEAN / FLAGGED and details). If FLAGGED, disable “Generate clearance” and show reason. | HPG sees hotlist result before generating. |
| B.6.3.3 | Step 3: Checkbox “Stencil of engine and chassis number verified” (required). Optional fields: officer ID, date. | Physical compliance attested; cannot proceed without checkbox. |
| B.6.3.4 | Step 4: Input recipient email (required), optional recipient name. Button “Generate clearance and send email”. Call POST `/api/hpg/clearance/issue`. On success, show “Clearance generated and sent to &lt;email&gt;”. Optionally show download link for the issued certificate. | Recipient receives email; HPG sees confirmation. |

### B.6.4 Schema / Design Notes

- **`certificates.vehicle_id` NOT NULL:** When the vehicle does not exist yet (e.g. brand-new local registration), create a **minimal vehicle** record from CSR data (VIN, engine_number, chassis_number, make, model, year; status e.g. `PENDING_REGISTRATION`) so the certificate can be linked. Alternatively, restrict this flow to vehicles already in the system (lookup by VIN only); then no minimal vehicle creation.
- **Stencil:** Not digitized; only a checkbox + optional officer/date. This matches “we really can’t digitize the physical compliance so just marking it down.”
- **Clearance request:** Optional. For audit, create an HPG-originated `clearance_requests` row (vehicle_id, request_type `hpg`, status COMPLETED, requested_by = HPG user, metadata with recipient email and stencil info) and set `certificates.clearance_request_id` to that id.

### Trace: HPG-Originated Clearance Issuance

| Step | UI Component | API Route | Service Logic (File:Line) | Data Mutated | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Issue MV Clearance – Upload CSR or OR/CR | POST /api/hpg/clearance/extract-document | ocrService (CSR or OR/CR extraction) | — | Mandatory |
| 2 | Issue MV Clearance – Check hotlist | POST /api/hpg/clearance/hotlist-check | hpgDatabaseService.checkVehicle; fabricService.getVehicle(vin) | — | Mandatory |
| 3 | Issue MV Clearance – Stencil + email, Generate | POST /api/hpg/clearance/issue | Resolve/create vehicle; generate PDF; store; certificates insert; optional clearance_requests; email | vehicles (if new), certificates, optional clearance_requests | Mandatory |

---

## Phase C: Database (Optional for Hotlist)

| Task | Detail | Verification |
| :--- | :--- | :--- |
| C.1 | If off-chain hotlist is to be sourced from DB: add table e.g. `vehicle_hotlist` (id, vin, plate_number, engine_number, chassis_number, reason, report_number, officer_id, location, report_type, reported_by_user_id, reported_at, resolved_at, created_at, updated_at). | Migration; hpgDatabaseService.checkHotList() can query this table instead of mock. |
| C.2 | When ReportStolen is called for a vehicle not on Fabric, insert into `vehicle_hotlist`. When MarkRecovered or “resolve” is called, update `resolved_at` or status. | Hotlist check returns FLAGGED for these records until resolved. |

---

## Implementation Order (Suggested)

1. **Phase B.2** – Hotlist check (backend + include in GET request/:id) and **B.5.1** – Show result in HPG request detail.  
   → HPG can see whether the car is carnapped/stolen when verifying.
2. **Phase B.3** – ReportStolen/MarkRecovered in fabricService and POST `/api/hpg/hotlist/report` (and recover).  
   → Backend supports reporting.
3. **Phase B.5.3** – Wire hot list report form to API.  
   → HPG can report from UI.
4. **Phase B.4 + B.5.4** – View hotlist API and UI.  
   → HPG can open hotlist list.
5. **Phase B.6** – HPG-originated clearance: POST extract-document (CSR or OR/CR), hotlist-check, issue; new “Issue MV Clearance” UI (upload CSR or OR/CR → hotlist check → stencil → recipient email → generate and send). Optional: minimal vehicle creation from extracted data when vehicle does not exist.  
   → HPG generates clearance in HPG UI and emails it so the user has something to submit; no separate certificate generator for this flow.
6. **Phase A** – Insurance CTPL issuance and on-chain binding (chaincode + backend + UX).  
   → Insurance org issues and binds CTPL.
7. **Phase A.4** – Insurance one-stop shop (owner/user UI): POST one-stop/init (CSR for initial, transferRequestId from “My transfer requests” for transfer), one-stop/issue; CTPL generated on the spot; attach to registration (insurance_cert) or to transfer (buyer_ctpl). Skip Insurance verifier confirmation (instant). Mock payment is application-level (after approval → submit screenshot → OR/CR accessible); not required in CTPL flow.  
   → One-stop shop for CTPL; works for initial registration and for transfer (buyer). Proposed transfer workflow: seller (deed of sale, owner ID) → buyer (CTPL, MVIR, TIN, owner ID); CTPL and MVIR are buyer’s responsibility.
8. **Phase C** – Optional DB hotlist table and integration with checkHotList.  
   → Replace mock with DB (and optionally external API later).

---

## Summary Table

| Area | What is implemented (after phases) | Confirmation |
| :--- | :--- | :--- |
| User | Submits HPG clearance document when doing registration (received by email from HPG-originated issuance or obtained offline); clearance request created and sent to HPG for verification. | User still submits HPG clearance. |
| HPG | Sees hotlist check result (on-chain + off-chain) per request; can report vehicle to hotlist; can view hotlist; can mark recovered. **Can also issue MV clearance from HPG UI:** upload **CSR or OR/CR** → hotlist check → stencil confirmation → generate clearance PDF → email recipient. | HPG can check in their UI whether the car is carnapped/stolen and can generate clearance so the user has something to submit. |
| Hotlist | On-chain = Fabric `status STOLEN`; off-chain = hpgDatabaseService (mock or DB/external API); combined check and display in HPG UI. | Concrete plan for “how we implement HPG checking the hotlist.” |
| HPG-originated clearance | Upload **CSR or OR/CR** → OCR extract VIN/engine/chassis → hotlist check (CLEAN required) → stencil attested (checkbox) → recipient email → generate PDF, store, email. Optional minimal vehicle from extracted data when vehicle does not exist (`certificates.vehicle_id` NOT NULL). | Clearance generation integrated in HPG UI; no separate certificate generator for this flow. |
| Insurance | Insurance verifier approves → optional CTPL generation and on-chain binding by InsuranceMSP; user flow unchanged. **One-stop shop (Phase A.4):** Owner/buyer gets CTPL in owner UI: CSR (initial) or vehicle from “My transfer requests” (buyer) → select insurance (one for now) → CTPL generated on the spot → attach to registration or as buyer_ctpl. **Recommendation:** Skip Insurance verifier confirmation (instant). **Mock payment:** Application-level only — after registration or transfer is approved, user submits payment screenshot for that application → OR/CR (or completion) accessible. | Issuance from Insurance org; one-stop shop for instant CTPL; payment is for application, not CTPL. |

### Clarifications Resolved

- **Insurance confirmation:** **Skip** for one-stop shop (instant CTPL); Include optional later.
- **Payment:** Mock payment is **application-level**: after registration or transfer is approved, user submits payment screenshot for that application → OR/CR (or completion) accessible. Not required inside one-stop CTPL flow.
- **Transfer entry:** From **“My transfer requests”** (buyer); vehicle pre-filled from selected transfer. CTPL and MVIR are buyer’s responsibility; seller uploads deed of sale and owner ID only.

### Does This Doc Resolve Transfer of Ownership?

**Yes.** The doc resolves the transfer workflow where documents are required:

- **Seller:** Initiates transfer; uploads deed of sale and seller ID. No OR/CR upload to the transfer is required.
- **Buyer:** Receives invite; must upload buyer_id, buyer_tin, **buyer_ctpl**, **buyer_hpg_clearance**. Buyer obtains CTPL from the **one-stop shop** (Phase A.4; vehicle pre-filled from “My transfer requests”). HPG clearance is **resolved** because clearances are generated **inside HPG UI** where CSR or OR/CR is submitted and hotlist is checked; **the system only needs the email of who receives the certificate** (Phase B.6 Step 4). Whoever has OR/CR (e.g. seller) uses HPG UI, enters buyer’s email; HPG emails clearance to buyer; buyer uploads as buyer_hpg_clearance. When documents are auto-sent to Insurance and HPG, **auto-verification** can match the issued certificate hashes (issued_certificates) and result in auto-approval. No certificate generator is shown; issuance is in HPG UI and one-stop shop; transfer workflow is covered.

**Simplification summary:** (1) **HPG clearance:** Resolved — clearances generated in HPG UI (CSR or OR/CR + hotlist + stencil); **input recipient email**; HPG emails certificate. (2) **CSR/OR/CR in HPG:** Phase B.6, POST `/api/hpg/clearance/extract-document`, `/api/hpg/clearance/hotlist-check`, `/api/hpg/clearance/issue`. (3) **Hotlist form:** Form in `hpg-admin-dashboard.html`; backend wiring in Phase B.3 and B.5.3. (4) **One-stop shop for transfer:** Vehicle pre-filled from transfer; Phase A.4. (5) **Schema:** `database/all schema.sql` supports all flows; no structural changes required (see Schema Alignment section).

No implementation has been performed; this document is the concrete, detailed plan only.
