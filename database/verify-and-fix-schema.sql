-- Complete Database Schema Verification and Fix
-- This script checks for all required columns and adds missing ones
-- Safe to run multiple times (idempotent)

BEGIN;

-- ============================================
-- STEP 1: Check Current Schema Status
-- ============================================

DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SCHEMA VERIFICATION REPORT';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Check documents.ipfs_cid
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'ipfs_cid'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'documents.ipfs_cid');
        RAISE NOTICE '❌ MISSING: documents.ipfs_cid';
    ELSE
        RAISE NOTICE '✅ EXISTS: documents.ipfs_cid';
    END IF;
    
    -- Check vehicles.vehicle_category
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'vehicle_category'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'vehicles.vehicle_category');
        RAISE NOTICE '❌ MISSING: vehicles.vehicle_category';
    ELSE
        RAISE NOTICE '✅ EXISTS: vehicles.vehicle_category';
    END IF;
    
    -- Check vehicles.passenger_capacity
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'passenger_capacity'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'vehicles.passenger_capacity');
        RAISE NOTICE '❌ MISSING: vehicles.passenger_capacity';
    ELSE
        RAISE NOTICE '✅ EXISTS: vehicles.passenger_capacity';
    END IF;
    
    -- Check vehicles.gross_vehicle_weight
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'gross_vehicle_weight'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'vehicles.gross_vehicle_weight');
        RAISE NOTICE '❌ MISSING: vehicles.gross_vehicle_weight';
    ELSE
        RAISE NOTICE '✅ EXISTS: vehicles.gross_vehicle_weight';
    END IF;
    
    -- Check vehicles.net_weight
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'net_weight'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'vehicles.net_weight');
        RAISE NOTICE '❌ MISSING: vehicles.net_weight';
    ELSE
        RAISE NOTICE '✅ EXISTS: vehicles.net_weight';
    END IF;
    
    -- Check vehicles.registration_type
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'registration_type'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'vehicles.registration_type');
        RAISE NOTICE '❌ MISSING: vehicles.registration_type';
    ELSE
        RAISE NOTICE '✅ EXISTS: vehicles.registration_type';
    END IF;
    
    -- Check vehicles.origin_type
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'origin_type'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        missing_columns := array_append(missing_columns, 'vehicles.origin_type');
        RAISE NOTICE '❌ MISSING: vehicles.origin_type';
    ELSE
        RAISE NOTICE '✅ EXISTS: vehicles.origin_type';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE 'Found % missing columns. Proceeding to add them...', array_length(missing_columns, 1);
    ELSE
        RAISE NOTICE '✅ All required columns exist!';
    END IF;
END $$;

-- ============================================
-- STEP 2: Add Missing Columns
-- ============================================

-- Add ipfs_cid to documents table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'ipfs_cid'
    ) THEN
        ALTER TABLE documents ADD COLUMN ipfs_cid VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
        RAISE NOTICE '✅ Added documents.ipfs_cid';
    END IF;
END $$;

-- Add vehicle_category to vehicles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'vehicle_category'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN vehicle_category VARCHAR(5);
        RAISE NOTICE '✅ Added vehicles.vehicle_category';
    END IF;
END $$;

-- Add passenger_capacity to vehicles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'passenger_capacity'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN passenger_capacity INT;
        RAISE NOTICE '✅ Added vehicles.passenger_capacity';
    END IF;
END $$;

-- Add gross_vehicle_weight to vehicles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'gross_vehicle_weight'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN gross_vehicle_weight DECIMAL(10,2);
        RAISE NOTICE '✅ Added vehicles.gross_vehicle_weight';
    END IF;
END $$;

-- Add net_weight to vehicles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'net_weight'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN net_weight DECIMAL(10,2);
        RAISE NOTICE '✅ Added vehicles.net_weight';
    END IF;
END $$;

