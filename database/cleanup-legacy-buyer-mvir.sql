-- TrustChain LTO - Cleanup Legacy Buyer MVIR Data
-- This migration removes buyer-uploaded MVIR entries from transfer_documents table
-- MVIR should only come from LTO inspection (vehicles.inspection_documents), not buyer uploads

-- ============================================
-- STEP 1: Audit - Find BUYER_MVIR entries in transfer_documents
-- ============================================

-- Count BUYER_MVIR entries (for reporting)
DO $$
DECLARE
    buyer_mvir_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO buyer_mvir_count
    FROM transfer_documents
    WHERE document_type = 'buyer_mvir';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Legacy Buyer MVIR Cleanup Audit';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total BUYER_MVIR entries found: %', buyer_mvir_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 2: Remove BUYER_MVIR entries from transfer_documents
-- ============================================

-- Delete all transfer_documents entries with document_type = 'buyer_mvir'
-- These are invalid because MVIR comes from LTO inspection, not buyer uploads
DELETE FROM transfer_documents
WHERE document_type = 'buyer_mvir';

-- ============================================
-- STEP 3: Audit - Find MVIR document links in documents table
-- ============================================

-- Check if any documents are incorrectly linked as MVIR type
-- Note: MVIR documents should NOT be in documents table - they're in vehicles.inspection_documents
DO $$
DECLARE
    mvir_doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mvir_doc_count
    FROM documents
    WHERE document_type = 'mvir' OR document_type = 'mvir_cert';
    
    IF mvir_doc_count > 0 THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE 'WARNING: Found % MVIR documents in documents table', mvir_doc_count;
        RAISE NOTICE 'These should be in vehicles.inspection_documents instead';
        RAISE NOTICE 'Review these documents manually before deletion';
        RAISE NOTICE '========================================';
    ELSE
        RAISE NOTICE '✅ No MVIR documents found in documents table (correct)';
    END IF;
END $$;

-- ============================================
-- STEP 4: Clean up metadata references to buyer MVIR auto-verification
-- ============================================

-- Remove mvirAutoVerification from transfer_requests metadata
-- This was used for buyer-uploaded MVIR verification, which is no longer valid
UPDATE transfer_requests
SET metadata = metadata - 'mvirAutoVerification',
    updated_at = CURRENT_TIMESTAMP
WHERE metadata ? 'mvirAutoVerification';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify no BUYER_MVIR entries remain
-- SELECT COUNT(*) FROM transfer_documents WHERE document_type = 'buyer_mvir';
-- Expected: 0

-- Verify metadata cleanup
-- SELECT COUNT(*) FROM transfer_requests WHERE metadata ? 'mvirAutoVerification';
-- Expected: 0

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- WARNING: This cleanup is irreversible
-- If rollback is needed, restore from database backup
-- The deleted transfer_documents entries cannot be recovered without backup

COMMENT ON TABLE transfer_documents IS 'Transfer document links. Note: MVIR is NOT stored here - MVIR comes from LTO inspection (vehicles.inspection_documents)';
