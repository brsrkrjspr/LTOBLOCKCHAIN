-- Add expiry date columns to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS registration_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS insurance_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS emission_expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS expiry_notified_30d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_notified_7d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expiry_notified_1d BOOLEAN DEFAULT FALSE;

-- Create index for expiry date queries
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_expiry ON vehicles(registration_expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_insurance_expiry ON vehicles(insurance_expiry_date);

-- Create expiry notifications log table
CREATE TABLE IF NOT EXISTS expiry_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'registration_30d', 'insurance_7d', etc.
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE
);

-- Create index for expiry notifications queries
CREATE INDEX IF NOT EXISTS idx_expiry_notifications_vehicle ON expiry_notifications(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expiry_notifications_user ON expiry_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_expiry_notifications_type ON expiry_notifications(notification_type);

