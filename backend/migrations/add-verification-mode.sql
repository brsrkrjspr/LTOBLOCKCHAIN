-- Add verification mode for automatic vs manual processing
ALTER TABLE clearance_requests
ADD COLUMN IF NOT EXISTS verification_mode VARCHAR(20) DEFAULT 'MANUAL'
CHECK (verification_mode IN ('MANUAL', 'AUTOMATIC', 'FAST_TRACK'));

-- Add trusted_partner flag for automatic clearance eligibility
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_trusted_partner BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trusted_partner_type VARCHAR(50); -- 'DEALER', 'MANUFACTURER', etc. 

-- Index for fast-track eligibility queries
CREATE INDEX IF NOT EXISTS idx_users_trusted_partner ON users(is_trusted_partner) WHERE is_trusted_partner = TRUE;

