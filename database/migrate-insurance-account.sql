-- Migrate legacy insurance account to new email
-- This handles the transition from insurance@lto.gov.ph to insurance@insurance.gov.ph

-- Step 1: Create the new account if it doesn't exist
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    organization, 
    phone, 
    is_active, 
    email_verified
)
SELECT 
    'insurance@insurance.gov.ph',
    password_hash,  -- Keep existing password
    first_name,
    last_name,
    'insurance_verifier',
    'Insurance Verification Office',
    phone,
    is_active,
    email_verified
FROM users
WHERE email = 'insurance@lto.gov.ph'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'insurance@insurance.gov.ph')
ON CONFLICT (email) DO NOTHING;

-- Step 2: Delete the legacy account after migration
DELETE FROM users 
WHERE email = 'insurance@lto.gov.ph'
AND EXISTS (SELECT 1 FROM users WHERE email = 'insurance@insurance.gov.ph');

-- Step 3: Verify migration
SELECT 
    email, 
    role, 
    organization, 
    is_active,
    email_verified
FROM users 
WHERE email IN ('insurance@insurance.gov.ph', 'insurance@lto.gov.ph')
ORDER BY email;
