-- Verify the updated CHECK constraint
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'transfer_documents_document_type_check';
