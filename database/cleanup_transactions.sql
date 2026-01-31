-- ============================================================
-- TrustChain LTO - Transaction Data Cleanup Script
-- ============================================================
-- 
-- PURPOSE: Reset all transaction data while preserving user accounts
-- and external issuer configurations.
-- 
-- WARNING: This script will PERMANENTLY DELETE all transaction data.
-- This action is IRREVERSIBLE after COMMIT.
--
-- TABLES AFFECTED:
-- - certificates (and related submissions)
-- - documents
-- - clearance_requests
-- - transfer_requests (and related documents)
-- - notifications
-- - vehicles (local PostgreSQL cache)
-- - vehicle_history
-- - vehicle_verifications
-- - expiry_notifications
-- - issued_certificates
-- - officer_activity_log
-- - certificate_submissions
-- 
-- TABLES PRESERVED (NOT TRUNCATED):
-- - users
-- - external_issuers
-- - email_verification_tokens
-- - refresh_tokens
-- - sessions
-- ============================================================

-- SAFETY: Start a transaction so we can rollback if needed
BEGIN;

-- Display current record counts before cleanup
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'TrustChain LTO - Pre-Cleanup Record Counts';
    RAISE NOTICE '============================================================';
    
    SELECT COUNT(*) INTO v_count FROM users;
    RAISE NOTICE 'users: % (WILL BE PRESERVED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM external_issuers;
    RAISE NOTICE 'external_issuers: % (WILL BE PRESERVED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM vehicles;
    RAISE NOTICE 'vehicles: % (WILL BE DELETED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM certificates;
    RAISE NOTICE 'certificates: % (WILL BE DELETED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM documents;
    RAISE NOTICE 'documents: % (WILL BE DELETED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM clearance_requests;
    RAISE NOTICE 'clearance_requests: % (WILL BE DELETED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM transfer_requests;
    RAISE NOTICE 'transfer_requests: % (WILL BE DELETED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM notifications;
    RAISE NOTICE 'notifications: % (WILL BE DELETED)', v_count;
    
    RAISE NOTICE '============================================================';
END $$;

-- Disable triggers temporarily to avoid cascading issues
SET session_replication_role = replica;

-- ============================================================
-- TRUNCATE TRANSACTION TABLES (in dependency order)
-- ============================================================

-- Child tables first (due to foreign key constraints)
RAISE NOTICE 'Truncating certificate_submissions...';
TRUNCATE TABLE certificate_submissions CASCADE;

RAISE NOTICE 'Truncating issued_certificates...';
TRUNCATE TABLE issued_certificates CASCADE;

RAISE NOTICE 'Truncating expiry_notifications...';
TRUNCATE TABLE expiry_notifications CASCADE;

RAISE NOTICE 'Truncating officer_activity_log...';
TRUNCATE TABLE officer_activity_log CASCADE;

RAISE NOTICE 'Truncating vehicle_verifications...';
TRUNCATE TABLE vehicle_verifications CASCADE;

RAISE NOTICE 'Truncating vehicle_history...';
TRUNCATE TABLE vehicle_history CASCADE;

-- Transfer-related tables
RAISE NOTICE 'Truncating transfer_documents...';
TRUNCATE TABLE transfer_documents CASCADE;

RAISE NOTICE 'Truncating transfer_requests...';
TRUNCATE TABLE transfer_requests CASCADE;

-- Core transaction tables
RAISE NOTICE 'Truncating certificates...';
TRUNCATE TABLE certificates CASCADE;

RAISE NOTICE 'Truncating documents...';
TRUNCATE TABLE documents CASCADE;

RAISE NOTICE 'Truncating clearance_requests...';
TRUNCATE TABLE clearance_requests CASCADE;

RAISE NOTICE 'Truncating notifications...';
TRUNCATE TABLE notifications CASCADE;

-- Vehicle cache (local PostgreSQL copy - Fabric is source of truth)
RAISE NOTICE 'Truncating vehicles (local cache)...';
TRUNCATE TABLE vehicles CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- ============================================================
-- RESET SEQUENCES (optional - uncomment if needed)
-- ============================================================
-- These reset auto-increment/sequence counters to 1

-- Clearance request number sequence
ALTER SEQUENCE IF EXISTS cr_number_seq RESTART WITH 1;

-- MVIR number sequence
ALTER SEQUENCE IF EXISTS mvir_number_seq RESTART WITH 1;

-- ============================================================
-- VERIFICATION: Display post-cleanup counts
-- ============================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'TrustChain LTO - Post-Cleanup Verification';
    RAISE NOTICE '============================================================';
    
    SELECT COUNT(*) INTO v_count FROM users;
    RAISE NOTICE 'users: % (PRESERVED ✅)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM external_issuers;
    RAISE NOTICE 'external_issuers: % (PRESERVED ✅)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM vehicles;
    RAISE NOTICE 'vehicles: % (CLEARED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM certificates;
    RAISE NOTICE 'certificates: % (CLEARED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM documents;
    RAISE NOTICE 'documents: % (CLEARED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM clearance_requests;
    RAISE NOTICE 'clearance_requests: % (CLEARED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM transfer_requests;
    RAISE NOTICE 'transfer_requests: % (CLEARED)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM notifications;
    RAISE NOTICE 'notifications: % (CLEARED)', v_count;
    
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'CLEANUP COMPLETE - Transaction will be committed';
    RAISE NOTICE '============================================================';
END $$;

-- ============================================================
-- COMMIT OR ROLLBACK
-- ============================================================
-- To finalize: COMMIT;
-- To undo: ROLLBACK;

-- Auto-commit (comment out if running interactively and want manual control)
COMMIT;

-- ============================================================
-- IMPORTANT NOTES:
-- ============================================================
-- 1. This script ONLY affects PostgreSQL (local cache)
-- 2. Fabric blockchain data is NOT affected by this script
-- 3. To fully reset system, also clear Fabric world state
-- 4. Users and external_issuers are intentionally preserved
-- 5. Run this during maintenance window only
-- ============================================================
