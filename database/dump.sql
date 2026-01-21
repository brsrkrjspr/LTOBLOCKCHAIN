--
-- PostgreSQL database dump
--

\restrict ryWu8pw8ytd2GJfIlHAEgG3NB2cTQgm4rAr0Zv1omV1qG9EDIc7ygDdhi3xXtbv

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-01-21 20:45:40

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
-- TOC entry 3 (class 3079 OID 16396)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 3947 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 2 (class 3079 OID 16385)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3948 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 928 (class 1247 OID 16512)
-- Name: document_type; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.document_type AS ENUM (
    'registration_cert',
    'insurance_cert',
    'emission_cert',
    'owner_id',
    'deed_of_sale',
    'seller_id',
    'buyer_id',
    'other',
    'csr',
    'hpg_clearance',
    'sales_invoice',
    'ctpl_cert',
    'mvir_cert',
    'tin_id',
    'transfer_package_pdf',
    'transfer_certificate'
);


ALTER TYPE public.document_type OWNER TO lto_user;

--
-- TOC entry 3949 (class 0 OID 0)
-- Dependencies: 928
-- Name: TYPE document_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TYPE public.document_type IS 'Document type enum: registration_cert, insurance_cert, emission_cert, owner_id, deed_of_sale, seller_id, buyer_id, other';


--
-- TOC entry 919 (class 1247 OID 16478)
-- Name: user_role; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'staff',
    'insurance_verifier',
    'emission_verifier',
    'vehicle_owner',
    'hpg_admin'
);


ALTER TYPE public.user_role OWNER TO lto_user;

--
-- TOC entry 925 (class 1247 OID 16498)
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.vehicle_status AS ENUM (
    'SUBMITTED',
    'PENDING_BLOCKCHAIN',
    'REGISTERED',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
    'TRANSFER_IN_PROGRESS',
    'TRANSFER_COMPLETED'
);


ALTER TYPE public.vehicle_status OWNER TO lto_user;

--
-- TOC entry 922 (class 1247 OID 16490)
-- Name: verification_status; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.verification_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.verification_status OWNER TO lto_user;

--
-- TOC entry 297 (class 1255 OID 16772)
-- Name: auto_cleanup_old_tokens(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.auto_cleanup_old_tokens() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Run cleanup function occasionally (every ~50 inserts would be ~1/50 = 2%)
    IF RANDOM() < 0.02 THEN
        DELETE FROM email_verification_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
        OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_cleanup_old_tokens() OWNER TO lto_user;

--
-- TOC entry 302 (class 1255 OID 16749)
-- Name: cleanup_expired_blacklist(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.cleanup_expired_blacklist() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM token_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_blacklist() OWNER TO lto_user;

--
-- TOC entry 301 (class 1255 OID 16737)
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.cleanup_expired_tokens() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete expired sessions
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_tokens() OWNER TO lto_user;

--
-- TOC entry 296 (class 1255 OID 16771)
-- Name: cleanup_expired_verification_tokens(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.cleanup_expired_verification_tokens() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_verification_tokens() OWNER TO lto_user;

--
-- TOC entry 298 (class 1255 OID 16988)
-- Name: update_certificate_application_status(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.update_certificate_application_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW.status = 'REJECTED' AND (OLD.status IS DISTINCT FROM 'REJECTED') THEN UPDATE certificates SET application_status = 'REJECTED', status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revocation_reason = 'Vehicle application rejected' WHERE vehicle_id = NEW.id AND application_status = 'PENDING' AND status IN ('ISSUED','APPROVED'); RETURN NEW; END IF; IF NEW.status IN ('APPROVED','REGISTERED') AND (OLD.status IS NULL OR OLD.status NOT IN ('APPROVED','REGISTERED')) THEN UPDATE certificates SET application_status = 'APPROVED', status = CASE WHEN status='ISSUED' THEN 'APPROVED' ELSE status END, verified_at = CURRENT_TIMESTAMP, verified_by = (SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1) WHERE vehicle_id = NEW.id AND application_status = 'PENDING' AND status = 'ISSUED'; RETURN NEW; END IF; RETURN NEW; END; $$;


ALTER FUNCTION public.update_certificate_application_status() OWNER TO lto_user;

--
-- TOC entry 299 (class 1255 OID 16858)
-- Name: update_clearance_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.update_clearance_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_clearance_requests_updated_at() OWNER TO lto_user;

--
-- TOC entry 304 (class 1255 OID 17265)
-- Name: update_document_requirements_updated_at(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.update_document_requirements_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_document_requirements_updated_at() OWNER TO lto_user;

--
-- TOC entry 300 (class 1255 OID 16965)
-- Name: update_transfer_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.update_transfer_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_transfer_requests_updated_at() OWNER TO lto_user;

--
-- TOC entry 295 (class 1255 OID 16678)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- For vehicles table, update last_updated
    IF TG_TABLE_NAME = 'vehicles' THEN
        NEW.last_updated := CURRENT_TIMESTAMP;
    -- For other tables, try updated_at first, then last_updated
    ELSE
        -- Try to update updated_at if it exists (for users, verifications, etc.)
        BEGIN
            NEW.updated_at := CURRENT_TIMESTAMP;
        EXCEPTION
            WHEN undefined_column THEN
                -- Column doesn't exist, try last_updated instead
                BEGIN
                    NEW.last_updated := CURRENT_TIMESTAMP;
                EXCEPTION
                    WHEN undefined_column THEN
                        -- Neither column exists, do nothing
                        NULL;
                END;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO lto_user;

--
-- TOC entry 303 (class 1255 OID 17097)
-- Name: verify_certificate_submission(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.verify_certificate_submission() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Try to find matching issued certificate by file hash
    UPDATE certificate_submissions cs
    SET 
        matched_certificate_id = ic.id,
        verification_status = CASE
            WHEN ic.is_revoked THEN 'REJECTED'
            WHEN ic.expires_at < CURRENT_TIMESTAMP THEN 'EXPIRED'
            ELSE 'VERIFIED'
        END,
        verified_at = CURRENT_TIMESTAMP,
        verification_notes = CASE
            WHEN ic.is_revoked THEN 'Certificate has been revoked: ' || COALESCE(ic.revocation_reason, 'No reason provided')
            WHEN ic.expires_at < CURRENT_TIMESTAMP THEN 'Certificate expired on ' || ic.expires_at::date
            ELSE 'Certificate verified against blockchain records'
        END
    FROM issued_certificates ic
    WHERE cs.id = NEW.id
        AND cs.uploaded_file_hash = ic.file_hash
        AND cs.certificate_type = ic.certificate_type;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.verify_certificate_submission() OWNER TO lto_user;

--
-- TOC entry 3950 (class 0 OID 0)
-- Dependencies: 303
-- Name: FUNCTION verify_certificate_submission(); Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON FUNCTION public.verify_certificate_submission() IS 'Automatically verifies uploaded certificates against issued_certificates by comparing file hashes';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 236 (class 1259 OID 17052)
-- Name: certificate_submissions; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.certificate_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    certificate_type character varying(20) NOT NULL,
    uploaded_file_path text NOT NULL,
    uploaded_file_hash character varying(64) NOT NULL,
    submitted_by uuid NOT NULL,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verification_status character varying(20) DEFAULT 'PENDING'::character varying,
    verified_at timestamp without time zone,
    verified_by uuid,
    matched_certificate_id uuid,
    verification_notes text,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT certificate_submissions_certificate_type_check CHECK (((certificate_type)::text = ANY ((ARRAY['insurance'::character varying, 'emission'::character varying, 'hpg_clearance'::character varying, 'csr'::character varying, 'sales_invoice'::character varying])::text[]))),
    CONSTRAINT certificate_submissions_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying])::text[])))
);


ALTER TABLE public.certificate_submissions OWNER TO lto_user;

--
-- TOC entry 3951 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE certificate_submissions; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.certificate_submissions IS 'Vehicle owner submissions of certificates to LTO for verification';


