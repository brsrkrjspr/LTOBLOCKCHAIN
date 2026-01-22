-- ============================================
-- REMOVE EMISSION COLUMNS MIGRATION
-- ============================================
-- Purpose: Remove legacy emission verification columns from database
-- Date: 2026-01-XX
-- Status: Emission verification workflow has been REMOVED
-- 
-- Background:
-- Emission verification workflow was removed because LTO cannot issue
-- emission certificates. These must be issued by external emission testing
-- centers and uploaded by vehicle owners via certificate upload API.
--
-- This migration removes orphaned columns that are no longer used:
-- 1. transfer_requests: emission_clearance_request_id, emission_approval_status,
--    emission_approved_at, emission_approved_by
-- 2. vehicles: emission_compliance
--
-- Note: emission_verifier role in user_role ENUM is kept for existing users
-- but should not be assigned to new users.
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Remove emission columns from transfer_requests table
-- ============================================

-- Check if columns exist before dropping (safe operation)
DO $$
BEGIN
    -- Drop emission_clearance_request_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_clearance_request_id'
    ) THEN
        ALTER TABLE transfer_requests DROP COLUMN emission_clearance_request_id;
        RAISE NOTICE 'Dropped column: transfer_requests.emission_clearance_request_id';
    ELSE
        RAISE NOTICE 'Column does not exist: transfer_requests.emission_clearance_request_id (skipping)';
    END IF;

    -- Drop emission_approval_status column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_approval_status'
    ) THEN
        ALTER TABLE transfer_requests DROP COLUMN emission_approval_status;
        RAISE NOTICE 'Dropped column: transfer_requests.emission_approval_status';
    ELSE
        RAISE NOTICE 'Column does not exist: transfer_requests.emission_approval_status (skipping)';
    END IF;

    -- Drop emission_approved_at column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_approved_at'
    ) THEN
        ALTER TABLE transfer_requests DROP COLUMN emission_approved_at;
        RAISE NOTICE 'Dropped column: transfer_requests.emission_approved_at';
    ELSE
        RAISE NOTICE 'Column does not exist: transfer_requests.emission_approved_at (skipping)';
    END IF;

    -- Drop emission_approved_by column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_approved_by'
    ) THEN
        ALTER TABLE transfer_requests DROP COLUMN emission_approved_by;
        RAISE NOTICE 'Dropped column: transfer_requests.emission_approved_by';
    ELSE
        RAISE NOTICE 'Column does not exist: transfer_requests.emission_approved_by (skipping)';
    END IF;
END $$;

-- ============================================
-- STEP 2: Remove emission_compliance column from vehicles table
-- ============================================

DO $$
BEGIN
    -- Drop emission_compliance column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'emission_compliance'
    ) THEN
        ALTER TABLE vehicles DROP COLUMN emission_compliance;
        RAISE NOTICE 'Dropped column: vehicles.emission_compliance';
    ELSE
        RAISE NOTICE 'Column does not exist: vehicles.emission_compliance (skipping)';
    END IF;
END $$;

-- ============================================
-- STEP 3: Verify removal (optional - for confirmation)
-- ============================================

-- Verify transfer_requests columns are removed
DO $$
DECLARE
    remaining_columns TEXT[];
BEGIN
    SELECT array_agg(column_name) INTO remaining_columns
    FROM information_schema.columns
    WHERE table_name = 'transfer_requests'
    AND column_name LIKE 'emission%';
    
    IF remaining_columns IS NULL OR array_length(remaining_columns, 1) IS NULL THEN
        RAISE NOTICE '✅ All emission columns removed from transfer_requests table';
    ELSE
        RAISE WARNING '⚠️ Remaining emission columns in transfer_requests: %', array_to_string(remaining_columns, ', ');
    END IF;
END $$;

-- Verify vehicles column is removed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'emission_compliance'
    ) THEN
        RAISE WARNING '⚠️ Column still exists: vehicles.emission_compliance';
    ELSE
        RAISE NOTICE '✅ Column removed: vehicles.emission_compliance';
    END IF;
END $$;

COMMIT;

-- ============================================
-- POST-MIGRATION NOTES
-- ============================================
-- 
-- After running this migration:
-- 1. ✅ Emission columns removed from transfer_requests table
-- 2. ✅ emission_compliance removed from vehicles table
-- 3. ⚠️ emission_verifier role still exists in user_role ENUM (kept for existing users)
-- 4. ⚠️ 'emission' value still exists in verification_type (vehicle_verifications table)
-- 
-- Next steps:
-- 1. Update frontend to show deprecation message for emission verifier dashboard
-- 2. Review and update any code that references emission columns
-- 3. Consider removing emission_verifier role from new user assignments
-- 4. Consider removing 'emission' from verification_type if not used
--
-- Rollback (if needed):
-- See: database/rollback-emission-columns.sql
-- ============================================
