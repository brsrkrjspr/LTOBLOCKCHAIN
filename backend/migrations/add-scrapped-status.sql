-- Add SCRAPPED and FOR_TRANSFER status to vehicle_status enum
-- SCRAPPED: Vehicle is permanently retired/totaled
-- FOR_TRANSFER: Vehicle ownership transfer in progress

-- Add the new enum values
ALTER TYPE vehicle_status ADD VALUE IF NOT EXISTS 'SCRAPPED';
ALTER TYPE vehicle_status ADD VALUE IF NOT EXISTS 'FOR_TRANSFER';

-- Add column to track scrap reason and date
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS scrapped_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS scrap_reason TEXT,
ADD COLUMN IF NOT EXISTS scrapped_by UUID REFERENCES users(id);

-- Create index for scrapped vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_scrapped ON vehicles(scrapped_at) WHERE status = 'SCRAPPED';

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'vehicle_status'::regtype 
ORDER BY enumsortorder;

