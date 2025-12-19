-- TrustChain LTO - Multi-Organization Approval for Transfer Requests
-- Adds approval tracking for HPG, Insurance, and Emission organizations

-- Add organization approval columns to transfer_requests table
ALTER TABLE transfer_requests 
ADD COLUMN IF NOT EXISTS hpg_approval_status VARCHAR(20) DEFAULT 'PENDING' CHECK (hpg_approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS insurance_approval_status VARCHAR(20) DEFAULT 'PENDING' CHECK (insurance_approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS emission_approval_status VARCHAR(20) DEFAULT 'PENDING' CHECK (emission_approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS hpg_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS insurance_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS emission_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS hpg_approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS insurance_approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS emission_approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS insurance_clearance_request_id UUID REFERENCES clearance_requests(id),
ADD COLUMN IF NOT EXISTS emission_clearance_request_id UUID REFERENCES clearance_requests(id);

-- Create indexes for organization approval queries
CREATE INDEX IF NOT EXISTS idx_transfer_hpg_approval ON transfer_requests(hpg_approval_status);
CREATE INDEX IF NOT EXISTS idx_transfer_insurance_approval ON transfer_requests(insurance_approval_status);
CREATE INDEX IF NOT EXISTS idx_transfer_emission_approval ON transfer_requests(emission_approval_status);

-- Add comments
COMMENT ON COLUMN transfer_requests.hpg_approval_status IS 'HPG organization approval status: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN transfer_requests.insurance_approval_status IS 'Insurance organization approval status: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN transfer_requests.emission_approval_status IS 'Emission organization approval status: PENDING, APPROVED, REJECTED';
