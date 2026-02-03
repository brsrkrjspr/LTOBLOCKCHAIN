--
-- PostgreSQL database dump
--

\restrict 45G0AIirgjgpMswTdmRPS5FOKgIrIl5TBPt24v8g7p5pAC8scj0a4JEgIJnno5S

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-03 19:44:25

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
-- TOC entry 2 (class 3079 OID 16389)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 3971 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 3 (class 3079 OID 16470)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3972 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 920 (class 1247 OID 16482)
-- Name: document_type; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.document_type AS ENUM (
    'registration_cert',
    'insurance_cert',
    'emission_cert',
    'owner_id',
    'csr',
    'hpg_clearance',
    'sales_invoice',
    'deed_of_sale',
    'seller_id',
    'buyer_id',
    'other',
    'tin_id'
);


ALTER TYPE public.document_type OWNER TO lto_user;

--
-- TOC entry 3973 (class 0 OID 0)
-- Dependencies: 920
-- Name: TYPE document_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TYPE public.document_type IS 'Document type enum: registration_cert, insurance_cert, emission_cert, owner_id, tin_id, csr, hpg_clearance, sales_invoice, deed_of_sale, seller_id, buyer_id';


--
-- TOC entry 923 (class 1247 OID 16508)
-- Name: user_role; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'staff',
    'insurance_verifier',
    'emission_verifier',
    'vehicle_owner',
    'lto_admin',
    'lto_officer',
    'lto_supervisor'
);


ALTER TYPE public.user_role OWNER TO lto_user;

--
-- TOC entry 926 (class 1247 OID 16526)
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.vehicle_status AS ENUM (
    'SUBMITTED',
    'PENDING_BLOCKCHAIN',
    'REGISTERED',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
    'SCRAPPED',
    'FOR_TRANSFER',
    'TRANSFER_IN_PROGRESS',
    'TRANSFER_COMPLETED',
    'PROCESSING'
);


ALTER TYPE public.vehicle_status OWNER TO lto_user;

--
-- TOC entry 3974 (class 0 OID 0)
-- Dependencies: 926
-- Name: TYPE vehicle_status; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TYPE public.vehicle_status IS 'Vehicle status enum: SUBMITTED, PENDING_BLOCKCHAIN, REGISTERED, APPROVED, REJECTED, SUSPENDED, SCRAPPED, FOR_TRANSFER, TRANSFER_IN_PROGRESS, TRANSFER_COMPLETED, PROCESSING';


--
-- TOC entry 929 (class 1247 OID 16550)
-- Name: verification_status; Type: TYPE; Schema: public; Owner: lto_user
--

CREATE TYPE public.verification_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.verification_status OWNER TO lto_user;

--
-- TOC entry 286 (class 1255 OID 16557)
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
-- TOC entry 287 (class 1255 OID 16558)
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
-- TOC entry 288 (class 1255 OID 16559)
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
-- TOC entry 289 (class 1255 OID 16560)
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
-- TOC entry 301 (class 1255 OID 16561)
-- Name: log_officer_vehicle_action(); Type: FUNCTION; Schema: public; Owner: lto_user
--

CREATE FUNCTION public.log_officer_vehicle_action() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    -- Only log if performed_by is set and refers to an LTO officer/admin

    IF NEW.performed_by IS NOT NULL THEN

        INSERT INTO officer_activity_log (

            officer_id,

            activity_type,

            entity_type,

            entity_id,

            action,

            notes,

            metadata

        )

        SELECT 

            NEW.performed_by,

            'registration',

            'vehicle',

            NEW.vehicle_id,

            NEW.action,

            NEW.description,

            jsonb_build_object(

                'transaction_id', NEW.transaction_id,

                'vehicle_history_id', NEW.id

            )

        FROM users

        WHERE id = NEW.performed_by 

        AND role IN ('lto_officer', 'lto_supervisor', 'lto_admin', 'staff', 'admin');

    END IF;

    

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.log_officer_vehicle_action() OWNER TO lto_user;

--
-- TOC entry 3975 (class 0 OID 0)
-- Dependencies: 301
-- Name: FUNCTION log_officer_vehicle_action(); Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON FUNCTION public.log_officer_vehicle_action() IS 'Automatically logs officer activities when vehicle history is created';


--
-- TOC entry 302 (class 1255 OID 16562)
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
-- TOC entry 303 (class 1255 OID 16563)
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
-- TOC entry 304 (class 1255 OID 16564)
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
-- TOC entry 305 (class 1255 OID 16565)
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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 216 (class 1259 OID 16566)
-- Name: certificate_submissions; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.certificate_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    certificate_type character varying(20) NOT NULL,
    uploaded_file_path character varying(500) NOT NULL,
    uploaded_file_hash character varying(64) NOT NULL,
    verification_status character varying(20) DEFAULT 'PENDING'::character varying,
    verification_notes text,
    matched_certificate_id uuid,
    submitted_by uuid,
    verified_by uuid,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT certificate_submissions_certificate_type_check CHECK (((certificate_type)::text = ANY (ARRAY[('insurance'::character varying)::text, ('emission'::character varying)::text, ('hpg_clearance'::character varying)::text, ('csr'::character varying)::text, ('sales_invoice'::character varying)::text]))),
    CONSTRAINT certificate_submissions_verification_status_check CHECK (((verification_status)::text = ANY (ARRAY[('VERIFIED'::character varying)::text, ('REJECTED'::character varying)::text, ('PENDING'::character varying)::text, ('EXPIRED'::character varying)::text])))
);


ALTER TABLE public.certificate_submissions OWNER TO lto_user;

--
-- TOC entry 217 (class 1259 OID 16577)
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
    file_hash character varying(255),
    composite_hash character varying(255),
    blockchain_tx_id character varying(255),
    application_status character varying(50) DEFAULT 'PENDING'::character varying,
    document_id uuid,
    verified_at timestamp without time zone,
    verified_by uuid,
    revocation_reason text,
    revoked_at timestamp without time zone,
    CONSTRAINT certificates_certificate_type_check CHECK (((certificate_type)::text = ANY (ARRAY[('hpg_clearance'::character varying)::text, ('insurance'::character varying)::text, ('emission'::character varying)::text]))),
    CONSTRAINT certificates_status_check CHECK (((status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('EXPIRED'::character varying)::text, ('REVOKED'::character varying)::text])))
);


ALTER TABLE public.certificates OWNER TO lto_user;

--
-- TOC entry 3976 (class 0 OID 0)
-- Dependencies: 217
-- Name: TABLE certificates; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.certificates IS 'Stores issued clearance certificates and their metadata';