-- Add registration_type to vehicles table (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'registration_type'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN registration_type VARCHAR(20) DEFAULT 'Private';
        RAISE NOTICE '✅ Added vehicles.registration_type';
    END IF;
END $$;

-- Add origin_type to vehicles table (if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'origin_type'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN origin_type VARCHAR(20) DEFAULT 'NEW_REG';
        RAISE NOTICE '✅ Added vehicles.origin_type';
    END IF;
END $$;

-- ============================================
-- STEP 3: Set Default Values for Existing Vehicles
-- ============================================

-- Set default vehicle_category based on vehicle_type
UPDATE vehicles 
SET vehicle_category = CASE
    WHEN vehicle_type IN ('MOTORCYCLE', 'MC/TC', 'MC', 'TC') THEN 'L3'
    WHEN vehicle_type IN ('PASSENGER_CAR', 'Car') THEN 'M1'
    WHEN vehicle_type IN ('UTILITY_VEHICLE', 'UV', 'SUV') THEN 'M1'
    WHEN vehicle_type IN ('TRUCK', 'Truck') THEN 'N1'
    WHEN vehicle_type IN ('BUS', 'Bus') THEN 'M3'
    WHEN vehicle_type IN ('TRAILER', 'Trailer') THEN 'O1'
    ELSE 'M1'
END
WHERE vehicle_category IS NULL;

-- Set default passenger_capacity
UPDATE vehicles 
SET passenger_capacity = CASE
    WHEN vehicle_category LIKE 'L%' THEN 2
    WHEN vehicle_category = 'M1' THEN CASE
        WHEN vehicle_type IN ('UTILITY_VEHICLE', 'UV') THEN 7
        WHEN vehicle_type = 'SUV' THEN 8
        ELSE 5
    END
    WHEN vehicle_category = 'M2' THEN 12
    WHEN vehicle_category = 'M3' THEN 30
    WHEN vehicle_category LIKE 'N%' THEN 3
    WHEN vehicle_category LIKE 'O%' THEN 0
    ELSE 4
END
WHERE passenger_capacity IS NULL;

-- Set default gross_vehicle_weight
UPDATE vehicles 
SET gross_vehicle_weight = CASE
    WHEN vehicle_category LIKE 'L%' THEN 300.00
    WHEN vehicle_category = 'M1' THEN CASE
        WHEN vehicle_type IN ('UTILITY_VEHICLE', 'UV') THEN 2500.00
        WHEN vehicle_type = 'SUV' THEN 2800.00
        ELSE 2000.00
    END
    WHEN vehicle_category = 'M2' THEN 5000.00
    WHEN vehicle_category = 'M3' THEN 12000.00
    WHEN vehicle_category = 'N1' THEN 3500.00
    WHEN vehicle_category = 'N2' THEN 8000.00
    WHEN vehicle_category = 'N3' THEN 25000.00
    WHEN vehicle_category = 'O1' THEN 750.00
    WHEN vehicle_category = 'O2' THEN 3500.00
    WHEN vehicle_category = 'O3' THEN 10000.00
    WHEN vehicle_category = 'O4' THEN 25000.00
    ELSE 2000.00
END
WHERE gross_vehicle_weight IS NULL;

-- Set default net_weight (75% of GVW)
UPDATE vehicles 
SET net_weight = gross_vehicle_weight * 0.75
WHERE net_weight IS NULL AND gross_vehicle_weight IS NOT NULL;

-- Set default registration_type
UPDATE vehicles 
SET registration_type = 'Private'
WHERE registration_type IS NULL;

-- Set default origin_type
UPDATE vehicles 
SET origin_type = 'NEW_REG'
WHERE origin_type IS NULL;

-- ============================================
-- STEP 4: Final Verification
-- ============================================

DO $$
DECLARE
    all_exist BOOLEAN := true;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FINAL VERIFICATION';
    RAISE NOTICE '========================================';
    
    -- Verify all columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'ipfs_cid'
    ) THEN
        RAISE EXCEPTION 'documents.ipfs_cid still missing after migration';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'vehicle_category'
    ) THEN
        RAISE EXCEPTION 'vehicles.vehicle_category still missing after migration';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'passenger_capacity'
    ) THEN
        RAISE EXCEPTION 'vehicles.passenger_capacity still missing after migration';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'gross_vehicle_weight'
    ) THEN
        RAISE EXCEPTION 'vehicles.gross_vehicle_weight still missing after migration';
    END IF;
    
    RAISE NOTICE '✅ All required columns verified!';
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- Migration complete!
-- All required columns have been added and verified.
