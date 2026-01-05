-- TrustChain LTO - Token Blacklist Migration
-- Database-only blacklist with optimized schema (JTI as PK)

-- Token blacklist table (simplified with JTI as primary key)
CREATE TABLE IF NOT EXISTS token_blacklist (
    token_jti VARCHAR(255) PRIMARY KEY,  -- JWT ID as primary key (no UUID needed)
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) DEFAULT 'logout'
);

-- Create indexes for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);

-- Function to cleanup expired blacklist entries
CREATE OR REPLACE FUNCTION cleanup_expired_blacklist()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM token_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

