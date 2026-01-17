# Database Inspection Commands & Structure

This document provides comprehensive commands to inspect all database contents, schemas, and data in the TrustChain LTO system. It also includes the current database structure overview.

## Prerequisites

**SSH Connection:**
```bash
# Connect to your DigitalOcean server
ssh root@your-server-ip
```

**Navigate to Project:**
```bash
cd ~/LTOBLOCKCHAIN
```

---

## Current Database Structure Overview

### Database Information
- **Database Name:** `lto_blockchain`
- **Database User:** `lto_user`
- **Database Password:** `lto_password` (stored in docker-compose.unified.yml)
- **Container Name:** `postgres`

### Extensions Installed
- `uuid-ossp` - UUID generation
- `pg_trgm` - Trigram matching for text search
- `plpgsql` - PostgreSQL procedural language

### Custom Types (ENUMs)
- `user_role`: `'admin'`, `'staff'`, `'insurance_verifier'`, `'emission_verifier'`, `'vehicle_owner'`
- `verification_status`: `'PENDING'`, `'APPROVED'`, `'REJECTED'`
- `vehicle_status`: `'SUBMITTED'`, `'PENDING_BLOCKCHAIN'`, `'REGISTERED'`, `'APPROVED'`, `'REJECTED'`, `'SUSPENDED'`
- `document_type`: `'registration_cert'`, `'insurance_cert'`, `'emission_cert'`, `'owner_id'`

---

## Tables Overview

### Core Tables (from `init-laptop.sql`)

#### 1. `users`
**Purpose:** System users with role-based access control

**Columns:**
- `id` (UUID, PK)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL)
- `first_name` (VARCHAR(100), NOT NULL)
- `last_name` (VARCHAR(100), NOT NULL)
- `role` (user_role ENUM, NOT NULL, DEFAULT 'vehicle_owner')
- `organization` (VARCHAR(255))
- `phone` (VARCHAR(20))
- `address` (VARCHAR(500) or TEXT) - Physical address
- `is_active` (BOOLEAN, DEFAULT true)
- `email_verified` (BOOLEAN, DEFAULT false)
- `two_factor_enabled` (BOOLEAN, DEFAULT false)
- `last_login` (TIMESTAMP)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Default Users (5):**
1. `admin@lto.gov.ph` - Admin (role: `admin`, organization: `LTO`)
2. `staff@lto.gov.ph` - Staff (role: `staff`, organization: `LTO`)
3. `insurance@lto.gov.ph` - Insurance Verifier (role: `insurance_verifier`, organization: `Insurance Company`)
4. `emission@lto.gov.ph` - Emission Verifier (role: `emission_verifier`, organization: `Emission Testing Center`)
5. `owner@example.com` - Vehicle Owner (role: `vehicle_owner`, organization: `Individual`)

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_role` on `role`
- `idx_users_active` on `is_active`

---

#### 2. `vehicles`
**Purpose:** Vehicle registration data with blockchain integration

**Columns:**
- `id` (UUID, PK)
- `vin` (VARCHAR(17), UNIQUE, NOT NULL)
- `plate_number` (VARCHAR(20), UNIQUE)
- `make` (VARCHAR(50), NOT NULL)
- `model` (VARCHAR(50), NOT NULL)
- `year` (INTEGER, NOT NULL)
- `color` (VARCHAR(30))
- `engine_number` (VARCHAR(50))
- `chassis_number` (VARCHAR(50))
- `vehicle_type` (VARCHAR(30), DEFAULT 'PASSENGER')
- `fuel_type` (VARCHAR(20), DEFAULT 'GASOLINE')
- `transmission` (VARCHAR(20), DEFAULT 'MANUAL')
- `engine_displacement` (VARCHAR(20))
- `owner_id` (UUID, FK → users.id)
- `status` (vehicle_status ENUM, DEFAULT 'SUBMITTED')
- `registration_date` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `last_updated` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `priority` (VARCHAR(10), DEFAULT 'MEDIUM')
- `notes` (TEXT)

**Indexes:**
- `idx_vehicles_vin` on `vin`
- `idx_vehicles_plate` on `plate_number`
- `idx_vehicles_owner` on `owner_id`
- `idx_vehicles_status` on `status`
- `idx_vehicles_make_model` on `make, model`
- `idx_vehicles_active` on `id` WHERE status IN ('SUBMITTED', 'REGISTERED')

---

#### 3. `vehicle_verifications`
**Purpose:** Verification status for insurance, emission, and admin approval

**Columns:**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id, ON DELETE CASCADE)
- `verification_type` (VARCHAR(20), NOT NULL) - 'insurance', 'emission', 'admin'
- `status` (verification_status ENUM, DEFAULT 'PENDING')
- `verified_by` (UUID, FK → users.id)
- `verified_at` (TIMESTAMP)
- `notes` (TEXT)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `clearance_request_id` (UUID, FK → clearance_requests.id, ON DELETE SET NULL) - Added by clearance workflow migration

**Constraints:**
- UNIQUE(vehicle_id, verification_type)

**Indexes:**
- `idx_verifications_vehicle` on `vehicle_id`
- `idx_verifications_type` on `verification_type`
- `idx_verifications_status` on `status`
- `idx_verifications_clearance_request` on `clearance_request_id`

---

#### 4. `documents`
**Purpose:** Document metadata for file storage (local or IPFS)

**Columns:**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id, ON DELETE CASCADE)
- `document_type` (document_type ENUM, NOT NULL)
- `filename` (VARCHAR(255), NOT NULL)
- `original_name` (VARCHAR(255), NOT NULL)
- `file_path` (VARCHAR(500), NOT NULL)
- `file_size` (BIGINT, NOT NULL)
- `mime_type` (VARCHAR(100), NOT NULL)
- `file_hash` (VARCHAR(64), NOT NULL)
- `uploaded_by` (UUID, FK → users.id)
- `uploaded_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `verified` (BOOLEAN, DEFAULT false)
- `verified_at` (TIMESTAMP)
- `verified_by` (UUID, FK → users.id)

