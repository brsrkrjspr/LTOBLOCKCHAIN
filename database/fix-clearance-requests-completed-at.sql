-- Fix: Add completed_at column to clearance_requests if it doesn't exist
-- This fixes the error: column "completed_at" of relation "clearance_requests" does not exist

ALTER TABLE clearance_requests 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN clearance_requests.completed_at IS 'Timestamp when the clearance request was completed, approved, or rejected';
