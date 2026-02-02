# Registration Workflow Trace

End-to-end trace: **Owner submits registration** → **Auto-sent clearance & auto-verification** → **LTO approval** → **OR/CR assignment and notification**.

---

## 1. Registration submission (frontend → backend)

| Step | Location | What happens |
|------|----------|--------------|
| 1.1 | **Frontend** `js/registration-wizard.js` → `submitApplication()` | User clicks Submit. Terms checked, `isSubmitting` set. |
| 1.2 | Same | **Upload documents**: `uploadDocuments(undefined)` → each file in `#document-upload-container` is POSTed to **`/api/documents/upload`**. Response gives `{ id, cid, filename, ... }` per doc type. |
| 1.3 | Same | **Collect data**: `collectApplicationData()` reads form fields → `{ vehicle, owner, ... }` (vehicle: vin, plateNumber, make, model, year, color, vehicleCategory, passengerCapacity, grossVehicleWeight, netWeight, classification, etc.; owner: firstName, lastName, email, phone, address). |
| 1.4 | Same | **POST JSON**: `apiClient.post('/api/vehicles/register', registrationData)` where `registrationData = { vehicle, owner, documents: uploadResults, notes }`. No FormData. |
| 1.5 | **Backend** `server.js` | Route mounted as `app.use('/api/vehicles', require('./backend/routes/vehicles'))` → **POST /api/vehicles/register** handled by `vehicles.js`. |
| 1.6 | **Backend** `backend/routes/vehicles.js` → `router.post('/register', ...)` | Validates `vehicle`, `owner`; normalizes VIN; resolves/creates owner user; validates vehicle category, weights, etc. |
| 1.7 | Same | **Transaction**: `vehicleRegistrationTransaction.createVehicleWithDocumentsTransaction({ vehicle, ownerUser, registrationData, safeMetadata })` → creates vehicle row, history, links documents by ID/CID. |
| 1.8 | Same | If transaction succeeds: fetches full vehicle + verifications + documents; sends **registration confirmation email** to owner (Gmail API); then runs **auto-send clearance**. |

**Key:** There is **no** `/api/registrations` route. The only registration endpoint is **POST /api/vehicles/register** (JSON body).

---

## 2. Auto-sent clearance requests (right after registration)

| Step | Location | What happens |
|------|----------|--------------|
| 2.1 | **Backend** `backend/routes/vehicles.js` (after vehicle creation) | `clearanceService.autoSendClearanceRequests(newVehicle.id, registrationData.documents, requestedBy)` (owner id as requester). |
| 2.2 | **Backend** `backend/services/clearanceService.js` → `autoSendClearanceRequests()` | Waits for documents (with retry). Gets vehicle; determines if new registration vs transfer. |
| 2.3 | Same | **HPG path**: If vehicle has `owner_id` or `hpg_clearance` doc → `sendToHPG(vehicleId, vehicle, allDocuments, requestedBy)`. |
| 2.4 | Same → `sendToHPG()` | Creates HPG clearance request (if none exists); assigns to HPG admin; `updateVerificationStatus(vehicleId, 'hpg', 'PENDING')`; history `HPG_CLEARANCE_REQUESTED`; notification to HPG admin. For **transfers**: OCR extract from OR/CR + owner ID; for **new reg**: uses vehicle metadata. Runs **HPG database check** (`hpgDatabaseService.checkVehicle`); stores result; if FLAGGED, adds note and urgent notification. Returns `{ sent, requestId, automation }`. No **auto-approve** here—HPG still approves manually (or via HPG admin UI). |
| 2.5 | Same | **Insurance path**: If vehicle has `insurance_cert` / `insurance` doc → `sendToInsurance(vehicleId, vehicle, allDocuments, requestedBy)`. |
| 2.6 | Same → `sendToInsurance()` | **Runs auto-verification first**: `autoVerificationService.autoVerifyInsurance(vehicleId, insuranceDoc, vehicle)` → validates certificate, can set status to APPROVED/PENDING/REJECTED and **writes to `vehicle_verifications`**. Then creates insurance clearance request with `autoVerificationResult` in metadata. So **insurance auto-verification is run and stored here** (auto-sent + auto-verify in one go). |
| 2.7 | **Backend** `backend/services/autoVerificationService.js` → `autoVerifyInsurance()` | Validates insurance doc (e.g. CTPL), checks DB/blockchain if used; updates `vehicle_verifications` (insurance) with status and score. |
| 2.8 | **Backend** `clearanceService.js` (after both HPG & Insurance) | If at least one request sent: `updateVehicle(vehicleId, { status: 'SUBMITTED' })`; history `CLEARANCE_REQUESTS_AUTO_SENT` with `autoVerificationResults` (insurance + HPG pre-fill) in metadata. |
| 2.9 | **Backend** `vehicles.js` (response) | Builds `autoVerificationSummary` from `autoSendResults` (insurance status/score, HPG canPreFill/extractedData). Returns `success`, `vehicle`, `documentLinking`, `clearanceRequests: { hpg, insurance }`, `autoVerification`. |