**Indexes:**
- `idx_documents_vehicle` on `vehicle_id`
- `idx_documents_type` on `document_type`
- `idx_documents_hash` on `file_hash`
- `idx_documents_unverified` on `id` WHERE verified = false

---

#### 5. `vehicle_history`
**Purpose:** Audit trail for all vehicle-related actions

**Columns:**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id, ON DELETE CASCADE)
- `action` (VARCHAR(50), NOT NULL)
- `description` (TEXT)
- `performed_by` (UUID, FK → users.id)
- `performed_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `transaction_id` (VARCHAR(100)) - Blockchain transaction ID
- `metadata` (JSONB)

**Indexes:**
- `idx_history_vehicle` on `vehicle_id`
- `idx_history_action` on `action`
- `idx_history_performed_by` on `performed_by`
- `idx_history_performed_at` on `performed_at`

---

#### 6. `notifications`
**Purpose:** User notifications and alerts

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id, ON DELETE CASCADE)
- `title` (VARCHAR(255), NOT NULL)
- `message` (TEXT, NOT NULL)
- `type` (VARCHAR(50), DEFAULT 'info')
- `read` (BOOLEAN, DEFAULT false)
- `sent_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `read_at` (TIMESTAMP)

**Indexes:**
- `idx_notifications_user` on `user_id`
- `idx_notifications_read` on `read`
- `idx_notifications_sent_at` on `sent_at`
- `idx_notifications_unread` on `id` WHERE read = false

---

#### 7. `system_settings`
**Purpose:** System configuration settings

