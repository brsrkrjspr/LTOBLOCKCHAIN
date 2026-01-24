-- ============================================
-- SCHEMA FIXES FOR COMPLETE SCHEMA.SQL
-- ============================================
-- This script adds missing tables and columns required by the codebase
-- Run this AFTER importing Complete Schema.sql
-- Date: 2026-01-24

-- ============================================
-- STEP 1: Create UUID Extension (if not exists)
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 2: Add Missing external_issuers Table
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_external_issuers_api_key ON external_issuers(api_key);

-- ============================================
-- STEP 3: Add Missing certificate_submissions Table
-- ============================================
CREATE TABLE IF NOT EXISTS certificate_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance', 'csr', 'sales_invoice')),
    uploaded_file_path VARCHAR(500) NOT NULL,
    uploaded_file_hash VARCHAR(64) NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'PENDING' CHECK (verification_status IN ('VERIFIED', 'REJECTED', 'PENDING', 'EXPIRED')),
    verification_notes TEXT,
    matched_certificate_id UUID REFERENCES issued_certificates(id) ON DELETE SET NULL,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificate_submissions_vehicle ON certificate_submissions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_certificate_submissions_type ON certificate_submissions(certificate_type);
CREATE INDEX IF NOT EXISTS idx_certificate_submissions_status ON certificate_submissions(verification_status);
CREATE INDEX IF NOT EXISTS idx_certificate_submissions_file_hash ON certificate_submissions(uploaded_file_hash);

-- ============================================
-- STEP 4: Add Missing Vehicle Columns
-- ============================================
-- These columns are referenced in backend/database/services.js:createVehicle()
-- but are missing from the vehicles table schema

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(50);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS passenger_capacity INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gross_vehicle_weight DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS registration_type VARCHAR(20) DEFAULT 'Private';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS origin_type VARCHAR(20) DEFAULT 'NEW_REG';

-- ============================================
-- STEP 5: Update issued_certificates to Reference external_issuers
-- ============================================
-- The issued_certificates table has issuer_id but it references users(id)
-- For external issuers, we need to support both users and external_issuers
-- This is a design decision - keeping both references is acceptable

-- Add optional reference to external_issuers (if needed)
-- Note: issuer_id currently references users(id), which is fine for LTO-issued certificates
-- External issuers will have their own records in external_issuers table

-- ============================================
-- STEP 6: Add OR/CR Number Sequences and Columns
-- ============================================
-- These are used by the OR/CR number generation functions in services.js

-- Create sequences for OR/CR numbers
CREATE SEQUENCE IF NOT EXISTS or_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS cr_number_seq START WITH 1 INCREMENT BY 1;

-- Add OR/CR columns to vehicles table (if not exists)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS or_number VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_number VARCHAR(20);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS or_issued_at TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cr_issued_at TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS date_of_registration TIMESTAMP;

-- Create indexes for OR/CR lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_or_number ON vehicles(or_number) WHERE or_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_cr_number ON vehicles(cr_number) WHERE cr_number IS NOT NULL;

-- ============================================
-- STEP 7: Add Missing users.address Column (CRITICAL)
-- ============================================
-- This column is referenced in backend/database/services.js for user operations
-- Without it, user creation and profile updates will fail

ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);

-- ============================================
-- STEP 8: Create request_logs Table (Optional - for monitoring)
-- ============================================
-- This table is used by monitoringService.js for request analytics
-- If monitoring is not needed, this can be skipped

CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);

-- ============================================
-- STEP 9: Add Missing users Trusted Partner Columns (CRITICAL)
-- ============================================
-- These columns are referenced in backend/routes/hpg.js for trusted partner verification
-- Without them, HPG clearance requests will fail when checking trusted partner status

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trusted_partner BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trusted_partner_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_users_trusted_partner ON users(is_trusted_partner) WHERE is_trusted_partner = TRUE;

-- ============================================
-- STEP 10: Add Missing vehicles Scrapped Columns (CRITICAL)
-- ============================================
-- These columns are referenced in backend/routes/lto.js for vehicle scrapping
-- Without them, vehicle scrapping functionality will fail

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS scrapped_at TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS scrap_reason TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS scrapped_by UUID REFERENCES users(id);

