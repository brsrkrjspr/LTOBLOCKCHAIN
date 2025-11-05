-- TrustChain LTO - Laptop Optimized Database Schema
-- Optimized for 4GB RAM systems with minimal resource usage

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'insurance_verifier', 'emission_verifier', 'vehicle_owner');
CREATE TYPE verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE vehicle_status AS ENUM ('SUBMITTED', 'REGISTERED', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE document_type AS ENUM ('registration_cert', 'insurance_cert', 'emission_cert', 'owner_id');

-- Users table (optimized)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'vehicle_owner',
    organization VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Vehicles table (optimized)
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vin VARCHAR(17) UNIQUE NOT NULL,
    plate_number VARCHAR(20) UNIQUE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30),
    engine_number VARCHAR(50),
    chassis_number VARCHAR(50),
    vehicle_type VARCHAR(30) DEFAULT 'PASSENGER',
    fuel_type VARCHAR(20) DEFAULT 'GASOLINE',
    transmission VARCHAR(20) DEFAULT 'MANUAL',
    engine_displacement VARCHAR(20),
    owner_id UUID REFERENCES users(id),
    status vehicle_status DEFAULT 'SUBMITTED',
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    priority VARCHAR(10) DEFAULT 'MEDIUM',
    notes TEXT
);

-- Create indexes for faster queries
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_make_model ON vehicles(make, model);

-- Vehicle verification status table
CREATE TABLE vehicle_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    verification_type VARCHAR(20) NOT NULL, -- 'insurance', 'emission', 'admin'
    status verification_status DEFAULT 'PENDING',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_id, verification_type)
);

-- Create indexes
CREATE INDEX idx_verifications_vehicle ON vehicle_verifications(vehicle_id);
CREATE INDEX idx_verifications_type ON vehicle_verifications(verification_type);
CREATE INDEX idx_verifications_status ON vehicle_verifications(status);

-- Documents table (optimized for local storage)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    verified_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_documents_vehicle ON documents(vehicle_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_hash ON documents(file_hash);

-- Vehicle history table (for audit trail)
CREATE TABLE vehicle_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_id VARCHAR(100),
    metadata JSONB
);

-- Create indexes
CREATE INDEX idx_history_vehicle ON vehicle_history(vehicle_id);
CREATE INDEX idx_history_action ON vehicle_history(action);
CREATE INDEX idx_history_performed_by ON vehicle_history(performed_by);
CREATE INDEX idx_history_performed_at ON vehicle_history(performed_at);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

-- System settings table
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('system_name', 'TrustChain LTO', 'System name'),
('version', '1.0.0', 'System version'),
('maintenance_mode', 'false', 'Maintenance mode flag'),
('max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)'),
('allowed_file_types', 'pdf,jpg,jpeg,png', 'Allowed file types for upload'),
('blockchain_mode', 'mock', 'Blockchain mode (mock or fabric)'),
('storage_mode', 'local', 'Storage mode (local or ipfs)');

-- Insert default admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, is_active, email_verified) VALUES
('admin@lto.gov.ph', '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', 'Admin', 'User', 'admin', 'LTO', true, true),
('staff@lto.gov.ph', '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', 'Staff', 'User', 'staff', 'LTO', true, true),
('insurance@lto.gov.ph', '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', 'Insurance', 'Verifier', 'insurance_verifier', 'Insurance Company', true, true),
('emission@lto.gov.ph', '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', 'Emission', 'Verifier', 'emission_verifier', 'Emission Testing Center', true, true),
('owner@example.com', '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', 'Vehicle', 'Owner', 'vehicle_owner', 'Individual', true, true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON vehicle_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for vehicle summary
CREATE VIEW vehicle_summary AS
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.make,
    v.model,
    v.year,
    v.color,
    v.status,
    v.registration_date,
    u.first_name || ' ' || u.last_name as owner_name,
    u.email as owner_email,
    COUNT(d.id) as document_count,
    COUNT(CASE WHEN d.verified = true THEN 1 END) as verified_documents
FROM vehicles v
LEFT JOIN users u ON v.owner_id = u.id
LEFT JOIN documents d ON v.id = d.vehicle_id
GROUP BY v.id, v.vin, v.plate_number, v.make, v.model, v.year, v.color, v.status, v.registration_date, u.first_name, u.last_name, u.email;

-- Create view for verification status
CREATE VIEW verification_summary AS
SELECT 
    v.id as vehicle_id,
    v.vin,
    v.plate_number,
    v.status as vehicle_status,
    MAX(CASE WHEN vv.verification_type = 'insurance' THEN vv.status END) as insurance_status,
    MAX(CASE WHEN vv.verification_type = 'emission' THEN vv.status END) as emission_status,
    MAX(CASE WHEN vv.verification_type = 'admin' THEN vv.status END) as admin_status,
    COUNT(vv.id) as total_verifications,
    COUNT(CASE WHEN vv.status = 'APPROVED' THEN 1 END) as approved_verifications
FROM vehicles v
LEFT JOIN vehicle_verifications vv ON v.id = vv.vehicle_id
GROUP BY v.id, v.vin, v.plate_number, v.status;

-- Optimize database for laptop usage
-- Set memory parameters for 4GB RAM system
ALTER SYSTEM SET shared_buffers = '128MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '4MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Create partial indexes for better performance
CREATE INDEX idx_vehicles_active ON vehicles(id) WHERE status IN ('SUBMITTED', 'REGISTERED');
CREATE INDEX idx_notifications_unread ON notifications(id) WHERE read = false;
CREATE INDEX idx_documents_unverified ON documents(id) WHERE verified = false;

-- Analyze tables for better query planning
ANALYZE users;
ANALYZE vehicles;
ANALYZE vehicle_verifications;
ANALYZE documents;
ANALYZE vehicle_history;
ANALYZE notifications;
ANALYZE system_settings;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lto_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lto_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO lto_user;

COMMENT ON DATABASE lto_blockchain IS 'TrustChain LTO Blockchain Vehicle Registration System - Laptop Optimized';
COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON TABLE vehicles IS 'Vehicle registration data with blockchain integration';
COMMENT ON TABLE vehicle_verifications IS 'Verification status for insurance, emission, and admin approval';
COMMENT ON TABLE documents IS 'Document metadata for local file storage';
COMMENT ON TABLE vehicle_history IS 'Audit trail for all vehicle-related actions';
COMMENT ON TABLE notifications IS 'User notifications and alerts';
COMMENT ON TABLE system_settings IS 'System configuration settings';
