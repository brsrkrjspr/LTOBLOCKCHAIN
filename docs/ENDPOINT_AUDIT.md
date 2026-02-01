# API Endpoint Audit (Frontend ↔ Backend)

Quick reference: **Frontend API calls** vs **Backend route mounts** in `server.js`. All frontend paths must match a mounted backend route + router path.

---

## Mount points (server.js)

| Mount path | Router file |
|------------|-------------|
| `/api/auth` | `backend/routes/auth.js` |
| `/api/vehicles` | `backend/routes/vehicles.js` |
| `/api/vehicles/transfer` | `backend/routes/transfer.js` |
| `/api/documents` | `backend/routes/documents.js` |
| `/api/certificates` | `backend/routes/certificates.js` |
| `/api/certificate-generation` | `backend/routes/certificate-generation.js` |
| `/api/blockchain` | `backend/routes/blockchain.js` |
| `/api/lto` | `backend/routes/lto.js` |
| `/api/hpg` | `backend/routes/hpg.js` |
| `/api/insurance` | `backend/routes/insurance.js` |
| `/api/admin` | `backend/routes/admin.js` |
| `/api/notifications` | `backend/routes/notifications.js` |
| `/api/integrity` | `backend/routes/integrity.js` |
| `/api/document-requirements` | `backend/routes/document-requirements.js` |
| `/api/health` | `backend/routes/health.js` |
| `/api/monitoring` | `backend/routes/monitoring.js` |

**Note:** There is **no** `/api/users` mount. User lookup is under auth: **`/api/auth/users/lookup`**.

---

## Fixes applied

| Issue | Fix |
|-------|-----|
| Frontend called **`/api/users/lookup`** (404) | Backend route is **`/api/auth/users/lookup`**. Updated `certificate-generator.html` to use **`/api/auth/users/lookup`**. |
| Frontend called **`POST /api/certificate-generation/transfer/generate`** (404) | Backend route is **`POST /api/certificate-generation/transfer/generate-compliance-documents`**. Updated `certificate-generator.html` to use **`/api/certificate-generation/transfer/generate-compliance-documents`**. |

---

## Frontend → Backend path mapping (main flows)

