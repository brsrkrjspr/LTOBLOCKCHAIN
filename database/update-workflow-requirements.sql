-- Update Document Requirements for Brand New 4W and 2W Vehicles
-- This script updates the workflow to support category-specific document requirements

BEGIN;

-- Delete all existing NEW registration requirements
DELETE FROM registration_document_requirements
WHERE registration_type = 'NEW';

-- Insert requirements for Brand New 4-Wheeled Vehicles
INSERT INTO registration_document_requirements 
    (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active)
VALUES
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_4W', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 1, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_4W', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 2, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_4W', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 'pdf,jpg,jpeg,png', 10, 3, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_4W', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 4, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_4W', 'owner_id', true, 'Owner Valid ID', 'Government-issued identification (electronic copy and original copy required)', 'pdf,jpg,jpeg,png', 10, 5, true);

-- Insert requirements for Brand New 2-Wheeled Vehicles
INSERT INTO registration_document_requirements 
    (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active)
VALUES
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_2W', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 1, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_2W', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 2, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_2W', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 'pdf,jpg,jpeg,png', 10, 3, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_2W', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 4, true),
    (uuid_generate_v4(), 'NEW', 'BRAND_NEW_2W', 'owner_id', true, 'Owner Valid ID', 'Government-issued identification (electronic copy and original copy required)', 'pdf,jpg,jpeg,png', 10, 5, true);

-- Insert fallback requirements for ALL category (backward compatibility)
INSERT INTO registration_document_requirements 
    (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active)
VALUES
    (uuid_generate_v4(), 'NEW', 'ALL', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 1, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 2, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 'pdf,jpg,jpeg,png', 10, 3, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 'pdf,jpg,jpeg,png', 10, 4, true),
    (uuid_generate_v4(), 'NEW', 'ALL', 'owner_id', true, 'Owner Valid ID', 'Government-issued identification (electronic copy and original copy required)', 'pdf,jpg,jpeg,png', 10, 5, true);

COMMIT;

-- Verify the changes
SELECT registration_type, vehicle_category, document_type, display_name, is_required, display_order 
FROM registration_document_requirements 
WHERE registration_type = 'NEW' AND is_active = true
ORDER BY vehicle_category, display_order;
