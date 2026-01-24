-- Verify Database Schema for Account Creation Script
-- Run this BEFORE running create-lto-admin-officer-accounts.sql

-- ============================================
-- CHECK 1: Verify users table exists
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Table "users" does not exist. Run migrations first.';
    ELSE
        RAISE NOTICE '✅ Table "users" exists';
    END IF;
END $$;

-- ============================================
-- CHECK 2: Verify all required columns exist
-- ============================================
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    required_columns TEXT[] := ARRAY[
        'email', 'password_hash', 'first_name', 'last_name', 'role', 
        'organization', 'phone', 'is_active', 'email_verified',
        'employee_id', 'badge_number', 'department', 'branch_office', 'position'
    ];
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Missing columns in users table: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All required columns exist';
    END IF;
END $$;

-- ============================================
-- CHECK 3: Verify user_role enum includes required roles
-- ============================================
DO $$
DECLARE
    missing_roles TEXT[] := ARRAY[]::TEXT[];
    required_roles TEXT[] := ARRAY['lto_admin', 'lto_officer', 'admin', 'insurance_verifier'];
    role_val TEXT;
BEGIN
    FOREACH role_val IN ARRAY required_roles
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = role_val 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        ) THEN
            missing_roles := array_append(missing_roles, role_val);
        END IF;
    END LOOP;
    
    IF array_length(missing_roles, 1) > 0 THEN
        RAISE EXCEPTION 'Missing roles in user_role enum: %', array_to_string(missing_roles, ', ');
    ELSE
        RAISE NOTICE '✅ All required roles exist in user_role enum';
    END IF;
END $$;

-- ============================================
-- CHECK 4: Verify constraints (employee_id unique)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_name = 'users_employee_id_key'
        AND constraint_type = 'UNIQUE'
    ) THEN
        RAISE NOTICE '⚠️  Warning: Unique constraint on employee_id not found (may cause conflicts)';
    ELSE
        RAISE NOTICE '✅ Unique constraint on employee_id exists';
    END IF;
END $$;

-- ============================================
-- CHECK 5: Check for existing accounts that might conflict
-- ============================================
SELECT 
    'Existing accounts check' as check_type,
    COUNT(*) FILTER (WHERE email = 'ltoadmin@lto.gov.ph') as ltoadmin_exists,
    COUNT(*) FILTER (WHERE email = 'ltoofficer@lto.gov.ph') as ltoofficer_exists,
    COUNT(*) FILTER (WHERE email = 'hpg@hpg.gov.ph') as hpg_exists,
    COUNT(*) FILTER (WHERE email = 'insurance@insurance.gov.ph') as insurance_exists,
    COUNT(*) FILTER (WHERE employee_id = 'LTO-ADMIN-001') as admin_emp_id_exists,
    COUNT(*) FILTER (WHERE employee_id = 'LTO-OFF-001') as officer_emp_id_exists
FROM users
WHERE email IN ('ltoadmin@lto.gov.ph', 'ltoofficer@lto.gov.ph', 'hpg@hpg.gov.ph', 'insurance@insurance.gov.ph')
   OR employee_id IN ('LTO-ADMIN-001', 'LTO-OFF-001');

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
    'Schema Verification Complete' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
        THEN '✅ Users table exists'
        ELSE '❌ Users table missing'
    END as table_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'employee_id'
        ) 
        THEN '✅ All columns exist'
        ELSE '❌ Some columns missing'
    END as columns_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'lto_admin' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        ) 
        THEN '✅ All roles exist'
        ELSE '❌ Some roles missing'
    END as roles_status;
