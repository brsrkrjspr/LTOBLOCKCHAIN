-- Check current CHECK constraint on transfer_documents table
-- Run this to see what constraint values are currently allowed

SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%transfer_document%' 
   OR constraint_name LIKE '%document_type%'
ORDER BY constraint_name;

-- Also check if the table exists and its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transfer_documents'
ORDER BY ordinal_position;

-- Check what document_type values are currently in use
SELECT DISTINCT document_type, COUNT(*) as count
FROM transfer_documents
GROUP BY document_type
ORDER BY document_type;
