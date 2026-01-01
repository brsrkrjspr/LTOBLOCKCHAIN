# TrustChain LTO - Database Schema Summary

## Overview
This document provides a comprehensive summary of all database tables, columns, relationships, and indexes in the TrustChain LTO Blockchain Vehicle Registration System.

**Database Name:** `lto_blockchain`  
**Database Engine:** PostgreSQL 15  
**Extensions:** `uuid-ossp`, `pg_trgm`

**Last Verified:** Based on migration files and codebase analysis (January 2026)  
**Note:** Some columns may have been added via application code. To verify actual schema, run `\d table_name` in psql or use the verification queries below.

---

## Custom Types (ENUMs)

### `user_role`
- `admin`
- `staff`
- `insurance_verifier`
- `emission_verifier`
- `vehicle_owner`

### `verification_status`
- `PENDING`
- `APPROVED`
- `REJECTED`

### `vehicle_status`
- `SUBMITTED`
- `PENDING_BLOCKCHAIN`
- `REGISTERED`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

### `document_type`
- `registration_cert`
- `insurance_cert`
- `emission_cert`
- `owner_id`
- `valid_id`
- `deed_of_sale`
- `hpg_clearance`
- `other`

---

## Core Tables

### 1. `users`
**Purpose:** System users with role-based access control

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| `password_hash` | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| `first_name` | VARCHAR(100) | NOT NULL | User's first name |
| `last_name` | VARCHAR(100) | NOT NULL | User's last name |
| `role` | user_role | NOT NULL, DEFAULT 'vehicle_owner' | User role (ENUM) |
| `organization` | VARCHAR(255) | | Organization name |
| `phone` | VARCHAR(20) | | Phone number |
| `address` | TEXT | | Physical address |
| `is_active` | BOOLEAN | DEFAULT true | Account active status |
| `email_verified` | BOOLEAN | DEFAULT false | Email verification status |
| `two_factor_enabled` | BOOLEAN | DEFAULT false | 2FA enabled flag |
| `last_login` | TIMESTAMP | | Last login timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_users_email` ON `email`
- `idx_users_role` ON `role`
- `idx_users_active` ON `is_active`

**Relationships:**
- Referenced by: `vehicles.owner_id`, `vehicle_verifications.verified_by`, `documents.uploaded_by`, `vehicle_history.performed_by`, `notifications.user_id`, `transfer_requests.seller_id`, `transfer_requests.buyer_id`, `clearance_requests.requested_by`, `clearance_requests.assigned_to`, `certificates.issued_by`

---

### 2. `vehicles`
**Purpose:** Vehicle registration data with blockchain integration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique vehicle identifier |
| `vin` | VARCHAR(17) | UNIQUE, NOT NULL | Vehicle Identification Number |
| `plate_number` | VARCHAR(20) | UNIQUE | License plate number |
| `make` | VARCHAR(50) | NOT NULL | Vehicle manufacturer |
| `model` | VARCHAR(50) | NOT NULL | Vehicle model |
| `year` | INTEGER | NOT NULL | Manufacturing year |
| `color` | VARCHAR(30) | | Vehicle color |
| `engine_number` | VARCHAR(50) | | Engine serial number |
| `chassis_number` | VARCHAR(50) | | Chassis serial number |
| `vehicle_type` | VARCHAR(30) | DEFAULT 'PASSENGER' | Vehicle type |
| `fuel_type` | VARCHAR(20) | DEFAULT 'GASOLINE' | Fuel type |
| `transmission` | VARCHAR(20) | DEFAULT 'MANUAL' | Transmission type |
| `engine_displacement` | VARCHAR(20) | | Engine displacement |
| `owner_id` | UUID | REFERENCES users(id) | Current vehicle owner |
| `status` | vehicle_status | DEFAULT 'SUBMITTED' | Registration status (ENUM) |
| `registration_date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Registration date |
| `last_updated` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |
| `priority` | VARCHAR(10) | DEFAULT 'MEDIUM' | Processing priority |
| `notes` | TEXT | | Administrative notes |
| `or_cr_number` | VARCHAR(50) | UNIQUE | Official Receipt/Certificate number |
| `or_cr_issued_at` | TIMESTAMP | | OR/CR issuance timestamp |
| `or_number` | VARCHAR(50) | UNIQUE | Official Receipt number (separate) |
| `cr_number` | VARCHAR(50) | UNIQUE | Certificate of Registration number (separate) |
| `or_issued_at` | TIMESTAMP | | OR issuance timestamp |
| `cr_issued_at` | TIMESTAMP | | CR issuance timestamp |
| `blockchain_tx_id` | VARCHAR(255) | | Hyperledger Fabric transaction ID |
| `date_of_registration` | TIMESTAMP | | Date of vehicle registration |
| `registration_type` | VARCHAR(20) | DEFAULT 'PRIVATE' | Registration type |
| `expiry_date` | TIMESTAMP | | Registration expiry date |
| `mv_file_number` | VARCHAR(50) | | Motor Vehicle file number |
| `piston_displacement` | VARCHAR(20) | | Engine displacement (alternative) |
| `gross_weight` | VARCHAR(20) | | Gross vehicle weight |
| `net_weight` | DECIMAL(10,2) | | Net vehicle weight in kilograms |
| `vehicle_classification` | VARCHAR(50) | | Vehicle classification |
| `payment_mode` | VARCHAR(20) | | Payment method |
| `amount_paid` | DECIMAL | | Registration fee amount |
| `payment_purpose` | VARCHAR(100) | | Payment purpose |
| `issuing_office` | VARCHAR(100) | | LTO office that issued registration |
| `inspection_date` | TIMESTAMP | | Vehicle inspection date |
| `mvir_number` | VARCHAR(50) | UNIQUE | Motor Vehicle Inspection Report number |
| `inspection_result` | VARCHAR(20) | | Inspection result: PASS, FAIL, PENDING |
| `roadworthiness_status` | VARCHAR(20) | | Roadworthiness status: ROADWORTHY, NOT_ROADWORTHY |
| `emission_compliance` | VARCHAR(20) | | Emission compliance: COMPLIANT, NON_COMPLIANT |
| `inspection_officer` | VARCHAR(100) | | Name of inspecting officer |
| `inspection_notes` | TEXT | | Inspection notes and remarks |

