# TrustChain LTO System Capability Summary

## Immutable Storage
The platform stores original documents (sales invoices, CSR, CTPL insurance, and clearance certificates) in controlled off-chain storage through the unified storage service (`backend/services/storageService.js`). Each upload is hashed and the hash plus metadata are stored in PostgreSQL (`documents.file_hash`, `documents.ipfs_cid`) and linked to the relevant vehicle or transfer record. This preserves immutability while keeping large files off-chain. Documents are encrypted at rest by the configured storage layer, and IPFS mode uses CID-based references (`storageService.storeDocument`), ensuring tamper-evident storage.

## Smart Contracts
Hyperledger Fabric is integrated as the mandatory blockchain backend (`BLOCKCHAIN_MODE=fabric`). Ownership transfers and registration events are executed through Fabric services (`backend/services/optimizedFabricService.js`) and recorded in `vehicles.blockchain_tx_id`. Transfer approvals enforce Fabric connectivity and fail hard if the blockchain transaction cannot be completed (`backend/routes/transfer.js`, approve route). Clearance workflows (HPG, Insurance) are routed through explicit approval states and updates in `clearance_requests`, simulating multi-step compliance verification and payment sequencing in the transfer lifecycle.

## Real-time Tracking
Every significant action (registration submissions, transfer approvals, clearance approvals) is logged to `vehicle_history` via `db.addVehicleHistory` and surfaced through dashboards. These entries include timestamps, actor IDs, and transaction references to create an auditable trail. Auto-refresh on admin transfer views keeps the status and document panels current without manual reload (`js/admin-transfer-details.js`).

## Digital OR/CR
The system generates OR/CR numbers on registration completion and stores them on the vehicle record (`vehicles.or_number`, `vehicles.cr_number`). Certificate generation uses these values plus the Fabric transaction ID and embeds a verification QR code server-side (`backend/routes/vehicles.js -> generateVehicleQRCode`). The QR links to the public verification endpoint (`/verify/:transactionId`) for tamper-proof checks.

## Integrated Workflow
The workflow connects vehicle owners, HPG, insurance providers, and LTO officers. Transfer requests are created by the seller, buyer uploads are accepted and auto-forwarded for clearance reviews, and LTO final approval is only allowed after external approvals are complete (`backend/routes/transfer.js`, forward/approve endpoints). Notifications and email templates communicate status changes to stakeholders.

## Scope & Starting Point
The implementation starts after a Certificate of Stock Reported (CSR) is issued. CSR data is treated as verified upstream input; manufacturing/importation compliance is out of scope. The system focuses on owner-initiated registration and transfer of ownership, beginning with CSR and sales invoice validation (`backend/routes/vehicles.js` and `backend/routes/certificate-generation.js`).

## Consortium Model
The network is modeled as a permissioned consortium with three organizations: LTO, HPG, and Insurance. Role-based access control is enforced in route middleware (`backend/middleware/authorize.js`) and each org has its own clearance dashboards (`backend/routes/hpg.js`, `backend/routes/insurance.js`).

## Data & Storage Design
Original documents remain off-chain in controlled storage (local or IPFS). Only cryptographic hashes and metadata are persisted to the ledger or relational store. Storage operations run through `storageService` and IPFS mode stores CIDs alongside file hashes for integrity verification.

## Interface
The interface is web-based and accessible via desktop or mobile browsers. The HTML dashboards and wizard forms are static, while JavaScript modules call the JSON APIs mounted under `/api/*` (e.g., transfer, vehicles, documents).

## Public Verification
The `/verify/:transactionId` page provides a read-only verification module for law enforcement or regulators. It queries blockchain transaction data and surfaces integrity status without allowing record mutation. The verification page supports certificate view mode when accessed via QR code.
