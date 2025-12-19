-- TrustChain LTO - Add New Document Types Migration
-- This migration adds the new document types required for the refactored transfer system
-- Run this AFTER init-laptop.sql and BEFORE add-transfer-ownership.sql (if not already run)

-- ============================================
-- STEP 1: Update documents table document_type ENUM
-- ============================================

-- First, we need to alter the ENUM type to add new values
-- PostgreSQL doesn't support ALTER TYPE ... ADD VALUE in a transaction block,
-- so we need to do this carefully

-- Check if the new values already exist (idempotent)
DO $$
BEGIN
    -- Add 'deed_of_sale' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'deed_of_sale' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'deed_of_sale';
    END IF;
    
    -- Add 'seller_id' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'seller_id' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'seller_id';
    END IF;
    
    -- Add 'buyer_id' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'buyer_id' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'buyer_id';
    END IF;
    
    -- Add 'other' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'other' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
    ) THEN
        ALTER TYPE document_type ADD VALUE 'other';
    END IF;
END $$;

-- ============================================
-- STEP 2: Verify transfer_documents table has correct CHECK constraint
-- ============================================

-- The transfer_documents table should already have the correct CHECK constraint
-- from add-transfer-ownership.sql, but let's verify and fix if needed

-- Check if transfer_documents table exists and has correct constraint
DO $$
BEGIN
    -- Only proceed if transfer_documents table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'transfer_documents'
    ) THEN
        -- Drop existing constraint if it's different
        IF EXISTS (
            SELECT 1 FROM information_schema.constraint_column_usage 
            WHERE table_name = 'transfer_documents' 
            AND constraint_name LIKE '%document_type%'
        ) THEN
            -- Get the constraint name
            DECLARE
                constraint_name_var TEXT;
            BEGIN
                SELECT constraint_name INTO constraint_name_var
                FROM information_schema.table_constraints
                WHERE table_name = 'transfer_documents'
                AND constraint_type = 'CHECK'
                AND constraint_name LIKE '%document_type%'
                LIMIT 1;
                
                IF constraint_name_var IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE transfer_documents DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
                END IF;
            END;
        END IF;
        
        -- Add correct CHECK constraint
        ALTER TABLE transfer_documents 
        ADD CONSTRAINT check_transfer_document_type 
        CHECK (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other'));
    END IF;
END $$;

-- ============================================
-- STEP 3: Add comments for documentation
-- ============================================

COMMENT ON TYPE document_type IS 'Document type enum: registration_cert, insurance_cert, emission_cert, owner_id, deed_of_sale, seller_id, buyer_id, other';

-- ============================================
-- VERIFICATION QUERIES (Run these to verify)
-- ============================================

-- Verify ENUM values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') ORDER BY enumsortorder;

-- Verify transfer_documents constraint
-- SELECT constraint_name, check_clause 
-- FROM information_schema.check_constraints 
-- WHERE constraint_name LIKE '%transfer_document%';

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

-- WARNING: Rolling back ENUM values is complex in PostgreSQL
-- You cannot remove ENUM values that are in use
-- To rollback, you would need to:
-- 1. Update all rows using the new enum values to old values
-- 2. Create a new ENUM type without the new values
-- 3. Alter the table to use the new ENUM
-- 4. Drop the old ENUM
-- This is not recommended unless absolutely necessary