--
-- TOC entry 218 (class 1259 OID 16590)
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
    verification_mode character varying(20) DEFAULT 'MANUAL'::character varying,
    CONSTRAINT clearance_requests_request_type_check CHECK (((request_type)::text = ANY (ARRAY[('hpg'::character varying)::text, ('insurance'::character varying)::text, ('emission'::character varying)::text]))),
    CONSTRAINT clearance_requests_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('SENT'::character varying)::text, ('IN_PROGRESS'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text, ('COMPLETED'::character varying)::text]))),
    CONSTRAINT clearance_requests_verification_mode_check CHECK (((verification_mode)::text = ANY (ARRAY[('MANUAL'::character varying)::text, ('AUTOMATIC'::character varying)::text, ('FAST_TRACK'::character varying)::text])))
);


ALTER TABLE public.clearance_requests OWNER TO lto_user;

--
-- TOC entry 3977 (class 0 OID 0)
-- Dependencies: 218
-- Name: TABLE clearance_requests; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.clearance_requests IS 'Tracks external clearances (HPG, Insurance, Emission) used by registration and transfers';


--
-- TOC entry 219 (class 1259 OID 16605)
-- Name: cr_number_seq; Type: SEQUENCE; Schema: public; Owner: lto_user
--

CREATE SEQUENCE public.cr_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cr_number_seq OWNER TO lto_user;

--
-- TOC entry 220 (class 1259 OID 16606)
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
    is_inspection_document boolean DEFAULT false,
    inspection_document_type character varying(50),
    ipfs_cid character varying(255)
);


ALTER TABLE public.documents OWNER TO lto_user;

--
-- TOC entry 3978 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.documents IS 'Document metadata for local file storage';


--
-- TOC entry 221 (class 1259 OID 16615)
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
-- TOC entry 222 (class 1259 OID 16622)
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
-- TOC entry 223 (class 1259 OID 16629)
-- Name: external_issuers; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.external_issuers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    issuer_type character varying(20) NOT NULL,
    company_name character varying(255) NOT NULL,
    license_number character varying(100) NOT NULL,
    api_key character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    contact_email character varying(255),
    contact_phone character varying(20),
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT external_issuers_issuer_type_check CHECK (((issuer_type)::text = ANY (ARRAY[('insurance'::character varying)::text, ('emission'::character varying)::text, ('hpg'::character varying)::text, ('csr'::character varying)::text, ('sales_invoice'::character varying)::text])))
);


ALTER TABLE public.external_issuers OWNER TO lto_user;

--
-- TOC entry 224 (class 1259 OID 16639)
-- Name: issued_certificates; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.issued_certificates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    issuer_id uuid,
    certificate_type character varying(50) NOT NULL,
    certificate_number character varying(100) NOT NULL,
    vehicle_vin character varying(50) NOT NULL,
    owner_name character varying(255),
    owner_id character varying(255),
    file_hash character varying(255) NOT NULL,
    composite_hash character varying(255) NOT NULL,
    issued_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    blockchain_tx_id character varying(255),
    is_revoked boolean DEFAULT false,
    revocation_reason text,
    revoked_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.issued_certificates OWNER TO lto_user;

--
-- TOC entry 225 (class 1259 OID 16649)
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
-- TOC entry 226 (class 1259 OID 16650)
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
-- TOC entry 3979 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.notifications IS 'User notifications and alerts';


--
-- TOC entry 227 (class 1259 OID 16659)
-- Name: officer_activity_log; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.officer_activity_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    officer_id uuid NOT NULL,
    activity_type character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    action character varying(50) NOT NULL,
    duration_seconds integer,
    notes text,
    ip_address inet,
    user_agent text,
    session_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.officer_activity_log OWNER TO lto_user;

--
-- TOC entry 3980 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE officer_activity_log; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.officer_activity_log IS 'Detailed activity log for LTO officers for performance tracking and accountability';


--
-- TOC entry 3981 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.officer_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.officer_id IS 'User ID of the officer performing the action';


--
-- TOC entry 3982 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.activity_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.activity_type IS 'Type of activity (registration, verification, transfer, etc.)';


--
-- TOC entry 3983 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.entity_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.entity_type IS 'Type of entity being acted upon';


--
-- TOC entry 3984 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.entity_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.entity_id IS 'ID of the entity being acted upon';


--
-- TOC entry 3985 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.action; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.action IS 'Specific action performed';


--
-- TOC entry 3986 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.duration_seconds; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.duration_seconds IS 'Time taken to complete the activity';


--
-- TOC entry 3987 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.metadata; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.metadata IS 'Additional context data in JSON format';


--
-- TOC entry 228 (class 1259 OID 16667)
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
    remarks text,
    CONSTRAINT transfer_requests_emission_approval_status_check CHECK (((emission_approval_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text]))),
    CONSTRAINT transfer_requests_hpg_approval_status_check CHECK (((hpg_approval_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text]))),
    CONSTRAINT transfer_requests_insurance_approval_status_check CHECK (((insurance_approval_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text]))),
    CONSTRAINT transfer_requests_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('AWAITING_BUYER_DOCS'::character varying)::text, ('UNDER_REVIEW'::character varying)::text, ('REVIEWING'::character varying)::text, ('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text, ('EXPIRED'::character varying)::text, ('COMPLETED'::character varying)::text, ('FORWARDED_TO_HPG'::character varying)::text])))
);


ALTER TABLE public.transfer_requests OWNER TO lto_user;

--
-- TOC entry 3988 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE transfer_requests; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_requests IS 'Tracks vehicle ownership transfer requests from seller to buyer';


--
-- TOC entry 3989 (class 0 OID 0)
-- Dependencies: 228
-- Name: CONSTRAINT transfer_requests_status_check ON transfer_requests; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON CONSTRAINT transfer_requests_status_check ON public.transfer_requests IS 'Transfer request status values: PENDING, AWAITING_BUYER_DOCS, UNDER_REVIEW, REVIEWING (legacy), APPROVED, REJECTED, EXPIRED, COMPLETED, FORWARDED_TO_HPG';


--
-- TOC entry 229 (class 1259 OID 16686)
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
    employee_id character varying(20),
    badge_number character varying(20),
    department character varying(100),
    branch_office character varying(100),
    supervisor_id uuid,
    hire_date date,
    "position" character varying(100),
    signature_file_path character varying(500),
    digital_signature_hash character varying(128),
    address character varying(500),
    is_trusted_partner boolean DEFAULT false,
    trusted_partner_type character varying(50),
    personal_email character varying(255)
);


ALTER TABLE public.users OWNER TO lto_user;

--
-- TOC entry 3990 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.users IS 'System users with role-based access control';


--
-- TOC entry 3991 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.employee_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.employee_id IS 'Unique employee identifier for LTO staff/officers';


--
-- TOC entry 3992 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.badge_number; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.badge_number IS 'Physical badge number for LTO officers';


--
-- TOC entry 3993 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.department; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.department IS 'Department within LTO (e.g., Registration, Enforcement)';


--
-- TOC entry 3994 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.branch_office; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.branch_office IS 'LTO branch office location';


--
-- TOC entry 3995 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.supervisor_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.supervisor_id IS 'Reference to supervising officer/admin';


--
-- TOC entry 3996 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.hire_date; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.hire_date IS 'Date officer was hired';