--
-- TOC entry 3952 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN certificate_submissions.uploaded_file_hash; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificate_submissions.uploaded_file_hash IS 'Hash of uploaded file - will be compared against issued_certificates';


--
-- TOC entry 3953 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN certificate_submissions.verification_status; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificate_submissions.verification_status IS 'PENDING: awaiting verification, VERIFIED: hash matched, REJECTED: invalid/fake, EXPIRED: certificate expired';


--
-- TOC entry 3954 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN certificate_submissions.matched_certificate_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificate_submissions.matched_certificate_id IS 'Links to the original issued certificate if hash matches';


--
-- TOC entry 234 (class 1259 OID 17002)
-- Name: external_issuers; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.external_issuers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issuer_type character varying(20) NOT NULL,
    company_name character varying(255) NOT NULL,
    license_number character varying(100) NOT NULL,
    authorized_by character varying(100),
    authorized_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    api_key character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT external_issuers_issuer_type_check CHECK (((issuer_type)::text = ANY ((ARRAY['insurance'::character varying, 'emission'::character varying, 'hpg'::character varying, 'csr'::character varying, 'sales_invoice'::character varying])::text[])))
);


ALTER TABLE public.external_issuers OWNER TO lto_user;

--
-- TOC entry 3955 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE external_issuers; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.external_issuers IS 'Authorized organizations that issue certificates (insurance companies, emission centers, HPG)';


--
-- TOC entry 3956 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN external_issuers.issuer_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.external_issuers.issuer_type IS 'Type of issuer: insurance, emission, or hpg';


--
-- TOC entry 3957 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN external_issuers.api_key; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.external_issuers.api_key IS 'API key for external system integration';


--
-- TOC entry 235 (class 1259 OID 17022)
-- Name: issued_certificates; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.issued_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issuer_id uuid NOT NULL,
    certificate_type character varying(20) NOT NULL,
    certificate_number character varying(100) NOT NULL,
    vehicle_vin character varying(17) NOT NULL,
    owner_name character varying(255),
    owner_id character varying(100),
    file_hash character varying(64) NOT NULL,
    composite_hash character varying(64) NOT NULL,
    issued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    blockchain_tx_id character varying(255),
    is_revoked boolean DEFAULT false,
    revocation_reason text,
    revoked_at timestamp without time zone,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT issued_certificates_certificate_type_check CHECK (((certificate_type)::text = ANY ((ARRAY['insurance'::character varying, 'emission'::character varying, 'hpg_clearance'::character varying, 'csr'::character varying, 'sales_invoice'::character varying])::text[])))
);


ALTER TABLE public.issued_certificates OWNER TO lto_user;

--
-- TOC entry 3958 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE issued_certificates; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.issued_certificates IS 'Certificates issued by external authorized organizations';


--
-- TOC entry 3959 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN issued_certificates.file_hash; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.issued_certificates.file_hash IS 'SHA-256 hash of the certificate PDF file';


--
-- TOC entry 3960 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN issued_certificates.composite_hash; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.issued_certificates.composite_hash IS 'Composite hash (certNumber+VIN+expiry+fileHash) for verification';


--
-- TOC entry 3961 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN issued_certificates.blockchain_tx_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.issued_certificates.blockchain_tx_id IS 'Hyperledger Fabric transaction ID where hash is stored';


--
-- TOC entry 216 (class 1259 OID 16521)
-- Name: users; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role public.user_role DEFAULT 'vehicle_owner'::public.user_role NOT NULL,
    organization character varying(255),
    phone character varying(20),
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    two_factor_enabled boolean DEFAULT false,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    address character varying(500)
);


ALTER TABLE public.users OWNER TO lto_user;

--
-- TOC entry 3962 (class 0 OID 0)
-- Dependencies: 216
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.users IS 'System users with role-based access control';


--
-- TOC entry 3963 (class 0 OID 0)
-- Dependencies: 216
-- Name: COLUMN users.address; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.address IS 'User physical address';


--
-- TOC entry 217 (class 1259 OID 16540)
-- Name: vehicles; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vin character varying(17) NOT NULL,
    plate_number character varying(20),
    make character varying(50) NOT NULL,
    model character varying(50) NOT NULL,
    year integer NOT NULL,
    color character varying(30),
    engine_number character varying(50),
    chassis_number character varying(50),
    vehicle_type character varying(30) DEFAULT 'PASSENGER'::character varying,
    fuel_type character varying(20) DEFAULT 'GASOLINE'::character varying,
    transmission character varying(20) DEFAULT 'MANUAL'::character varying,
    engine_displacement character varying(20),
    owner_id uuid,
    status public.vehicle_status DEFAULT 'SUBMITTED'::public.vehicle_status,
    registration_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    priority character varying(10) DEFAULT 'MEDIUM'::character varying,
    notes text,
    vehicle_category character varying(5),
    passenger_capacity integer,
    gross_vehicle_weight numeric(10,2),
    net_weight numeric(10,2),
    registration_type character varying(20) DEFAULT 'Private'::character varying,
    origin_type character varying(20) DEFAULT 'NEW_REG'::character varying,
    registration_expiry_date timestamp without time zone,
    insurance_expiry_date timestamp without time zone,
    emission_expiry_date timestamp without time zone,
    expiry_notified_30d boolean DEFAULT false,
    expiry_notified_7d boolean DEFAULT false,
    expiry_notified_1d boolean DEFAULT false,
    or_number character varying(50),
    cr_number character varying(50),
    or_issued_at timestamp without time zone,
    cr_issued_at timestamp without time zone,
    date_of_registration timestamp without time zone,
    vehicle_classification character varying(50),
    mvir_number character varying(20),
    inspection_date timestamp without time zone,
    inspection_result character varying(20),
    roadworthiness_status character varying(20),
    emission_compliance character varying(20),
    inspection_officer character varying(100),
    inspection_notes text,
    inspection_documents jsonb
);


ALTER TABLE public.vehicles OWNER TO lto_user;

--
-- TOC entry 3964 (class 0 OID 0)
-- Dependencies: 217
-- Name: TABLE vehicles; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicles IS 'Vehicle registration data with blockchain integration';


--
-- TOC entry 3965 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.net_weight; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.net_weight IS 'Net weight of vehicle in kilograms (for CR)';


--
-- TOC entry 3966 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.registration_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.registration_type IS 'Type of registration: PRIVATE, FOR_HIRE, GOVERNMENT';


--
-- TOC entry 3967 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.or_number; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.or_number IS 'Separate Official Receipt number. Format: OR-YYYY-XXXXXX. Replaces combined or_cr_number.';


--
-- TOC entry 3968 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.cr_number; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.cr_number IS 'Separate Certificate of Registration number. Format: CR-YYYY-XXXXXX. Replaces combined or_cr_number.';


--
-- TOC entry 3969 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.or_issued_at; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.or_issued_at IS 'Timestamp when the OR number was issued';


--
-- TOC entry 3970 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.cr_issued_at; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.cr_issued_at IS 'Timestamp when the CR number was issued';


--
-- TOC entry 3971 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.date_of_registration; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.date_of_registration IS 'Date when vehicle was registered (separate from registration_date for clarity)';


--
-- TOC entry 3972 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN vehicles.vehicle_classification; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.vehicle_classification IS 'LTO vehicle classification';


--
-- TOC entry 237 (class 1259 OID 17092)
-- Name: certificate_verification_summary; Type: VIEW; Schema: public; Owner: lto_user
--

