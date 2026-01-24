--
-- PostgreSQL database dump
--

\restrict WcXLAT7adYRW3hP09gfpAaKyvMVwy8HGdKdS3zPypGt5c5uzr4j3kETFzT9OndI

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-24 14:02:50

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
-- TOC entry 3599 (class 0 OID 16595)
-- Dependencies: 219
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.documents (id, vehicle_id, document_type, filename, original_name, file_path, file_size, mime_type, file_hash, uploaded_by, uploaded_at, verified, verified_at, verified_by) FROM stdin;
\.


--
-- TOC entry 3601 (class 0 OID 16646)
-- Dependencies: 221
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.notifications (id, user_id, title, message, type, read, sent_at, read_at) FROM stdin;
\.


--
-- TOC entry 3602 (class 0 OID 16665)
-- Dependencies: 222
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.system_settings (key, value, description, updated_at, updated_by) FROM stdin;
system_name	TrustChain LTO	System name	2026-01-24 06:02:26.033654	\N
version	1.0.0	System version	2026-01-24 06:02:26.033654	\N
maintenance_mode	false	Maintenance mode flag	2026-01-24 06:02:26.033654	\N
max_file_size	10485760	Maximum file upload size in bytes (10MB)	2026-01-24 06:02:26.033654	\N
allowed_file_types	pdf,jpg,jpeg,png	Allowed file types for upload	2026-01-24 06:02:26.033654	\N
blockchain_mode	mock	Blockchain mode (mock or fabric)	2026-01-24 06:02:26.033654	\N
storage_mode	local	Storage mode (local or ipfs)	2026-01-24 06:02:26.033654	\N
\.


--
-- TOC entry 3596 (class 0 OID 16521)
-- Dependencies: 216
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.users (id, email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified, two_factor_enabled, last_login, created_at, updated_at) FROM stdin;
a57fd791-bef2-4881-baa9-bfbd1c8b799c	admin@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Admin	User	admin	LTO	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623
f4fe76a5-d900-4d3d-8c6a-e9b83472b2cb	staff@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Staff	User	staff	LTO	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623
21d178c0-37c5-466e-b2eb-560e32981cbd	insurance@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Company	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623
73b6d066-9cb7-4b85-94c0-a808d13b005d	emission@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Emission	Verifier	emission_verifier	Emission Testing Center	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623
90ee862b-c410-4370-9cf9-fa1400d9bd4f	owner@example.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Vehicle	Owner	vehicle_owner	Individual	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623
\.


--
-- TOC entry 3600 (class 0 OID 16623)
-- Dependencies: 220
-- Data for Name: vehicle_history; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_history (id, vehicle_id, action, description, performed_by, performed_at, transaction_id, metadata) FROM stdin;
\.


--
-- TOC entry 3598 (class 0 OID 16569)
-- Dependencies: 218
-- Data for Name: vehicle_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_verifications (id, vehicle_id, verification_type, status, verified_by, verified_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3597 (class 0 OID 16540)
-- Dependencies: 217
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicles (id, vin, plate_number, make, model, year, color, engine_number, chassis_number, vehicle_type, fuel_type, transmission, engine_displacement, owner_id, status, registration_date, last_updated, priority, notes) FROM stdin;
\.


-- Completed on 2026-01-24 14:02:58

--
-- PostgreSQL database dump complete
--

\unrestrict WcXLAT7adYRW3hP09gfpAaKyvMVwy8HGdKdS3zPypGt5c5uzr4j3kETFzT9OndI

