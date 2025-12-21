-- TrustChain LTO - Add OR/CR Number Support
-- Migration: Add OR/CR Number to Vehicles Table
-- Purpose: Store unique Official Receipt / Certificate of Registration number

-- Add OR/CR number column
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS or_cr_number VARCHAR(50) UNIQUE;

-- Add timestamp for when OR/CR was issued
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS or_cr_issued_at TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_or_cr_number ON vehicles(or_cr_number);

-- Create a sequence for atomic OR/CR number generation
CREATE SEQUENCE IF NOT EXISTS or_cr_number_seq START WITH 1 INCREMENT BY 1;

-- Set sequence to start after existing records (if any have OR/CR numbers)
DO $$
DECLARE
    max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(or_cr_number, '-', 3) AS INTEGER)), 0) + 1
    INTO max_seq
    FROM vehicles
    WHERE or_cr_number IS NOT NULL AND or_cr_number LIKE 'ORCR-%';
    
    IF max_seq > 1 THEN
        EXECUTE 'ALTER SEQUENCE or_cr_number_seq RESTART WITH ' || max_seq;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN vehicles.or_cr_number IS 'Unique Official Receipt/Certificate of Registration number. Format: ORCR-YYYY-XXXXXX';
COMMENT ON COLUMN vehicles.or_cr_issued_at IS 'Timestamp when the OR/CR number was issued';