CREATE VIEW public.certificate_verification_summary AS
 SELECT cs.id AS submission_id,
    cs.vehicle_id,
    v.vin,
    v.plate_number,
    cs.certificate_type,
    cs.verification_status,
    cs.submitted_at,
    cs.verified_at,
    u.email AS submitted_by_email,
    ei.company_name AS issuer_name,
    ic.certificate_number,
    ic.issued_at AS original_issue_date,
    ic.expires_at,
        CASE
            WHEN ic.is_revoked THEN 'REVOKED'::character varying
            WHEN (ic.expires_at < CURRENT_TIMESTAMP) THEN 'EXPIRED'::character varying
            WHEN ((cs.verification_status)::text = 'VERIFIED'::text) THEN 'VALID'::character varying
            ELSE cs.verification_status
        END AS overall_status
   FROM ((((public.certificate_submissions cs
     LEFT JOIN public.vehicles v ON ((cs.vehicle_id = v.id)))
     LEFT JOIN public.users u ON ((cs.submitted_by = u.id)))
     LEFT JOIN public.issued_certificates ic ON ((cs.matched_certificate_id = ic.id)))
     LEFT JOIN public.external_issuers ei ON ((ic.issuer_id = ei.id)));


ALTER VIEW public.certificate_verification_summary OWNER TO lto_user;

--
-- TOC entry 3973 (class 0 OID 0)
-- Dependencies: 237
-- Name: VIEW certificate_verification_summary; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON VIEW public.certificate_verification_summary IS 'Comprehensive view of certificate submissions with verification status';


--
-- TOC entry 230 (class 1259 OID 16810)
-- Name: certificates; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.certificates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clearance_request_id uuid,
    vehicle_id uuid NOT NULL,
    certificate_type character varying(20) NOT NULL,
    certificate_number character varying(50) NOT NULL,
    file_path character varying(500),
    ipfs_cid character varying(255),
    issued_by uuid NOT NULL,
    issued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_hash character varying(64),
    composite_hash character varying(64),
    blockchain_tx_id character varying(255),
    application_status character varying(20) DEFAULT 'PENDING'::character varying,
    document_id uuid,
    verified_at timestamp without time zone,
    verified_by uuid,
    revocation_reason text,
    revoked_at timestamp without time zone,
    CONSTRAINT certificates_application_status_check CHECK (((application_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT certificates_certificate_type_check CHECK (((certificate_type)::text = ANY ((ARRAY['hpg_clearance'::character varying, 'insurance'::character varying, 'emission'::character varying, 'csr'::character varying, 'sales_invoice'::character varying])::text[]))),
    CONSTRAINT certificates_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'EXPIRED'::character varying, 'REVOKED'::character varying, 'ISSUED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.certificates OWNER TO lto_user;

--
-- TOC entry 3974 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE certificates; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.certificates IS 'Stores certificates issued by external organizations';


--
-- TOC entry 3975 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.certificate_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.certificate_type IS 'Type of certificate: hpg_clearance, insurance, or emission';


--
-- TOC entry 3976 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.ipfs_cid; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.ipfs_cid IS 'IPFS Content ID if certificate is stored on IPFS';


--
-- TOC entry 3977 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.file_hash; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.file_hash IS 'SHA-256 hash of the certificate PDF file';


--
-- TOC entry 3978 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.composite_hash; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.composite_hash IS 'Composite hash (certNumber+VIN+expiry+fileHash) for unique verification';


--
-- TOC entry 3979 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.blockchain_tx_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.blockchain_tx_id IS 'Hyperledger Fabric transaction ID where hash is stored';


--
-- TOC entry 3980 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.application_status; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.application_status IS 'Status linked to vehicle application: PENDING, APPROVED, REJECTED';


--
-- TOC entry 3981 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN certificates.document_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.certificates.document_id IS 'Reference to documents table for the certificate PDF';


--
-- TOC entry 229 (class 1259 OID 16774)
-- Name: clearance_requests; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.clearance_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    request_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    requested_by uuid NOT NULL,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_to uuid,
    completed_at timestamp without time zone,
    certificate_id uuid,
    purpose character varying(255),
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT clearance_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['hpg'::character varying, 'insurance'::character varying, 'emission'::character varying])::text[]))),
    CONSTRAINT clearance_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SENT'::character varying, 'IN_PROGRESS'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'COMPLETED'::character varying])::text[])))
);


ALTER TABLE public.clearance_requests OWNER TO lto_user;

--
-- TOC entry 3982 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE clearance_requests; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.clearance_requests IS 'Tracks clearance requests sent to external organizations (HPG, Insurance, Emission)';


--
-- TOC entry 3983 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN clearance_requests.request_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.clearance_requests.request_type IS 'Type of clearance: hpg, insurance, or emission';


--
-- TOC entry 3984 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN clearance_requests.status; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.clearance_requests.status IS 'Status of the clearance request';


--
-- TOC entry 3985 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN clearance_requests.completed_at; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.clearance_requests.completed_at IS 'Timestamp when the clearance request was completed, approved, or rejected';


--
-- TOC entry 3986 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN clearance_requests.metadata; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.clearance_requests.metadata IS 'Additional data like engine number, chassis number, inspection photos, etc.';


--
-- TOC entry 240 (class 1259 OID 17238)
-- Name: cr_number_seq; Type: SEQUENCE; Schema: public; Owner: lto_user
--

CREATE SEQUENCE public.cr_number_seq
    START WITH 7
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cr_number_seq OWNER TO lto_user;

--
-- TOC entry 219 (class 1259 OID 16595)
-- Name: documents; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid,
    document_type public.document_type NOT NULL,
    filename character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_hash character varying(64) NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verified boolean DEFAULT false,
    verified_at timestamp without time zone,
    verified_by uuid,
    ipfs_cid character varying(255),
    is_inspection_document boolean DEFAULT false,
    inspection_document_type character varying(50)
);


ALTER TABLE public.documents OWNER TO lto_user;

--
-- TOC entry 3987 (class 0 OID 0)
-- Dependencies: 219
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.documents IS 'Document metadata for local file storage';


--
-- TOC entry 228 (class 1259 OID 16751)
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    token_secret character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    used_at timestamp without time zone,
    used_by_ip inet
);


ALTER TABLE public.email_verification_tokens OWNER TO lto_user;

--
-- TOC entry 238 (class 1259 OID 17120)
-- Name: expiry_notifications; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.expiry_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid,
    user_id uuid,
    notification_type character varying(50) NOT NULL,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email_sent boolean DEFAULT false,
    sms_sent boolean DEFAULT false
);


ALTER TABLE public.expiry_notifications OWNER TO lto_user;

--
-- TOC entry 242 (class 1259 OID 17267)
-- Name: mvir_number_seq; Type: SEQUENCE; Schema: public; Owner: lto_user
--

CREATE SEQUENCE public.mvir_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mvir_number_seq OWNER TO lto_user;

--
-- TOC entry 221 (class 1259 OID 16646)
-- Name: notifications; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying,
    read boolean DEFAULT false,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone
);


ALTER TABLE public.notifications OWNER TO lto_user;

--
-- TOC entry 3988 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.notifications IS 'User notifications and alerts';


--
-- TOC entry 239 (class 1259 OID 17237)
-- Name: or_number_seq; Type: SEQUENCE; Schema: public; Owner: lto_user
--

CREATE SEQUENCE public.or_number_seq
    START WITH 7
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.or_number_seq OWNER TO lto_user;

--
-- TOC entry 225 (class 1259 OID 16697)
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.refresh_tokens OWNER TO lto_user;

--
-- TOC entry 241 (class 1259 OID 17246)
-- Name: registration_document_requirements; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.registration_document_requirements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    registration_type character varying(50) NOT NULL,
    vehicle_category character varying(50) DEFAULT 'ALL'::character varying,
    document_type character varying(50) NOT NULL,
    is_required boolean DEFAULT true,
    display_name character varying(100) NOT NULL,
    description text,
    accepted_formats character varying(100) DEFAULT 'pdf,jpg,jpeg,png'::character varying,
    max_file_size_mb integer DEFAULT 10,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.registration_document_requirements OWNER TO lto_user;

--
-- TOC entry 226 (class 1259 OID 16711)
-- Name: sessions; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO lto_user;