--
-- TOC entry 3997 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users."position"; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users."position" IS 'Job position/title';


--
-- TOC entry 3998 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.signature_file_path; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.signature_file_path IS 'Path to officer digital signature image';


--
-- TOC entry 3999 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.digital_signature_hash; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.digital_signature_hash IS 'Hash of digital signature for verification';


--
-- TOC entry 230 (class 1259 OID 16699)
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
-- TOC entry 4000 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE vehicle_history; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicle_history IS 'Audit trail for all vehicle-related actions';


--
-- TOC entry 231 (class 1259 OID 16706)
-- Name: officer_performance_metrics; Type: VIEW; Schema: public; Owner: lto_user
--

CREATE VIEW public.officer_performance_metrics AS
 SELECT u.id AS officer_id,
    u.email,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS officer_name,
    u.employee_id,
    u.badge_number,
    u.department,
    u.branch_office,
    u."position",
    u.hire_date,
    u.role AS officer_role,
    count(
        CASE
            WHEN (((vh.action)::text = 'APPROVED'::text) AND (vh.vehicle_id IS NOT NULL)) THEN 1
            ELSE NULL::integer
        END) AS vehicles_approved,
    count(
        CASE
            WHEN (((vh.action)::text = 'REJECTED'::text) AND (vh.vehicle_id IS NOT NULL)) THEN 1
            ELSE NULL::integer
        END) AS vehicles_rejected,
    count(
        CASE
            WHEN ((tr.reviewed_by = u.id) AND ((tr.status)::text = 'APPROVED'::text)) THEN 1
            ELSE NULL::integer
        END) AS transfers_approved,
    count(
        CASE
            WHEN ((tr.reviewed_by = u.id) AND ((tr.status)::text = 'REJECTED'::text)) THEN 1
            ELSE NULL::integer
        END) AS transfers_rejected,
    count(
        CASE
            WHEN ((d.verified_by = u.id) AND (d.verified = true)) THEN 1
            ELSE NULL::integer
        END) AS documents_verified,
    count(
        CASE
            WHEN (cr.requested_by = u.id) THEN 1
            ELSE NULL::integer
        END) AS clearances_requested,
    count(DISTINCT oal.id) AS total_activities,
    avg(oal.duration_seconds) AS avg_activity_duration_seconds,
    min(vh.performed_at) AS first_action_date,
    max(vh.performed_at) AS last_action_date,
    count(
        CASE
            WHEN (((tr.status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('REVIEWING'::character varying)::text])) AND (tr.reviewed_by = u.id)) THEN 1
            ELSE NULL::integer
        END) AS pending_transfers,
    count(
        CASE
            WHEN (((cr.status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('IN_PROGRESS'::character varying)::text])) AND (cr.assigned_to = u.id)) THEN 1
            ELSE NULL::integer
        END) AS pending_clearances,
    count(
        CASE
            WHEN (date(oal.created_at) = CURRENT_DATE) THEN 1
            ELSE NULL::integer
        END) AS today_activities,
    count(
        CASE
            WHEN (date_trunc('month'::text, oal.created_at) = date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone)) THEN 1
            ELSE NULL::integer
        END) AS month_activities,
    max(oal.created_at) AS last_activity_at
   FROM (((((public.users u
     LEFT JOIN public.vehicle_history vh ON ((vh.performed_by = u.id)))
     LEFT JOIN public.transfer_requests tr ON ((tr.reviewed_by = u.id)))
     LEFT JOIN public.documents d ON ((d.verified_by = u.id)))
     LEFT JOIN public.clearance_requests cr ON (((cr.requested_by = u.id) OR (cr.assigned_to = u.id))))
     LEFT JOIN public.officer_activity_log oal ON ((oal.officer_id = u.id)))
  WHERE (u.role = ANY (ARRAY['lto_officer'::public.user_role, 'lto_supervisor'::public.user_role, 'lto_admin'::public.user_role, 'staff'::public.user_role, 'admin'::public.user_role]))
  GROUP BY u.id, u.email, u.first_name, u.last_name, u.employee_id, u.badge_number, u.department, u.branch_office, u."position", u.hire_date, u.role;


ALTER VIEW public.officer_performance_metrics OWNER TO lto_user;

--
-- TOC entry 4001 (class 0 OID 0)
-- Dependencies: 231
-- Name: VIEW officer_performance_metrics; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON VIEW public.officer_performance_metrics IS 'Performance metrics for LTO officers for management reporting and dashboards';


--
-- TOC entry 232 (class 1259 OID 16711)
-- Name: or_number_seq; Type: SEQUENCE; Schema: public; Owner: lto_user
--

CREATE SEQUENCE public.or_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.or_number_seq OWNER TO lto_user;

--
-- TOC entry 233 (class 1259 OID 16712)
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
-- TOC entry 234 (class 1259 OID 16717)
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
-- TOC entry 4002 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE registration_document_requirements; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.registration_document_requirements IS 'Admin-configurable required/optional documents per registration workflow';


--
-- TOC entry 235 (class 1259 OID 16731)
-- Name: request_logs; Type: TABLE; Schema: public; Owner: lto_user
--

CREATE TABLE public.request_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    method character varying(10) NOT NULL,
    path character varying(500) NOT NULL,
    status_code integer NOT NULL,
    response_time_ms integer,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.request_logs OWNER TO lto_user;

--
-- TOC entry 236 (class 1259 OID 16738)
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
-- TOC entry 237 (class 1259 OID 16746)
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
-- TOC entry 4003 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.system_settings IS 'System configuration settings';


