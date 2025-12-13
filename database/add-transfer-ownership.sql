-- TrustChain LTO - Transfer of Ownership Database Schema
-- Adds support for transfer requests, documents, and verifications

-- Create transfer_requests table
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL, -- Current owner
    buyer_id UUID REFERENCES users(id), -- New owner (can be null if buyer is new user)
    buyer_info JSONB, -- Store buyer information if buyer is not yet a user (name, email, phone, address, id_type, id_number)
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FORWARDED_TO_HPG')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id), -- Admin who reviewed
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    forwarded_to_hpg BOOLEAN DEFAULT false,
    hpg_clearance_request_id UUID REFERENCES clearance_requests(id), -- If forwarded to HPG
    metadata JSONB DEFAULT '{}', -- Additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transfer_requests
CREATE INDEX IF NOT EXISTS idx_transfer_vehicle ON transfer_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transfer_seller ON transfer_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_transfer_buyer ON transfer_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_submitted_at ON transfer_requests(submitted_at);
CREATE INDEX IF NOT EXISTS idx_transfer_reviewed_by ON transfer_requests(reviewed_by);

-- Create transfer_documents table
CREATE TABLE IF NOT EXISTS transfer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL, -- Link to documents table
    uploaded_by UUID REFERENCES users(id) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create indexes for transfer_documents
CREATE INDEX IF NOT EXISTS idx_transfer_docs_request ON transfer_documents(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_docs_type ON transfer_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_transfer_docs_document ON transfer_documents(document_id);

-- Create transfer_verifications table
CREATE TABLE IF NOT EXISTS transfer_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'REJECTED', 'PENDING')),
    notes TEXT,
    checklist JSONB DEFAULT '{}', -- Store checklist items (document_clear, info_present, signatures_valid, dates_valid, matches_request)
    flagged BOOLEAN DEFAULT false, -- Flag for suspicious documents
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transfer_verifications
CREATE INDEX IF NOT EXISTS idx_transfer_verif_request ON transfer_verifications(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_document ON transfer_verifications(document_id);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_status ON transfer_verifications(status);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_verified_by ON transfer_verifications(verified_by);

-- Add trigger to update updated_at timestamp for transfer_requests
CREATE OR REPLACE FUNCTION update_transfer_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_transfer_requests_updated_at
BEFORE UPDATE ON transfer_requests
FOR EACH ROW
EXECUTE FUNCTION update_transfer_requests_updated_at();

-- Add comments for documentation
COMMENT ON TABLE transfer_requests IS 'Tracks vehicle ownership transfer requests from sellers to buyers';
COMMENT ON TABLE transfer_documents IS 'Links documents to transfer requests (Deed of Sale, IDs, OR/CR)';
COMMENT ON TABLE transfer_verifications IS 'Stores document verification records for transfer requests';
COMMENT ON COLUMN transfer_requests.buyer_info IS 'JSONB storing buyer information if buyer is not yet a system user';
COMMENT ON COLUMN transfer_requests.status IS 'Status: PENDING, REVIEWING, APPROVED, REJECTED, COMPLETED, FORWARDED_TO_HPG';
COMMENT ON COLUMN transfer_verifications.checklist IS 'JSONB storing verification checklist items';

