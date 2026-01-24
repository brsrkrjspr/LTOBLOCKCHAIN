-- Change lto_admin role to admin for admin@lto.gov.ph
-- This fixes the role mismatch issue where backend routes only accept 'admin' role

-- ============================================
-- Update admin@lto.gov.ph from lto_admin to admin
-- ============================================
UPDATE users 
SET 
    role = 'admin',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@lto.gov.ph'
AND role = 'lto_admin';

-- Verify the change
SELECT 
    email, 
    role, 
    employee_id,
    organization,
    is_active,
    updated_at
FROM users 
WHERE email = 'admin@lto.gov.ph';

-- Also check if there are any other lto_admin accounts that should be changed
-- (Uncomment the following if you want to change ALL lto_admin to admin)
-- UPDATE users 
-- SET 
--     role = 'admin',
--     updated_at = CURRENT_TIMESTAMP
-- WHERE role = 'lto_admin'
-- AND email LIKE '%@lto.gov.ph';

-- Show all admin accounts after update
SELECT 
    email, 
    first_name,
    last_name,
    role, 
    organization,
    employee_id,
    is_active
FROM users 
WHERE role IN ('admin', 'lto_admin')
ORDER BY role, email;
