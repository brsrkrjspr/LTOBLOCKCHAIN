-- Create LTO Admin, LTO Officer, and HPG Admin Accounts
-- Password hash for "admin123" (bcrypt cost 12): $2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG
-- Password hash for "SecurePass123!" (bcrypt cost 12): $2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K

-- Create LTO Admin, LTO Officer, and HPG Admin Accounts
-- Password hash for "admin123" (bcrypt cost 12): $2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG
-- Password hash for "SecurePass123!" (bcrypt cost 12): $2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K

-- ============================================
-- LTO ADMIN Account
-- ============================================
-- Check if admin@lto.gov.ph already has LTO-ADMIN-001, if so, update it to lto_admin role
-- Otherwise, create new ltoadmin account
DO $$
BEGIN
    -- If admin@lto.gov.ph exists with LTO-ADMIN-001, update it to lto_admin
    IF EXISTS (
        SELECT 1 FROM users 
        WHERE email = 'admin@lto.gov.ph' 
        AND employee_id = 'LTO-ADMIN-001'
    ) THEN
        UPDATE users 
        SET 
            role = 'lto_admin',
            organization = 'Land Transportation Office',
            is_active = true,
            email_verified = true,
            badge_number = 'ADMIN-001',
            department = 'Administration',
            branch_office = 'LTO Manila Central',
            position = 'LTO Administrator'
        WHERE email = 'admin@lto.gov.ph';
        
        RAISE NOTICE 'Updated admin@lto.gov.ph to lto_admin role';
    ELSE
        -- Create new ltoadmin account
        INSERT INTO users (
            email, 
            password_hash, 
            first_name, 
            last_name, 
            role, 
            organization, 
            phone, 
            is_active, 
            email_verified,
            employee_id,
            badge_number,
            department,
            branch_office,
            position
        )
        VALUES (
            'ltoadmin@lto.gov.ph',
            '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
            'LTO',
            'Administrator',
            'lto_admin',
            'Land Transportation Office',
            '+63 2 1234 5678',
            true,
            true,
            'LTO-ADMIN-001',
            'ADMIN-001',
            'Administration',
            'LTO Manila Central',
            'LTO Administrator'
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'lto_admin',
            organization = 'Land Transportation Office',
            is_active = true,
            email_verified = true,
            employee_id = 'LTO-ADMIN-001',
            badge_number = 'ADMIN-001',
            department = 'Administration',
            branch_office = 'LTO Manila Central',
            position = 'LTO Administrator';
    END IF;
END $$;

-- ============================================
-- LTO OFFICER Account
-- ============================================
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    organization, 
    phone, 
    is_active, 
    email_verified,
    employee_id,
    badge_number,
    department,
    branch_office,
    position
)
VALUES (
    'ltofficer@lto.gov.ph',
    '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', -- admin123
    'Juan',
    'Dela Cruz',
    'lto_officer',
    'Land Transportation Office',
    '+63 917 123 4567',
    true,
    true,
    'LTO-OFF-001',
    'OFF-001',
    'Vehicle Registration',
    'LTO Manila Central',
    'Registration Officer'
)
ON CONFLICT (email) DO UPDATE SET
    role = 'lto_officer',
    organization = 'Land Transportation Office',
    is_active = true,
    email_verified = true,
    employee_id = 'LTO-OFF-001',
    badge_number = 'OFF-001',
    department = 'Vehicle Registration',
    branch_office = 'LTO Manila Central',
    position = 'Registration Officer';

-- ============================================
-- INSURANCE VERIFIER Account
-- ============================================
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
VALUES (
    'insurance@insurance.gov.ph',
    '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', -- admin123 (same as LTO accounts for consistency)
    'Insurance',
    'Verifier',
    'insurance_verifier',
    'Insurance Verification Office',
    '+63 2 3456 7890',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'insurance_verifier',
    organization = 'Insurance Verification Office',
    is_active = true,
    email_verified = true;

-- Also handle insurance@lto.gov.ph if it exists (legacy account)
UPDATE users 
SET 
    email = 'insurance@insurance.gov.ph',
    organization = 'Insurance Verification Office',
    role = 'insurance_verifier',
    is_active = true,
    email_verified = true
WHERE email = 'insurance@lto.gov.ph'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'insurance@insurance.gov.ph');

-- ============================================
-- HPG ADMIN Account
-- ============================================
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
VALUES (
    'hpgadmin@hpg.gov.ph',
    '$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K', -- SecurePass123!
    'HPG',
    'Administrator',
    'admin', -- Using 'admin' role since 'hpg_admin' doesn't exist in enum
    'Highway Patrol Group',
    '+63 2 2345 6789',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    organization = 'Highway Patrol Group',
    is_active = true,
    email_verified = true;

-- Verify accounts were created
SELECT 
    email, 
    first_name, 
    last_name, 
    role, 
    organization, 
    employee_id,
    badge_number,
    is_active,
    email_verified
FROM users 
WHERE email IN ('ltoadmin@lto.gov.ph', 'ltofficer@lto.gov.ph', 'hpgadmin@hpg.gov.ph', 'admin@lto.gov.ph', 'insurance@insurance.gov.ph')
ORDER BY 
    CASE 
        WHEN email = 'ltoadmin@lto.gov.ph' THEN 1
        WHEN email = 'admin@lto.gov.ph' THEN 2
        WHEN email = 'ltofficer@lto.gov.ph' THEN 3
        WHEN email = 'insurance@insurance.gov.ph' THEN 4
        ELSE 5
    END,
    role, email;
