-- TrustChain LTO - LTO Compliance Migration
-- Migration: Add required LTO fields and remove non-LTO field defaults
-- Purpose: Align vehicle registration with Philippine LTO Certificate of Registration requirements
-- Date: 2025-01-XX
-- 
-- IMPORTANT: Backup your database before running this migration!
-- Run: pg_dump -U postgres -d your_database > backup_before_lto_migration.sql

BEGIN;

-- ============================================
-- STEP 1: Pre-Migration Validation
-- ============================================

-- Check existing data integrity
DO $$
DECLARE
    total_vehicles INT;
    vehicles_with_null_types INT;
    vehicles_needing_migration INT;
    columns_exist BOOLEAN;
BEGIN
    -- Check if new columns already exist (for re-run safety)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'vehicle_category'
    ) INTO columns_exist;
    
    SELECT COUNT(*) INTO total_vehicles FROM vehicles;
    SELECT COUNT(*) INTO vehicles_with_null_types FROM vehicles WHERE vehicle_type IS NULL;
    
    -- Only check for vehicles needing migration if columns already exist (re-run scenario)
    IF columns_exist THEN
        SELECT COUNT(*) INTO vehicles_needing_migration FROM vehicles 
            WHERE vehicle_category IS NULL OR passenger_capacity IS NULL OR gross_vehicle_weight IS NULL;
    ELSE
        -- All vehicles need migration if columns don't exist yet
        vehicles_needing_migration := total_vehicles;
    END IF;
    
    RAISE NOTICE 'Pre-migration check:';
    RAISE NOTICE '  Total vehicles: %', total_vehicles;
    RAISE NOTICE '  Vehicles with null types: %', vehicles_with_null_types;
    RAISE NOTICE '  Vehicles needing migration: %', vehicles_needing_migration;
    
    IF vehicles_with_null_types > 0 THEN
        RAISE WARNING 'Found vehicles with NULL vehicle_type. These may cause migration issues.';
    END IF;
END $$;

-- ============================================
-- STEP 2: Create Helper Functions for Smart Defaults
-- ============================================

-- Function to map vehicle type to PNS category
CREATE OR REPLACE FUNCTION map_vehicle_type_to_category(v_type VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE
        WHEN v_type IN ('MOTORCYCLE', 'MC/TC', 'MC', 'TC') THEN 'L3'
        WHEN v_type = 'PASSENGER_CAR' OR v_type = 'Car' THEN 'M1'
        WHEN v_type IN ('UTILITY_VEHICLE', 'UV', 'SUV') THEN 'M1'
        WHEN v_type = 'TRUCK' OR v_type = 'Truck' THEN 'N1'
        WHEN v_type = 'BUS' OR v_type = 'Bus' THEN 'M3'
        WHEN v_type = 'TRAILER' OR v_type = 'Trailer' THEN 'O1'
        ELSE 'M1' -- Default fallback
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get default passenger capacity
CREATE OR REPLACE FUNCTION get_default_passenger_capacity(v_type VARCHAR, v_category VARCHAR)
RETURNS INT AS $$
BEGIN
    RETURN CASE
        WHEN v_category LIKE 'L%' THEN 2 -- Motorcycles
        WHEN v_category = 'M1' THEN CASE
            WHEN v_type IN ('UTILITY_VEHICLE', 'UV') THEN 7
            WHEN v_type = 'SUV' THEN 8
            ELSE 5 -- Standard passenger car
        END
        WHEN v_category = 'M2' THEN 12
        WHEN v_category = 'M3' THEN 30
        WHEN v_category LIKE 'N%' THEN 3 -- Goods vehicles
        WHEN v_category LIKE 'O%' THEN 0 -- Trailers (no passengers)
        ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get default Gross Vehicle Weight
CREATE OR REPLACE FUNCTION get_default_gvw(v_type VARCHAR, v_category VARCHAR)
RETURNS DECIMAL AS $$
BEGIN
    RETURN CASE
        WHEN v_category LIKE 'L%' THEN 300.00 -- Motorcycles
        WHEN v_category = 'M1' THEN CASE
            WHEN v_type IN ('UTILITY_VEHICLE', 'UV') THEN 2500.00
            WHEN v_type = 'SUV' THEN 2800.00
            ELSE 2000.00 -- Standard passenger car
        END
        WHEN v_category = 'M2' THEN 5000.00
        WHEN v_category = 'M3' THEN 12000.00
        WHEN v_category = 'N1' THEN 3500.00
        WHEN v_category = 'N2' THEN 8000.00
        WHEN v_category = 'N3' THEN 25000.00
        WHEN v_category = 'O1' THEN 750.00
        WHEN v_category = 'O2' THEN 3500.00
        WHEN v_category = 'O3' THEN 10000.00
        WHEN v_category = 'O4' THEN 25000.00
        ELSE 2000.00
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: Add New Required Columns
-- ============================================

-- Add vehicle_category (PNS codes)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(5);

-- Add passenger_capacity
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS passenger_capacity INT;

-- Add gross_vehicle_weight
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gross_vehicle_weight DECIMAL(10,2);

-- Ensure net_weight exists (should already exist from previous migration)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2);

