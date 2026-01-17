-- Migration: Add Blockchain Fields to Certificates Table
-- Purpose: Support blockchain-based certificate verification and tracking
-- Date: 2026-01-13

-- Add new columns to certificates table
ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS composite_hash VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS blockchain_tx_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS application_status VARCHAR(20) DEFAULT 'PENDING' CHECK (application_status IN ('PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;

-- Update status column CHECK constraint to include new statuses
-- First, drop the existing constraint if it exists
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;

-- Add new constraint with additional statuses
ALTER TABLE certificates 
ADD CONSTRAINT certificates_status_check 
CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED', 'ISSUED', 'APPROVED', 'REJECTED'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_certificates_file_hash ON certificates(file_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_composite_hash ON certificates(composite_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_blockchain_tx_id ON certificates(blockchain_tx_id);
CREATE INDEX IF NOT EXISTS idx_certificates_application_status ON certificates(application_status);
CREATE INDEX IF NOT EXISTS idx_certificates_document_id ON certificates(document_id);
CREATE INDEX IF NOT EXISTS idx_certificates_verified_by ON certificates(verified_by);

-- Create trigger function to auto-update certificate status based on vehicle application status
CREATE OR REPLACE FUNCTION update_certificate_application_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When vehicle status changes to REJECTED, revoke all related certificates
    IF NEW.status = 'REJECTED' AND (OLD.status IS NULL OR OLD.status != 'REJECTED') THEN
        UPDATE certificates
        SET 
            application_status = 'REJECTED',
            status = 'REVOKED',
            revoked_at = CURRENT_TIMESTAMP,
            revocation_reason = 'Vehicle application rejected'
        WHERE vehicle_id = NEW.id
        AND application_status = 'PENDING'
        AND status IN ('ISSUED', 'APPROVED');
        
        RETURN NEW;
    END IF;
    
    -- When vehicle status changes to APPROVED or REGISTERED, approve certificates
    IF NEW.status IN ('APPROVED', 'REGISTERED') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED', 'REGISTERED')) THEN
        UPDATE certificates
        SET 
            application_status = 'APPROVED',
            status = CASE 
                WHEN status = 'ISSUED' THEN 'APPROVED'
                ELSE status
            END,
            verified_at = CURRENT_TIMESTAMP,
            verified_by = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
        WHERE vehicle_id = NEW.id
        AND application_status = 'PENDING'
        AND status = 'ISSUED';
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on vehicles table
DROP TRIGGER IF EXISTS trigger_update_certificate_application_status ON vehicles;
CREATE TRIGGER trigger_update_certificate_application_status
AFTER UPDATE OF status ON vehicles
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION update_certificate_application_status();

-- Add comment to table
COMMENT ON COLUMN certificates.file_hash IS 'SHA-256 hash of the certificate PDF file';
COMMENT ON COLUMN certificates.composite_hash IS 'Composite hash (certNumber+VIN+expiry+fileHash) for unique verification';
COMMENT ON COLUMN certificates.blockchain_tx_id IS 'Hyperledger Fabric transaction ID where hash is stored';
COMMENT ON COLUMN certificates.application_status IS 'Status linked to vehicle application: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN certificates.document_id IS 'Reference to documents table for the certificate PDF';

-- Verify migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully';
    RAISE NOTICE 'New columns added: file_hash, composite_hash, blockchain_tx_id, application_status, document_id, verified_at, verified_by, revocation_reason, revoked_at';
    RAISE NOTICE 'Indexes created for all new columns';
    RAISE NOTICE 'Trigger created: trigger_update_certificate_application_status';
END $$;
