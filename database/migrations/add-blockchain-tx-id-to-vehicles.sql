-- Add blockchain_tx_id column to vehicles table if it doesn't exist
-- This column stores the Hyperledger Fabric transaction ID for vehicle registrations and transfers

-- Check if column exists and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'vehicles' 
          AND column_name = 'blockchain_tx_id'
    ) THEN
        ALTER TABLE vehicles 
        ADD COLUMN blockchain_tx_id VARCHAR(255);
        
        -- Add comment
        COMMENT ON COLUMN vehicles.blockchain_tx_id IS 'Hyperledger Fabric transaction ID for vehicle registration or ownership transfer';
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_vehicles_blockchain_tx_id ON vehicles(blockchain_tx_id);
        
        RAISE NOTICE 'Column blockchain_tx_id added to vehicles table';
    ELSE
        RAISE NOTICE 'Column blockchain_tx_id already exists in vehicles table';
    END IF;
END $$;