**Columns:**
- `key` (VARCHAR(100), PK)
- `value` (TEXT, NOT NULL)
- `description` (TEXT)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_by` (UUID, FK → users.id)

**Default Settings:**
- `system_name`: 'TrustChain LTO'
- `version`: '1.0.0'
- `maintenance_mode`: 'false'
- `max_file_size`: '10485760' (10MB)
- `allowed_file_types`: 'pdf,jpg,jpeg,png'
- `blockchain_mode`: 'mock' (Note: System uses 'fabric' in production)
- `storage_mode`: 'local' (Note: System uses 'ipfs' in production)

---

### Authentication & Session Tables (from migrations)

#### 8. `refresh_tokens`
**Purpose:** JWT refresh tokens for session management

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id, ON DELETE CASCADE, NOT NULL)
- `token_hash` (VARCHAR(255), UNIQUE, NOT NULL)
- `expires_at` (TIMESTAMP, NOT NULL)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- `idx_refresh_tokens_user_id` on `user_id`
- `idx_refresh_tokens_token_hash` on `token_hash`
- `idx_refresh_tokens_expires_at` on `expires_at`

---

#### 9. `sessions`
**Purpose:** Active user sessions tracking

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id, ON DELETE CASCADE, NOT NULL)
- `refresh_token_id` (UUID, FK → refresh_tokens.id, ON DELETE CASCADE)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `last_activity` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `expires_at` (TIMESTAMP, NOT NULL)

**Indexes:**
- `idx_sessions_user_id` on `user_id`
- `idx_sessions_refresh_token_id` on `refresh_token_id`
- `idx_sessions_expires_at` on `expires_at`

---

#### 10. `token_blacklist`
**Purpose:** Blacklisted JWT tokens (for logout)

**Columns:**
- `token_jti` (VARCHAR(255), PK) - JWT ID
- `token_hash` (VARCHAR(255), NOT NULL)
- `expires_at` (TIMESTAMP, NOT NULL)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `reason` (VARCHAR(50), DEFAULT 'logout')

**Indexes:**
- `idx_token_blacklist_expires_at` on `expires_at`
- `idx_token_blacklist_hash` on `token_hash`

---

#### 11. `email_verification_tokens`
**Purpose:** Magic link email verification tokens

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id, ON DELETE CASCADE, NOT NULL)
- `token_hash` (VARCHAR(255), UNIQUE, NOT NULL)
- `token_secret` (VARCHAR(255), NOT NULL)
- `expires_at` (TIMESTAMP, NOT NULL)
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `used_at` (TIMESTAMP)
- `used_by_ip` (INET)

**Indexes:**
- `idx_email_verification_tokens_user_id` on `user_id`
- `idx_email_verification_tokens_hash` on `token_hash`
- `idx_email_verification_tokens_expires_at` on `expires_at`
- `idx_email_verification_tokens_used_at` on `used_at`

---

### Transfer & Clearance Workflow Tables (from migrations)

#### 12. `transfer_requests`
**Purpose:** Vehicle ownership transfer requests

**Columns:**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id, ON DELETE CASCADE, NOT NULL)
- `seller_id` (UUID, FK → users.id, NOT NULL)
- `buyer_id` (UUID, FK → users.id) - Can be NULL if buyer is new user
- `buyer_info` (JSONB) - Buyer info if buyer is not yet a user
- `status` (VARCHAR(20), DEFAULT 'PENDING') - CHECK: 'PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FORWARDED_TO_HPG'
- `submitted_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `reviewed_by` (UUID, FK → users.id)
- `reviewed_at` (TIMESTAMP)
- `rejection_reason` (TEXT)
- `forwarded_to_hpg` (BOOLEAN, DEFAULT false)
- `hpg_clearance_request_id` (UUID, FK → clearance_requests.id)
- `metadata` (JSONB, DEFAULT '{}')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- `idx_transfer_vehicle` on `vehicle_id`
- `idx_transfer_seller` on `seller_id`
- `idx_transfer_buyer` on `buyer_id`
- `idx_transfer_status` on `status`
- `idx_transfer_submitted_at` on `submitted_at`
- `idx_transfer_reviewed_by` on `reviewed_by`

---

#### 13. `transfer_documents`
**Purpose:** Documents linked to transfer requests

**Columns:**
- `id` (UUID, PK)
- `transfer_request_id` (UUID, FK → transfer_requests.id, ON DELETE CASCADE, NOT NULL)
- `document_type` (VARCHAR(30), NOT NULL) - CHECK: 'deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other'
- `document_id` (UUID, FK → documents.id, ON DELETE SET NULL)
- `uploaded_by` (UUID, FK → users.id, NOT NULL)
- `uploaded_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `notes` (TEXT)

**Indexes:**
- `idx_transfer_docs_request` on `transfer_request_id`
- `idx_transfer_docs_type` on `document_type`
- `idx_transfer_docs_document` on `document_id`

---

#### 14. `transfer_verifications`
**Purpose:** Document verification records for transfer requests

**Columns:**
- `id` (UUID, PK)
- `transfer_request_id` (UUID, FK → transfer_requests.id, ON DELETE CASCADE, NOT NULL)
- `document_id` (UUID, FK → documents.id, ON DELETE SET NULL)
- `verified_by` (UUID, FK → users.id, NOT NULL)
- `status` (VARCHAR(20), NOT NULL) - CHECK: 'APPROVED', 'REJECTED', 'PENDING'
- `notes` (TEXT)
- `checklist` (JSONB, DEFAULT '{}')
- `flagged` (BOOLEAN, DEFAULT false)
- `verified_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- `idx_transfer_verif_request` on `transfer_request_id`
- `idx_transfer_verif_document` on `document_id`
- `idx_transfer_verif_status` on `status`
- `idx_transfer_verif_verified_by` on `verified_by`

---

#### 15. `clearance_requests`
**Purpose:** Clearance requests sent to external organizations (HPG, Insurance, Emission)