**Summary:**  
- **Insurance**: Clearance request is created and **insurance auto-verification is run and saved** during auto-send; result is in `vehicle_verifications` and in clearance request metadata.  
- **HPG**: Clearance request is created; OCR/DB check run for transfers; HPG admin approves later (or uses HPG verification form with optional **auto-verify** call **POST /api/hpg/verify/auto-verify**).

---

## 3. HPG / Insurance verification (manual or auto on HPG side)

| Step | Location | What happens |
|------|----------|--------------|
| 3.1 | **Frontend** HPG verification form | Officer can run **Auto-Verify**: `apiClient.post('/api/hpg/verify/auto-verify', { requestId, ... })`. |
| 3.2 | **Backend** `backend/routes/hpg.js` | `autoVerificationService.autoVerifyHPG(...)` → hash check, authenticity, score, recommendation, preFilledData. Response includes `autoVerify: { confidenceScore, recommendation, hashCheck, authenticityCheck, preFilledData, ... }`. |
| 3.3 | Same | Officer can then **Approve** or **Reject**: `POST /api/hpg/verify/approve` or `.../reject`. Notifications to LTO admin and owner (Phase 2). |
| 3.4 | **Insurance** | Already auto-verified during auto-send; insurance verifier can approve/reject in their UI (e.g. admin or insurance routes). |

---

## 4. LTO approval (clearance approval → OR/CR, blockchain, email)

| Step | Location | What happens |
|------|----------|--------------|
| 4.1 | **Frontend** `js/admin-dashboard.js` | Admin opens application, clicks Approve. May check inspection for **transfers** (MVIR). Calls **POST `/api/lto/approve-clearance`** with `{ vehicleId, notes }`. |
| 4.2 | **Backend** `backend/routes/lto.js` → `router.post('/approve-clearance', ...)` | Loads vehicle; gets verifications and clearance requests. |
| 4.3 | Same | **Checks**: HPG clearance must exist and be APPROVED/COMPLETED; insurance verification must exist and be APPROVED. If any pending or rejected → 400 with `pendingApprovals` / `rejectedApprovals`. |
| 4.4 | Same | **OR/CR generation**: `db.assignOrAndCrNumbers(vehicleId)` → generates/stores OR and CR numbers, returns `{ orNumber, crNumber, orIssuedAt, crIssuedAt }`. If this fails → 500 (approval cannot proceed). |
| 4.5 | Same | **Transfer only**: If no MVIR, can auto-generate inspection (assignMvirNumber) with PASS/ROADWORTHY. New registration: no MVIR dependency. |
| 4.6 | Same | **Status**: SUBMITTED → PENDING_BLOCKCHAIN (if needed), then **blockchain registration** via `fabricService.registerVehicle(vehicleData)` (vehicleData includes orNumber, crNumber, documents, officerInfo). |
| 4.7 | Same | On success: **Update vehicle**: `status: 'REGISTERED'`, `blockchainTxId`; set registration expiry; history `BLOCKCHAIN_REGISTERED`; **Send approval email to owner** (Gmail API) with **OR number, CR number, blockchain Tx**, and note: *"You can download your OR/CR by logging in to your account."* |
| 4.8 | Same | **Notification**: `db.createNotification(vehicle.owner_id, 'Vehicle Registration Approved', message with OR/CR)`; history `CLEARANCE_APPROVED` with orNumber, crNumber, blockchainTxId. Response: `{ success, vehicleId, orNumber, crNumber, orIssuedAt, crIssuedAt, blockchainTxId, status: 'REGISTERED' }`. |

