-- Migration: Full Registration Workflow + Transfer of Ownership
-- Date: 2026-01-21
-- Description:
--   Creates/patches database objects required for:
--   - Vehicle registration workflow (documents, verification metadata, inspection/MVIR fields, requirements config)
--   - External clearance workflow (clearance requests + certificates)
--   - Transfer of ownership workflow (transfer requests + documents + verifications + approval tracking)
--
-- Notes:
--   - Designed to be idempotent (safe to re-run).
--   - PostgreSQL target (uses uuid-ossp + plpgsql).
--   - Does not insert business data beyond structural defaults.
--
-- Prerequisites:
--   - Base tables `users`, `vehicles`, `documents`, `vehicle_verifications` should already exist.
--   - `uuid-ossp` extension is enabled below if missing.

BEGIN;

-- ============================================
-- STEP 0: Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: Registration document requirements (config-driven)
-- ============================================

CREATE TABLE IF NOT EXISTS registration_document_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_type VARCHAR(50) NOT NULL, -- 'NEW', 'TRANSFER', 'RENEWAL'
    vehicle_category VARCHAR(50) DEFAULT 'ALL',
    document_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT true,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    accepted_formats VARCHAR(100) DEFAULT 'pdf,jpg,jpeg,png',
    max_file_size_mb INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(registration_type, vehicle_category, document_type)
);

CREATE INDEX IF NOT EXISTS idx_doc_requirements_type_category
ON registration_document_requirements(registration_type, vehicle_category, is_active);

CREATE OR REPLACE FUNCTION update_document_requirements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_document_requirements_updated_at ON registration_document_requirements;
CREATE TRIGGER trigger_update_document_requirements_updated_at
    BEFORE UPDATE ON registration_document_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_document_requirements_updated_at();

COMMENT ON TABLE registration_document_requirements IS 'Admin-configurable required/optional documents per registration workflow';

-- ============================================
-- STEP 2: Clearance workflow (external org requests + certificates)
-- ============================================

CREATE TABLE IF NOT EXISTS clearance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('hpg', 'insurance', 'emission')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED')),
    requested_by UUID REFERENCES users(id) NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_to UUID REFERENCES users(id),
    completed_at TIMESTAMP,
    certificate_id UUID, -- FK added below after certificates exists
    purpose VARCHAR(255),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clearance_vehicle ON clearance_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_clearance_type ON clearance_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_clearance_status ON clearance_requests(status);
CREATE INDEX IF NOT EXISTS idx_clearance_assigned ON clearance_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clearance_requested_by ON clearance_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_clearance_created_at ON clearance_requests(created_at);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clearance_request_id UUID REFERENCES clearance_requests(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('hpg_clearance', 'insurance', 'emission')),
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    file_path VARCHAR(500),
    ipfs_cid VARCHAR(255),
    issued_by UUID REFERENCES users(id) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Hashing / blockchain traceability
    file_hash VARCHAR(255),
    composite_hash VARCHAR(255),
    blockchain_tx_id VARCHAR(255),
    application_status VARCHAR(50) DEFAULT 'PENDING',
    -- Link back to stored document and verification
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    -- Revocation support
    revocation_reason TEXT,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificates_request ON certificates(clearance_request_id);
CREATE INDEX IF NOT EXISTS idx_certificates_vehicle ON certificates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_by ON certificates(issued_by);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_clearance_certificate'
          AND table_name = 'clearance_requests'
    ) THEN
        ALTER TABLE clearance_requests
        ADD CONSTRAINT fk_clearance_certificate
        FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_clearance_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_clearance_requests_updated_at ON clearance_requests;
CREATE TRIGGER trigger_update_clearance_requests_updated_at
BEFORE UPDATE ON clearance_requests
FOR EACH ROW
EXECUTE FUNCTION update_clearance_requests_updated_at();

COMMENT ON TABLE clearance_requests IS 'Tracks external clearances (HPG, Insurance, Emission) used by registration and transfers';
COMMENT ON TABLE certificates IS 'Stores issued clearance certificates and their metadata';

