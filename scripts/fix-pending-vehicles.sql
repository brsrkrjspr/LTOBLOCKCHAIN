-- Fix existing vehicles stuck in PENDING_BLOCKCHAIN status
-- Change them to SUBMITTED so they appear in admin dashboard

UPDATE vehicles 
SET status = 'SUBMITTED'
WHERE status = 'PENDING_BLOCKCHAIN';

-- Verify the update
SELECT vin, plate_number, status, registration_date 
FROM vehicles 
WHERE status IN ('SUBMITTED', 'PENDING_BLOCKCHAIN')
ORDER BY registration_date DESC;