--
-- TOC entry 222 (class 1259 OID 16665)
-- Name: system_settings; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.system_settings (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


ALTER TABLE public.system_settings OWNER TO lto_user;

--
-- TOC entry 3989 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.system_settings IS 'System configuration settings';


--
-- TOC entry 227 (class 1259 OID 16738)
-- Name: token_blacklist; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.token_blacklist (
    token_jti character varying(255) NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reason character varying(50) DEFAULT 'logout'::character varying
);


ALTER TABLE public.token_blacklist OWNER TO lto_user;

--
-- TOC entry 232 (class 1259 OID 16906)
-- Name: transfer_documents; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.transfer_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    transfer_request_id uuid NOT NULL,
    document_type character varying(30) NOT NULL,
    document_id uuid,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    CONSTRAINT check_transfer_document_type CHECK (((document_type)::text = ANY ((ARRAY['deed_of_sale'::character varying, 'seller_id'::character varying, 'buyer_id'::character varying, 'or_cr'::character varying, 'emission_cert'::character varying, 'insurance_cert'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT transfer_documents_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['deed_of_sale'::character varying, 'seller_id'::character varying, 'buyer_id'::character varying, 'or_cr'::character varying, 'emission_cert'::character varying, 'insurance_cert'::character varying, 'other'::character varying, 'buyer_tin'::character varying, 'buyer_ctpl'::character varying, 'buyer_mvir'::character varying, 'buyer_hpg_clearance'::character varying, 'transfer_package_pdf'::character varying, 'transfer_certificate'::character varying])::text[])))
);


ALTER TABLE public.transfer_documents OWNER TO lto_user;

--
-- TOC entry 3990 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE transfer_documents; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_documents IS 'Links documents to transfer requests (Deed of Sale, IDs, OR/CR)';


--
-- TOC entry 231 (class 1259 OID 16860)
-- Name: transfer_requests; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.transfer_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    buyer_id uuid,
    buyer_info jsonb,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    rejection_reason text,
    forwarded_to_hpg boolean DEFAULT false,
    hpg_clearance_request_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    insurance_clearance_request_id uuid,
    emission_clearance_request_id uuid,
    insurance_approval_status character varying(20) DEFAULT 'PENDING'::character varying,
    emission_approval_status character varying(20) DEFAULT 'PENDING'::character varying,
    hpg_approval_status character varying(20) DEFAULT 'PENDING'::character varying,
    insurance_approved_at timestamp without time zone,
    emission_approved_at timestamp without time zone,
    hpg_approved_at timestamp without time zone,
    insurance_approved_by uuid,
    emission_approved_by uuid,
    hpg_approved_by uuid,
    expires_at timestamp without time zone,
    buyer_submitted_at timestamp without time zone,
    remarks text,
    CONSTRAINT transfer_requests_emission_approval_status_check CHECK (((emission_approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT transfer_requests_hpg_approval_status_check CHECK (((hpg_approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT transfer_requests_insurance_approval_status_check CHECK (((insurance_approval_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT transfer_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'AWAITING_BUYER_DOCS'::character varying, 'UNDER_REVIEW'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying, 'COMPLETED'::character varying, 'FORWARDED_TO_HPG'::character varying])::text[])))
);


ALTER TABLE public.transfer_requests OWNER TO lto_user;

--
-- TOC entry 3991 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE transfer_requests; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_requests IS 'Tracks vehicle ownership transfer requests from sellers to buyers';


--
-- TOC entry 3992 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN transfer_requests.buyer_info; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.transfer_requests.buyer_info IS 'JSONB storing buyer information if buyer is not yet a system user';


--
-- TOC entry 3993 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN transfer_requests.status; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.transfer_requests.status IS 'Status: PENDING, REVIEWING, APPROVED, REJECTED, COMPLETED, FORWARDED_TO_HPG';


--
-- TOC entry 233 (class 1259 OID 16934)
-- Name: transfer_verifications; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.transfer_verifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    transfer_request_id uuid NOT NULL,
    document_id uuid,
    verified_by uuid NOT NULL,
    status character varying(20) NOT NULL,
    notes text,
    checklist jsonb DEFAULT '{}'::jsonb,
    flagged boolean DEFAULT false,
    verified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transfer_verifications_status_check CHECK (((status)::text = ANY ((ARRAY['APPROVED'::character varying, 'REJECTED'::character varying, 'PENDING'::character varying])::text[])))
);


ALTER TABLE public.transfer_verifications OWNER TO lto_user;

--
-- TOC entry 3994 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE transfer_verifications; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_verifications IS 'Stores document verification records for transfer requests';


--
-- TOC entry 3995 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN transfer_verifications.checklist; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.transfer_verifications.checklist IS 'JSONB storing verification checklist items';


--
-- TOC entry 220 (class 1259 OID 16623)
-- Name: vehicle_history; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.vehicle_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid,
    action character varying(50) NOT NULL,
    description text,
    performed_by uuid,
    performed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    transaction_id character varying(100),
    metadata jsonb
);


ALTER TABLE public.vehicle_history OWNER TO lto_user;

--
-- TOC entry 3996 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE vehicle_history; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicle_history IS 'Audit trail for all vehicle-related actions';


--
-- TOC entry 223 (class 1259 OID 16682)
-- Name: vehicle_summary; Type: VIEW; Schema: public; Owner: lto_user
--

CREATE VIEW public.vehicle_summary AS
 SELECT v.id,
    v.vin,
    v.plate_number,
    v.make,
    v.model,
    v.year,
    v.color,
    v.status,
    v.registration_date,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS owner_name,
    u.email AS owner_email,
    count(d.id) AS document_count,
    count(
        CASE
            WHEN (d.verified = true) THEN 1
            ELSE NULL::integer
        END) AS verified_documents
   FROM ((public.vehicles v
     LEFT JOIN public.users u ON ((v.owner_id = u.id)))
     LEFT JOIN public.documents d ON ((v.id = d.vehicle_id)))
  GROUP BY v.id, v.vin, v.plate_number, v.make, v.model, v.year, v.color, v.status, v.registration_date, u.first_name, u.last_name, u.email;


ALTER VIEW public.vehicle_summary OWNER TO lto_user;

--
-- TOC entry 218 (class 1259 OID 16569)
-- Name: vehicle_verifications; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.vehicle_verifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid,
    verification_type character varying(20) NOT NULL,
    status public.verification_status DEFAULT 'PENDING'::public.verification_status,
    verified_by uuid,
    verified_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    clearance_request_id uuid,
    automated boolean DEFAULT false,
    verification_score integer,
    verification_metadata jsonb DEFAULT '{}'::jsonb,
    auto_verified_at timestamp without time zone
);


ALTER TABLE public.vehicle_verifications OWNER TO lto_user;

--
-- TOC entry 3997 (class 0 OID 0)
-- Dependencies: 218
-- Name: TABLE vehicle_verifications; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicle_verifications IS 'Verification status for insurance, emission, and admin approval';


--
-- TOC entry 224 (class 1259 OID 16687)
-- Name: verification_summary; Type: VIEW; Schema: public; Owner: lto_user
--

CREATE VIEW public.verification_summary AS
 SELECT v.id AS vehicle_id,
    v.vin,
    v.plate_number,
    v.status AS vehicle_status,
    max(
        CASE
            WHEN ((vv.verification_type)::text = 'insurance'::text) THEN vv.status
            ELSE NULL::public.verification_status
        END) AS insurance_status,
    max(
        CASE
            WHEN ((vv.verification_type)::text = 'emission'::text) THEN vv.status
            ELSE NULL::public.verification_status
        END) AS emission_status,
    max(
        CASE
            WHEN ((vv.verification_type)::text = 'admin'::text) THEN vv.status
            ELSE NULL::public.verification_status
        END) AS admin_status,
    count(vv.id) AS total_verifications,
    count(
        CASE
            WHEN (vv.status = 'APPROVED'::public.verification_status) THEN 1
            ELSE NULL::integer
        END) AS approved_verifications
   FROM (public.vehicles v
     LEFT JOIN public.vehicle_verifications vv ON ((v.id = vv.vehicle_id)))
  GROUP BY v.id, v.vin, v.plate_number, v.status;


ALTER VIEW public.verification_summary OWNER TO lto_user;

--
-- TOC entry 3720 (class 2606 OID 17065)
-- Name: certificate_submissions certificate_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_pkey PRIMARY KEY (id);


--
-- TOC entry 3649 (class 2606 OID 16825)
-- Name: certificates certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_certificate_number_key UNIQUE (certificate_number);


--
-- TOC entry 3651 (class 2606 OID 16969)
-- Name: certificates certificates_composite_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_composite_hash_key UNIQUE (composite_hash);


--
-- TOC entry 3653 (class 2606 OID 16823)
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- TOC entry 3641 (class 2606 OID 16788)
-- Name: clearance_requests clearance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3594 (class 2606 OID 16604)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 3633 (class 2606 OID 16759)
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3635 (class 2606 OID 16761)
-- Name: email_verification_tokens email_verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 3732 (class 2606 OID 17128)
-- Name: expiry_notifications expiry_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3689 (class 2606 OID 17018)
-- Name: external_issuers external_issuers_api_key_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.external_issuers
    ADD CONSTRAINT external_issuers_api_key_key UNIQUE (api_key);


--
-- TOC entry 3691 (class 2606 OID 17016)
-- Name: external_issuers external_issuers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.external_issuers
    ADD CONSTRAINT external_issuers_license_number_key UNIQUE (license_number);


--
-- TOC entry 3693 (class 2606 OID 17014)
-- Name: external_issuers external_issuers_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.external_issuers
    ADD CONSTRAINT external_issuers_pkey PRIMARY KEY (id);


--
-- TOC entry 3712 (class 2606 OID 17035)
-- Name: issued_certificates issued_certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_certificate_number_key UNIQUE (certificate_number);


--
-- TOC entry 3714 (class 2606 OID 17039)
-- Name: issued_certificates issued_certificates_composite_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_composite_hash_key UNIQUE (composite_hash);


--
-- TOC entry 3716 (class 2606 OID 17037)
-- Name: issued_certificates issued_certificates_file_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_file_hash_key UNIQUE (file_hash);


--
-- TOC entry 3718 (class 2606 OID 17033)
-- Name: issued_certificates issued_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_pkey PRIMARY KEY (id);


--
-- TOC entry 3613 (class 2606 OID 16656)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3620 (class 2606 OID 16703)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3622 (class 2606 OID 16705)
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 3738 (class 2606 OID 17263)
-- Name: registration_document_requirements registration_document_require_registration_type_vehicle_cat_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.registration_document_requirements
    ADD CONSTRAINT registration_document_require_registration_type_vehicle_cat_key UNIQUE (registration_type, vehicle_category, document_type);


--
-- TOC entry 3740 (class 2606 OID 17261)
-- Name: registration_document_requirements registration_document_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.registration_document_requirements
    ADD CONSTRAINT registration_document_requirements_pkey PRIMARY KEY (id);


--
-- TOC entry 3627 (class 2606 OID 16720)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 3615 (class 2606 OID 16672)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- TOC entry 3631 (class 2606 OID 16746)
-- Name: token_blacklist token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_pkey PRIMARY KEY (token_jti);


--
-- TOC entry 3681 (class 2606 OID 16915)
-- Name: transfer_documents transfer_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 3676 (class 2606 OID 16874)
-- Name: transfer_requests transfer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3687 (class 2606 OID 16945)
-- Name: transfer_verifications transfer_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3557 (class 2606 OID 16536)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3559 (class 2606 OID 16534)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3607 (class 2606 OID 16631)
-- Name: vehicle_history vehicle_history_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_pkey PRIMARY KEY (id);


--
-- TOC entry 3590 (class 2606 OID 16579)
-- Name: vehicle_verifications vehicle_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3592 (class 2606 OID 16581)
-- Name: vehicle_verifications vehicle_verifications_vehicle_id_verification_type_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_vehicle_id_verification_type_key UNIQUE (vehicle_id, verification_type);


--
-- TOC entry 3575 (class 2606 OID 17242)
-- Name: vehicles vehicles_cr_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_cr_number_key UNIQUE (cr_number);


--
-- TOC entry 3577 (class 2606 OID 17269)
-- Name: vehicles vehicles_mvir_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_mvir_number_key UNIQUE (mvir_number);


--
-- TOC entry 3579 (class 2606 OID 17240)
-- Name: vehicles vehicles_or_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_or_number_key UNIQUE (or_number);


--
-- TOC entry 3581 (class 2606 OID 16554)
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 3721 (class 1259 OID 17090)
-- Name: idx_cert_submissions_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_cert_submissions_file_hash ON public.certificate_submissions USING btree (uploaded_file_hash);


--
-- TOC entry 3722 (class 1259 OID 17091)
-- Name: idx_cert_submissions_matched_cert; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_cert_submissions_matched_cert ON public.certificate_submissions USING btree (matched_certificate_id);


--
-- TOC entry 3723 (class 1259 OID 17088)
-- Name: idx_cert_submissions_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_cert_submissions_status ON public.certificate_submissions USING btree (verification_status);


--
-- TOC entry 3724 (class 1259 OID 17089)
-- Name: idx_cert_submissions_submitted_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_cert_submissions_submitted_by ON public.certificate_submissions USING btree (submitted_by);


--
-- TOC entry 3725 (class 1259 OID 17087)
-- Name: idx_cert_submissions_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_cert_submissions_type ON public.certificate_submissions USING btree (certificate_type);


--
-- TOC entry 3726 (class 1259 OID 17086)
-- Name: idx_cert_submissions_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_cert_submissions_vehicle ON public.certificate_submissions USING btree (vehicle_id);


--
-- TOC entry 3727 (class 1259 OID 17111)
-- Name: idx_certificate_submissions_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_file_hash ON public.certificate_submissions USING btree (uploaded_file_hash);


--
-- TOC entry 3728 (class 1259 OID 17110)
-- Name: idx_certificate_submissions_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_status ON public.certificate_submissions USING btree (verification_status);


--
-- TOC entry 3729 (class 1259 OID 17109)
-- Name: idx_certificate_submissions_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_type ON public.certificate_submissions USING btree (certificate_type);


--
-- TOC entry 3730 (class 1259 OID 17108)
-- Name: idx_certificate_submissions_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_vehicle ON public.certificate_submissions USING btree (vehicle_id);


--
-- TOC entry 3654 (class 1259 OID 16985)
-- Name: idx_certificates_application_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_application_status ON public.certificates USING btree (application_status);


--
-- TOC entry 3655 (class 1259 OID 16984)
-- Name: idx_certificates_blockchain_tx_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_blockchain_tx_id ON public.certificates USING btree (blockchain_tx_id);


--
-- TOC entry 3656 (class 1259 OID 16983)
-- Name: idx_certificates_composite_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_composite_hash ON public.certificates USING btree (composite_hash);


--
-- TOC entry 3657 (class 1259 OID 16986)
-- Name: idx_certificates_document_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_document_id ON public.certificates USING btree (document_id);


--
-- TOC entry 3658 (class 1259 OID 16982)
-- Name: idx_certificates_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_file_hash ON public.certificates USING btree (file_hash);


--
-- TOC entry 3659 (class 1259 OID 16846)
-- Name: idx_certificates_issued_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_issued_by ON public.certificates USING btree (issued_by);


--
-- TOC entry 3660 (class 1259 OID 16844)
-- Name: idx_certificates_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_number ON public.certificates USING btree (certificate_number);


--
-- TOC entry 3661 (class 1259 OID 16841)
-- Name: idx_certificates_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_request ON public.certificates USING btree (clearance_request_id);


--
-- TOC entry 3662 (class 1259 OID 16845)
-- Name: idx_certificates_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_status ON public.certificates USING btree (status);


--
-- TOC entry 3663 (class 1259 OID 16843)
-- Name: idx_certificates_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_type ON public.certificates USING btree (certificate_type);


--
-- TOC entry 3664 (class 1259 OID 16842)
-- Name: idx_certificates_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_vehicle ON public.certificates USING btree (vehicle_id);


--
-- TOC entry 3665 (class 1259 OID 16987)
-- Name: idx_certificates_verified_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_verified_by ON public.certificates USING btree (verified_by);


--
-- TOC entry 3642 (class 1259 OID 16807)
-- Name: idx_clearance_assigned; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_assigned ON public.clearance_requests USING btree (assigned_to);


--
-- TOC entry 3643 (class 1259 OID 16809)
-- Name: idx_clearance_created_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_created_at ON public.clearance_requests USING btree (created_at);


--
-- TOC entry 3644 (class 1259 OID 16808)
-- Name: idx_clearance_requested_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_requested_by ON public.clearance_requests USING btree (requested_by);


--
-- TOC entry 3645 (class 1259 OID 16806)
-- Name: idx_clearance_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_status ON public.clearance_requests USING btree (status);


--
-- TOC entry 3646 (class 1259 OID 16805)
-- Name: idx_clearance_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_type ON public.clearance_requests USING btree (request_type);


--
-- TOC entry 3647 (class 1259 OID 16804)
-- Name: idx_clearance_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_vehicle ON public.clearance_requests USING btree (vehicle_id);


--
-- TOC entry 3736 (class 1259 OID 17264)
-- Name: idx_doc_requirements_type_category; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_doc_requirements_type_category ON public.registration_document_requirements USING btree (registration_type, vehicle_category, is_active);


--
-- TOC entry 3595 (class 1259 OID 16622)
-- Name: idx_documents_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_hash ON public.documents USING btree (file_hash);


--
-- TOC entry 3596 (class 1259 OID 17274)
-- Name: idx_documents_inspection; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_inspection ON public.documents USING btree (is_inspection_document);


--
-- TOC entry 3597 (class 1259 OID 17275)
-- Name: idx_documents_inspection_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_inspection_type ON public.documents USING btree (inspection_document_type);


--
-- TOC entry 3598 (class 1259 OID 17112)
-- Name: idx_documents_ipfs_cid; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_ipfs_cid ON public.documents USING btree (ipfs_cid);


--
-- TOC entry 3599 (class 1259 OID 16621)
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);