**Indexes:**
- `idx_vehicles_vin` ON `vin`
- `idx_vehicles_plate` ON `plate_number`
- `idx_vehicles_owner` ON `owner_id`
- `idx_vehicles_status` ON `status`
- `idx_vehicles_make_model` ON `make, model`
- `idx_vehicles_or_cr_number` ON `or_cr_number`
- `idx_vehicles_or_number` ON `or_number`
- `idx_vehicles_cr_number` ON `cr_number`
- `idx_vehicles_date_of_registration` ON `date_of_registration`
- `idx_vehicles_active` ON `id` WHERE `status IN ('SUBMITTED', 'REGISTERED')` (partial index)

**Relationships:**
- References: `users.id` (via `owner_id`)
- Referenced by: `vehicle_verifications.vehicle_id`, `documents.vehicle_id`, `vehicle_history.vehicle_id`, `transfer_requests.vehicle_id`, `clearance_requests.vehicle_id`, `certificates.vehicle_id`

---

### 3. `vehicle_verifications`
**Purpose:** Verification status for insurance, emission, and admin approval

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique verification record ID |
| `vehicle_id` | UUID | REFERENCES vehicles(id) ON DELETE CASCADE, NOT NULL | Vehicle being verified |
| `verification_type` | VARCHAR(20) | NOT NULL | Type: 'insurance', 'emission', 'hpg' |
| `status` | verification_status | DEFAULT 'PENDING' | Verification status (ENUM) |
| `verified_by` | UUID | REFERENCES users(id) | User who verified |
| `verified_at` | TIMESTAMP | | Verification timestamp |
| `notes` | TEXT | | Verification notes |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| `clearance_request_id` | UUID | REFERENCES clearance_requests(id) ON DELETE SET NULL | Related clearance request |