--
-- TOC entry 238 (class 1259 OID 16752)
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
-- TOC entry 239 (class 1259 OID 16759)
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
    CONSTRAINT transfer_documents_document_type_check CHECK (((document_type)::text = ANY ((ARRAY['deed_of_sale'::character varying, 'seller_id'::character varying, 'buyer_id'::character varying, 'buyer_tin'::character varying, 'buyer_ctpl'::character varying, 'buyer_mvir'::character varying, 'buyer_hpg_clearance'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.transfer_documents OWNER TO lto_user;

--
-- TOC entry 4004 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE transfer_documents; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_documents IS 'Transfer document links. Note: MVIR is NOT stored here - MVIR comes from LTO inspection (vehicles.inspection_documents)';


--
-- TOC entry 240 (class 1259 OID 16767)
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
    CONSTRAINT transfer_verifications_status_check CHECK (((status)::text = ANY (ARRAY[('APPROVED'::character varying)::text, ('REJECTED'::character varying)::text, ('PENDING'::character varying)::text])))
);


ALTER TABLE public.transfer_verifications OWNER TO lto_user;

--
-- TOC entry 4005 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE transfer_verifications; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_verifications IS 'Verification/audit records for documents in a transfer request';


--
-- TOC entry 241 (class 1259 OID 16777)
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
    mvir_number character varying(20),
    inspection_date timestamp without time zone,
    inspection_result character varying(20),
    roadworthiness_status character varying(20),
    emission_compliance character varying(20),
    inspection_officer character varying(100),
    inspection_notes text,
    inspection_documents jsonb,
    registration_expiry_date timestamp without time zone,
    insurance_expiry_date timestamp without time zone,
    emission_expiry_date timestamp without time zone,
    expiry_notified_30d boolean DEFAULT false,
    expiry_notified_7d boolean DEFAULT false,
    expiry_notified_1d boolean DEFAULT false,
    blockchain_tx_id character varying(255),
    vehicle_category character varying(50),
    passenger_capacity integer,
    gross_vehicle_weight numeric(10,2),
    net_weight numeric(10,2),
    registration_type character varying(20) DEFAULT 'Private'::character varying,
    origin_type character varying(20) DEFAULT 'NEW_REG'::character varying,
    or_number character varying(20),
    cr_number character varying(20),
    or_issued_at timestamp without time zone,
    cr_issued_at timestamp without time zone,
    date_of_registration timestamp without time zone,
    scrapped_at timestamp without time zone,
    scrap_reason text,
    scrapped_by uuid,
    previous_application_id uuid
);


ALTER TABLE public.vehicles OWNER TO lto_user;

--
-- TOC entry 4006 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE vehicles; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicles IS 'Vehicle registration data with blockchain integration';


--
-- TOC entry 4007 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN vehicles.blockchain_tx_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.blockchain_tx_id IS 'Hyperledger Fabric transaction ID for vehicle registration or ownership transfer';


--
-- TOC entry 4008 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN vehicles.previous_application_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.previous_application_id IS 'Self-reference to the previously rejected application for resubmissions';


--
-- TOC entry 242 (class 1259 OID 16795)
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
-- TOC entry 243 (class 1259 OID 16800)
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
-- TOC entry 4009 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE vehicle_verifications; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicle_verifications IS 'Verification status for insurance, emission, and admin approval';


--
-- TOC entry 244 (class 1259 OID 16811)
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
-- TOC entry 3565 (class 2606 OID 16817)
-- Name: certificate_submissions certificate_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_pkey PRIMARY KEY (id);


--
-- TOC entry 3571 (class 2606 OID 16819)
-- Name: certificates certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_certificate_number_key UNIQUE (certificate_number);


--
-- TOC entry 3573 (class 2606 OID 16821)
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- TOC entry 3587 (class 2606 OID 16823)
-- Name: clearance_requests clearance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3595 (class 2606 OID 16825)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 3604 (class 2606 OID 16827)
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3606 (class 2606 OID 16829)
-- Name: email_verification_tokens email_verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 3612 (class 2606 OID 16831)
-- Name: expiry_notifications expiry_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3617 (class 2606 OID 16833)
-- Name: external_issuers external_issuers_api_key_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.external_issuers
    ADD CONSTRAINT external_issuers_api_key_key UNIQUE (api_key);


--
-- TOC entry 3619 (class 2606 OID 16835)
-- Name: external_issuers external_issuers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.external_issuers
    ADD CONSTRAINT external_issuers_license_number_key UNIQUE (license_number);


--
-- TOC entry 3621 (class 2606 OID 16837)
-- Name: external_issuers external_issuers_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.external_issuers
    ADD CONSTRAINT external_issuers_pkey PRIMARY KEY (id);


--
-- TOC entry 3634 (class 2606 OID 16839)
-- Name: issued_certificates issued_certificates_certificate_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_certificate_number_key UNIQUE (certificate_number);


--
-- TOC entry 3636 (class 2606 OID 16841)
-- Name: issued_certificates issued_certificates_composite_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_composite_hash_key UNIQUE (composite_hash);


--
-- TOC entry 3638 (class 2606 OID 16843)
-- Name: issued_certificates issued_certificates_file_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_file_hash_key UNIQUE (file_hash);


--
-- TOC entry 3640 (class 2606 OID 16845)
-- Name: issued_certificates issued_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_pkey PRIMARY KEY (id);


--
-- TOC entry 3646 (class 2606 OID 16847)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3654 (class 2606 OID 16849)
-- Name: officer_activity_log officer_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.officer_activity_log
    ADD CONSTRAINT officer_activity_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3691 (class 2606 OID 16851)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3693 (class 2606 OID 16853)
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 3696 (class 2606 OID 16855)
-- Name: registration_document_requirements registration_document_require_registration_type_vehicle_cat_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.registration_document_requirements
    ADD CONSTRAINT registration_document_require_registration_type_vehicle_cat_key UNIQUE (registration_type, vehicle_category, document_type);


--
-- TOC entry 3698 (class 2606 OID 16857)
-- Name: registration_document_requirements registration_document_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.registration_document_requirements
    ADD CONSTRAINT registration_document_requirements_pkey PRIMARY KEY (id);


--
-- TOC entry 3704 (class 2606 OID 16859)
-- Name: request_logs request_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.request_logs
    ADD CONSTRAINT request_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3709 (class 2606 OID 16861)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 3711 (class 2606 OID 16863)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- TOC entry 3715 (class 2606 OID 16865)
-- Name: token_blacklist token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_pkey PRIMARY KEY (token_jti);


--
-- TOC entry 3720 (class 2606 OID 16867)
-- Name: transfer_documents transfer_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 3665 (class 2606 OID 16869)
-- Name: transfer_requests transfer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3726 (class 2606 OID 16871)
-- Name: transfer_verifications transfer_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3676 (class 2606 OID 16873)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3678 (class 2606 OID 16875)
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- TOC entry 3680 (class 2606 OID 16877)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3686 (class 2606 OID 16879)
-- Name: vehicle_history vehicle_history_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_pkey PRIMARY KEY (id);


--
-- TOC entry 3757 (class 2606 OID 16881)
-- Name: vehicle_verifications vehicle_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3759 (class 2606 OID 16883)
-- Name: vehicle_verifications vehicle_verifications_vehicle_id_verification_type_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_vehicle_id_verification_type_key UNIQUE (vehicle_id, verification_type);


--
-- TOC entry 3744 (class 2606 OID 16885)
-- Name: vehicles vehicles_mvir_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_mvir_number_key UNIQUE (mvir_number);


--
-- TOC entry 3746 (class 2606 OID 16887)
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 3748 (class 2606 OID 16889)
-- Name: vehicles vehicles_plate_number_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_number_key UNIQUE (plate_number);


--
-- TOC entry 3750 (class 2606 OID 16891)
-- Name: vehicles vehicles_vin_key; Type: CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vin_key UNIQUE (vin);


--
-- TOC entry 3566 (class 1259 OID 16892)
-- Name: idx_certificate_submissions_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_file_hash ON public.certificate_submissions USING btree (uploaded_file_hash);


--
-- TOC entry 3567 (class 1259 OID 16893)
-- Name: idx_certificate_submissions_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_status ON public.certificate_submissions USING btree (verification_status);


--
-- TOC entry 3568 (class 1259 OID 16894)
-- Name: idx_certificate_submissions_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_type ON public.certificate_submissions USING btree (certificate_type);


--
-- TOC entry 3569 (class 1259 OID 16895)
-- Name: idx_certificate_submissions_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificate_submissions_vehicle ON public.certificate_submissions USING btree (vehicle_id);


--
-- TOC entry 3574 (class 1259 OID 16896)
-- Name: idx_certificates_application_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_application_status ON public.certificates USING btree (application_status);


--
-- TOC entry 3575 (class 1259 OID 16897)
-- Name: idx_certificates_blockchain_tx_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_blockchain_tx_id ON public.certificates USING btree (blockchain_tx_id);


--
-- TOC entry 3576 (class 1259 OID 16898)
-- Name: idx_certificates_composite_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_composite_hash ON public.certificates USING btree (composite_hash);


--
-- TOC entry 3577 (class 1259 OID 16899)
-- Name: idx_certificates_document_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_document_id ON public.certificates USING btree (document_id);


--
-- TOC entry 3578 (class 1259 OID 16900)
-- Name: idx_certificates_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_file_hash ON public.certificates USING btree (file_hash);


--
-- TOC entry 3579 (class 1259 OID 16901)
-- Name: idx_certificates_issued_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_issued_by ON public.certificates USING btree (issued_by);


--
-- TOC entry 3580 (class 1259 OID 16902)
-- Name: idx_certificates_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_number ON public.certificates USING btree (certificate_number);


--
-- TOC entry 3581 (class 1259 OID 16903)
-- Name: idx_certificates_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_request ON public.certificates USING btree (clearance_request_id);


--
-- TOC entry 3582 (class 1259 OID 16904)
-- Name: idx_certificates_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_status ON public.certificates USING btree (status);


--
-- TOC entry 3583 (class 1259 OID 16905)
-- Name: idx_certificates_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_type ON public.certificates USING btree (certificate_type);


--
-- TOC entry 3584 (class 1259 OID 16906)
-- Name: idx_certificates_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_vehicle ON public.certificates USING btree (vehicle_id);


--
-- TOC entry 3585 (class 1259 OID 16907)
-- Name: idx_certificates_verified_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_certificates_verified_by ON public.certificates USING btree (verified_by);


--
-- TOC entry 3588 (class 1259 OID 16908)
-- Name: idx_clearance_assigned; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_assigned ON public.clearance_requests USING btree (assigned_to);


--
-- TOC entry 3589 (class 1259 OID 16909)
-- Name: idx_clearance_created_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_created_at ON public.clearance_requests USING btree (created_at);


--
-- TOC entry 3590 (class 1259 OID 16910)
-- Name: idx_clearance_requested_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_requested_by ON public.clearance_requests USING btree (requested_by);


--
-- TOC entry 3591 (class 1259 OID 16911)
-- Name: idx_clearance_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_status ON public.clearance_requests USING btree (status);


--
-- TOC entry 3592 (class 1259 OID 16912)
-- Name: idx_clearance_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_type ON public.clearance_requests USING btree (request_type);


--
-- TOC entry 3593 (class 1259 OID 16913)
-- Name: idx_clearance_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_clearance_vehicle ON public.clearance_requests USING btree (vehicle_id);


--
-- TOC entry 3694 (class 1259 OID 16914)
-- Name: idx_doc_requirements_type_category; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_doc_requirements_type_category ON public.registration_document_requirements USING btree (registration_type, vehicle_category, is_active);


--
-- TOC entry 3596 (class 1259 OID 16915)
-- Name: idx_documents_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_hash ON public.documents USING btree (file_hash);


--
-- TOC entry 3597 (class 1259 OID 16916)
-- Name: idx_documents_inspection; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_inspection ON public.documents USING btree (is_inspection_document);


--
-- TOC entry 3598 (class 1259 OID 16917)
-- Name: idx_documents_inspection_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_inspection_type ON public.documents USING btree (inspection_document_type);


--
-- TOC entry 3599 (class 1259 OID 16918)
-- Name: idx_documents_ipfs_cid; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_ipfs_cid ON public.documents USING btree (ipfs_cid);


--
-- TOC entry 3600 (class 1259 OID 16919)
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);


--
-- TOC entry 3601 (class 1259 OID 16920)
-- Name: idx_documents_unverified; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_unverified ON public.documents USING btree (id) WHERE (verified = false);


--
-- TOC entry 3602 (class 1259 OID 16921)
-- Name: idx_documents_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_documents_vehicle ON public.documents USING btree (vehicle_id);


--
-- TOC entry 3607 (class 1259 OID 16922)
-- Name: idx_email_verification_tokens_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_expires_at ON public.email_verification_tokens USING btree (expires_at);


--
-- TOC entry 3608 (class 1259 OID 16923)
-- Name: idx_email_verification_tokens_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_hash ON public.email_verification_tokens USING btree (token_hash);


--
-- TOC entry 3609 (class 1259 OID 16924)
-- Name: idx_email_verification_tokens_used_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_used_at ON public.email_verification_tokens USING btree (used_at);


--
-- TOC entry 3610 (class 1259 OID 16925)
-- Name: idx_email_verification_tokens_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens USING btree (user_id);


--
-- TOC entry 3613 (class 1259 OID 16926)
-- Name: idx_expiry_notifications_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_expiry_notifications_type ON public.expiry_notifications USING btree (notification_type);


--
-- TOC entry 3614 (class 1259 OID 16927)
-- Name: idx_expiry_notifications_user; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_expiry_notifications_user ON public.expiry_notifications USING btree (user_id);


--
-- TOC entry 3615 (class 1259 OID 16928)
-- Name: idx_expiry_notifications_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_expiry_notifications_vehicle ON public.expiry_notifications USING btree (vehicle_id);


--
-- TOC entry 3622 (class 1259 OID 16929)
-- Name: idx_external_issuers_active; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_external_issuers_active ON public.external_issuers USING btree (is_active);


--
-- TOC entry 3623 (class 1259 OID 16930)
-- Name: idx_external_issuers_api_key; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_external_issuers_api_key ON public.external_issuers USING btree (api_key);


--
-- TOC entry 3624 (class 1259 OID 16931)
-- Name: idx_external_issuers_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_external_issuers_type ON public.external_issuers USING btree (issuer_type);


--
-- TOC entry 3681 (class 1259 OID 16932)
-- Name: idx_history_action; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_action ON public.vehicle_history USING btree (action);


--
-- TOC entry 3682 (class 1259 OID 16933)
-- Name: idx_history_performed_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_performed_at ON public.vehicle_history USING btree (performed_at);


--
-- TOC entry 3683 (class 1259 OID 16934)
-- Name: idx_history_performed_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_performed_by ON public.vehicle_history USING btree (performed_by);


--
-- TOC entry 3684 (class 1259 OID 16935)
-- Name: idx_history_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_history_vehicle ON public.vehicle_history USING btree (vehicle_id);


--
-- TOC entry 3625 (class 1259 OID 16936)
-- Name: idx_issued_certificates_blockchain_tx; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_blockchain_tx ON public.issued_certificates USING btree (blockchain_tx_id);


--
-- TOC entry 3626 (class 1259 OID 16937)
-- Name: idx_issued_certificates_composite_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_composite_hash ON public.issued_certificates USING btree (composite_hash);


--
-- TOC entry 3627 (class 1259 OID 16938)
-- Name: idx_issued_certificates_file_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_file_hash ON public.issued_certificates USING btree (file_hash);


--
-- TOC entry 3628 (class 1259 OID 16939)
-- Name: idx_issued_certificates_issuer; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_issuer ON public.issued_certificates USING btree (issuer_id);


--
-- TOC entry 3629 (class 1259 OID 16940)
-- Name: idx_issued_certificates_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_number ON public.issued_certificates USING btree (certificate_number);


--
-- TOC entry 3630 (class 1259 OID 16941)
-- Name: idx_issued_certificates_revoked; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_revoked ON public.issued_certificates USING btree (is_revoked);


--
-- TOC entry 3631 (class 1259 OID 16942)
-- Name: idx_issued_certificates_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_type ON public.issued_certificates USING btree (certificate_type);


--
-- TOC entry 3632 (class 1259 OID 16943)
-- Name: idx_issued_certificates_vin; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_issued_certificates_vin ON public.issued_certificates USING btree (vehicle_vin);


--
-- TOC entry 3641 (class 1259 OID 16944)
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- TOC entry 3642 (class 1259 OID 16945)
-- Name: idx_notifications_sent_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_sent_at ON public.notifications USING btree (sent_at);


--
-- TOC entry 3643 (class 1259 OID 16946)
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (id) WHERE (read = false);


--
-- TOC entry 3644 (class 1259 OID 16947)
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- TOC entry 3647 (class 1259 OID 16948)
-- Name: idx_officer_activity_action; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_officer_activity_action ON public.officer_activity_log USING btree (action);


--
-- TOC entry 3648 (class 1259 OID 16949)
-- Name: idx_officer_activity_created_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_officer_activity_created_at ON public.officer_activity_log USING btree (created_at);


--
-- TOC entry 3649 (class 1259 OID 16950)
-- Name: idx_officer_activity_entity; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_officer_activity_entity ON public.officer_activity_log USING btree (entity_type, entity_id) WHERE (entity_id IS NOT NULL);


--
-- TOC entry 3650 (class 1259 OID 16951)
-- Name: idx_officer_activity_officer; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_officer_activity_officer ON public.officer_activity_log USING btree (officer_id);


--
-- TOC entry 3651 (class 1259 OID 16952)
-- Name: idx_officer_activity_session; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_officer_activity_session ON public.officer_activity_log USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- TOC entry 3652 (class 1259 OID 16953)
-- Name: idx_officer_activity_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_officer_activity_type ON public.officer_activity_log USING btree (activity_type);


--
-- TOC entry 3687 (class 1259 OID 16954)
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- TOC entry 3688 (class 1259 OID 16955)
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- TOC entry 3689 (class 1259 OID 16956)
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- TOC entry 3699 (class 1259 OID 16957)
-- Name: idx_request_logs_created_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_request_logs_created_at ON public.request_logs USING btree (created_at);


--
-- TOC entry 3700 (class 1259 OID 16958)
-- Name: idx_request_logs_path; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_request_logs_path ON public.request_logs USING btree (path);


--
-- TOC entry 3701 (class 1259 OID 16959)
-- Name: idx_request_logs_status_code; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_request_logs_status_code ON public.request_logs USING btree (status_code);


--
-- TOC entry 3702 (class 1259 OID 16960)
-- Name: idx_request_logs_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_request_logs_user_id ON public.request_logs USING btree (user_id);


--
-- TOC entry 3705 (class 1259 OID 16961)
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- TOC entry 3706 (class 1259 OID 16962)
-- Name: idx_sessions_refresh_token_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_sessions_refresh_token_id ON public.sessions USING btree (refresh_token_id);


--
-- TOC entry 3707 (class 1259 OID 16963)
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- TOC entry 3712 (class 1259 OID 16964)
-- Name: idx_token_blacklist_expires_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_token_blacklist_expires_at ON public.token_blacklist USING btree (expires_at);


--
-- TOC entry 3713 (class 1259 OID 16965)
-- Name: idx_token_blacklist_hash; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_token_blacklist_hash ON public.token_blacklist USING btree (token_hash);


--
-- TOC entry 3655 (class 1259 OID 16966)
-- Name: idx_transfer_buyer; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_buyer ON public.transfer_requests USING btree (buyer_id);


--
-- TOC entry 3716 (class 1259 OID 16967)
-- Name: idx_transfer_docs_document; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_docs_document ON public.transfer_documents USING btree (document_id);


--
-- TOC entry 3717 (class 1259 OID 16968)
-- Name: idx_transfer_docs_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_docs_request ON public.transfer_documents USING btree (transfer_request_id);


--
-- TOC entry 3718 (class 1259 OID 16969)
-- Name: idx_transfer_docs_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_docs_type ON public.transfer_documents USING btree (document_type);


--
-- TOC entry 3656 (class 1259 OID 16970)
-- Name: idx_transfer_emission_approval; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_emission_approval ON public.transfer_requests USING btree (emission_approval_status);


--
-- TOC entry 3657 (class 1259 OID 16971)
-- Name: idx_transfer_hpg_approval; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_hpg_approval ON public.transfer_requests USING btree (hpg_approval_status);


--
-- TOC entry 3658 (class 1259 OID 16972)
-- Name: idx_transfer_insurance_approval; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_insurance_approval ON public.transfer_requests USING btree (insurance_approval_status);


--
-- TOC entry 3659 (class 1259 OID 16973)
-- Name: idx_transfer_reviewed_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_reviewed_by ON public.transfer_requests USING btree (reviewed_by);


--
-- TOC entry 3660 (class 1259 OID 16974)
-- Name: idx_transfer_seller; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_seller ON public.transfer_requests USING btree (seller_id);


--
-- TOC entry 3661 (class 1259 OID 16975)
-- Name: idx_transfer_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_status ON public.transfer_requests USING btree (status);


--
-- TOC entry 3662 (class 1259 OID 16976)
-- Name: idx_transfer_submitted_at; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_submitted_at ON public.transfer_requests USING btree (submitted_at);


--
-- TOC entry 3663 (class 1259 OID 16977)
-- Name: idx_transfer_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_vehicle ON public.transfer_requests USING btree (vehicle_id);


--
-- TOC entry 3721 (class 1259 OID 16978)
-- Name: idx_transfer_verif_document; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_document ON public.transfer_verifications USING btree (document_id);


--
-- TOC entry 3722 (class 1259 OID 16979)
-- Name: idx_transfer_verif_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_request ON public.transfer_verifications USING btree (transfer_request_id);


--
-- TOC entry 3723 (class 1259 OID 16980)
-- Name: idx_transfer_verif_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_status ON public.transfer_verifications USING btree (status);


--
-- TOC entry 3724 (class 1259 OID 16981)
-- Name: idx_transfer_verif_verified_by; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_transfer_verif_verified_by ON public.transfer_verifications USING btree (verified_by);


--
-- TOC entry 3666 (class 1259 OID 16982)
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active);


--
-- TOC entry 3667 (class 1259 OID 16983)
-- Name: idx_users_badge_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_badge_number ON public.users USING btree (badge_number) WHERE (badge_number IS NOT NULL);


--
-- TOC entry 3668 (class 1259 OID 16984)
-- Name: idx_users_branch_office; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_branch_office ON public.users USING btree (branch_office) WHERE (branch_office IS NOT NULL);


--
-- TOC entry 3669 (class 1259 OID 16985)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_department ON public.users USING btree (department) WHERE (department IS NOT NULL);


--
-- TOC entry 3670 (class 1259 OID 16986)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3671 (class 1259 OID 16987)
-- Name: idx_users_employee_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_employee_id ON public.users USING btree (employee_id) WHERE (employee_id IS NOT NULL);


--
-- TOC entry 3672 (class 1259 OID 16988)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 3673 (class 1259 OID 16989)
-- Name: idx_users_supervisor; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_supervisor ON public.users USING btree (supervisor_id) WHERE (supervisor_id IS NOT NULL);


--
-- TOC entry 3674 (class 1259 OID 16990)
-- Name: idx_users_trusted_partner; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_users_trusted_partner ON public.users USING btree (is_trusted_partner) WHERE (is_trusted_partner = true);


--
-- TOC entry 3727 (class 1259 OID 16991)
-- Name: idx_vehicles_active; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_active ON public.vehicles USING btree (id) WHERE (status = ANY (ARRAY['SUBMITTED'::public.vehicle_status, 'REGISTERED'::public.vehicle_status]));


--
-- TOC entry 3728 (class 1259 OID 16992)
-- Name: idx_vehicles_blockchain_tx_id; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_blockchain_tx_id ON public.vehicles USING btree (blockchain_tx_id);


--
-- TOC entry 3729 (class 1259 OID 16993)
-- Name: idx_vehicles_cr_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_cr_number ON public.vehicles USING btree (cr_number) WHERE (cr_number IS NOT NULL);


--
-- TOC entry 3730 (class 1259 OID 16994)
-- Name: idx_vehicles_inspection_date; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_inspection_date ON public.vehicles USING btree (inspection_date);


--
-- TOC entry 3731 (class 1259 OID 16995)
-- Name: idx_vehicles_inspection_result; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_inspection_result ON public.vehicles USING btree (inspection_result);


--
-- TOC entry 3732 (class 1259 OID 16996)
-- Name: idx_vehicles_insurance_expiry; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_insurance_expiry ON public.vehicles USING btree (insurance_expiry_date);


--
-- TOC entry 3733 (class 1259 OID 16997)
-- Name: idx_vehicles_make_model; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_make_model ON public.vehicles USING btree (make, model);


--
-- TOC entry 3734 (class 1259 OID 16998)
-- Name: idx_vehicles_mvir; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_mvir ON public.vehicles USING btree (mvir_number);


--
-- TOC entry 3735 (class 1259 OID 16999)
-- Name: idx_vehicles_or_number; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_or_number ON public.vehicles USING btree (or_number) WHERE (or_number IS NOT NULL);


--
-- TOC entry 3736 (class 1259 OID 17000)
-- Name: idx_vehicles_owner; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_owner ON public.vehicles USING btree (owner_id);


--
-- TOC entry 3737 (class 1259 OID 17001)
-- Name: idx_vehicles_plate; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_plate ON public.vehicles USING btree (plate_number);


--
-- TOC entry 3738 (class 1259 OID 17288)
-- Name: idx_vehicles_previous_application; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_previous_application ON public.vehicles USING btree (previous_application_id) WHERE (previous_application_id IS NOT NULL);


--
-- TOC entry 3739 (class 1259 OID 17002)
-- Name: idx_vehicles_registration_expiry; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_registration_expiry ON public.vehicles USING btree (registration_expiry_date);


--
-- TOC entry 3740 (class 1259 OID 17003)
-- Name: idx_vehicles_scrapped; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_scrapped ON public.vehicles USING btree (scrapped_at) WHERE (status = 'SCRAPPED'::public.vehicle_status);


--
-- TOC entry 3741 (class 1259 OID 17004)
-- Name: idx_vehicles_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status);


