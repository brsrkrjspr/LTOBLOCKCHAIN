-- TrustChain LTO - Verify Required Columns for Verification Workflows
-- This script checks if all required columns exist and adds them if missing

-- ============================================
-- 1. Verify vehicle_verifications table columns
-- ============================================

-- Check and add automated column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicle_verifications' 
        AND column_name = 'automated'
    ) THEN
        ALTER TABLE vehicle_verifications 
        ADD COLUMN automated BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added column: vehicle_verifications.automated';
    END IF;
END $$;

-- Check and add verification_score column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicle_verifications' 
        AND column_name = 'verification_score'
    ) THEN
        ALTER TABLE vehicle_verifications 
        ADD COLUMN verification_score INTEGER;
        RAISE NOTICE 'Added column: vehicle_verifications.verification_score';
    END IF;
END $$;

-- Check and add verification_metadata column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicle_verifications' 
        AND column_name = 'verification_metadata'
    ) THEN
        ALTER TABLE vehicle_verifications 
        ADD COLUMN verification_metadata JSONB DEFAULT '{}';
        RAISE NOTICE 'Added column: vehicle_verifications.verification_metadata';
    END IF;
END $$;

-- Check and add auto_verified_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicle_verifications' 
        AND column_name = 'auto_verified_at'
    ) THEN
        ALTER TABLE vehicle_verifications 
        ADD COLUMN auto_verified_at TIMESTAMP;
        RAISE NOTICE 'Added column: vehicle_verifications.auto_verified_at';
    END IF;
END $$;

-- Create index for automated verifications if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_verifications_automated 
ON vehicle_verifications(automated, status);

-- ============================================
-- 2. Verify transfer_requests table columns
-- ============================================

-- Check and add insurance_clearance_request_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'insurance_clearance_request_id'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN insurance_clearance_request_id UUID REFERENCES clearance_requests(id);
        RAISE NOTICE 'Added column: transfer_requests.insurance_clearance_request_id';
    END IF;
END $$;

-- Check and add emission_clearance_request_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_clearance_request_id'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN emission_clearance_request_id UUID REFERENCES clearance_requests(id);
        RAISE NOTICE 'Added column: transfer_requests.emission_clearance_request_id';
    END IF;
END $$;

-- Check and add insurance_approval_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'insurance_approval_status'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN insurance_approval_status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (insurance_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
        RAISE NOTICE 'Added column: transfer_requests.insurance_approval_status';
    END IF;
END $$;

-- Check and add emission_approval_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_approval_status'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN emission_approval_status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (emission_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
        RAISE NOTICE 'Added column: transfer_requests.emission_approval_status';
    END IF;
END $$;

-- Check and add hpg_approval_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'hpg_approval_status'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN hpg_approval_status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (hpg_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
        RAISE NOTICE 'Added column: transfer_requests.hpg_approval_status';
    END IF;
END $$;

-- Check and add insurance_approved_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'insurance_approved_at'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN insurance_approved_at TIMESTAMP;
        RAISE NOTICE 'Added column: transfer_requests.insurance_approved_at';
    END IF;
END $$;

-- Check and add emission_approved_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_approved_at'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN emission_approved_at TIMESTAMP;
        RAISE NOTICE 'Added column: transfer_requests.emission_approved_at';
    END IF;
END $$;

-- Check and add hpg_approved_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'hpg_approved_at'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN hpg_approved_at TIMESTAMP;
        RAISE NOTICE 'Added column: transfer_requests.hpg_approved_at';
    END IF;
END $$;

-- Check and add insurance_approved_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'insurance_approved_by'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN insurance_approved_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added column: transfer_requests.insurance_approved_by';
    END IF;
END $$;

-- Check and add emission_approved_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'emission_approved_by'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN emission_approved_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added column: transfer_requests.emission_approved_by';
    END IF;
END $$;

-- Check and add hpg_approved_by
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transfer_requests' 
        AND column_name = 'hpg_approved_by'
    ) THEN
        ALTER TABLE transfer_requests 
        ADD COLUMN hpg_approved_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added column: transfer_requests.hpg_approved_by';
    END IF;
END $$;

-- Create indexes for approval status queries
CREATE INDEX IF NOT EXISTS idx_transfer_insurance_approval 
ON transfer_requests(insurance_approval_status);

CREATE INDEX IF NOT EXISTS idx_transfer_emission_approval 
ON transfer_requests(emission_approval_status);

CREATE INDEX IF NOT EXISTS idx_transfer_hpg_approval 
ON transfer_requests(hpg_approval_status);

-- ============================================
-- 3. Verify clearance_requests table columns
-- ============================================

-- Check and add completed_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clearance_requests' 
        AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE clearance_requests 
        ADD COLUMN completed_at TIMESTAMP;
        RAISE NOTICE 'Added column: clearance_requests.completed_at';
    END IF;
END $$;

-- ============================================
-- 4. Verification Summary
-- ============================================

-- Display verification summary
SELECT 
    'vehicle_verifications' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'automated') as has_automated,
    COUNT(*) FILTER (WHERE column_name = 'verification_score') as has_verification_score,
    COUNT(*) FILTER (WHERE column_name = 'verification_metadata') as has_verification_metadata,
    COUNT(*) FILTER (WHERE column_name = 'auto_verified_at') as has_auto_verified_at
FROM information_schema.columns
WHERE table_name = 'vehicle_verifications'
AND column_name IN ('automated', 'verification_score', 'verification_metadata', 'auto_verified_at')

UNION ALL

SELECT 
    'transfer_requests' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'insurance_approval_status') as has_insurance_approval_status,
    COUNT(*) FILTER (WHERE column_name = 'emission_approval_status') as has_emission_approval_status,
    COUNT(*) FILTER (WHERE column_name = 'hpg_approval_status') as has_hpg_approval_status,
    COUNT(*) FILTER (WHERE column_name = 'insurance_clearance_request_id') as has_insurance_clearance_request_id
FROM information_schema.columns
WHERE table_name = 'transfer_requests'
AND column_name IN ('insurance_approval_status', 'emission_approval_status', 'hpg_approval_status', 'insurance_clearance_request_id')

UNION ALL

SELECT 
    'clearance_requests' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'completed_at') as has_completed_at,
    0 as placeholder2,
    0 as placeholder3,
    0 as placeholder4
FROM information_schema.columns
WHERE table_name = 'clearance_requests'
AND column_name = 'completed_at';