**Constraints:**
- UNIQUE(`vehicle_id`, `verification_type`)

**Indexes:**
- `idx_verifications_vehicle` ON `vehicle_id`
- `idx_verifications_type` ON `verification_type`
- `idx_verifications_status` ON `status`
- `idx_verifications_clearance_request` ON `clearance_request_id`

**Relationships:**
- References: `vehicles.id`, `users.id` (via `verified_by`), `clearance_requests.id`

---

### 4. `documents`
**Purpose:** Document metadata for file storage (local or IPFS)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique document ID |
| `vehicle_id` | UUID | REFERENCES vehicles(id) ON DELETE CASCADE | Associated vehicle |
| `document_type` | document_type | NOT NULL | Document type (ENUM) |
| `filename` | VARCHAR(255) | NOT NULL | Stored filename |
| `original_name` | VARCHAR(255) | NOT NULL | Original uploaded filename |
| `file_path` | VARCHAR(500) | NOT NULL | Local file storage path |
| `file_size` | BIGINT | NOT NULL | File size in bytes |
| `mime_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_hash` | VARCHAR(64) | NOT NULL | SHA-256 file hash |
| `uploaded_by` | UUID | REFERENCES users(id) | User who uploaded |
| `uploaded_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |
| `verified` | BOOLEAN | DEFAULT false | Document verification status |
| `verified_at` | TIMESTAMP | | Verification timestamp |
| `verified_by` | UUID | REFERENCES users(id) | User who verified document |
| `ipfs_cid` | VARCHAR(255) | | IPFS Content Identifier |

**Indexes:**
- `idx_documents_vehicle` ON `vehicle_id`
- `idx_documents_type` ON `document_type`
- `idx_documents_hash` ON `file_hash`
- `idx_documents_ipfs_cid` ON `ipfs_cid`
- `idx_documents_unverified` ON `id` WHERE `verified = false` (partial index)

**Relationships:**
- References: `vehicles.id`, `users.id` (via `uploaded_by`, `verified_by`)

---

### 5. `vehicle_history`
**Purpose:** Audit trail for all vehicle-related actions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique history record ID |
| `vehicle_id` | UUID | REFERENCES vehicles(id) ON DELETE CASCADE, NOT NULL | Vehicle this record belongs to |
| `action` | VARCHAR(50) | NOT NULL | Action type (e.g., 'BLOCKCHAIN_REGISTERED', 'SUBMITTED', 'APPROVED', 'OWNERSHIP_TRANSFERRED') |
| `description` | TEXT | | Action description |
| `performed_by` | UUID | REFERENCES users(id) | User who performed action |
| `performed_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Action timestamp |
| `transaction_id` | VARCHAR(255) | | Hyperledger Fabric transaction ID |
| `metadata` | JSONB | | Additional metadata (JSON) |

**Indexes:**
- `idx_history_vehicle` ON `vehicle_id`
- `idx_history_action` ON `action`
- `idx_history_performed_by` ON `performed_by`
- `idx_history_performed_at` ON `performed_at`

**Relationships:**
- References: `vehicles.id`, `users.id` (via `performed_by`)

**Common Action Types:**
- `SUBMITTED` - Application submitted
- `BLOCKCHAIN_REGISTERED` - Registered on blockchain
- `APPROVED` - Application approved
- `REJECTED` - Application rejected
- `OWNERSHIP_TRANSFERRED` - Ownership transferred
- `VERIFICATION_APPROVED` - Verification approved
- `STATUS_UPDATED` - Status changed

---

