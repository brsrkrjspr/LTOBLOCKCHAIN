-- TrustChain LTO - Auto-Verification Metadata Schema
-- Adds support for tracking automated verification results

-- Add automated verification metadata to vehicle_verifications table
ALTER TABLE vehicle_verifications 
ADD COLUMN IF NOT EXISTS automated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_score INTEGER,
ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_verified_at TIMESTAMP;

-- Add index for automated verifications
CREATE INDEX IF NOT EXISTS idx_verifications_automated 
ON vehicle_verifications(automated, status);

-- Add comments for documentation
COMMENT ON COLUMN vehicle_verifications.automated IS 'Indicates if verification was performed automatically';
COMMENT ON COLUMN vehicle_verifications.verification_score IS 'Verification score (0-100) calculated from automated checks';
COMMENT ON COLUMN vehicle_verifications.verification_metadata IS 'Stores detailed verification results including OCR data, database checks, fraud scores, etc.';
COMMENT ON COLUMN vehicle_verifications.auto_verified_at IS 'Timestamp when automated verification was performed';
