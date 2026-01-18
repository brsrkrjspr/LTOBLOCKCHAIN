-- Fix Missing Columns Migration
-- Adds missing columns: ipfs_cid (documents), vehicle_category, passenger_capacity, gross_vehicle_weight (vehicles)
-- Run this on your DigitalOcean server to fix database schema errors

BEGIN;

-- ============================================
-- STEP 1: Add ipfs_cid to documents table
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'ipfs_cid'
    ) THEN
        ALTER TABLE documents ADD COLUMN ipfs_cid VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);
        RAISE NOTICE 'Added ipfs_cid column to documents table';
    ELSE
        RAISE NOTICE 'ipfs_cid column already exists in documents table';
    END IF;
END $$;

-- ============================================
-- STEP 2: Add vehicle_category, passenger_capacity, gross_vehicle_weight to vehicles table
-- ============================================

-- Add vehicle_category
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'vehicle_category'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN vehicle_category VARCHAR(5);
        RAISE NOTICE 'Added vehicle_category column to vehicles table';
    ELSE
        RAISE NOTICE 'vehicle_category column already exists in vehicles table';
    END IF;
END $$;

-- Add passenger_capacity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'passenger_capacity'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN passenger_capacity INT;
        RAISE NOTICE 'Added passenger_capacity column to vehicles table';
    ELSE
        RAISE NOTICE 'passenger_capacity column already exists in vehicles table';
    END IF;
END $$;

-- Add gross_vehicle_weight
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'gross_vehicle_weight'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN gross_vehicle_weight DECIMAL(10,2);
        RAISE NOTICE 'Added gross_vehicle_weight column to vehicles table';
    ELSE
        RAISE NOTICE 'gross_vehicle_weight column already exists in vehicles table';
    END IF;
END $$;

-- Add net_weight if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'net_weight'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN net_weight DECIMAL(10,2);
        RAISE NOTICE 'Added net_weight column to vehicles table';
    ELSE
        RAISE NOTICE 'net_weight column already exists in vehicles table';
    END IF;
END $$;

-- ============================================
-- STEP 3: Set default values for existing vehicles (if any)
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
    ELSE 'M1' -- Default fallback
END
WHERE vehicle_category IS NULL;

-- Set default passenger_capacity
UPDATE vehicles 
SET passenger_capacity = CASE
    WHEN vehicle_category LIKE 'L%' THEN 2 -- Motorcycles
    WHEN vehicle_category = 'M1' THEN CASE
        WHEN vehicle_type IN ('UTILITY_VEHICLE', 'UV') THEN 7
        WHEN vehicle_type = 'SUV' THEN 8
        ELSE 5 -- Standard passenger car
    END
    WHEN vehicle_category = 'M2' THEN 12
    WHEN vehicle_category = 'M3' THEN 30
    WHEN vehicle_category LIKE 'N%' THEN 3 -- Goods vehicles
    WHEN vehicle_category LIKE 'O%' THEN 0 -- Trailers
    ELSE 4
END
WHERE passenger_capacity IS NULL;

-- Set default gross_vehicle_weight
UPDATE vehicles 
SET gross_vehicle_weight = CASE
    WHEN vehicle_category LIKE 'L%' THEN 300.00 -- Motorcycles
    WHEN vehicle_category = 'M1' THEN CASE
        WHEN vehicle_type IN ('UTILITY_VEHICLE', 'UV') THEN 2500.00
        WHEN vehicle_type = 'SUV' THEN 2800.00
        ELSE 2000.00 -- Standard passenger car
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

-- ============================================
-- STEP 4: Verify columns were added
-- ============================================

DO $$
DECLARE
    ipfs_cid_exists BOOLEAN;
    vehicle_category_exists BOOLEAN;
    passenger_capacity_exists BOOLEAN;
    gross_vehicle_weight_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'ipfs_cid'
    ) INTO ipfs_cid_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'vehicle_category'
    ) INTO vehicle_category_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'passenger_capacity'
    ) INTO passenger_capacity_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'gross_vehicle_weight'
    ) INTO gross_vehicle_weight_exists;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE '  documents.ipfs_cid: %', CASE WHEN ipfs_cid_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  vehicles.vehicle_category: %', CASE WHEN vehicle_category_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  vehicles.passenger_capacity: %', CASE WHEN passenger_capacity_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  vehicles.gross_vehicle_weight: %', CASE WHEN gross_vehicle_weight_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '========================================';
    
    IF NOT (ipfs_cid_exists AND vehicle_category_exists AND passenger_capacity_exists AND gross_vehicle_weight_exists) THEN
        RAISE EXCEPTION 'Migration incomplete: Some columns are still missing';
    END IF;
END $$;

COMMIT;

-- Migration completed successfully!
-- All required columns have been added to the database.
