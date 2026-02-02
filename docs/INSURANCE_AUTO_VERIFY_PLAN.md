# Insurance Auto-Verify / Auto-Approve Plan

## 1. End-to-end flow (verification points)

| Step | Location | What to verify |
|------|----------|----------------|
| 1 | Registration/transfer submit | Vehicle + documents (including insurance_cert) sent to backend. |
| 2 | `clearanceService.sendToInsurance(vehicleId, vehicle, allDocuments, ...)` | Insurance doc found by type (insurance_cert / insurance). |
| 3 | `autoVerificationService.autoVerifyInsurance(vehicleId, insuranceDoc, vehicle)` | File resolved → OCR (policy number, expiry) → pattern → expiry → file hash → **authenticity (file hash in issued_certificates)** → composite hash → duplicate check → **data-based fallback** (findIssuedCertificateByExtractedData) → decision. |
| 4 | Decision | **APPROVED** if (hash authentic **or** data-validated) and score ≥ 80%, pattern valid, hash unique, not expired. Else **PENDING** (not auto-rejected). |
| 5 | `clearanceService.sendToInsurance` (after autoVerifyInsurance returns) | If `verificationResult.status === 'APPROVED'` → update clearance request to APPROVED; if `status === 'REJECTED'` → REJECTED; else leave PENDING. |
| 6 | `db.updateVerificationStatus(vehicleId, 'insurance', status, ...)` | Called inside autoVerifyInsurance with APPROVED or PENDING; vehicle_verifications table updated. |

## 2. Current behavior from your logs

- **Score: 100%**, pattern valid, hash unique, not expired.
- **Authenticity: false** — "No original certificate found with matching file hash in issued_certificates or certificates tables".
- **Data-based fallback:** Should run when authenticity is false and pattern/expiry/duplicate pass. It looks up `issued_certificates` by **(vehicle_vin, certificate_number, certificate_type, optional expiry)**. If a row is found, we treat as data-validated and **auto-approve** with reason.
- **Observed result:** Status **PENDING**, verificationResult **FAILED**. So either:
  - **A)** Data-based lookup was not attempted (bug), or  
  - **B)** Data-based lookup ran but **found no row** (cert not in issued_certificates for this VIN + CTPL-2026-MRMH2Q), or  
  - **C)** Data-based lookup found a row but **expiry comparison failed** (e.g. OCR "01-Feb-2027" vs DB date format).

## 3. Necessary context / clarifications

1. **Was CTPL-2026-MRMH2Q issued by the TrustChain LTO certificate generator?**  
   - If **yes** → it should exist in `issued_certificates` for the vehicle’s VIN. Then we need to see why the data lookup didn’t match (VIN, certificate number, or expiry).  
   - If **no** (e.g. external insurer) → we will never have a row in `issued_certificates`; data-based auto-approval cannot apply. Only hash-authentic path would work (exact same file), or manual approval.

2. **For this registration, what is the vehicle VIN?**  
   - Data-based lookup matches on `vehicle_vin` + `certificate_number` + `certificate_type`. If the VIN on the registration differs from the VIN stored when the cert was issued, the lookup returns no row.

3. **When the certificate was generated (if via certificate generator), was an active issuer configured?**  
   - Certificate-generation code only inserts into `issued_certificates` when `external_issuers` has an active row for that type. "No active issuer found, skipping database storage" would mean the cert was never written, so data-based match will always fail.

4. **Desired behavior for certificates not from our system:**  
   - Keep PENDING for manual review only, or do you want a different rule (e.g. high score + pattern + expiry → auto-approve without issued_certificates match)?

## 4. Code changes (done or suggested)

- **Logging:** When authenticity is false, log that we are attempting data-based lookup with (vehicle_vin, policyNumber, expiry). Log whether the result was "found" or "not found" (and if not found, whether due to no row or expiry mismatch). This will confirm from logs why you get PENDING.
- **Expiry comparison:** In `findIssuedCertificateByExtractedData`, normalize OCR expiry (e.g. "01-Feb-2027") to YYYY-MM-DD before comparing to `issued_certificates.expires_at` date part, so format differences don’t cause a false "no match".
- **DB check:** Run `SELECT * FROM issued_certificates WHERE certificate_number = 'CTPL-2026-MRMH2Q' AND certificate_type = 'insurance';` (and optionally filter by vehicle_vin). If no row, the certificate was never stored and data-based auto-approval will not trigger until it is (e.g. by generating via certificate generator with an active issuer).

## 5. Summary

- **Auto-approve** happens when either (1) file hash matches an issued certificate, or (2) extracted data (policy number, VIN, expiry) matches a row in `issued_certificates` (data-validated path).
- Your current run had **hash not found** and (from logs) **no indication of a data-based match**, so status stayed **PENDING**. Next step is to confirm whether CTPL-2026-MRMH2Q exists in `issued_certificates` for the same vehicle VIN and to add/verify logging and expiry handling so we can see and fix any mismatch.