--
-- TOC entry 3742 (class 1259 OID 17005)
-- Name: idx_vehicles_vin; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_vin ON public.vehicles USING btree (vin);


--
-- TOC entry 3751 (class 1259 OID 17006)
-- Name: idx_verifications_automated; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_automated ON public.vehicle_verifications USING btree (automated, status);


--
-- TOC entry 3752 (class 1259 OID 17007)
-- Name: idx_verifications_clearance_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_clearance_request ON public.vehicle_verifications USING btree (clearance_request_id);


--
-- TOC entry 3753 (class 1259 OID 17008)
-- Name: idx_verifications_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_status ON public.vehicle_verifications USING btree (status);


--
-- TOC entry 3754 (class 1259 OID 17009)
-- Name: idx_verifications_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_type ON public.vehicle_verifications USING btree (verification_type);


--
-- TOC entry 3755 (class 1259 OID 17010)
-- Name: idx_verifications_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_vehicle ON public.vehicle_verifications USING btree (vehicle_id);


--
-- TOC entry 3814 (class 2620 OID 17011)
-- Name: email_verification_tokens trigger_cleanup_verification_tokens; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_cleanup_verification_tokens AFTER INSERT ON public.email_verification_tokens FOR EACH ROW EXECUTE FUNCTION public.auto_cleanup_old_tokens();


