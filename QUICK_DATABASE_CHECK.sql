-- Quick Database Check Queries
-- Run these in psql to verify your database state

-- ============================================
-- 1. Check ENUM Values (MOST IMPORTANT)
-- ============================================
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') 
ORDER BY enumsortorder;

-- Expected: Should show 8 values including deed_of_sale, seller_id, buyer_id, other
-- If only 4 values shown, run: database/add-new-document-types.sql

-- ============================================
-- 2. Check transfer_requests Table Columns
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
ORDER BY ordinal_position;

-- ============================================
-- 3. Count All Data
-- ============================================
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'transfer_requests', COUNT(*) FROM transfer_requests
UNION ALL
SELECT 'transfer_documents', COUNT(*) FROM transfer_documents
ORDER BY count DESC;

-- ============================================
-- 4. Documents with IPFS
-- ============================================
SELECT 
    COUNT(*) as total_documents,
    COUNT(CASE WHEN ipfs_cid IS NOT NULL THEN 1 END) as with_ipfs,
    COUNT(CASE WHEN ipfs_cid IS NULL THEN 1 END) as without_ipfs
FROM documents;

-- ============================================
-- 5. Documents by Type
-- ============================================
SELECT document_type, COUNT(*) as count 
FROM documents 
GROUP BY document_type 
ORDER BY count DESC;

-- ============================================
-- 6. Check transfer_requests (use correct column)
-- ============================================
-- Try this first (if submitted_at exists):
SELECT id, vehicle_id, seller_id, buyer_id, status, submitted_at 
FROM transfer_requests 
ORDER BY submitted_at DESC 
LIMIT 10;

-- If that fails, use this (if only created_at exists):
SELECT id, vehicle_id, seller_id, buyer_id, status, created_at 
FROM transfer_requests 
ORDER BY created_at DESC 
LIMIT 10;