### 6. `notifications`
**Purpose:** User notifications and alerts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique notification ID |
| `user_id` | UUID | REFERENCES users(id) ON DELETE CASCADE, NOT NULL | Recipient user |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `message` | TEXT | NOT NULL | Notification message |
| `type` | VARCHAR(50) | DEFAULT 'info' | Notification type |
| `read` | BOOLEAN | DEFAULT false | Read status |
| `sent_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Sent timestamp |
| `read_at` | TIMESTAMP | | Read timestamp |

**Indexes:**
- `idx_notifications_user` ON `user_id`
- `idx_notifications_read` ON `read`
- `idx_notifications_sent_at` ON `sent_at`
- `idx_notifications_unread` ON `id` WHERE `read = false` (partial index)

**Relationships:**
- References: `users.id`

---

### 7. `system_settings`
**Purpose:** System configuration settings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | VARCHAR(100) | PRIMARY KEY | Setting key |
| `value` | TEXT | NOT NULL | Setting value |
| `description` | TEXT | | Setting description |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |
| `updated_by` | UUID | REFERENCES users(id) | User who updated |

**Relationships:**
- References: `users.id` (via `updated_by`)

**Default Settings:**
- `system_name`: 'TrustChain LTO'
- `version`: '1.0.0'
- `maintenance_mode`: 'false'
- `max_file_size`: '10485760' (10MB)
- `allowed_file_types`: 'pdf,jpg,jpeg,png'
- `blockchain_mode`: 'fabric'
- `storage_mode`: 'local' or 'ipfs'

---

## Transfer of Ownership Tables

### 8. `transfer_requests`
**Purpose:** Tracks vehicle ownership transfer requests

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique transfer request ID |
| `vehicle_id` | UUID | REFERENCES vehicles(id) ON DELETE CASCADE, NOT NULL | Vehicle being transferred |
| `seller_id` | UUID | REFERENCES users(id), NOT NULL | Current owner (seller) |
| `buyer_id` | UUID | REFERENCES users(id) | New owner (buyer) - can be NULL |
| `buyer_info` | JSONB | | Buyer information if not a system user |
| `status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FORWARDED_TO_HPG') | Transfer status |
| `submitted_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Submission timestamp |
| `reviewed_by` | UUID | REFERENCES users(id) | Admin who reviewed |
| `reviewed_at` | TIMESTAMP | | Review timestamp |
| `rejection_reason` | TEXT | | Rejection reason if rejected |
| `forwarded_to_hpg` | BOOLEAN | DEFAULT false | Forwarded to HPG flag |
| `hpg_clearance_request_id` | UUID | REFERENCES clearance_requests(id) | Related HPG clearance request |
| `metadata` | JSONB | DEFAULT '{}' | Additional data |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |
| `hpg_approval_status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN ('PENDING', 'APPROVED', 'REJECTED') | HPG organization approval status |
| `insurance_approval_status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN ('PENDING', 'APPROVED', 'REJECTED') | Insurance organization approval status |
| `emission_approval_status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN ('PENDING', 'APPROVED', 'REJECTED') | Emission organization approval status |
| `hpg_approved_at` | TIMESTAMP | | HPG approval timestamp |
| `insurance_approved_at` | TIMESTAMP | | Insurance approval timestamp |
| `emission_approved_at` | TIMESTAMP | | Emission approval timestamp |
| `hpg_approved_by` | UUID | REFERENCES users(id) | User who approved HPG clearance |
| `insurance_approved_by` | UUID | REFERENCES users(id) | User who approved insurance |
| `emission_approved_by` | UUID | REFERENCES users(id) | User who approved emission |
| `insurance_clearance_request_id` | UUID | REFERENCES clearance_requests(id) | Related insurance clearance request |
| `emission_clearance_request_id` | UUID | REFERENCES clearance_requests(id) | Related emission clearance request |

