-- Migration: Update transfer_documents CHECK constraint
-- Date: 2026-01-23
-- Description:
--   Updates the CHECK constraint on transfer_documents.document_type to include
--   all valid transfer role types: buyer_tin, buyer_ctpl, buyer_mvir, buyer_hpg_clearance,
--   transfer_package_pdf, transfer_certificate
--
-- Notes:
--   - PostgreSQL requires dropping the old constraint and creating a new one
--   - This migration is idempotent (safe to re-run)

BEGIN;

-- Drop the old CHECK constraint if it exists
ALTER TABLE transfer_documents 
DROP CONSTRAINT IF EXISTS transfer_documents_document_type_check;

-- Add the updated CHECK constraint with all valid transfer roles
ALTER TABLE transfer_documents 
ADD CONSTRAINT transfer_documents_document_type_check 
CHECK (document_type IN (
    'deed_of_sale',
    'seller_id',
    'buyer_id',
    'or_cr',
    'emission_cert',
    'insurance_cert',
    'buyer_tin',
    'buyer_ctpl',
    'buyer_mvir',
    'buyer_hpg_clearance',
    'transfer_package_pdf',
    'transfer_certificate',
    'other'
));

COMMIT;
