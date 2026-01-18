-- Diagnostic SQL queries to check vehicle documents
-- Vehicle ID: df1db102-2eb7-42d1-b622-454300a5c943
-- Owner ID: 21d31b9a-ed8e-42a4-994c-1e3f947fd9b8

-- 1. Check all documents currently linked to this vehicle
SELECT 
    d.id,
    d.document_type,
    d.original_name,
    d.filename,
    d.uploaded_at,
    d.vehicle_id,
    d.uploaded_by,
    u.email as uploader_email,
    u.first_name || ' ' || u.last_name as uploader_name
FROM documents d
LEFT JOIN users u ON d.uploaded_by = u.id
WHERE d.vehicle_id = 'df1db102-2eb7-42d1-b622-454300a5c943'
ORDER BY d.uploaded_at DESC;

-- 2. Check for unlinked documents uploaded around the same time (within 5 minutes)
SELECT 
    d.id,
    d.document_type,
    d.original_name,
    d.filename,
    d.uploaded_at,
    d.vehicle_id,
    d.uploaded_by,
    u.email as uploader_email,
    u.first_name || ' ' || u.last_name as uploader_name,
    CASE 
        WHEN d.vehicle_id IS NULL THEN 'UNLINKED'
        ELSE 'LINKED'
    END as status
FROM documents d
LEFT JOIN users u ON d.uploaded_by = u.id
WHERE d.uploaded_at BETWEEN '2026-01-18 12:28:00' AND '2026-01-18 12:31:00'
ORDER BY d.uploaded_at DESC;

-- 3. Check all documents uploaded by this owner (regardless of vehicle)
SELECT 
    d.id,
    d.document_type,
    d.original_name,
    d.filename,
    d.uploaded_at,
    d.vehicle_id,
    CASE 
        WHEN d.vehicle_id IS NULL THEN 'UNLINKED'
        WHEN d.vehicle_id = 'df1db102-2eb7-42d1-b622-454300a5c943' THEN 'LINKED_TO_THIS_VEHICLE'
        ELSE 'LINKED_TO_OTHER_VEHICLE'
    END as status
FROM documents d
WHERE d.uploaded_by = '21d31b9a-ed8e-42a4-994c-1e3f947fd9b8'
ORDER BY d.uploaded_at DESC;

-- 4. Check document_type enum values to verify all types exist
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'document_type'
ORDER BY e.enumsortorder;

-- 5. Count documents by type for this vehicle
SELECT 
    d.document_type,
    COUNT(*) as count
FROM documents d
WHERE d.vehicle_id = 'df1db102-2eb7-42d1-b622-454300a5c943'
GROUP BY d.document_type
ORDER BY d.document_type;

-- 6. Check for documents with missing types that might need to be linked
SELECT 
    d.id,
    d.document_type,
    d.original_name,
    d.filename,
    d.uploaded_at,
    d.vehicle_id,
    d.uploaded_by
FROM documents d
WHERE d.vehicle_id IS NULL
  AND d.document_type IN ('csr', 'hpg_clearance', 'sales_invoice')
  AND d.uploaded_at BETWEEN '2026-01-18 12:28:00' AND '2026-01-18 12:31:00'
ORDER BY d.uploaded_at DESC;
