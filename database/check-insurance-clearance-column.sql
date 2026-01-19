-- Check if insurance_clearance_request_id column exists in transfer_requests table

-- Method 1: Check information_schema
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transfer_requests' 
            AND column_name = 'insurance_clearance_request_id'
        ) 
        THEN '✅ Column EXISTS' 
        ELSE '❌ Column MISSING' 
    END as column_status;

-- Method 2: Try to describe the column (will error if doesn't exist)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND column_name = 'insurance_clearance_request_id';

-- Method 3: List all columns in transfer_requests that contain 'insurance' or 'clearance'
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND (column_name LIKE '%insurance%' OR column_name LIKE '%clearance%')
ORDER BY column_name;
