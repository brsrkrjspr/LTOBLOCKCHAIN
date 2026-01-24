--
-- PostgreSQL database dump
--

\restrict k8XcYhE3E06dfBKX4AY1yVmkQMf1g9fthA4QhB0eKuT3pgbnusqRYqgTyqJTeBL

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-24 14:38:05

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3916 (class 0 OID 16914)
-- Dependencies: 234
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.certificates (id, clearance_request_id, vehicle_id, certificate_type, certificate_number, file_path, ipfs_cid, issued_by, issued_at, expires_at, status, metadata, created_at, file_hash, composite_hash, blockchain_tx_id, application_status, document_id, verified_at, verified_by, revocation_reason, revoked_at) FROM stdin;
\.


--
-- TOC entry 3915 (class 0 OID 16878)
-- Dependencies: 233
-- Data for Name: clearance_requests; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.clearance_requests (id, vehicle_id, request_type, status, requested_by, requested_at, assigned_to, completed_at, certificate_id, purpose, notes, metadata, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3903 (class 0 OID 16595)
-- Dependencies: 219
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.documents (id, vehicle_id, document_type, filename, original_name, file_path, file_size, mime_type, file_hash, uploaded_by, uploaded_at, verified, verified_at, verified_by, is_inspection_document, inspection_document_type) FROM stdin;
\.


--
-- TOC entry 3910 (class 0 OID 16750)
-- Dependencies: 228
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.email_verification_tokens (id, user_id, token_hash, token_secret, expires_at, created_at, used_at, used_by_ip) FROM stdin;
\.


--
-- TOC entry 3912 (class 0 OID 16787)
-- Dependencies: 230
-- Data for Name: expiry_notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.expiry_notifications (id, vehicle_id, user_id, notification_type, sent_at, email_sent, sms_sent) FROM stdin;
\.


--
-- TOC entry 3917 (class 0 OID 16975)
-- Dependencies: 235
-- Data for Name: issued_certificates; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.issued_certificates (id, issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, owner_id, file_hash, composite_hash, issued_at, expires_at, blockchain_tx_id, is_revoked, revocation_reason, revoked_at, metadata, created_at) FROM stdin;
\.


--
-- TOC entry 3905 (class 0 OID 16646)
-- Dependencies: 221
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.notifications (id, user_id, title, message, type, read, sent_at, read_at) FROM stdin;
\.


--
-- TOC entry 3913 (class 0 OID 16827)
-- Dependencies: 231
-- Data for Name: officer_activity_log; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.officer_activity_log (id, officer_id, activity_type, entity_type, entity_id, action, duration_seconds, notes, ip_address, user_agent, session_id, metadata, created_at) FROM stdin;
\.


--
-- TOC entry 3907 (class 0 OID 16697)
-- Dependencies: 225
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, created_at) FROM stdin;
\.