**Indexes:**
- `idx_transfer_vehicle` ON `vehicle_id`
- `idx_transfer_seller` ON `seller_id`
- `idx_transfer_buyer` ON `buyer_id`
- `idx_transfer_status` ON `status`
- `idx_transfer_submitted_at` ON `submitted_at`
- `idx_transfer_reviewed_by` ON `reviewed_by`
- `idx_transfer_hpg_approval` ON `hpg_approval_status`
- `idx_transfer_insurance_approval` ON `insurance_approval_status`
- `idx_transfer_emission_approval` ON `emission_approval_status`

**Relationships:**
- References: `vehicles.id`, `users.id` (via `seller_id`, `buyer_id`, `reviewed_by`, `hpg_approved_by`, `insurance_approved_by`, `emission_approved_by`), `clearance_requests.id` (via `hpg_clearance_request_id`, `insurance_clearance_request_id`, `emission_clearance_request_id`)

---

### 9. `transfer_documents`
**Purpose:** Links documents to transfer requests

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique transfer document ID |
| `transfer_request_id` | UUID | REFERENCES transfer_requests(id) ON DELETE CASCADE, NOT NULL | Transfer request |
| `document_type` | VARCHAR(30) | NOT NULL, CHECK IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other') | Document type |
| `document_id` | UUID | REFERENCES documents(id) ON DELETE SET NULL | Link to documents table |
| `uploaded_by` | UUID | REFERENCES users(id), NOT NULL | User who uploaded |
| `uploaded_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |
| `notes` | TEXT | | Additional notes |

**Indexes:**
- `idx_transfer_docs_request` ON `transfer_request_id`
- `idx_transfer_docs_type` ON `document_type`
- `idx_transfer_docs_document` ON `document_id`

**Relationships:**
- References: `transfer_requests.id`, `documents.id`, `users.id`

---

### 10. `transfer_verifications`
**Purpose:** Document verification records for transfer requests

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique verification ID |
| `transfer_request_id` | UUID | REFERENCES transfer_requests(id) ON DELETE CASCADE, NOT NULL | Transfer request |
| `document_id` | UUID | REFERENCES documents(id) ON DELETE SET NULL | Document being verified |
| `verified_by` | UUID | REFERENCES users(id), NOT NULL | User who verified |
| `status` | VARCHAR(20) | NOT NULL, CHECK IN ('APPROVED', 'REJECTED', 'PENDING') | Verification status |
| `notes` | TEXT | | Verification notes |
| `checklist` | JSONB | DEFAULT '{}' | Verification checklist items |
| `flagged` | BOOLEAN | DEFAULT false | Suspicious document flag |
| `verified_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Verification timestamp |

**Indexes:**
- `idx_transfer_verif_request` ON `transfer_request_id`
- `idx_transfer_verif_document` ON `document_id`
- `idx_transfer_verif_status` ON `status`
- `idx_transfer_verif_verified_by` ON `verified_by`

**Relationships:**
- References: `transfer_requests.id`, `documents.id`, `users.id`

---

## Clearance Workflow Tables

