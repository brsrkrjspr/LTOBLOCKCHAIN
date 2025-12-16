-- Fix transaction_id field length in vehicle_history table
-- Fabric transaction IDs can exceed 100 characters

-- Check current column definition
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'vehicle_history' AND column_name = 'transaction_id';

-- Alter column to support longer transaction IDs
ALTER TABLE vehicle_history 
ALTER COLUMN transaction_id TYPE VARCHAR(255);

-- Verify change
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'vehicle_history' AND column_name = 'transaction_id';

