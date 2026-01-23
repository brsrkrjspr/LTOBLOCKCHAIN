-- Verify the updated CHECK constraint
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'transfer_documents_document_type_check';

-- Also check what document_type values are currently allowed
-- (Parse the check_clause to see the values)
