-- Migration: Add LTO Officer Roles and Enhanced Tracking
-- Date: 2026-01-17
-- Description: Adds lto_admin, lto_officer, lto_supervisor roles and officer-specific tracking fields

-- ============================================
-- STEP 1: Add new roles to user_role ENUM
-- ============================================

-- Add new role values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lto_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lto_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lto_supervisor';

-- ============================================
-- STEP 2: Add officer-specific columns to users table
-- ============================================

-- Add officer identification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_office VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_file_path VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS digital_signature_hash VARCHAR(128);

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_badge_number ON users(badge_number) WHERE badge_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_branch_office ON users(branch_office) WHERE branch_office IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id) WHERE supervisor_id IS NOT NULL;

-- Add column comments
COMMENT ON COLUMN users.employee_id IS 'Unique employee identifier for LTO staff/officers';
COMMENT ON COLUMN users.badge_number IS 'Physical badge number for LTO officers';
COMMENT ON COLUMN users.department IS 'Department within LTO (e.g., Registration, Enforcement)';
COMMENT ON COLUMN users.branch_office IS 'LTO branch office location';
COMMENT ON COLUMN users.supervisor_id IS 'Reference to supervising officer/admin';
COMMENT ON COLUMN users.hire_date IS 'Date officer was hired';
COMMENT ON COLUMN users.position IS 'Job position/title';
COMMENT ON COLUMN users.signature_file_path IS 'Path to officer digital signature image';
COMMENT ON COLUMN users.digital_signature_hash IS 'Hash of digital signature for verification';

-- ============================================
-- STEP 3: Create officer_activity_log table
-- ============================================

