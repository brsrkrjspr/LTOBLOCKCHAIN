--
-- PostgreSQL database dump
--

\restrict MmZvv2uixesikRHswWidNJVVB3zRenqsoIXkOhsZ8Rw8PqZkCysbSE7Oiutk4QY

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-24 18:38:18

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
-- TOC entry 3985 (class 0 OID 17181)
-- Dependencies: 241
-- Data for Name: certificate_submissions; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.certificate_submissions (id, vehicle_id, certificate_type, uploaded_file_path, uploaded_file_hash, verification_status, verification_notes, matched_certificate_id, submitted_by, verified_by, submitted_at, verified_at, created_at) FROM stdin;
\.


--
-- TOC entry 3979 (class 0 OID 16914)
-- Dependencies: 234
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.certificates (id, clearance_request_id, vehicle_id, certificate_type, certificate_number, file_path, ipfs_cid, issued_by, issued_at, expires_at, status, metadata, created_at, file_hash, composite_hash, blockchain_tx_id, application_status, document_id, verified_at, verified_by, revocation_reason, revoked_at) FROM stdin;
\.


--
-- TOC entry 3978 (class 0 OID 16878)
-- Dependencies: 233
-- Data for Name: clearance_requests; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.clearance_requests (id, vehicle_id, request_type, status, requested_by, requested_at, assigned_to, completed_at, certificate_id, purpose, notes, metadata, created_at, updated_at, verification_mode) FROM stdin;
\.


--
-- TOC entry 3966 (class 0 OID 16595)
-- Dependencies: 219
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.documents (id, vehicle_id, document_type, filename, original_name, file_path, file_size, mime_type, file_hash, uploaded_by, uploaded_at, verified, verified_at, verified_by, is_inspection_document, inspection_document_type) FROM stdin;
\.


--
-- TOC entry 3973 (class 0 OID 16750)
-- Dependencies: 228
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.email_verification_tokens (id, user_id, token_hash, token_secret, expires_at, created_at, used_at, used_by_ip) FROM stdin;
35d0cd36-cd6d-4f44-9c72-e1ab633f82ec	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	b080fb75854ea85ed5c0b001895d7f300c57464caeaf357a85fd18a933736ae1	your-secret-key-here	2026-01-25 08:23:47.876	2026-01-24 08:23:47.881522	2026-01-24 08:24:01.12762	180.195.78.106
\.


--
-- TOC entry 3975 (class 0 OID 16787)
-- Dependencies: 230
-- Data for Name: expiry_notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.expiry_notifications (id, vehicle_id, user_id, notification_type, sent_at, email_sent, sms_sent) FROM stdin;
\.


--
-- TOC entry 3984 (class 0 OID 17162)
-- Dependencies: 240
-- Data for Name: external_issuers; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.external_issuers (id, issuer_type, company_name, license_number, api_key, is_active, contact_email, contact_phone, address, created_at, updated_at) FROM stdin;
aa6d3111-ad58-47af-a235-c45fa869a133	insurance	LTO Insurance Services	INS-2026-001	test_insurance_api_key_12345	t	insurance@lto.gov.ph	\N	\N	2026-01-24 06:55:24.860016	2026-01-24 06:55:24.860016
f8aab84b-614c-4060-a81c-2f3100daa1c5	emission	LTO Emission Testing Center	EMIT-2026-001	test_emission_api_key_67890	t	emission@lto.gov.ph	\N	\N	2026-01-24 06:55:24.865858	2026-01-24 06:55:24.865858
3d2b139b-df76-4885-afba-a47995b2c134	hpg	PNP-HPG National Office	HPG-2026-001	test_hpg_api_key_abcde	t	hpg@lto.gov.ph	\N	\N	2026-01-24 06:55:24.868123	2026-01-24 06:55:24.868123
\.


--
-- TOC entry 3980 (class 0 OID 16975)
-- Dependencies: 235
-- Data for Name: issued_certificates; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.issued_certificates (id, issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, owner_id, file_hash, composite_hash, issued_at, expires_at, blockchain_tx_id, is_revoked, revocation_reason, revoked_at, metadata, created_at) FROM stdin;
\.


--
-- TOC entry 3968 (class 0 OID 16646)
-- Dependencies: 221
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.notifications (id, user_id, title, message, type, read, sent_at, read_at) FROM stdin;
\.


