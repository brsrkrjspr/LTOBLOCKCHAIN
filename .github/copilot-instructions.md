## AI Coding Agent Guide — LTOBLOCKCHAIN

**Scope**
- Focus on a Node.js + Express backend with static HTML wireframes. Core APIs live under [backend/routes](backend/routes) and business logic under [backend/database/services.js](backend/database/services.js). Static pages are served by [server.js](server.js).

**Architecture Overview**
- **Server**: Express app in [server.js](server.js) mounts routes under `/api/*` (auth, vehicles, documents, certificates, blockchain, admin, transfer, etc.). Serves static HTML pages from repo root.
- **Database**: PostgreSQL via [backend/database/db.js](backend/database/db.js). Use high-level helpers in [backend/database/services.js](backend/database/services.js) instead of writing SQL in routes.
- **Storage**: Unified storage in [backend/services/storageService.js](backend/services/storageService.js) with explicit `STORAGE_MODE` (`ipfs` or `local`); IPFS client in [backend/services/ipfsService.js](backend/services/ipfsService.js).
- **Blockchain**: Fabric integration via dependencies in [package.json](package.json); service stubs in [backend/services](backend/services) and routes in [backend/routes/blockchain.js](backend/routes/blockchain.js), [backend/routes/ledger.js](backend/routes/ledger.js).
- **Certificates/OCR**: Certificate generation and email in [backend/services](backend/services); OCR via Tesseract in [backend/services/ocrService.js](backend/services/ocrService.js).

**Developer Workflows**
- **Run dev server**: `npm run dev` (nodemon) or `npm start` (node). Ensure `.env` provides DB and storage settings.
- **Env config**: Required keys include `DB_HOST/PORT/NAME/USER/PASSWORD`, `STORAGE_MODE` (`ipfs` or `local`), `IPFS_HOST/PORT/PROTOCOL`, `JWT_SECRET`, `BLOCKCHAIN_MODE` (`fabric`). See startup logs in [server.js](server.js).
- **Health & Monitoring**: `/api/health` mounted by [backend/routes/health.js](backend/routes/health.js); additional monitoring via [backend/routes/monitoring.js](backend/routes/monitoring.js).
- **Database validation/migrations**: On boot, [server.js](server.js) validates critical tables and auto-migrates email verification tokens from [backend/migrations/add_email_verification.sql](backend/migrations/add_email_verification.sql). For broader changes, use scripts in [backend/scripts](backend/scripts) or apply SQL in [backend/migrations](backend/migrations) with `psql`.
- **Tests**: Jest is configured. Example test in [backend/services/tests/localStorageService.test.js](backend/services/tests/localStorageService.test.js). Run `npm test`.

**Conventions & Patterns**
- **Routing**: Add new route files under [backend/routes](backend/routes) and mount them in [server.js](server.js) as `/api/<area>`. Return JSON `{ success: boolean, ... }` consistently.
- **Data access**: Call functions from [backend/database/services.js](backend/database/services.js) (e.g., `getVehicleByVin()`, `createTransferRequest()`) rather than embedding SQL in routes.
- **Uploads**: Use the multer middleware from `storageService.getUploadMiddleware()` and persist metadata via `storageService.storeDocument(...)`. Never implement ad‑hoc file writes.
- **Storage mode**: Do not add auto-fallbacks. If `STORAGE_MODE=ipfs`, failures must be surfaced with meaningful errors as in [backend/services/storageService.js](backend/services/storageService.js).
- **Security**: Respect `helmet` CSP, rate limits, and `trust proxy` settings established in [server.js](server.js). Use [backend/middleware/auth.js](backend/middleware/auth.js) and [backend/middleware/authorize.js](backend/middleware/authorize.js) for protected routes.

**Integration Points**
- **IPFS**: Interact through [backend/services/ipfsService.js](backend/services/ipfsService.js); prefer CID-based operations (`storeDocument`, `verifyDocument`, `getDocument`). Gateway is port 8080.
- **Fabric**: Commands/scripts and Docker setups live across `docker-compose.*.yml`, e.g., [docker-compose.core.yml](docker-compose.core.yml) and [docker-compose.production.yml](docker-compose.production.yml). Keep `BLOCKCHAIN_MODE=fabric` unless explicitly changing architecture.
- **Certificates**: HTML templates under [backend/templates/certificates](backend/templates/certificates). Routing via [backend/routes/certificates.js](backend/routes/certificates.js) and [backend/routes/certificates-public.js](backend/routes/certificates-public.js).

**Examples**
- **Listing transfer requests**: Use [backend/routes/transfer.js](backend/routes/transfer.js) and `getTransferRequests()` from [backend/database/services.js](backend/database/services.js). Mount under `/api/vehicles/transfer/requests` and support filters (`status`, `date`, `plate`, pagination).
- **Document retrieval**: In a route, call `storageService.getDocumentsByVehicle(vin)` (local metadata) or `db.getDocumentById(id)` (DB record), then if `ipfs_cid` exists, use `ipfsService.getDocument(cid)`.
- **Admin stats**: Reuse `/api/admin/stats` patterns from [backend/routes/admin.js](backend/routes/admin.js), aggregating counts across vehicles, transfers, clearances, users, and documents via service helpers.

**Frontend**
- Static HTML dashboards (e.g., [admin-dashboard.html](admin-dashboard.html), [admin-transfer-requests.html](admin-transfer-requests.html)) call the server’s JSON APIs. When wiring JS, reference endpoints defined in [server.js](server.js) and avoid embedding business logic in the browser.

**Helpful References**
- System summary: [BACKEND_IMPLEMENTATION_SUMMARY.md](BACKEND_IMPLEMENTATION_SUMMARY.md)
- Wireframes overview: [README.md](README.md)
- Deployment and diagnostics: `502-*` guides and [DIGITALOCEAN-DEPLOYMENT-GUIDE.md](DIGITALOCEAN-DEPLOYMENT-GUIDE.md)

**Current Workflow Issues** (see [DATABASE_ANALYSIS_REPORT.md](DATABASE_ANALYSIS_REPORT.md), 2026-01-19)
- Vehicles: 7 stuck at `PENDING_BLOCKCHAIN`; check Fabric transaction commit/polling before assuming state, and avoid writing new flows that bypass `vehicles` status updates.
- Documents: 41 exist, none verified; ensure `file_hash` is set on upload and verification endpoints flip `verified` when approved.
- HPG auto-verification: 0% confidence driven by missing hashes/OCR/auth checks in `autoVerificationService`; fix hash calculation and OCR extraction rather than adding bypasses.
- Certificates: `certificates` table empty; generation only triggers after all clearances are approved and blockchain tx succeeds—confirm those preconditions when debugging issuance.

If any area above is unclear or missing (e.g., additional scripts or environment expectations), tell me what you’re trying to extend, and I’ll refine these instructions.