CREATE TABLE IF NOT EXISTS officer_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    officer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    activity_type VARCHAR(50) NOT NULL,  -- 'registration', 'verification', 'transfer', 'inspection', 'clearance', 'unauthorized_access'
    entity_type VARCHAR(50) NOT NULL,     -- 'vehicle', 'document', 'transfer_request', 'clearance_request', 'system'
    entity_id UUID,                       -- Reference to the entity being acted upon
    action VARCHAR(50) NOT NULL,          -- 'created', 'approved', 'rejected', 'verified', 'updated', 'deleted', 'denied'
    duration_seconds INTEGER,             -- Time spent on activity
    notes TEXT,
    ip_address INET,
    user_agent TEXT,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_officer_activity_officer ON officer_activity_log(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_activity_type ON officer_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_officer_activity_created_at ON officer_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_officer_activity_entity ON officer_activity_log(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_officer_activity_action ON officer_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_officer_activity_session ON officer_activity_log(session_id) WHERE session_id IS NOT NULL;

COMMENT ON TABLE officer_activity_log IS 'Detailed activity log for LTO officers for performance tracking and accountability';
COMMENT ON COLUMN officer_activity_log.officer_id IS 'User ID of the officer performing the action';
COMMENT ON COLUMN officer_activity_log.activity_type IS 'Type of activity (registration, verification, transfer, etc.)';
COMMENT ON COLUMN officer_activity_log.entity_type IS 'Type of entity being acted upon';
COMMENT ON COLUMN officer_activity_log.entity_id IS 'ID of the entity being acted upon';
COMMENT ON COLUMN officer_activity_log.action IS 'Specific action performed';
COMMENT ON COLUMN officer_activity_log.duration_seconds IS 'Time taken to complete the activity';
COMMENT ON COLUMN officer_activity_log.metadata IS 'Additional context data in JSON format';

-- ============================================
-- STEP 4: Create officer_performance_metrics view
-- ============================================

-- Only create view if required tables exist (transfer_requests, clearance_requests)
-- This view will be created after migration 007 runs, but we make it conditional for safety
DO $$
BEGIN
    -- Check if required tables exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'transfer_requests'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'clearance_requests'
    ) THEN
        -- Create view only if tables exist
        EXECUTE '
CREATE OR REPLACE VIEW officer_performance_metrics AS
SELECT 
    u.id as officer_id,
    u.email,
    u.first_name || '' '' || u.last_name as officer_name,
    u.employee_id,
    u.badge_number,
    u.department,
    u.branch_office,
    u.position,
    u.hire_date,
    u.role as officer_role,
    
    COUNT(CASE WHEN vh.action = ''APPROVED'' AND vh.vehicle_id IS NOT NULL THEN 1 END) as vehicles_approved,
    COUNT(CASE WHEN vh.action = ''REJECTED'' AND vh.vehicle_id IS NOT NULL THEN 1 END) as vehicles_rejected,
    COUNT(CASE WHEN tr.reviewed_by = u.id AND tr.status = ''APPROVED'' THEN 1 END) as transfers_approved,
    COUNT(CASE WHEN tr.reviewed_by = u.id AND tr.status = ''REJECTED'' THEN 1 END) as transfers_rejected,
    COUNT(CASE WHEN d.verified_by = u.id AND d.verified = true THEN 1 END) as documents_verified,
    COUNT(CASE WHEN cr.requested_by = u.id THEN 1 END) as clearances_requested,
    COUNT(DISTINCT oal.id) as total_activities,
    AVG(oal.duration_seconds) as avg_activity_duration_seconds,
    MIN(vh.performed_at) as first_action_date,
    MAX(vh.performed_at) as last_action_date,
    COUNT(CASE WHEN tr.status IN (''PENDING'', ''REVIEWING'') AND tr.reviewed_by = u.id THEN 1 END) as pending_transfers,
    COUNT(CASE WHEN cr.status IN (''PENDING'', ''IN_PROGRESS'') AND cr.assigned_to = u.id THEN 1 END) as pending_clearances,
    COUNT(CASE WHEN DATE(oal.created_at) = CURRENT_DATE THEN 1 END) as today_activities,
    COUNT(CASE WHEN DATE_TRUNC(''month'', oal.created_at) = DATE_TRUNC(''month'', CURRENT_DATE) THEN 1 END) as month_activities,
    MAX(oal.created_at) as last_activity_at
    
FROM users u
LEFT JOIN vehicle_history vh ON vh.performed_by = u.id
LEFT JOIN transfer_requests tr ON tr.reviewed_by = u.id
LEFT JOIN documents d ON d.verified_by = u.id
LEFT JOIN clearance_requests cr ON cr.requested_by = u.id OR cr.assigned_to = u.id
LEFT JOIN officer_activity_log oal ON oal.officer_id = u.id
WHERE u.role IN (''lto_officer'', ''lto_supervisor'', ''lto_admin'', ''staff'', ''admin'')
GROUP BY u.id, u.email, u.first_name, u.last_name, u.employee_id, u.badge_number, 
         u.department, u.branch_office, u.position, u.hire_date, u.role';
        
        EXECUTE 'COMMENT ON VIEW officer_performance_metrics IS ''Performance metrics for LTO officers for management reporting and dashboards''';
    ELSE
        RAISE NOTICE 'Skipping officer_performance_metrics view creation - transfer_requests or clearance_requests table does not exist yet. Run migration 007 first.';
    END IF;
END $$;

-- ============================================
-- STEP 5: Update existing admin users to lto_admin role (optional)
-- ============================================

-- Uncomment the following to migrate existing admin users to lto_admin
-- UPDATE users SET role = 'lto_admin' WHERE role = 'admin' AND email LIKE '%@lto.gov.ph';

-- Update admin user with officer-specific data
UPDATE users 
SET 
    employee_id = 'LTO-ADMIN-001',
    badge_number = 'ADMIN-001',
    department = 'Administration',
    branch_office = 'LTO Central Office',
    position = 'System Administrator',
    hire_date = '2024-01-01'
WHERE email = 'admin@lto.gov.ph';

-- Update staff user with officer-specific data
UPDATE users 
SET 
    employee_id = 'LTO-STAFF-001',
    badge_number = 'STAFF-001',
    department = 'Vehicle Registration',
    branch_office = 'LTO Manila Central',
    position = 'Registration Clerk',
    hire_date = '2024-01-01'
WHERE email = 'staff@lto.gov.ph';

-- ============================================
-- STEP 6: Create function to auto-log officer activities
-- ============================================

CREATE OR REPLACE FUNCTION log_officer_vehicle_action()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if performed_by is set and refers to an LTO officer/admin
    IF NEW.performed_by IS NOT NULL THEN
        INSERT INTO officer_activity_log (
            officer_id,
            activity_type,
            entity_type,
            entity_id,
            action,
            notes,
            metadata
        )
        SELECT 
            NEW.performed_by,
            'registration',
            'vehicle',
            NEW.vehicle_id,
            NEW.action,
            NEW.description,
            jsonb_build_object(
                'transaction_id', NEW.transaction_id,
                'vehicle_history_id', NEW.id
            )
        FROM users
        WHERE id = NEW.performed_by 
        AND role IN ('lto_officer', 'lto_supervisor', 'lto_admin', 'staff', 'admin');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for vehicle_history
DROP TRIGGER IF EXISTS trigger_log_officer_vehicle_action ON vehicle_history;
CREATE TRIGGER trigger_log_officer_vehicle_action
    AFTER INSERT ON vehicle_history
    FOR EACH ROW
    EXECUTE FUNCTION log_officer_vehicle_action();

COMMENT ON FUNCTION log_officer_vehicle_action() IS 'Automatically logs officer activities when vehicle history is created';

-- ============================================
-- STEP 7: Grant permissions
-- ============================================

-- Grant SELECT on new view to all authenticated users (only if view exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'officer_performance_metrics'
    ) THEN
        EXECUTE 'GRANT SELECT ON officer_performance_metrics TO lto_user';
    END IF;
END $$;

-- Grant necessary permissions on new table
GRANT SELECT, INSERT ON officer_activity_log TO lto_user;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify new enum values
SELECT unnest(enum_range(NULL::user_role)) as role_values;

-- Verify new columns in users table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('employee_id', 'badge_number', 'department', 'branch_office', 'supervisor_id', 'hire_date', 'position', 'signature_file_path', 'digital_signature_hash')
ORDER BY ordinal_position;

-- Verify officer_activity_log table
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'officer_activity_log';

-- Verify officer_performance_metrics view
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'officer_performance_metrics';

-- Show updated users with officer data
SELECT 
    email, 
    role, 
    employee_id, 
    badge_number, 
    department, 
    branch_office, 
    position
FROM users 
WHERE role IN ('admin', 'staff', 'lto_admin', 'lto_officer', 'lto_supervisor')
ORDER BY email;

-- Migration completed successfully!
