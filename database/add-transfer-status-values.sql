-- TrustChain LTO - Add Transfer Status Values to vehicle_status Enum
-- This migration adds TRANSFER_IN_PROGRESS and TRANSFER_COMPLETED to the vehicle_status enum
-- Required for Phase 3 transfer workflow

-- ============================================
-- STEP 1: Add TRANSFER_IN_PROGRESS if it doesn't exist
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'TRANSFER_IN_PROGRESS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vehicle_status')
    ) THEN
        ALTER TYPE vehicle_status ADD VALUE 'TRANSFER_IN_PROGRESS';
        RAISE NOTICE 'Added TRANSFER_IN_PROGRESS to vehicle_status enum';
    ELSE
        RAISE NOTICE 'TRANSFER_IN_PROGRESS already exists in vehicle_status enum';
    END IF;
END $$;

-- ============================================
-- STEP 2: Add TRANSFER_COMPLETED if it doesn't exist
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'TRANSFER_COMPLETED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vehicle_status')
    ) THEN
        ALTER TYPE vehicle_status ADD VALUE 'TRANSFER_COMPLETED';
        RAISE NOTICE 'Added TRANSFER_COMPLETED to vehicle_status enum';
    ELSE
        RAISE NOTICE 'TRANSFER_COMPLETED already exists in vehicle_status enum';
    END IF;
END $$;

-- ============================================
-- STEP 3: Add PROCESSING if it doesn't exist (for consistency)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PROCESSING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vehicle_status')
    ) THEN
        ALTER TYPE vehicle_status ADD VALUE 'PROCESSING';
        RAISE NOTICE 'Added PROCESSING to vehicle_status enum';
    ELSE
        RAISE NOTICE 'PROCESSING already exists in vehicle_status enum';
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify enum values exist
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vehicle_status') ORDER BY enumsortorder;

COMMENT ON TYPE vehicle_status IS 'Vehicle status enum: SUBMITTED, PENDING_BLOCKCHAIN, REGISTERED, APPROVED, REJECTED, SUSPENDED, SCRAPPED, FOR_TRANSFER, TRANSFER_IN_PROGRESS, TRANSFER_COMPLETED, PROCESSING';
