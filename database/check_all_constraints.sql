-- Check all constraints on transfer_documents table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'transfer_documents'
ORDER BY tc.constraint_type, tc.constraint_name;

-- Also check the constraint name specifically
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%transfer%' 
   OR constraint_name LIKE '%document%'
ORDER BY constraint_name;