**Columns:**
- `id` (UUID, PK)
- `vehicle_id` (UUID, FK → vehicles.id, ON DELETE CASCADE, NOT NULL)
- `request_type` (VARCHAR(20), NOT NULL) - CHECK: 'hpg', 'insurance', 'emission'
- `status` (VARCHAR(20), DEFAULT 'PENDING') - CHECK: 'PENDING', 'SENT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED'
- `requested_by` (UUID, FK → users.id, NOT NULL)
- `requested_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `assigned_to` (UUID, FK → users.id)
- `completed_at` (TIMESTAMP)
- `certificate_id` (UUID, FK → certificates.id, ON DELETE SET NULL)
- `purpose` (VARCHAR(255))
- `notes` (TEXT)
- `metadata` (JSONB, DEFAULT '{}')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- `idx_clearance_vehicle` on `vehicle_id`
- `idx_clearance_type` on `request_type`
- `idx_clearance_status` on `status`
- `idx_clearance_assigned` on `assigned_to`
- `idx_clearance_requested_by` on `requested_by`
- `idx_clearance_created_at` on `created_at`

---

#### 16. `certificates`
**Purpose:** Certificates issued by external organizations

**Columns:**
- `id` (UUID, PK)
- `clearance_request_id` (UUID, FK → clearance_requests.id, ON DELETE SET NULL)
- `vehicle_id` (UUID, FK → vehicles.id, ON DELETE CASCADE, NOT NULL)
- `certificate_type` (VARCHAR(20), NOT NULL) - CHECK: 'hpg_clearance', 'insurance', 'emission'
- `certificate_number` (VARCHAR(50), UNIQUE, NOT NULL)
- `file_path` (VARCHAR(500))
- `ipfs_cid` (VARCHAR(255)) - IPFS Content ID if stored on IPFS
- `issued_by` (UUID, FK → users.id, NOT NULL)
- `issued_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `expires_at` (TIMESTAMP)
- `status` (VARCHAR(20), DEFAULT 'ACTIVE') - CHECK: 'ACTIVE', 'EXPIRED', 'REVOKED'
- `metadata` (JSONB, DEFAULT '{}')
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

**Indexes:**
- `idx_certificates_request` on `clearance_request_id`
- `idx_certificates_vehicle` on `vehicle_id`
- `idx_certificates_type` on `certificate_type`
- `idx_certificates_number` on `certificate_number`
- `idx_certificates_status` on `status`
- `idx_certificates_issued_by` on `issued_by`

---

### Database Views

#### `vehicle_summary`
Aggregated view of vehicles with owner and document information.

#### `verification_summary`
Aggregated view of vehicle verification statuses.

---

## SSH Commands for Database Inspection

### 1. Database Connection & Basic Info

```bash
# Test database connection
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();"

# Check database size
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT pg_size_pretty(pg_database_size('lto_blockchain')) as database_size;"

# List all databases
docker exec postgres psql -U lto_user -d lto_blockchain -c "\l"
```

### 2. List All Tables

```bash
# List all tables in public schema
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"

# List all tables with row counts
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT schemaname, relname as tablename, n_tup_ins as inserts, n_tup_upd as updates, n_live_tup as rows FROM pg_stat_user_tables ORDER BY relname;"

# List all tables with detailed info
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

### 3. Table Schemas (Column Definitions)

```bash
# View schema for a specific table (replace TABLE_NAME)
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d TABLE_NAME"

# View all columns for all tables
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;"

# View all tables with their column counts
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, COUNT(*) as column_count FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name ORDER BY table_name;"

# Verify address column exists in users table
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'address';"
```

### 4. Users Table

```bash
# Count total users
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_users FROM users;"

# List all users (without password hashes)
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, email, first_name, last_name, role, organization, phone, address, is_active, email_verified, created_at FROM users ORDER BY created_at;"

# Count users by role
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC;"

# List users with email verification status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, email_verified, is_active FROM users ORDER BY role, email;"

# Check specific user accounts
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, first_name, last_name, role, organization, phone, address, is_active, email_verified FROM users WHERE email IN ('admin@lto.gov.ph', 'insurance@lto.gov.ph', 'emission@lto.gov.ph', 'staff@lto.gov.ph', 'owner@example.com') ORDER BY email;"
```

### 5. Vehicles Table

```bash
# Count total vehicles
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_vehicles FROM vehicles;"

# List all vehicles
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vin, plate_number, make, model, year, status, owner_id, registration_date FROM vehicles ORDER BY registration_date DESC LIMIT 20;"

