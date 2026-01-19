#!/bin/bash
# Verify insurance_clearance_request_id column exists

echo "Checking if insurance_clearance_request_id column exists in transfer_requests table..."
echo ""

docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transfer_requests' 
            AND column_name = 'insurance_clearance_request_id'
        ) 
        THEN '✅ Column EXISTS' 
        ELSE '❌ Column MISSING - Run migration: database/verify-verification-columns.sql' 
    END as column_status;
"

echo ""
echo "Column details:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND column_name = 'insurance_clearance_request_id';
"

echo ""
echo "All insurance/clearance related columns in transfer_requests:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND (column_name LIKE '%insurance%' OR column_name LIKE '%clearance%')
ORDER BY column_name;
"