-- ============================================
-- STEP 11: Add Missing vehicle_status Enum Values (CRITICAL)
-- ============================================
-- These enum values are referenced in backend/routes/lto.js for vehicle status updates
-- Without them, setting vehicle status to 'SCRAPPED' or 'FOR_TRANSFER' will fail
-- NOTE: Must be done BEFORE creating index with WHERE status = 'SCRAPPED'

DO $$ 
BEGIN
    -- Add 'SCRAPPED' enum value if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SCRAPPED' 
        AND enumtypid = 'vehicle_status'::regtype
    ) THEN
        ALTER TYPE vehicle_status ADD VALUE 'SCRAPPED';
    END IF;
    
    -- Add 'FOR_TRANSFER' enum value if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'FOR_TRANSFER' 
        AND enumtypid = 'vehicle_status'::regtype
    ) THEN
        ALTER TYPE vehicle_status ADD VALUE 'FOR_TRANSFER';
    END IF;
END $$;

-- Create index for scrapped vehicles (AFTER enum values are added)
CREATE INDEX IF NOT EXISTS idx_vehicles_scrapped ON vehicles(scrapped_at) WHERE status = 'SCRAPPED';

-- ============================================
-- STEP 12: Add Missing clearance_requests.verification_mode Column (Optional)
-- ============================================
-- This column is referenced in backend/migrations/add-verification-mode.sql
-- It's optional - add if verification mode tracking is needed

ALTER TABLE clearance_requests ADD COLUMN IF NOT EXISTS verification_mode VARCHAR(20) DEFAULT 'MANUAL'
CHECK (verification_mode IN ('MANUAL', 'AUTOMATIC', 'FAST_TRACK'));

-- ============================================
-- STEP 13: Add Missing transfer_requests Columns (CRITICAL)
-- ============================================
-- These columns are referenced in backend/database/services.js:createTransferRequest()
-- Without them, transfer request creation will fail

ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ============================================
-- STEP 14: Seed Default External Issuers (Optional)
-- ============================================
-- Only insert if they don't exist
INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, contact_email, is_active)
SELECT 'insurance', 'LTO Insurance Services', 'INS-2026-001', 'test_insurance_api_key_12345', 'insurance@lto.gov.ph', true
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'insurance' AND license_number = 'INS-2026-001');

INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, contact_email, is_active)
SELECT 'emission', 'LTO Emission Testing Center', 'EMIT-2026-001', 'test_emission_api_key_67890', 'emission@lto.gov.ph', true
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'emission' AND license_number = 'EMIT-2026-001');

INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, contact_email, is_active)
SELECT 'hpg', 'PNP-HPG National Office', 'HPG-2026-001', 'test_hpg_api_key_abcde', 'hpg@lto.gov.ph', true
WHERE NOT EXISTS (SELECT 1 FROM external_issuers WHERE issuer_type = 'hpg' AND license_number = 'HPG-2026-001');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the fixes:

-- SELECT 'external_issuers' AS table_name, COUNT(*) AS count FROM external_issuers
-- UNION ALL
-- SELECT 'certificate_submissions', COUNT(*) FROM certificate_submissions
-- UNION ALL
-- SELECT 'vehicles with vehicle_category', COUNT(*) FROM vehicles WHERE vehicle_category IS NOT NULL;

-- Verify columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'vehicles' 
-- AND column_name IN ('vehicle_category', 'passenger_capacity', 'gross_vehicle_weight', 'net_weight', 'registration_type', 'origin_type', 'or_number', 'cr_number', 'or_issued_at', 'cr_issued_at', 'date_of_registration');

-- Verify users.address column exists:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name = 'address';

-- Verify request_logs table exists (optional):
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'request_logs';

-- Verify users trusted partner columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name IN ('is_trusted_partner', 'trusted_partner_type')
-- ORDER BY column_name;

-- Verify vehicles scrapped columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'vehicles' 
-- AND column_name IN ('scrapped_at', 'scrap_reason', 'scrapped_by')
-- ORDER BY column_name;

-- Verify vehicle_status enum values exist:
-- SELECT enumlabel 
-- FROM pg_enum 
-- WHERE enumtypid = 'vehicle_status'::regtype 
-- ORDER BY enumsortorder;

-- Verify clearance_requests.verification_mode column exists (optional):
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'clearance_requests' 
-- AND column_name = 'verification_mode';

-- Verify transfer_requests.expires_at and remarks columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'transfer_requests' 
-- AND column_name IN ('expires_at', 'remarks')
-- ORDER BY column_name;
