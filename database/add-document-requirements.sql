-- Add Document Requirements Configuration Table
-- Allows admins to configure which documents are required/optional for registration

CREATE TABLE IF NOT EXISTS registration_document_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_type VARCHAR(50) NOT NULL, -- 'NEW', 'TRANSFER', 'RENEWAL'
    vehicle_category VARCHAR(50) DEFAULT 'ALL', -- 'PRIVATE', 'PUBLIC', 'GOVERNMENT', 'ALL'
    document_type VARCHAR(50) NOT NULL, -- 'registration_cert', 'insurance_cert', etc.
    is_required BOOLEAN DEFAULT true,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    accepted_formats VARCHAR(100) DEFAULT 'pdf,jpg,jpeg,png',
    max_file_size_mb INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(registration_type, vehicle_category, document_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_doc_requirements_type_category 
ON registration_document_requirements(registration_type, vehicle_category, is_active);

-- Insert requirements for Brand New 4-Wheeled Vehicles
INSERT INTO registration_document_requirements (registration_type, vehicle_category, document_type, is_required, display_name, description, display_order) VALUES
('NEW', 'BRAND_NEW_4W', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 1),
('NEW', 'BRAND_NEW_4W', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 2),
('NEW', 'BRAND_NEW_4W', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 3),
('NEW', 'BRAND_NEW_4W', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 4),
('NEW', 'BRAND_NEW_4W', 'owner_id', true, 'Owner Valid ID', 'Government-issued identification (electronic copy and original copy required)', 5)
ON CONFLICT (registration_type, vehicle_category, document_type) DO NOTHING;

-- Insert requirements for Brand New 2-Wheeled Vehicles
INSERT INTO registration_document_requirements (registration_type, vehicle_category, document_type, is_required, display_name, description, display_order) VALUES
('NEW', 'BRAND_NEW_2W', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 1),
('NEW', 'BRAND_NEW_2W', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 2),
('NEW', 'BRAND_NEW_2W', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 3),
('NEW', 'BRAND_NEW_2W', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 4),
('NEW', 'BRAND_NEW_2W', 'owner_id', true, 'Owner Valid ID', 'Government-issued identification (electronic copy and original copy required)', 5)
ON CONFLICT (registration_type, vehicle_category, document_type) DO NOTHING;

-- Insert fallback requirements for ALL category (backward compatibility)
INSERT INTO registration_document_requirements (registration_type, vehicle_category, document_type, is_required, display_name, description, display_order) VALUES
('NEW', 'ALL', 'csr', true, 'Certificate of Stock Report (CSR)', 'Electronic copy and original copy required', 1),
('NEW', 'ALL', 'insurance_cert', true, 'Insurance Certificate of Cover (Third Party Liability)', 'Electronic copy and original copy required', 2),
('NEW', 'ALL', 'hpg_clearance', true, 'PNP-HPG Motor Vehicle (MV) Clearance Certificate and Special Bank Receipt (SBR)', 'Original copy required', 3),
('NEW', 'ALL', 'sales_invoice', true, 'Sales Invoice', 'Electronic copy and original copy required', 4),
('NEW', 'ALL', 'owner_id', true, 'Owner Valid ID', 'Government-issued identification (electronic copy and original copy required)', 5)
ON CONFLICT (registration_type, vehicle_category, document_type) DO NOTHING;

-- Insert requirements for TRANSFER
INSERT INTO registration_document_requirements (registration_type, document_type, is_required, display_name, description, display_order) VALUES
('TRANSFER', 'deed_of_sale', true, 'Deed of Sale', 'Notarized deed of absolute sale', 1),
('TRANSFER', 'seller_id', true, 'Seller Valid ID', 'Valid ID of the seller', 2),
('TRANSFER', 'buyer_id', true, 'Buyer Valid ID', 'Valid ID of the buyer', 3),
('TRANSFER', 'or_cr', true, 'OR/CR', 'Original Official Receipt and Certificate of Registration', 4),
('TRANSFER', 'insurance_cert', true, 'Insurance Certificate', 'Updated insurance in buyer name', 5),
('TRANSFER', 'emission_cert', true, 'Emission Certificate', 'Valid emission test result', 6)
ON CONFLICT (registration_type, vehicle_category, document_type) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_requirements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_requirements_updated_at
    BEFORE UPDATE ON registration_document_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_document_requirements_updated_at();
