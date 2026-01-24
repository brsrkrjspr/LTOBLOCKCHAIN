-- Fix Foreign Key Constraint for issued_certificates.issuer_id
-- Date: 2026-01-24
-- Issue: Foreign key references users(id) but code uses external_issuers(id)
-- Fix: Drop old constraint and add new one referencing external_issuers(id)

-- Step 1: Drop the existing foreign key constraint (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'issued_certificates_issuer_id_fkey' 
        AND table_name = 'issued_certificates'
    ) THEN
        ALTER TABLE issued_certificates 
        DROP CONSTRAINT issued_certificates_issuer_id_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint issued_certificates_issuer_id_fkey';
    END IF;
END $$;

-- Step 2: Ensure external_issuers table exists (if not already created)
CREATE TABLE IF NOT EXISTS external_issuers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_type VARCHAR(20) NOT NULL CHECK (issuer_type IN ('insurance', 'emission', 'hpg', 'csr', 'sales_invoice')),
    company_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_external_issuers_type ON external_issuers(issuer_type);
CREATE INDEX IF NOT EXISTS idx_external_issuers_active ON external_issuers(is_active);

-- Step 3: Add new foreign key constraint referencing external_issuers
ALTER TABLE issued_certificates
ADD CONSTRAINT issued_certificates_issuer_id_fkey 
FOREIGN KEY (issuer_id) REFERENCES external_issuers(id) ON DELETE SET NULL;

-- Step 4: Ensure issuer_id column allows NULL (for cases where no issuer found)
ALTER TABLE issued_certificates 
ALTER COLUMN issuer_id DROP NOT NULL;

-- Step 5: Create default external issuers if they don't exist (for testing/development)
INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, is_active, contact_email)
SELECT 'insurance', 'Default Insurance Company', 'INS-001-DEFAULT', 'default-insurance-api-key', true, 'insurance@default.com'
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'insurance' AND is_active = true);

INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, is_active, contact_email)
SELECT 'hpg', 'Highway Patrol Group', 'HPG-001-DEFAULT', 'default-hpg-api-key', true, 'hpg@default.com'
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'hpg' AND is_active = true);

INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, is_active, contact_email)
SELECT 'csr', 'Default CSR Issuer', 'CSR-001-DEFAULT', 'default-csr-api-key', true, 'csr@default.com'
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'csr' AND is_active = true);

INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, is_active, contact_email)
SELECT 'sales_invoice', 'Default Sales Invoice Issuer', 'SALES-001-DEFAULT', 'default-sales-api-key', true, 'sales@default.com'
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'sales_invoice' AND is_active = true);

COMMENT ON CONSTRAINT issued_certificates_issuer_id_fkey ON issued_certificates IS 
'Foreign key to external_issuers table. Changed from users table to match code implementation.';