### 11. `clearance_requests`
**Purpose:** Tracks clearance requests sent to external organizations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique clearance request ID |
| `vehicle_id` | UUID | REFERENCES vehicles(id) ON DELETE CASCADE, NOT NULL | Vehicle needing clearance |
| `request_type` | VARCHAR(20) | NOT NULL, CHECK IN ('hpg', 'insurance', 'emission') | Clearance type |
| `status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN ('PENDING', 'SENT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'COMPLETED') | Request status |
| `requested_by` | UUID | REFERENCES users(id), NOT NULL | User who requested |
| `requested_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Request timestamp |
| `assigned_to` | UUID | REFERENCES users(id) | Verifier assigned |
| `completed_at` | TIMESTAMP | | Completion timestamp |
| `certificate_id` | UUID | REFERENCES certificates(id) ON DELETE SET NULL | Related certificate |
| `purpose` | VARCHAR(255) | | Purpose of clearance |
| `notes` | TEXT | | Additional notes |
| `metadata` | JSONB | DEFAULT '{}' | Additional data (engine number, chassis number, etc.) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_clearance_vehicle` ON `vehicle_id`
- `idx_clearance_type` ON `request_type`
- `idx_clearance_status` ON `status`
- `idx_clearance_assigned` ON `assigned_to`
- `idx_clearance_requested_by` ON `requested_by`
- `idx_clearance_created_at` ON `created_at`

**Relationships:**
- References: `vehicles.id`, `users.id` (via `requested_by`, `assigned_to`), `certificates.id`

---

### 12. `certificates`
**Purpose:** Stores certificates issued by external organizations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique certificate ID |
| `clearance_request_id` | UUID | REFERENCES clearance_requests(id) ON DELETE SET NULL | Related clearance request |
| `vehicle_id` | UUID | REFERENCES vehicles(id) ON DELETE CASCADE, NOT NULL | Vehicle this certificate is for |
| `certificate_type` | VARCHAR(20) | NOT NULL, CHECK IN ('hpg_clearance', 'insurance', 'emission') | Certificate type |
| `certificate_number` | VARCHAR(50) | UNIQUE, NOT NULL | Certificate number |
| `file_path` | VARCHAR(500) | | Local file path |
| `ipfs_cid` | VARCHAR(255) | | IPFS Content Identifier |
| `issued_by` | UUID | REFERENCES users(id), NOT NULL | User who issued |
| `issued_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Issuance timestamp |
| `expires_at` | TIMESTAMP | | Expiration timestamp |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE', CHECK IN ('ACTIVE', 'EXPIRED', 'REVOKED') | Certificate status |
| `metadata` | JSONB | DEFAULT '{}' | Additional metadata |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- `idx_certificates_request` ON `clearance_request_id`
- `idx_certificates_vehicle` ON `vehicle_id`
- `idx_certificates_type` ON `certificate_type`
- `idx_certificates_number` ON `certificate_number`
- `idx_certificates_status` ON `status`
- `idx_certificates_issued_by` ON `issued_by`

**Relationships:**
- References: `clearance_requests.id`, `vehicles.id`, `users.id`

---

## Database Views

### `vehicle_summary`
**Purpose:** Aggregated vehicle information with owner and document counts

**Columns:**
- `id`, `vin`, `plate_number`, `make`, `model`, `year`, `color`, `status`, `registration_date`
- `owner_name` (concatenated first_name + last_name)
- `owner_email`
- `document_count` (total documents)
- `verified_documents` (count of verified documents)

### `verification_summary`
**Purpose:** Aggregated verification status by vehicle

**Columns:**
- `vehicle_id`, `vin`, `plate_number`, `vehicle_status`
- `insurance_status`, `emission_status`, `admin_status`
- `total_verifications`, `approved_verifications`

---

## Triggers

### `update_updated_at_column()`
**Purpose:** Automatically updates `updated_at` or `last_updated` timestamp on row updates

**Applied to:**
- `users` → updates `updated_at`
- `vehicles` → updates `last_updated`
- `vehicle_verifications` → updates `updated_at`

### `update_transfer_requests_updated_at()`
**Purpose:** Updates `updated_at` for transfer requests

### `update_clearance_requests_updated_at()`
**Purpose:** Updates `updated_at` for clearance requests

---

## Sequences

### `or_cr_number_seq`
**Purpose:** Generates sequential OR/CR numbers
- Format: `ORCR-YYYY-XXXXXX`
- Starts at 1, increments by 1

### `or_number_seq`
**Purpose:** Generates sequential OR numbers
- Format: `OR-YYYY-XXXXXX`
- Starts at 7, increments by 1

### `cr_number_seq`
**Purpose:** Generates sequential CR numbers
- Format: `CR-YYYY-XXXXXX`
- Starts at 7, increments by 1

