-- TrustChain LTO - Database Verification Report
-- Usage (SSH):
--   ./run-db-verification.sh
-- Output: db-verification-report.txt (repo root)

\pset pager off
\pset format aligned
\pset tuples_only off
\timing off

\echo '============================================'
\echo 'TRUSTCHAIN LTO - DATABASE VERIFICATION REPORT'
\echo '============================================'

SELECT now() AS generated_at;
SELECT current_database() AS db, current_user AS db_user;
SELECT version() AS postgres_version;
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

\echo ''
\echo '--- 1) TABLES & VIEWS (public schema) ---'
SELECT table_type, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_type, table_name;

\echo ''
\echo '--- 2) ROW COUNTS (all public tables; pg_stat approx) ---'
SELECT
  schemaname,
  relname AS tablename,
  n_tup_ins AS inserts,
  n_tup_upd AS updates,
  n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY relname;

\echo ''
\echo '--- 3) COLUMN INVENTORY (all public tables) ---'
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  COALESCE(character_maximum_length::text, '') AS char_len,
  is_nullable,
  COALESCE(column_default, '') AS column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

\echo ''
\echo '--- 4) INDEX INVENTORY (all public indexes) ---'
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '--- 5) CONSTRAINT INVENTORY (PK/UK/FK/CHECK) ---'
SELECT
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

\echo ''
\echo '--- 6) FOREIGN KEYS (detail) ---'
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

\echo ''
\echo '--- 7) SEQUENCES ---'
SELECT sequence_schema, sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

\echo ''
\echo '--- 8) EXTENSIONS ---'
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

\echo ''
\echo '============================================'
\echo 'WORKFLOW-CRITICAL CHECKS (docs + traces)'
\echo '============================================'

\echo ''
\echo '--- A) registration_document_requirements exists? ---'
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'registration_document_requirements'
) AS has_registration_document_requirements;

\echo ''
\echo '--- B) MVIR/inspection columns exist on vehicles? ---'
SELECT
  req.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (VALUES
  ('mvir_number'),
  ('inspection_date'),
  ('inspection_result'),
  ('roadworthiness_status'),
  ('emission_compliance'),
  ('inspection_officer'),
  ('inspection_notes'),
  ('inspection_documents')
) AS req(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'vehicles'
 AND c.column_name = req.column_name
ORDER BY req.column_name;

\echo ''
\echo '--- C) Inspection flags exist on documents? ---'
SELECT
  req.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (VALUES
  ('is_inspection_document'),
  ('inspection_document_type')
) AS req(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'documents'
 AND c.column_name = req.column_name
ORDER BY req.column_name;

\echo ''
\echo '--- D) vehicle_verifications automation + clearance link columns? ---'
SELECT
  req.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (VALUES
  ('clearance_request_id'),
  ('automated'),
  ('verification_score'),
  ('verification_metadata'),
  ('auto_verified_at')
) AS req(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'vehicle_verifications'
 AND c.column_name = req.column_name
ORDER BY req.column_name;

\echo ''
\echo '--- E) certificates traceability columns? ---'
SELECT
  req.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (VALUES
  ('file_hash'),
  ('composite_hash'),
  ('blockchain_tx_id'),
  ('application_status'),
  ('document_id'),
  ('verified_at'),
  ('verified_by'),
  ('revocation_reason'),
  ('revoked_at')
) AS req(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'certificates'
 AND c.column_name = req.column_name
ORDER BY req.column_name;

\echo ''
\echo '--- F) transfer_requests approval/clearance columns? ---'
SELECT
  req.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (VALUES
  ('hpg_clearance_request_id'),
  ('insurance_clearance_request_id'),
  ('emission_clearance_request_id'),
  ('hpg_approval_status'),
  ('insurance_approval_status'),
  ('emission_approval_status'),
  ('hpg_approved_at'),
  ('insurance_approved_at'),
  ('emission_approved_at'),
  ('hpg_approved_by'),
  ('insurance_approved_by'),
  ('emission_approved_by')
) AS req(column_name)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'transfer_requests'
 AND c.column_name = req.column_name
ORDER BY req.column_name;

\echo ''
\echo '--- G) Sequence presence (MVIR) ---'
SELECT
  'mvir_number_seq' AS sequence,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'mvir_number_seq') THEN 'OK'
    ELSE 'MISSING'
  END AS status;

\echo ''
\echo '--- H) Transfer MVIR gate readiness (how many vehicles lack MVIR?) ---'
SELECT
  COUNT(*) FILTER (WHERE mvir_number IS NULL) AS vehicles_missing_mvir,
  COUNT(*) AS vehicles_total
FROM vehicles;

\echo ''
\echo '============================================'
\echo 'END OF REPORT'
\echo '============================================'

