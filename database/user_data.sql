--
-- PostgreSQL database dump
--

\restrict WNrlppKOfHElyegk1Yzbz9Fm3MR4THkexKBB8dXlMVQr0mVrsCrVRLJ7uQhbzvd

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-06 17:29:32

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
-- TOC entry 3574 (class 0 OID 16686)
-- Dependencies: 229
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.users (id, email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified, two_factor_enabled, last_login, created_at, updated_at, employee_id, badge_number, department, branch_office, supervisor_id, hire_date, "position", signature_file_path, digital_signature_hash, address, is_trusted_partner, trusted_partner_type, personal_email) FROM stdin;
90ee862b-c410-4370-9cf9-fa1400d9bd4f	owner@example.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Vehicle	Owner	vehicle_owner	Individual	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
d5a83d69-7fba-4f89-bac1-c88fdcee3266	ltoofficer@lto.gov.ph	$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	\N	2026-01-24 09:58:59.148298	2026-01-24 09:58:59.148298	LTO-OFF-001	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N	\N	f	\N	\N
f4fe76a5-d900-4d3d-8c6a-e9b83472b2cb	staff@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Staff	User	staff	LTO	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:17:41.578232	LTO-STAFF-001	STAFF-001	Vehicle Registration	LTO Manila Central	\N	2024-01-01	Registration Clerk	\N	\N	\N	f	\N	\N
1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	latagjoshuaivan@gmail.com	$2a$12$QmquG9pNfaOk8e8kD1i5iusw0NzHDRCjaf3YpY3Jk1YqjICBUufVq	Joshua Ivan	Latag	vehicle_owner	Individual	+639154788771	t	t	f	2026-01-26 15:04:23.073466	2026-01-24 08:23:47.841908	2026-01-26 15:04:23.073466	\N	\N	\N	\N	\N	\N	\N	\N	\N	Dagatan	f	\N	\N
73b6d066-9cb7-4b85-94c0-a808d13b005d	emission@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Emission	Verifier	emission_verifier	Emission Testing Center	\N	t	t	f	2026-01-29 04:25:47.921	2026-01-24 06:02:26.045623	2026-01-29 04:25:47.921	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	hpgadmin@hpg.gov.ph	$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	\N	2026-01-24 06:13:28.265259	2026-01-24 09:24:41.599913	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
5a672d9b-dabc-4778-b380-7587dadab040	dullajasperdave@gmail.com	$2a$12$ReVqd9sepf/4BWPKk.S6QeNSGNKUJM3/zlzWfGnztLzebyBOPGlTy	Jasper	Dulla	vehicle_owner	Individual	09482106236	t	t	f	2026-01-29 06:14:57.427561	2026-01-25 08:11:36.069813	2026-01-29 06:14:57.427561	\N	\N	\N	\N	\N	\N	\N	\N	\N	San Lucas, Lipa City	f	\N	\N
c7179b34-ff7f-4004-9495-2cf9f049c3d1	ltofficer@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	2026-01-24 10:42:22.140097	2026-01-24 06:13:28.262002	2026-01-24 10:42:22.140097	\N	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N	\N	f	\N	\N
276b0346-be41-4f47-b3fe-256dbfec0a74	reinzpoqi@gmail.com	$2a$12$bRXmV8Bw6.nxleMHNWdhleDklY5EgYw5SZoGkb5zBafHYeIOh9.UO	Reinz	Cejalvo	vehicle_owner	Individual	09638645674	t	t	f	2026-01-27 00:55:32.729613	2026-01-27 00:54:46.332642	2026-01-27 00:55:32.729613	\N	\N	\N	\N	\N	\N	\N	\N	\N	Brgy. Bongco, Pototan	f	\N	\N
4651da8f-85ea-4942-86b8-58fde85d1d09	freyniedulla@gmail.com	$2a$12$c2R8utYk/wdxv5asa3pGBe1pF1/kCgjfj8igrA34Bp8d.bvs04dFa	Freynie Rose	Dulla	vehicle_owner	Individual	+639501186724	t	t	f	2026-01-27 01:04:14.130234	2026-01-27 00:42:55.857385	2026-01-27 01:04:14.130234	\N	\N	\N	\N	\N	\N	\N	\N	\N	Brgy. Dongsol Pototan, Iloilo 5008	f	\N	\N
842bac3c-0b3e-4475-9ffc-8eeae7627819	2220503@ub.edu.ph	$2a$12$BvVor4oIV.8a4kx83GTLTeZkBNFgOEaVg7wcxMQP9cO.3dilEyL4O	Jasper	Dave	vehicle_owner	Individual	09482106236	t	t	f	2026-01-27 01:10:40.679153	2026-01-27 00:43:14.964339	2026-01-27 01:10:40.679153	\N	\N	\N	\N	\N	\N	\N	\N	\N	Lipa City	f	\N	\N
21d178c0-37c5-466e-b2eb-560e32981cbd	insurance@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Company	\N	t	t	f	2026-01-31 07:33:49.64609	2026-01-24 06:02:26.045623	2026-01-31 07:33:49.64609	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
73477102-f36b-448a-89d4-9dc3e93466f8	insurance@insurance.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Verification Office	+63 2 3456 7890	t	t	f	2026-02-01 11:31:22.337427	2026-01-24 06:29:41.287341	2026-02-01 11:31:22.337427	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	insurance.lipaph@gmail.com
36b86e7e-7668-49dc-8dd6-6610ce092a73	kimandrei012@gmail.com	$2a$12$6/RiYmpgAnT0J5Jr8spPNe/cKKQjj8NcvCl4gOzS86ZJZ2oWZZHRu	Kim Andrei	Besmar	vehicle_owner	Individual	09672564545	t	t	f	2026-02-03 11:27:13.766633	2026-01-25 03:38:54.665833	2026-02-03 11:27:13.766633	\N	\N	\N	\N	\N	\N	\N	\N	\N	Lipa City	f	\N	\N
e71fccc9-57c4-42c5-9a59-324078118fda	certificategenerator@generator.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Certificate	Generator	admin	Certificate Generation Service	\N	t	t	f	2026-02-02 14:14:28.490679	2026-01-29 14:08:42.108655	2026-02-02 14:14:28.490679	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	lto.lipaph@gmail.com
09752f67-da7e-4a6c-97c9-174760bc0d9c	longganisaseller11@gmail.com	$2a$12$/9mBiAXD1plyBwjOYvI73ObrBHOQIxM3SRmqNGSTucD5hY.xW4lke	Andrei	Besmar	vehicle_owner	Individual	09672564545	t	t	f	2026-02-02 14:19:40.000833	2026-01-27 04:04:53.683016	2026-02-02 14:19:40.000833	\N	\N	\N	\N	\N	\N	\N	\N	\N	Lipa City	f	\N	\N
654bb34d-fec4-458c-94bc-2223d885a6d7	hpg@hpg.gov.ph	$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	2026-02-03 04:55:42.305051	2026-01-24 09:53:44.574528	2026-02-03 04:55:42.305051	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	hpg.lipaph@gmail.com
a57fd791-bef2-4881-baa9-bfbd1c8b799c	admin@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Admin	User	admin	Land Transportation Office	\N	t	t	f	2026-02-06 09:00:41.968178	2026-01-24 06:02:26.045623	2026-02-06 09:00:41.968178	LTO-ADMIN-001	ADMIN-001	Administration	LTO Manila Central	\N	2024-01-01	LTO Administrator	\N	\N	\N	f	\N	lto.lipaph@gmail.com
\.


-- Completed on 2026-02-06 17:29:36

--
-- PostgreSQL database dump complete
--

\unrestrict WNrlppKOfHElyegk1Yzbz9Fm3MR4THkexKBB8dXlMVQr0mVrsCrVRLJ7uQhbzvd