--
-- TOC entry 3817 (class 2620 OID 17012)
-- Name: vehicle_history trigger_log_officer_vehicle_action; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_log_officer_vehicle_action AFTER INSERT ON public.vehicle_history FOR EACH ROW EXECUTE FUNCTION public.log_officer_vehicle_action();


--
-- TOC entry 3813 (class 2620 OID 17013)
-- Name: clearance_requests trigger_update_clearance_requests_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_clearance_requests_updated_at BEFORE UPDATE ON public.clearance_requests FOR EACH ROW EXECUTE FUNCTION public.update_clearance_requests_updated_at();


--
-- TOC entry 3818 (class 2620 OID 17014)
-- Name: registration_document_requirements trigger_update_document_requirements_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_document_requirements_updated_at BEFORE UPDATE ON public.registration_document_requirements FOR EACH ROW EXECUTE FUNCTION public.update_document_requirements_updated_at();


--
-- TOC entry 3815 (class 2620 OID 17015)
-- Name: transfer_requests trigger_update_transfer_requests_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_transfer_requests_updated_at BEFORE UPDATE ON public.transfer_requests FOR EACH ROW EXECUTE FUNCTION public.update_transfer_requests_updated_at();


--
-- TOC entry 3816 (class 2620 OID 17016)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3819 (class 2620 OID 17017)
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3820 (class 2620 OID 17018)
-- Name: vehicle_verifications update_verifications_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON public.vehicle_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3760 (class 2606 OID 17019)
-- Name: certificate_submissions certificate_submissions_matched_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_matched_certificate_id_fkey FOREIGN KEY (matched_certificate_id) REFERENCES public.issued_certificates(id) ON DELETE SET NULL;