--
-- TOC entry 3600 (class 1259 OID 16694)
-- Name: idx_documents_unverified; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_unverified ON public.documents USING btree (id) WHERE (verified = false);


--
-- TOC entry 3601 (class 1259 OID 16620)
-- Name: idx_documents_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_vehicle ON public.documents USING btree (vehicle_id);


--
-- TOC entry 3636 (class 1259 OID 16769)
-- Name: idx_email_verification_tokens_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_expires_at ON public.email_verification_tokens USING btree (expires_at);


--
-- TOC entry 3637 (class 1259 OID 16768)
-- Name: idx_email_verification_tokens_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_hash ON public.email_verification_tokens USING btree (token_hash);


--
-- TOC entry 3638 (class 1259 OID 16770)
-- Name: idx_email_verification_tokens_used_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_used_at ON public.email_verification_tokens USING btree (used_at);


--
-- TOC entry 3639 (class 1259 OID 16767)
-- Name: idx_email_verification_tokens_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens USING btree (user_id);


--
-- TOC entry 3733 (class 1259 OID 17141)
-- Name: idx_expiry_notifications_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_expiry_notifications_type ON public.expiry_notifications USING btree (notification_type);


--
-- TOC entry 3734 (class 1259 OID 17140)
-- Name: idx_expiry_notifications_user; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_expiry_notifications_user ON public.expiry_notifications USING btree (user_id);


