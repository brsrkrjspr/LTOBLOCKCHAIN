-- ============================================
-- ROLLBACK: RESTORE EMISSION COLUMNS
-- ============================================
-- Purpose: Rollback script to restore emission columns if needed
-- Use only if migration needs to be reversed
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Restore emission columns in transfer_requests table
-- ============================================

-- Restore emission_clearance_request_id
ALTER TABLE transfer_requests 
ADD COLUMN IF NOT EXISTS emission_clearance_request_id UUID REFERENCES clearance_requests(id);

-- Restore emission_approval_status
ALTER TABLE transfer_requests 
ADD COLUMN IF NOT EXISTS emission_approval_status VARCHAR(20) DEFAULT 'PENDING';

-- Restore emission_approved_at
ALTER TABLE transfer_requests 
ADD COLUMN IF NOT EXISTS emission_approved_at TIMESTAMP;

-- Restore emission_approved_by
ALTER TABLE transfer_requests 
ADD COLUMN IF NOT EXISTS emission_approved_by UUID REFERENCES users(id);

-- ============================================
-- STEP 2: Restore emission_compliance in vehicles table
-- ============================================

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS emission_compliance VARCHAR(20);

COMMIT;

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================
