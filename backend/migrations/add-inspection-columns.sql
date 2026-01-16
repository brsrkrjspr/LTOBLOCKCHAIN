-- Add inspection columns to vehicles table
-- This migration adds MVIR tracking and inspection details for LTO inspections

-- First, create the sequence for MVIR numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS mvir_number_seq START WITH 1 INCREMENT BY 1;

-- Add inspection columns to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS mvir_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspection_result VARCHAR(20), -- 'PASS', 'FAIL', 'PENDING'
ADD COLUMN IF NOT EXISTS roadworthiness_status VARCHAR(20), -- 'ROADWORTHY', 'NOT_ROADWORTHY'
ADD COLUMN IF NOT EXISTS emission_compliance VARCHAR(20), -- 'COMPLIANT', 'NON_COMPLIANT'
ADD COLUMN IF NOT EXISTS inspection_officer VARCHAR(100),
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS inspection_documents JSONB; -- Stores file references

-- Create index for MVIR lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_mvir ON vehicles(mvir_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_date ON vehicles(inspection_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_result ON vehicles(inspection_result);

-- Add columns for tracking inspection documents separately
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50); -- 'MVIR', 'PHOTO', 'OTHER'

-- Create index for inspection documents
CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);

-- Grant permissions
-- (Uncomment if using specific database users)
-- GRANT SELECT, INSERT, UPDATE ON vehicles TO app_user;
-- GRANT USAGE ON SEQUENCE mvir_number_seq TO app_user;
