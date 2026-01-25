-- TrustChain LTO - Add TIN ID to document_type Enum
-- Date: 2026-01-25
-- Description: Adds 'tin_id' to document_type enum for buyer TIN document uploads
-- This fixes the error: "invalid input value for enum document_type: 'tin_id'"
--
-- Run this script to add the missing enum value to document_type
-- This migration is idempotent (safe to re-run)

-- ============================================
-- STEP 1: Add 'tin_id' to document_type enum
-- ============================================

DO $$
BEGIN
    -- Add 'tin_id' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'tin_id' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'tin_id';
        RAISE NOTICE 'Added tin_id to document_type enum';
    ELSE
        RAISE NOTICE 'tin_id already exists in document_type enum';
    END IF;
END $$;

-- ============================================
-- STEP 2: Update enum comment
-- ============================================

COMMENT ON TYPE document_type IS 'Document type enum: registration_cert, insurance_cert, emission_cert, owner_id, tin_id, csr, hpg_clearance, sales_invoice, deed_of_sale, seller_id, buyer_id';

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Verify tin_id enum value is present
SELECT 
    enumlabel as document_type_value,
    enumsortorder as sort_order
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') 
  AND enumlabel = 'tin_id';

-- Expected output should show:
-- document_type_value | sort_order
-- --------------------+------------
-- tin_id              | <number>

-- ============================================
-- NOTES
-- ============================================
-- This migration fixes the error when uploading buyer TIN documents:
-- "invalid input value for enum document_type: 'tin_id'"
--
-- The backend code already expects 'tin_id' to exist:
-- - backend/config/documentTypes.js: DB_TYPES.TIN_ID = 'tin_id'
-- - backend/config/documentTypes.js: mapToDbType() maps 'tinId' -> 'tin_id'
--
-- This migration is safe and will not cause errors for other parts of the system.
