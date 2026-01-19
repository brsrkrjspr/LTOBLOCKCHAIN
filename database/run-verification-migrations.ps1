# TrustChain LTO - Run Verification Column Migrations (PowerShell)
# Ensures all required columns exist for Insurance, Emission, and HPG workflows

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Verification Column Migration Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Database connection details
$DB_CONTAINER = "postgres"
$DB_USER = "lto_user"
$DB_NAME = "lto_blockchain"

Write-Host ""
Write-Host "Step 1: Checking current column status..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Check vehicle_verifications auto-verification columns
Write-Host "Checking vehicle_verifications auto-verification columns..." -ForegroundColor Gray
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c @"
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_verifications' AND column_name = 'automated') 
         THEN '✅ automated' ELSE '❌ automated MISSING' END as automated,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_verifications' AND column_name = 'verification_score') 
         THEN '✅ verification_score' ELSE '❌ verification_score MISSING' END as verification_score,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_verifications' AND column_name = 'verification_metadata') 
         THEN '✅ verification_metadata' ELSE '❌ verification_metadata MISSING' END as verification_metadata,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_verifications' AND column_name = 'auto_verified_at') 
         THEN '✅ auto_verified_at' ELSE '❌ auto_verified_at MISSING' END as auto_verified_at;
"@

# Check transfer_requests approval columns
Write-Host ""
Write-Host "Checking transfer_requests approval columns..." -ForegroundColor Gray
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c @"
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_requests' AND column_name = 'insurance_approval_status') 
         THEN '✅ insurance_approval_status' ELSE '❌ insurance_approval_status MISSING' END as insurance_approval_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_requests' AND column_name = 'emission_approval_status') 
         THEN '✅ emission_approval_status' ELSE '❌ emission_approval_status MISSING' END as emission_approval_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_requests' AND column_name = 'hpg_approval_status') 
         THEN '✅ hpg_approval_status' ELSE '❌ hpg_approval_status MISSING' END as hpg_approval_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_requests' AND column_name = 'insurance_clearance_request_id') 
         THEN '✅ insurance_clearance_request_id' ELSE '❌ insurance_clearance_request_id MISSING' END as insurance_clearance_request_id,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_requests' AND column_name = 'emission_clearance_request_id') 
         THEN '✅ emission_clearance_request_id' ELSE '❌ emission_clearance_request_id MISSING' END as emission_clearance_request_id;
"@

# Check clearance_requests completed_at
Write-Host ""
Write-Host "Checking clearance_requests.completed_at..." -ForegroundColor Gray
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c @"
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clearance_requests' AND column_name = 'completed_at') 
         THEN '✅ completed_at' ELSE '❌ completed_at MISSING' END as completed_at;
"@

Write-Host ""
Write-Host "Step 2: Running verification and migration script..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Run the verification script
if (Test-Path "database\verify-verification-columns.sql") {
    Get-Content "database\verify-verification-columns.sql" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
    Write-Host "✅ Migration script executed" -ForegroundColor Green
} else {
    Write-Host "❌ Migration script not found: database\verify-verification-columns.sql" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Verifying all columns now exist..." -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Final verification
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c @"
SELECT 
    'vehicle_verifications' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'automated') as has_automated,
    COUNT(*) FILTER (WHERE column_name = 'verification_score') as has_verification_score,
    COUNT(*) FILTER (WHERE column_name = 'verification_metadata') as has_verification_metadata,
    COUNT(*) FILTER (WHERE column_name = 'auto_verified_at') as has_auto_verified_at
FROM information_schema.columns
WHERE table_name = 'vehicle_verifications'
AND column_name IN ('automated', 'verification_score', 'verification_metadata', 'auto_verified_at')

UNION ALL

SELECT 
    'transfer_requests' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'insurance_approval_status') as has_insurance_approval_status,
    COUNT(*) FILTER (WHERE column_name = 'emission_approval_status') as has_emission_approval_status,
    COUNT(*) FILTER (WHERE column_name = 'hpg_approval_status') as has_hpg_approval_status,
    COUNT(*) FILTER (WHERE column_name = 'insurance_clearance_request_id') as has_insurance_clearance_request_id
FROM information_schema.columns
WHERE table_name = 'transfer_requests'
AND column_name IN ('insurance_approval_status', 'emission_approval_status', 'hpg_approval_status', 'insurance_clearance_request_id');
"@

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
