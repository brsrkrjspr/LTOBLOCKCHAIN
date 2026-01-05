-- TrustChain LTO - Add Origin Type to Vehicles Migration
-- Tracks how a vehicle was acquired: NEW_REG (new registration) or TRANSFER (ownership transfer)

-- Create ENUM type for origin_type
DO $$ BEGIN
    CREATE TYPE vehicle_origin_type AS ENUM ('NEW_REG', 'TRANSFER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add origin_type column to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS origin_type vehicle_origin_type DEFAULT 'NEW_REG';

-- Set all existing vehicles to 'NEW_REG' (they were all originally registered)
UPDATE vehicles 
SET origin_type = 'NEW_REG' 
WHERE origin_type IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE vehicles 
ALTER COLUMN origin_type SET NOT NULL;

-- Create index for filtering by origin type
CREATE INDEX IF NOT EXISTS idx_vehicles_origin_type ON vehicles(origin_type);

-- Verify the migration
DO $$ 
BEGIN
    RAISE NOTICE 'Migration completed successfully. Column origin_type added to vehicles table.';
END $$;

