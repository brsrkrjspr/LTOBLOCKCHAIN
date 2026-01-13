-- Update Document Requirements to Only 4 Required Documents
-- Run this SQL script to reconfigure the registration workflow

BEGIN;

-- Delete all existing NEW registration requirements
DELETE FROM registration_document_requirements
WHERE registration_type = 'NEW';

-- Insert the 4 required documents for NEW registration
INSERT INTO registration_document_requirements 
    (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active)
VALUES
    (uuid_generate_v4(), 'NEW', 'ALL', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 1, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 2, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 'pdf,jpg,jpeg,png', 10, 3, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 4, true);

COMMIT;

-- Verify the changes
SELECT registration_type, document_type, display_name, is_required, display_order 
FROM registration_document_requirements 
WHERE registration_type = 'NEW' AND is_active = true
ORDER BY display_order;