-- ============================================
-- STEP 4: Migrate Existing Data with Smart Defaults
-- ============================================

-- First, set vehicle_category, passenger_capacity, gross_vehicle_weight, and registration_type
UPDATE vehicles 
SET 
    vehicle_category = COALESCE(vehicle_category, map_vehicle_type_to_category(vehicle_type)),
    passenger_capacity = COALESCE(passenger_capacity, get_default_passenger_capacity(vehicle_type, COALESCE(vehicle_category, map_vehicle_type_to_category(vehicle_type)))),
    gross_vehicle_weight = COALESCE(gross_vehicle_weight, get_default_gvw(vehicle_type, COALESCE(vehicle_category, map_vehicle_type_to_category(vehicle_type)))),
    registration_type = COALESCE(registration_type, 'Private')
WHERE vehicle_category IS NULL 
   OR passenger_capacity IS NULL 
   OR gross_vehicle_weight IS NULL
   OR registration_type IS NULL;

-- Then, set net_weight using the already-calculated gross_vehicle_weight
UPDATE vehicles 
SET 
    net_weight = COALESCE(net_weight, gross_vehicle_weight * 0.75) -- 75% of GVW as default
WHERE net_weight IS NULL;

-- ============================================
-- STEP 5: Make Non-LTO Fields Nullable
-- ============================================

