-- TrustChain LTO - Data Cleanup for Transfer Documents and Legacy MVIR
-- Date: 2026-01-25
-- Description: Cleans up legacy/invalid transfer documents, seller-uploaded buyer docs, and orphaned/invalid MVIRs.
-- Safe to run multiple times (idempotent). Review before running in production.

BEGIN;

-- 1. Remove transfer_documents with invalid document_type (not in allowed set)
DELETE FROM transfer_documents
WHERE document_type NOT IN (
    'deed_of_sale', 'seller_id', 'buyer_id', 'buyer_tin', 'buyer_ctpl', 'buyer_mvir', 'buyer_hpg_clearance', 'other'
);

-- 2. Remove transfer_documents where seller/initiator uploaded buyer/MVIR docs
-- (Assumes transfer_requests.initiator_id is the seller)
DELETE FROM transfer_documents td
USING transfer_requests tr
WHERE td.transfer_request_id = tr.id
  AND td.document_type IN ('buyer_id', 'buyer_tin', 'buyer_ctpl', 'buyer_mvir', 'buyer_hpg_clearance')
  AND td.uploaded_by = tr.initiator_id;

-- 3. Remove orphaned documents not linked to any transfer_documents or vehicles
DELETE FROM documents d
WHERE NOT EXISTS (
    SELECT 1 FROM transfer_documents td WHERE td.document_id = d.id
)
AND NOT EXISTS (
    SELECT 1 FROM vehicles v WHERE v.inspection_documents::text LIKE '%' || d.id::text || '%'
);

-- 4. Optionally, reclassify documents with type 'other' if possible (see migrate-fix-other-documents.sql)
-- (Uncomment and adapt as needed)
-- UPDATE documents SET document_type = 'buyer_id' WHERE id IN (...);

COMMIT;

-- End of cleanup script
