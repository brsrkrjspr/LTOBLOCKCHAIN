root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "\dt"
ostgres psql -U lto_user -d lto_blockchain -c "SELECT schemaname, relname as tablename, n_tup_ins as inserts, n_tup_upd as updates, n_live_tup as rows FROM pg_stat_user_tables ORDER BY relname;"

# List all tables with detailed info
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, table_type 
FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"        
           List of relations
 Schema |           Name            | Type  |  Owner
--------+---------------------------+-------+----------
 public | certificate_submissions   | table | lto_user
 public | certificates              | table | lto_user
 public | clearance_requests        | table | lto_user
 public | documents                 | table | lto_user
 public | email_verification_tokens | table | lto_user
 public | expiry_notifications      | table | lto_user
 public | external_issuers          | table | lto_user
 public | issued_certificates       | table | lto_user
 public | notifications             | table | lto_user
 public | refresh_tokens            | table | lto_user
 public | sessions                  | table | lto_user
 public | system_settings           | table | lto_user
 public | token_blacklist           | table | lto_user
 public | transfer_documents        | table | lto_user
 public | transfer_requests         | table | lto_user
 public | transfer_verifications    | table | lto_user
 public | users                     | table | lto_user
 public | vehicle_history           | table | lto_user
 public | vehicle_verifications     | table | lto_user
 public | vehicles                  | table | lto_user