--
-- TOC entry 3976 (class 0 OID 16827)
-- Dependencies: 231
-- Data for Name: officer_activity_log; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.officer_activity_log (id, officer_id, activity_type, entity_type, entity_id, action, duration_seconds, notes, ip_address, user_agent, session_id, metadata, created_at) FROM stdin;
955f26e4-b6e5-4d96-829d-c61dba952052	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /stats without required role: admin or lto_admin	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	{}	2026-01-24 10:38:10.384054
33044a55-d159-4a7c-b6e6-9132348ec1f0	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests/stats without required role: admin or lto_admin	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	{}	2026-01-24 10:38:10.391293
b1d1b24e-7ac3-402b-95be-73a3f4f8700a	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /stats without required role: admin or lto_admin	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	{}	2026-01-24 10:38:10.504687
7d7e5996-a50a-40c8-8c17-c6d8fa5b4975	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests/stats without required role: admin or lto_admin	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	{}	2026-01-24 10:38:10.509988
\.


--
-- TOC entry 3970 (class 0 OID 16697)
-- Dependencies: 225
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, created_at) FROM stdin;
dad74ea6-4b43-48d7-aa1d-4b2ec4cfdbb9	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	f53735902e15ce7f5f54ffe0aa2fb0ae9f71318080dc55cc9e0341d50894a5cc	2026-01-31 08:23:47.864	2026-01-24 08:23:47.86525
3b70cade-1245-435a-afad-e9e2a7885f47	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	9007b6e47896aae0b31551de0e8407997d969a9cd79dacae0d7744ab259546d7	2026-01-31 08:24:14.9	2026-01-24 08:24:14.901421
3ccc3330-60e7-41c4-9c2f-7f6a361b8154	a57fd791-bef2-4881-baa9-bfbd1c8b799c	5942902480e2d081ff343a4943eec8b2fd4d1ba9cb22bed593389da8dc43d3fa	2026-01-31 08:46:37.002	2026-01-24 08:46:37.003388
7c0e7130-8590-4321-a005-0847c81baa34	a57fd791-bef2-4881-baa9-bfbd1c8b799c	44ab685ced67db4dd2c09b18410f254a295b25b3546f958fdbcea482cfb31a50	2026-01-31 08:46:46.076	2026-01-24 08:46:46.07684
2a05b910-3aeb-4b0e-8c72-03faa8870964	a57fd791-bef2-4881-baa9-bfbd1c8b799c	d2a357e702a547fbc835993372a7738725de6b758011f35a28b5cbeb345e2ebd	2026-01-31 08:47:01.46	2026-01-24 08:47:01.46092
47b1395f-b52b-4991-9dd2-084bd7fce253	a57fd791-bef2-4881-baa9-bfbd1c8b799c	9f89c0d8df16ea5312a5211f3ae316f9dbdf2ef241b07cbdd297da54e0044b72	2026-01-31 08:47:37.212	2026-01-24 08:47:37.214238
a2da8017-acf3-4ece-8558-3f1d1e8954a3	a57fd791-bef2-4881-baa9-bfbd1c8b799c	f5bc37bc793be68916461feffebf3f806fe13cf317d2a309d7dffa48ef8db21e	2026-01-31 09:02:52.618	2026-01-24 09:02:52.619944
c1ba17c3-379c-42f3-9cd0-a7fb5215f163	a57fd791-bef2-4881-baa9-bfbd1c8b799c	b3847ca574efb96d88f4d026a1281600480f7a48adaff4c0823f04b38307793b	2026-01-31 09:03:10.004	2026-01-24 09:03:10.00503
0e4ef2a4-57bd-4000-8ed5-3a5fa7bff5cb	a57fd791-bef2-4881-baa9-bfbd1c8b799c	6d71d63cf8f7799a639dc9aa41c345a385cc7bfd737f1ef316ee344a8fb81411	2026-01-31 09:03:26.442	2026-01-24 09:03:26.443416
e378f7bc-360a-448e-99d9-8f6ebe39e1c3	a57fd791-bef2-4881-baa9-bfbd1c8b799c	d53331ce821ba7676ee2afb248f631f96c5542963d51c0c88e2903354b55540f	2026-01-31 09:14:11.296	2026-01-24 09:14:11.297161
e057036a-df4f-4776-a0c6-8756dbb6d8b9	a57fd791-bef2-4881-baa9-bfbd1c8b799c	eed270673e9c44b96cdf5a2d222f88e569ae5511e048b41e1b2fb4f462fb4e91	2026-01-31 09:14:29.896	2026-01-24 09:14:29.897739
f4998a87-a0c2-42cc-b35e-81f639d7f4f4	c7179b34-ff7f-4004-9495-2cf9f049c3d1	bbde7249300777e5bb59932538dfe37ca9c47d428a9f4be4f2e3b81a1fc9a381	2026-01-31 09:16:56.961	2026-01-24 09:16:56.9621
710178fa-bd12-49cc-86ec-1902d3cf54ea	a57fd791-bef2-4881-baa9-bfbd1c8b799c	0b554f0aae9a3be55995e7e2c59a61413fbf33a93b2f7bc0f56a686dd87ed452	2026-01-31 09:29:22.893	2026-01-24 09:29:22.894729
1898af62-b189-43a6-9af4-ea2b2fd94233	a57fd791-bef2-4881-baa9-bfbd1c8b799c	aa325dc21c68acfaced40c96eb333503f4c507134e877037d58005245a7f2572	2026-01-31 09:29:41.016	2026-01-24 09:29:41.017566
d2a05bb8-fb39-47ba-863d-fcf51ec35fe9	c7179b34-ff7f-4004-9495-2cf9f049c3d1	d45a6c72adf9a6ff07f421ad6c801ef1b5aed8b336efac8cde3cc63a857bfd49	2026-01-31 09:30:19.395	2026-01-24 09:30:19.396226
efac6cdc-d108-4846-95de-f68e4da0fa44	c7179b34-ff7f-4004-9495-2cf9f049c3d1	4b8c1eeb5a0b08bc7c399778af43e681997652236272c667a7f444569b38df44	2026-01-31 10:01:21.389	2026-01-24 10:01:21.389433
61c72aa6-4bc5-45ec-beed-8488be0ce5b4	a57fd791-bef2-4881-baa9-bfbd1c8b799c	5ca097a026fd25aa5b70a3378c207b99e2301efbcd9b0fc987dc5c3514c69b24	2026-01-31 10:10:30.373	2026-01-24 10:10:30.374579
cb351ee2-84e7-4f97-8d0f-afa82e3c155a	654bb34d-fec4-458c-94bc-2223d885a6d7	cc59afc7b83b8e0eebe8fca8f1c987b41ea52af8e5a38b8f23ae3a724fda8082	2026-01-31 10:11:10.447	2026-01-24 10:11:10.447732
c71b15d2-d628-426b-8aec-23911d7b332b	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2a3c58deeaf9c3e24a6fe8b29daacc824a7604f6b825aa975edc020453efef33	2026-01-31 10:11:29.538	2026-01-24 10:11:29.538631
86e1326d-b1a2-429d-b3dc-3f880e3a2061	c7179b34-ff7f-4004-9495-2cf9f049c3d1	d54313d20a0f190b252d71abb9c35e1780d8229690fce377b16ff086d79f2f4d	2026-01-31 10:11:55.176	2026-01-24 10:11:55.177173
ff3eb68f-73b0-4306-9d29-35569666ec5f	c7179b34-ff7f-4004-9495-2cf9f049c3d1	f63ba9a4a448d24676bfda123e6bd4d478272be2eb9981d8af1e0edef47b7e91	2026-01-31 10:33:18.063	2026-01-24 10:33:18.064285
a744d838-2ea0-4cab-95bd-acdd9789c3b8	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	bfae5ce411b5a8a8beafc3f664160ca384ebe4f5ca9f4c75389ff239827adc9e	2026-01-31 10:38:08.26	2026-01-24 10:38:08.261351
\.


