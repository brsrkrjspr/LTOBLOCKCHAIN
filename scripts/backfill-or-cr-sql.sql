-- Backfill OR/CR Numbers for Existing Vehicles
-- This SQL script assigns OR/CR numbers to vehicles that were approved/registered
-- before the OR/CR generation feature was implemented.

-- Step 1: Check which vehicles need OR/CR numbers
SELECT 
    id, 
    vin, 
    plate_number, 
    status, 
    registration_date, 
    or_cr_number,
    COUNT(*) OVER() as total_count
FROM vehicles
WHERE status IN ('APPROVED', 'REGISTERED')
AND (or_cr_number IS NULL OR or_cr_number = '')
ORDER BY COALESCE(registration_date, last_updated) ASC;

-- Step 2: Assign OR/CR numbers to vehicles without them
-- This uses a CTE to generate sequential numbers per year
WITH vehicles_to_update AS (
    SELECT 
        id,
        vin,
        plate_number,
        status,
        EXTRACT(YEAR FROM COALESCE(registration_date, last_updated, CURRENT_TIMESTAMP))::INTEGER as year,
        ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM COALESCE(registration_date, last_updated, CURRENT_TIMESTAMP))::INTEGER 
            ORDER BY COALESCE(registration_date, last_updated) ASC
        ) as seq_num
    FROM vehicles
    WHERE status IN ('APPROVED', 'REGISTERED')
    AND (or_cr_number IS NULL OR or_cr_number = '')
),
max_sequences AS (
    -- Get the maximum sequence number for each year from existing OR/CR numbers
    SELECT 
        EXTRACT(YEAR FROM COALESCE(registration_date, last_updated, CURRENT_TIMESTAMP))::INTEGER as year,
        COALESCE(MAX(CAST(SPLIT_PART(or_cr_number, '-', 3) AS INTEGER)), 0) as max_seq
    FROM vehicles
    WHERE or_cr_number IS NOT NULL 
    AND or_cr_number LIKE 'ORCR-%'
    GROUP BY EXTRACT(YEAR FROM COALESCE(registration_date, last_updated, CURRENT_TIMESTAMP))::INTEGER
)
UPDATE vehicles v
SET 
    or_cr_number = 'ORCR-' || vtu.year || '-' || LPAD((COALESCE(ms.max_seq, 0) + vtu.seq_num)::TEXT, 6, '0'),
    or_cr_issued_at = CURRENT_TIMESTAMP,
    last_updated = CURRENT_TIMESTAMP
FROM vehicles_to_update vtu
LEFT JOIN max_sequences ms ON vtu.year = ms.year
WHERE v.id = vtu.id
RETURNING 
    v.id,
    v.vin,
    v.plate_number,
    v.or_cr_number,
    v.or_cr_issued_at;

-- Step 3: Update the sequence to start after the highest assigned number
DO $$
DECLARE
    max_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SPLIT_PART(or_cr_number, '-', 3) AS INTEGER)), 0) + 1
    INTO max_seq
    FROM vehicles
    WHERE or_cr_number IS NOT NULL 
    AND or_cr_number LIKE 'ORCR-%';
    
    IF max_seq > 1 THEN
        EXECUTE 'ALTER SEQUENCE or_cr_number_seq RESTART WITH ' || max_seq;
        RAISE NOTICE 'Sequence updated to start at %', max_seq;
    END IF;
END $$;

-- Step 4: Verify the backfill
SELECT 
    COUNT(*) as total_approved_registered,
    COUNT(or_cr_number) as with_or_cr,
    COUNT(*) - COUNT(or_cr_number) as without_or_cr
FROM vehicles
WHERE status IN ('APPROVED', 'REGISTERED');

-- Step 5: Show recently assigned OR/CR numbers
SELECT 
    id,
    vin,
    plate_number,
    or_cr_number,
    or_cr_issued_at,
    status
FROM vehicles
WHERE or_cr_number IS NOT NULL
ORDER BY or_cr_issued_at DESC
LIMIT 10;

