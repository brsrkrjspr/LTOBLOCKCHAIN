# MVIR & Seller Redundancy Refactor Plan

## Overview
This document outlines a phase-by-phase plan to refactor the vehicle transfer and registration workflows, eliminating MVIR and seller-side redundancies. Each phase is actionable and tracked for completion.

---

## Phase 1: Remove Buyer/Seller MVIR Uploads
- Remove all MVIR upload prompts and validation for buyers and sellers in both frontend UI and backend API.
- Remove all references to buyerMvir in UI, JS, and backend logic.
- Ensure only LTO inspectors can upload/associate MVIR, referenced only in `vehicles.inspection_documents`.
- **Status:** In Progress / Partially Complete

## Phase 2: Restrict MVIR Handling to LTO Inspectors
- Enforce backend and UI checks so only LTO inspectors can upload or update MVIR.
- Audit and clean up any legacy/invalid MVIR document links in the database.
- **Status:** Not Started

## Phase 3: Update Seller Transfer Workflow
- Remove prompts for sellers (initiators) to accept/upload documents for their own transfer requests.
- Update UI and backend to ensure only buyers are prompted for required documents.
- **Status:** Not Started

## Phase 4: Prevent Seller Document Upload/Linking
- Add backend validation to prevent sellers from uploading or linking documents to their own transfer requests.
- **Status:** Not Started

## Phase 5: Data Cleanup & Migration
- Remove any buyer/seller-uploaded MVIRs and seller-uploaded documents from `transfer_documents` and `documents` tables.
- Implement a migration/cleanup script if necessary.
- **Status:** Not Started

## Phase 6: Update UI, API, and Messaging
- Update UI, API, and user messaging to clarify roles and required actions.
- Ensure all role checks and document associations are enforced at both UI and API layers.
- **Status:** Not Started

---

## Next Steps
- Complete Phase 1 (finalize all UI/backend removals for buyer/seller MVIR uploads)
- Proceed to Phase 2 upon confirmation
