-- TrustChain LTO - Fix Documents with 'Other' Type
-- This migration fixes documents incorrectly stored as 'other' by inferring correct type from context
-- Context-based inference (NOT filename-based) - uses vehicle registration type and transfer_documents table

-- ============================================
-- STEP 1: Create temporary table for analysis
-- ============================================

BEGIN;

-- Create temporary table to track what will be fixed
CREATE TEMP TABLE document_fixes AS
SELECT 
    d.id,
    d.document_type,
    d.original_name,
    d.vehicle_id,
    v.registration_type,
    v.origin_type,
    -- Infer type from transfer_documents table (most reliable)
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM transfer_documents td 
            WHERE td.document_id = d.id 
            AND td.document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert')
        ) THEN (
            SELECT td.document_type 
            FROM transfer_documents td 
            WHERE td.document_id = d.id 
            LIMIT 1
        )
        -- For NEW registration: infer from registration requirements context
        WHEN v.registration_type = 'NEW' OR v.origin_type = 'NEW' THEN (
            -- Check upload timing relative to vehicle creation
            CASE 
                WHEN d.uploaded_at BETWEEN v.created_at - INTERVAL '1 day' AND v.created_at + INTERVAL '7 days'
                    THEN 'owner_id' -- Likely owner ID if uploaded around registration time
                ELSE NULL -- Can't infer with confidence
            END
        )
        -- For TRANSFER: infer from transfer context
        WHEN v.registration_type = 'TRANSFER' OR v.origin_type = 'TRANSFER' THEN (
            -- Check if document was uploaded during transfer process
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM transfer_requests tr 
                    WHERE tr.vehicle_id = v.id 
                    AND d.uploaded_at BETWEEN tr.created_at - INTERVAL '1 day' AND tr.created_at + INTERVAL '7 days'
                ) THEN 'owner_id' -- Likely owner ID for transfer
                ELSE NULL
            END
        )
        ELSE NULL
    END AS inferred_type,
    -- Confidence level (1 = high, 2 = medium, 3 = low)
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM transfer_documents td WHERE td.document_id = d.id
        ) THEN 1 -- High confidence - from transfer_documents table
        WHEN (v.registration_type = 'NEW' OR v.origin_type = 'NEW') 
            AND d.uploaded_at BETWEEN v.created_at - INTERVAL '1 day' AND v.created_at + INTERVAL '7 days'
            THEN 2 -- Medium confidence - timing matches registration
        ELSE 3 -- Low confidence - leave for admin review
    END AS confidence_level
FROM documents d
LEFT JOIN vehicles v ON d.vehicle_id = v.id
WHERE d.document_type = 'other';

-- ============================================
-- STEP 2: Log what will be fixed
-- ============================================

DO $$
DECLARE
    total_count INTEGER;
    high_confidence_count INTEGER;
    medium_confidence_count INTEGER;
    low_confidence_count INTEGER;
    can_fix_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM document_fixes;
    SELECT COUNT(*) INTO high_confidence_count FROM document_fixes WHERE confidence_level = 1;
    SELECT COUNT(*) INTO medium_confidence_count FROM document_fixes WHERE confidence_level = 2;
    SELECT COUNT(*) INTO low_confidence_count FROM document_fixes WHERE confidence_level = 3;
    SELECT COUNT(*) INTO can_fix_count FROM document_fixes WHERE inferred_type IS NOT NULL AND confidence_level <= 2;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Document Type Correction Analysis';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total documents with "other" type: %', total_count;
    RAISE NOTICE 'High confidence (from transfer_documents): %', high_confidence_count;
    RAISE NOTICE 'Medium confidence (timing-based): %', medium_confidence_count;
    RAISE NOTICE 'Low confidence (needs admin review): %', low_confidence_count;
    RAISE NOTICE 'Documents that can be auto-fixed: %', can_fix_count;
    RAISE NOTICE 'Documents needing manual review: %', (total_count - can_fix_count);
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 3: Update documents with inferred types
-- Only update where we have high or medium confidence
-- ============================================

UPDATE documents d
SET document_type = df.inferred_type,
    updated_at = CURRENT_TIMESTAMP
FROM document_fixes df
WHERE d.id = df.id
  AND df.inferred_type IS NOT NULL
  AND df.confidence_level <= 2 -- Only high and medium confidence
  AND df.inferred_type IN (
      'insurance_cert', 'emission_cert', 'hpg_clearance', 
      'owner_id', 'registration_cert', 'csr', 'sales_invoice', 
      'deed_of_sale', 'seller_id', 'buyer_id'
  );

-- ============================================
-- STEP 4: Log the changes
-- ============================================

DO $$
DECLARE
    fixed_count INTEGER;
    fixed_by_type RECORD;
BEGIN
    SELECT COUNT(*) INTO fixed_count
    FROM documents d
    JOIN document_fixes df ON d.id = df.id
    WHERE d.document_type != 'other'
      AND df.inferred_type IS NOT NULL
      AND df.confidence_level <= 2;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Results';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Documents fixed: %', fixed_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Breakdown by type:';
    
    FOR fixed_by_type IN
        SELECT 
            d.document_type,
            COUNT(*) as count
        FROM documents d
        JOIN document_fixes df ON d.id = df.id
        WHERE d.document_type != 'other'
          AND df.inferred_type IS NOT NULL
          AND df.confidence_level <= 2
        GROUP BY d.document_type
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % documents', fixed_by_type.document_type, fixed_by_type.count;
    END LOOP;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- STEP 5: Create summary report
-- ============================================

-- Show remaining 'other' documents that need manual review
SELECT 
    'Documents still needing manual review' as status,
    COUNT(*) as count
FROM documents
WHERE document_type = 'other';

-- Show sample of remaining documents for admin review
SELECT 
    d.id,
    d.original_name,
    d.vehicle_id,
    v.vin,
    v.registration_type,
    d.uploaded_at
FROM documents d
LEFT JOIN vehicles v ON d.vehicle_id = v.id
WHERE d.document_type = 'other'
ORDER BY d.uploaded_at DESC
LIMIT 10;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================

-- Check remaining 'other' documents
-- SELECT document_type, COUNT(*) 
-- FROM documents 
-- WHERE document_type = 'other' 
-- GROUP BY document_type;

-- Check fixed documents
-- SELECT document_type, COUNT(*) 
-- FROM documents 
-- WHERE document_type != 'other'
--   AND id IN (SELECT id FROM document_fixes WHERE inferred_type IS NOT NULL)
-- GROUP BY document_type;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- WARNING: This will revert all changes made by this migration
-- Only use if you need to undo the migration
-- 
-- BEGIN;
-- UPDATE documents d
-- SET document_type = 'other'
-- FROM document_fixes df
-- WHERE d.id = df.id
--   AND df.inferred_type IS NOT NULL
--   AND df.confidence_level <= 2;
-- COMMIT;