--
-- TOC entry 3761 (class 2606 OID 17024)
-- Name: certificate_submissions certificate_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3762 (class 2606 OID 17029)
-- Name: certificate_submissions certificate_submissions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3763 (class 2606 OID 17034)
-- Name: certificate_submissions certificate_submissions_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3764 (class 2606 OID 17039)
-- Name: certificates certificates_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_clearance_request_id_fkey FOREIGN KEY (clearance_request_id) REFERENCES public.clearance_requests(id) ON DELETE SET NULL;


--
-- TOC entry 3765 (class 2606 OID 17044)
-- Name: certificates certificates_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3766 (class 2606 OID 17049)
-- Name: certificates certificates_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- TOC entry 3767 (class 2606 OID 17054)
-- Name: certificates certificates_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3768 (class 2606 OID 17059)
-- Name: certificates certificates_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3769 (class 2606 OID 17064)
-- Name: clearance_requests clearance_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 3770 (class 2606 OID 17069)
-- Name: clearance_requests clearance_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- TOC entry 3771 (class 2606 OID 17074)
-- Name: clearance_requests clearance_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3773 (class 2606 OID 17079)
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3774 (class 2606 OID 17084)
-- Name: documents documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3775 (class 2606 OID 17089)
-- Name: documents documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3776 (class 2606 OID 17094)
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3777 (class 2606 OID 17099)
-- Name: expiry_notifications expiry_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3778 (class 2606 OID 17104)
-- Name: expiry_notifications expiry_notifications_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3772 (class 2606 OID 17109)
-- Name: clearance_requests fk_clearance_certificate; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT fk_clearance_certificate FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE SET NULL;