--
-- TOC entry 3735 (class 1259 OID 17139)
-- Name: idx_expiry_notifications_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_expiry_notifications_vehicle ON public.expiry_notifications USING btree (vehicle_id);


--
-- TOC entry 3694 (class 1259 OID 17020)
-- Name: idx_external_issuers_active; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_external_issuers_active ON public.external_issuers USING btree (is_active);


--
-- TOC entry 3695 (class 1259 OID 17021)
-- Name: idx_external_issuers_license; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_external_issuers_license ON public.external_issuers USING btree (license_number);


--
-- TOC entry 3696 (class 1259 OID 17019)
-- Name: idx_external_issuers_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_external_issuers_type ON public.external_issuers USING btree (issuer_type);


--
-- TOC entry 3602 (class 1259 OID 16643)
-- Name: idx_history_action; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_action ON public.vehicle_history USING btree (action);


--
-- TOC entry 3603 (class 1259 OID 16645)
-- Name: idx_history_performed_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_performed_at ON public.vehicle_history USING btree (performed_at);


--
-- TOC entry 3604 (class 1259 OID 16644)
-- Name: idx_history_performed_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_performed_by ON public.vehicle_history USING btree (performed_by);


--
-- TOC entry 3605 (class 1259 OID 16642)
-- Name: idx_history_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_vehicle ON public.vehicle_history USING btree (vehicle_id);


--
-- TOC entry 3697 (class 1259 OID 17106)
-- Name: idx_issued_certificates_composite_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_composite_hash ON public.issued_certificates USING btree (composite_hash);


--
-- TOC entry 3698 (class 1259 OID 17105)
-- Name: idx_issued_certificates_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_file_hash ON public.issued_certificates USING btree (file_hash);


--
-- TOC entry 3699 (class 1259 OID 17102)
-- Name: idx_issued_certificates_issuer; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_issuer ON public.issued_certificates USING btree (issuer_id);


--
-- TOC entry 3700 (class 1259 OID 17107)
-- Name: idx_issued_certificates_revoked; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_revoked ON public.issued_certificates USING btree (is_revoked);


--
-- TOC entry 3701 (class 1259 OID 17155)
-- Name: idx_issued_certificates_sales_invoice; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_sales_invoice ON public.issued_certificates USING btree (certificate_type, vehicle_vin) WHERE ((certificate_type)::text = 'sales_invoice'::text);


--
-- TOC entry 3702 (class 1259 OID 17103)
-- Name: idx_issued_certificates_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_type ON public.issued_certificates USING btree (certificate_type);


--
-- TOC entry 3703 (class 1259 OID 17104)
-- Name: idx_issued_certificates_vin; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_vin ON public.issued_certificates USING btree (vehicle_vin);


--
-- TOC entry 3704 (class 1259 OID 17050)
-- Name: idx_issued_certs_composite_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_composite_hash ON public.issued_certificates USING btree (composite_hash);


--
-- TOC entry 3705 (class 1259 OID 17049)
-- Name: idx_issued_certs_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_file_hash ON public.issued_certificates USING btree (file_hash);


--
-- TOC entry 3706 (class 1259 OID 17045)
-- Name: idx_issued_certs_issuer; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_issuer ON public.issued_certificates USING btree (issuer_id);


--
-- TOC entry 3707 (class 1259 OID 17048)
-- Name: idx_issued_certs_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_number ON public.issued_certificates USING btree (certificate_number);


--
-- TOC entry 3708 (class 1259 OID 17051)
-- Name: idx_issued_certs_revoked; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_revoked ON public.issued_certificates USING btree (is_revoked);


--
-- TOC entry 3709 (class 1259 OID 17046)
-- Name: idx_issued_certs_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_type ON public.issued_certificates USING btree (certificate_type);


--
-- TOC entry 3710 (class 1259 OID 17047)
-- Name: idx_issued_certs_vin; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certs_vin ON public.issued_certificates USING btree (vehicle_vin);


