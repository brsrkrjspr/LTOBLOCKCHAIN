-- TrustChain LTO - Migration Validation Script
-- Purpose: Validate data integrity before and after LTO compliance migration
-- Usage: Run this script before and after running lto-compliance-migration.sql

-- ============================================
-- PRE-MIGRATION VALIDATION
-- ============================================

-- Check existing data integrity
SELECT 
    'PRE-MIGRATION VALIDATION' as validation_type,
    COUNT(*) as total_vehicles 
FROM vehicles;

SELECT 
    'Vehicles with NULL vehicle_type' as check_type,
    COUNT(*) as count 
FROM vehicles 
WHERE vehicle_type IS NULL;

SELECT 
    'Distinct vehicle types' as check_type,
    array_agg(DISTINCT vehicle_type) as vehicle_types
FROM vehicles;

SELECT 
    'Vehicles needing migration' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE vehicle_category IS NULL 
   OR passenger_capacity IS NULL 
   OR gross_vehicle_weight IS NULL;

-- ============================================
-- POST-MIGRATION VALIDATION
-- ============================================

-- Verify all constraints exist
SELECT 
    'POST-MIGRATION: Constraints' as validation_type,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'vehicles'::regclass
ORDER BY conname;

-- Verify data integrity
SELECT 
    'POST-MIGRATION: Valid categories' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE vehicle_category IN ('L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4');

SELECT 
    'POST-MIGRATION: Valid capacity' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE passenger_capacity >= 1 AND passenger_capacity <= 100;

SELECT 
    'POST-MIGRATION: Valid weights' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE gross_vehicle_weight > 0 
  AND net_weight > 0 
  AND net_weight < gross_vehicle_weight;

SELECT 
    'POST-MIGRATION: Valid classification' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE registration_type IN ('Private', 'For Hire', 'Government', 'Exempt');

-- Check for any NULL values in required fields
SELECT 
    'POST-MIGRATION: NULL categories' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE vehicle_category IS NULL;

SELECT 
    'POST-MIGRATION: NULL capacities' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE passenger_capacity IS NULL;

SELECT 
    'POST-MIGRATION: NULL GVW' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE gross_vehicle_weight IS NULL;

SELECT 
    'POST-MIGRATION: NULL net_weight' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE net_weight IS NULL;

-- Check for constraint violations
SELECT 
    'POST-MIGRATION: Invalid categories' as check_type,
    COUNT(*) as count,
    array_agg(DISTINCT vehicle_category) as invalid_categories
FROM vehicles 
WHERE vehicle_category IS NOT NULL 
  AND vehicle_category NOT IN ('L1','L2','L3','L5','M1','M2','M3','N1','N2','N3','O1','O2','O3','O4');

SELECT 
    'POST-MIGRATION: Invalid capacity range' as check_type,
    COUNT(*) as count,
    MIN(passenger_capacity) as min_capacity,
    MAX(passenger_capacity) as max_capacity
FROM vehicles 
WHERE passenger_capacity < 1 OR passenger_capacity > 100;

SELECT 
    'POST-MIGRATION: Invalid weight relationships' as check_type,
    COUNT(*) as count
FROM vehicles 
WHERE net_weight >= gross_vehicle_weight;

-- Summary report
SELECT 
    'SUMMARY' as report_type,
    COUNT(*) as total_vehicles,
    COUNT(CASE WHEN vehicle_category IS NOT NULL THEN 1 END) as vehicles_with_category,
    COUNT(CASE WHEN passenger_capacity IS NOT NULL THEN 1 END) as vehicles_with_capacity,
    COUNT(CASE WHEN gross_vehicle_weight IS NOT NULL THEN 1 END) as vehicles_with_gvw,
    COUNT(CASE WHEN net_weight IS NOT NULL THEN 1 END) as vehicles_with_net_weight,
    COUNT(CASE WHEN registration_type IS NOT NULL THEN 1 END) as vehicles_with_classification
FROM vehicles;
