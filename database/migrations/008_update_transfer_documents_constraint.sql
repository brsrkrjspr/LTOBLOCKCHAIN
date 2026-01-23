-- Migration: Update transfer_documents CHECK constraint
-- Date: 2026-01-23
-- Description:
--   Updates the CHECK constraint on transfer_documents.document_type to include
--   only required user-uploaded transfer documents:
--   Seller: deed_of_sale, seller_id
--   Buyer: buyer_id, buyer_tin, buyer_ctpl, buyer_mvir, buyer_hpg_clearance
--   
--   Removed: or_cr (auto-linked to vehicle), emission_cert (not needed),
--            transfer_package_pdf (system-generated, not needed),
--            transfer_certificate (not needed), insurance_cert (redundant)
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
    SELECT tc.constraint_name INTO constraint_name_var
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
    
    -- Also drop the new constraint name if it exists (from previous failed attempts)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'transfer_documents'
          AND constraint_name = 'transfer_documents_document_type_check'
    ) THEN
        ALTER TABLE transfer_documents DROP CONSTRAINT IF EXISTS transfer_documents_document_type_check;
        RAISE NOTICE 'Dropped existing transfer_documents_document_type_check constraint';
    END IF;
END $$;

-- Add the updated CHECK constraint with only required transfer document types
-- Seller: deed_of_sale, seller_id
-- Buyer: buyer_id, buyer_tin, buyer_ctpl, buyer_mvir, buyer_hpg_clearance
-- Note: OR/CR is auto-linked to vehicle, emission_cert not needed, transfer_package is system-generated
ALTER TABLE transfer_documents 
ADD CONSTRAINT transfer_documents_document_type_check 
CHECK (document_type IN (
    'deed_of_sale',        -- Seller: Deed of Sale
    'seller_id',           -- Seller: Seller ID
    'buyer_id',            -- Buyer: Buyer ID
    'buyer_tin',           -- Buyer: TIN
    'buyer_ctpl',          -- Buyer: CTPL Insurance
    'buyer_mvir',          -- Buyer: MVIR
    'buyer_hpg_clearance', -- Buyer: HPG Clearance
    'other'                -- Edge cases
));

COMMIT;