--
-- TOC entry 3914 (class 0 OID 16857)
-- Dependencies: 232
-- Data for Name: registration_document_requirements; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.registration_document_requirements (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3908 (class 0 OID 16711)
-- Dependencies: 226
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.sessions (id, user_id, refresh_token_id, ip_address, user_agent, created_at, last_activity, expires_at) FROM stdin;
\.


--
-- TOC entry 3906 (class 0 OID 16665)
-- Dependencies: 222
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.system_settings (key, value, description, updated_at, updated_by) FROM stdin;
system_name	TrustChain LTO	System name	2026-01-24 06:02:26.033654	\N
version	1.0.0	System version	2026-01-24 06:02:26.033654	\N
maintenance_mode	false	Maintenance mode flag	2026-01-24 06:02:26.033654	\N
max_file_size	10485760	Maximum file upload size in bytes (10MB)	2026-01-24 06:02:26.033654	\N
allowed_file_types	pdf,jpg,jpeg,png	Allowed file types for upload	2026-01-24 06:02:26.033654	\N
storage_mode	local	Storage mode (local or ipfs)	2026-01-24 06:02:26.033654	\N
blockchain_mode	fabric	Blockchain mode (mock or fabric)	2026-01-24 06:13:28.449808	\N
\.


--
-- TOC entry 3909 (class 0 OID 16738)
-- Dependencies: 227
-- Data for Name: token_blacklist; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.token_blacklist (token_jti, token_hash, expires_at, created_at, reason) FROM stdin;
\.


--
-- TOC entry 3919 (class 0 OID 17058)
-- Dependencies: 237
-- Data for Name: transfer_documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_documents (id, transfer_request_id, document_type, document_id, uploaded_by, uploaded_at, notes) FROM stdin;
\.


--
-- TOC entry 3918 (class 0 OID 17012)
-- Dependencies: 236
-- Data for Name: transfer_requests; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_requests (id, vehicle_id, seller_id, buyer_id, buyer_info, status, submitted_at, reviewed_by, reviewed_at, rejection_reason, forwarded_to_hpg, hpg_clearance_request_id, metadata, created_at, updated_at, insurance_clearance_request_id, emission_clearance_request_id, insurance_approval_status, emission_approval_status, hpg_approval_status, insurance_approved_at, emission_approved_at, hpg_approved_at, insurance_approved_by, emission_approved_by, hpg_approved_by) FROM stdin;
\.


--
-- TOC entry 3920 (class 0 OID 17086)
-- Dependencies: 238
-- Data for Name: transfer_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_verifications (id, transfer_request_id, document_id, verified_by, status, notes, checklist, flagged, verified_at) FROM stdin;
\.


--
-- TOC entry 3900 (class 0 OID 16521)
-- Dependencies: 216
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.users (id, email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified, two_factor_enabled, last_login, created_at, updated_at, employee_id, badge_number, department, branch_office, supervisor_id, hire_date, "position", signature_file_path, digital_signature_hash) FROM stdin;
21d178c0-37c5-466e-b2eb-560e32981cbd	insurance@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Company	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N
73b6d066-9cb7-4b85-94c0-a808d13b005d	emission@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Emission	Verifier	emission_verifier	Emission Testing Center	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N
90ee862b-c410-4370-9cf9-fa1400d9bd4f	owner@example.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Vehicle	Owner	vehicle_owner	Individual	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N
f4fe76a5-d900-4d3d-8c6a-e9b83472b2cb	staff@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Staff	User	staff	LTO	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:17:41.578232	LTO-STAFF-001	STAFF-001	Vehicle Registration	LTO Manila Central	\N	2024-01-01	Registration Clerk	\N	\N
a57fd791-bef2-4881-baa9-bfbd1c8b799c	admin@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Admin	User	lto_admin	Land Transportation Office	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:29:41.267829	LTO-ADMIN-001	ADMIN-001	Administration	LTO Manila Central	\N	2024-01-01	LTO Administrator	\N	\N
c7179b34-ff7f-4004-9495-2cf9f049c3d1	ltofficer@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	\N	2026-01-24 06:13:28.262002	2026-01-24 06:29:41.284462	LTO-OFF-001	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N
73477102-f36b-448a-89d4-9dc3e93466f8	insurance@insurance.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Verification Office	+63 2 3456 7890	t	t	f	\N	2026-01-24 06:29:41.287341	2026-01-24 06:29:41.287341	\N	\N	\N	\N	\N	\N	\N	\N	\N
5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	hpgadmin@hpg.gov.ph	$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	\N	2026-01-24 06:13:28.265259	2026-01-24 06:29:41.291996	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- TOC entry 3904 (class 0 OID 16623)
-- Dependencies: 220
-- Data for Name: vehicle_history; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_history (id, vehicle_id, action, description, performed_by, performed_at, transaction_id, metadata) FROM stdin;
\.


--
-- TOC entry 3902 (class 0 OID 16569)
-- Dependencies: 218
-- Data for Name: vehicle_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_verifications (id, vehicle_id, verification_type, status, verified_by, verified_at, notes, created_at, updated_at, clearance_request_id, automated, verification_score, verification_metadata, auto_verified_at) FROM stdin;
\.


--
-- TOC entry 3901 (class 0 OID 16540)
-- Dependencies: 217
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicles (id, vin, plate_number, make, model, year, color, engine_number, chassis_number, vehicle_type, fuel_type, transmission, engine_displacement, owner_id, status, registration_date, last_updated, priority, notes, mvir_number, inspection_date, inspection_result, roadworthiness_status, emission_compliance, inspection_officer, inspection_notes, inspection_documents, registration_expiry_date, insurance_expiry_date, emission_expiry_date, expiry_notified_30d, expiry_notified_7d, expiry_notified_1d, blockchain_tx_id) FROM stdin;
\.


--
-- TOC entry 3961 (class 0 OID 0)
-- Dependencies: 229
-- Name: mvir_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.mvir_number_seq', 1, false);


-- Completed on 2026-01-24 14:38:12

--
-- PostgreSQL database dump complete
--

\unrestrict k8XcYhE3E06dfBKX4AY1yVmkQMf1g9fthA4QhB0eKuT3pgbnusqRYqgTyqJTeBL

