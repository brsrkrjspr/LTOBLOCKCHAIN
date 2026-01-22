-- ============================================
-- SAFE DATA DELETION SCRIPT
-- Preserves User Accounts, External Issuers, and Authentication Data
-- ============================================
-- 
-- This script deletes all application data while preserving:
-- - User accounts (users table)
-- - External issuers (external_issuers table)
-- - Authentication data (refresh_tokens, sessions, token_blacklist, email_verification_tokens)
-- 
-- WARNING: This will delete ALL:
-- - Vehicles and registrations
-- - Transfer requests
-- - Documents
-- - Certificates
-- - Notifications
-- - History records
-- - System settings
-- - Config data (registration_document_requirements)
--
-- Schema/structure remains intact - only data is deleted
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Delete deepest child tables first
-- ============================================

-- Delete vehicle history (references vehicles, users)
DELETE FROM vehicle_history;
DO $$ BEGIN RAISE NOTICE 'Deleted vehicle_history records'; END $$;

-- Delete transfer verifications (references transfer_requests, documents, users)
DELETE FROM transfer_verifications;
DO $$ BEGIN RAISE NOTICE 'Deleted transfer_verifications records'; END $$;

-- Delete transfer documents (references transfer_requests, documents, users)
DELETE FROM transfer_documents;
DO $$ BEGIN RAISE NOTICE 'Deleted transfer_documents records'; END $$;

-- Delete certificate submissions (references vehicles, users, issued_certificates)
DELETE FROM certificate_submissions;
DO $$ BEGIN RAISE NOTICE 'Deleted certificate_submissions records'; END $$;

-- Delete notifications (references users)
DELETE FROM notifications;
DO $$ BEGIN RAISE NOTICE 'Deleted notifications records'; END $$;

-- Delete expiry notifications (references vehicles, users)
DELETE FROM expiry_notifications;
DO $$ BEGIN RAISE NOTICE 'Deleted expiry_notifications records'; END $$;

-- ============================================
-- STEP 2: Delete intermediate tables
-- ============================================

-- Delete certificates (references vehicles, users, clearance_requests, documents)
DELETE FROM certificates;
DO $$ BEGIN RAISE NOTICE 'Deleted certificates records'; END $$;

-- Delete vehicle verifications (references vehicles, users, clearance_requests)
DELETE FROM vehicle_verifications;
DO $$ BEGIN RAISE NOTICE 'Deleted vehicle_verifications records'; END $$;

-- Delete transfer requests (references vehicles, users, clearance_requests)
DELETE FROM transfer_requests;
DO $$ BEGIN RAISE NOTICE 'Deleted transfer_requests records'; END $$;

-- Delete clearance requests (references vehicles, users)
DELETE FROM clearance_requests;
DO $$ BEGIN RAISE NOTICE 'Deleted clearance_requests records'; END $$;

-- Delete documents (references vehicles, users)
DELETE FROM documents;
DO $$ BEGIN RAISE NOTICE 'Deleted documents records'; END $$;

-- Delete issued certificates (references external_issuers - but we preserve issuers)
DELETE FROM issued_certificates;
DO $$ BEGIN RAISE NOTICE 'Deleted issued_certificates records'; END $$;

-- ============================================
-- STEP 3: Delete parent tables
-- ============================================

-- Delete vehicles (references users)
DELETE FROM vehicles;
DO $$ BEGIN RAISE NOTICE 'Deleted vehicles records'; END $$;

-- ============================================
-- STEP 4: Delete config/system tables
-- ============================================

-- Delete system settings
DELETE FROM system_settings;
DO $$ BEGIN RAISE NOTICE 'Deleted system_settings records'; END $$;

-- Delete registration document requirements (config)
DELETE FROM registration_document_requirements;
DO $$ BEGIN RAISE NOTICE 'Deleted registration_document_requirements records'; END $$;

-- ============================================
-- STEP 5: Reset sequences
-- ============================================

ALTER SEQUENCE IF EXISTS or_number_seq RESTART WITH 1;
DO $$ BEGIN RAISE NOTICE 'Reset or_number_seq'; END $$;

ALTER SEQUENCE IF EXISTS cr_number_seq RESTART WITH 1;
DO $$ BEGIN RAISE NOTICE 'Reset cr_number_seq'; END $$;

ALTER SEQUENCE IF EXISTS mvir_number_seq RESTART WITH 1;
DO $$ BEGIN RAISE NOTICE 'Reset mvir_number_seq'; END $$;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
    user_count INTEGER;
    vehicle_count INTEGER;
    doc_count INTEGER;
    issuer_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO vehicle_count FROM vehicles;
    SELECT COUNT(*) INTO doc_count FROM documents;
    SELECT COUNT(*) INTO issuer_count FROM external_issuers;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DELETION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Users preserved: %', user_count;
    RAISE NOTICE 'External issuers preserved: %', issuer_count;
    RAISE NOTICE 'Vehicles remaining: %', vehicle_count;
    RAISE NOTICE 'Documents remaining: %', doc_count;
    RAISE NOTICE '========================================';
END $$;

COMMIT;
