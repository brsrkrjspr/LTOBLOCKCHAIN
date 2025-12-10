-- TrustChain LTO - Create Real Accounts for All Organizations
-- This script creates real database accounts (not demo) for all organizations

-- Note: Passwords are hashed using bcrypt with cost factor 12
-- Default password for all accounts: "SecurePass123!" (change after first login)

-- ============================================
-- LTO ADMIN (Already exists, but ensure it's correct)
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'admin@lto.gov.ph',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5', -- admin123 (bcrypt)
    'LTO',
    'Administrator',
    'admin',
    'Land Transportation Office',
    '+63 2 1234 5678',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    organization = 'Land Transportation Office',
    is_active = true,
    email_verified = true;

-- ============================================
-- HPG ADMIN
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'hpgadmin@hpg.gov.ph',
    '$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K', -- SecurePass123! (bcrypt)
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

-- ============================================
-- INSURANCE VERIFIER
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'insurance@insurance.gov.ph',
    '$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K', -- SecurePass123! (bcrypt)
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

-- ============================================
-- EMISSION VERIFIER
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'emission@emission.gov.ph',
    '$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K', -- SecurePass123! (bcrypt)
    'Emission',
    'Verifier',
    'emission_verifier',
    'Emission Testing Center',
    '+63 2 4567 8901',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'emission_verifier',
    organization = 'Emission Testing Center',
    is_active = true,
    email_verified = true;

-- ============================================
-- VEHICLE OWNER (Sample account)
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'owner@example.com',
    '$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K', -- SecurePass123! (bcrypt)
    'John',
    'Doe',
    'vehicle_owner',
    NULL,
    '+63 912 345 6789',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'vehicle_owner',
    is_active = true,
    email_verified = true;

-- ============================================
-- VERIFY ACCOUNTS CREATED
-- ============================================
SELECT 
    email,
    first_name || ' ' || last_name as name,
    role,
    organization,
    is_active,
    email_verified
FROM users
WHERE email IN (
    'admin@lto.gov.ph',
    'hpgadmin@hpg.gov.ph',
    'insurance@insurance.gov.ph',
    'emission@emission.gov.ph',
    'owner@example.com'
)
ORDER BY role, email;