# Count vehicles by status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT status, COUNT(*) as count FROM vehicles GROUP BY status ORDER BY count DESC;"

# List vehicles with owner information
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT v.vin, v.plate_number, v.make, v.model, v.status, u.email as owner_email, u.first_name || ' ' || u.last_name as owner_name FROM vehicles v LEFT JOIN users u ON v.owner_id = u.id ORDER BY v.registration_date DESC LIMIT 20;"
```

### 6. Transfer Requests Table

```bash
# Count transfer requests
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_transfers FROM transfer_requests;"

# List all transfer requests
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vehicle_id, seller_id, buyer_id, status, submitted_at, reviewed_at FROM transfer_requests ORDER BY submitted_at DESC LIMIT 20;"

# Count transfers by status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT status, COUNT(*) as count FROM transfer_requests GROUP BY status ORDER BY count DESC;"

# List transfers with vehicle and user info
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tr.id, v.vin, v.plate_number, tr.status, tr.submitted_at, seller.email as seller_email, buyer.email as buyer_email FROM transfer_requests tr JOIN vehicles v ON tr.vehicle_id = v.id LEFT JOIN users seller ON tr.seller_id = seller.id LEFT JOIN users buyer ON tr.buyer_id = buyer.id ORDER BY tr.submitted_at DESC LIMIT 20;"
```

### 7. Clearance Requests Table

```bash
# Count clearance requests
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_clearances FROM clearance_requests;"

# List all clearance requests
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vehicle_id, request_type, status, requested_at, assigned_to, completed_at FROM clearance_requests ORDER BY requested_at DESC LIMIT 20;"

# Count clearances by type and status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT request_type, status, COUNT(*) as count FROM clearance_requests GROUP BY request_type, status ORDER BY request_type, status;"
```

### 8. Documents Table

```bash
# Count total documents
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_documents FROM documents;"

# List documents with vehicle info
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT d.id, d.document_type, d.filename, d.verified, v.vin, v.plate_number, d.uploaded_at FROM documents d LEFT JOIN vehicles v ON d.vehicle_id = v.id ORDER BY d.uploaded_at DESC LIMIT 20;"

# Count documents by type
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT document_type, COUNT(*) as count, COUNT(CASE WHEN verified = true THEN 1 END) as verified_count FROM documents GROUP BY document_type ORDER BY count DESC;"
```

### 9. Vehicle History Table

```bash
# Count history records
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_history FROM vehicle_history;"

# List recent history records
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vehicle_id, action, description, performed_at, transaction_id FROM vehicle_history ORDER BY performed_at DESC LIMIT 20;"

# Count actions by type
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT action, COUNT(*) as count FROM vehicle_history GROUP BY action ORDER BY count DESC;"
```

### 10. Refresh Tokens & Sessions

```bash
# Count active refresh tokens
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_tokens, COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_tokens FROM refresh_tokens;"

# List active sessions
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT s.id, u.email, s.ip_address, s.created_at, s.last_activity, s.expires_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > CURRENT_TIMESTAMP ORDER BY s.last_activity DESC LIMIT 20;"

# Count sessions by user
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT u.email, COUNT(*) as session_count FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > CURRENT_TIMESTAMP GROUP BY u.email ORDER BY session_count DESC;"
```

### 11. Certificates Table

```bash
# Count certificates
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as total_certificates FROM certificates;"

# List certificates
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, certificate_type, certificate_number, status, issued_at, expires_at FROM certificates ORDER BY issued_at DESC LIMIT 20;"

# Count certificates by type and status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT certificate_type, status, COUNT(*) as count FROM certificates GROUP BY certificate_type, status ORDER BY certificate_type, status;"
```

### 12. Indexes

```bash
# List all indexes
docker exec postgres psql -U lto_user -d lto_blockchain -c "\di"

# List indexes with table names
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;"

# Count indexes per table
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tablename, COUNT(*) as index_count FROM pg_indexes WHERE schemaname = 'public' GROUP BY tablename ORDER BY index_count DESC;"
```

### 13. Foreign Keys & Constraints

```bash
# List all foreign key constraints
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, kcu.column_name;"

# List all constraints
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema = 'public' ORDER BY table_name, constraint_type;"
```

### 14. Functions & Triggers

```bash
# List all functions
docker exec postgres psql -U lto_user -d lto_blockchain -c "\df"

# List all triggers
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;"
```

### 15. Extensions

```bash
# List installed extensions
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dx"

# Check if specific extensions exist
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'plpgsql') ORDER BY extname;"
```

### 16. Complete Database Summary

```bash
# Get complete database summary
docker exec postgres psql -U lto_user -d lto_blockchain << 'EOF'
-- Database Summary
SELECT '=== DATABASE SUMMARY ===' as info;