--
-- TOC entry 3779 (class 2606 OID 17114)
-- Name: issued_certificates issued_certificates_issuer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_issuer_id_fkey FOREIGN KEY (issuer_id) REFERENCES public.external_issuers(id) ON DELETE SET NULL;


--
-- TOC entry 4010 (class 0 OID 0)
-- Dependencies: 3779
-- Name: CONSTRAINT issued_certificates_issuer_id_fkey ON issued_certificates; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON CONSTRAINT issued_certificates_issuer_id_fkey ON public.issued_certificates IS 'Foreign key to external_issuers table. Changed from users table to match code implementation.';


--
-- TOC entry 3780 (class 2606 OID 17119)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3781 (class 2606 OID 17124)
-- Name: officer_activity_log officer_activity_log_officer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.officer_activity_log
    ADD CONSTRAINT officer_activity_log_officer_id_fkey FOREIGN KEY (officer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3782 (class 2606 OID 17129)
-- Name: officer_activity_log officer_activity_log_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.officer_activity_log
    ADD CONSTRAINT officer_activity_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- TOC entry 3796 (class 2606 OID 17134)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3797 (class 2606 OID 17139)
-- Name: request_logs request_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.request_logs
    ADD CONSTRAINT request_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3798 (class 2606 OID 17144)
-- Name: sessions sessions_refresh_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_id_fkey FOREIGN KEY (refresh_token_id) REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;


--
-- TOC entry 3799 (class 2606 OID 17149)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3800 (class 2606 OID 17154)
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 3801 (class 2606 OID 17159)
-- Name: transfer_documents transfer_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3802 (class 2606 OID 17164)
-- Name: transfer_documents transfer_documents_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3803 (class 2606 OID 17169)
-- Name: transfer_documents transfer_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3783 (class 2606 OID 17174)
-- Name: transfer_requests transfer_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- TOC entry 3784 (class 2606 OID 17179)
-- Name: transfer_requests transfer_requests_emission_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_emission_approved_by_fkey FOREIGN KEY (emission_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3785 (class 2606 OID 17184)
-- Name: transfer_requests transfer_requests_emission_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_emission_clearance_request_id_fkey FOREIGN KEY (emission_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3786 (class 2606 OID 17189)
-- Name: transfer_requests transfer_requests_hpg_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_hpg_approved_by_fkey FOREIGN KEY (hpg_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3787 (class 2606 OID 17194)
-- Name: transfer_requests transfer_requests_hpg_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_hpg_clearance_request_id_fkey FOREIGN KEY (hpg_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3788 (class 2606 OID 17199)
-- Name: transfer_requests transfer_requests_insurance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_insurance_approved_by_fkey FOREIGN KEY (insurance_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3789 (class 2606 OID 17204)
-- Name: transfer_requests transfer_requests_insurance_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_insurance_clearance_request_id_fkey FOREIGN KEY (insurance_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3790 (class 2606 OID 17209)
-- Name: transfer_requests transfer_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 3791 (class 2606 OID 17214)
-- Name: transfer_requests transfer_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- TOC entry 3792 (class 2606 OID 17219)
-- Name: transfer_requests transfer_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3804 (class 2606 OID 17224)
-- Name: transfer_verifications transfer_verifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3805 (class 2606 OID 17229)
-- Name: transfer_verifications transfer_verifications_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3806 (class 2606 OID 17234)
-- Name: transfer_verifications transfer_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3793 (class 2606 OID 17239)
-- Name: users users_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- TOC entry 3794 (class 2606 OID 17244)
-- Name: vehicle_history vehicle_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- TOC entry 3795 (class 2606 OID 17249)
-- Name: vehicle_history vehicle_history_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3810 (class 2606 OID 17254)
-- Name: vehicle_verifications vehicle_verifications_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_clearance_request_id_fkey FOREIGN KEY (clearance_request_id) REFERENCES public.clearance_requests(id) ON DELETE SET NULL;


--
-- TOC entry 3811 (class 2606 OID 17259)
-- Name: vehicle_verifications vehicle_verifications_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3812 (class 2606 OID 17264)
-- Name: vehicle_verifications vehicle_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3807 (class 2606 OID 17269)
-- Name: vehicles vehicles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- TOC entry 3808 (class 2606 OID 17283)
-- Name: vehicles vehicles_previous_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_previous_application_id_fkey FOREIGN KEY (previous_application_id) REFERENCES public.vehicles(id);


--
-- TOC entry 3809 (class 2606 OID 17274)
-- Name: vehicles vehicles_scrapped_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_scrapped_by_fkey FOREIGN KEY (scrapped_by) REFERENCES public.users(id);


-- Completed on 2026-02-03 19:44:44

--
-- PostgreSQL database dump complete
--

\unrestrict 45G0AIirgjgpMswTdmRPS5FOKgIrIl5TBPt24v8g7p5pAC8scj0a4JEgIJnno5S

