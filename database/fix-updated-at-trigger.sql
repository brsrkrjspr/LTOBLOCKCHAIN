-- Fix the update_updated_at_column function to work with vehicles table
-- The vehicles table uses 'last_updated' instead of 'updated_at'

-- Drop the existing trigger
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;

-- Update the function to handle both updated_at and last_updated columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to update updated_at if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = TG_TABLE_NAME AND column_name = 'updated_at') THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Try to update last_updated if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = TG_TABLE_NAME AND column_name = 'last_updated') THEN
        NEW.last_updated = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger for vehicles
CREATE TRIGGER update_vehicles_updated_at 
BEFORE UPDATE ON vehicles 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

