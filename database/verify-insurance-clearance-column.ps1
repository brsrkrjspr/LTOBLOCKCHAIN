# Verify insurance_clearance_request_id column exists

Write-Host "Checking if insurance_clearance_request_id column exists in transfer_requests table..." -ForegroundColor Cyan
Write-Host ""

docker exec postgres psql -U lto_user -d lto_blockchain -c @"
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
"@

Write-Host ""
Write-Host "Column details:" -ForegroundColor Yellow
docker exec postgres psql -U lto_user -d lto_blockchain -c @"
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND column_name = 'insurance_clearance_request_id';
"@

Write-Host ""
Write-Host "All insurance/clearance related columns in transfer_requests:" -ForegroundColor Yellow
docker exec postgres psql -U lto_user -d lto_blockchain -c @"
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
AND (column_name LIKE '%insurance%' OR column_name LIKE '%clearance%')
ORDER BY column_name;
"@