--
-- TOC entry 3608 (class 1259 OID 16663)
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- TOC entry 3609 (class 1259 OID 16664)
-- Name: idx_notifications_sent_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_sent_at ON public.notifications USING btree (sent_at);


--
-- TOC entry 3610 (class 1259 OID 16693)
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (id) WHERE (read = false);


--
-- TOC entry 3611 (class 1259 OID 16662)
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- TOC entry 3616 (class 1259 OID 16733)
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- TOC entry 3617 (class 1259 OID 16732)
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- TOC entry 3618 (class 1259 OID 16731)
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- TOC entry 3623 (class 1259 OID 16736)
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- TOC entry 3624 (class 1259 OID 16735)
-- Name: idx_sessions_refresh_token_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_sessions_refresh_token_id ON public.sessions USING btree (refresh_token_id);


--
-- TOC entry 3625 (class 1259 OID 16734)
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- TOC entry 3628 (class 1259 OID 16747)
-- Name: idx_token_blacklist_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_token_blacklist_expires_at ON public.token_blacklist USING btree (expires_at);


--
-- TOC entry 3629 (class 1259 OID 16748)
-- Name: idx_token_blacklist_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_token_blacklist_hash ON public.token_blacklist USING btree (token_hash);


--
-- TOC entry 3666 (class 1259 OID 16902)
-- Name: idx_transfer_buyer; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_buyer ON public.transfer_requests USING btree (buyer_id);


--
-- TOC entry 3677 (class 1259 OID 16933)
-- Name: idx_transfer_docs_document; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_docs_document ON public.transfer_documents USING btree (document_id);


--
-- TOC entry 3678 (class 1259 OID 16931)
-- Name: idx_transfer_docs_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_docs_request ON public.transfer_documents USING btree (transfer_request_id);


--
-- TOC entry 3679 (class 1259 OID 16932)
-- Name: idx_transfer_docs_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_docs_type ON public.transfer_documents USING btree (document_type);


--
-- TOC entry 3667 (class 1259 OID 17191)
-- Name: idx_transfer_emission_approval; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_emission_approval ON public.transfer_requests USING btree (emission_approval_status);


--
-- TOC entry 3668 (class 1259 OID 17192)
-- Name: idx_transfer_hpg_approval; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_hpg_approval ON public.transfer_requests USING btree (hpg_approval_status);


--
-- TOC entry 3669 (class 1259 OID 17190)
-- Name: idx_transfer_insurance_approval; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_insurance_approval ON public.transfer_requests USING btree (insurance_approval_status);


--
-- TOC entry 3670 (class 1259 OID 16905)
-- Name: idx_transfer_reviewed_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_reviewed_by ON public.transfer_requests USING btree (reviewed_by);


--
-- TOC entry 3671 (class 1259 OID 16901)
-- Name: idx_transfer_seller; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_seller ON public.transfer_requests USING btree (seller_id);


--
-- TOC entry 3672 (class 1259 OID 16903)
-- Name: idx_transfer_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_status ON public.transfer_requests USING btree (status);


--
-- TOC entry 3673 (class 1259 OID 16904)
-- Name: idx_transfer_submitted_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_submitted_at ON public.transfer_requests USING btree (submitted_at);


--
-- TOC entry 3674 (class 1259 OID 16900)
-- Name: idx_transfer_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_vehicle ON public.transfer_requests USING btree (vehicle_id);


--
-- TOC entry 3682 (class 1259 OID 16962)
-- Name: idx_transfer_verif_document; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_document ON public.transfer_verifications USING btree (document_id);


--
-- TOC entry 3683 (class 1259 OID 16961)
-- Name: idx_transfer_verif_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_request ON public.transfer_verifications USING btree (transfer_request_id);


--
-- TOC entry 3684 (class 1259 OID 16963)
-- Name: idx_transfer_verif_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_status ON public.transfer_verifications USING btree (status);


--
-- TOC entry 3685 (class 1259 OID 16964)
-- Name: idx_transfer_verif_verified_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_verified_by ON public.transfer_verifications USING btree (verified_by);


--
-- TOC entry 3553 (class 1259 OID 16539)
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active);


--
-- TOC entry 3554 (class 1259 OID 16537)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3555 (class 1259 OID 16538)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 3560 (class 1259 OID 16692)
-- Name: idx_vehicles_active; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_active ON public.vehicles USING btree (id) WHERE (status = ANY (ARRAY['SUBMITTED'::public.vehicle_status, 'REGISTERED'::public.vehicle_status]));


--
-- TOC entry 3561 (class 1259 OID 17244)
-- Name: idx_vehicles_cr_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_cr_number ON public.vehicles USING btree (cr_number);


--
-- TOC entry 3562 (class 1259 OID 17245)
-- Name: idx_vehicles_date_of_registration; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_date_of_registration ON public.vehicles USING btree (date_of_registration);


--
-- TOC entry 3563 (class 1259 OID 17271)
-- Name: idx_vehicles_inspection_date; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_inspection_date ON public.vehicles USING btree (inspection_date);


--
-- TOC entry 3564 (class 1259 OID 17272)
-- Name: idx_vehicles_inspection_result; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_inspection_result ON public.vehicles USING btree (inspection_result);


--
-- TOC entry 3565 (class 1259 OID 17116)
-- Name: idx_vehicles_insurance_expiry; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_insurance_expiry ON public.vehicles USING btree (insurance_expiry_date);


--
-- TOC entry 3566 (class 1259 OID 16568)
-- Name: idx_vehicles_make_model; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_make_model ON public.vehicles USING btree (make, model);


--
-- TOC entry 3567 (class 1259 OID 17270)
-- Name: idx_vehicles_mvir; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_mvir ON public.vehicles USING btree (mvir_number);


--
-- TOC entry 3568 (class 1259 OID 17243)
-- Name: idx_vehicles_or_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_or_number ON public.vehicles USING btree (or_number);


--
-- TOC entry 3569 (class 1259 OID 16566)
-- Name: idx_vehicles_owner; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_owner ON public.vehicles USING btree (owner_id);


--
-- TOC entry 3570 (class 1259 OID 16565)
-- Name: idx_vehicles_plate; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_plate ON public.vehicles USING btree (plate_number);


--
-- TOC entry 3571 (class 1259 OID 17115)
-- Name: idx_vehicles_registration_expiry; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_registration_expiry ON public.vehicles USING btree (registration_expiry_date);


--
-- TOC entry 3572 (class 1259 OID 16567)
-- Name: idx_vehicles_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status);


--
-- TOC entry 3573 (class 1259 OID 16564)
-- Name: idx_vehicles_vin; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_vin ON public.vehicles USING btree (vin);


--
-- TOC entry 3584 (class 1259 OID 17158)
-- Name: idx_verifications_automated; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_automated ON public.vehicle_verifications USING btree (automated, status);


--
-- TOC entry 3585 (class 1259 OID 16857)
-- Name: idx_verifications_clearance_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_clearance_request ON public.vehicle_verifications USING btree (clearance_request_id);


--
-- TOC entry 3586 (class 1259 OID 16594)
-- Name: idx_verifications_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_status ON public.vehicle_verifications USING btree (status);


--
-- TOC entry 3587 (class 1259 OID 16593)
-- Name: idx_verifications_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_type ON public.vehicle_verifications USING btree (verification_type);


--
-- TOC entry 3588 (class 1259 OID 16592)
-- Name: idx_verifications_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_vehicle ON public.vehicle_verifications USING btree (vehicle_id);


--
-- TOC entry 3582 (class 1259 OID 17203)
-- Name: vehicles_plate_active_unique; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE UNIQUE INDEX vehicles_plate_active_unique ON public.vehicles USING btree (plate_number) WHERE ((plate_number IS NOT NULL) AND (status = ANY (ARRAY['SUBMITTED'::public.vehicle_status, 'PENDING_BLOCKCHAIN'::public.vehicle_status, 'REGISTERED'::public.vehicle_status, 'APPROVED'::public.vehicle_status])));