-- Ensure legacy deployments gain new certificate columns (idempotent backfill)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS file_hash VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS composite_hash VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS blockchain_tx_id VARCHAR(255);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS application_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_certificates_file_hash ON certificates(file_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_composite_hash ON certificates(composite_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_blockchain_tx_id ON certificates(blockchain_tx_id);
CREATE INDEX IF NOT EXISTS idx_certificates_application_status ON certificates(application_status);
CREATE INDEX IF NOT EXISTS idx_certificates_document_id ON certificates(document_id);
CREATE INDEX IF NOT EXISTS idx_certificates_verified_by ON certificates(verified_by);

-- ============================================
-- STEP 2.1: Issued certificates snapshot (for external issuers / audits)
-- ============================================

CREATE TABLE IF NOT EXISTS issued_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issuer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    certificate_type VARCHAR(50) NOT NULL,
    certificate_number VARCHAR(100) NOT NULL,
    vehicle_vin VARCHAR(50) NOT NULL,
    owner_name VARCHAR(255),
    owner_id VARCHAR(255),
    file_hash VARCHAR(255) NOT NULL,
    composite_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    blockchain_tx_id VARCHAR(255),
    is_revoked BOOLEAN DEFAULT false,
    revocation_reason TEXT,
    revoked_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(certificate_number),
    UNIQUE(file_hash),
    UNIQUE(composite_hash)
);

CREATE INDEX IF NOT EXISTS idx_issued_certificates_type ON issued_certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_vin ON issued_certificates(vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_issuer ON issued_certificates(issuer_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_blockchain_tx ON issued_certificates(blockchain_tx_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_revoked ON issued_certificates(is_revoked);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_file_hash ON issued_certificates(file_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_composite_hash ON issued_certificates(composite_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_number ON issued_certificates(certificate_number);

-- Link vehicle_verifications to clearance_requests when applicable
ALTER TABLE vehicle_verifications
ADD COLUMN IF NOT EXISTS clearance_request_id UUID REFERENCES clearance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verifications_clearance_request
ON vehicle_verifications(clearance_request_id);

-- ============================================
-- STEP 3: Transfer of ownership workflow (requests + docs + verifications)
-- ============================================
--
-- IMPORTANT: OR/CR EXEMPTION FOR TRANSFERS
-- Latest OR/CR is NOT required for transfer request submission by seller.
-- Every registered vehicle already has OR/CR linked in the vehicles table.
-- When transfer is completed, a new OR/CR will be automatically generated
-- for the new owner using the registration certificate generator.
--
-- OR/CR AUTO-INCLUSION:
-- Although sellers don't upload OR/CR, the system automatically compiles/includes
-- OR/CR from vehicle records when:
-- - Viewing transfer request details (admin/buyer/seller)
-- - Forwarding transfer to HPG for clearance
-- - Generating transfer application packages
-- - Any other transfer application compilation
--
-- This ensures OR/CR is always available with transfer applications since
-- vehicle and OR/CR are linked in the system.
--

CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL,
    buyer_id UUID REFERENCES users(id),
    buyer_info JSONB,
    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FORWARDED_TO_HPG')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    forwarded_to_hpg BOOLEAN DEFAULT false,
    hpg_clearance_request_id UUID REFERENCES clearance_requests(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_vehicle ON transfer_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transfer_seller ON transfer_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_transfer_buyer ON transfer_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_submitted_at ON transfer_requests(submitted_at);
CREATE INDEX IF NOT EXISTS idx_transfer_reviewed_by ON transfer_requests(reviewed_by);

CREATE TABLE IF NOT EXISTS transfer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(30) NOT NULL
        CHECK (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfer_docs_request ON transfer_documents(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_docs_type ON transfer_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_transfer_docs_document ON transfer_documents(document_id);

CREATE TABLE IF NOT EXISTS transfer_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'REJECTED', 'PENDING')),
    notes TEXT,
    checklist JSONB DEFAULT '{}',
    flagged BOOLEAN DEFAULT false,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_verif_request ON transfer_verifications(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_document ON transfer_verifications(document_id);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_status ON transfer_verifications(status);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_verified_by ON transfer_verifications(verified_by);

CREATE OR REPLACE FUNCTION update_transfer_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_transfer_requests_updated_at ON transfer_requests;
CREATE TRIGGER trigger_update_transfer_requests_updated_at
BEFORE UPDATE ON transfer_requests
FOR EACH ROW
EXECUTE FUNCTION update_transfer_requests_updated_at();

COMMENT ON TABLE transfer_requests IS 'Tracks vehicle ownership transfer requests from seller to buyer';
COMMENT ON TABLE transfer_documents IS 'Maps uploaded documents (Deed of Sale, IDs, OR/CR) to a transfer request';
COMMENT ON TABLE transfer_verifications IS 'Verification/audit records for documents in a transfer request';

-- Approval tracking and clearance links used by multi-org transfer workflow
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transfer_requests' AND column_name = 'insurance_clearance_request_id'
    ) THEN
        ALTER TABLE transfer_requests
        ADD COLUMN insurance_clearance_request_id UUID REFERENCES clearance_requests(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transfer_requests' AND column_name = 'emission_clearance_request_id'
    ) THEN
        ALTER TABLE transfer_requests
        ADD COLUMN emission_clearance_request_id UUID REFERENCES clearance_requests(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transfer_requests' AND column_name = 'insurance_approval_status'
    ) THEN
        ALTER TABLE transfer_requests
        ADD COLUMN insurance_approval_status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (insurance_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transfer_requests' AND column_name = 'emission_approval_status'
    ) THEN
        ALTER TABLE transfer_requests
        ADD COLUMN emission_approval_status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (emission_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transfer_requests' AND column_name = 'hpg_approval_status'
    ) THEN
        ALTER TABLE transfer_requests
        ADD COLUMN hpg_approval_status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (hpg_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS insurance_approved_at TIMESTAMP;
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS emission_approved_at TIMESTAMP;
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS hpg_approved_at TIMESTAMP;
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS insurance_approved_by UUID REFERENCES users(id);
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS emission_approved_by UUID REFERENCES users(id);
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS hpg_approved_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_transfer_insurance_approval ON transfer_requests(insurance_approval_status);
CREATE INDEX IF NOT EXISTS idx_transfer_emission_approval ON transfer_requests(emission_approval_status);
CREATE INDEX IF NOT EXISTS idx_transfer_hpg_approval ON transfer_requests(hpg_approval_status);

-- ============================================
-- STEP 4: Registration workflow inspection/MVIR fields
-- ============================================

CREATE SEQUENCE IF NOT EXISTS mvir_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS mvir_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspection_result VARCHAR(20), -- 'PASS', 'FAIL', 'PENDING'
ADD COLUMN IF NOT EXISTS roadworthiness_status VARCHAR(20), -- 'ROADWORTHY', 'NOT_ROADWORTHY'
ADD COLUMN IF NOT EXISTS emission_compliance VARCHAR(20), -- 'COMPLIANT', 'NON_COMPLIANT'
ADD COLUMN IF NOT EXISTS inspection_officer VARCHAR(100),
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS inspection_documents JSONB; -- Stores file references

CREATE INDEX IF NOT EXISTS idx_vehicles_mvir ON vehicles(mvir_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_date ON vehicles(inspection_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_result ON vehicles(inspection_result);

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50); -- 'MVIR', 'PHOTO', 'OTHER'

CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);

-- ============================================
-- STEP 5: Verification workflow metadata (automated scoring)
-- ============================================

ALTER TABLE vehicle_verifications
ADD COLUMN IF NOT EXISTS automated BOOLEAN DEFAULT false;

ALTER TABLE vehicle_verifications
ADD COLUMN IF NOT EXISTS verification_score INTEGER;

ALTER TABLE vehicle_verifications
ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}';

ALTER TABLE vehicle_verifications
ADD COLUMN IF NOT EXISTS auto_verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_verifications_automated
ON vehicle_verifications(automated, status);

COMMIT;

