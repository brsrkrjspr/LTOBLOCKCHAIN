-- TrustChain LTO - Separate OR/CR Number Migration
-- Migration: Separate OR and CR numbers from combined or_cr_number
-- Purpose: Store separate Official Receipt (OR) and Certificate of Registration (CR) numbers
-- Date: 2025-01-XX

-- ============================================
-- STEP 1: Add new columns
-- ============================================

-- Add separate OR and CR number columns
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS or_number VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_number VARCHAR(50);

-- Add separate issue timestamps
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS or_issued_at TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_issued_at TIMESTAMP;

-- Add date of registration (separate from registration_date for clarity)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS date_of_registration TIMESTAMP;

-- Add additional CR fields (for future use)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_type VARCHAR(20) DEFAULT 'PRIVATE';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_classification VARCHAR(50);

-- ============================================
-- STEP 2: Create sequences for OR and CR number generation
-- ============================================

-- Create sequence for OR numbers (starting at 7, after existing 6)
CREATE SEQUENCE IF NOT EXISTS or_number_seq START WITH 7 INCREMENT BY 1;

-- Create sequence for CR numbers (starting at 7, after existing 6)
CREATE SEQUENCE IF NOT EXISTS cr_number_seq START WITH 7 INCREMENT BY 1;

-- ============================================
-- STEP 3: Migrate existing OR/CR numbers (6 vehicles)
-- ============================================

-- Split existing ORCR-YYYY-XXXXXX format into OR-YYYY-XXXXXX and CR-YYYY-XXXXXX
-- This handles the 6 vehicles that already have OR/CR numbers
UPDATE vehicles 
SET 
    or_number = REPLACE(or_cr_number, 'ORCR-', 'OR-'),
    cr_number = REPLACE(or_cr_number, 'ORCR-', 'CR-'),
    or_issued_at = or_cr_issued_at,
    cr_issued_at = or_cr_issued_at,
    date_of_registration = COALESCE(registration_date, or_cr_issued_at, CURRENT_TIMESTAMP)
WHERE or_cr_number IS NOT NULL;

-- ============================================
-- STEP 4: Set date_of_registration for vehicles without OR/CR
-- ============================================

-- For vehicles without OR/CR, use registration_date as date_of_registration
UPDATE vehicles 
SET date_of_registration = COALESCE(registration_date, CURRENT_TIMESTAMP)
WHERE date_of_registration IS NULL;

-- ============================================
-- STEP 5: Add unique constraints
-- ============================================

-- Add unique constraint on or_number (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vehicles_or_number_key'
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_or_number_key UNIQUE (or_number);
    END IF;
END $$;

-- Add unique constraint on cr_number (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vehicles_cr_number_key'
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_cr_number_key UNIQUE (cr_number);
    END IF;
END $$;

-- ============================================
-- STEP 6: Create indexes for performance
-- ============================================

-- Index on or_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_or_number ON vehicles(or_number);

-- Index on cr_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_cr_number ON vehicles(cr_number);

-- Index on date_of_registration
CREATE INDEX IF NOT EXISTS idx_vehicles_date_of_registration ON vehicles(date_of_registration);

-- ============================================
-- STEP 7: Add comments for documentation
-- ============================================

COMMENT ON COLUMN vehicles.or_number IS 'Separate Official Receipt number. Format: OR-YYYY-XXXXXX. Replaces combined or_cr_number.';
COMMENT ON COLUMN vehicles.cr_number IS 'Separate Certificate of Registration number. Format: CR-YYYY-XXXXXX. Replaces combined or_cr_number.';
COMMENT ON COLUMN vehicles.or_issued_at IS 'Timestamp when the OR number was issued';
COMMENT ON COLUMN vehicles.cr_issued_at IS 'Timestamp when the CR number was issued';
COMMENT ON COLUMN vehicles.date_of_registration IS 'Date when vehicle was registered (separate from registration_date for clarity)';
COMMENT ON COLUMN vehicles.net_weight IS 'Net weight of vehicle in kilograms (for CR)';
COMMENT ON COLUMN vehicles.registration_type IS 'Type of registration: PRIVATE, FOR_HIRE, GOVERNMENT';
COMMENT ON COLUMN vehicles.vehicle_classification IS 'LTO vehicle classification';

-- ============================================
-- Migration Complete
-- ============================================
-- Note: Vehicles without OR/CR numbers will be handled by the Node.js migration script
-- (scripts/migrate-separate-or-cr.js) which will generate new separate numbers