-- Table counts
SELECT '--- TABLE ROW COUNTS ---' as info;
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY tablename;

-- User summary
SELECT '--- USERS SUMMARY ---' as info;
SELECT 
    role,
    COUNT(*) as count,
    COUNT(CASE WHEN email_verified = true THEN 1 END) as verified,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active
FROM users
GROUP BY role
ORDER BY role;

-- Vehicle summary
SELECT '--- VEHICLES SUMMARY ---' as info;
SELECT 
    status,
    COUNT(*) as count
FROM vehicles
GROUP BY status
ORDER BY status;

-- Transfer summary
SELECT '--- TRANSFERS SUMMARY ---' as info;
SELECT 
    status,
    COUNT(*) as count
FROM transfer_requests
GROUP BY status
ORDER BY status;

-- Clearance summary
SELECT '--- CLEARANCES SUMMARY ---' as info;
SELECT 
    request_type,
    status,
    COUNT(*) as count
FROM clearance_requests
GROUP BY request_type, status
ORDER BY request_type, status;
EOF
```

### 17. Check for Missing Tables

```bash
# Check if critical tables exist
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) THEN 'EXISTS' ELSE 'MISSING' END as status FROM (VALUES ('users'), ('vehicles'), ('documents'), ('vehicle_history'), ('transfer_requests'), ('clearance_requests'), ('certificates'), ('refresh_tokens'), ('sessions'), ('token_blacklist'), ('email_verification_tokens')) AS t(table_name);"
```

### 18. Check Table Relationships

```bash
# Check foreign key relationships
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;"
```

### 19. Export Data (Optional)

```bash
# Export all data to SQL file
docker exec postgres pg_dump -U lto_user -d lto_blockchain --data-only --inserts > database_backup_$(date +%Y%m%d_%H%M%S).sql

# Export schema only
docker exec postgres pg_dump -U lto_user -d lto_blockchain --schema-only > schema_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 20. Quick Health Check

```bash
# Quick health check - run all critical checks
docker exec postgres psql -U lto_user -d lto_blockchain << 'EOF'
SELECT '✅ Database Connection: OK' as status;
SELECT 'Users: ' || COUNT(*)::text FROM users;
SELECT 'Vehicles: ' || COUNT(*)::text FROM vehicles;
SELECT 'Transfer Requests: ' || COUNT(*)::text FROM transfer_requests;
SELECT 'Clearance Requests: ' || COUNT(*)::text FROM clearance_requests;
SELECT 'Documents: ' || COUNT(*)::text FROM documents;
SELECT 'Active Sessions: ' || COUNT(*)::text FROM sessions WHERE expires_at > CURRENT_TIMESTAMP;
EOF
```

---

## Quick Reference

**Most Common Commands:**
```bash
# List all tables
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"

# Check users
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, is_active, email_verified FROM users;"

# Check vehicles
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM vehicles;"

# Complete summary
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT 'Users: ' || COUNT(*)::text FROM users UNION ALL SELECT 'Vehicles: ' || COUNT(*)::text FROM vehicles UNION ALL SELECT 'Transfers: ' || COUNT(*)::text FROM transfer_requests UNION ALL SELECT 'Clearances: ' || COUNT(*)::text FROM clearance_requests;"
```

---

## Notes

- All commands assume you're in the `~/LTOBLOCKCHAIN` directory
- Replace `TABLE_NAME` with actual table names when using schema inspection commands
- Use `LIMIT` clauses to avoid overwhelming output for large tables
- For production databases, be cautious with `SELECT *` on large tables
- Some commands may take longer on large datasets
- The database structure shown above reflects the current state after all migrations have been applied

---

## Address Column Migration

**Important:** If the address column is missing from the `users` table, run this migration:

```bash
# Add address column to users table (if missing)
docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);"

# Verify the column was added
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d users"
```

**Note:** This migration should also be added to `database/init-laptop.sql` for new installations.

## Database Functions

### Cleanup Functions
- `cleanup_expired_tokens()` - Cleans up expired refresh tokens and sessions
- `cleanup_expired_blacklist()` - Cleans up expired blacklist entries
- `cleanup_expired_verification_tokens()` - Cleans up expired email verification tokens

### Update Functions
- `update_updated_at_column()` - Updates `updated_at` or `last_updated` timestamps on UPDATE
- `update_clearance_requests_updated_at()` - Updates `updated_at` for clearance_requests
- `update_transfer_requests_updated_at()` - Updates `updated_at` for transfer_requests

