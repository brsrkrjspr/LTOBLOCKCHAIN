-- Seed data for external_issuers table
-- This is required for certificate generation to work
-- Certificates are only stored if matching active issuer exists

-- Insert insurance issuer
INSERT INTO external_issuers
    (issuer_type, company_name, license_number, api_key, is_active, contact_email, contact_phone, address)
VALUES
    (
        'insurance',
        'LTO Authorized Insurance Provider',
        'LIC-INS-2026-001',
        'insurance-api-key-' || gen_random_uuid()::text,
        true,
        'insurance@lto.gov.ph',
        '+63-2-8555-1234',
        'LTO Insurance Division, East Avenue, Quezon City, Metro Manila'
    )
ON CONFLICT (license_number) DO UPDATE
    SET is_active = true,
        updated_at = CURRENT_TIMESTAMP;

-- Insert HPG issuer
INSERT INTO external_issuers
    (issuer_type, company_name, license_number, api_key, is_active, contact_email, contact_phone, address)
VALUES
    (
        'hpg',
        'Highway Patrol Group - Philippine National Police',
        'LIC-HPG-2026-001',
        'hpg-api-key-' || gen_random_uuid()::text,
        true,
        'hpg@pnp.gov.ph',
        '+63-2-8723-0401',
        'HPG National Headquarters, Camp Crame, Quezon City'
    )
ON CONFLICT (license_number) DO UPDATE
    SET is_active = true,
        updated_at = CURRENT_TIMESTAMP;

-- Insert emission testing issuer (for future use)
INSERT INTO external_issuers
    (issuer_type, company_name, license_number, api_key, is_active, contact_email, contact_phone, address)
VALUES
    (
        'emission',
        'LTO Authorized Emission Testing Center',
        'LIC-EMI-2026-001',
        'emission-api-key-' || gen_random_uuid()::text,
        true,
        'emission@lto.gov.ph',
        '+63-2-8555-5678',
        'LTO Emission Testing Division, East Avenue, Quezon City'
    )
ON CONFLICT (license_number) DO UPDATE
    SET is_active = true,
        updated_at = CURRENT_TIMESTAMP;

-- Verify insertion
SELECT
    issuer_type,
    company_name,
    license_number,
    is_active,
    contact_email,
    created_at
FROM external_issuers
ORDER BY issuer_type;
