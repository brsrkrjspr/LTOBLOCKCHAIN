-- TrustChain LTO - Add Missing Transfer Request Status Values
-- Date: 2026-01-25
-- Description: Adds UNDER_REVIEW, AWAITING_BUYER_DOCS, and EXPIRED to transfer_requests.status CHECK constraint
-- This fixes the error: "violates check constraint transfer_requests_status_check"
--
-- Current constraint only allows: PENDING, REVIEWING, APPROVED, REJECTED, COMPLETED, FORWARDED_TO_HPG
-- Code uses: UNDER_REVIEW, AWAITING_BUYER_DOCS, EXPIRED (missing from constraint)
--
-- Run this script to update the CHECK constraint
-- This migration is idempotent (safe to re-run)

-- ============================================
-- STEP 1: Drop the old constraint
-- ============================================

DO $$
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'transfer_requests_status_check' 
        AND table_name = 'transfer_requests'
    ) THEN
        ALTER TABLE transfer_requests DROP CONSTRAINT transfer_requests_status_check;
        RAISE NOTICE 'Dropped old transfer_requests_status_check constraint';
    ELSE
        RAISE NOTICE 'transfer_requests_status_check constraint does not exist';
    END IF;
END $$;

-- ============================================
-- STEP 2: Add the new constraint with all status values
-- ============================================

ALTER TABLE transfer_requests 
ADD CONSTRAINT transfer_requests_status_check 
CHECK (status IN (
    'PENDING',              -- Initial state when seller creates request
    'AWAITING_BUYER_DOCS',  -- Buyer accepted but hasn't uploaded documents yet
    'UNDER_REVIEW',         -- Buyer submitted docs, awaiting LTO review (replaces REVIEWING)
    'REVIEWING',            -- Legacy status (kept for backward compatibility)
    'APPROVED',             -- LTO approved the transfer
    'REJECTED',             -- Transfer rejected by buyer or LTO
    'EXPIRED',              -- Transfer request expired
    'COMPLETED',            -- Transfer completed successfully
    'FORWARDED_TO_HPG'      -- Forwarded to HPG for clearance
));

-- ============================================
-- STEP 3: Add comment
-- ============================================

COMMENT ON CONSTRAINT transfer_requests_status_check ON transfer_requests IS 
'Transfer request status values: PENDING, AWAITING_BUYER_DOCS, UNDER_REVIEW, REVIEWING (legacy), APPROVED, REJECTED, EXPIRED, COMPLETED, FORWARDED_TO_HPG';

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Verify constraint exists and check its definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'transfer_requests_status_check'
AND conrelid = 'transfer_requests'::regclass;

-- Expected output should show all status values in the CHECK constraint

-- ============================================
-- NOTES
-- ============================================
-- Status values added:
-- - UNDER_REVIEW: Used when buyer submits documents and request is awaiting LTO review
-- - AWAITING_BUYER_DOCS: Used when buyer accepts but hasn't uploaded documents yet
-- - EXPIRED: Used when transfer request expires
--
-- REVIEWING is kept for backward compatibility but UNDER_REVIEW is preferred.
--
-- Status workflow:
-- PENDING -> AWAITING_BUYER_DOCS -> UNDER_REVIEW -> APPROVED -> COMPLETED
--                    |                    |              |
--                    v                    v              v
--                 REJECTED            REJECTED      REJECTED
--                    |                    |              |
--                    v                    v              v
--                 EXPIRED            EXPIRED        (terminal)