---

## Complete Database Inspection (Single Command)

**Copy and paste this single command to inspect everything in the database:**

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "
-- ============================================
-- COMPLETE DATABASE INSPECTION
-- ============================================

-- DATABASE CONNECTION & BASIC INFO
SELECT 'PostgreSQL Version' as info, version() as value;
SELECT 'Database Size' as info, pg_size_pretty(pg_database_size('lto_blockchain')) as value;

-- TABLES & VIEWS LIST
SELECT 'Tables & Views' as section, table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_type, table_name;

-- TABLE ROW COUNTS
SELECT 'Row Counts' as section, schemaname, relname as tablename, n_live_tup as row_count FROM pg_stat_user_tables ORDER BY relname;

-- USERS TABLE
SELECT 'Users Count' as info, COUNT(*)::text as value FROM users;
SELECT 'Users List' as section, email, first_name, last_name, role, organization, phone, COALESCE(address, 'NULL') as address, is_active, email_verified FROM users ORDER BY created_at;
SELECT 'Users by Role' as section, role, COUNT(*) as count, COUNT(CASE WHEN email_verified = true THEN 1 END) as verified, COUNT(CASE WHEN is_active = true THEN 1 END) as active FROM users GROUP BY role ORDER BY role;

-- ADDRESS COLUMN VERIFICATION
SELECT 'Address Column Status' as section, 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'address') 
        THEN 'EXISTS' 
        ELSE 'MISSING - Run migration: ALTER TABLE users ADD COLUMN address VARCHAR(500);'
    END as status;

-- VEHICLES TABLE
SELECT 'Vehicles Count' as info, COUNT(*)::text as value FROM vehicles;
SELECT 'Vehicles by Status' as section, status, COUNT(*) as count FROM vehicles GROUP BY status ORDER BY status;
SELECT 'Recent Vehicles' as section, v.vin, v.plate_number, v.make, v.model, v.year, v.status, u.email as owner_email FROM vehicles v LEFT JOIN users u ON v.owner_id = u.id ORDER BY v.registration_date DESC LIMIT 10;

-- TRANSFER REQUESTS
SELECT 'Transfer Requests Count' as info, COUNT(*)::text as value FROM transfer_requests;
SELECT 'Transfers by Status' as section, status, COUNT(*) as count FROM transfer_requests GROUP BY status ORDER BY status;
SELECT 'Recent Transfers' as section, tr.id, v.vin, v.plate_number, tr.status, tr.submitted_at, seller.email as seller_email, buyer.email as buyer_email FROM transfer_requests tr JOIN vehicles v ON tr.vehicle_id = v.id LEFT JOIN users seller ON tr.seller_id = seller.id LEFT JOIN users buyer ON tr.buyer_id = buyer.id ORDER BY tr.submitted_at DESC LIMIT 10;

-- CLEARANCE REQUESTS
SELECT 'Clearance Requests Count' as info, COUNT(*)::text as value FROM clearance_requests;
SELECT 'Clearances by Type/Status' as section, request_type, status, COUNT(*) as count FROM clearance_requests GROUP BY request_type, status ORDER BY request_type, status;

-- DOCUMENTS
SELECT 'Documents Count' as info, COUNT(*)::text as value FROM documents;
SELECT 'Documents by Type' as section, document_type, COUNT(*) as count, COUNT(CASE WHEN verified = true THEN 1 END) as verified_count FROM documents GROUP BY document_type ORDER BY count DESC;

-- VEHICLE HISTORY
SELECT 'History Count' as info, COUNT(*)::text as value FROM vehicle_history;
SELECT 'History by Action' as section, action, COUNT(*) as count FROM vehicle_history GROUP BY action ORDER BY count DESC LIMIT 10;

-- CERTIFICATES
SELECT 'Certificates Count' as info, COUNT(*)::text as value FROM certificates;
SELECT 'Certificates by Type/Status' as section, certificate_type, status, COUNT(*) as count FROM certificates GROUP BY certificate_type, status ORDER BY certificate_type, status;

-- AUTHENTICATION TABLES
SELECT 'Refresh Tokens' as info, COUNT(*)::text || ' total, ' || COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END)::text || ' active' as value FROM refresh_tokens;
SELECT 'Sessions' as info, COUNT(*)::text || ' total, ' || COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END)::text || ' active' as value FROM sessions;
SELECT 'Blacklisted Tokens' as info, COUNT(*)::text as value FROM token_blacklist;
SELECT 'Verification Tokens' as info, COUNT(*)::text as value FROM email_verification_tokens;

