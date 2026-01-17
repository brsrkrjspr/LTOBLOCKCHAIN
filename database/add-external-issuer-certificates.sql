-- Migration: Create external issuer and new certificate tables
-- Date: 2026-01-18

-- external_issuers table
CREATE TABLE IF NOT EXISTS external_issuers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_type VARCHAR(20) NOT NULL CHECK (issuer_type IN ('insurance', 'emission', 'hpg')),
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

-- issued_certificates table
CREATE TABLE IF NOT EXISTS issued_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id UUID NOT NULL REFERENCES external_issuers(id) ON DELETE CASCADE,
    certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance')),
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    vehicle_vin VARCHAR(17) NOT NULL,
    owner_name VARCHAR(255),
    file_hash VARCHAR(64) NOT NULL,
    composite_hash VARCHAR(64) UNIQUE NOT NULL,
    blockchain_tx_id VARCHAR(255),
    certificate_data JSONB,
    effective_date DATE,
    expiry_date DATE,
    is_revoked BOOLEAN DEFAULT false,
    revocation_reason TEXT,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issued_certificates_issuer ON issued_certificates(issuer_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_type ON issued_certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_vin ON issued_certificates(vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_file_hash ON issued_certificates(file_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_composite_hash ON issued_certificates(composite_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_revoked ON issued_certificates(is_revoked);

-- certificate_submissions table
CREATE TABLE IF NOT EXISTS certificate_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('insurance', 'emission', 'hpg_clearance')),
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

-- Seed test issuers
INSERT INTO external_issuers (issuer_type, company_name, license_number, api_key, contact_email)
VALUES
('insurance', 'LTO Insurance Services', 'INS-2026-001', 'test_insurance_api_key_12345', 'insurance@lto.gov.ph'),
('emission', 'LTO Emission Testing Center', 'EMIT-2026-001', 'test_emission_api_key_67890', 'emission@lto.gov.ph'),
('hpg', 'PNP-HPG National Office', 'HPG-2026-001', 'test_hpg_api_key_abcde', 'hpg@pnp.gov.ph')
ON CONFLICT (license_number) DO NOTHING;

-- Verification counts
SELECT 'external_issuers' AS table_name, COUNT(*) AS count FROM external_issuers
UNION ALL
SELECT 'issued_certificates', COUNT(*) FROM issued_certificates
UNION ALL
SELECT 'certificate_submissions', COUNT(*) FROM certificate_submissions;
