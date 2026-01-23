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
--   - Handles different constraint names that may exist

BEGIN;

-- Drop any existing CHECK constraint on transfer_documents.document_type
-- This handles different constraint names that might exist
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Find the CHECK constraint on transfer_documents.document_type
    SELECT constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'transfer_documents'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'document_type'
    LIMIT 1;
    
    -- Drop the constraint if it exists
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE transfer_documents DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
    ELSE
        RAISE NOTICE 'No existing CHECK constraint found on transfer_documents.document_type';
    END IF;
END $$;

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