-- NOTIFICATIONS
SELECT 'Notifications' as info, COUNT(*)::text || ' total, ' || COUNT(CASE WHEN read = false THEN 1 END)::text || ' unread' as value FROM notifications;

-- USERS TABLE SCHEMA
SELECT 'Users Schema' as section, column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position;

-- INDEXES
SELECT 'Indexes' as section, tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- EXTENSIONS
SELECT 'Extensions' as section, extname, extversion FROM pg_extension ORDER BY extname;

-- COMPLETE SUMMARY
SELECT 'SUMMARY' as section, 'Users' as table_name, COUNT(*)::text as count FROM users
UNION ALL SELECT 'SUMMARY', 'Vehicles', COUNT(*)::text FROM vehicles
UNION ALL SELECT 'SUMMARY', 'Transfer Requests', COUNT(*)::text FROM transfer_requests
UNION ALL SELECT 'SUMMARY', 'Clearance Requests', COUNT(*)::text FROM clearance_requests
UNION ALL SELECT 'SUMMARY', 'Documents', COUNT(*)::text FROM documents
UNION ALL SELECT 'SUMMARY', 'Certificates', COUNT(*)::text FROM certificates
UNION ALL SELECT 'SUMMARY', 'Vehicle History', COUNT(*)::text FROM vehicle_history
UNION ALL SELECT 'SUMMARY', 'Notifications', COUNT(*)::text FROM notifications
UNION ALL SELECT 'SUMMARY', 'Refresh Tokens', COUNT(*)::text FROM refresh_tokens
UNION ALL SELECT 'SUMMARY', 'Sessions', COUNT(*)::text FROM sessions
ORDER BY table_name;
"

**Usage:** Simply copy the entire command block above and paste it into your SSH terminal. It will display all database information in a structured format.

## Last Updated

This document reflects the database structure as of the latest migration (transfer_requests, clearance_requests, certificates, refresh_tokens, sessions, token_blacklist, email_verification_tokens).






ONE TIME

# ============================================
# COMPREHENSIVE DATABASE VERIFICATION
# ============================================

echo "============================================"
echo "DATABASE VERIFICATION REPORT"
echo "============================================"
echo ""

# Check database connection
echo "1. Database Connection:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();" 2>/dev/null && echo "✅ Connected" || echo "❌ Connection failed"
echo ""

# Check all tables
echo "2. All Tables:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "public|Schema"
echo ""

# Check table counts
echo "3. Table Record Counts:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'certificates', COUNT(*) FROM certificates
UNION ALL
SELECT 'clearance_requests', COUNT(*) FROM clearance_requests
UNION ALL
SELECT 'transfer_requests', COUNT(*) FROM transfer_requests
UNION ALL
SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'token_blacklist', COUNT(*) FROM token_blacklist;
"
echo ""

# Check document_type enum values
echo "4. Document Type Enum Values:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') 
ORDER BY enumsortorder;
"
echo ""

# Check if 'other' type exists
echo "5. Checking for 'other' document type:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT EXISTS(
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'other' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type')
) as other_exists;
"
echo ""

# Check vehicles status distribution
echo "6. Vehicles by Status:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT status, COUNT(*) as count 
FROM vehicles 
GROUP BY status 
ORDER BY count DESC;
"
echo ""

# Check critical columns exist
echo "7. Checking Critical Columns:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'certificates' 
        AND column_name = 'file_hash'
    ) THEN '✅ certificates.file_hash' ELSE '❌ certificates.file_hash MISSING' END as file_hash_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'certificates' 
        AND column_name = 'composite_hash'
    ) THEN '✅ certificates.composite_hash' ELSE '❌ certificates.composite_hash MISSING' END as composite_hash_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'certificates' 
        AND column_name = 'blockchain_tx_id'
    ) THEN '✅ certificates.blockchain_tx_id' ELSE '❌ certificates.blockchain_tx_id MISSING' END as blockchain_tx_check;
"
echo ""

# Check functions exist
echo "8. Checking Critical Functions:"
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_blacklist'
    ) THEN '✅ cleanup_expired_blacklist()' ELSE '❌ cleanup_expired_blacklist() MISSING' END as cleanup_func_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_tokens'
    ) THEN '✅ cleanup_expired_tokens()' ELSE '❌ cleanup_expired_tokens() MISSING' END as tokens_func_check;
"
echo ""

echo "============================================"
echo "VERIFICATION COMPLETE"
echo "============================================"