(20 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all tables with row counts        
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT schemaname, relname as tablename, n_tup_ins as inserts, n_tup_upd as updates, n_live_tup as rows FROM pg_stat_user_tables ORDER BY relname;"
 schemaname |         tablename         | inserts | updates | rows 
------------+---------------------------+---------+---------+------
 public     | certificate_submissions   |       0 |       0 |    0
 public     | certificates              |       0 |       0 |    0
 public     | clearance_requests        |      14 |      41 |   14
 public     | documents                 |      41 |      29 |   41
 public     | email_verification_tokens |       3 |       3 |    0
 public     | expiry_notifications      |       0 |       0 |    0
 public     | external_issuers          |       5 |       0 |    5
 public     | issued_certificates       |      19 |       0 |   19
 public     | notifications             |       9 |       0 |    9
 public     | refresh_tokens            |     139 |       0 |  120
 public     | sessions                  |     136 |     202 |  117
 public     | system_settings           |       7 |       0 |    7
 public     | token_blacklist           |      19 |       0 |    0
 public     | transfer_documents        |       0 |       0 |    0
 public     | transfer_requests         |       0 |       0 |    0
 public     | transfer_verifications    |       0 |       0 |    0
 public     | users                     |      10 |     148 |   10
 public     | vehicle_history           |      58 |       0 |   58
 public     | vehicle_verifications     |      14 |       2 |   14
 public     | vehicles                  |       7 |       7 |    7
(20 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all tables with detailed info     
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
            table_name            | table_type 
----------------------------------+------------
 certificate_submissions          | BASE TABLE
 certificate_verification_summary | VIEW
 certificates                     | BASE TABLE
 clearance_requests               | BASE TABLE
 documents                        | BASE TABLE
 email_verification_tokens        | BASE TABLE
 expiry_notifications             | BASE TABLE
 external_issuers                 | BASE TABLE
 issued_certificates              | BASE TABLE
 notifications                    | BASE TABLE
 refresh_tokens                   | BASE TABLE
 sessions                         | BASE TABLE
 system_settings                  | BASE TABLE
 token_blacklist                  | BASE TABLE
 transfer_documents               | BASE TABLE
 transfer_requests                | BASE TABLE
 transfer_verifications           | BASE TABLE
 users                            | BASE TABLE
 vehicle_history                  | BASE TABLE
 vehicle_summary                  | VIEW
 vehicle_verifications            | BASE TABLE
 vehicles                         | BASE TABLE
 verification_summary             | VIEW
(23 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT table_name, column_name, data_type, is_nullable, column_default 
FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;"
 lto_user -d lto_blockchain -c "SELECT table_name, COUNT(*) as column_count FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name ORDER BY table_name;" 

# Verify address column exists in users table
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_schema 
= 'public' AND table_name = 'users' AND column_name = 'address';"            table_name   
         |          column_name           |          data_type          | is_nullable |   
      column_default
----------------------------------+--------------------------------+-----------------------------+-------------+--------------------------------
 certificate_submissions          | id                             | uuid
       | NO          | gen_random_uuid()
 certificate_submissions          | vehicle_id                     | uuid
       | NO          |
 certificate_submissions          | certificate_type               | character varying    
       | NO          |
 certificate_submissions          | uploaded_file_path             | text
       | NO          |
 certificate_submissions          | uploaded_file_hash             | character varying    
       | NO          |
 certificate_submissions          | submitted_by                   | uuid
       | NO          |
 certificate_submissions          | submitted_at                   | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 certificate_submissions          | verification_status            | character varying    
       | YES         | 'PENDING'::character varying
 certificate_submissions          | verified_at                    | timestamp without time zone | YES         |
 certificate_submissions          | verified_by                    | uuid
       | YES         |
 certificate_submissions          | matched_certificate_id         | uuid
       | YES         |
 certificate_submissions          | verification_notes             | text
       | YES         |
 certificate_submissions          | rejection_reason               | text
       | YES         |
 certificate_submissions          | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 certificate_submissions          | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 certificate_verification_summary | submission_id                  | uuid
       | YES         |
 certificate_verification_summary | vehicle_id                     | uuid
       | YES         |
 certificate_verification_summary | vin                            | character varying    
       | YES         |
 certificate_verification_summary | plate_number                   | character varying    
       | YES         |
 certificate_verification_summary | certificate_type               | character varying    
       | YES         |
 certificate_verification_summary | verification_status            | character varying    
       | YES         |
 certificate_verification_summary | submitted_at                   | timestamp without time zone | YES         |
 certificate_verification_summary | verified_at                    | timestamp without time zone | YES         |
 certificate_verification_summary | submitted_by_email             | character varying    
       | YES         |
 certificate_verification_summary | issuer_name                    | character varying    
       | YES         |
 certificate_verification_summary | certificate_number             | character varying    
       | YES         |
 certificate_verification_summary | original_issue_date            | timestamp without time zone | YES         |
 certificate_verification_summary | expires_at                     | timestamp without time zone | YES         |
 certificate_verification_summary | overall_status                 | character varying    
       | YES         |
 certificates                     | id                             | uuid
       | NO          | uuid_generate_v4()
 certificates                     | clearance_request_id           | uuid
       | YES         |
 certificates                     | vehicle_id                     | uuid
       | NO          |
 certificates                     | certificate_type               | character varying    
       | NO          |
 certificates                     | certificate_number             | character varying    
       | NO          |
 certificates                     | file_path                      | character varying    
       | YES         |
 certificates                     | ipfs_cid                       | character varying    
       | YES         |
 certificates                     | issued_by                      | uuid
       | NO          |
 certificates                     | issued_at                      | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 certificates                     | expires_at                     | timestamp without time zone | YES         |
 certificates                     | status                         | character varying    
       | YES         | 'ACTIVE'::character varying
 certificates                     | metadata                       | jsonb
       | YES         | '{}'::jsonb
 certificates                     | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 certificates                     | file_hash                      | character varying    
       | YES         |
 certificates                     | composite_hash                 | character varying    
       | YES         |
 certificates                     | blockchain_tx_id               | character varying    
       | YES         |
 certificates                     | application_status             | character varying    
       | YES         | 'PENDING'::character varying
 certificates                     | document_id                    | uuid
       | YES         |
 certificates                     | verified_at                    | timestamp without time zone | YES         |
 certificates                     | verified_by                    | uuid
       | YES         |
 certificates                     | revocation_reason              | text
       | YES         |
 certificates                     | revoked_at                     | timestamp without time zone | YES         |
 clearance_requests               | id                             | uuid
       | NO          | uuid_generate_v4()
 clearance_requests               | vehicle_id                     | uuid
       | NO          |
 clearance_requests               | request_type                   | character varying    
       | NO          |
 clearance_requests               | status                         | character varying    
       | YES         | 'PENDING'::character varying
 clearance_requests               | requested_by                   | uuid
       | NO          |
 clearance_requests               | requested_at                   | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 clearance_requests               | assigned_to                    | uuid
       | YES         |
 clearance_requests               | completed_at                   | timestamp without time zone | YES         |
 clearance_requests               | certificate_id                 | uuid
       | YES         |
 clearance_requests               | purpose                        | character varying    
       | YES         |
 clearance_requests               | notes                          | text
       | YES         |
 clearance_requests               | metadata                       | jsonb
       | YES         | '{}'::jsonb
 clearance_requests               | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 clearance_requests               | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 documents                        | id                             | uuid
       | NO          | uuid_generate_v4()
 documents                        | vehicle_id                     | uuid
       | YES         |
 documents                        | document_type                  | USER-DEFINED
       | NO          |
 documents                        | filename                       | character varying    
       | NO          |
 documents                        | original_name                  | character varying    
       | NO          |
 documents                        | file_path                      | character varying    
       | NO          |
 documents                        | file_size                      | bigint
       | NO          |
 documents                        | mime_type                      | character varying    
       | NO          |
 documents                        | file_hash                      | character varying    
       | NO          |
 documents                        | uploaded_by                    | uuid
       | YES         |
 documents                        | uploaded_at                    | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 documents                        | verified                       | boolean
       | YES         | false
 documents                        | verified_at                    | timestamp without time zone | YES         |
 documents                        | verified_by                    | uuid
       | YES         |
 documents                        | ipfs_cid                       | character varying    
       | YES         |
 email_verification_tokens        | id                             | uuid
       | NO          | uuid_generate_v4()
 email_verification_tokens        | user_id                        | uuid
       | NO          |
 email_verification_tokens        | token_hash                     | character varying    
       | NO          |
 email_verification_tokens        | token_secret                   | character varying    
       | NO          |
 email_verification_tokens        | expires_at                     | timestamp without time zone | NO          |
 email_verification_tokens        | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 email_verification_tokens        | used_at                        | timestamp without time zone | YES         |
 email_verification_tokens        | used_by_ip                     | inet
       | YES         |
 expiry_notifications             | id                             | uuid
       | NO          | uuid_generate_v4()
 expiry_notifications             | vehicle_id                     | uuid
       | YES         |
 expiry_notifications             | user_id                        | uuid
       | YES         |
 expiry_notifications             | notification_type              | character varying    
       | NO          |
 expiry_notifications             | sent_at                        | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 expiry_notifications             | email_sent                     | boolean
       | YES         | false
 expiry_notifications             | sms_sent                       | boolean
       | YES         | false
 external_issuers                 | id                             | uuid
       | NO          | gen_random_uuid()
 external_issuers                 | issuer_type                    | character varying    
       | NO          |
 external_issuers                 | company_name                   | character varying    
       | NO          |
 external_issuers                 | license_number                 | character varying    
       | NO          |
 external_issuers                 | authorized_by                  | character varying    
       | YES         |
 external_issuers                 | authorized_at                  | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 external_issuers                 | is_active                      | boolean
       | YES         | true
 external_issuers                 | api_key                        | character varying    
       | YES         |
 external_issuers                 | contact_email                  | character varying    
       | YES         |
 external_issuers                 | contact_phone                  | character varying    
       | YES         |
 external_issuers                 | address                        | text
       | YES         |
 external_issuers                 | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 external_issuers                 | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 issued_certificates              | id                             | uuid
       | NO          | gen_random_uuid()
 issued_certificates              | issuer_id                      | uuid
       | NO          |
 issued_certificates              | certificate_type               | character varying    
       | NO          |
 issued_certificates              | certificate_number             | character varying    
       | NO          |
 issued_certificates              | vehicle_vin                    | character varying    
       | NO          |
 issued_certificates              | owner_name                     | character varying    
       | YES         |
 issued_certificates              | owner_id                       | character varying    
       | YES         |
 issued_certificates              | file_hash                      | character varying    
       | NO          |
 issued_certificates              | composite_hash                 | character varying    
       | NO          |
 issued_certificates              | issued_at                      | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 issued_certificates              | expires_at                     | timestamp without time zone | YES         |
 issued_certificates              | blockchain_tx_id               | character varying    
       | YES         |
 issued_certificates              | is_revoked                     | boolean
       | YES         | false
 issued_certificates              | revocation_reason              | text
       | YES         |
 issued_certificates              | revoked_at                     | timestamp without time zone | YES         |
 issued_certificates              | metadata                       | jsonb
       | YES         |
 issued_certificates              | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 notifications                    | id                             | uuid
       | NO          | uuid_generate_v4()
 notifications                    | user_id                        | uuid
       | YES         |
 notifications                    | title                          | character varying    
       | NO          |
 notifications                    | message                        | text
       | NO          |
 notifications                    | type                           | character varying    
       | YES         | 'info'::character varying
 notifications                    | read                           | boolean
       | YES         | false
 notifications                    | sent_at                        | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 notifications                    | read_at                        | timestamp without time zone | YES         |
 refresh_tokens                   | id                             | uuid
       | NO          | uuid_generate_v4()
 refresh_tokens                   | user_id                        | uuid
       | NO          |
 refresh_tokens                   | token_hash                     | character varying    
       | NO          |
 refresh_tokens                   | expires_at                     | timestamp without time zone | NO          |
 refresh_tokens                   | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 sessions                         | id                             | uuid
       | NO          | uuid_generate_v4()
 sessions                         | user_id                        | uuid
       | NO          |
 sessions                         | refresh_token_id               | uuid
       | YES         |
 sessions                         | ip_address                     | inet
       | YES         |
 sessions                         | user_agent                     | text
       | YES         |
 sessions                         | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 sessions                         | last_activity                  | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 sessions                         | expires_at                     | timestamp without time zone | NO          |
 system_settings                  | key                            | character varying    
       | NO          |
 system_settings                  | value                          | text
       | NO          |
 system_settings                  | description                    | text
       | YES         |
 system_settings                  | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 system_settings                  | updated_by                     | uuid
       | YES         |
 token_blacklist                  | token_jti                      | character varying    
       | NO          |
 token_blacklist                  | token_hash                     | character varying    
       | NO          |
 token_blacklist                  | expires_at                     | timestamp without time zone | NO          |
 token_blacklist                  | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 token_blacklist                  | reason                         | character varying    
       | YES         | 'logout'::character varying
 transfer_documents               | id                             | uuid
       | NO          | uuid_generate_v4()
 transfer_documents               | transfer_request_id            | uuid
       | NO          |
 transfer_documents               | document_type                  | character varying    
       | NO          |
 transfer_documents               | document_id                    | uuid
       | YES         |
 transfer_documents               | uploaded_by                    | uuid
       | NO          |
 transfer_documents               | uploaded_at                    | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 transfer_documents               | notes                          | text
       | YES         |
 transfer_requests                | id                             | uuid
       | NO          | uuid_generate_v4()
 transfer_requests                | vehicle_id                     | uuid
       | NO          |
 transfer_requests                | seller_id                      | uuid
       | NO          |
 transfer_requests                | buyer_id                       | uuid
       | YES         |
 transfer_requests                | buyer_info                     | jsonb
       | YES         |
 transfer_requests                | status                         | character varying    
       | YES         | 'PENDING'::character varying
 transfer_requests                | submitted_at                   | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 transfer_requests                | reviewed_by                    | uuid
       | YES         |
 transfer_requests                | reviewed_at                    | timestamp without time zone | YES         |
 transfer_requests                | rejection_reason               | text
       | YES         |
 transfer_requests                | forwarded_to_hpg               | boolean
       | YES         | false
 transfer_requests                | hpg_clearance_request_id       | uuid
       | YES         |
 transfer_requests                | metadata                       | jsonb
       | YES         | '{}'::jsonb
 transfer_requests                | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 transfer_requests                | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 transfer_requests                | insurance_clearance_request_id | uuid
       | YES         |
 transfer_requests                | emission_clearance_request_id  | uuid
       | YES         |
 transfer_requests                | insurance_approval_status      | character varying    
       | YES         | 'PENDING'::character varying
 transfer_requests                | emission_approval_status       | character varying    
       | YES         | 'PENDING'::character varying
 transfer_requests                | hpg_approval_status            | character varying    
       | YES         | 'PENDING'::character varying
 transfer_requests                | insurance_approved_at          | timestamp without time zone | YES         |
 transfer_requests                | emission_approved_at           | timestamp without time zone | YES         |
 transfer_requests                | hpg_approved_at                | timestamp without time zone | YES         |
 transfer_requests                | insurance_approved_by          | uuid
       | YES         |
 transfer_requests                | emission_approved_by           | uuid
       | YES         |
 transfer_requests                | hpg_approved_by                | uuid
       | YES         |
 transfer_verifications           | id                             | uuid
       | NO          | uuid_generate_v4()
 transfer_verifications           | transfer_request_id            | uuid
       | NO          |
 transfer_verifications           | document_id                    | uuid
       | YES         |
 transfer_verifications           | verified_by                    | uuid
       | NO          |
 transfer_verifications           | status                         | character varying    
       | NO          |
 transfer_verifications           | notes                          | text
       | YES         |
 transfer_verifications           | checklist                      | jsonb
       | YES         | '{}'::jsonb
 transfer_verifications           | flagged                        | boolean
       | YES         | false
 transfer_verifications           | verified_at                    | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 users                            | id                             | uuid
       | NO          | uuid_generate_v4()
 users                            | email                          | character varying    
       | NO          |
 users                            | password_hash                  | character varying    
       | NO          |
 users                            | first_name                     | character varying    
       | NO          |
 users                            | last_name                      | character varying    
       | NO          | 
 users                            | role                           | USER-DEFINED
       | NO          | 'vehicle_owner'::user_role
 users                            | organization                   | character varying    
       | YES         |
 users                            | phone                          | character varying    
       | YES         |
 users                            | is_active                      | boolean
       | YES         | true
 users                            | email_verified                 | boolean
       | YES         | false
 users                            | two_factor_enabled             | boolean
       | YES         | false
 users                            | last_login                     | timestamp without time zone | YES         |
 users                            | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 users                            | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 users                            | address                        | character varying    
       | YES         |
 vehicle_history                  | id                             | uuid
       | NO          | uuid_generate_v4()
 vehicle_history                  | vehicle_id                     | uuid
       | YES         |
 vehicle_history                  | action                         | character varying    
       | NO          |
 vehicle_history                  | description                    | text
       | YES         |
 vehicle_history                  | performed_by                   | uuid
       | YES         |
 vehicle_history                  | performed_at                   | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 vehicle_history                  | transaction_id                 | character varying    
       | YES         |
 vehicle_history                  | metadata                       | jsonb
       | YES         |
 vehicle_summary                  | id                             | uuid
       | YES         |
 vehicle_summary                  | vin                            | character varying    
       | YES         |
 vehicle_summary                  | plate_number                   | character varying    
       | YES         |
 vehicle_summary                  | make                           | character varying    
       | YES         |
 vehicle_summary                  | model                          | character varying    
       | YES         |
 vehicle_summary                  | year                           | integer
       | YES         |
 vehicle_summary                  | color                          | character varying    
       | YES         |
 vehicle_summary                  | status                         | USER-DEFINED
       | YES         |
 vehicle_summary                  | registration_date              | timestamp without time zone | YES         |
 vehicle_summary                  | owner_name                     | text
       | YES         |
 vehicle_summary                  | owner_email                    | character varying    
       | YES         |
 vehicle_summary                  | document_count                 | bigint
       | YES         |
 vehicle_summary                  | verified_documents             | bigint
       | YES         |
 vehicle_verifications            | id                             | uuid
       | NO          | uuid_generate_v4()
 vehicle_verifications            | vehicle_id                     | uuid
       | YES         |
 vehicle_verifications            | verification_type              | character varying    
       | NO          |
 vehicle_verifications            | status                         | USER-DEFINED
       | YES         | 'PENDING'::verification_status
 vehicle_verifications            | verified_by                    | uuid
       | YES         |
 vehicle_verifications            | verified_at                    | timestamp without time zone | YES         |
 vehicle_verifications            | notes                          | text
       | YES         |
 vehicle_verifications            | created_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 vehicle_verifications            | updated_at                     | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 vehicle_verifications            | clearance_request_id           | uuid
       | YES         |
 vehicle_verifications            | automated                      | boolean
       | YES         | false
 vehicle_verifications            | verification_score             | integer
       | YES         |
 vehicle_verifications            | verification_metadata          | jsonb
       | YES         | '{}'::jsonb
 vehicle_verifications            | auto_verified_at               | timestamp without time zone | YES         |
 vehicles                         | id                             | uuid
       | NO          | uuid_generate_v4()
 vehicles                         | vin                            | character varying    
       | NO          |
 vehicles                         | plate_number                   | character varying    
       | YES         |
 vehicles                         | make                           | character varying    
       | NO          |
 vehicles                         | model                          | character varying    
       | NO          |
 vehicles                         | year                           | integer
       | NO          |
 vehicles                         | color                          | character varying    
       | YES         |
 vehicles                         | engine_number                  | character varying    
       | YES         |
 vehicles                         | chassis_number                 | character varying    
       | YES         |
 vehicles                         | vehicle_type                   | character varying    
       | YES         | 'PASSENGER'::character varying
 vehicles                         | fuel_type                      | character varying    
       | YES         | 'GASOLINE'::character varying
 vehicles                         | transmission                   | character varying    
       | YES         | 'MANUAL'::character varying
 vehicles                         | engine_displacement            | character varying    
       | YES         |
 vehicles                         | owner_id                       | uuid
       | YES         |
 vehicles                         | status                         | USER-DEFINED
       | YES         | 'SUBMITTED'::vehicle_status
 vehicles                         | registration_date              | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 vehicles                         | last_updated                   | timestamp without time zone | YES         | CURRENT_TIMESTAMP
 vehicles                         | priority                       | character varying    
       | YES         | 'MEDIUM'::character varying
 vehicles                         | notes                          | text
       | YES         |
 vehicles                         | vehicle_category               | character varying    
       | YES         |
 vehicles                         | passenger_capacity             | integer
       | YES         |
 vehicles                         | gross_vehicle_weight           | numeric
       | YES         |
 vehicles                         | net_weight                     | numeric
       | YES         |
 vehicles                         | registration_type              | character varying    
       | YES         | 'Private'::character varying
 vehicles                         | origin_type                    | character varying    
       | YES         | 'NEW_REG'::character varying
 vehicles                         | registration_expiry_date       | timestamp without time zone | YES         |
 vehicles                         | insurance_expiry_date          | timestamp without time zone | YES         |
 vehicles                         | emission_expiry_date           | timestamp without time zone | YES         |
 vehicles                         | expiry_notified_30d            | boolean
       | YES         | false
 vehicles                         | expiry_notified_7d             | boolean
       | YES         | false
 vehicles                         | expiry_notified_1d             | boolean
       | YES         | false
 verification_summary             | vehicle_id                     | uuid
       | YES         |
 verification_summary             | vin                            | character varying    
       | YES         |
 verification_summary             | plate_number                   | character varying    
       | YES         |
 verification_summary             | vehicle_status                 | USER-DEFINED
       | YES         |
 verification_summary             | insurance_status               | USER-DEFINED
       | YES         |
 verification_summary             | emission_status                | USER-DEFINED
       | YES         |
 verification_summary             | admin_status                   | USER-DEFINED
       | YES         |
 verification_summary             | total_verifications            | bigint
       | YES         |
 verification_summary             | approved_verifications         | bigint
       | YES         |
(288 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # View all tables with their column counts
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT table_name, COUNT(*) as column_count FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name ORDER BY table_name;"
            table_name            | column_count
----------------------------------+--------------
 certificate_submissions          |           15
 certificate_verification_summary |           14
 certificates                     |           22
 clearance_requests               |           14
 documents                        |           15
 email_verification_tokens        |            8
 expiry_notifications             |            7
 external_issuers                 |           13
 issued_certificates              |           17
 notifications                    |            8
 refresh_tokens                   |            5
 sessions                         |            8
 system_settings                  |            5
 token_blacklist                  |            5
 transfer_documents               |            7
 transfer_requests                |           26
 transfer_verifications           |            9
 users                            |           15
 vehicle_history                  |            8
 vehicle_summary                  |           13
 vehicle_verifications            |           14
 vehicles                         |           31
 verification_summary             |            9
(23 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Verify address column exists in users table
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'address';"
 column_name |     data_type     | character_maximum_length | is_nullable
-------------+-------------------+--------------------------+-------------
 address     | character varying |                      500 | YES
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_users FROM users;"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, email, first_name, 
last_name, role, organization, phone, address, is_active, email_verified, created_at FROM 
users ORDER BY created_at;"

# Count users by role
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC;"

# List users with email verification status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, email_verified, is_active FROM users ORDER BY role, email;"

# Check specific user accounts
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, first_name, last_name, role, organization, phone, address, is_active, email_verified FROM users WHERE email IN ('admin@lto.gov.ph', 'insurance@lto.gov.ph', 'emission@lto.gov.ph', 'staff@lto.gov.ph', 'owner@example.com') ORDER BY email;" total_users 
-------------
          10
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all users (without password hashes)
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT id, email, first_name, last_name, role, organization, phone, address, is_active, email_verified, created_at FROM users ORDER BY created_at;"
                  id                  |           email           | first_name  | last_name |        role        |      organization       |     phone     |       address        | 
is_active | email_verified |         created_at
--------------------------------------+---------------------------+-------------+-----------+--------------------+-------------------------+---------------+----------------------+-----------+----------------+----------------------------
 e77d909e-3695-427d-b2b5-5158001e5451 | insurance@lto.gov.ph      | Insurance   | Verifier  | insurance_verifier | Insurance Company       |               |                      | 
t         | t              | 2026-01-17 13:05:01.656555
 d014a933-42b1-4423-83e1-71309ceb2e29 | owner@example.com         | Vehicle     | Owner   
  | vehicle_owner      | Individual              |               |                      | 
t         | t              | 2026-01-17 13:05:01.656555
 ffaec47a-39e0-4213-8620-ecbe798f02f5 | emission@lto.gov.ph       | Emission    | Verifier  | emission_verifier  | Emission Testing Center |               |                      | 
t         | t              | 2026-01-17 13:05:01.656555
 2a1d4137-3c70-4e6a-be5f-116caf0f6f81 | staff@lto.gov.ph          | Staff       | User    
  | staff              | LTO                     |               |                      | 
t         | t              | 2026-01-17 13:05:01.656555
 fa55431d-3637-4a19-901b-b74beef23c3d | admin@lto.gov.ph          | Admin       | User    
  | admin              | LTO                     |               |                      | 
t         | t              | 2026-01-17 13:05:01.656555
 10810368-b199-407f-be36-678e940ad389 | kimandrei012@gmail.com    | Kim Andrei  | Besmar  
  | vehicle_owner      | Individual              | 09672564545   | Lipa City            | 
t         | t              | 2026-01-18 00:39:09.516985
 f72ba28b-35a1-46f6-a52e-3a22043d47f2 | latagjoshuaivan@gmail.com | Joshua Ivan | Latag   
  | vehicle_owner      | Individual              | +639154788771 | Dagatan              | 
t         | t              | 2026-01-18 00:40:40.585984
 21d31b9a-ed8e-42a4-994c-1e3f947fd9b8 | dullajasperdave@gmail.com | Jasper      | Davve   
  | vehicle_owner      | Individual              | 09482106236   | San Lucas, Lipa City | 
t         | t              | 2026-01-18 01:59:44.535293
 2e7fe0be-0bf9-4a7b-9dd7-9607b2f4dd74 | hpgadmin@hpg.gov.ph       | HPG         | Admin   
  | hpg_admin          | Highway Patrol Group    |               |                      | 
t         | t              | 2026-01-18 05:43:10.88314
 21e0c5ee-d324-4267-a31b-567c4cbe5912 | dealer@csr.lto.gov.ph     | CSR         | Dealer  
  | staff              | Motor Vehicle Dealer    |               |                      | 
t         | t              | 2026-01-18 06:31:04.077552
(10 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count users by role
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count 
DESC;"
        role        | count
--------------------+-------
 vehicle_owner      |     4
 staff              |     2
 hpg_admin          |     1
 emission_verifier  |     1
 admin              |     1
 insurance_verifier |     1
(6 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List users with email verification status
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT email, role, email_verified, is_active FROM users ORDER BY role, email;"
           email           |        role        | email_verified | is_active 
---------------------------+--------------------+----------------+-----------
 admin@lto.gov.ph          | admin              | t              | t
 dealer@csr.lto.gov.ph     | staff              | t              | t
 staff@lto.gov.ph          | staff              | t              | t
 insurance@lto.gov.ph      | insurance_verifier | t              | t
 emission@lto.gov.ph       | emission_verifier  | t              | t
 dullajasperdave@gmail.com | vehicle_owner      | t              | t
 kimandrei012@gmail.com    | vehicle_owner      | t              | t
 latagjoshuaivan@gmail.com | vehicle_owner      | t              | t
 owner@example.com         | vehicle_owner      | t              | t
 hpgadmin@hpg.gov.ph       | hpg_admin          | t              | t
(10 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Check specific user accounts
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT email, first_name, last_name, role, organization, phone, address, is_active, email_verified FROM users WHERE email IN ('admin@lto.gov.ph', 'insurance@lto.gov.ph', 'emission@lto.gov.ph', 'staff@lto.gov.ph', 'owner@example.com') ORDER BY email;" 
        email         | first_name | last_name |        role        |      organization   
    | phone | address | is_active | email_verified
----------------------+------------+-----------+--------------------+-------------------------+-------+---------+-----------+----------------
 admin@lto.gov.ph     | Admin      | User      | admin              | LTO
    |       |         | t         | t
 emission@lto.gov.ph  | Emission   | Verifier  | emission_verifier  | Emission Testing Center |       |         | t         | t
 insurance@lto.gov.ph | Insurance  | Verifier  | insurance_verifier | Insurance Company   
    |       |         | t         | t
 owner@example.com    | Vehicle    | Owner     | vehicle_owner      | Individual
    |       |         | t         | t
 staff@lto.gov.ph     | Staff      | User      | staff              | LTO
    |       |         | t         | t
(5 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count total vehicles
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_vehicles FROM vehicles;"
 all vehicles
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vin, plate_number, 
make, model, year, status, owner_id, registration_date FROM vehicles ORDER BY registration_date DESC LIMIT 20;"

# Count vehicles by status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT status, COUNT(*) as count FROM vehicles GROUP BY status ORDER BY count DESC;"

# List vehicles with owner information
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT v.vin, v.plate_number, 
v.make, v.model, v.status, u.email as owner_email, u.first_name || ' ' || u.last_name as owner_name FROM vehicles v LEFT JOIN users u ON v.owner_id = u.id ORDER BY v.registration_date DESC LIMIT 20;" total_vehicles
----------------
              7
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all vehicles
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT id, vin, plate_number, make, model, year, status, owner_id, registration_date FROM vehicles ORDER BY registration_date DESC LIMIT 20;"
                  id                  |        vin        | plate_number |  make  |       
 model         | year |       status       |               owner_id               |     registration_date
--------------------------------------+-------------------+--------------+--------+----------------------+------+--------------------+--------------------------------------+----------------------------
 c5424078-dc15-44dc-a573-55ad3e5abe22 | YS3E8B35TYMC7ZPBU | HDC-8969     | Toyota | Vios  
               | 2026 | PENDING_BLOCKCHAIN | f72ba28b-35a1-46f6-a52e-3a22043d47f2 | 2026-01-19 10:01:37.973689
 75e27db8-d749-4f5d-bbe9-203c8abb29cb | NHMYW3A5LWW4KNBRD | RHY-5432     | Toyota | Vios  
               | 2026 | PENDING_BLOCKCHAIN | f72ba28b-35a1-46f6-a52e-3a22043d47f2 | 2026-01-19 09:48:29.622441
 a410cee9-2212-4e1a-b921-90aaff02e5d9 | Z6L4MSFU3H9CBMA6F | YAA-9434     | Toyota | Vios  
               | 2026 | PENDING_BLOCKCHAIN | f72ba28b-35a1-46f6-a52e-3a22043d47f2 | 2026-01-19 07:47:06.448885
 4d291d6a-e4fb-4aea-8cdf-5c264a6b0615 | 651BH41JXMN789123 | ABC-1234     | Toyota | Toyota Corolla Altis | 2025 | PENDING_BLOCKCHAIN | f72ba28b-35a1-46f6-a52e-3a22043d47f2 | 2026-01-19 00:50:41.901813
 f2418ccc-ba35-437a-9e07-34923fcf3b19 | V5GF5WL7ZPUDWF03D | VFP-2222     | Toyota | Toyota Vios          | 2026 | PENDING_BLOCKCHAIN | 10810368-b199-407f-be36-678e940ad389 | 2026-01-18 19:39:43.498572
 16e035b3-6344-40b5-a1e0-313b2a58bb71 | TYFPA2XVAYP9TFY3Y | NTD-4849     | Toyota | Toyota Vios          | 2026 | PENDING_BLOCKCHAIN | 10810368-b199-407f-be36-678e940ad389 | 2026-01-18 18:11:03.678868
 df1db102-2eb7-42d1-b622-454300a5c943 | 1HGBH41JXMN223311 | JWU-9642     | Ford   | Ford Mustang         | 2025 | PENDING_BLOCKCHAIN | 21d31b9a-ed8e-42a4-994c-1e3f947fd9b8 | 2026-01-18 12:29:08.386827
(7 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count vehicles by status
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT status, COUNT(*) as count FROM vehicles GROUP BY status ORDER BY count DESC;"
       status       | count
--------------------+-------
 PENDING_BLOCKCHAIN |     7
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List vehicles with owner information   
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT v.vin, v.plate_number, v.make, v.model, v.status, u.email as owner_email, u.first_name || ' ' || u.last_name as owner_name FROM vehicles v LEFT JOIN users u ON v.owner_id = u.id ORDER BY v.registration_date DESC LIMIT 20;"
        vin        | plate_number |  make  |        model         |       status       |  
      owner_email        |    owner_name
-------------------+--------------+--------+----------------------+--------------------+---------------------------+-------------------
 YS3E8B35TYMC7ZPBU | HDC-8969     | Toyota | Vios                 | PENDING_BLOCKCHAIN | latagjoshuaivan@gmail.com | Joshua Ivan Latag
 NHMYW3A5LWW4KNBRD | RHY-5432     | Toyota | Vios                 | PENDING_BLOCKCHAIN | latagjoshuaivan@gmail.com | Joshua Ivan Latag
 Z6L4MSFU3H9CBMA6F | YAA-9434     | Toyota | Vios                 | PENDING_BLOCKCHAIN | latagjoshuaivan@gmail.com | Joshua Ivan Latag
 651BH41JXMN789123 | ABC-1234     | Toyota | Toyota Corolla Altis | PENDING_BLOCKCHAIN | latagjoshuaivan@gmail.com | Joshua Ivan Latag
 V5GF5WL7ZPUDWF03D | VFP-2222     | Toyota | Toyota Vios          | PENDING_BLOCKCHAIN | kimandrei012@gmail.com    | Kim Andrei Besmar
 TYFPA2XVAYP9TFY3Y | NTD-4849     | Toyota | Toyota Vios          | PENDING_BLOCKCHAIN | kimandrei012@gmail.com    | Kim Andrei Besmar
 1HGBH41JXMN223311 | JWU-9642     | Ford   | Ford Mustang         | PENDING_BLOCKCHAIN | dullajasperdave@gmail.com | Jasper Davve
(7 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count transfer requests
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_transfers FROM transfer_requests;"
 List all transfer requests
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vehicle_id, seller_id, buyer_id, status, submitted_at, reviewed_at FROM transfer_requests ORDER BY submitted_at DESC LIMIT 20;"

# Count transfers by status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT status, COUNT(*) as count FROM transfer_requests GROUP BY status ORDER BY count DESC;"

# List transfers with vehicle and user info
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tr.id, v.vin, v.plate_number, tr.status, tr.submitted_at, seller.email as seller_email, buyer.email as buyer_email FROM transfer_requests tr JOIN vehicles v ON tr.vehicle_id = v.id LEFT JOIN users seller ON tr.seller_id = seller.id LEFT JOIN users buyer ON tr.buyer_id = buyer.id ORDER BY tr.submitted_at DESC LIMIT 20;" total_transfers 
-----------------
               0
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all transfer requests
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT id, vehicle_id, seller_id, buyer_id, status, submitted_at, reviewed_at FROM transfer_requests ORDER BY submitted_at DESC LIMIT 20;"
 id | vehicle_id | seller_id | buyer_id | status | submitted_at | reviewed_at 
----+------------+-----------+----------+--------+--------------+-------------
(0 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count transfers by status
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT status, COUNT(*) as count FROM transfer_requests GROUP BY status ORDER BY count DESC;"
 status | count 
--------+-------
(0 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List transfers with vehicle and user info
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT tr.id, v.vin, v.plate_number, tr.status, tr.submitted_at, seller.email as seller_email, buyer.email as buyer_email FROM transfer_requests tr JOIN vehicles v ON tr.vehicle_id = v.id LEFT JOIN users seller ON tr.seller_id = seller.id LEFT JOIN users buyer ON tr.buyer_id = buyer.id ORDER BY tr.submitted_at DESC LIMIT 20;"
 id | vin | plate_number | status | submitted_at | seller_email | buyer_email 
----+-----+--------------+--------+--------------+--------------+-------------
(0 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count clearance requests
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_clearances FROM clearance_requests;"

# List all clearance requests
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, vehicle_id, request_type, status, requested_at, assigned_to, completed_at FROM clearance_requests ORDER BY requested_at DESC LIMIT 20;"

# Count clearances by type and status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT request_type, status, COUNT(*) as count FROM clearance_requests GROUP BY request_type, status ORDER BY request_type, status;" total_clearances 
------------------
               14
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all clearance requests
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT id, vehicle_id, request_type, status, requested_at, assigned_to, completed_at FROM clearance_requests ORDER BY requested_at DESC LIMIT 20;"
                  id                  |              vehicle_id              | request_type |  status  |        requested_at        |             assigned_to              |        
completed_at
--------------------------------------+--------------------------------------+--------------+----------+----------------------------+--------------------------------------+----------------------------
 8b470d48-ea0f-4c66-a95c-efb3b0460e90 | c5424078-dc15-44dc-a573-55ad3e5abe22 | insurance  
  | PENDING  | 2026-01-19 10:01:41.456893 | e77d909e-3695-427d-b2b5-5158001e5451 |        
 7768137f-e1b2-4e07-8e8e-cacf1e4609d3 | c5424078-dc15-44dc-a573-55ad3e5abe22 | hpg        
  | PENDING  | 2026-01-19 10:01:41.394333 |                                      |        
 5e9a4d88-1240-4a53-8d9b-5d07dc953565 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | insurance  
  | PENDING  | 2026-01-19 09:48:32.826475 | e77d909e-3695-427d-b2b5-5158001e5451 |        
 5692843c-0355-4261-8120-5a7430f5cd10 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | hpg        
  | PENDING  | 2026-01-19 09:48:32.790734 |                                      |        
 3a8d4bc9-661b-4b7e-9b62-39ef6980c0f2 | a410cee9-2212-4e1a-b921-90aaff02e5d9 | insurance  
  | APPROVED | 2026-01-19 07:47:09.67187  | e77d909e-3695-427d-b2b5-5158001e5451 | 2026-01-19 07:51:12.672333
 f97893c4-1183-4b2f-bd30-4aeaee7003b5 | a410cee9-2212-4e1a-b921-90aaff02e5d9 | hpg        
  | PENDING  | 2026-01-19 07:47:09.641343 |                                      |        
 ab1fd803-0bd6-47de-9ac2-1b790606968d | 4d291d6a-e4fb-4aea-8cdf-5c264a6b0615 | insurance  
  | APPROVED | 2026-01-19 00:50:45.877006 | e77d909e-3695-427d-b2b5-5158001e5451 | 2026-01-19 01:25:56.670669
 e8073a02-3396-473c-871d-aca39cd6b2e1 | 4d291d6a-e4fb-4aea-8cdf-5c264a6b0615 | hpg        
  | SENT     | 2026-01-19 00:50:45.828617 | 2e7fe0be-0bf9-4a7b-9dd7-9607b2f4dd74 | 2026-01-19 06:22:10.712014
 06f3e6a5-b7f9-4e16-b18b-14a10503ab45 | f2418ccc-ba35-437a-9e07-34923fcf3b19 | insurance  
  | APPROVED | 2026-01-18 19:39:46.880007 | e77d909e-3695-427d-b2b5-5158001e5451 | 2026-01-19 02:16:11.685847
 9e198542-caf7-4e3a-a5e0-3af9df89e693 | f2418ccc-ba35-437a-9e07-34923fcf3b19 | hpg        
  | PENDING  | 2026-01-18 19:39:46.837398 |                                      |        
 7d78623d-0696-4764-8731-aed0db71de54 | 16e035b3-6344-40b5-a1e0-313b2a58bb71 | insurance  
  | PENDING  | 2026-01-18 18:11:07.328178 | e77d909e-3695-427d-b2b5-5158001e5451 |        
 30352909-871f-4bcd-9af2-89b9ebde0e06 | 16e035b3-6344-40b5-a1e0-313b2a58bb71 | hpg        
  | PENDING  | 2026-01-18 18:11:07.300143 |                                      |        
 5fa44916-b483-40c0-be37-6ff6ba07b24a | df1db102-2eb7-42d1-b622-454300a5c943 | insurance  
  | PENDING  | 2026-01-18 12:29:13.294701 | e77d909e-3695-427d-b2b5-5158001e5451 |        
 a956c183-40a7-4193-bab1-0d61552303ab | df1db102-2eb7-42d1-b622-454300a5c943 | hpg        
  | PENDING  | 2026-01-18 12:29:13.249756 |                                      |        
(14 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count clearances by type and status    
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT request_type, status, COUNT(*) as count FROM clearance_requests 
GROUP BY request_type, status ORDER BY request_type, status;"
 request_type |  status  | count 
--------------+----------+-------
 hpg          | PENDING  |     6
 hpg          | SENT     |     1
 insurance    | APPROVED |     3
 insurance    | PENDING  |     4
(4 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count total documents
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_documents FROM documents;"
ments with vehicle info
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT d.id, d.document_type, 
d.filename, d.verified, v.vin, v.plate_number, d.uploaded_at FROM documents d LEFT JOIN vehicles v ON d.vehicle_id = v.id ORDER BY d.uploaded_at DESC LIMIT 20;"

# Count documents by type
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT document_type, COUNT(*) as count, COUNT(CASE WHEN verified = true THEN 1 END) as verified_count FROM documents GROUP BY document_type ORDER BY count DESC;" total_documents 
-----------------
              41
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List documents with vehicle info       
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT d.id, d.document_type, d.filename, d.verified, v.vin, v.plate_number, d.uploaded_at FROM documents d LEFT JOIN vehicles v ON d.vehicle_id = v.id ORDER BY 
d.uploaded_at DESC LIMIT 20;"
                  id                  | document_type  |               filename
    | verified |        vin        | plate_number |        uploaded_at
--------------------------------------+----------------+--------------------------------------+----------+-------------------+--------------+----------------------------
 67991d62-d802-42e2-8e3f-8ba2ffff6b48 | csr            | document-1768816897356-467842151.pdf | f        | YS3E8B35TYMC7ZPBU | HDC-8969     | 2026-01-19 10:01:37.874104
 f79c3f4f-d517-44c0-88ee-882c0003b84c | owner_id       | document-1768816897402-737442371.jpg | f        | YS3E8B35TYMC7ZPBU | HDC-8969     | 2026-01-19 10:01:37.649548
 a612ece8-88f1-4832-8b84-9e36f7ae08ed | sales_invoice  | document-1768816897403-567398352.pdf | f        | YS3E8B35TYMC7ZPBU | HDC-8969     | 2026-01-19 10:01:37.564408
 9a15ffc8-16a3-4ead-b0ce-816ac54414a7 | insurance_cert | document-1768816897237-882016181.pdf | f        | YS3E8B35TYMC7ZPBU | HDC-8969     | 2026-01-19 10:01:37.363725
 f691cb4f-f971-4a2c-8be6-f6b604d6f357 | hpg_clearance  | document-1768816897198-525795481.pdf | f        | YS3E8B35TYMC7ZPBU | HDC-8969     | 2026-01-19 10:01:37.280323
 76b497d0-71a9-4e70-b8a9-91e3653b1094 | csr            | document-1768816108470-706170422.pdf | f        | NHMYW3A5LWW4KNBRD | RHY-5432     | 2026-01-19 09:48:29.558153
 fb6324a6-94f6-4a02-80eb-d2273a8cbfa5 | owner_id       | document-1768816108499-76139104.jpg  | f        | NHMYW3A5LWW4KNBRD | RHY-5432     | 2026-01-19 09:48:29.365631
 a287a03e-06ac-4106-8ff1-7d3b45fc4192 | sales_invoice  | document-1768816108481-44982709.pdf  | f        | NHMYW3A5LWW4KNBRD | RHY-5432     | 2026-01-19 09:48:28.953357
 45aacece-de93-424b-afb3-a2e77e1135aa | insurance_cert | document-1768816108454-933643367.pdf | f        | NHMYW3A5LWW4KNBRD | RHY-5432     | 2026-01-19 09:48:28.576015
 64cfb168-dd08-405c-98f9-879cf4ff8be4 | hpg_clearance  | document-1768816108412-506390656.pdf | f        | NHMYW3A5LWW4KNBRD | RHY-5432     | 2026-01-19 09:48:28.534968
 b7eda2ba-617f-4f4f-95f4-bb8462923442 | owner_id       | document-1768808826027-377294831.jpg | f        | Z6L4MSFU3H9CBMA6F | YAA-9434     | 2026-01-19 07:47:06.375785
 ef8ace01-8ab7-49eb-b221-c92f338d4fb6 | insurance_cert | document-1768808826024-881864660.pdf | f        | Z6L4MSFU3H9CBMA6F | YAA-9434     | 2026-01-19 07:47:06.354019
 e26c076a-6333-4304-966b-2215cf9b808c | csr            | document-1768808825930-408878485.pdf | f        | Z6L4MSFU3H9CBMA6F | YAA-9434     | 2026-01-19 07:47:06.090121
 0c2b3502-00f8-441c-85b3-359fc94689d9 | sales_invoice  | document-1768808825947-997699228.pdf | f        | Z6L4MSFU3H9CBMA6F | YAA-9434     | 2026-01-19 07:47:06.073618
 1d0f29d3-36d7-4a1b-9c45-63e86f37dabd | hpg_clearance  | document-1768808825879-182331636.pdf | f        | Z6L4MSFU3H9CBMA6F | YAA-9434     | 2026-01-19 07:47:05.976425
 56682bc5-3d56-4ac7-877b-5be13e34630c | owner_id       | document-1768806878023-830223976.png | f        |                   |              | 2026-01-19 07:14:38.361023
 0e4ad26a-8b5d-43b6-b010-d94dbbd5d1f0 | csr            | document-1768806878008-250205866.pdf | f        |                   |              | 2026-01-19 07:14:38.180345
 593e59ef-7e42-491a-b6e9-0645c323f0ab | sales_invoice  | document-1768806877964-255619098.pdf | f        |                   |              | 2026-01-19 07:14:38.179891
 9844bd66-ea0b-4c2a-a86f-5aab8e70e764 | hpg_clearance  | document-1768806877978-934475444.pdf | f        |                   |              | 2026-01-19 07:14:38.149869
 0fdbb730-594b-48c9-aae3-1c229a4d2b4e | insurance_cert | document-1768806877935-502392513.pdf | f        |                   |              | 2026-01-19 07:14:38.145158
(20 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count documents by type
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT document_type, COUNT(*) as count, COUNT(CASE WHEN verified = true THEN 1 END) as verified_count FROM documents GROUP BY document_type ORDER BY count DESC;"
 document_type  | count | verified_count 
----------------+-------+----------------
 owner_id       |    10 |              0
 insurance_cert |    10 |              0
 hpg_clearance  |     7 |              0
 csr            |     7 |              0
 sales_invoice  |     7 |              0
(5 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 


root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count history records
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_history FROM vehicle_history;"
records
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

# Count s total_history
---------------
            58
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List recent history records
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT id, vehicle_id, action, description, performed_at, transaction_id FROM vehicle_history ORDER BY performed_at DESC LIMIT 20;"
essions by user
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT u.email, COUNT(*) as session_count FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > CURRENT_TIMESTAMP GROUP BY u.email ORDER BY session_count DESC;"                  id
    |              vehicle_id              |              action              |
                              description                                          |      
  performed_at        |                                            transaction_id

--------------------------------------+--------------------------------------+----------------------------------+----------------------------------------------------------------------------------------------+----------------------------+------------------------------------------------------------------------------------------------------
 87b5d8f6-b8ca-4d1f-aa28-e76541208a15 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 10:42:36.944193 |
 6065d517-223e-4af6-9eed-577eebb25882 | c5424078-dc15-44dc-a573-55ad3e5abe22 | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 10:41:23.092107 |
 8b8cb1bc-1ed3-4cd4-b62a-20f59ef78758 | c5424078-dc15-44dc-a573-55ad3e5abe22 | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 10:41:03.184256 |
 62d5b6d0-4a76-4939-9f97-d329a6ea4abd | c5424078-dc15-44dc-a573-55ad3e5abe22 | INSURANCE_VERIFICATION_REQUESTED | Insurance verification automatically requested
                           | 2026-01-19 10:01:41.466    |
 0bec2446-e1d1-4c6f-9728-6963b3c0bcdb | c5424078-dc15-44dc-a573-55ad3e5abe22 | HPG_AUTOMATION_PHASE1            | HPG Phase 1 automation completed. Metadata used, Database: CLEAN  
                           | 2026-01-19 10:01:41.446296 |
 28a265b7-c625-45a4-b61d-bbf1457cac33 | c5424078-dc15-44dc-a573-55ad3e5abe22 | HPG_CLEARANCE_REQUESTED          | HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance | 2026-01-19 10:01:41.413161 |
 bde5395c-2448-4a69-8c96-74273a7921e5 | c5424078-dc15-44dc-a573-55ad3e5abe22 | BLOCKCHAIN_PENDING               | Vehicle registration submitted to blockchain (status: pending)    
                           | 2026-01-19 10:01:40.589232 | f55153ff53b2fdcd465ac7e2abc0f85034f4ce3b217f490fc4218e41380","timestamp":"2026-01-19T10:01:38.093Z"}
 3322d6c2-163f-4774-b84e-9c39057d9e19 | c5424078-dc15-44dc-a573-55ad3e5abe22 | REGISTERED 
                      | Vehicle registration submitted
                           | 2026-01-19 10:01:37.988863 |
 b8acddf4-f45a-4196-ab09-6df131cb7171 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:56:39.782634 |
 0b71778f-98ad-4cc1-a13e-96c87bcc2373 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:53:34.758958 |
 ab9533a5-ed4f-401a-9766-43f38f8c50b3 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:53:26.920536 |
 faee0765-33fb-4854-99f9-9a00cc06db2f | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:53:15.780247 |
 658e0ec8-1029-4053-83b8-96f72cf4416e | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:52:39.476366 |
 616c26ab-badb-489e-b7f4-f5d777b86de3 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:52:24.443231 |
 3ffb26a7-2321-4557-baad-7146b33a2ba3 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTO_VERIFY                  | HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW               | 2026-01-19 09:50:47.77881  |
 2d7f0519-b371-4bfc-9686-0934c886c34c | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | INSURANCE_VERIFICATION_REQUESTED | Insurance verification automatically requested
                           | 2026-01-19 09:48:32.832911 |
 986cbbfc-f6ac-4705-bdcf-38a7522210eb | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_AUTOMATION_PHASE1            | HPG Phase 1 automation completed. Metadata used, Database: CLEAN  
                           | 2026-01-19 09:48:32.816112 |
 ba33df6d-db52-4ca4-b647-743d29e72da5 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | HPG_CLEARANCE_REQUESTED          | HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance | 2026-01-19 09:48:32.800696 |
 b1308ed2-e812-41b6-8f93-5fe68c7240ce | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | BLOCKCHAIN_PENDING               | Vehicle registration submitted to blockchain (status: pending)    
                           | 2026-01-19 09:48:32.030847 | 6cf55f6a0e2914d75299c29e887cc2470f97847f806a849d40c77e16962","timestamp":"2026-01-19T09:48:29.771Z"}
 ab0bfc05-b077-4737-9c8a-50a976fbdbc3 | 75e27db8-d749-4f5d-bbe9-203c8abb29cb | REGISTERED 
                      | Vehicle registration submitted
                           | 2026-01-19 09:48:29.626535 |
(20 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count actions by type
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT action, COUNT(*) as count FROM vehicle_history GROUP BY action ORDER BY count DESC;"
              action              | count
----------------------------------+-------
 HPG_AUTO_VERIFY                  |    21
 REGISTERED                       |     7
 HPG_AUTOMATION_PHASE1            |     7
 BLOCKCHAIN_PENDING               |     7
 HPG_CLEARANCE_REQUESTED          |     7
 INSURANCE_VERIFICATION_REQUESTED |     7
 INSURANCE_VERIFICATION_APPROVED  |     1
 HPG_VERIFICATION_APPROVED        |     1
(8 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# ```
>
> ### 10. Refresh Tokens & Sessions
>
> ```bash
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count active refresh tokens
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_tokens, COUNT(CASE WHEN expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_tokens FROM refresh_tokens;"
 total_tokens | active_tokens
--------------+---------------
          120 |           120
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List active sessions
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT s.id, u.email, s.ip_address, s.created_at, s.last_activity, s.expires_at FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.expires_at > CURRENT_TIMESTAMP ORDER BY s.last_activity DESC LIMIT 20;"
                  id                  |           email           |   ip_address    |     
    created_at         |       last_activity        |       expires_at
--------------------------------------+---------------------------+-----------------+----------------------------+----------------------------+-------------------------
 1ece32bb-0bfc-4e8d-838a-06131caa1163 | admin@lto.gov.ph          | 112.201.197.106 | 2026-01-19 09:54:57.188587 | 2026-01-19 11:25:10.911589 | 2026-01-26 09:54:57.188
 ff1172c3-199c-4c65-9d40-e6f5b3fb2528 | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 10:45:10.832877 | 2026-01-19 11:21:15.590566 | 2026-01-26 10:45:10.832
 aea19fbd-cb21-4086-a880-06ed2be2daff | hpgadmin@hpg.gov.ph       | 180.195.79.147  | 2026-01-19 10:40:51.520767 | 2026-01-19 10:40:51.520767 | 2026-01-26 10:40:51.52
 d3e5e58c-7e68-4fac-aeda-c3c72dc96de7 | insurance@lto.gov.ph      | 112.201.197.106 | 2026-01-19 10:02:12.340499 | 2026-01-19 10:36:47.529689 | 2026-01-26 10:02:12.34
 f964311a-0638-4816-9679-dcac7cc8df4e | insurance@lto.gov.ph      | 180.195.79.147  | 2026-01-19 09:13:06.429507 | 2026-01-19 10:33:59.954418 | 2026-01-26 09:13:06.429
 6acfc85b-97e1-4af1-a3cf-83114666655b | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 10:25:28.355801 | 2026-01-19 10:25:28.355801 | 2026-01-26 10:25:28.355
 f66e7ed8-fd27-438b-84f7-ec66a61f5f9a | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 09:56:32.040907 | 2026-01-19 09:56:32.040907 | 2026-01-26 09:56:32.04
 dfb2f6ad-507a-4bf2-a739-864c87771aea | latagjoshuaivan@gmail.com | 112.201.197.106 | 2026-01-19 09:55:57.262387 | 2026-01-19 09:55:57.262387 | 2026-01-26 09:55:57.262
 5b8b28a2-a829-4843-be09-3662d16ec02c | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 09:51:52.306982 | 2026-01-19 09:51:52.306982 | 2026-01-26 09:51:52.306
 b30729bc-c872-4018-b12b-1f9342d7a49f | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 09:50:31.783367 | 2026-01-19 09:50:31.783367 | 2026-01-26 09:50:31.783
 b4aa69f0-bd6b-45b3-ae5b-8088de02a528 | insurance@lto.gov.ph      | 112.201.197.106 | 2026-01-19 09:49:31.236981 | 2026-01-19 09:49:31.236981 | 2026-01-26 09:49:31.236
 9f662636-b465-4fce-900f-d6c31fb29483 | insurance@lto.gov.ph      | 112.201.197.106 | 2026-01-19 07:50:49.581075 | 2026-01-19 09:40:22.440089 | 2026-01-26 07:50:49.58
 3779d54c-ebca-4148-a6dd-6ada651f7b9f | latagjoshuaivan@gmail.com | 112.201.197.106 | 2026-01-19 07:42:25.065259 | 2026-01-19 09:34:23.43305  | 2026-01-26 07:42:25.064
 66494da8-d743-420c-972f-680460430449 | emission@lto.gov.ph       | 180.195.79.147  | 2026-01-19 09:12:44.337112 | 2026-01-19 09:12:44.337112 | 2026-01-26 09:12:44.336
 036c60db-ac3b-46c6-ac01-e94c79bd686b | admin@lto.gov.ph          | 180.195.79.147  | 2026-01-19 08:57:19.359077 | 2026-01-19 09:06:19.057138 | 2026-01-26 08:57:19.357
 1eae7bf9-c8ac-4f60-bcec-520fca49b905 | admin@lto.gov.ph          | 180.195.79.147  | 2026-01-19 08:10:44.713556 | 2026-01-19 08:46:51.340709 | 2026-01-26 08:10:44.712
 b6db5099-3a2d-464d-9872-2e22f013fa3a | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 07:48:53.610675 | 2026-01-19 07:48:53.610675 | 2026-01-26 07:48:53.61
 4cc6c684-8346-410c-bbac-76b5407c3b09 | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 07:40:38.816018 | 2026-01-19 07:40:38.816018 | 2026-01-26 07:40:38.815
 5760ce65-8895-4024-803c-57a842ad0255 | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 07:37:23.133142 | 2026-01-19 07:37:23.133142 | 2026-01-26 07:37:23.132
 004150c9-23f8-4f9a-8297-1b7b762585f9 | hpgadmin@hpg.gov.ph       | 112.201.197.106 | 2026-01-19 07:35:28.887773 | 2026-01-19 07:35:28.887773 | 2026-01-26 07:35:28.886
(20 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count sessions by user
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT u.email, COUNT(*) as session_count FROM sessions s JOIN users u 
ON s.user_id = u.id WHERE s.expires_at > CURRENT_TIMESTAMP GROUP BY u.email ORDER BY session_count DESC;"
           email           | session_count 
---------------------------+---------------
 hpgadmin@hpg.gov.ph       |            40
 latagjoshuaivan@gmail.com |            17
 admin@lto.gov.ph          |            15
 dullajasperdave@gmail.com |            13
 emission@lto.gov.ph       |            11
 insurance@lto.gov.ph      |            10
 kimandrei012@gmail.com    |             9
 dealer@csr.lto.gov.ph     |             2
(8 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#


root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count certificates
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT COUNT(*) as total_certificates FROM certificates;"
ertificates
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT id, certificate_type, certificate_number, status, issued_at, expires_at FROM certificates ORDER BY issued_at DESC LIMIT 20;"

# Count certificates by type and status
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT certificate_type, status, COUNT(*) as count FROM certificates GROUP BY certificate_type, status ORDER BY certificate_type, status;"
```

### 12. Indexes

```bash
# List all indexes
docker exec postgres psql -U lto_user -d lto_blockchain -c "\di"

# List indexes with table names
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT schemaname, tablename, 
indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;"

# Count indexes per table
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tablename, COUNT(*) as 
index_count FROM pg_indexes WHERE schemaname = 'public' GROUP BY tablename ORDER BY index_count DESC;" total_certificates
--------------------
                  0
(1 row)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List certificates
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT id, certificate_type, certificate_number, status, issued_at, expires_at FROM certificates ORDER BY issued_at DESC LIMIT 20;"
 id | certificate_type | certificate_number | status | issued_at | expires_at
----+------------------+--------------------+--------+-----------+------------
(0 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count certificates by type and status  
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT certificate_type, status, COUNT(*) as count FROM certificates GROUP BY certificate_type, status ORDER BY certificate_type, status;"
 certificate_type | status | count
------------------+--------+-------
(0 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# ```
>
> ### 12. Indexes
>
> ```bash
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all indexes
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "\di"
                                               List of relations
 Schema |                          Name                          | Type  |  Owner   |     
      Table
--------+--------------------------------------------------------+-------+----------+---------------------------
 public | certificate_submissions_pkey                           | index | lto_user | certificate_submissions
 public | certificates_certificate_number_key                    | index | lto_user | certificates
 public | certificates_composite_hash_key                        | index | lto_user | certificates
 public | certificates_pkey                                      | index | lto_user | certificates
 public | clearance_requests_pkey                                | index | lto_user | clearance_requests
 public | documents_pkey                                         | index | lto_user | documents
 public | email_verification_tokens_pkey                         | index | lto_user | email_verification_tokens
 public | email_verification_tokens_token_hash_key               | index | lto_user | email_verification_tokens
 public | expiry_notifications_pkey                              | index | lto_user | expiry_notifications
 public | external_issuers_api_key_key                           | index | lto_user | external_issuers
 public | external_issuers_license_number_key                    | index | lto_user | external_issuers
 public | external_issuers_pkey                                  | index | lto_user | external_issuers
 public | idx_cert_submissions_file_hash                         | index | lto_user | certificate_submissions
 public | idx_cert_submissions_matched_cert                      | index | lto_user | certificate_submissions
 public | idx_cert_submissions_status                            | index | lto_user | certificate_submissions
 public | idx_cert_submissions_submitted_by                      | index | lto_user | certificate_submissions
 public | idx_cert_submissions_type                              | index | lto_user | certificate_submissions
 public | idx_cert_submissions_vehicle                           | index | lto_user | certificate_submissions
 public | idx_certificate_submissions_file_hash                  | index | lto_user | certificate_submissions
 public | idx_certificate_submissions_status                     | index | lto_user | certificate_submissions
 public | idx_certificate_submissions_type                       | index | lto_user | certificate_submissions
 public | idx_certificate_submissions_vehicle                    | index | lto_user | certificate_submissions
 public | idx_certificates_application_status                    | index | lto_user | certificates
 public | idx_certificates_blockchain_tx_id                      | index | lto_user | certificates
 public | idx_certificates_composite_hash                        | index | lto_user | certificates
 public | idx_certificates_document_id                           | index | lto_user | certificates
 public | idx_certificates_file_hash                             | index | lto_user | certificates
 public | idx_certificates_issued_by                             | index | lto_user | certificates
 public | idx_certificates_number                                | index | lto_user | certificates
 public | idx_certificates_request                               | index | lto_user | certificates
 public | idx_certificates_status                                | index | lto_user | certificates
 public | idx_certificates_type                                  | index | lto_user | certificates
 public | idx_certificates_vehicle                               | index | lto_user | certificates
 public | idx_certificates_verified_by                           | index | lto_user | certificates
 public | idx_clearance_assigned                                 | index | lto_user | clearance_requests
 public | idx_clearance_created_at                               | index | lto_user | clearance_requests
 public | idx_clearance_requested_by                             | index | lto_user | clearance_requests
 public | idx_clearance_status                                   | index | lto_user | clearance_requests
 public | idx_clearance_type                                     | index | lto_user | clearance_requests
 public | idx_clearance_vehicle                                  | index | lto_user | clearance_requests
 public | idx_documents_hash                                     | index | lto_user | documents
 public | idx_documents_ipfs_cid                                 | index | lto_user | documents
 public | idx_documents_type                                     | index | lto_user | documents
 public | idx_documents_unverified                               | index | lto_user | documents
 public | idx_documents_vehicle                                  | index | lto_user | documents
 public | idx_email_verification_tokens_expires_at               | index | lto_user | email_verification_tokens
 public | idx_email_verification_tokens_hash                     | index | lto_user | email_verification_tokens
 public | idx_email_verification_tokens_used_at                  | index | lto_user | email_verification_tokens
 public | idx_email_verification_tokens_user_id                  | index | lto_user | email_verification_tokens
 public | idx_expiry_notifications_type                          | index | lto_user | expiry_notifications
 public | idx_expiry_notifications_user                          | index | lto_user | expiry_notifications
 public | idx_expiry_notifications_vehicle                       | index | lto_user | expiry_notifications
 public | idx_external_issuers_active                            | index | lto_user | external_issuers
 public | idx_external_issuers_license                           | index | lto_user | external_issuers
 public | idx_external_issuers_type                              | index | lto_user | external_issuers
 public | idx_history_action                                     | index | lto_user | vehicle_history
 public | idx_history_performed_at                               | index | lto_user | vehicle_history
 public | idx_history_performed_by                               | index | lto_user | vehicle_history
 public | idx_history_vehicle                                    | index | lto_user | vehicle_history
 public | idx_issued_certificates_composite_hash                 | index | lto_user | issued_certificates
 public | idx_issued_certificates_file_hash                      | index | lto_user | issued_certificates
 public | idx_issued_certificates_issuer                         | index | lto_user | issued_certificates
 public | idx_issued_certificates_revoked                        | index | lto_user | issued_certificates
 public | idx_issued_certificates_sales_invoice                  | index | lto_user | issued_certificates
 public | idx_issued_certificates_type                           | index | lto_user | issued_certificates
 public | idx_issued_certificates_vin                            | index | lto_user | issued_certificates
 public | idx_issued_certs_composite_hash                        | index | lto_user | issued_certificates
 public | idx_issued_certs_file_hash                             | index | lto_user | issued_certificates
 public | idx_issued_certs_issuer                                | index | lto_user | issued_certificates
 public | idx_issued_certs_number                                | index | lto_user | issued_certificates
 public | idx_issued_certs_revoked                               | index | lto_user | issued_certificates
 public | idx_issued_certs_type                                  | index | lto_user | issued_certificates
 public | idx_issued_certs_vin                                   | index | lto_user | issued_certificates
 public | idx_notifications_read                                 | index | lto_user | notifications
 public | idx_notifications_sent_at                              | index | lto_user | notifications
 public | idx_notifications_unread                               | index | lto_user | notifications
 public | idx_notifications_user                                 | index | lto_user | notifications
 public | idx_refresh_tokens_expires_at                          | index | lto_user | refresh_tokens
 public | idx_refresh_tokens_token_hash                          | index | lto_user | refresh_tokens
 public | idx_refresh_tokens_user_id                             | index | lto_user | refresh_tokens
 public | idx_sessions_expires_at                                | index | lto_user | sessions
 public | idx_sessions_refresh_token_id                          | index | lto_user | sessions
 public | idx_sessions_user_id                                   | index | lto_user | sessions
 public | idx_token_blacklist_expires_at                         | index | lto_user | token_blacklist
 public | idx_token_blacklist_hash                               | index | lto_user | token_blacklist
 public | idx_transfer_buyer                                     | index | lto_user | transfer_requests
 public | idx_transfer_docs_document                             | index | lto_user | transfer_documents
 public | idx_transfer_docs_request                              | index | lto_user | transfer_documents
 public | idx_transfer_docs_type                                 | index | lto_user | transfer_documents
 public | idx_transfer_emission_approval                         | index | lto_user | transfer_requests
 public | idx_transfer_hpg_approval                              | index | lto_user | transfer_requests
 public | idx_transfer_insurance_approval                        | index | lto_user | transfer_requests
 public | idx_transfer_reviewed_by                               | index | lto_user | transfer_requests
 public | idx_transfer_seller                                    | index | lto_user | transfer_requests
 public | idx_transfer_status                                    | index | lto_user | transfer_requests
 public | idx_transfer_submitted_at                              | index | lto_user | transfer_requests
 public | idx_transfer_vehicle                                   | index | lto_user | transfer_requests
 public | idx_transfer_verif_document                            | index | lto_user | transfer_verifications
 public | idx_transfer_verif_request                             | index | lto_user | transfer_verifications
 public | idx_transfer_verif_status                              | index | lto_user | transfer_verifications
 public | idx_transfer_verif_verified_by                         | index | lto_user | transfer_verifications
 public | idx_users_active                                       | index | lto_user | users
 public | idx_users_email                                        | index | lto_user | users
 public | idx_users_role                                         | index | lto_user | users
 public | idx_vehicles_active                                    | index | lto_user | vehicles
 public | idx_vehicles_insurance_expiry                          | index | lto_user | vehicles
 public | idx_vehicles_make_model                                | index | lto_user | vehicles
 public | idx_vehicles_owner                                     | index | lto_user | vehicles
 public | idx_vehicles_plate                                     | index | lto_user | vehicles
 public | idx_vehicles_registration_expiry                       | index | lto_user | vehicles
 public | idx_vehicles_status                                    | index | lto_user | vehicles
 public | idx_vehicles_vin                                       | index | lto_user | vehicles
 public | idx_verifications_automated                            | index | lto_user | vehicle_verifications
 public | idx_verifications_clearance_request                    | index | lto_user | vehicle_verifications
 public | idx_verifications_status                               | index | lto_user | vehicle_verifications
 public | idx_verifications_type                                 | index | lto_user | vehicle_verifications
 public | idx_verifications_vehicle                              | index | lto_user | vehicle_verifications
 public | issued_certificates_certificate_number_key             | index | lto_user | issued_certificates
 public | issued_certificates_composite_hash_key                 | index | lto_user | issued_certificates
 public | issued_certificates_file_hash_key                      | index | lto_user | issued_certificates
 public | issued_certificates_pkey                               | index | lto_user | issued_certificates
 public | notifications_pkey                                     | index | lto_user | notifications
 public | refresh_tokens_pkey                                    | index | lto_user | refresh_tokens
 public | refresh_tokens_token_hash_key                          | index | lto_user | refresh_tokens
 public | sessions_pkey                                          | index | lto_user | sessions
 public | system_settings_pkey                                   | index | lto_user | system_settings
 public | token_blacklist_pkey                                   | index | lto_user | token_blacklist
 public | transfer_documents_pkey                                | index | lto_user | transfer_documents
 public | transfer_requests_pkey                                 | index | lto_user | transfer_requests
 public | transfer_verifications_pkey                            | index | lto_user | transfer_verifications
 public | users_email_key                                        | index | lto_user | users
 public | users_pkey                                             | index | lto_user | users
 public | vehicle_history_pkey                                   | index | lto_user | vehicle_history
 public | vehicle_verifications_pkey                             | index | lto_user | vehicle_verifications
 public | vehicle_verifications_vehicle_id_verification_type_key | index | lto_user | vehicle_verifications
 public | vehicles_pkey                                          | index | lto_user | vehicles
 public | vehicles_plate_number_key                              | index | lto_user | vehicles
 public | vehicles_vin_key                                       | index | lto_user | vehicles
(138 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List indexes with table names
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;"
 schemaname |         tablename         |                       indexname
       |
     indexdef

------------+---------------------------+--------------------------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 public     | certificate_submissions   | certificate_submissions_pkey
       | CREATE UNIQUE INDEX certificate_submissions_pkey ON public.certificate_submissions USING btree (id)
 public     | certificate_submissions   | idx_cert_submissions_file_hash
       | CREATE INDEX idx_cert_submissions_file_hash ON public.certificate_submissions USING btree (uploaded_file_hash)
 public     | certificate_submissions   | idx_cert_submissions_matched_cert
       | CREATE INDEX idx_cert_submissions_matched_cert ON public.certificate_submissions 
USING btree (matched_certificate_id)
 public     | certificate_submissions   | idx_cert_submissions_status
       | CREATE INDEX idx_cert_submissions_status ON public.certificate_submissions USING 
btree (verification_status)
 public     | certificate_submissions   | idx_cert_submissions_submitted_by
       | CREATE INDEX idx_cert_submissions_submitted_by ON public.certificate_submissions 
USING btree (submitted_by)
 public     | certificate_submissions   | idx_cert_submissions_type
       | CREATE INDEX idx_cert_submissions_type ON public.certificate_submissions USING btree (certificate_type)
 public     | certificate_submissions   | idx_cert_submissions_vehicle
       | CREATE INDEX idx_cert_submissions_vehicle ON public.certificate_submissions USING btree (vehicle_id)
 public     | certificate_submissions   | idx_certificate_submissions_file_hash
       | CREATE INDEX idx_certificate_submissions_file_hash ON public.certificate_submissions USING btree (uploaded_file_hash)
 public     | certificate_submissions   | idx_certificate_submissions_status
       | CREATE INDEX idx_certificate_submissions_status ON public.certificate_submissions USING btree (verification_status)
 public     | certificate_submissions   | idx_certificate_submissions_type
       | CREATE INDEX idx_certificate_submissions_type ON public.certificate_submissions USING btree (certificate_type)
 public     | certificate_submissions   | idx_certificate_submissions_vehicle
       | CREATE INDEX idx_certificate_submissions_vehicle ON public.certificate_submissions USING btree (vehicle_id)
 public     | certificates              | certificates_certificate_number_key
       | CREATE UNIQUE INDEX certificates_certificate_number_key ON public.certificates USING btree (certificate_number)
 public     | certificates              | certificates_composite_hash_key
       | CREATE UNIQUE INDEX certificates_composite_hash_key ON public.certificates USING 
btree (composite_hash)
 public     | certificates              | certificates_pkey
       | CREATE UNIQUE INDEX certificates_pkey ON public.certificates USING btree (id)    
 public     | certificates              | idx_certificates_application_status
       | CREATE INDEX idx_certificates_application_status ON public.certificates USING btree (application_status)
 public     | certificates              | idx_certificates_blockchain_tx_id
       | CREATE INDEX idx_certificates_blockchain_tx_id ON public.certificates USING btree (blockchain_tx_id)
 public     | certificates              | idx_certificates_composite_hash
       | CREATE INDEX idx_certificates_composite_hash ON public.certificates USING btree (composite_hash)
 public     | certificates              | idx_certificates_document_id
       | CREATE INDEX idx_certificates_document_id ON public.certificates USING btree (document_id)
 public     | certificates              | idx_certificates_file_hash
       | CREATE INDEX idx_certificates_file_hash ON public.certificates USING btree (file_hash)
 public     | certificates              | idx_certificates_issued_by
       | CREATE INDEX idx_certificates_issued_by ON public.certificates USING btree (issued_by)
 public     | certificates              | idx_certificates_number
       | CREATE INDEX idx_certificates_number ON public.certificates USING btree (certificate_number)
 public     | certificates              | idx_certificates_request
       | CREATE INDEX idx_certificates_request ON public.certificates USING btree (clearance_request_id)
 public     | certificates              | idx_certificates_status
       | CREATE INDEX idx_certificates_status ON public.certificates USING btree (status) 
 public     | certificates              | idx_certificates_type
       | CREATE INDEX idx_certificates_type ON public.certificates USING btree (certificate_type)
 public     | certificates              | idx_certificates_vehicle
       | CREATE INDEX idx_certificates_vehicle ON public.certificates USING btree (vehicle_id)
 public     | certificates              | idx_certificates_verified_by
       | CREATE INDEX idx_certificates_verified_by ON public.certificates USING btree (verified_by)
 public     | clearance_requests        | clearance_requests_pkey
       | CREATE UNIQUE INDEX clearance_requests_pkey ON public.clearance_requests USING btree (id)
 public     | clearance_requests        | idx_clearance_assigned
       | CREATE INDEX idx_clearance_assigned ON public.clearance_requests USING btree (assigned_to)
 public     | clearance_requests        | idx_clearance_created_at
       | CREATE INDEX idx_clearance_created_at ON public.clearance_requests USING btree (created_at)
 public     | clearance_requests        | idx_clearance_requested_by
       | CREATE INDEX idx_clearance_requested_by ON public.clearance_requests USING btree 
(requested_by)
 public     | clearance_requests        | idx_clearance_status
       | CREATE INDEX idx_clearance_status ON public.clearance_requests USING btree (status)
 public     | clearance_requests        | idx_clearance_type
       | CREATE INDEX idx_clearance_type ON public.clearance_requests USING btree (request_type)
 public     | clearance_requests        | idx_clearance_vehicle
       | CREATE INDEX idx_clearance_vehicle ON public.clearance_requests USING btree (vehicle_id)
 public     | documents                 | documents_pkey
       | CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id)
 public     | documents                 | idx_documents_hash
       | CREATE INDEX idx_documents_hash ON public.documents USING btree (file_hash)      
 public     | documents                 | idx_documents_ipfs_cid
       | CREATE INDEX idx_documents_ipfs_cid ON public.documents USING btree (ipfs_cid)   
 public     | documents                 | idx_documents_type
       | CREATE INDEX idx_documents_type ON public.documents USING btree (document_type)  
 public     | documents                 | idx_documents_unverified
       | CREATE INDEX idx_documents_unverified ON public.documents USING btree (id) WHERE 
(verified = false)
 public     | documents                 | idx_documents_vehicle
       | CREATE INDEX idx_documents_vehicle ON public.documents USING btree (vehicle_id)  
 public     | email_verification_tokens | email_verification_tokens_pkey
       | CREATE UNIQUE INDEX email_verification_tokens_pkey ON public.email_verification_tokens USING btree (id)
 public     | email_verification_tokens | email_verification_tokens_token_hash_key        
       | CREATE UNIQUE INDEX email_verification_tokens_token_hash_key ON public.email_verification_tokens USING btree (token_hash)
 public     | email_verification_tokens | idx_email_verification_tokens_expires_at        
       | CREATE INDEX idx_email_verification_tokens_expires_at ON public.email_verification_tokens USING btree (expires_at)
 public     | email_verification_tokens | idx_email_verification_tokens_hash
       | CREATE INDEX idx_email_verification_tokens_hash ON public.email_verification_tokens USING btree (token_hash)
 public     | email_verification_tokens | idx_email_verification_tokens_used_at
       | CREATE INDEX idx_email_verification_tokens_used_at ON public.email_verification_tokens USING btree (used_at)
 public     | email_verification_tokens | idx_email_verification_tokens_user_id
       | CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens USING btree (user_id)
 public     | expiry_notifications      | expiry_notifications_pkey
       | CREATE UNIQUE INDEX expiry_notifications_pkey ON public.expiry_notifications USING btree (id)
 public     | expiry_notifications      | idx_expiry_notifications_type
       | CREATE INDEX idx_expiry_notifications_type ON public.expiry_notifications USING btree (notification_type)
 public     | expiry_notifications      | idx_expiry_notifications_user
       | CREATE INDEX idx_expiry_notifications_user ON public.expiry_notifications USING btree (user_id)
 public     | expiry_notifications      | idx_expiry_notifications_vehicle
       | CREATE INDEX idx_expiry_notifications_vehicle ON public.expiry_notifications USING btree (vehicle_id)
 public     | external_issuers          | external_issuers_api_key_key
       | CREATE UNIQUE INDEX external_issuers_api_key_key ON public.external_issuers USING btree (api_key)
 public     | external_issuers          | external_issuers_license_number_key
       | CREATE UNIQUE INDEX external_issuers_license_number_key ON public.external_issuers USING btree (license_number)
 public     | external_issuers          | external_issuers_pkey
       | CREATE UNIQUE INDEX external_issuers_pkey ON public.external_issuers USING btree 
(id)
 public     | external_issuers          | idx_external_issuers_active
       | CREATE INDEX idx_external_issuers_active ON public.external_issuers USING btree (is_active)
 public     | external_issuers          | idx_external_issuers_license
       | CREATE INDEX idx_external_issuers_license ON public.external_issuers USING btree 
(license_number)
 public     | external_issuers          | idx_external_issuers_type
       | CREATE INDEX idx_external_issuers_type ON public.external_issuers USING btree (issuer_type)
 public     | issued_certificates       | idx_issued_certificates_composite_hash
       | CREATE INDEX idx_issued_certificates_composite_hash ON public.issued_certificates USING btree (composite_hash)
 public     | issued_certificates       | idx_issued_certificates_file_hash
       | CREATE INDEX idx_issued_certificates_file_hash ON public.issued_certificates USING btree (file_hash)
 public     | issued_certificates       | idx_issued_certificates_issuer
       | CREATE INDEX idx_issued_certificates_issuer ON public.issued_certificates USING btree (issuer_id)
 public     | issued_certificates       | idx_issued_certificates_revoked
       | CREATE INDEX idx_issued_certificates_revoked ON public.issued_certificates USING 
btree (is_revoked)
 public     | issued_certificates       | idx_issued_certificates_sales_invoice
       | CREATE INDEX idx_issued_certificates_sales_invoice ON public.issued_certificates 
USING btree (certificate_type, vehicle_vin) WHERE ((certificate_type)::text = 'sales_invoice'::text)
 public     | issued_certificates       | idx_issued_certificates_type
       | CREATE INDEX idx_issued_certificates_type ON public.issued_certificates USING btree (certificate_type)
 public     | issued_certificates       | idx_issued_certificates_vin
       | CREATE INDEX idx_issued_certificates_vin ON public.issued_certificates USING btree (vehicle_vin)
 public     | issued_certificates       | idx_issued_certs_composite_hash
       | CREATE INDEX idx_issued_certs_composite_hash ON public.issued_certificates USING 
btree (composite_hash)
 public     | issued_certificates       | idx_issued_certs_file_hash
       | CREATE INDEX idx_issued_certs_file_hash ON public.issued_certificates USING btree (file_hash)
 public     | issued_certificates       | idx_issued_certs_issuer
       | CREATE INDEX idx_issued_certs_issuer ON public.issued_certificates USING btree (issuer_id)
 public     | issued_certificates       | idx_issued_certs_number
       | CREATE INDEX idx_issued_certs_number ON public.issued_certificates USING btree (certificate_number)
 public     | issued_certificates       | idx_issued_certs_revoked
       | CREATE INDEX idx_issued_certs_revoked ON public.issued_certificates USING btree (is_revoked)
 public     | issued_certificates       | idx_issued_certs_type
       | CREATE INDEX idx_issued_certs_type ON public.issued_certificates USING btree (certificate_type)
 public     | issued_certificates       | idx_issued_certs_vin
       | CREATE INDEX idx_issued_certs_vin ON public.issued_certificates USING btree (vehicle_vin)
 public     | issued_certificates       | issued_certificates_certificate_number_key      
       | CREATE UNIQUE INDEX issued_certificates_certificate_number_key ON public.issued_certificates USING btree (certificate_number)
 public     | issued_certificates       | issued_certificates_composite_hash_key
       | CREATE UNIQUE INDEX issued_certificates_composite_hash_key ON public.issued_certificates USING btree (composite_hash)
 public     | issued_certificates       | issued_certificates_file_hash_key
       | CREATE UNIQUE INDEX issued_certificates_file_hash_key ON public.issued_certificates USING btree (file_hash)
 public     | issued_certificates       | issued_certificates_pkey
       | CREATE UNIQUE INDEX issued_certificates_pkey ON public.issued_certificates USING 
btree (id)
 public     | notifications             | idx_notifications_read
       | CREATE INDEX idx_notifications_read ON public.notifications USING btree (read)   
 public     | notifications             | idx_notifications_sent_at
       | CREATE INDEX idx_notifications_sent_at ON public.notifications USING btree (sent_at)
 public     | notifications             | idx_notifications_unread
       | CREATE INDEX idx_notifications_unread ON public.notifications USING btree (id) WHERE (read = false)
 public     | notifications             | idx_notifications_user
       | CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id) public     | notifications             | notifications_pkey
       | CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)  
 public     | refresh_tokens            | idx_refresh_tokens_expires_at
       | CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at)
 public     | refresh_tokens            | idx_refresh_tokens_token_hash
       | CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash)
 public     | refresh_tokens            | idx_refresh_tokens_user_id
       | CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id)
 public     | refresh_tokens            | refresh_tokens_pkey
       | CREATE UNIQUE INDEX refresh_tokens_pkey ON public.refresh_tokens USING btree (id) public     | refresh_tokens            | refresh_tokens_token_hash_key
       | CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING 
btree (token_hash)
 public     | sessions                  | idx_sessions_expires_at
       | CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at) 
 public     | sessions                  | idx_sessions_refresh_token_id
       | CREATE INDEX idx_sessions_refresh_token_id ON public.sessions USING btree (refresh_token_id)
 public     | sessions                  | idx_sessions_user_id
       | CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id)       
 public     | sessions                  | sessions_pkey
       | CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)
 public     | system_settings           | system_settings_pkey
       | CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (key)
 public     | token_blacklist           | idx_token_blacklist_expires_at
       | CREATE INDEX idx_token_blacklist_expires_at ON public.token_blacklist USING btree (expires_at)
 public     | token_blacklist           | idx_token_blacklist_hash
       | CREATE INDEX idx_token_blacklist_hash ON public.token_blacklist USING btree (token_hash)
 public     | token_blacklist           | token_blacklist_pkey
       | CREATE UNIQUE INDEX token_blacklist_pkey ON public.token_blacklist USING btree (token_jti)
 public     | transfer_documents        | idx_transfer_docs_document
       | CREATE INDEX idx_transfer_docs_document ON public.transfer_documents USING btree 
(document_id)
 public     | transfer_documents        | idx_transfer_docs_request
       | CREATE INDEX idx_transfer_docs_request ON public.transfer_documents USING btree (transfer_request_id)
 public     | transfer_documents        | idx_transfer_docs_type
       | CREATE INDEX idx_transfer_docs_type ON public.transfer_documents USING btree (document_type)
 public     | transfer_documents        | transfer_documents_pkey
       | CREATE UNIQUE INDEX transfer_documents_pkey ON public.transfer_documents USING btree (id)
 public     | transfer_requests         | idx_transfer_buyer
       | CREATE INDEX idx_transfer_buyer ON public.transfer_requests USING btree (buyer_id)
 public     | transfer_requests         | idx_transfer_emission_approval
       | CREATE INDEX idx_transfer_emission_approval ON public.transfer_requests USING btree (emission_approval_status)
 public     | transfer_requests         | idx_transfer_hpg_approval
       | CREATE INDEX idx_transfer_hpg_approval ON public.transfer_requests USING btree (hpg_approval_status)
 public     | transfer_requests         | idx_transfer_insurance_approval
       | CREATE INDEX idx_transfer_insurance_approval ON public.transfer_requests USING btree (insurance_approval_status)
 public     | transfer_requests         | idx_transfer_reviewed_by
       | CREATE INDEX idx_transfer_reviewed_by ON public.transfer_requests USING btree (reviewed_by)
 public     | transfer_requests         | idx_transfer_seller
       | CREATE INDEX idx_transfer_seller ON public.transfer_requests USING btree (seller_id)
 public     | transfer_requests         | idx_transfer_status
       | CREATE INDEX idx_transfer_status ON public.transfer_requests USING btree (status) public     | transfer_requests         | idx_transfer_submitted_at
       | CREATE INDEX idx_transfer_submitted_at ON public.transfer_requests USING btree (submitted_at)
 public     | transfer_requests         | idx_transfer_vehicle
       | CREATE INDEX idx_transfer_vehicle ON public.transfer_requests USING btree (vehicle_id)
 public     | transfer_requests         | transfer_requests_pkey
       | CREATE UNIQUE INDEX transfer_requests_pkey ON public.transfer_requests USING btree (id)
 public     | transfer_verifications    | idx_transfer_verif_document
       | CREATE INDEX idx_transfer_verif_document ON public.transfer_verifications USING btree (document_id)
 public     | transfer_verifications    | idx_transfer_verif_request
       | CREATE INDEX idx_transfer_verif_request ON public.transfer_verifications USING btree (transfer_request_id)
 public     | transfer_verifications    | idx_transfer_verif_status
       | CREATE INDEX idx_transfer_verif_status ON public.transfer_verifications USING btree (status)
 public     | transfer_verifications    | idx_transfer_verif_verified_by
       | CREATE INDEX idx_transfer_verif_verified_by ON public.transfer_verifications USING btree (verified_by)
 public     | transfer_verifications    | transfer_verifications_pkey
       | CREATE UNIQUE INDEX transfer_verifications_pkey ON public.transfer_verifications 
USING btree (id)
 public     | users                     | idx_users_active
       | CREATE INDEX idx_users_active ON public.users USING btree (is_active)
 public     | users                     | idx_users_email
       | CREATE INDEX idx_users_email ON public.users USING btree (email)
 public     | users                     | idx_users_role
       | CREATE INDEX idx_users_role ON public.users USING btree (role)
 public     | users                     | users_email_key
       | CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
 public     | users                     | users_pkey
       | CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)
 public     | vehicle_history           | idx_history_action
       | CREATE INDEX idx_history_action ON public.vehicle_history USING btree (action)   
 public     | vehicle_history           | idx_history_performed_at
       | CREATE INDEX idx_history_performed_at ON public.vehicle_history USING btree (performed_at)
 public     | vehicle_history           | idx_history_performed_by
       | CREATE INDEX idx_history_performed_by ON public.vehicle_history USING btree (performed_by)
 public     | vehicle_history           | idx_history_vehicle
       | CREATE INDEX idx_history_vehicle ON public.vehicle_history USING btree (vehicle_id)
 public     | vehicle_history           | vehicle_history_pkey
       | CREATE UNIQUE INDEX vehicle_history_pkey ON public.vehicle_history USING btree (id)
 public     | vehicle_verifications     | idx_verifications_automated
       | CREATE INDEX idx_verifications_automated ON public.vehicle_verifications USING btree (automated, status)
 public     | vehicle_verifications     | idx_verifications_clearance_request
       | CREATE INDEX idx_verifications_clearance_request ON public.vehicle_verifications 
USING btree (clearance_request_id)
 public     | vehicle_verifications     | idx_verifications_status
       | CREATE INDEX idx_verifications_status ON public.vehicle_verifications USING btree (status)
 public     | vehicle_verifications     | idx_verifications_type
       | CREATE INDEX idx_verifications_type ON public.vehicle_verifications USING btree (verification_type)
 public     | vehicle_verifications     | idx_verifications_vehicle
       | CREATE INDEX idx_verifications_vehicle ON public.vehicle_verifications USING btree (vehicle_id)
 public     | vehicle_verifications     | vehicle_verifications_pkey
       | CREATE UNIQUE INDEX vehicle_verifications_pkey ON public.vehicle_verifications USING btree (id)
 public     | vehicle_verifications     | vehicle_verifications_vehicle_id_verification_type_key | CREATE UNIQUE INDEX vehicle_verifications_vehicle_id_verification_type_key ON public.vehicle_verifications USING btree (vehicle_id, verification_type)
 public     | vehicles                  | idx_vehicles_active
       | CREATE INDEX idx_vehicles_active ON public.vehicles USING btree (id) WHERE (status = ANY (ARRAY['SUBMITTED'::vehicle_status, 'REGISTERED'::vehicle_status]))
 public     | vehicles                  | idx_vehicles_insurance_expiry
       | CREATE INDEX idx_vehicles_insurance_expiry ON public.vehicles USING btree (insurance_expiry_date)
 public     | vehicles                  | idx_vehicles_make_model
       | CREATE INDEX idx_vehicles_make_model ON public.vehicles USING btree (make, model) public     | vehicles                  | idx_vehicles_owner
       | CREATE INDEX idx_vehicles_owner ON public.vehicles USING btree (owner_id)        
 public     | vehicles                  | idx_vehicles_plate
       | CREATE INDEX idx_vehicles_plate ON public.vehicles USING btree (plate_number)    
 public     | vehicles                  | idx_vehicles_registration_expiry
       | CREATE INDEX idx_vehicles_registration_expiry ON public.vehicles USING btree (registration_expiry_date)
 public     | vehicles                  | idx_vehicles_status
       | CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status)
 public     | vehicles                  | idx_vehicles_vin
       | CREATE INDEX idx_vehicles_vin ON public.vehicles USING btree (vin)
 public     | vehicles                  | vehicles_pkey
       | CREATE UNIQUE INDEX vehicles_pkey ON public.vehicles USING btree (id)
 public     | vehicles                  | vehicles_plate_number_key
       | CREATE UNIQUE INDEX vehicles_plate_number_key ON public.vehicles USING btree (plate_number)
 public     | vehicles                  | vehicles_vin_key
       | CREATE UNIQUE INDEX vehicles_vin_key ON public.vehicles USING btree (vin)        
(138 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Count indexes per table
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT tablename, COUNT(*) as index_count FROM pg_indexes WHERE schemaname = 'public' GROUP BY tablename ORDER BY index_count DESC;"
         tablename         | index_count 
---------------------------+-------------
 issued_certificates       |          18
 certificates              |          15
 certificate_submissions   |          11
 vehicles                  |          11
 transfer_requests         |          10
 clearance_requests        |           7
 vehicle_verifications     |           7
 email_verification_tokens |           6
 external_issuers          |           6
 documents                 |           6
 refresh_tokens            |           5
 notifications             |           5
 transfer_verifications    |           5
 users                     |           5
 vehicle_history           |           5
 sessions                  |           4
 transfer_documents        |           4
 expiry_notifications      |           4
 token_blacklist           |           3
 system_settings           |           1
(20 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all foreign key constraints
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, kcu.column_name;"
st all constraints
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT table_name, constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema = 'public' ORDER BY table_name, constraint_type;"
```

### 14. Functions & Triggers

```bash
# List all functions
docker exec postgres psql -U lto_user -d lto_blockchain -c "\df"

# List all triggers
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;"        table_name         |          column_name           | foreign_table_name  | foreign_column_name |                    constraint_name
---------------------------+--------------------------------+---------------------+---------------------+-------------------------------------------------------
 certificate_submissions   | matched_certificate_id         | issued_certificates | id    
              | certificate_submissions_matched_certificate_id_fkey
 certificate_submissions   | submitted_by                   | users               | id    
              | certificate_submissions_submitted_by_fkey
 certificate_submissions   | vehicle_id                     | vehicles            | id    
              | certificate_submissions_vehicle_id_fkey
 certificate_submissions   | verified_by                    | users               | id    
              | certificate_submissions_verified_by_fkey
 certificates              | clearance_request_id           | clearance_requests  | id    
              | certificates_clearance_request_id_fkey
 certificates              | document_id                    | documents           | id    
              | certificates_document_id_fkey
 certificates              | issued_by                      | users               | id    
              | certificates_issued_by_fkey
 certificates              | vehicle_id                     | vehicles            | id    
              | certificates_vehicle_id_fkey
 certificates              | verified_by                    | users               | id    
              | certificates_verified_by_fkey
 clearance_requests        | assigned_to                    | users               | id    
              | clearance_requests_assigned_to_fkey
 clearance_requests        | certificate_id                 | certificates        | id    
              | fk_clearance_certificate
 clearance_requests        | requested_by                   | users               | id    
              | clearance_requests_requested_by_fkey
 clearance_requests        | vehicle_id                     | vehicles            | id    
              | clearance_requests_vehicle_id_fkey
 documents                 | uploaded_by                    | users               | id    
              | documents_uploaded_by_fkey
 documents                 | vehicle_id                     | vehicles            | id    
              | documents_vehicle_id_fkey
 documents                 | verified_by                    | users               | id    
              | documents_verified_by_fkey
 email_verification_tokens | user_id                        | users               | id    
              | email_verification_tokens_user_id_fkey
 expiry_notifications      | user_id                        | users               | id    
              | expiry_notifications_user_id_fkey
 expiry_notifications      | vehicle_id                     | vehicles            | id    
              | expiry_notifications_vehicle_id_fkey
 issued_certificates       | issuer_id                      | external_issuers    | id    
              | issued_certificates_issuer_id_fkey
 notifications             | user_id                        | users               | id    
              | notifications_user_id_fkey
 refresh_tokens            | user_id                        | users               | id    
              | refresh_tokens_user_id_fkey
 sessions                  | refresh_token_id               | refresh_tokens      | id    
              | sessions_refresh_token_id_fkey
 sessions                  | user_id                        | users               | id    
              | sessions_user_id_fkey
 system_settings           | updated_by                     | users               | id    
              | system_settings_updated_by_fkey
 transfer_documents        | document_id                    | documents           | id    
              | transfer_documents_document_id_fkey
 transfer_documents        | transfer_request_id            | transfer_requests   | id    
              | transfer_documents_transfer_request_id_fkey
 transfer_documents        | uploaded_by                    | users               | id    
              | transfer_documents_uploaded_by_fkey
 transfer_requests         | buyer_id                       | users               | id    
              | transfer_requests_buyer_id_fkey
 transfer_requests         | emission_approved_by           | users               | id    
              | transfer_requests_emission_approved_by_fkey
 transfer_requests         | emission_clearance_request_id  | clearance_requests  | id    
              | transfer_requests_emission_clearance_request_id_fkey
 transfer_requests         | hpg_approved_by                | users               | id    
              | transfer_requests_hpg_approved_by_fkey
 transfer_requests         | hpg_clearance_request_id       | clearance_requests  | id    
              | transfer_requests_hpg_clearance_request_id_fkey
 transfer_requests         | insurance_approved_by          | users               | id    
              | transfer_requests_insurance_approved_by_fkey
 transfer_requests         | insurance_clearance_request_id | clearance_requests  | id    
              | transfer_requests_insurance_clearance_request_id_fkey
 transfer_requests         | reviewed_by                    | users               | id    
              | transfer_requests_reviewed_by_fkey
 transfer_requests         | seller_id                      | users               | id    
              | transfer_requests_seller_id_fkey
 transfer_requests         | vehicle_id                     | vehicles            | id    
              | transfer_requests_vehicle_id_fkey
 transfer_verifications    | document_id                    | documents           | id    
              | transfer_verifications_document_id_fkey
 transfer_verifications    | transfer_request_id            | transfer_requests   | id    
              | transfer_verifications_transfer_request_id_fkey
 transfer_verifications    | verified_by                    | users               | id    
              | transfer_verifications_verified_by_fkey
 vehicle_history           | performed_by                   | users               | id    
              | vehicle_history_performed_by_fkey
 vehicle_history           | vehicle_id                     | vehicles            | id    
              | vehicle_history_vehicle_id_fkey
 vehicle_verifications     | clearance_request_id           | clearance_requests  | id    
              | vehicle_verifications_clearance_request_id_fkey
 vehicle_verifications     | vehicle_id                     | vehicles            | id    
              | vehicle_verifications_vehicle_id_fkey
 vehicle_verifications     | verified_by                    | users               | id    
              | vehicle_verifications_verified_by_fkey
 vehicles                  | owner_id                       | users               | id    
              | vehicles_owner_id_fkey
(47 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all constraints
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT table_name, constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema = 'public' ORDER BY table_name, constraint_type;"
        table_name         |                    constraint_name                     | constraint_type
---------------------------+--------------------------------------------------------+-----------------
 certificate_submissions   | certificate_submissions_verification_status_check      | CHECK
 certificate_submissions   | 2200_17052_5_not_null                                  | CHECK
 certificate_submissions   | 2200_17052_4_not_null                                  | CHECK
 certificate_submissions   | 2200_17052_3_not_null                                  | CHECK
 certificate_submissions   | certificate_submissions_certificate_type_check         | CHECK
 certificate_submissions   | 2200_17052_6_not_null                                  | CHECK
 certificate_submissions   | 2200_17052_2_not_null                                  | CHECK
 certificate_submissions   | 2200_17052_1_not_null                                  | CHECK
 certificate_submissions   | certificate_submissions_verified_by_fkey               | FOREIGN KEY
 certificate_submissions   | certificate_submissions_vehicle_id_fkey                | FOREIGN KEY
 certificate_submissions   | certificate_submissions_matched_certificate_id_fkey    | FOREIGN KEY
 certificate_submissions   | certificate_submissions_submitted_by_fkey              | FOREIGN KEY
 certificate_submissions   | certificate_submissions_pkey                           | PRIMARY KEY
 certificates              | certificates_certificate_type_check                    | CHECK
 certificates              | certificates_application_status_check                  | CHECK
 certificates              | 2200_16810_1_not_null                                  | CHECK
 certificates              | 2200_16810_3_not_null                                  | CHECK
 certificates              | 2200_16810_4_not_null                                  | CHECK
 certificates              | 2200_16810_5_not_null                                  | CHECK
 certificates              | 2200_16810_8_not_null                                  | CHECK
 certificates              | certificates_status_check                              | CHECK
 certificates              | certificates_verified_by_fkey                          | FOREIGN KEY
 certificates              | certificates_document_id_fkey                          | FOREIGN KEY
 certificates              | certificates_clearance_request_id_fkey                 | FOREIGN KEY
 certificates              | certificates_vehicle_id_fkey                           | FOREIGN KEY
 certificates              | certificates_issued_by_fkey                            | FOREIGN KEY
 certificates              | certificates_pkey                                      | PRIMARY KEY
 certificates              | certificates_certificate_number_key                    | UNIQUE
 certificates              | certificates_composite_hash_key                        | UNIQUE
 clearance_requests        | 2200_16774_5_not_null                                  | CHECK
 clearance_requests        | 2200_16774_1_not_null                                  | CHECK
 clearance_requests        | clearance_requests_request_type_check                  | CHECK
 clearance_requests        | clearance_requests_status_check                        | CHECK
 clearance_requests        | 2200_16774_2_not_null                                  | CHECK
 clearance_requests        | 2200_16774_3_not_null                                  | CHECK
 clearance_requests        | clearance_requests_requested_by_fkey                   | FOREIGN KEY
 clearance_requests        | clearance_requests_vehicle_id_fkey                     | FOREIGN KEY
 clearance_requests        | fk_clearance_certificate                               | FOREIGN KEY
 clearance_requests        | clearance_requests_assigned_to_fkey                    | FOREIGN KEY
 clearance_requests        | clearance_requests_pkey                                | PRIMARY KEY
 documents                 | 2200_16595_5_not_null                                  | CHECK
 documents                 | 2200_16595_9_not_null                                  | CHECK
 documents                 | 2200_16595_1_not_null                                  | CHECK
 documents                 | 2200_16595_8_not_null                                  | CHECK
 documents                 | 2200_16595_4_not_null                                  | CHECK
 documents                 | 2200_16595_7_not_null                                  | CHECK
 documents                 | 2200_16595_6_not_null                                  | CHECK
 documents                 | 2200_16595_3_not_null                                  | CHECK
 documents                 | documents_vehicle_id_fkey                              | FOREIGN KEY
 documents                 | documents_uploaded_by_fkey                             | FOREIGN KEY
 documents                 | documents_verified_by_fkey                             | FOREIGN KEY
 documents                 | documents_pkey                                         | PRIMARY KEY
 email_verification_tokens | 2200_16751_1_not_null                                  | CHECK
 email_verification_tokens | 2200_16751_5_not_null                                  | CHECK
 email_verification_tokens | 2200_16751_4_not_null                                  | CHECK
 email_verification_tokens | 2200_16751_3_not_null                                  | CHECK
 email_verification_tokens | 2200_16751_2_not_null                                  | CHECK
 email_verification_tokens | email_verification_tokens_user_id_fkey                 | FOREIGN KEY
 email_verification_tokens | email_verification_tokens_pkey                         | PRIMARY KEY
 email_verification_tokens | email_verification_tokens_token_hash_key               | UNIQUE
 expiry_notifications      | 2200_17120_1_not_null                                  | CHECK
 expiry_notifications      | 2200_17120_4_not_null                                  | CHECK
 expiry_notifications      | expiry_notifications_user_id_fkey                      | FOREIGN KEY
 expiry_notifications      | expiry_notifications_vehicle_id_fkey                   | FOREIGN KEY
 expiry_notifications      | expiry_notifications_pkey                              | PRIMARY KEY
 external_issuers          | 2200_17002_3_not_null                                  | CHECKissue
 external_issuers          | 2200_17002_4_not_null                                  | CHECK
 external_issuers          | external_issuers_issuer_type_check                     | CHECK
 external_issuers          | 2200_17002_1_not_null                                  | CHECK
 external_issuers          | 2200_17002_2_not_null                                  | CHECK
 external_issuers          | external_issuers_pkey                                  | PRIMARY KEY
 external_issuers          | external_issuers_license_number_key                    | UNIQUE
 external_issuers          | external_issuers_api_key_key                           | UNIQUE
 issued_certificates       | 2200_17022_1_not_null                                  | CHECK
 issued_certificates       | 2200_17022_9_not_null                                  | CHECK
 issued_certificates       | 2200_17022_8_not_null                                  | CHECK
 issued_certificates       | 2200_17022_5_not_null                                  | CHECK
 issued_certificates       | 2200_17022_4_not_null                                  | CHECK
 issued_certificates       | 2200_17022_3_not_null                                  | CHECK
 issued_certificates       | 2200_17022_2_not_null                                  | CHECK
 issued_certificates       | issued_certificates_certificate_type_check             | CHECK
 issued_certificates       | issued_certificates_issuer_id_fkey                     | FOREIGN KEY
 issued_certificates       | issued_certificates_pkey                               | PRIMARY KEY
 issued_certificates       | issued_certificates_composite_hash_key                 | UNIQUE
 issued_certificates       | issued_certificates_file_hash_key                      | UNIQUE
 issued_certificates       | issued_certificates_certificate_number_key             | UNIQUE
 notifications             | 2200_16646_4_not_null                                  | CHECK
 notifications             | 2200_16646_3_not_null                                  | CHECK
 notifications             | 2200_16646_1_not_null                                  | CHECK
 notifications             | notifications_user_id_fkey                             | FOREIGN KEY
 notifications             | notifications_pkey                                     | PRIMARY KEY
 refresh_tokens            | 2200_16697_4_not_null                                  | CHECK
 refresh_tokens            | 2200_16697_3_not_null                                  | CHECK
 refresh_tokens            | 2200_16697_2_not_null                                  | CHECK
 refresh_tokens            | 2200_16697_1_not_null                                  | CHECK
 refresh_tokens            | refresh_tokens_user_id_fkey                            | FOREIGN KEY
 refresh_tokens            | refresh_tokens_pkey                                    | PRIMARY KEY
 refresh_tokens            | refresh_tokens_token_hash_key                          | UNIQUE
 sessions                  | 2200_16711_1_not_null                                  | CHECK
 sessions                  | 2200_16711_2_not_null                                  | CHECK
 sessions                  | 2200_16711_8_not_null                                  | CHECK
 sessions                  | sessions_user_id_fkey                                  | FOREIGN KEY
 sessions                  | sessions_refresh_token_id_fkey                         | FOREIGN KEY
 sessions                  | sessions_pkey                                          | PRIMARY KEY
 system_settings           | 2200_16665_2_not_null                                  | CHECK
 system_settings           | 2200_16665_1_not_null                                  | CHECK
 system_settings           | system_settings_updated_by_fkey                        | FOREIGN KEY
 system_settings           | system_settings_pkey                                   | PRIMARY KEY
 token_blacklist           | 2200_16738_1_not_null                                  | CHECK
 token_blacklist           | 2200_16738_2_not_null                                  | CHECK
 token_blacklist           | 2200_16738_3_not_null                                  | CHECK
 token_blacklist           | token_blacklist_pkey                                   | PRIMARY KEY
 transfer_documents        | check_transfer_document_type                           | CHECK
 transfer_documents        | 2200_16906_5_not_null                                  | CHECK
 transfer_documents        | 2200_16906_3_not_null                                  | CHECK
 transfer_documents        | 2200_16906_2_not_null                                  | CHECK
 transfer_documents        | 2200_16906_1_not_null                                  | CHECK
 transfer_documents        | transfer_documents_transfer_request_id_fkey            | FOREIGN KEY
 transfer_documents        | transfer_documents_uploaded_by_fkey                    | FOREIGN KEY
 transfer_documents        | transfer_documents_document_id_fkey                    | FOREIGN KEY
 transfer_documents        | transfer_documents_pkey                                | PRIMARY KEY
 transfer_requests         | 2200_16860_3_not_null                                  | CHECK
 transfer_requests         | 2200_16860_1_not_null                                  | CHECK
 transfer_requests         | transfer_requests_insurance_approval_status_check      | CHECK
 transfer_requests         | transfer_requests_emission_approval_status_check       | CHECK
 transfer_requests         | transfer_requests_hpg_approval_status_check            | CHECK
 transfer_requests         | transfer_requests_status_check                         | CHECK
 transfer_requests         | 2200_16860_2_not_null                                  | CHECK
 transfer_requests         | transfer_requests_hpg_clearance_request_id_fkey        | FOREIGN KEY
 transfer_requests         | transfer_requests_vehicle_id_fkey                      | FOREIGN KEY
 transfer_requests         | transfer_requests_seller_id_fkey                       | FOREIGN KEY
 transfer_requests         | transfer_requests_reviewed_by_fkey                     | FOREIGN KEY
 transfer_requests         | transfer_requests_insurance_clearance_request_id_fkey  | FOREIGN KEY
 transfer_requests         | transfer_requests_insurance_approved_by_fkey           | FOREIGN KEY
 transfer_requests         | transfer_requests_hpg_approved_by_fkey                 | FOREIGN KEY
 transfer_requests         | transfer_requests_emission_clearance_request_id_fkey   | FOREIGN KEY
 transfer_requests         | transfer_requests_emission_approved_by_fkey            | FOREIGN KEY
 transfer_requests         | transfer_requests_buyer_id_fkey                        | FOREIGN KEY
 transfer_requests         | transfer_requests_pkey                                 | PRIMARY KEY
 transfer_verifications    | 2200_16934_5_not_null                                  | CHECK
 transfer_verifications    | 2200_16934_4_not_null                                  | CHECK
 transfer_verifications    | 2200_16934_2_not_null                                  | CHECK
 transfer_verifications    | 2200_16934_1_not_null                                  | CHECK
 transfer_verifications    | transfer_verifications_status_check                    | CHECK
 transfer_verifications    | transfer_verifications_document_id_fkey                | FOREIGN KEY
 transfer_verifications    | transfer_verifications_verified_by_fkey                | FOREIGN KEY
 transfer_verifications    | transfer_verifications_transfer_request_id_fkey        | FOREIGN KEY
 transfer_verifications    | transfer_verifications_pkey                            | PRIMARY KEY
 users                     | 2200_16521_3_not_null                                  | CHECK
 users                     | 2200_16521_2_not_null                                  | CHECK
 users                     | 2200_16521_5_not_null                                  | CHECK
 users                     | 2200_16521_4_not_null                                  | CHECK
 users                     | 2200_16521_6_not_null                                  | CHECK
 users                     | 2200_16521_1_not_null                                  | CHECK
 users                     | users_pkey                                             | PRIMARY KEY
 users                     | users_email_key                                        | UNIQUE
 vehicle_history           | 2200_16623_3_not_null                                  | CHECK
 vehicle_history           | 2200_16623_1_not_null                                  | CHECK
 vehicle_history           | vehicle_history_vehicle_id_fkey                        | FOREIGN KEY
 vehicle_history           | vehicle_history_performed_by_fkey                      | FOREIGN KEY
 vehicle_history           | vehicle_history_pkey                                   | PRIMARY KEY
 vehicle_verifications     | 2200_16569_3_not_null                                  | CHECK
 vehicle_verifications     | 2200_16569_1_not_null                                  | CHECK
 vehicle_verifications     | vehicle_verifications_clearance_request_id_fkey        | FOREIGN KEY
 vehicle_verifications     | vehicle_verifications_vehicle_id_fkey                  | FOREIGN KEY
 vehicle_verifications     | vehicle_verifications_verified_by_fkey                 | FOREIGN KEY
 vehicle_verifications     | vehicle_verifications_pkey                             | PRIMARY KEY
 vehicle_verifications     | vehicle_verifications_vehicle_id_verification_type_key | UNIQUE
 vehicles                  | 2200_16540_4_not_null                                  | CHECK
 vehicles                  | 2200_16540_1_not_null                                  | CHECK
 vehicles                  | 2200_16540_2_not_null                                  | CHECK
 vehicles                  | 2200_16540_5_not_null                                  | CHECK
 vehicles                  | 2200_16540_6_not_null                                  | CHECK
 vehicles                  | vehicles_owner_id_fkey                                 | FOREIGN KEY
 vehicles                  | vehicles_pkey                                          | PRIMARY KEY
 vehicles                  | vehicles_vin_key                                       | UNIQUE
 vehicles                  | vehicles_plate_number_key                              | UNIQUE
(177 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# ```
>
> ### 14. Functions & Triggers
>
> ```bash
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all functions
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "\df"
                                                                    List of functions
 Schema |                   Name                    | Result data type |
          Argument data types                            | Type
--------+-------------------------------------------+------------------+---------------------------------------------------------------------------+------
 public | auto_cleanup_old_tokens                   | trigger          |
                                                         | func
 public | cleanup_expired_blacklist                 | integer          |
                                                         | func
 public | cleanup_expired_tokens                    | integer          |
                                                         | func
 public | cleanup_expired_verification_tokens       | integer          |
                                                         | func
 public | gin_extract_query_trgm                    | internal         | text, internal, smallint, internal, internal, internal, internal          | func
 public | gin_extract_value_trgm                    | internal         | text, internal   
                                                         | func
 public | gin_trgm_consistent                       | boolean          | internal, smallint, text, integer, internal, internal, internal, internal | func
 public | gin_trgm_triconsistent                    | "char"           | internal, smallint, text, integer, internal, internal, internal           | func
 public | gtrgm_compress                            | internal         | internal
                                                         | func
 public | gtrgm_consistent                          | boolean          | internal, text, smallint, oid, internal                                   | func
 public | gtrgm_decompress                          | internal         | internal
                                                         | func
 public | gtrgm_distance                            | double precision | internal, text, smallint, oid, internal                                   | func
 public | gtrgm_in                                  | gtrgm            | cstring
                                                         | func
 public | gtrgm_options                             | void             | internal
                                                         | func
 public | gtrgm_out                                 | cstring          | gtrgm
                                                         | func
 public | gtrgm_penalty                             | internal         | internal, internal, internal                                              | func
 public | gtrgm_picksplit                           | internal         | internal, internal                                                        | func
 public | gtrgm_same                                | internal         | gtrgm, gtrgm, internal                                                    | func
 public | gtrgm_union                               | gtrgm            | internal, internal                                                        | func
 public | set_limit                                 | real             | real
                                                         | func
 public | show_limit                                | real             |
                                                         | func
 public | show_trgm                                 | text[]           | text
                                                         | func
 public | similarity                                | real             | text, text       
                                                         | func
 public | similarity_dist                           | real             | text, text       
                                                         | func
 public | similarity_op                             | boolean          | text, text       
                                                         | func
 public | strict_word_similarity                    | real             | text, text       
                                                         | func
 public | strict_word_similarity_commutator_op      | boolean          | text, text       
                                                         | func
 public | strict_word_similarity_dist_commutator_op | real             | text, text       
                                                         | func
 public | strict_word_similarity_dist_op            | real             | text, text       
                                                         | func
 public | strict_word_similarity_op                 | boolean          | text, text       
                                                         | func
 public | update_certificate_application_status     | trigger          |
                                                         | func
 public | update_clearance_requests_updated_at      | trigger          |
                                                         | func
 public | update_transfer_requests_updated_at       | trigger          |
                                                         | func
 public | update_updated_at_column                  | trigger          |
                                                         | func
 public | uuid_generate_v1                          | uuid             |
                                                         | func
 public | uuid_generate_v1mc                        | uuid             |
                                                         | func
 public | uuid_generate_v3                          | uuid             | namespace uuid, name text                                                 | func
 public | uuid_generate_v4                          | uuid             |
                                                         | func
 public | uuid_generate_v5                          | uuid             | namespace uuid, name text                                                 | func
 public | uuid_nil                                  | uuid             |
                                                         | func
 public | uuid_ns_dns                               | uuid             |
                                                         | func
 public | uuid_ns_oid                               | uuid             |
                                                         | func
 public | uuid_ns_url                               | uuid             |
                                                         | func
 public | uuid_ns_x500                              | uuid             |
                                                         | func
 public | verify_certificate_submission             | trigger          |
                                                         | func
 public | word_similarity                           | real             | text, text       
                                                         | func
 public | word_similarity_commutator_op             | boolean          | text, text       
                                                         | func
 public | word_similarity_dist_commutator_op        | real             | text, text       
                                                         | func
 public | word_similarity_dist_op                   | real             | text, text       
                                                         | func
 public | word_similarity_op                        | boolean          | text, text       
                                                         | func
(50 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # List all triggers
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;"
                 trigger_name                  |    event_object_table     |
       action_statement
-----------------------------------------------+---------------------------+----------------------------------------------------------
 trigger_verify_certificate                    | certificate_submissions   | EXECUTE FUNCTION verify_certificate_submission()
 trigger_update_clearance_requests_updated_at  | clearance_requests        | EXECUTE FUNCTION update_clearance_requests_updated_at()
 trigger_cleanup_verification_tokens           | email_verification_tokens | EXECUTE FUNCTION auto_cleanup_old_tokens()
 trigger_update_transfer_requests_updated_at   | transfer_requests         | EXECUTE FUNCTION update_transfer_requests_updated_at()
 update_users_updated_at                       | users                     | EXECUTE FUNCTION update_updated_at_column()
 update_verifications_updated_at               | vehicle_verifications     | EXECUTE FUNCTION update_updated_at_column()
 trigger_update_certificate_application_status | vehicles                  | EXECUTE FUNCTION update_certificate_application_status()
 update_vehicles_updated_at                    | vehicles                  | EXECUTE FUNCTION update_updated_at_column()
(8 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "\dx"
c postgres psql -U lto_user -d lto_blockchain -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'plpgsql') ORDER BY extname;"
                       List of installed extensions
   Name    | Version |   Schema   |                            Description

-----------+---------+------------+-------------------------------------------------------------------
 pg_trgm   | 1.6     | public     | text similarity measurement and index searching based 
on trigrams
 plpgsql   | 1.0     | pg_catalog | PL/pgSQL procedural language
 uuid-ossp | 1.1     | public     | generate universally unique identifiers (UUIDs)       
(3 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Check if specific extensions exist     
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'plpgsql') ORDER BY extname;"
  extname  | extversion 
-----------+------------
 pg_trgm   | 1.6
 plpgsql   | 1.0
 uuid-ossp | 1.1
(3 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# 
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT table_name, CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) THEN 'EXISTS' ELSE 'MISSING' END as status FROM (VALUES ('users'), ('vehicles'), ('documents'), ('vehicle_history'), ('transfer_requests'), ('clearance_requests'), ('certificates'), ('refresh_tokens'), ('sessions'), ('token_blacklist'), ('email_verification_tokens')) AS t(table_name);"       
eck Table Relationships

```bash
# Check foreign key relationships
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage 
AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;"        table_name         | status
---------------------------+--------
 users                     | EXISTS
 vehicles                  | EXISTS
 documents                 | EXISTS
 vehicle_history           | EXISTS
 transfer_requests         | EXISTS
 clearance_requests        | EXISTS
 certificates              | EXISTS
 refresh_tokens            | EXISTS
 sessions                  | EXISTS
 token_blacklist           | EXISTS
 email_verification_tokens | EXISTS
(11 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# ```
>
> ### 18. Check Table Relationships
>
> ```bash
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# # Check foreign key relationships
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker exec postgres psql -U lto_user -d 
lto_blockchain -c "SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;"
        table_name         |          column_name           |  references_table   | references_column
---------------------------+--------------------------------+---------------------+-------------------
 certificate_submissions   | matched_certificate_id         | issued_certificates | id    
 certificate_submissions   | vehicle_id                     | vehicles            | id    
 certificate_submissions   | submitted_by                   | users               | id    
 certificate_submissions   | verified_by                    | users               | id    
 certificates              | document_id                    | documents           | id    
 certificates              | verified_by                    | users               | id    
 certificates              | clearance_request_id           | clearance_requests  | id    
 certificates              | vehicle_id                     | vehicles            | id    
 certificates              | issued_by                      | users               | id    
 clearance_requests        | assigned_to                    | users               | id    
 clearance_requests        | vehicle_id                     | vehicles            | id    
 clearance_requests        | requested_by                   | users               | id    
 clearance_requests        | certificate_id                 | certificates        | id    
 documents                 | verified_by                    | users               | id    
 documents                 | uploaded_by                    | users               | id    
 documents                 | vehicle_id                     | vehicles            | id    
 email_verification_tokens | user_id                        | users               | id    
 expiry_notifications      | vehicle_id                     | vehicles            | id    
 expiry_notifications      | user_id                        | users               | id    
 issued_certificates       | issuer_id                      | external_issuers    | id    
 notifications             | user_id                        | users               | id    
 refresh_tokens            | user_id                        | users               | id    
 sessions                  | user_id                        | users               | id    
 sessions                  | refresh_token_id               | refresh_tokens      | id    
 system_settings           | updated_by                     | users               | id    
 transfer_documents        | document_id                    | documents           | id    
 transfer_documents        | uploaded_by                    | users               | id    
 transfer_documents        | transfer_request_id            | transfer_requests   | id    
 transfer_requests         | hpg_approved_by                | users               | id    
 transfer_requests         | seller_id                      | users               | id    
 transfer_requests         | buyer_id                       | users               | id    
 transfer_requests         | reviewed_by                    | users               | id    
 transfer_requests         | hpg_clearance_request_id       | clearance_requests  | id    
 transfer_requests         | insurance_clearance_request_id | clearance_requests  | id    
 transfer_requests         | emission_clearance_request_id  | clearance_requests  | id    
 transfer_requests         | insurance_approved_by          | users               | id    
 transfer_requests         | emission_approved_by           | users               | id    
 transfer_requests         | vehicle_id                     | vehicles            | id    
 transfer_verifications    | document_id                    | documents           | id    
 transfer_verifications    | verified_by                    | users               | id    
 transfer_verifications    | transfer_request_id            | transfer_requests   | id    
 vehicle_history           | performed_by                   | users               | id    
 vehicle_history           | vehicle_id                     | vehicles            | id    
 vehicle_verifications     | clearance_request_id           | clearance_requests  | id    
 vehicle_verifications     | vehicle_id                     | vehicles            | id    
 vehicle_verifications     | verified_by                    | users               | id    
 vehicles                  | owner_id                       | users               | id    
(47 rows)

root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN#










