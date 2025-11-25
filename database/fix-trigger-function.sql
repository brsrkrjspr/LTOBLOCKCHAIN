-- Fix trigger function to handle vehicles table correctly
-- Vehicles table uses 'last_updated' not 'updated_at'

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- For vehicles table, update last_updated
    IF TG_TABLE_NAME = 'vehicles' THEN
        NEW.last_updated := CURRENT_TIMESTAMP;
    -- For other tables, try updated_at first, then last_updated
    ELSE
        -- Try to update updated_at if it exists (for users, verifications, etc.)
        BEGIN
            NEW.updated_at := CURRENT_TIMESTAMP;
        EXCEPTION
            WHEN undefined_column THEN
                -- Column doesn't exist, try last_updated instead
                BEGIN
                    NEW.last_updated := CURRENT_TIMESTAMP;
                EXCEPTION
                    WHEN undefined_column THEN
                        -- Neither column exists, do nothing
                        NULL;
                END;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

