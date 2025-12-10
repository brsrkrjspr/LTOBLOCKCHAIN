-- TrustChain LTO - Clearance Workflow Database Schema
-- Adds support for clearance requests and certificates

-- Create clearance_requests table
CREATE TABLE IF NOT EXISTS clearance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('hpg', 'insurance', 'emission')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED')),
    requested_by UUID REFERENCES users(id) NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_to UUID REFERENCES users(id), -- HPG/Insurance/Emission verifier
    completed_at TIMESTAMP,
    certificate_id UUID, -- Will reference certificates table after it's created
    purpose VARCHAR(255), -- Purpose of clearance request
    notes TEXT,
    metadata JSONB DEFAULT '{}', -- Store additional data (engine number, chassis number, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for clearance_requests
CREATE INDEX IF NOT EXISTS idx_clearance_vehicle ON clearance_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_clearance_type ON clearance_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_clearance_status ON clearance_requests(status);
CREATE INDEX IF NOT EXISTS idx_clearance_assigned ON clearance_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clearance_requested_by ON clearance_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_clearance_created_at ON clearance_requests(created_at);

-- Create certificates table
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clearance_request_id UUID REFERENCES clearance_requests(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('hpg_clearance', 'insurance', 'emission')),
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    file_path VARCHAR(500),
    ipfs_cid VARCHAR(255), -- IPFS CID if stored on IPFS
    issued_by UUID REFERENCES users(id) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for certificates
CREATE INDEX IF NOT EXISTS idx_certificates_request ON certificates(clearance_request_id);
CREATE INDEX IF NOT EXISTS idx_certificates_vehicle ON certificates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_by ON certificates(issued_by);

-- Add foreign key constraint for certificate_id in clearance_requests
-- (We'll add this after certificates table exists)
ALTER TABLE clearance_requests 
ADD CONSTRAINT fk_clearance_certificate 
FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE SET NULL;

-- Add clearance_request_id to vehicle_verifications table
ALTER TABLE vehicle_verifications 
ADD COLUMN IF NOT EXISTS clearance_request_id UUID REFERENCES clearance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verifications_clearance_request ON vehicle_verifications(clearance_request_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clearance_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clearance_requests_updated_at
BEFORE UPDATE ON clearance_requests
FOR EACH ROW
EXECUTE FUNCTION update_clearance_requests_updated_at();

-- Add comments for documentation
COMMENT ON TABLE clearance_requests IS 'Tracks clearance requests sent to external organizations (HPG, Insurance, Emission)';
COMMENT ON TABLE certificates IS 'Stores certificates issued by external organizations';
COMMENT ON COLUMN clearance_requests.request_type IS 'Type of clearance: hpg, insurance, or emission';
COMMENT ON COLUMN clearance_requests.status IS 'Status of the clearance request';
COMMENT ON COLUMN clearance_requests.metadata IS 'Additional data like engine number, chassis number, inspection photos, etc.';
COMMENT ON COLUMN certificates.certificate_type IS 'Type of certificate: hpg_clearance, insurance, or emission';
COMMENT ON COLUMN certificates.ipfs_cid IS 'IPFS Content ID if certificate is stored on IPFS';

