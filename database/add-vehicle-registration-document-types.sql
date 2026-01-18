-- TrustChain LTO - Add Vehicle Registration Document Types Migration
-- This migration adds the missing document types required for NEW vehicle registration:
-- - csr (Certificate of Stock Report)
-- - hpg_clearance (PNP-HPG Motor Vehicle Clearance)
-- - sales_invoice (Sales Invoice)
--
-- Run this script to add the missing enum values to document_type

-- ============================================
-- STEP 1: Add missing document_type enum values
-- ============================================

DO $$
BEGIN
    -- Add 'csr' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'csr' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'csr';
        RAISE NOTICE 'Added csr to document_type enum';
    ELSE
        RAISE NOTICE 'csr already exists in document_type enum';
    END IF;
    
    -- Add 'hpg_clearance' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'hpg_clearance' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'hpg_clearance';
        RAISE NOTICE 'Added hpg_clearance to document_type enum';
    ELSE
        RAISE NOTICE 'hpg_clearance already exists in document_type enum';
    END IF;
    
    -- Add 'sales_invoice' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'sales_invoice' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'sales_invoice';
        RAISE NOTICE 'Added sales_invoice to document_type enum';
    ELSE
        RAISE NOTICE 'sales_invoice already exists in document_type enum';
    END IF;
END $$;

-- ============================================
-- STEP 2: Update enum comment
-- ============================================

COMMENT ON TYPE document_type IS 'Document type enum: registration_cert, insurance_cert, emission_cert, owner_id, csr, hpg_clearance, sales_invoice, deed_of_sale, seller_id, buyer_id, other';

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Verify all enum values are present
SELECT 
    enumlabel as document_type_value,
    enumsortorder as sort_order
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') 
ORDER BY enumsortorder;

-- Expected output should include:
-- registration_cert
-- insurance_cert
-- emission_cert
-- owner_id
-- csr
-- hpg_clearance
-- sales_invoice
-- deed_of_sale
-- seller_id
-- buyer_id
-- other
