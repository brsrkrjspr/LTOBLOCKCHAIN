-- Migration: Add Sales Invoice certificate support
-- Date: 2026-01-XX
-- Description: Updates database constraints to allow 'sales_invoice' as a valid certificate type

-- ============================================
-- STEP 1: Update external_issuers issuer_type constraint
-- ============================================

ALTER TABLE external_issuers 
DROP CONSTRAINT IF EXISTS external_issuers_issuer_type_check;

ALTER TABLE external_issuers 
ADD CONSTRAINT external_issuers_issuer_type_check 
CHECK (issuer_type IN ('insurance', 'emission', 'hpg', 'csr', 'sales_invoice'));

-- ============================================
-- STEP 2: Update issued_certificates certificate_type constraint
-- ============================================

ALTER TABLE issued_certificates 
DROP CONSTRAINT IF EXISTS issued_certificates_certificate_type_check;

ALTER TABLE issued_certificates 
ADD CONSTRAINT issued_certificates_certificate_type_check 
CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'));

-- ============================================
-- STEP 3: Update certificate_submissions certificate_type constraint
-- ============================================

ALTER TABLE certificate_submissions 
DROP CONSTRAINT IF EXISTS certificate_submissions_certificate_type_check;

ALTER TABLE certificate_submissions 
ADD CONSTRAINT certificate_submissions_certificate_type_check 
CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice'));

-- ============================================
-- STEP 4: Update certificates table certificate_type constraint (if table exists)
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'certificates') THEN
        ALTER TABLE certificates 
        DROP CONSTRAINT IF EXISTS certificates_certificate_type_check;

        ALTER TABLE certificates 
        ADD CONSTRAINT certificates_certificate_type_check 
        CHECK (certificate_type IN ('hpg_clearance', 'insurance', 'emission', 'csr', 'sales_invoice'));
        
        RAISE NOTICE 'Updated certificates table constraint';
    ELSE
        RAISE NOTICE 'certificates table does not exist, skipping';
    END IF;
END $$;

-- ============================================
-- STEP 5: Create index for sales invoice lookups (optional but recommended)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_issued_certificates_sales_invoice 
ON issued_certificates(certificate_type, vehicle_vin) 
WHERE certificate_type = 'sales_invoice';

-- ============================================
-- STEP 6: Seed test issuer for sales invoice (optional)
-- ============================================

INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, contact_email)
VALUES ('sales_invoice', 'LTO Sales Invoice Service', 'SI-2026-001', 'test_sales_invoice_api_key_xyz', 'sales@lto.gov.ph')
ON CONFLICT (license_number) DO NOTHING;

-- ============================================
-- Verification: Check constraints
-- ============================================

-- Verify external_issuers constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'external_issuers'::regclass
AND conname = 'external_issuers_issuer_type_check';

-- Verify issued_certificates constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'issued_certificates'::regclass
AND conname = 'issued_certificates_certificate_type_check';

-- Verify certificate_submissions constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'certificate_submissions'::regclass
AND conname = 'certificate_submissions_certificate_type_check';

-- Success message
SELECT 'Sales Invoice certificate support has been successfully added to the database.' AS status;
