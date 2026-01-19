-- Add insurance_clearance_request_id column to transfer_requests table
-- This column links transfer requests to insurance clearance requests

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'insurance_clearance_request_id'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN insurance_clearance_request_id UUID REFERENCES clearance_requests(id);
        
        RAISE NOTICE '✅ Added column: transfer_requests.insurance_clearance_request_id';
    ELSE
        RAISE NOTICE '✅ Column already exists: transfer_requests.insurance_clearance_request_id';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transfer_requests' 
            AND column_name = 'insurance_clearance_request_id'
        ) 
        THEN '✅ Column EXISTS' 
        ELSE '❌ Column MISSING' 
    END as verification_result;
