-- Add PENDING_BLOCKCHAIN status to vehicle_status enum
-- This status is used when vehicle registration is pending blockchain confirmation

-- Add the new enum value
ALTER TYPE vehicle_status ADD VALUE IF NOT EXISTS 'PENDING_BLOCKCHAIN';

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'vehicle_status'::regtype 
ORDER BY enumsortorder;

