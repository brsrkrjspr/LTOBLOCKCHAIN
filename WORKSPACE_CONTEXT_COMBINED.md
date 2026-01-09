# Workspace Context (Comprehensive + Onboarding)

## Overview
- TrustChain LTO: blockchain-based vehicle registration/verification for LTO.
- Stack: Node.js/Express, PostgreSQL, Hyperledger Fabric, IPFS, vanilla JS/HTML/CSS.
- Auth: JWT with RBAC (admin, vehicle_owner, insurance_verifier, emission_verifier, hpg_admin).
- Modes: STORAGE_MODE=ipfs/local/auto (prefer ipfs); BLOCKCHAIN_MODE=fabric/mock (fabric for prod).
- Date of this summary: 2026-01-09.

## Project Structure (what exists)
- Frontend: root HTML pages plus js/ and css/; dashboards for owner/admin/HPG/insurance/emission; registration wizard; document viewer.
- Backend: server.js entry; routes for auth, vehicles, documents, blockchain, ledger, notifications, lto, hpg, insurance, emission, transfer, admin, health, monitoring; middleware authenticateToken/authorizeRole; services for Fabric, storage (IPFS/local), monitoring, DB; db layer (pool + services); chaincode in chaincode/vehicle-registration-production.
- Database: schema in database/init-laptop.sql plus clearance/transfer migrations; tables include users, vehicles, documents, vehicle_verifications, clearance_requests, certificates, transfer_requests, histories, notifications.
- Blockchain artifacts: network-config.json/yaml, configtx.yaml, crypto-config.yaml, channel-artifacts/, fabric-network/crypto-config.
- Docker/Compose: docker-compose.unified.yml (main), production, production-no-ipfs, laptop, core, fabric-only, simple, services; Dockerfile.production, Dockerfile.laptop.
- Scripts (high-value): complete-fabric-setup, generate-crypto, generate-channel-artifacts, setup-wallet-only, start-real-services.ps1, start-laptop.ps1, start-production.ps1, check-all-services.sh, migration/chaincode helpers.

## Security Posture (documented)
- Auth required on sensitive endpoints; monitoring and ledger admin-only.
- Helmet, CORS, rate limiting; secrets required (JWT_SECRET, ENCRYPTION_KEY) in .env.
- RBAC enforced for admin/HPG/insurance/emission actions; owner scoping on resources.

## Documented Status (from existing docs, not freshly verified)
- Frontend: implemented.
- Backend APIs/services: implemented.
- DB schema/migrations: present; require init in Postgres container.
- Fabric config/chaincode: present; channel/chaincode deployment needed on fresh env.
- IPFS integration: implemented with local fallback; needs running container.
- Docker configs: defined; choose variant per target.
- Production deployment: docs state a DigitalOcean droplet with domain ltoblockchain.duckdns.org; not re-verified here.
- Git status/backup tags: not re-verified here.

## Onboarding Path (read first)
1) COMPREHENSIVE_WORKSPACE_SUMMARY.md (routes, security, stack)
2) PROJECT-COMPREHENSIVE-SUMMARY.md (what exists vs missing)
3) PROJECT_ARCHITECTURE_SUMMARY.md (structure, flows)
4) TECHNICAL-IMPLEMENTATION-GUIDE.md (phases, build details)
5) REAL-SERVICES-SETUP-GUIDE.md and DIGITALOCEAN-DEPLOYMENT-GUIDE.md (running with real services)

## Day-1 Setup Checklist
1) Copy ENV.example -> .env; set JWT_SECRET, ENCRYPTION_KEY, DB creds; STORAGE_MODE=ipfs; BLOCKCHAIN_MODE=fabric.
2) Generate Fabric materials: scripts/generate-crypto.sh, scripts/generate-channel-artifacts.sh, scripts/setup-wallet-only.sh (or PowerShell variants).
3) npm install.
4) Bring up stack: docker compose -f docker-compose.unified.yml up -d (or laptop/core variant).
5) If fresh: deploy channel/chaincode (complete-fabric-setup or manual CLI); verify Fabric connectivity from app.
6) Init DB/migrations inside Postgres container.
7) Smoke-test /api/health (and /api/health/detailed) and a role-gated endpoint; load a key frontend flow.

## Quick Health Commands
- docker compose -f docker-compose.unified.yml ps
- docker stats --no-stream
- docker compose -f docker-compose.unified.yml logs -f lto-app
- curl http://localhost:3001/api/health
- docker exec postgres pg_isready -U lto_user -d lto_blockchain
- curl -X POST http://localhost:5001/api/v0/version (or docker exec ipfs ...)
- docker exec peer0.lto.gov.ph peer node status

## Key Docs to Keep Handy
- Deployment/ops: DIGITALOCEAN-DEPLOYMENT-GUIDE.md, PRODUCTION-SETUP-GUIDE.md, REAL-SERVICES-SETUP-GUIDE.md, DEPLOYMENT-CHECKLIST.md, DEPLOYMENT_COMMANDS.md, SERVICE-STATUS-CHECK-GUIDE.md.
- Architecture/status: COMPREHENSIVE_WORKSPACE_SUMMARY.md, PROJECT-COMPREHENSIVE-SUMMARY.md, PROJECT_ARCHITECTURE_SUMMARY.md, WORKSPACE_UNDERSTANDING.md, TECHNICAL-IMPLEMENTATION-GUIDE.md.
- Transfer/multi-org workflow: IMPLEMENTATION_COMPLETE_SUMMARY.md, MULTI_ORG_APPROVAL_IMPLEMENTATION.md.

## Notes
- This file avoids placeholders and does not assert runtime state or git status; verify in your environment if needed.
