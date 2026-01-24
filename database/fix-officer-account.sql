-- Quick Fix: Create LTO Officer Account (handles employee_id conflict)
-- Run this if the main script failed to create ltoofficer@lto.gov.ph

DO $$
BEGIN
    -- If account already exists, update it
    IF EXISTS (SELECT 1 FROM users WHERE email = 'ltoofficer@lto.gov.ph') THEN
        UPDATE users 
        SET 
            password_hash = '$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6',
            role = 'lto_officer',
            organization = 'Land Transportation Office',
            is_active = true,
            email_verified = true,
            employee_id = 'LTO-OFF-001',
            badge_number = 'OFF-001',
            department = 'Vehicle Registration',
            branch_office = 'LTO Manila Central',
            position = 'Registration Officer',
            first_name = 'Juan',
            last_name = 'Dela Cruz'
        WHERE email = 'ltoofficer@lto.gov.ph';
        
        RAISE NOTICE 'Updated existing ltoofficer@lto.gov.ph account';
    ELSE
        -- Clear employee_id from conflicting account if it exists
        IF EXISTS (SELECT 1 FROM users WHERE employee_id = 'LTO-OFF-001') THEN
            UPDATE users 
            SET employee_id = NULL 
            WHERE employee_id = 'LTO-OFF-001';
            
            RAISE NOTICE 'Cleared LTO-OFF-001 from conflicting account';
        END IF;
        
        -- Create the officer account
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
            'ltoofficer@lto.gov.ph',
            '$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6', -- admin123
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
        );
        
        RAISE NOTICE 'Created ltoofficer@lto.gov.ph account';
    END IF;
END $$;

-- Verify the account was created
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
WHERE email = 'ltoofficer@lto.gov.ph';