| Frontend path | Backend mount + route | Status |
|---------------|------------------------|--------|
| `GET /api/auth/profile` | auth `/profile` | ✓ |
| `POST /api/auth/login` | auth `/login` | ✓ |
| `POST /api/auth/register` | auth `/register` | ✓ |
| `POST /api/auth/verify-2fa` | auth `/verify-2fa` | ✓ |
| `POST /api/auth/resend-2fa` | auth `/resend-2fa` (or resend-verification) | ✓ |
| `GET /api/auth/users/lookup` | auth `/users/lookup` | ✓ (fixed) |
| `GET /api/vehicles/pre-minted` | vehicles `/pre-minted` | ✓ |
| `POST /api/vehicles/register` | vehicles `/register` | ✓ |
| `GET /api/vehicles/my-vehicles` | vehicles `/my-vehicles` | ✓ |
| `GET /api/vehicles/id/:id` | vehicles `/id/:id` | ✓ |
| `PUT /api/vehicles/id/:id/status` | vehicles `/id/:id/status` | ✓ |
| `GET /api/vehicles/my-vehicles/ownership-history` | vehicles `/my-vehicles/ownership-history` | ✓ |
| `GET /api/vehicles/:vinOrId/ownership-history` | vehicles `/:vin/ownership-history` | ✓ |
| `GET /api/vehicles/transfer/requests` | transfer `/requests` | ✓ |
| `GET /api/vehicles/transfer/requests/stats` | transfer `/requests/stats` | ✓ |
| `GET /api/vehicles/transfer/requests/pending-for-buyer` | transfer `/requests/pending-for-buyer` | ✓ |
| `POST /api/vehicles/transfer/requests` | transfer `/requests` | ✓ |
| `GET /api/vehicles/transfer/requests/:id` | transfer `/requests/:id` | ✓ |
| `POST /api/vehicles/transfer/requests/:id/accept` | transfer `/requests/:id/accept` | ✓ |
| `POST /api/vehicles/transfer/requests/:id/reject-by-buyer` | transfer `/requests/:id/reject-by-buyer` | ✓ |
| `POST /api/vehicles/transfer/requests/:id/link-document` | transfer `/requests/:id/link-document` | ✓ |
| `POST /api/documents/upload` | documents `/upload` | ✓ |
| `POST /api/documents/extract-info` | documents `/extract-info` | ✓ |
| `GET /api/document-requirements/:registrationType` | document-requirements `/:registrationType` | ✓ |
| `GET /api/hpg/stats` | hpg `/stats` | ✓ |
| `GET /api/hpg/requests` | hpg `/requests` | ✓ |
| `GET /api/hpg/requests/:id` | hpg `/requests/:id` | ✓ |
| `POST /api/hpg/verify/auto-verify` | hpg `/verify/auto-verify` | ✓ |
| `POST /api/hpg/verify/approve` | hpg `/verify/approve` | ✓ |
| `POST /api/hpg/verify/reject` | hpg `/verify/reject` | ✓ |
| `GET /api/blockchain/status` | blockchain `/status` | ✓ |
| `GET /api/blockchain/vehicles` | blockchain `/vehicles` | ✓ |
| `GET /api/blockchain/vehicles/:vin` | blockchain `/vehicles/:vin` | ✓ |
| `POST /api/blockchain/vehicles/mint` | blockchain `/vehicles/mint` | ✓ |
| `POST /api/lto/inspect` | lto `/inspect` | ✓ |
| `POST /api/lto/inspect-documents` | lto `/inspect-documents` | ✓ |
| `GET /api/lto/inspect-documents/:vehicleId` | lto `/inspect-documents/:vehicleId` | ✓ |
| `POST /api/lto/approve-clearance` | lto `/approve-clearance` | ✓ |
| `GET /api/admin/stats` | admin `/stats` | ✓ |
| `GET /api/admin/clearance-requests` | admin `/clearance-requests` | ✓ |
| `POST /api/admin/verifications/manual-verify` | admin `/verifications/manual-verify` | ✓ |
| `GET /api/insurance/requests` | insurance `/requests` | ✓ |
| `GET /api/notifications` | notifications `/` | ✓ |
| `PATCH /api/notifications/:id/read` | notifications `/:id/read` | ✓ |
| `DELETE /api/notifications/:id` | notifications `/:id` | ✓ |
| `GET /api/integrity/check/:vin` | integrity `/check/:vin` | ✓ |
| `GET /api/certificates/vehicle/:vehicleId` | certificates `/vehicle/:vehicleId` | ✓ |
| `POST /api/certificates/:certificateId/verify` | certificates `/:certificateId/verify` | ✓ |
| `POST /api/certificates/generate` | certificates `/generate` | ✓ |
| `GET /api/vehicles` (certificate-gen, lto-inspection) | vehicles `/` | ✓ |
| `POST /api/certificate-generation/transfer/generate-compliance-documents` | certificate-generation `/transfer/generate-compliance-documents` | ✓ |
| `POST /api/certificate-generation/batch/generate-hpg-ctpl` | certificate-generation `/batch/generate-hpg-ctpl` | ✓ |

---

## Summary

- **Two mismatches were found and fixed:**
  1. **User lookup:** Frontend called **`/api/users/lookup`** (no `/api/users` mount). Backend serves at **`/api/auth/users/lookup`**. `certificate-generator.html` updated to use **`/api/auth/users/lookup`**.
  2. **Transfer certificate generate:** Frontend called **`POST /api/certificate-generation/transfer/generate`** (no such route). Backend has **`POST /api/certificate-generation/transfer/generate-compliance-documents`**. `certificate-generator.html` updated to use **`/api/certificate-generation/transfer/generate-compliance-documents`**.
- All other audited frontend paths align with current backend mounts and router definitions.