**Summary:**  
- **OR/CR** are generated and stored in DB and sent **in the approval email as numbers** (and in-app notification).  
- The **OR/CR document** (e.g. PDF) is **not** attached to the email; the email tells the owner to **download OR/CR by logging in** (owner dashboard / certificate or document download flow).

---

## 5. Sending of OR/CR (what “sending” means here)

| Item | Where | How |
|------|--------|-----|
| **OR/CR numbers** | `backend/routes/lto.js` (approve-clearance) | Emailed to owner in approval email (text + HTML) and stored in DB (`vehicles.or_number`, `vehicles.cr_number`). In-app notification includes OR/CR. |
| **OR/CR document (PDF)** | Not sent as email attachment | Owner is directed to log in to the app to download OR/CR (e.g. certificate or document download endpoints used by owner dashboard / certificate generator). |

So “sending of OR/CR” in this system = **email with OR/CR numbers + link/instruction to log in and download** the actual document.

---

## 6. Flow diagram (summary)

```
[Owner] Submit (registration-wizard)
    → uploadDocuments() → POST /api/documents/upload (per doc)
    → collectApplicationData()
    → POST /api/vehicles/register (JSON: vehicle, owner, documents, notes)

[Backend] POST /api/vehicles/register
    → createVehicleWithDocumentsTransaction()
    → Email: "Registration Submitted" to owner
    → clearanceService.autoSendClearanceRequests()
        → sendToHPG()        → HPG clearance request, PENDING; OCR/DB check for transfers
        → sendToInsurance()  → autoVerifyInsurance() → vehicle_verifications; insurance clearance request
    → Response: success, vehicle, documentLinking, clearanceRequests, autoVerification

[HPG/Insurance] Verifiers approve (or HPG uses auto-verify then approve)
    → HPG: POST /api/hpg/verify/auto-verify (optional), then approve/reject
    → Insurance: already auto-verified; verifier approves/rejects

[LTO Admin] Approve
    → POST /api/lto/approve-clearance { vehicleId, notes }
    → Check HPG + Insurance approved
    → assignOrAndCrNumbers(vehicleId)  → OR/CR generated
    → (Transfer only: MVIR if missing)
    → fabricService.registerVehicle()  → blockchain
    → Update vehicle: REGISTERED, blockchainTxId
    → Email to owner: "Vehicle Registration Approved" with OR/CR numbers + "download OR/CR by logging in"
    → Notification to owner with OR/CR
```

---

## 7. Key files reference

| Purpose | File(s) |
|---------|--------|
| Registration submit (frontend) | `js/registration-wizard.js` — `submitApplication()`, `uploadDocuments()`, `collectApplicationData()` |
| Registration API | `backend/routes/vehicles.js` — `router.post('/register', ...)` |
| Vehicle + docs transaction | `backend/services/vehicleRegistrationTransaction.js` — `createVehicleWithDocumentsTransaction()` |
| Auto-send clearance | `backend/services/clearanceService.js` — `autoSendClearanceRequests()`, `sendToHPG()`, `sendToInsurance()` |
| Insurance auto-verification | `backend/services/autoVerificationService.js` — `autoVerifyInsurance()` |
| HPG auto-verify (on demand) | `backend/routes/hpg.js` — POST `/api/hpg/verify/auto-verify`; `autoVerificationService.autoVerifyHPG()` |
| LTO approval (OR/CR, blockchain, email) | `backend/routes/lto.js` — `router.post('/approve-clearance', ...)` |
| OR/CR assignment in DB | `backend/database/services.js` — `assignOrAndCrNumbers(vehicleId)` (uses `generateOrNumber()`, `generateCrNumber()`) |
| Registration & approval emails | `backend/routes/vehicles.js` (registration); `backend/routes/lto.js` (approval); both use `sendMail` from `backend/services/gmailApiService.js` |

This trace covers: **registration submission**, **auto-sent clearance**, **auto-verification (insurance at send, HPG on demand)**, **LTO approval**, and **OR/CR generation and sending (numbers by email + download via login)**.