--
-- TOC entry 3977 (class 0 OID 16857)
-- Dependencies: 232
-- Data for Name: registration_document_requirements; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.registration_document_requirements (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3988 (class 0 OID 17225)
-- Dependencies: 244
-- Data for Name: request_logs; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.request_logs (id, user_id, method, path, status_code, response_time_ms, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- TOC entry 3971 (class 0 OID 16711)
-- Dependencies: 226
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.sessions (id, user_id, refresh_token_id, ip_address, user_agent, created_at, last_activity, expires_at) FROM stdin;
11343c2f-fb51-483e-9954-5bb245aea1e9	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	3b70cade-1245-435a-afad-e9e2a7885f47	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 08:24:14.922822	2026-01-24 08:24:14.922822	2026-01-31 08:24:14.922
6bf05028-d89f-4ce3-92dc-79b0ab1976b8	a57fd791-bef2-4881-baa9-bfbd1c8b799c	3ccc3330-60e7-41c4-9c2f-7f6a361b8154	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 08:46:37.022171	2026-01-24 08:46:37.022171	2026-01-31 08:46:37.013
0e5a0062-415f-4599-bcb1-ca655231449c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	7c0e7130-8590-4321-a005-0847c81baa34	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 08:46:46.084207	2026-01-24 08:46:46.084207	2026-01-31 08:46:46.083
fb48f85f-09ad-408f-b585-7cd80a3f9acf	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2a05b910-3aeb-4b0e-8c72-03faa8870964	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 08:47:01.466455	2026-01-24 08:47:01.466455	2026-01-31 08:47:01.465
725a9ab2-a462-4d92-a76b-660ec98b2847	a57fd791-bef2-4881-baa9-bfbd1c8b799c	47b1395f-b52b-4991-9dd2-084bd7fce253	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 08:47:37.227764	2026-01-24 08:47:37.227764	2026-01-31 08:47:37.227
e66d55c6-79f3-4c34-ab60-b916e3b45d81	a57fd791-bef2-4881-baa9-bfbd1c8b799c	a2da8017-acf3-4ece-8558-3f1d1e8954a3	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:02:52.631995	2026-01-24 09:02:52.631995	2026-01-31 09:02:52.63
3c48b32d-6373-4b09-9dce-f88f486bce8c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	c1ba17c3-379c-42f3-9cd0-a7fb5215f163	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:03:10.013975	2026-01-24 09:03:10.013975	2026-01-31 09:03:10.013
9710918f-5e5f-49e4-b4c6-ef6c7f16fb94	a57fd791-bef2-4881-baa9-bfbd1c8b799c	0e4ef2a4-57bd-4000-8ed5-3a5fa7bff5cb	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:03:26.449652	2026-01-24 09:03:26.449652	2026-01-31 09:03:26.449
09869ff1-fff0-446c-933b-56d5ee3a5001	a57fd791-bef2-4881-baa9-bfbd1c8b799c	e378f7bc-360a-448e-99d9-8f6ebe39e1c3	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:14:11.310336	2026-01-24 09:14:11.310336	2026-01-31 09:14:11.309
23a259cf-26ce-4472-b1df-111fb381c0a7	a57fd791-bef2-4881-baa9-bfbd1c8b799c	e057036a-df4f-4776-a0c6-8756dbb6d8b9	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:14:29.907433	2026-01-24 09:14:29.907433	2026-01-31 09:14:29.906
80c3633b-24f6-4ba5-a718-4e04a21e76a0	c7179b34-ff7f-4004-9495-2cf9f049c3d1	f4998a87-a0c2-42cc-b35e-81f639d7f4f4	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:16:56.970377	2026-01-24 09:25:59.840679	2026-01-31 09:16:56.969
7e5d05de-4e3f-4a67-8246-6c6c2ded9091	a57fd791-bef2-4881-baa9-bfbd1c8b799c	710178fa-bd12-49cc-86ec-1902d3cf54ea	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:29:22.904387	2026-01-24 09:29:22.904387	2026-01-31 09:29:22.903
35411292-8898-4738-a8bf-44c8d2cfc791	a57fd791-bef2-4881-baa9-bfbd1c8b799c	1898af62-b189-43a6-9af4-ea2b2fd94233	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:29:41.02333	2026-01-24 09:29:41.02333	2026-01-31 09:29:41.022
88bb60cc-f7df-4daf-a2cc-dbfb6c3f2f65	c7179b34-ff7f-4004-9495-2cf9f049c3d1	d2a05bb8-fb39-47ba-863d-fcf51ec35fe9	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 09:30:19.401571	2026-01-24 09:30:19.401571	2026-01-31 09:30:19.401
3e6eab17-b7e2-45e7-b50e-075172fcfab5	c7179b34-ff7f-4004-9495-2cf9f049c3d1	efac6cdc-d108-4846-95de-f68e4da0fa44	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:01:21.393484	2026-01-24 10:01:21.393484	2026-01-31 10:01:21.393
aa4370d3-0d7f-4f68-af37-4323b4588c39	a57fd791-bef2-4881-baa9-bfbd1c8b799c	61c72aa6-4bc5-45ec-beed-8488be0ce5b4	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:10:30.384475	2026-01-24 10:10:30.384475	2026-01-31 10:10:30.383
6f07e57f-edb2-469c-91ca-e46e565fafd2	654bb34d-fec4-458c-94bc-2223d885a6d7	cb351ee2-84e7-4f97-8d0f-afa82e3c155a	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:11:10.453527	2026-01-24 10:11:10.453527	2026-01-31 10:11:10.453
6ba5b05b-0ee6-4160-b59a-36d650edbaa4	a57fd791-bef2-4881-baa9-bfbd1c8b799c	c71b15d2-d628-426b-8aec-23911d7b332b	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:11:29.547342	2026-01-24 10:11:29.547342	2026-01-31 10:11:29.546
86a1479c-b22d-49ff-ae49-8918ae505ad0	c7179b34-ff7f-4004-9495-2cf9f049c3d1	86e1326d-b1a2-429d-b3dc-3f880e3a2061	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:11:55.182205	2026-01-24 10:11:55.182205	2026-01-31 10:11:55.181
b602f593-23d7-44d0-9581-51499e371639	c7179b34-ff7f-4004-9495-2cf9f049c3d1	ff3eb68f-73b0-4306-9d29-35569666ec5f	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:33:18.077824	2026-01-24 10:33:18.077824	2026-01-31 10:33:18.077
2c2b89d3-77a6-4f55-99b9-54bd8fdfd9d1	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	a744d838-2ea0-4cab-95bd-acdd9789c3b8	180.195.78.106	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-24 10:38:08.266434	2026-01-24 10:38:08.266434	2026-01-31 10:38:08.266
\.


--
-- TOC entry 3969 (class 0 OID 16665)
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
-- TOC entry 3972 (class 0 OID 16738)
-- Dependencies: 227
-- Data for Name: token_blacklist; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.token_blacklist (token_jti, token_hash, expires_at, created_at, reason) FROM stdin;
7cbef1cd-c522-4dfb-bf47-e8f92ecb3145	ca8e36a41d13c9983b4d9eba664a36c1f16fa841fd77bf8592096fca42d4ae9c	2026-01-24 10:41:13.153	2026-01-24 10:37:59.15383	logout
\.


--
-- TOC entry 3982 (class 0 OID 17058)
-- Dependencies: 237
-- Data for Name: transfer_documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_documents (id, transfer_request_id, document_type, document_id, uploaded_by, uploaded_at, notes) FROM stdin;
\.


--
-- TOC entry 3981 (class 0 OID 17012)
-- Dependencies: 236
-- Data for Name: transfer_requests; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_requests (id, vehicle_id, seller_id, buyer_id, buyer_info, status, submitted_at, reviewed_by, reviewed_at, rejection_reason, forwarded_to_hpg, hpg_clearance_request_id, metadata, created_at, updated_at, insurance_clearance_request_id, emission_clearance_request_id, insurance_approval_status, emission_approval_status, hpg_approval_status, insurance_approved_at, emission_approved_at, hpg_approved_at, insurance_approved_by, emission_approved_by, hpg_approved_by, expires_at, remarks) FROM stdin;
\.


--
-- TOC entry 3983 (class 0 OID 17086)
-- Dependencies: 238
-- Data for Name: transfer_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_verifications (id, transfer_request_id, document_id, verified_by, status, notes, checklist, flagged, verified_at) FROM stdin;
\.


--
-- TOC entry 3963 (class 0 OID 16521)
-- Dependencies: 216
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.users (id, email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified, two_factor_enabled, last_login, created_at, updated_at, employee_id, badge_number, department, branch_office, supervisor_id, hire_date, "position", signature_file_path, digital_signature_hash, address, is_trusted_partner, trusted_partner_type) FROM stdin;
21d178c0-37c5-466e-b2eb-560e32981cbd	insurance@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Company	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
73b6d066-9cb7-4b85-94c0-a808d13b005d	emission@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Emission	Verifier	emission_verifier	Emission Testing Center	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
90ee862b-c410-4370-9cf9-fa1400d9bd4f	owner@example.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Vehicle	Owner	vehicle_owner	Individual	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
d5a83d69-7fba-4f89-bac1-c88fdcee3266	ltoofficer@lto.gov.ph	$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	\N	2026-01-24 09:58:59.148298	2026-01-24 09:58:59.148298	LTO-OFF-001	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N	\N	f	\N
f4fe76a5-d900-4d3d-8c6a-e9b83472b2cb	staff@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Staff	User	staff	LTO	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:17:41.578232	LTO-STAFF-001	STAFF-001	Vehicle Registration	LTO Manila Central	\N	2024-01-01	Registration Clerk	\N	\N	\N	f	\N
73477102-f36b-448a-89d4-9dc3e93466f8	insurance@insurance.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Verification Office	+63 2 3456 7890	t	t	f	2026-01-24 10:00:56.332539	2026-01-24 06:29:41.287341	2026-01-24 10:00:56.332539	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
654bb34d-fec4-458c-94bc-2223d885a6d7	hpg@hpg.gov.ph	$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	2026-01-24 10:11:10.439384	2026-01-24 09:53:44.574528	2026-01-24 10:11:10.439384	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
a57fd791-bef2-4881-baa9-bfbd1c8b799c	admin@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Admin	User	admin	Land Transportation Office	\N	t	t	f	2026-01-24 10:31:13.766879	2026-01-24 06:02:26.045623	2026-01-24 10:31:13.766879	LTO-ADMIN-001	ADMIN-001	Administration	LTO Manila Central	\N	2024-01-01	LTO Administrator	\N	\N	\N	f	\N
5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	hpgadmin@hpg.gov.ph	$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	\N	2026-01-24 06:13:28.265259	2026-01-24 09:24:41.599913	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N
c7179b34-ff7f-4004-9495-2cf9f049c3d1	ltofficer@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	2026-01-24 10:33:18.045403	2026-01-24 06:13:28.262002	2026-01-24 10:33:18.045403	\N	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N	\N	f	\N
1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	latagjoshuaivan@gmail.com	$2a$12$QmquG9pNfaOk8e8kD1i5iusw0NzHDRCjaf3YpY3Jk1YqjICBUufVq	Joshua Ivan	Latag	vehicle_owner	Individual	+639154788771	t	t	f	2026-01-24 10:38:08.246731	2026-01-24 08:23:47.841908	2026-01-24 10:38:08.246731	\N	\N	\N	\N	\N	\N	\N	\N	\N	Dagatan	f	\N
\.


--
-- TOC entry 3967 (class 0 OID 16623)
-- Dependencies: 220
-- Data for Name: vehicle_history; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_history (id, vehicle_id, action, description, performed_by, performed_at, transaction_id, metadata) FROM stdin;
\.


--
-- TOC entry 3965 (class 0 OID 16569)
-- Dependencies: 218
-- Data for Name: vehicle_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_verifications (id, vehicle_id, verification_type, status, verified_by, verified_at, notes, created_at, updated_at, clearance_request_id, automated, verification_score, verification_metadata, auto_verified_at) FROM stdin;
\.


--
-- TOC entry 3964 (class 0 OID 16540)
-- Dependencies: 217
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicles (id, vin, plate_number, make, model, year, color, engine_number, chassis_number, vehicle_type, fuel_type, transmission, engine_displacement, owner_id, status, registration_date, last_updated, priority, notes, mvir_number, inspection_date, inspection_result, roadworthiness_status, emission_compliance, inspection_officer, inspection_notes, inspection_documents, registration_expiry_date, insurance_expiry_date, emission_expiry_date, expiry_notified_30d, expiry_notified_7d, expiry_notified_1d, blockchain_tx_id, vehicle_category, passenger_capacity, gross_vehicle_weight, net_weight, registration_type, origin_type, or_number, cr_number, or_issued_at, cr_issued_at, date_of_registration, scrapped_at, scrap_reason, scrapped_by) FROM stdin;
\.


--
-- TOC entry 4029 (class 0 OID 0)
-- Dependencies: 243
-- Name: cr_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.cr_number_seq', 1, false);


--
-- TOC entry 4030 (class 0 OID 0)
-- Dependencies: 229
-- Name: mvir_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.mvir_number_seq', 1, false);


--
-- TOC entry 4031 (class 0 OID 0)
-- Dependencies: 242
-- Name: or_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.or_number_seq', 1, false);


-- Completed on 2026-01-24 18:38:39

--
-- PostgreSQL database dump complete
--

\unrestrict MmZvv2uixesikRHswWidNJVVB3zRenqsoIXkOhsZ8Rw8PqZkCysbSE7Oiutk4QY