-- Remove NOT NULL constraints from non-LTO fields (if they exist)
DO $$
BEGIN
    -- Try to drop NOT NULL constraint (will fail silently if constraint doesn't exist)
    ALTER TABLE vehicles ALTER COLUMN fuel_type DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE vehicles ALTER COLUMN transmission DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE vehicles ALTER COLUMN engine_displacement DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- STEP 5.5: Fix Data Integrity Issues Before Constraints
-- ============================================

-- Fix any data where net_weight >= gross_vehicle_weight
UPDATE vehicles 
SET net_weight = gross_vehicle_weight * 0.75
WHERE net_weight IS NOT NULL 
  AND gross_vehicle_weight IS NOT NULL 
  AND net_weight >= gross_vehicle_weight;

-- Normalize registration_type values to match constraint requirements
UPDATE vehicles 
SET registration_type = CASE
    WHEN UPPER(TRIM(registration_type)) IN ('PRIVATE', 'PRIV') THEN 'Private'
    WHEN UPPER(TRIM(registration_type)) IN ('FOR HIRE', 'FOR_HIRE', 'HIRE', 'TAXI', 'PUBLIC') THEN 'For Hire'
    WHEN UPPER(TRIM(registration_type)) IN ('GOVERNMENT', 'GOV', 'GOVT') THEN 'Government'
    WHEN UPPER(TRIM(registration_type)) IN ('EXEMPT', 'EXEMPTED') THEN 'Exempt'
    ELSE 'Private' -- Default to Private if unknown
END
WHERE registration_type IS NOT NULL 
  AND UPPER(TRIM(registration_type)) NOT IN ('PRIVATE', 'FOR HIRE', 'GOVERNMENT', 'EXEMPT');

-- ============================================
-- STEP 6: Add Constraints
-- ============================================

-- Add CHECK constraint for vehicle_category
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_vehicle_category' 
        AND conrelid = 'vehicles'::regclass
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT chk_vehicle_category 
            CHECK (vehicle_category IN ('L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4'));
    END IF;
END $$;

-- Add CHECK constraint for passenger_capacity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_passenger_capacity' 
        AND conrelid = 'vehicles'::regclass
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT chk_passenger_capacity 
            CHECK (passenger_capacity >= 1 AND passenger_capacity <= 100);
    END IF;
END $$;

-- Add CHECK constraint for gross_vehicle_weight
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_gross_vehicle_weight' 
        AND conrelid = 'vehicles'::regclass
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT chk_gross_vehicle_weight 
            CHECK (gross_vehicle_weight > 0);
    END IF;
END $$;

-- Add CHECK constraint for net_weight (must be > 0 and < gross_vehicle_weight)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_net_weight' 
        AND conrelid = 'vehicles'::regclass
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT chk_net_weight 
            CHECK (net_weight > 0 AND net_weight < gross_vehicle_weight);
    END IF;
END $$;

-- Add CHECK constraint for registration_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_registration_type' 
        AND conrelid = 'vehicles'::regclass
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT chk_registration_type 
            CHECK (registration_type IN ('Private', 'For Hire', 'Government', 'Exempt'));
    END IF;
END $$;

-- ============================================
-- STEP 7: Make New Fields NOT NULL (after data migration)
-- ============================================

-- Now that data is migrated, make fields required
ALTER TABLE vehicles ALTER COLUMN vehicle_category SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN passenger_capacity SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN gross_vehicle_weight SET NOT NULL;
ALTER TABLE vehicles ALTER COLUMN net_weight SET NOT NULL;

-- ============================================
-- STEP 8: Add Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(vehicle_category);
CREATE INDEX IF NOT EXISTS idx_vehicles_classification ON vehicles(registration_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_gvw ON vehicles(gross_vehicle_weight);

-- ============================================
-- STEP 9: Clean Up Helper Functions (Optional)
-- ============================================

-- Uncomment to remove helper functions after migration
-- DROP FUNCTION IF EXISTS map_vehicle_type_to_category(VARCHAR);
-- DROP FUNCTION IF EXISTS get_default_passenger_capacity(VARCHAR, VARCHAR);
-- DROP FUNCTION IF EXISTS get_default_gvw(VARCHAR, VARCHAR);

-- ============================================
-- STEP 10: Post-Migration Validation
-- ============================================

DO $$
DECLARE
    vehicles_with_valid_category INT;
    vehicles_with_valid_capacity INT;
    vehicles_with_valid_weights INT;
    vehicles_with_valid_classification INT;
    null_categories INT;
    null_capacities INT;
    null_gvw INT;
BEGIN
    -- Verify data integrity
    SELECT COUNT(*) INTO vehicles_with_valid_category FROM vehicles 
        WHERE vehicle_category IN ('L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4');
    
    SELECT COUNT(*) INTO vehicles_with_valid_capacity FROM vehicles 
        WHERE passenger_capacity >= 1 AND passenger_capacity <= 100;
    
    SELECT COUNT(*) INTO vehicles_with_valid_weights FROM vehicles 
        WHERE gross_vehicle_weight > 0 AND net_weight > 0 AND net_weight < gross_vehicle_weight;
    
    SELECT COUNT(*) INTO vehicles_with_valid_classification FROM vehicles 
        WHERE registration_type IN ('Private', 'For Hire', 'Government', 'Exempt');
    
    -- Check for NULL values
    SELECT COUNT(*) INTO null_categories FROM vehicles WHERE vehicle_category IS NULL;
    SELECT COUNT(*) INTO null_capacities FROM vehicles WHERE passenger_capacity IS NULL;
    SELECT COUNT(*) INTO null_gvw FROM vehicles WHERE gross_vehicle_weight IS NULL;
    
    RAISE NOTICE 'Post-migration validation:';
    RAISE NOTICE '  Vehicles with valid category: %', vehicles_with_valid_category;
    RAISE NOTICE '  Vehicles with valid capacity: %', vehicles_with_valid_capacity;
    RAISE NOTICE '  Vehicles with valid weights: %', vehicles_with_valid_weights;
    RAISE NOTICE '  Vehicles with valid classification: %', vehicles_with_valid_classification;
    RAISE NOTICE '  NULL categories: %', null_categories;
    RAISE NOTICE '  NULL capacities: %', null_capacities;
    RAISE NOTICE '  NULL GVW: %', null_gvw;
    
    -- Raise error if validation fails
    IF null_categories > 0 OR null_capacities > 0 OR null_gvw > 0 THEN
        RAISE EXCEPTION 'Migration validation failed: Found NULL values in required fields';
    END IF;
END $$;

COMMIT;

-- Migration completed successfully!
-- Next steps:
-- 1. Run database/validate-migration.sql to verify all constraints
-- 2. Test application functionality
-- 3. Monitor for any issues