--
-- TOC entry 3583 (class 1259 OID 17202)
-- Name: vehicles_vin_active_unique; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE UNIQUE INDEX vehicles_vin_active_unique ON public.vehicles USING btree (vin) WHERE (status = ANY (ARRAY['SUBMITTED'::public.vehicle_status, 'PENDING_BLOCKCHAIN'::public.vehicle_status, 'REGISTERED'::public.vehicle_status, 'APPROVED'::public.vehicle_status]));


--
-- TOC entry 3792 (class 2620 OID 16773)
-- Name: email_verification_tokens trigger_cleanup_verification_tokens; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_cleanup_verification_tokens AFTER INSERT ON public.email_verification_tokens FOR EACH ROW EXECUTE FUNCTION public.auto_cleanup_old_tokens();


--
-- TOC entry 3789 (class 2620 OID 17101)
-- Name: vehicles trigger_update_certificate_application_status; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_certificate_application_status AFTER UPDATE OF status ON public.vehicles FOR EACH ROW WHEN ((new.status IS DISTINCT FROM old.status)) EXECUTE FUNCTION public.update_certificate_application_status();


--
-- TOC entry 3793 (class 2620 OID 16859)
-- Name: clearance_requests trigger_update_clearance_requests_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_clearance_requests_updated_at BEFORE UPDATE ON public.clearance_requests FOR EACH ROW EXECUTE FUNCTION public.update_clearance_requests_updated_at();


--
-- TOC entry 3796 (class 2620 OID 17266)
-- Name: registration_document_requirements trigger_update_document_requirements_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_document_requirements_updated_at BEFORE UPDATE ON public.registration_document_requirements FOR EACH ROW EXECUTE FUNCTION public.update_document_requirements_updated_at();


--
-- TOC entry 3794 (class 2620 OID 16999)
-- Name: transfer_requests trigger_update_transfer_requests_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_transfer_requests_updated_at BEFORE UPDATE ON public.transfer_requests FOR EACH ROW EXECUTE FUNCTION public.update_transfer_requests_updated_at();


--
-- TOC entry 3795 (class 2620 OID 17098)
-- Name: certificate_submissions trigger_verify_certificate; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_verify_certificate AFTER INSERT ON public.certificate_submissions FOR EACH ROW EXECUTE FUNCTION public.verify_certificate_submission();


--
-- TOC entry 3788 (class 2620 OID 16679)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3790 (class 2620 OID 16680)
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3791 (class 2620 OID 16681)
-- Name: vehicle_verifications update_verifications_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON public.vehicle_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3782 (class 2606 OID 17081)
-- Name: certificate_submissions certificate_submissions_matched_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_matched_certificate_id_fkey FOREIGN KEY (matched_certificate_id) REFERENCES public.issued_certificates(id) ON DELETE SET NULL;


--
-- TOC entry 3783 (class 2606 OID 17071)
-- Name: certificate_submissions certificate_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3784 (class 2606 OID 17066)
-- Name: certificate_submissions certificate_submissions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3785 (class 2606 OID 17076)
-- Name: certificate_submissions certificate_submissions_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3760 (class 2606 OID 16826)
-- Name: certificates certificates_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_clearance_request_id_fkey FOREIGN KEY (clearance_request_id) REFERENCES public.clearance_requests(id) ON DELETE SET NULL;


--
-- TOC entry 3761 (class 2606 OID 16971)
-- Name: certificates certificates_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3762 (class 2606 OID 16836)
-- Name: certificates certificates_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- TOC entry 3763 (class 2606 OID 16831)
-- Name: certificates certificates_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3764 (class 2606 OID 16976)
-- Name: certificates certificates_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3756 (class 2606 OID 16799)
-- Name: clearance_requests clearance_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 3757 (class 2606 OID 16794)
-- Name: clearance_requests clearance_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- TOC entry 3758 (class 2606 OID 16789)
-- Name: clearance_requests clearance_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3745 (class 2606 OID 16610)
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3746 (class 2606 OID 16605)
-- Name: documents documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3747 (class 2606 OID 16615)
-- Name: documents documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3755 (class 2606 OID 16762)
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3786 (class 2606 OID 17134)
-- Name: expiry_notifications expiry_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3787 (class 2606 OID 17129)
-- Name: expiry_notifications expiry_notifications_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3759 (class 2606 OID 16847)
-- Name: clearance_requests fk_clearance_certificate; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT fk_clearance_certificate FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE SET NULL;


--
-- TOC entry 3781 (class 2606 OID 17040)
-- Name: issued_certificates issued_certificates_issuer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_issuer_id_fkey FOREIGN KEY (issuer_id) REFERENCES public.external_issuers(id) ON DELETE CASCADE;


--
-- TOC entry 3750 (class 2606 OID 16657)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3752 (class 2606 OID 16706)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3753 (class 2606 OID 16726)
-- Name: sessions sessions_refresh_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_id_fkey FOREIGN KEY (refresh_token_id) REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;


--
-- TOC entry 3754 (class 2606 OID 16721)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3751 (class 2606 OID 16673)
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 3775 (class 2606 OID 16921)
-- Name: transfer_documents transfer_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3776 (class 2606 OID 16916)
-- Name: transfer_documents transfer_documents_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3777 (class 2606 OID 16926)
-- Name: transfer_documents transfer_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3765 (class 2606 OID 16885)
-- Name: transfer_requests transfer_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- TOC entry 3766 (class 2606 OID 17180)
-- Name: transfer_requests transfer_requests_emission_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_emission_approved_by_fkey FOREIGN KEY (emission_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3767 (class 2606 OID 17164)
-- Name: transfer_requests transfer_requests_emission_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_emission_clearance_request_id_fkey FOREIGN KEY (emission_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3768 (class 2606 OID 17185)
-- Name: transfer_requests transfer_requests_hpg_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_hpg_approved_by_fkey FOREIGN KEY (hpg_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3769 (class 2606 OID 16895)
-- Name: transfer_requests transfer_requests_hpg_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_hpg_clearance_request_id_fkey FOREIGN KEY (hpg_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3770 (class 2606 OID 17175)
-- Name: transfer_requests transfer_requests_insurance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_insurance_approved_by_fkey FOREIGN KEY (insurance_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3771 (class 2606 OID 17159)
-- Name: transfer_requests transfer_requests_insurance_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_insurance_clearance_request_id_fkey FOREIGN KEY (insurance_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3772 (class 2606 OID 16890)
-- Name: transfer_requests transfer_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 3773 (class 2606 OID 16880)
-- Name: transfer_requests transfer_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- TOC entry 3774 (class 2606 OID 16875)
-- Name: transfer_requests transfer_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3778 (class 2606 OID 16951)
-- Name: transfer_verifications transfer_verifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3779 (class 2606 OID 16946)
-- Name: transfer_verifications transfer_verifications_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3780 (class 2606 OID 16956)
-- Name: transfer_verifications transfer_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3748 (class 2606 OID 16637)
-- Name: vehicle_history vehicle_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- TOC entry 3749 (class 2606 OID 16632)
-- Name: vehicle_history vehicle_history_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3742 (class 2606 OID 16852)
-- Name: vehicle_verifications vehicle_verifications_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_clearance_request_id_fkey FOREIGN KEY (clearance_request_id) REFERENCES public.clearance_requests(id) ON DELETE SET NULL;


--
-- TOC entry 3743 (class 2606 OID 16582)
-- Name: vehicle_verifications vehicle_verifications_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3744 (class 2606 OID 16587)
-- Name: vehicle_verifications vehicle_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3741 (class 2606 OID 16559)
-- Name: vehicles vehicles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


-- Completed on 2026-01-21 20:45:47

--
-- PostgreSQL database dump complete
--

\unrestrict ryWu8pw8ytd2GJfIlHAEgG3NB2cTQgm4rAr0Zv1omV1qG9EDIc7ygDdhi3xXtbv

