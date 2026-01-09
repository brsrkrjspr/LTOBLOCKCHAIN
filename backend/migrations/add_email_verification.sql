-- TrustChain LTO - Email Verification Tokens Schema
-- Adds support for magic link email verification

-- Step 1: Add email_verified column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
        
        -- Set existing users to verified (backward compatibility)
        -- You can change this to FALSE if you want to force existing users to verify
        UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL;
        
        RAISE NOTICE 'Added email_verified column to users table';
    ELSE
        RAISE NOTICE 'email_verified column already exists';
    END IF;
END $$;

-- Step 2: Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_secret VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    used_by_ip INET
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_used_at ON email_verification_tokens(used_at);

-- Create cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger to auto-cleanup on insert (lightweight approach)
-- This runs cleanup when a new token is inserted (every 10+ registrations)
CREATE OR REPLACE FUNCTION auto_cleanup_old_tokens()
RETURNS TRIGGER AS $$
BEGIN
    -- Run cleanup function occasionally (every ~50 inserts would be ~1/50 = 2%)
    IF RANDOM() < 0.02 THEN
        DELETE FROM email_verification_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
        OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF NOT EXISTS trigger_cleanup_verification_tokens ON email_verification_tokens;

-- Create trigger
CREATE TRIGGER trigger_cleanup_verification_tokens
AFTER INSERT ON email_verification_tokens
FOR EACH ROW
EXECUTE FUNCTION auto_cleanup_old_tokens();
