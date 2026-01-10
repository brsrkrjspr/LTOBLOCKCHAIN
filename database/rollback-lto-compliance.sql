-- TrustChain LTO - Rollback Script for LTO Compliance Migration
-- Purpose: Rollback the LTO compliance migration changes
-- WARNING: This will remove constraints, indexes, and optionally columns added by the migration
-- Date: 2025-01-XX
--
-- IMPORTANT: Backup your database before running this rollback!
-- This script is designed to safely rollback the migration while preserving data

BEGIN;

-- ============================================
-- STEP 1: Remove Constraints
-- ============================================

-- Remove CHECK constraints
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_vehicle_category;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_passenger_capacity;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_gross_vehicle_weight;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_net_weight;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS chk_registration_type;

-- ============================================
-- STEP 2: Remove Indexes
-- ============================================

DROP INDEX IF EXISTS idx_vehicles_category;
DROP INDEX IF EXISTS idx_vehicles_classification;
DROP INDEX IF EXISTS idx_vehicles_gvw;

-- ============================================
-- STEP 3: Make New Fields Nullable (Optional)
-- ============================================

-- Make new fields nullable to allow rollback without data loss
-- Uncomment if you want to make fields nullable instead of removing them
-- ALTER TABLE vehicles ALTER COLUMN vehicle_category DROP NOT NULL;
-- ALTER TABLE vehicles ALTER COLUMN passenger_capacity DROP NOT NULL;
-- ALTER TABLE vehicles ALTER COLUMN gross_vehicle_weight DROP NOT NULL;
-- ALTER TABLE vehicles ALTER COLUMN net_weight DROP NOT NULL;

-- ============================================
-- STEP 4: Remove Columns (Optional - Uncomment if needed)
-- ============================================

-- WARNING: Uncommenting these will permanently delete data!
-- Only uncomment if you want to completely remove the new columns
-- ALTER TABLE vehicles DROP COLUMN IF EXISTS vehicle_category;
-- ALTER TABLE vehicles DROP COLUMN IF EXISTS passenger_capacity;
-- ALTER TABLE vehicles DROP COLUMN IF EXISTS gross_vehicle_weight;
-- Note: net_weight may be kept as it was added in a previous migration

-- ============================================
-- STEP 5: Restore NOT NULL Constraints on Non-LTO Fields (Optional)
-- ============================================

-- Uncomment if you want to restore NOT NULL constraints on non-LTO fields
-- ALTER TABLE vehicles ALTER COLUMN fuel_type SET NOT NULL;
-- ALTER TABLE vehicles ALTER COLUMN transmission SET NOT NULL;
-- ALTER TABLE vehicles ALTER COLUMN engine_displacement SET NOT NULL;

-- ============================================
-- STEP 6: Clean Up Helper Functions
-- ============================================

DROP FUNCTION IF EXISTS map_vehicle_type_to_category(VARCHAR);
DROP FUNCTION IF EXISTS get_default_passenger_capacity(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS get_default_gvw(VARCHAR, VARCHAR);

COMMIT;

-- Rollback completed!
-- Note: Data in the new columns is preserved (unless you uncommented column removal)
-- You can re-run the migration script if needed