### `mvir_number_seq`
**Purpose:** Generates sequential MVIR (Motor Vehicle Inspection Report) numbers
- Format: `MVIR-YYYY-XXXXXX`
- Used for vehicle inspection reports

---

## Key Relationships Diagram

```
users
  ├── vehicles (owner_id)
  ├── vehicle_verifications (verified_by)
  ├── documents (uploaded_by, verified_by)
  ├── vehicle_history (performed_by)
  ├── notifications (user_id)
  ├── transfer_requests (seller_id, buyer_id, reviewed_by)
  ├── clearance_requests (requested_by, assigned_to)
  └── certificates (issued_by)

vehicles
  ├── vehicle_verifications (vehicle_id)
  ├── documents (vehicle_id)
  ├── vehicle_history (vehicle_id)
  ├── transfer_requests (vehicle_id)
  ├── clearance_requests (vehicle_id)
  └── certificates (vehicle_id)

transfer_requests
  ├── transfer_documents (transfer_request_id)
  ├── transfer_verifications (transfer_request_id)
  └── clearance_requests (hpg_clearance_request_id)

clearance_requests
  ├── certificates (clearance_request_id)
  └── vehicle_verifications (clearance_request_id)

documents
  ├── transfer_documents (document_id)
  └── transfer_verifications (document_id)
```

---

## Important Notes

1. **Blockchain Integration:**
   - `vehicles.blockchain_tx_id` stores Hyperledger Fabric transaction IDs
   - `vehicle_history.transaction_id` stores Fabric transaction IDs for audit trail
   - Transaction IDs are VARCHAR(255) to accommodate Fabric hash lengths

2. **OR/CR Numbers:**
   - Supports both combined (`or_cr_number`) and separate (`or_number`, `cr_number`) formats
   - Unique constraints ensure no duplicates

3. **IPFS Support:**
   - `documents.ipfs_cid` stores IPFS Content Identifiers
   - `certificates.ipfs_cid` stores IPFS CIDs for certificates

4. **JSONB Metadata:**
   - Used in `vehicle_history.metadata`, `transfer_requests.metadata`, `clearance_requests.metadata`, `certificates.metadata`
   - Allows flexible storage of additional data without schema changes

5. **Cascade Deletes:**
   - Most child tables use `ON DELETE CASCADE` to maintain referential integrity
   - `certificates` uses `ON DELETE SET NULL` for `clearance_request_id` to preserve certificate history

6. **Partial Indexes:**
   - Used for frequently queried subsets (e.g., unread notifications, unverified documents)
   - Improves query performance while reducing index size

---

## Migration History

Key migrations applied:
1. `init-laptop.sql` - Initial schema creation
2. `add-or-cr-number.sql` - OR/CR number support
3. `add-ipfs-cid.sql` - IPFS integration
4. `add-transfer-ownership.sql` - Transfer of ownership workflow
5. `add-clearance-workflow.sql` - Clearance request system
6. `add-pending-blockchain-status.sql` - PENDING_BLOCKCHAIN status
7. `add-new-document-types.sql` - Extended document types
8. `fix-transaction-id-length.sql` - Extended transaction_id to VARCHAR(255)

---

## Database Statistics Queries

```sql
-- Count records per table
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'vehicle_verifications', COUNT(*) FROM vehicle_verifications
UNION ALL
SELECT 'vehicle_history', COUNT(*) FROM vehicle_history
UNION ALL
SELECT 'transfer_requests', COUNT(*) FROM transfer_requests
UNION ALL
SELECT 'clearance_requests', COUNT(*) FROM clearance_requests
UNION ALL
SELECT 'certificates', COUNT(*) FROM certificates
ORDER BY count DESC;

-- Check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

**Last Updated:** January 2026  
**Schema Version:** 1.0.0  
**Maintained By:** TrustChain LTO Development Team

