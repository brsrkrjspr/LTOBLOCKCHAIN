--
-- PostgreSQL database dump
--

\restrict 1Sx0eRD06GUxGNkLzFKgWbead9S2kW99MurQfLpF1G2aXONEv2a5tkdfbxd9PGS

-- Dumped from database version 15.15
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-08 13:09:02

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
-- TOC entry 3997 (class 0 OID 0)
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
-- TOC entry 3998 (class 0 OID 0)
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
-- TOC entry 3999 (class 0 OID 0)
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
-- TOC entry 4000 (class 0 OID 0)
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
-- TOC entry 4001 (class 0 OID 0)
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
-- TOC entry 4002 (class 0 OID 0)
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
-- TOC entry 4003 (class 0 OID 0)
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
-- TOC entry 4004 (class 0 OID 0)
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
-- TOC entry 4005 (class 0 OID 0)
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
-- TOC entry 4006 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE officer_activity_log; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.officer_activity_log IS 'Detailed activity log for LTO officers for performance tracking and accountability';


--
-- TOC entry 4007 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.officer_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.officer_id IS 'User ID of the officer performing the action';


--
-- TOC entry 4008 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.activity_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.activity_type IS 'Type of activity (registration, verification, transfer, etc.)';


--
-- TOC entry 4009 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.entity_type; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.entity_type IS 'Type of entity being acted upon';


--
-- TOC entry 4010 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.entity_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.entity_id IS 'ID of the entity being acted upon';


--
-- TOC entry 4011 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.action; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.action IS 'Specific action performed';


--
-- TOC entry 4012 (class 0 OID 0)
-- Dependencies: 227
-- Name: COLUMN officer_activity_log.duration_seconds; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.officer_activity_log.duration_seconds IS 'Time taken to complete the activity';


--
-- TOC entry 4013 (class 0 OID 0)
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
-- TOC entry 4014 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE transfer_requests; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.transfer_requests IS 'Tracks vehicle ownership transfer requests from seller to buyer';


--
-- TOC entry 4015 (class 0 OID 0)
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
-- TOC entry 4016 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.users IS 'System users with role-based access control';


--
-- TOC entry 4017 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.employee_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.employee_id IS 'Unique employee identifier for LTO staff/officers';


--
-- TOC entry 4018 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.badge_number; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.badge_number IS 'Physical badge number for LTO officers';


--
-- TOC entry 4019 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.department; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.department IS 'Department within LTO (e.g., Registration, Enforcement)';


--
-- TOC entry 4020 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.branch_office; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.branch_office IS 'LTO branch office location';


--
-- TOC entry 4021 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.supervisor_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.supervisor_id IS 'Reference to supervising officer/admin';


--
-- TOC entry 4022 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.hire_date; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.hire_date IS 'Date officer was hired';


--
-- TOC entry 4023 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users."position"; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users."position" IS 'Job position/title';


--
-- TOC entry 4024 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN users.signature_file_path; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.users.signature_file_path IS 'Path to officer digital signature image';


--
-- TOC entry 4025 (class 0 OID 0)
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
-- TOC entry 4026 (class 0 OID 0)
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
-- TOC entry 4027 (class 0 OID 0)
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
-- TOC entry 4028 (class 0 OID 0)
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
-- TOC entry 4029 (class 0 OID 0)
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
    CONSTRAINT transfer_documents_document_type_check CHECK (((document_type)::text = ANY (ARRAY[('deed_of_sale'::character varying)::text, ('seller_id'::character varying)::text, ('buyer_id'::character varying)::text, ('buyer_tin'::character varying)::text, ('buyer_ctpl'::character varying)::text, ('buyer_mvir'::character varying)::text, ('buyer_hpg_clearance'::character varying)::text, ('other'::character varying)::text])))
);


ALTER TABLE public.transfer_documents OWNER TO lto_user;

--
-- TOC entry 4030 (class 0 OID 0)
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
-- TOC entry 4031 (class 0 OID 0)
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
-- TOC entry 4032 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE vehicles; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON TABLE public.vehicles IS 'Vehicle registration data with blockchain integration';


--
-- TOC entry 4033 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN vehicles.blockchain_tx_id; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON COLUMN public.vehicles.blockchain_tx_id IS 'Hyperledger Fabric transaction ID for vehicle registration or ownership transfer';


--
-- TOC entry 4034 (class 0 OID 0)
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
-- TOC entry 4035 (class 0 OID 0)
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
-- TOC entry 3966 (class 0 OID 16566)
-- Dependencies: 216
-- Data for Name: certificate_submissions; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.certificate_submissions (id, vehicle_id, certificate_type, uploaded_file_path, uploaded_file_hash, verification_status, verification_notes, matched_certificate_id, submitted_by, verified_by, submitted_at, verified_at, created_at) FROM stdin;
\.


--
-- TOC entry 3967 (class 0 OID 16577)
-- Dependencies: 217
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.certificates (id, clearance_request_id, vehicle_id, certificate_type, certificate_number, file_path, ipfs_cid, issued_by, issued_at, expires_at, status, metadata, created_at, file_hash, composite_hash, blockchain_tx_id, application_status, document_id, verified_at, verified_by, revocation_reason, revoked_at) FROM stdin;
\.


--
-- TOC entry 3968 (class 0 OID 16590)
-- Dependencies: 218
-- Data for Name: clearance_requests; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.clearance_requests (id, vehicle_id, request_type, status, requested_by, requested_at, assigned_to, completed_at, certificate_id, purpose, notes, metadata, created_at, updated_at, verification_mode) FROM stdin;
954bd8aa-318d-455f-916a-06830dde262e	ed358d5a-ac0d-4a12-b593-8251152c9457	insurance	APPROVED	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:00.842521	\N	2026-02-07 08:26:01.461751	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "a4c57d59-fd65-424c-83e1-2b5dc9486d8f", "cid": "bafkreiea5uwckjapw3xo2l7zaatxttzpvsjrudz7lavoz2urq5xeaaxmoy", "path": "/app/backend/uploads/document-1770452756889-108653372.pdf", "type": "insurance_cert", "filename": "CTPL_Insurance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf"}], "documentId": "a4c57d59-fd65-424c-83e1-2b5dc9486d8f", "vehicleVin": "7MTTNKS3BFKW7384D", "verifiedAt": "2026-02-07T08:26:01.461Z", "verifiedBy": "system", "documentCid": "bafkreiea5uwckjapw3xo2l7zaatxttzpvsjrudz7lavoz2urq5xeaaxmoy", "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770452756889-108653372.pdf", "documentType": "insurance_cert", "vehiclePlate": "TZK-5341", "autoTriggered": true, "documentFilename": "CTPL_Insurance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf", "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-6G8AT1"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-6G8AT1"}, "compositeHash": "6147530a7af771cb75a3fd2f661fe5d7ea24b2dcd652ae9414b749d003e46210", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "80ed2c25240fb6eeed2ff9002779cf2fac931a0f3f582aecea91876e4002ec76", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "903f3367-2bf7-43ff-aa1a-43cb057dcfec", "originalCompositeHash": "1a57c9076584b0d5ee51b065b3b5b905daaca10c427902a81ce1a09b0e70483c", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-6G8AT1"}}}	2026-02-07 08:26:00.842521	2026-02-07 08:26:01.461751	MANUAL
96775303-d7b4-41d6-b340-db7f48b76283	d7463eaa-e937-4e14-ac30-a0bb43dc5747	insurance	PENDING	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:30.415869	21d178c0-37c5-466e-b2eb-560e32981cbd	\N	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"documents": [{"id": "1bdb7fd8-4e3a-4bf2-9307-65c79f8b0422", "cid": "bafkreidemzte3yn4gujq7cxqcnn5cik6ey7zh5q2jocxts2inaztznxdhi", "path": "/app/backend/uploads/document-1770373049427-825124787.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-8C6FII.pdf"}], "ownerName": "Jasper Dulla", "documentId": "1bdb7fd8-4e3a-4bf2-9307-65c79f8b0422", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "VFYD3SRG9DYJDAHT2", "verifiedAt": null, "verifiedBy": "system", "documentCid": "bafkreidemzte3yn4gujq7cxqcnn5cik6ey7zh5q2jocxts2inaztznxdhi", "vehicleMake": "Toyota", "vehicleYear": 2025, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770373049427-825124787.pdf", "documentType": "insurance_cert", "vehicleModel": "Corolla Altis", "vehiclePlate": "LKF-9216", "documentFilename": "Insurance_Certificate_CTPL-2026-8C6FII.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-8C6FII"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-8C6FII"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "6466664de1bc35130f8af0135bd1215e...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}	2026-02-06 10:17:30.415869	2026-02-06 10:17:30.415869	MANUAL
ed9aad26-72fc-4d1a-9c62-9426343f89a8	d7463eaa-e937-4e14-ac30-a0bb43dc5747	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:30.261561	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-06 10:18:33.440108	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "4da9d285-e7ea-4bfe-9341-37bea793f6f3", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770373049358-591393085.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "80b71c43-1365-483a-918c-725b9b764a09", "cid": "bafkreibsuwgnt6ofbpj6tvlxz3rnnk6lvzuxka36lj54eneplhxjigticu", "path": "/app/backend/uploads/document-1770373049299-671580688.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-9I7N66.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-06T10:18:18.115Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "decf9222d33375c64e4ad8af405635d012fafa7a3b6e716d736287133541b7b2", "preFilledData": {"engineNumber": "3UR-FE730776", "chassisNumber": "VFYD3SRG9DYJDAHT2"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 85, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 15}, "confidenceScore": 85, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "hpg_clearance", "searchedFileHash": "32a58cd9f9c50bd3e9d577cee2d6abcb...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "recommendationReason": "High confidence score. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "VFYD3SRG9DYJDAHT2", "verifiedAt": "2026-02-06T10:18:33.439Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2025, "engineNumber": "3UR-FE730776", "macroEtching": false, "ownerIdDocId": "4da9d285-e7ea-4bfe-9341-37bea793f6f3", "vehicleColor": "Brown", "vehicleModel": "Corolla Altis", "vehiclePlate": "LKF-9216", "chassisNumber": "VFYD3SRG9DYJDAHT2", "extractedData": {"vin": "VFYD3SRG9DYJDAHT2", "source": "vehicle_metadata", "plateNumber": "LKF-9216", "engineNumber": "3UR-FE730776", "ocrExtracted": false, "chassisNumber": "VFYD3SRG9DYJDAHT2"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770373049358-591393085.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T10:17:30.280Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T10:17:30.275Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "80b71c43-1365-483a-918c-725b9b764a09", "hpgClearanceDocCid": "bafkreibsuwgnt6ofbpj6tvlxz3rnnk6lvzuxka36lj54eneplhxjigticu", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770373049299-671580688.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-9I7N66.pdf"}	2026-02-06 10:17:30.261561	2026-02-06 10:18:33.440108	MANUAL
f805b5d5-0e50-4ef7-8e2f-45ff7570e9f4	84a15919-868f-44f9-b9ed-141fdfb62529	insurance	PENDING	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:12.139265	21d178c0-37c5-466e-b2eb-560e32981cbd	\N	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"documents": [{"id": "dd653a1b-fd25-4b8d-900c-38a55f9e833e", "cid": "bafkreibt6jmftkjr3qzs7v5fdf2jtk25g2wxnx32fahppgheolryr3ojbm", "path": "/app/backend/uploads/document-1770379030143-808959547.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-7XUVA0.pdf"}], "ownerName": "Joshua Ivan Latag", "documentId": "dd653a1b-fd25-4b8d-900c-38a55f9e833e", "ownerEmail": "latagjoshuaivan@gmail.com", "vehicleVin": "9BL8DV2DCHUB2R2LT", "verifiedAt": null, "verifiedBy": "system", "documentCid": "bafkreibt6jmftkjr3qzs7v5fdf2jtk25g2wxnx32fahppgheolryr3ojbm", "vehicleMake": "Hyundai", "vehicleYear": 2022, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770379030143-808959547.pdf", "documentType": "insurance_cert", "vehicleModel": "Accent", "vehiclePlate": "XXT-6053", "documentFilename": "Insurance_Certificate_CTPL-2026-7XUVA0.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-7XUVA0"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-7XUVA0"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "33f25859a931dc332fd7a5197499ab5d...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}	2026-02-06 11:57:12.139265	2026-02-06 11:57:12.139265	MANUAL
f516e027-c014-4bb0-a3e0-55b6fea43cca	5735abaf-cd58-46ca-a6a5-0a864050ac8d	hpg	PENDING	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:59.214935	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	\N	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"documents": [{"id": "f6b66ade-d0b2-46eb-8c0e-0799a7c55fce", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770375838437-187096481.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "2d246bd7-2807-4691-8a8d-41bb1fe7c541", "cid": "bafkreiboejvz2pqsf3ntaeu6m6mptz3zdpgrytimqhczmn77l2stqn64rm", "path": "/app/backend/uploads/document-1770375838234-56032985.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-2R0PCX.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "2UM566CX7SXPANBXH", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2025, "engineNumber": "4GR-BE888155", "ownerIdDocId": "f6b66ade-d0b2-46eb-8c0e-0799a7c55fce", "vehicleColor": "Red", "vehicleModel": "Civic", "vehiclePlate": "DAS-2869", "chassisNumber": "2UM566CX7SXPANBXH", "extractedData": {"vin": "2UM566CX7SXPANBXH", "source": "vehicle_metadata", "plateNumber": "DAS-2869", "engineNumber": "4GR-BE888155", "ocrExtracted": false, "chassisNumber": "2UM566CX7SXPANBXH"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770375838437-187096481.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T11:03:59.231Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T11:03:59.227Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "2d246bd7-2807-4691-8a8d-41bb1fe7c541", "hpgClearanceDocCid": "bafkreiboejvz2pqsf3ntaeu6m6mptz3zdpgrytimqhczmn77l2stqn64rm", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770375838234-56032985.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-2R0PCX.pdf"}	2026-02-06 11:03:59.214935	2026-02-06 11:03:59.23195	MANUAL
8c69ba84-289b-4888-90c0-625ecddc802a	5735abaf-cd58-46ca-a6a5-0a864050ac8d	insurance	PENDING	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:59.32215	21d178c0-37c5-466e-b2eb-560e32981cbd	\N	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"documents": [{"id": "25d01d75-54d8-41c6-a3a9-a52055a18f03", "cid": "bafkreibhyvfdmi2zllgmcnpqslb5fkoq3v2gqx46xif6cocep7c4qkefha", "path": "/app/backend/uploads/document-1770375838411-426602788.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-T9OZB3.pdf"}], "ownerName": "Jasper Dulla", "documentId": "25d01d75-54d8-41c6-a3a9-a52055a18f03", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "2UM566CX7SXPANBXH", "verifiedAt": null, "verifiedBy": "system", "documentCid": "bafkreibhyvfdmi2zllgmcnpqslb5fkoq3v2gqx46xif6cocep7c4qkefha", "vehicleMake": "Honda", "vehicleYear": 2025, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770375838411-426602788.pdf", "documentType": "insurance_cert", "vehicleModel": "Civic", "vehiclePlate": "DAS-2869", "documentFilename": "Insurance_Certificate_CTPL-2026-T9OZB3.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-T9OZB3"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-T9OZB3"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "27c54a3623595accc135f092c3d2a9d0...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}	2026-02-06 11:03:59.32215	2026-02-06 11:03:59.32215	MANUAL
8599b486-b156-4f4e-8813-b3569d4aed51	84a15919-868f-44f9-b9ed-141fdfb62529	hpg	PENDING	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:12.040229	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	\N	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"documents": [{"id": "b0a17b98-b35e-400c-9651-aaa57934eaf2", "cid": "bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q", "path": "/app/backend/uploads/document-1770379030955-17684224.jpg", "type": "owner_id", "filename": "download (3).jpg"}, {"id": "ecaf0249-68c7-4176-86b9-49fc2afe4f05", "cid": "bafkreidcnrnzvplsjyeptn55hlbtqxiu5y4x6oofeukfwzyvg3fineic4q", "path": "/app/backend/uploads/document-1770379030031-491455223.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-VN74AN.pdf"}], "orCrDocId": null, "ownerName": "Joshua Ivan Latag", "orCrDocCid": null, "ownerEmail": "latagjoshuaivan@gmail.com", "vehicleVin": "9BL8DV2DCHUB2R2LT", "orCrDocPath": null, "vehicleMake": "Hyundai", "vehicleYear": 2022, "engineNumber": "1GR-DE857112", "ownerIdDocId": "b0a17b98-b35e-400c-9651-aaa57934eaf2", "vehicleColor": "Blue", "vehicleModel": "Accent", "vehiclePlate": "XXT-6053", "chassisNumber": "9BL8DV2DCHUB2R2LT", "extractedData": {"vin": "9BL8DV2DCHUB2R2LT", "source": "vehicle_metadata", "plateNumber": "XXT-6053", "engineNumber": "1GR-DE857112", "ocrExtracted": false, "chassisNumber": "9BL8DV2DCHUB2R2LT"}, "ownerIdDocCid": "bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q", "ownerIdDocPath": "/app/backend/uploads/document-1770379030955-17684224.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T11:57:12.053Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T11:57:12.050Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "ecaf0249-68c7-4176-86b9-49fc2afe4f05", "hpgClearanceDocCid": "bafkreidcnrnzvplsjyeptn55hlbtqxiu5y4x6oofeukfwzyvg3fineic4q", "ownerIdDocFilename": "download (3).jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770379030031-491455223.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-VN74AN.pdf"}	2026-02-06 11:57:12.040229	2026-02-06 11:57:12.053812	MANUAL
88438ed8-4194-47b9-8b89-078faf491385	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:55.043365	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-06 13:05:55.047258	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "4b720289-a2ef-4598-aa2b-b2a13f8a16aa", "cid": "bafkreibpeg2fbrubu3hopypodxl2nsufij25cqiwhqxcc6qli4dhv77sbq", "path": "/app/backend/uploads/document-1770383153269-317880937.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-LG58U4.pdf"}], "ownerName": "Jasper Dulla", "documentId": "4b720289-a2ef-4598-aa2b-b2a13f8a16aa", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "MFXJMZV6W8DWZ8TGK", "verifiedAt": "2026-02-06T13:05:55.046Z", "verifiedBy": "system", "documentCid": "bafkreibpeg2fbrubu3hopypodxl2nsufij25cqiwhqxcc6qli4dhv77sbq", "vehicleMake": "Honda", "vehicleYear": 2022, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770383153269-317880937.pdf", "documentType": "insurance_cert", "vehicleModel": "Civic", "vehiclePlate": "BXY-6090", "documentFilename": "Insurance_Certificate_CTPL-2026-LG58U4.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-LG58U4"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-LG58U4"}, "compositeHash": "4efd16f82e7a2188a1957c00bffec478c6cf4a6af48616a672f66761ebaf0ae8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "2f21b450c681a6cee7e1ee1dd7a6ca854275d141163c2e217a0b47067afff20c", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "37269faa-adc9-4cef-9872-e4d62c742e7d", "originalCompositeHash": "b5fa0658a59d7bc650e76e1ad1b1373c1eb0dcf0c4176d51e9812e2687d8310b", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-LG58U4"}}}	2026-02-06 13:05:55.043365	2026-02-06 13:05:55.047258	MANUAL
396fa651-54b6-4bfe-bcec-aee68d7a65c9	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:54.15175	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-06 13:07:30.941529	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "c7e31259-8d9f-49e7-9255-8eb18f235621", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770383153272-634326650.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "2f5f68d7-1a06-49bc-a7b8-73da641b9b6d", "cid": "bafkreieqpe53len4vrli7oh3sxa5vvgnofe7xabefdtv4f5glsvvrimlae", "path": "/app/backend/uploads/document-1770383153113-848224931.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-902GBI.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-06T13:07:23.469Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "42f913183652888db7731da9ce536f30afb16aa3f4318ac0c81b0a2bd60aab0d", "preFilledData": {"engineNumber": "3UR-BE565637", "chassisNumber": "MFXJMZV6W8DWZ8TGK"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 100, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "90793bb591bcac568fb8fb95c1dad4cd7149fb802428e75e17a65cab58a18b01", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "01b5e5fb-ec20-409c-a21d-9d28ab8cedf1", "originalCompositeHash": "2d02d2ab5a8ec393ae731946176df0e5298de867c433ac36413befe7d6e39981", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-902GBI"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "MFXJMZV6W8DWZ8TGK", "verifiedAt": "2026-02-06T13:07:30.941Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2022, "engineNumber": "3UR-BE565637", "macroEtching": false, "ownerIdDocId": "c7e31259-8d9f-49e7-9255-8eb18f235621", "vehicleColor": "Red", "vehicleModel": "Civic", "vehiclePlate": "BXY-6090", "chassisNumber": "MFXJMZV6W8DWZ8TGK", "extractedData": {"vin": "MFXJMZV6W8DWZ8TGK", "source": "vehicle_metadata", "plateNumber": "BXY-6090", "engineNumber": "3UR-BE565637", "ocrExtracted": false, "chassisNumber": "MFXJMZV6W8DWZ8TGK"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770383153272-634326650.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T13:05:54.168Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T13:05:54.165Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "2f5f68d7-1a06-49bc-a7b8-73da641b9b6d", "hpgClearanceDocCid": "bafkreieqpe53len4vrli7oh3sxa5vvgnofe7xabefdtv4f5glsvvrimlae", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770383153113-848224931.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-902GBI.pdf"}	2026-02-06 13:05:54.15175	2026-02-06 13:07:30.941529	MANUAL
d1f7229f-a7e5-4262-a816-9d6b4f35fc57	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	insurance	APPROVED	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:53.077119	\N	2026-02-06 13:11:53.405946	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "9a828788-8d74-4746-aacb-b9a0ebe17cce", "cid": "bafkreifm66532pcser3lwur3kku5ycbayee5yrp43qrantkwh3adqtnb54", "path": "/app/backend/uploads/document-1770383494902-890775357.pdf", "type": "insurance_cert", "filename": "CTPL_Insurance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf"}], "documentId": "9a828788-8d74-4746-aacb-b9a0ebe17cce", "vehicleVin": "MFXJMZV6W8DWZ8TGK", "verifiedAt": "2026-02-06T13:11:53.405Z", "verifiedBy": "system", "documentCid": "bafkreifm66532pcser3lwur3kku5ycbayee5yrp43qrantkwh3adqtnb54", "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770383494902-890775357.pdf", "documentType": "insurance_cert", "vehiclePlate": "BXY-6090", "autoTriggered": true, "documentFilename": "CTPL_Insurance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf", "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-QKLLA4"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-QKLLA4"}, "compositeHash": "d11b7e7b66ef15c93c7c8e0c96001afeb441d05478cb9d333511b6d33c86b7d2", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "acf7bbbd3c522476bb523b52a9dc0820c109dc45fcdc2206cd563ec0384da1ef", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "20c8ff96-0583-4075-8424-5be7f914598d", "originalCompositeHash": "dabaf5cda836288b26feffd4570e70a750c251a31dbf9189603652150260648c", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-QKLLA4"}}}	2026-02-06 13:11:53.077119	2026-02-06 13:11:53.405946	MANUAL
b29a9117-a0f1-4722-90d7-c66df0f7350b	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	hpg	APPROVED	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:52.938206	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:16:28.894529	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "c9bc9efb-c834-4ce5-b834-9177cec096aa", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770383424841-615213025.jpg", "type": "seller_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "91398931-e41f-462b-bf77-f5325d017acc", "cid": "bafkreiduvx4v74fpiqxg4ce5ctwu7xqhjbywogfiakhp2o6sghqkfrcaeu", "path": "/app/backend/uploads/document-1770383491046-278769205.pdf", "type": "buyer_hpg_clearance", "filename": "HPG_Clearance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf"}], "orCrDocId": null, "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-06T13:13:36.077Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "7ea2b7446ee4d0a5daa712532bf7dd728694c30336e7804e44229076f3fb2976", "preFilledData": {"engineNumber": "3UR-BE565637", "chassisNumber": "MFXJMZV6W8DWZ8TGK"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "bb20b338-548e-45f6-b4f3-f0826db71256", "originalCompositeHash": "4e55e7a8b256bb958cf652c1c84ee62c5b7f14670f55d42a8706fd2e25799747", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-MTR0GI"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "vehicleVin": "MFXJMZV6W8DWZ8TGK", "verifiedAt": "2026-02-06T13:16:28.894Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2022, "engineNumber": "3UR-BE565637", "macroEtching": false, "ownerIdDocId": "c9bc9efb-c834-4ce5-b834-9177cec096aa", "vehicleColor": "Red", "vehicleModel": "Civic", "vehiclePlate": "BXY-6090", "autoTriggered": true, "buyerHpgDocId": "91398931-e41f-462b-bf77-f5325d017acc", "chassisNumber": "MFXJMZV6W8DWZ8TGK", "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "buyerHpgDocCid": "bafkreiduvx4v74fpiqxg4ce5ctwu7xqhjbywogfiakhp2o6sghqkfrcaeu", "ownerIdDocPath": "/app/backend/uploads/document-1770383424841-615213025.jpg", "buyerHpgDocPath": "/app/backend/uploads/document-1770383491046-278769205.pdf", "orCrDocFilename": null, "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "buyerHpgDocFilename": "HPG_Clearance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf"}	2026-02-06 13:11:52.938206	2026-02-06 13:16:28.900942	MANUAL
9e42647b-a8e8-4265-962f-a2f434a9a9b7	aac4dc07-379b-4cdc-9250-6e80aaed676a	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:24.673627	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-06 14:13:24.676548	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "56ddfb75-fb58-48b5-96cc-08e81673315e", "cid": "bafkreihoxxdethgcgpaygqffpriyyy6qnbnohztyq34fzvphuyj6mrb2wq", "path": "/app/backend/uploads/document-1770387203394-534782498.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-CE1WZR.pdf"}], "ownerName": "Jasper Dulla", "documentId": "56ddfb75-fb58-48b5-96cc-08e81673315e", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "3FTF50PTKHZ8EA715", "verifiedAt": "2026-02-06T14:13:24.675Z", "verifiedBy": "system", "documentCid": "bafkreihoxxdethgcgpaygqffpriyyy6qnbnohztyq34fzvphuyj6mrb2wq", "vehicleMake": "Mitsubishi", "vehicleYear": 2022, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770387203394-534782498.pdf", "documentType": "insurance_cert", "vehicleModel": "Mirage G4", "vehiclePlate": "CCW-6129", "documentFilename": "Insurance_Certificate_CTPL-2026-CE1WZR.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-CE1WZR"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-CE1WZR"}, "compositeHash": "0b596022d7355807ee2e46e7607263a8166698fab1222fe2892fda89264f69da", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "eebdc6499cc233c18340a57c518c63d0685ae3e67886f85cd5e7a613e6443ab4", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "1d67820e-b6d8-4929-a59f-6fa9f6fe4e52", "originalCompositeHash": "cc54ca17aefd03100b413c9962397293595bdc0a67e63d2262f30b41c9c1c2f4", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-CE1WZR"}}}	2026-02-06 14:13:24.673627	2026-02-06 14:13:24.676548	MANUAL
2d98d0f6-89d3-4889-aa5c-ddbd613d40bb	aac4dc07-379b-4cdc-9250-6e80aaed676a	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:24.293101	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-06 14:15:23.669372	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "ef5c6653-6d3c-48c1-ab98-207e6eca992d", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770387203373-583679546.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "356252da-5145-4e17-96db-cd3ed6d5885d", "cid": "bafkreig3iegcnvggrkxvji5zpd42y46ms6fpyrmphved6t2in3fc3axhsa", "path": "/app/backend/uploads/document-1770387203305-268621139.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-IC1WZW.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-06T14:14:42.200Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "93e41060d18aed542e1b614c5d309a498054684a951554804ec1bb016316deca", "preFilledData": {"engineNumber": "4GR-CE483859", "chassisNumber": "3FTF50PTKHZ8EA715"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "4GR-CE483859", "vehiclePlate": "CCW-6129", "chassisNumber": "WLVFCY822FNW0L0E", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "db410c26d4c68aaf54a3b978f9ac73cc978afc458f3d483f4f486eca2d82e790", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "6e4d03ca-fca9-4376-b353-499798542a5c", "originalCompositeHash": "08dedbaaf2ac282330097f97ab210fe3750cefc8154cd8be27da6dbc308569cc", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IC1WZW"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "3FTF50PTKHZ8EA715", "verifiedAt": "2026-02-06T14:15:23.668Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Mitsubishi", "vehicleYear": 2022, "engineNumber": "4GR-CE483859", "macroEtching": false, "ownerIdDocId": "ef5c6653-6d3c-48c1-ab98-207e6eca992d", "vehicleColor": "Brown", "vehicleModel": "Mirage G4", "vehiclePlate": "CCW-6129", "chassisNumber": "3FTF50PTKHZ8EA715", "extractedData": {"vin": "3FTF50PTKHZ8EA715", "source": "vehicle_metadata", "plateNumber": "CCW-6129", "engineNumber": "4GR-CE483859", "ocrExtracted": false, "chassisNumber": "3FTF50PTKHZ8EA715"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770387203373-583679546.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T14:13:24.308Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T14:13:24.305Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "356252da-5145-4e17-96db-cd3ed6d5885d", "hpgClearanceDocCid": "bafkreig3iegcnvggrkxvji5zpd42y46ms6fpyrmphved6t2in3fc3axhsa", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770387203305-268621139.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-IC1WZW.pdf"}	2026-02-06 14:13:24.293101	2026-02-06 14:15:23.669372	MANUAL
c7eb6483-24c3-48aa-99e3-e0ab741597c6	c8babe0e-e748-4942-9025-53c1600a476f	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:52.376344	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-06 16:18:35.65631	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "5fb90591-9982-4d9e-898f-b23b64a984dd", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770394551553-317877638.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "8dc6170e-0196-4524-825d-d6b2d9ba085b", "cid": "bafkreiaanqxcdii4ud52x2eb3dakcmelttap2evwqk2m6z4mah33fvmhau", "path": "/app/backend/uploads/document-1770394551482-851636087.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-WML72K.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-06T16:17:59.305Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "6f489daf749ccf12d2c6079a342e98b87ddfae05bc5c3e8c68ce46074f124f46", "preFilledData": {"engineNumber": "5VZ-FE275580", "chassisNumber": "9S2T7H6CLA91ZMYU5"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "5VZ-FE275580", "vehiclePlate": "EPP-8740", "chassisNumber": "SHWA7GZSPP2G9YFK", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "006c2e21a11ca0fbabe881d8c0a1308b9cc0fd12b682b4cf678c01f7b2d58705", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a9d62036-57cb-41b6-94bc-45290967c6e7", "originalCompositeHash": "f649cf3c349fd3602e13a62bfbe49b824cd5a85d12009b52b88762d5bd954aa9", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-WML72K"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "9S2T7H6CLA91ZMYU5", "verifiedAt": "2026-02-06T16:18:35.655Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "5VZ-FE275580", "macroEtching": false, "ownerIdDocId": "5fb90591-9982-4d9e-898f-b23b64a984dd", "vehicleColor": "Silver", "vehicleModel": "Hilux", "vehiclePlate": "EPP-8740", "chassisNumber": "9S2T7H6CLA91ZMYU5", "extractedData": {"vin": "9S2T7H6CLA91ZMYU5", "source": "vehicle_metadata", "plateNumber": "EPP-8740", "engineNumber": "5VZ-FE275580", "ocrExtracted": false, "chassisNumber": "9S2T7H6CLA91ZMYU5"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770394551553-317877638.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T16:15:52.394Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T16:15:52.390Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "8dc6170e-0196-4524-825d-d6b2d9ba085b", "hpgClearanceDocCid": "bafkreiaanqxcdii4ud52x2eb3dakcmelttap2evwqk2m6z4mah33fvmhau", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770394551482-851636087.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-WML72K.pdf"}	2026-02-06 16:15:52.376344	2026-02-06 16:18:35.65631	MANUAL
8861c975-2b6b-4ae0-af49-a679e7e5f617	9227a1b3-9b77-4506-a2c5-068827b86f6d	hpg	PENDING	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 12:43:15.545731	\N	\N	\N	Vehicle ownership transfer clearance	Forwarded for HPG clearance review	{"documents": [{"id": "dd4c74af-79de-415b-abca-210d7686e2be", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770467696446-359824845.jpg", "type": "seller_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}], "orCrDocId": null, "autoVerify": {"completed": true, "hashCheck": {}, "completedAt": "2026-02-07T12:47:14.527Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": null, "preFilledData": {}, "recommendation": "MANUAL_REVIEW", "scoreBreakdown": {}, "confidenceScore": 0, "authenticityCheck": {}, "recommendationReason": ""}, "orCrDocCid": null, "vehicleVin": "TE6ATEHZNKBY6N2EK", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "1GR-BE500494", "ownerIdDocId": "dd4c74af-79de-415b-abca-210d7686e2be", "vehicleColor": "Pearl White", "vehicleModel": "Corolla Altis", "vehiclePlate": "CBY-9590", "autoTriggered": false, "buyerHpgDocId": null, "chassisNumber": "TE6ATEHZNKBY6N2EK", "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "buyerHpgDocCid": null, "ownerIdDocPath": "/app/backend/uploads/document-1770467696446-359824845.jpg", "buyerHpgDocPath": null, "orCrDocFilename": null, "automationPhase1": {"completed": true, "isTransfer": true, "completedAt": "2026-02-07T12:43:15.557Z", "ocrExtracted": false, "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T12:43:15.552Z", "matchedRecords": [], "recommendation": "PROCEED"}, "transferRequestId": "f4073003-69fb-4b39-aef1-a58f65bbd373", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "buyerHpgDocFilename": null}	2026-02-07 12:43:15.545731	2026-02-07 12:47:14.527719	MANUAL
7a411501-4663-41c3-9328-da6cb9ffe2d3	c8babe0e-e748-4942-9025-53c1600a476f	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:53.101563	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-06 16:15:53.107078	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "12d29645-ed1a-4430-9479-929eee59b043", "cid": "bafkreif66dxomggd2iisxkxkpczddq3eemruouefiudfiwe5dkvhnawuam", "path": "/app/backend/uploads/document-1770394551579-489333329.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-OGQYZB.pdf"}], "ownerName": "Jasper Dulla", "documentId": "12d29645-ed1a-4430-9479-929eee59b043", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "9S2T7H6CLA91ZMYU5", "verifiedAt": "2026-02-06T16:15:53.106Z", "verifiedBy": "system", "documentCid": "bafkreif66dxomggd2iisxkxkpczddq3eemruouefiudfiwe5dkvhnawuam", "vehicleMake": "Toyota", "vehicleYear": 2024, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770394551579-489333329.pdf", "documentType": "insurance_cert", "vehicleModel": "Hilux", "vehiclePlate": "EPP-8740", "documentFilename": "Insurance_Certificate_CTPL-2026-OGQYZB.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-OGQYZB"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-OGQYZB"}, "compositeHash": "81dae3a78cfc37c48eb75717cb210eb680875b8ae2d56e04f8dde35146e48931", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "bef0eee618c3d2112baaea78b231c3642323475085450654589d1aaa7682d403", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "e3908a11-7aa7-41f8-b718-59f2f0cd1651", "originalCompositeHash": "097e2b5e5b5de0bc5afcdd567d9dc939b8c12211d65c03f9bc0c14c2ae2e3c22", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-OGQYZB"}}}	2026-02-06 16:15:53.101563	2026-02-06 16:15:53.107078	MANUAL
7093be2c-da08-4937-8dc2-9a334650ee1d	c8babe0e-e748-4942-9025-53c1600a476f	insurance	APPROVED	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:24.328023	\N	2026-02-06 16:24:25.091703	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "0e02102b-9ff6-43a3-a266-d8b3ffbf9d70", "cid": "bafkreidp6r5mxjya7subhkkmt24u7of4awzkkt6yh5pisa4lpiwc4xfczi", "path": "/app/backend/uploads/document-1770395060756-778808974.pdf", "type": "insurance_cert", "filename": "CTPL_Insurance_c8babe0e-e748-4942-9025-53c1600a476f.pdf"}], "documentId": "0e02102b-9ff6-43a3-a266-d8b3ffbf9d70", "vehicleVin": "9S2T7H6CLA91ZMYU5", "verifiedAt": "2026-02-06T16:24:25.091Z", "verifiedBy": "system", "documentCid": "bafkreidp6r5mxjya7subhkkmt24u7of4awzkkt6yh5pisa4lpiwc4xfczi", "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770395060756-778808974.pdf", "documentType": "insurance_cert", "vehiclePlate": "EPP-8740", "autoTriggered": true, "documentFilename": "CTPL_Insurance_c8babe0e-e748-4942-9025-53c1600a476f.pdf", "transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-1FIN66"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-1FIN66"}, "compositeHash": "9fe70af7bd1b06830986c15eec1cc84977c79bce46ed6dbce424e6b368e66f6c", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "6ff47acba700fca813a94c9eb94fb8bc05b2a54fd83f5e89038b7a2c2e5ca2ca", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "36dcf63f-5e9c-4c04-88a6-1d168689d3c2", "originalCompositeHash": "4695c416f7dacbfac76ff0318f0adde024c625f3dd57e296463421150002fcbb", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-1FIN66"}}}	2026-02-06 16:24:24.328023	2026-02-06 16:24:25.091703	MANUAL
42c35d63-5f06-49e2-afbe-48fc1b7695d7	47916952-a48c-486a-8421-014905e38968	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:51.283137	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-06 17:22:56.647775	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "116a4497-aff3-47ff-ac49-f02cbb16c2cb", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770398270016-575971889.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "31e0bda2-0c74-4132-9eef-228c911c9d4d", "cid": "bafkreiejecsknb4xnb746oripjsnjbt4e6hfof2ce56r64fuks5sxalatm", "path": "/app/backend/uploads/document-1770398269958-448241581.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-IQ7T5V.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-06T17:19:42.517Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "3e06b0d8b1b264a15f570ff6dc6b3f635dc1e28a8c2c3735f07f92f529a2a81c", "preFilledData": {"engineNumber": "5VZ-CE605906", "chassisNumber": "LMJH22V3X6MPEM2VU"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "5VZ-CE605906", "vehiclePlate": "EUE-5843", "chassisNumber": "PMASNRXCUS", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "8920a4a68797687fcf3a287a64d4867c278e571742277d1f70b454bb2b81609b", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "abb52dec-743c-4a1c-96d7-65e27f2c0746", "originalCompositeHash": "9947ef1c96172ef2a3674b2bc8c30a3ce6554aa1c8e48fa2a443b7a3ce06a5fa", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IQ7T5V"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "LMJH22V3X6MPEM2VU", "verifiedAt": "2026-02-06T17:22:56.647Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "5VZ-CE605906", "macroEtching": false, "ownerIdDocId": "116a4497-aff3-47ff-ac49-f02cbb16c2cb", "vehicleColor": "Pearl White", "vehicleModel": "City", "vehiclePlate": "EUE-5843", "chassisNumber": "LMJH22V3X6MPEM2VU", "extractedData": {"vin": "LMJH22V3X6MPEM2VU", "source": "vehicle_metadata", "plateNumber": "EUE-5843", "engineNumber": "5VZ-CE605906", "ocrExtracted": false, "chassisNumber": "LMJH22V3X6MPEM2VU"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770398270016-575971889.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-06T17:17:51.299Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T17:17:51.296Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "31e0bda2-0c74-4132-9eef-228c911c9d4d", "hpgClearanceDocCid": "bafkreiejecsknb4xnb746oripjsnjbt4e6hfof2ce56r64fuks5sxalatm", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770398269958-448241581.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-IQ7T5V.pdf"}	2026-02-06 17:17:51.283137	2026-02-06 17:22:56.647775	MANUAL
59496941-6874-473a-a9d1-84b16f1eeda5	c8babe0e-e748-4942-9025-53c1600a476f	hpg	PENDING	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:24.084942	\N	\N	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"documents": [{"id": "1178cf62-2cb3-4756-b004-aaa2ff418437", "cid": "bafybeia2mkkeb6vgjdtbdzk4ofkjrposopipvgwkmid2t27kjk3epm5lse", "path": "/app/backend/uploads/document-1770394992589-131359234.png", "type": "seller_id", "filename": "sales-invoice.png"}, {"id": "023698c1-3747-47df-af38-bae074d03846", "cid": "bafkreibbdfc2i4edncyd6scpaz2k3t75ehdrgdkgiz3huiodvhpkcyrs5a", "path": "/app/backend/uploads/document-1770395057032-500539986.pdf", "type": "buyer_hpg_clearance", "filename": "HPG_Clearance_c8babe0e-e748-4942-9025-53c1600a476f.pdf"}], "orCrDocId": null, "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-07T11:38:12.067Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "0c02d75f47bab18cfbd3a520f1bbf0f95c4d9626ddfdcb07ef214565e1364606", "preFilledData": {"engineNumber": "5VZ-FE275580", "chassisNumber": "9S2T7H6CLA91ZMYU5"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a41dc51e-66ad-42b7-a075-07f688f91ff9", "originalCompositeHash": "491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-FBBRI9"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "vehicleVin": "9S2T7H6CLA91ZMYU5", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "5VZ-FE275580", "ownerIdDocId": "1178cf62-2cb3-4756-b004-aaa2ff418437", "vehicleColor": "Silver", "vehicleModel": "Hilux", "vehiclePlate": "EPP-8740", "autoTriggered": true, "buyerHpgDocId": "023698c1-3747-47df-af38-bae074d03846", "chassisNumber": "9S2T7H6CLA91ZMYU5", "ownerIdDocCid": "bafybeia2mkkeb6vgjdtbdzk4ofkjrposopipvgwkmid2t27kjk3epm5lse", "buyerHpgDocCid": "bafkreibbdfc2i4edncyd6scpaz2k3t75ehdrgdkgiz3huiodvhpkcyrs5a", "ownerIdDocPath": "/app/backend/uploads/document-1770394992589-131359234.png", "buyerHpgDocPath": "/app/backend/uploads/document-1770395057032-500539986.pdf", "orCrDocFilename": null, "transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "ownerIdDocFilename": "sales-invoice.png", "buyerHpgDocFilename": "HPG_Clearance_c8babe0e-e748-4942-9025-53c1600a476f.pdf"}	2026-02-06 16:24:24.084942	2026-02-07 11:38:12.068383	MANUAL
159ef0a6-d912-4bcb-ae3c-6bc6d19acd85	47916952-a48c-486a-8421-014905e38968	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:51.714894	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-06 17:17:51.71847	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "af65b42a-981f-468f-b781-09215825ae73", "cid": "bafkreigvzmimdv6yg26iulve5wxpiijfu4fodixbxzrx37iktxskcxaxxi", "path": "/app/backend/uploads/document-1770398270034-881915683.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-F8L8LU.pdf"}], "ownerName": "Jasper Dulla", "documentId": "af65b42a-981f-468f-b781-09215825ae73", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "LMJH22V3X6MPEM2VU", "verifiedAt": "2026-02-06T17:17:51.718Z", "verifiedBy": "system", "documentCid": "bafkreigvzmimdv6yg26iulve5wxpiijfu4fodixbxzrx37iktxskcxaxxi", "vehicleMake": "Honda", "vehicleYear": 2023, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770398270034-881915683.pdf", "documentType": "insurance_cert", "vehicleModel": "City", "vehiclePlate": "EUE-5843", "documentFilename": "Insurance_Certificate_CTPL-2026-F8L8LU.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-F8L8LU"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-F8L8LU"}, "compositeHash": "99e06767daf95a10f926166b01b953cbb639c705464fa73cc786796461256184", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "d5cb10c1d7d836bc8a2ea4edaef42125a70ae1a2e1be637dfd0a9de4a15c17ba", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "9477adfb-8636-44c1-91fc-bbd460564788", "originalCompositeHash": "2880f16f4aef9d8f9cda4a1b96a717e096b68fa99d6cbe7e183ab1c4937de385", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-F8L8LU"}}}	2026-02-06 17:17:51.714894	2026-02-06 17:17:51.71847	MANUAL
a72838df-accd-46ba-8c74-536ffaaa6550	ed358d5a-ac0d-4a12-b593-8251152c9457	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.777766	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-07 08:20:00.097292	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "881d2a45-c32f-4ec8-aeb9-0b2b742ee065", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770452324058-373998127.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "90a99c50-422e-4ae9-a613-7bd32e10d577", "cid": "bafkreiaxbmonvycb3jf2uurlwok5t2klq5jczd5osmbxpvihybv4cvpohy", "path": "/app/backend/uploads/document-1770452323934-542495295.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-NVJX05.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-07T08:19:32.145Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "69d37c0a155e2a9ce3bc32948c0b03366134b6d8ba728a5b5f80a8d0c6dc902e", "preFilledData": {"engineNumber": "3UR-FE462946", "chassisNumber": "7MTTNKS3BFKW7384D"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "3UR-FE462946", "vehiclePlate": "TZK-5341", "chassisNumber": "H8CVHKLX8C4", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "170b1cdae041da4baa522bb395d9e94b87522c8fae930377d507c06bc155ee3e", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "07c3f547-0ebf-4c19-b9d3-268c943dc280", "originalCompositeHash": "9162ec9abb484b78034e64b5ffc107e60024ea94e092362e69af970f568d50ae", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-NVJX05"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "7MTTNKS3BFKW7384D", "verifiedAt": "2026-02-07T08:20:00.097Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "3UR-FE462946", "macroEtching": false, "ownerIdDocId": "881d2a45-c32f-4ec8-aeb9-0b2b742ee065", "vehicleColor": "Blue", "vehicleModel": "Click 125", "vehiclePlate": "TZK-5341", "chassisNumber": "7MTTNKS3BFKW7384D", "extractedData": {"vin": "7MTTNKS3BFKW7384D", "source": "vehicle_metadata", "plateNumber": "TZK-5341", "engineNumber": "3UR-FE462946", "ocrExtracted": false, "chassisNumber": "7MTTNKS3BFKW7384D"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770452324058-373998127.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-07T08:18:44.792Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T08:18:44.789Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "90a99c50-422e-4ae9-a613-7bd32e10d577", "hpgClearanceDocCid": "bafkreiaxbmonvycb3jf2uurlwok5t2klq5jczd5osmbxpvihybv4cvpohy", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770452323934-542495295.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-NVJX05.pdf"}	2026-02-07 08:18:44.777766	2026-02-07 08:20:00.097292	MANUAL
3d2b1814-66f5-4c7b-8d95-44892ce036c7	ed358d5a-ac0d-4a12-b593-8251152c9457	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:45.517701	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-07 08:18:45.522179	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "fefd5349-74ae-4f3b-8c76-b44e7dab2903", "cid": "bafkreihwcg6bq2j3a3w5hwd5yjbdg43asx3vcjiwksilenqniwmiywjsye", "path": "/app/backend/uploads/document-1770452323887-352497392.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-2JJ4CI.pdf"}], "ownerName": "Jasper Dulla", "documentId": "fefd5349-74ae-4f3b-8c76-b44e7dab2903", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "7MTTNKS3BFKW7384D", "verifiedAt": "2026-02-07T08:18:45.521Z", "verifiedBy": "system", "documentCid": "bafkreihwcg6bq2j3a3w5hwd5yjbdg43asx3vcjiwksilenqniwmiywjsye", "vehicleMake": "Honda", "vehicleYear": 2023, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770452323887-352497392.pdf", "documentType": "insurance_cert", "vehicleModel": "Click 125", "vehiclePlate": "TZK-5341", "documentFilename": "Insurance_Certificate_CTPL-2026-2JJ4CI.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-2JJ4CI"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-2JJ4CI"}, "compositeHash": "dceb461feec33799b146b3aa06e6a2e88046567677c81a358775f5cb360c34fb", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "f611bc18693b06edd3d87dc24233736095f75125165490b2360d45988c5932c1", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "5384cf02-c718-4ffd-8742-9b04f7d8f855", "originalCompositeHash": "228b0a481de9fb22972792274d4c5aff6ace18587b477351fbc4758e26e50d7b", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-2JJ4CI"}}}	2026-02-07 08:18:45.517701	2026-02-07 08:18:45.522179	MANUAL
eff2f865-53f8-4a38-a14a-376edf0e06c2	9227a1b3-9b77-4506-a2c5-068827b86f6d	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:43.723609	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-07 11:54:43.726942	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "4d40a661-42f9-4eb8-baf2-4a6f98696111", "cid": "bafkreiakgwyq4hrltr47oos2jqn3r2xzkvabaveik6ehrvlycevhouh7gu", "path": "/app/backend/uploads/document-1770465282200-297485345.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-IOQ9U2.pdf"}], "ownerName": "Jasper Dulla", "documentId": "4d40a661-42f9-4eb8-baf2-4a6f98696111", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "TE6ATEHZNKBY6N2EK", "verifiedAt": "2026-02-07T11:54:43.726Z", "verifiedBy": "system", "documentCid": "bafkreiakgwyq4hrltr47oos2jqn3r2xzkvabaveik6ehrvlycevhouh7gu", "vehicleMake": "Toyota", "vehicleYear": 2024, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770465282200-297485345.pdf", "documentType": "insurance_cert", "vehicleModel": "Corolla Altis", "vehiclePlate": "CBY-9590", "documentFilename": "Insurance_Certificate_CTPL-2026-IOQ9U2.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-IOQ9U2"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-IOQ9U2"}, "compositeHash": "e3c36f396a8e4ff5a0a2f6b8c513fcde450a4009df2108bb3cfa10950daba7a8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "0a35b10e1e2b9c79f73a5a4c1bb8eaf95540105488578878d578112a7750ff35", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "4ca9844c-b5a1-464f-ad72-a60dfbedc5af", "originalCompositeHash": "7d580f2e796d76bb889c6076365c905d52476e30d0787eff65cccd415f8580b9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-IOQ9U2"}}}	2026-02-07 11:54:43.723609	2026-02-07 11:54:43.726942	MANUAL
08c3c8cc-8319-4b65-8ab7-2480d732cb25	ed358d5a-ac0d-4a12-b593-8251152c9457	hpg	APPROVED	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:00.543265	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:27:01.790028	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "d9bacc27-7a98-4798-b895-41da53f1857d", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770452716546-883041460.jpg", "type": "seller_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "f1ae7553-08be-4045-94f7-fc803305947e", "cid": "bafkreidzthapgtjdghsu3jnb5b6rg2zf75rpzdaivizwkshjnfftnspo7i", "path": "/app/backend/uploads/document-1770452751362-846854512.pdf", "type": "buyer_hpg_clearance", "filename": "HPG_Clearance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf"}], "orCrDocId": null, "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-07T12:47:09.114Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "c058b12e9062a32c78fdbe5149326945420d13d818a6c95d573b0f859deca768", "preFilledData": {"engineNumber": "3UR-FE462946", "chassisNumber": "7MTTNKS3BFKW7384D"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "3597ba63-34b2-4c00-b51d-d18102fb1c87", "originalCompositeHash": "adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-BS5LYT"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "vehicleVin": "7MTTNKS3BFKW7384D", "verifiedAt": "2026-02-07T08:27:01.789Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "3UR-FE462946", "macroEtching": false, "ownerIdDocId": "d9bacc27-7a98-4798-b895-41da53f1857d", "vehicleColor": "Blue", "vehicleModel": "Click 125", "vehiclePlate": "TZK-5341", "autoTriggered": true, "buyerHpgDocId": "f1ae7553-08be-4045-94f7-fc803305947e", "chassisNumber": "7MTTNKS3BFKW7384D", "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "buyerHpgDocCid": "bafkreidzthapgtjdghsu3jnb5b6rg2zf75rpzdaivizwkshjnfftnspo7i", "ownerIdDocPath": "/app/backend/uploads/document-1770452716546-883041460.jpg", "buyerHpgDocPath": "/app/backend/uploads/document-1770452751362-846854512.pdf", "orCrDocFilename": null, "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "buyerHpgDocFilename": "HPG_Clearance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf"}	2026-02-07 08:26:00.543265	2026-02-07 12:47:09.114854	MANUAL
9eccfa85-7b83-4278-8c58-75fb3466f39a	9227a1b3-9b77-4506-a2c5-068827b86f6d	insurance	PENDING	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 12:43:18.552092	\N	\N	\N	Vehicle ownership transfer clearance	Forwarded for Insurance clearance review	{"documents": [], "documentId": null, "vehicleVin": "TE6ATEHZNKBY6N2EK", "documentCid": null, "documentPath": null, "documentType": null, "vehiclePlate": "CBY-9590", "autoTriggered": false, "documentFilename": null, "transferRequestId": "f4073003-69fb-4b39-aef1-a58f65bbd373"}	2026-02-07 12:43:18.552092	2026-02-07 12:43:18.552092	MANUAL
56f87e5c-777a-4b6d-ac0f-882f9bb138ad	9227a1b3-9b77-4506-a2c5-068827b86f6d	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:43.031165	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-07 11:59:32.510478	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "4ea70109-9838-4d82-bc7a-c1d326f7e89a", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770465282164-844135389.jpg", "type": "owner_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "580843d6-7d9b-4b2c-88c9-b1c26fbc8a76", "cid": "bafkreieqhphndpjiodylhdtslkh3icuob6w3seqsxm4hsffw67g2o3onba", "path": "/app/backend/uploads/document-1770465282087-791143146.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-DL6BGF.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-07T11:58:17.360Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "2adb86be0f3bdf2caee9e9163d7fe1f2c719908304a2e983733499a65acda536", "preFilledData": {"engineNumber": "1GR-BE500494", "chassisNumber": "TE6ATEHZNKBY6N2EK"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "1GR-BE500494", "vehiclePlate": "CBY-9590", "chassisNumber": "0YAF3MYMVL212", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "903bced1bd2870f0b38e725a8fb40a8e0fadb91212bb387914b6f7cda76dcd08", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "8ee1704a-6e13-4ddf-a8dd-7d7004bf2092", "originalCompositeHash": "e18e166c3c7cdf9a4cff914163d340e0a5dfb22553c65154fafa1f1d22c7db9a", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-DL6BGF"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "TE6ATEHZNKBY6N2EK", "verifiedAt": "2026-02-07T11:59:32.510Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "1GR-BE500494", "macroEtching": false, "ownerIdDocId": "4ea70109-9838-4d82-bc7a-c1d326f7e89a", "vehicleColor": "Pearl White", "vehicleModel": "Corolla Altis", "vehiclePlate": "CBY-9590", "chassisNumber": "TE6ATEHZNKBY6N2EK", "extractedData": {"vin": "TE6ATEHZNKBY6N2EK", "source": "vehicle_metadata", "plateNumber": "CBY-9590", "engineNumber": "1GR-BE500494", "ocrExtracted": false, "chassisNumber": "TE6ATEHZNKBY6N2EK"}, "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "ownerIdDocPath": "/app/backend/uploads/document-1770465282164-844135389.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-07T11:54:43.044Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T11:54:43.041Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "580843d6-7d9b-4b2c-88c9-b1c26fbc8a76", "hpgClearanceDocCid": "bafkreieqhphndpjiodylhdtslkh3icuob6w3seqsxm4hsffw67g2o3onba", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770465282087-791143146.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-DL6BGF.pdf"}	2026-02-07 11:54:43.031165	2026-02-07 11:59:32.510478	MANUAL
68d7ea46-9c5f-49d5-b23d-724cb62b3e2b	47916952-a48c-486a-8421-014905e38968	hpg	PENDING	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:10.921211	\N	\N	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"documents": [{"id": "d37c9482-8eba-4cfc-8c91-887251dd59dc", "cid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "path": "/app/backend/uploads/document-1770464249589-933999852.jpg", "type": "seller_id", "filename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg"}, {"id": "dfd2a30d-ffa0-4457-9784-9a3596988f2a", "cid": "bafkreibvu6aw444eprud3afnd6sk7bacw5u4uiby64ehkzki5k5egyiboq", "path": "/app/backend/uploads/document-1770469324273-278332018.pdf", "type": "buyer_hpg_clearance", "filename": "HPG_Clearance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf"}], "orCrDocId": null, "autoVerify": {"completed": true, "completedAt": "2026-02-07T13:02:11.231Z", "completedBy": "system", "recommendation": "AUTO_APPROVE", "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "LKF-9216", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "35a7816e73847c683d80ad1fa4af8402b769ca2038f708756548eaba43610174", "authenticityScore": 100, "originalVehicleVin": "VFYD3SRG9DYJDAHT2", "originalCertificateId": "30f93b30-1760-49cc-b084-e09abee42622", "originalCompositeHash": "2fdbcd15f27a0f7d8798fe1e3bde885f59fd89f0d9de345ec16d4d2234e8fba4", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-AB5BRF"}}, "orCrDocCid": null, "vehicleVin": "LMJH22V3X6MPEM2VU", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "5VZ-CE605906", "ownerIdDocId": "d37c9482-8eba-4cfc-8c91-887251dd59dc", "vehicleColor": "Pearl White", "vehicleModel": "City", "vehiclePlate": "EUE-5843", "autoTriggered": true, "buyerHpgDocId": "dfd2a30d-ffa0-4457-9784-9a3596988f2a", "chassisNumber": "LMJH22V3X6MPEM2VU", "ownerIdDocCid": "bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy", "buyerHpgDocCid": "bafkreibvu6aw444eprud3afnd6sk7bacw5u4uiby64ehkzki5k5egyiboq", "ownerIdDocPath": "/app/backend/uploads/document-1770464249589-933999852.jpg", "buyerHpgDocPath": "/app/backend/uploads/document-1770469324273-278332018.pdf", "orCrDocFilename": null, "transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "ownerIdDocFilename": "e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg", "buyerHpgDocFilename": "HPG_Clearance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf"}	2026-02-07 13:02:10.921211	2026-02-07 13:02:11.232242	MANUAL
9b8cda80-0ca9-422b-b5d6-90528d5c53f3	d50832ba-fd65-497c-8e23-cfef1850df37	insurance	APPROVED	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:50.599307	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-07 14:07:50.602209	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "212d09b8-a7b3-484b-b732-26dda84f5456", "cid": "bafkreifx6ot3wtlmc2jsciwcanem2xm5g3pvnodfzih2ea2fnu6ya44igi", "path": "/app/backend/uploads/document-1770473268814-464635337.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-VAI1IQ.pdf"}], "ownerName": "Kim Andrei Besmar", "documentId": "212d09b8-a7b3-484b-b732-26dda84f5456", "ownerEmail": "kimandrei012@gmail.com", "vehicleVin": "5VH6EN0UC1WK3354M", "verifiedAt": "2026-02-07T14:07:50.601Z", "verifiedBy": "system", "documentCid": "bafkreifx6ot3wtlmc2jsciwcanem2xm5g3pvnodfzih2ea2fnu6ya44igi", "vehicleMake": "Honda", "vehicleYear": 2023, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770473268814-464635337.pdf", "documentType": "insurance_cert", "vehicleModel": "City", "vehiclePlate": "KVH-8684", "documentFilename": "Insurance_Certificate_CTPL-2026-VAI1IQ.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-VAI1IQ"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-VAI1IQ"}, "compositeHash": "c652cf1fab5b4db19ab5b9136a2dab8ef7bf79d863d429d3c8ee622f7e8ad2dd", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "b7f3a7bb4d6c16932122c20348cd5d9d36df56b865ca0fa203456d3d80738832", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "a5bd0815-70b7-4e4a-b031-c5711123f555", "originalCompositeHash": "6a3124c57561014388c8185dae03d9c63023a50d29007250f880d58158d397c9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-VAI1IQ"}}}	2026-02-07 14:07:50.599307	2026-02-07 14:07:50.602209	MANUAL
a46b1ff8-8d8e-4047-bb49-d80c00fc7e5b	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	insurance	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:42.157025	21d178c0-37c5-466e-b2eb-560e32981cbd	2026-02-08 02:46:42.161201	\N	Initial Vehicle Registration - Insurance Verification	Automatically sent upon vehicle registration submission	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "94c203c1-ab31-41b9-8482-1a28011d4882", "cid": "bafkreidr5d46o5vqtsdw4fviybho67sp25vorf75aohfhhhwcauvhhvnbi", "path": "/app/backend/uploads/document-1770518800502-96115874.pdf", "type": "insurance_cert", "filename": "Insurance_Certificate_CTPL-2026-JXP007.pdf"}], "ownerName": "Jasper Dulla", "documentId": "94c203c1-ab31-41b9-8482-1a28011d4882", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "XRU7EB0PUX47FRHYV", "verifiedAt": "2026-02-08T02:46:42.160Z", "verifiedBy": "system", "documentCid": "bafkreidr5d46o5vqtsdw4fviybho67sp25vorf75aohfhhhwcauvhhvnbi", "vehicleMake": "Toyota", "vehicleYear": 2024, "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770518800502-96115874.pdf", "documentType": "insurance_cert", "vehicleModel": "Vios", "vehiclePlate": "WUG-5803", "documentFilename": "Insurance_Certificate_CTPL-2026-JXP007.pdf", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "08-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-JXP007"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-JXP007"}, "compositeHash": "1f3288d06ad975e347179768c1be7c89e081305bce23617e2574284ea6e4ba68", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "71e8f9e776b09c876e16a8c04eef7e4fd76ae897fd038e539cf61029539ead0a", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "d757da6c-e64e-4764-a558-309738e66178", "originalCompositeHash": "3e8c30e5b1756b2348244d8641fd595528924dcba21f3e07b877ec539d4bf82e", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-JXP007"}}}	2026-02-08 02:46:42.157025	2026-02-08 02:46:42.161201	MANUAL
9156e97d-655f-45ef-8f6b-8a02f4359073	47916952-a48c-486a-8421-014905e38968	insurance	APPROVED	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:11.246531	\N	2026-02-07 13:02:12.180994	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "6c7cd31c-23cf-44c5-842a-5bb33970fe4e", "cid": "bafkreiavcrhdwnfpfawb54pcfvyottyv6ermyouvnmztkrusg4zkkhgjue", "path": "/app/backend/uploads/document-1770469327699-557192481.pdf", "type": "insurance_cert", "filename": "CTPL_Insurance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf"}], "documentId": "6c7cd31c-23cf-44c5-842a-5bb33970fe4e", "vehicleVin": "LMJH22V3X6MPEM2VU", "verifiedAt": "2026-02-07T13:02:12.180Z", "verifiedBy": "system", "documentCid": "bafkreiavcrhdwnfpfawb54pcfvyottyv6ermyouvnmztkrusg4zkkhgjue", "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770469327699-557192481.pdf", "documentType": "insurance_cert", "vehiclePlate": "EUE-5843", "autoTriggered": true, "documentFilename": "CTPL_Insurance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf", "transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-0QJG4I"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0QJG4I"}, "compositeHash": "7a66fddd3d60482e7570116e9a6ecf98f4098010461472baf91141b469e2593f", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "15144e3b34af282c1ef1e22d70e9cf15f122cc3a956b333546923732a51cc9a1", "authenticityScore": 100, "originalVehicleVin": "VFYD3SRG9DYJDAHT2", "originalCertificateId": "7c768865-3806-4358-8fe0-a681311255fc", "originalCompositeHash": "9999b777195c4e26e080d1fe4b90d50bd37c4149022ea9cef8fbfb7303faae42", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-0QJG4I"}}}	2026-02-07 13:02:11.246531	2026-02-07 13:02:12.180994	MANUAL
f8ded7e8-6ac8-4073-a562-62c90add19e3	d50832ba-fd65-497c-8e23-cfef1850df37	hpg	APPROVED	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:49.842371	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-07 14:11:20.821541	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "ed311054-8f27-4335-b3f9-36c46607d095", "cid": "bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm", "path": "/app/backend/uploads/document-1770473268964-968756169.jpg", "type": "owner_id", "filename": "driver.jpg"}, {"id": "406959eb-fc72-4e7d-8767-149342941918", "cid": "bafkreiee6fdoryz7vghszagvf7w5y2krj22racbnwchji2qzp6viagcbei", "path": "/app/backend/uploads/document-1770473268752-279947645.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-4WRSAB.pdf"}], "orCrDocId": null, "ownerName": "Kim Andrei Besmar", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-07T14:09:54.740Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "dd3e177f8e26efeb0e29aa6bfb764f8971555d75b8b3974fe3c287630c7f81f3", "preFilledData": {"engineNumber": "4GR-BE103259", "chassisNumber": "5VH6EN0UC1WK3354M"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "4GR-BE103259", "vehiclePlate": "KVH-8684", "chassisNumber": "9GK8K467X7XSDP", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "84f146e8e33fa98f2c80d52feddc69514eb510082db08e946a197faa80184122", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "3024161a-839d-4af6-8a55-3a8aef97a440", "originalCompositeHash": "2b3de4b7556c7e9e75e474a2f81752ac76266bf609920101df98945ecac34b8d", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-4WRSAB"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "kimandrei012@gmail.com", "vehicleVin": "5VH6EN0UC1WK3354M", "verifiedAt": "2026-02-07T14:11:20.821Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "4GR-BE103259", "macroEtching": false, "ownerIdDocId": "ed311054-8f27-4335-b3f9-36c46607d095", "vehicleColor": "Beige", "vehicleModel": "City", "vehiclePlate": "KVH-8684", "chassisNumber": "5VH6EN0UC1WK3354M", "extractedData": {"vin": "5VH6EN0UC1WK3354M", "source": "vehicle_metadata", "plateNumber": "KVH-8684", "engineNumber": "4GR-BE103259", "ocrExtracted": false, "chassisNumber": "5VH6EN0UC1WK3354M"}, "ownerIdDocCid": "bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm", "ownerIdDocPath": "/app/backend/uploads/document-1770473268964-968756169.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-07T14:07:49.856Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T14:07:49.853Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "406959eb-fc72-4e7d-8767-149342941918", "hpgClearanceDocCid": "bafkreiee6fdoryz7vghszagvf7w5y2krj22racbnwchji2qzp6viagcbei", "ownerIdDocFilename": "driver.jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770473268752-279947645.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-4WRSAB.pdf"}	2026-02-07 14:07:49.842371	2026-02-07 14:11:20.821541	MANUAL
5784599e-7b57-485a-8273-bca2b9dec134	d50832ba-fd65-497c-8e23-cfef1850df37	hpg	APPROVED	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:25.62186	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:27:48.982255	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "a3adac8d-2ce4-4ee7-8cfb-c5338acdcf6e", "cid": "bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm", "path": "/app/backend/uploads/document-1770473737926-392837831.jpg", "type": "seller_id", "filename": "driver.jpg"}, {"id": "a3cd7e1e-5f51-483e-86db-4a896a36eb30", "cid": "bafkreicxabidtr7xuozggacw57ysyouvwj4yhzvbi3tgxceboqypp46roq", "path": "/app/backend/uploads/document-1770473898820-925120209.pdf", "type": "buyer_hpg_clearance", "filename": "HPG_Clearance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf"}], "orCrDocId": null, "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-07T14:26:41.690Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "063d76dccb2f26009490505726febeb83d55acd333b77d20b45a442896b3c29b", "preFilledData": {"engineNumber": "4GR-BE103259", "chassisNumber": "5VH6EN0UC1WK3354M"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 100, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "KVH-8684", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "57005039c7f7a3b2630056eff12c3a95b27983e6a146e66b88817430f7f3d174", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "d0a8e8ed-5f92-4ef7-82a9-4ebbf602c5d1", "originalCompositeHash": "9ca026147676004dd5101a306d321440d5dc7035ae4dd54bf9867f17c3ff7cd9", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-QZW2JN"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "vehicleVin": "5VH6EN0UC1WK3354M", "verifiedAt": "2026-02-07T14:27:48.982Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "4GR-BE103259", "macroEtching": false, "ownerIdDocId": "a3adac8d-2ce4-4ee7-8cfb-c5338acdcf6e", "vehicleColor": "Beige", "vehicleModel": "City", "vehiclePlate": "KVH-8684", "autoTriggered": true, "buyerHpgDocId": "a3cd7e1e-5f51-483e-86db-4a896a36eb30", "chassisNumber": "5VH6EN0UC1WK3354M", "ownerIdDocCid": "bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm", "buyerHpgDocCid": "bafkreicxabidtr7xuozggacw57ysyouvwj4yhzvbi3tgxceboqypp46roq", "ownerIdDocPath": "/app/backend/uploads/document-1770473737926-392837831.jpg", "buyerHpgDocPath": "/app/backend/uploads/document-1770473898820-925120209.pdf", "orCrDocFilename": null, "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "ownerIdDocFilename": "driver.jpg", "buyerHpgDocFilename": "HPG_Clearance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf"}	2026-02-07 14:18:25.62186	2026-02-07 14:27:48.985966	MANUAL
bbd6c04c-5c18-487b-aaf3-f7e9422d76cb	d50832ba-fd65-497c-8e23-cfef1850df37	insurance	APPROVED	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:25.65918	\N	2026-02-07 14:18:26.379916	\N	Vehicle ownership transfer clearance	Auto-forwarded on buyer acceptance	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "32c29922-8de9-49c0-9d38-398353227dda", "cid": "bafkreidek5sirkbl7zxxn6lpkjc6pyj5hd2h3hagohj43p3eybtpa4v7mi", "path": "/app/backend/uploads/document-1770473902678-673306519.pdf", "type": "insurance_cert", "filename": "CTPL_Insurance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf"}], "documentId": "32c29922-8de9-49c0-9d38-398353227dda", "vehicleVin": "5VH6EN0UC1WK3354M", "verifiedAt": "2026-02-07T14:18:26.379Z", "verifiedBy": "system", "documentCid": "bafkreidek5sirkbl7zxxn6lpkjc6pyj5hd2h3hagohj43p3eybtpa4v7mi", "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770473902678-673306519.pdf", "documentType": "insurance_cert", "vehiclePlate": "KVH-8684", "autoTriggered": true, "documentFilename": "CTPL_Insurance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf", "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-NWLH39"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-NWLH39"}, "compositeHash": "254c86539b846cbee78656bf1f49f5a3cf37d44f7ced425f22c9b19f83e68539", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "64576488a82bfe6f76f96f5245e7e13d38f47d9c0671d3cdbf64c066f072bf62", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "a1e8e055-fbfd-455c-b0d1-aa9df19fd35d", "originalCompositeHash": "b5406baca95767d9e4f3bb8856f783ac81a69fe8ce524dcf623a4827ce38b93a", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-NWLH39"}}}	2026-02-07 14:18:25.65918	2026-02-07 14:18:26.379916	MANUAL
1fa0933a-01b8-49be-8bec-79ce4dd00724	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	hpg	APPROVED	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:41.377828	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	2026-02-08 02:48:32.048311	\N	Initial Vehicle Registration - HPG Clearance	Automatically sent upon vehicle registration submission	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "8713456c-2b83-49e5-8aeb-1b5c209e546f", "cid": "bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy", "path": "/app/backend/uploads/document-1770518800505-143704273.jpg", "type": "owner_id", "filename": "download (4).jpg"}, {"id": "2a9919fa-242d-45fe-b65f-c775554ad3ba", "cid": "bafkreie2c5ztsilhfazquntig3oibtqfl4rg74wz7npyxgujcg7hbhmcf4", "path": "/app/backend/uploads/document-1770518800424-89147547.pdf", "type": "hpg_clearance", "filename": "HPG_Clearance_HPG-2026-PAW8XM.pdf"}], "orCrDocId": null, "ownerName": "Jasper Dulla", "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-08T02:48:18.171Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "71fdc87ec40b9c21c228ef58d43bc437ed4161471c49ae62fb37ff89a399d11c", "preFilledData": {"engineNumber": "3UR-DE284537", "chassisNumber": "XRU7EB0PUX47FRHYV"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "3UR-DE284537", "vehiclePlate": "WUG-5803", "chassisNumber": "GC7ER4MPRYPX", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "9a177339216728330a366836dc80ce055f226ff2d9fb5f8b9a8911be709d822f", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "88f772ca-69cf-425e-aa44-f2f3f8bedc8e", "originalCompositeHash": "99f6a9a291e7cdffd2c38a7b1ddc02189b260f4c8ddf25051f68a9255a31dc5c", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-PAW8XM"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "XRU7EB0PUX47FRHYV", "verifiedAt": "2026-02-08T02:48:32.048Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "3UR-DE284537", "macroEtching": false, "ownerIdDocId": "8713456c-2b83-49e5-8aeb-1b5c209e546f", "vehicleColor": "White", "vehicleModel": "Vios", "vehiclePlate": "WUG-5803", "chassisNumber": "XRU7EB0PUX47FRHYV", "extractedData": {"vin": "XRU7EB0PUX47FRHYV", "source": "vehicle_metadata", "plateNumber": "WUG-5803", "engineNumber": "3UR-DE284537", "ocrExtracted": false, "chassisNumber": "XRU7EB0PUX47FRHYV"}, "ownerIdDocCid": "bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy", "ownerIdDocPath": "/app/backend/uploads/document-1770518800505-143704273.jpg", "orCrDocFilename": null, "automationPhase1": {"completed": true, "completedAt": "2026-02-08T02:46:41.394Z", "databaseChecked": true}, "hpgDatabaseCheck": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-08T02:46:41.391Z", "matchedRecords": [], "recommendation": "PROCEED"}, "hpgClearanceDocId": "2a9919fa-242d-45fe-b65f-c775554ad3ba", "hpgClearanceDocCid": "bafkreie2c5ztsilhfazquntig3oibtqfl4rg74wz7npyxgujcg7hbhmcf4", "ownerIdDocFilename": "download (4).jpg", "hpgClearanceDocPath": "/app/backend/uploads/document-1770518800424-89147547.pdf", "registrationCertDocId": null, "registrationCertDocCid": null, "hpgClearanceDocFilename": "HPG_Clearance_HPG-2026-PAW8XM.pdf"}	2026-02-08 02:46:41.377828	2026-02-08 02:48:32.048311	MANUAL
4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	hpg	APPROVED	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:34:10.429197	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 03:36:45.111547	\N	Vehicle ownership transfer clearance	Forwarded for HPG clearance review	{"photos": [], "remarks": null, "stencil": null, "documents": [{"id": "4c7d8b2a-3ff3-4a19-a13a-dbbec6bff494", "cid": "bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm", "path": "/app/backend/uploads/document-1770520765945-176546183.jpg", "type": "seller_id", "filename": "driver.jpg"}, {"id": "6cd2d9f0-0386-49e7-8bc5-b90568d1f4b0", "cid": "bafkreieb4mzqepn6izrao3l3uhtookuyfcge2e6rujsyiqyba4cbqqt36u", "path": "/app/backend/uploads/document-1770520809532-732029539.pdf", "type": "buyer_hpg_clearance", "filename": "HPG_Clearance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf"}], "orCrDocId": null, "autoVerify": {"completed": true, "hashCheck": {"exists": false, "source": "database"}, "completedAt": "2026-02-08T03:36:29.283Z", "completedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "compositeHash": "320a9e5d6c9c9370e7d158b4159e217af48f725550fe286b00f1d5007bfa350e", "preFilledData": {"engineNumber": "3UR-DE284537", "chassisNumber": "XRU7EB0PUX47FRHYV"}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 100, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "WUG-5803", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "81e333023dbe4662076d7ba1e6e72a98288c4d13d1a265844301070418427bf5", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "79094cfb-13e3-4eeb-8ee2-8087c7231463", "originalCompositeHash": "85588aeb191118d099140b37ad7810dad88fe2cc15eb5afcad91d0dbd885fe3a", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-P9VSGW"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}, "orCrDocCid": null, "vehicleVin": "XRU7EB0PUX47FRHYV", "verifiedAt": "2026-02-08T03:36:45.111Z", "verifiedBy": "654bb34d-fec4-458c-94bc-2223d885a6d7", "orCrDocPath": null, "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "3UR-DE284537", "macroEtching": false, "ownerIdDocId": "4c7d8b2a-3ff3-4a19-a13a-dbbec6bff494", "vehicleColor": "White", "vehicleModel": "Vios", "vehiclePlate": "WUG-5803", "autoTriggered": false, "buyerHpgDocId": "6cd2d9f0-0386-49e7-8bc5-b90568d1f4b0", "chassisNumber": "XRU7EB0PUX47FRHYV", "ownerIdDocCid": "bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm", "buyerHpgDocCid": "bafkreieb4mzqepn6izrao3l3uhtookuyfcge2e6rujsyiqyba4cbqqt36u", "ownerIdDocPath": "/app/backend/uploads/document-1770520765945-176546183.jpg", "buyerHpgDocPath": "/app/backend/uploads/document-1770520809532-732029539.pdf", "orCrDocFilename": null, "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "ownerIdDocFilename": "driver.jpg", "buyerHpgDocFilename": "HPG_Clearance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf"}	2026-02-08 03:34:10.429197	2026-02-08 03:36:45.115459	MANUAL
057c9da0-e1c7-4811-bc35-d81efec534d0	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	insurance	APPROVED	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:34:13.632963	\N	2026-02-08 03:34:14.786098	\N	Vehicle ownership transfer clearance	Forwarded for Insurance clearance review	{"notes": "Auto-verified and approved. Score: 100%", "documents": [{"id": "80adf8b6-9689-4fad-8cf7-babc55fcdf14", "cid": "bafkreicmaufhl47frzs36xnfwclvn5ewjmnh6f3tix536rw5lkbnrjv6vq", "path": "/app/backend/uploads/document-1770520815344-534663371.pdf", "type": "insurance_cert", "filename": "CTPL_Insurance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf"}], "documentId": "80adf8b6-9689-4fad-8cf7-babc55fcdf14", "vehicleVin": "XRU7EB0PUX47FRHYV", "verifiedAt": "2026-02-08T03:34:14.785Z", "verifiedBy": "system", "documentCid": "bafkreicmaufhl47frzs36xnfwclvn5ewjmnh6f3tix536rw5lkbnrjv6vq", "autoVerified": true, "documentPath": "/app/backend/uploads/document-1770520815344-534663371.pdf", "documentType": "insurance_cert", "vehiclePlate": "WUG-5803", "autoTriggered": false, "documentFilename": "CTPL_Insurance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf", "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "08-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-0VDAN0"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0VDAN0"}, "compositeHash": "ffff461d16101f5d51fac55c6f99b01bcb23d6686e4b3e9f0aa14ad0de54598f", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "4c050a75f3e58e65bf5da5b09756f4964b1a7f177345fbbf46dd5a82d8a6beac", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "d431c5ce-909f-491f-9206-2e7dea83edf7", "originalCompositeHash": "79623042008b1be1af96bae2cc4f502f6e44a4eefcd9328ef802278d78bcdd5e", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-0VDAN0"}}}	2026-02-08 03:34:13.632963	2026-02-08 03:34:14.786098	MANUAL
\.


--
-- TOC entry 3970 (class 0 OID 16606)
-- Dependencies: 220
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.documents (id, vehicle_id, document_type, filename, original_name, file_path, file_size, mime_type, file_hash, uploaded_by, uploaded_at, verified, verified_at, verified_by, is_inspection_document, inspection_document_type, ipfs_cid) FROM stdin;
8e142303-8cc8-42c9-abc5-9b30632f85e2	d50832ba-fd65-497c-8e23-cfef1850df37	deed_of_sale	Deed_of_Sale_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	Deed_of_Sale_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	/app/uploads/temp/transfer-cert-1770473655464-pat63e.pdf	83274	application/pdf	3c3d1eeb0ed5bb773e666af2ed7d8da85372be1b2c928a211ae66901480f6fe2	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 14:14:15.493827	f	\N	\N	f	\N	bafkreib4hupowdwvxn3t4ztk6lwx3dniknzl4gzmskfccgxgneauqd3p4i
ecd1d9cb-d41d-4631-b75c-0f65c71e6b30	d50832ba-fd65-497c-8e23-cfef1850df37	hpg_clearance	HPG_Clearance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	HPG_Clearance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	/app/uploads/temp/transfer-cert-1770473659071-qe7o2e.pdf	56253	application/pdf	57005039c7f7a3b2630056eff12c3a95b27983e6a146e66b88817430f7f3d174	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 14:14:19.09535	f	\N	\N	f	\N	bafkreicxabidtr7xuozggacw57ysyouvwj4yhzvbi3tgxceboqypp46roq
18f3e16e-de90-464f-a15e-c2f218d4a4c9	d50832ba-fd65-497c-8e23-cfef1850df37	insurance_cert	CTPL_Insurance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	CTPL_Insurance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	/app/uploads/temp/transfer-cert-1770473663376-cc6vno.pdf	69373	application/pdf	64576488a82bfe6f76f96f5245e7e13d38f47d9c0671d3cdbf64c066f072bf62	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 14:14:23.406334	f	\N	\N	f	\N	bafkreidek5sirkbl7zxxn6lpkjc6pyj5hd2h3hagohj43p3eybtpa4v7mi
453158af-3023-4881-a2c3-b605ca4f7f6a	aac4dc07-379b-4cdc-9250-6e80aaed676a	buyer_id	document-1770479491324-374621051.jpg	download (3).jpg	/app/backend/uploads/document-1770479491324-374621051.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-07 15:51:31.352651	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
8e115d2f-620d-4fe8-a1de-06b8ab3b88a7	aac4dc07-379b-4cdc-9250-6e80aaed676a	hpg_clearance	document-1770479496163-729919318.pdf	HPG_Clearance_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	/app/backend/uploads/document-1770479496163-729919318.pdf	55935	application/pdf	d3daa401e9f104d9175d97875df843e536e8bcf27a4acac08b3fda5cea5e34c2	\N	2026-02-07 15:51:36.180971	f	\N	\N	f	\N	bafkreigt3ksad2pratmroxmxq5o7qq7fg3ulz4t2jlfmbcz73joouxruyi
403a34a4-79bc-441d-8693-c48cd6d31e1b	aac4dc07-379b-4cdc-9250-6e80aaed676a	insurance_cert	document-1770479499304-614304928.pdf	CTPL_Insurance_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	/app/backend/uploads/document-1770479499304-614304928.pdf	69734	application/pdf	8cca8891002ce50224284caa91ccd167f68c25d8580244d4908299ee0fd2a18e	\N	2026-02-07 15:51:39.323066	f	\N	\N	f	\N	bafkreiemzkejcabm4ubcikcmvki4zulh62gclwcyajcnjeecthxa7uvbry
80b71c43-1365-483a-918c-725b9b764a09	d7463eaa-e937-4e14-ac30-a0bb43dc5747	hpg_clearance	document-1770373049299-671580688.pdf	HPG_Clearance_HPG-2026-9I7N66.pdf	/app/backend/uploads/document-1770373049299-671580688.pdf	56523	application/pdf	32a58cd9f9c50bd3e9d577cee2d6abcbae6975037e5a7bc2348f59ee941a6815	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:29.425869	f	\N	\N	f	\N	bafkreibsuwgnt6ofbpj6tvlxz3rnnk6lvzuxka36lj54eneplhxjigticu
4da9d285-e7ea-4bfe-9341-37bea793f6f3	d7463eaa-e937-4e14-ac30-a0bb43dc5747	owner_id	document-1770373049358-591393085.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770373049358-591393085.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:29.44119	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
1bdb7fd8-4e3a-4bf2-9307-65c79f8b0422	d7463eaa-e937-4e14-ac30-a0bb43dc5747	insurance_cert	document-1770373049427-825124787.pdf	Insurance_Certificate_CTPL-2026-8C6FII.pdf	/app/backend/uploads/document-1770373049427-825124787.pdf	69384	application/pdf	6466664de1bc35130f8af0135bd1215e263f93f61a4b8579cb4868333cb6e33a	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:29.490258	f	\N	\N	f	\N	bafkreidemzte3yn4gujq7cxqcnn5cik6ey7zh5q2jocxts2inaztznxdhi
f5620bd2-5a03-491d-ac75-0781f9d2f617	d7463eaa-e937-4e14-ac30-a0bb43dc5747	sales_invoice	document-1770373049348-47613620.pdf	Sales_Invoice_INV-20260206-VQGVZR.pdf	/app/backend/uploads/document-1770373049348-47613620.pdf	103255	application/pdf	666dae13028c28db2b7b0fd594585faee0c24412e83d16387d4a550bbb728087	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:29.445348	t	2026-02-06 10:17:29.616644	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreidgnwxbgaumfdnsw6yp2wkfqx5o4dbeiexihuldq7kkkuf3w4uaq4
e98b3e3c-ef77-4a48-bb00-f04fedf54be8	d7463eaa-e937-4e14-ac30-a0bb43dc5747	csr	document-1770373049339-660870164.pdf	CSR_CSR-2026-OOVQ91.pdf	/app/backend/uploads/document-1770373049339-660870164.pdf	151231	application/pdf	8188551b76a2a09e5cac605572ed9533db606a92baa5ab5753eb3e6e1056d769	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:29.424177	t	2026-02-06 10:17:29.619913	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreiebrbkrw5vcucpfzldakvzo3fjt3nqgvev2uwvvou7lhzxbavwxne
2d246bd7-2807-4691-8a8d-41bb1fe7c541	5735abaf-cd58-46ca-a6a5-0a864050ac8d	hpg_clearance	document-1770375838234-56032985.pdf	HPG_Clearance_HPG-2026-2R0PCX.pdf	/app/backend/uploads/document-1770375838234-56032985.pdf	56300	application/pdf	2e226b9d3e122edb30129e6798f9e7791bcd1c4d0c81c59637ff5ea53837dc8b	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:58.428096	f	\N	\N	f	\N	bafkreiboejvz2pqsf3ntaeu6m6mptz3zdpgrytimqhczmn77l2stqn64rm
25d01d75-54d8-41c6-a3a9-a52055a18f03	5735abaf-cd58-46ca-a6a5-0a864050ac8d	insurance_cert	document-1770375838411-426602788.pdf	Insurance_Certificate_CTPL-2026-T9OZB3.pdf	/app/backend/uploads/document-1770375838411-426602788.pdf	69293	application/pdf	27c54a3623595accc135f092c3d2a9d0dd74685f9eba0be138447fc5c8288538	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:58.447737	f	\N	\N	f	\N	bafkreibhyvfdmi2zllgmcnpqslb5fkoq3v2gqx46xif6cocep7c4qkefha
f6b66ade-d0b2-46eb-8c0e-0799a7c55fce	5735abaf-cd58-46ca-a6a5-0a864050ac8d	owner_id	document-1770375838437-187096481.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770375838437-187096481.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:58.483309	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
fafa14ae-78c6-44d1-abc3-e3291e64bb66	5735abaf-cd58-46ca-a6a5-0a864050ac8d	sales_invoice	document-1770375838325-338077010.pdf	Sales_Invoice_INV-20260206-96VR8K.pdf	/app/backend/uploads/document-1770375838325-338077010.pdf	104286	application/pdf	07974cc4ef9c9d2a9af9643b8656a790c51a07df7bc32a8968b81942a531f7c7	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:58.422269	t	2026-02-06 11:03:58.592542	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreiahs5gmj344tuvjv6lehodfnj4qyunapx33ymvis2fydfbkkmpxy4
ac5107fe-0de0-4914-a5c6-792acf7d456b	5735abaf-cd58-46ca-a6a5-0a864050ac8d	csr	document-1770375838312-148854716.pdf	CSR_CSR-2026-F0IFQ8.pdf	/app/backend/uploads/document-1770375838312-148854716.pdf	152142	application/pdf	55ac873d4b19fc6b8676e28485ba4982040f90141e395c6cffd38fdbd481dff7	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:58.348793	t	2026-02-06 11:03:58.596198	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreicvvsdt2syz7rvym5xcqsc3usmcaqhzafa6hfogz76tr7n5jao764
cf10e209-38ef-407e-b59a-8c830ec01459	\N	hpg_clearance	document-1770378404995-913225315.pdf	HPG_Clearance_HPG-2026-BI42W9.pdf	/app/backend/uploads/document-1770378404995-913225315.pdf	56922	application/pdf	227b6f6530fcb8b97ca119d02880c031abdebcd235eaffaa279fe197fc737549	\N	2026-02-06 11:46:45.055615	f	\N	\N	f	\N	bafkreibcpnxwkmh4xc4xziiz2auibqbrvpplzurv5l72uj474gl7y43vje
40bb4789-bd0d-44f3-9d01-82375c305346	\N	insurance_cert	document-1770378405043-747469607.pdf	Insurance_Certificate_CTPL-2026-PUZNHF.pdf	/app/backend/uploads/document-1770378405043-747469607.pdf	69315	application/pdf	10f0075ee74b503cf1ee710cda5361bbe23816c63132a866a47206a75eb1f55a	\N	2026-02-06 11:46:45.088864	f	\N	\N	f	\N	bafkreiaq6adv5z2lka6pd3trbtnfgyn34i4bnrrrgkugnjdsa2tv5mpvli
22852bdb-2c98-4c06-b78a-9d107abdd37e	\N	csr	document-1770378405040-144857385.pdf	CSR_CSR-2026-F0IFQ8.pdf	/app/backend/uploads/document-1770378405040-144857385.pdf	152142	application/pdf	55ac873d4b19fc6b8676e28485ba4982040f90141e395c6cffd38fdbd481dff7	\N	2026-02-06 11:46:45.114867	f	\N	\N	f	\N	bafkreicvvsdt2syz7rvym5xcqsc3usmcaqhzafa6hfogz76tr7n5jao764
0b643e64-b597-40f1-bece-d0a89593c4ef	\N	owner_id	document-1770378405056-861235700.jpg	download (3).jpg	/app/backend/uploads/document-1770378405056-861235700.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-06 11:46:45.186469	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
d25279f3-51d0-4d9e-a791-cddad3e40699	\N	sales_invoice	document-1770378405052-800986927.pdf	Sales_Invoice_INV-20260206-96VR8K.pdf	/app/backend/uploads/document-1770378405052-800986927.pdf	104286	application/pdf	07974cc4ef9c9d2a9af9643b8656a790c51a07df7bc32a8968b81942a531f7c7	\N	2026-02-06 11:46:45.194537	f	\N	\N	f	\N	bafkreiahs5gmj344tuvjv6lehodfnj4qyunapx33ymvis2fydfbkkmpxy4
02c8671a-8d97-4617-90b5-13b3f0fb1ab2	\N	hpg_clearance	document-1770378522024-843785000.pdf	HPG_Clearance_HPG-2026-BI42W9.pdf	/app/backend/uploads/document-1770378522024-843785000.pdf	56922	application/pdf	227b6f6530fcb8b97ca119d02880c031abdebcd235eaffaa279fe197fc737549	\N	2026-02-06 11:48:42.05104	f	\N	\N	f	\N	bafkreibcpnxwkmh4xc4xziiz2auibqbrvpplzurv5l72uj474gl7y43vje
e05a963a-0600-47fa-953a-9effebc50263	\N	csr	document-1770378522063-331945138.pdf	CSR_CSR-2026-F0IFQ8.pdf	/app/backend/uploads/document-1770378522063-331945138.pdf	152142	application/pdf	55ac873d4b19fc6b8676e28485ba4982040f90141e395c6cffd38fdbd481dff7	\N	2026-02-06 11:48:42.100617	f	\N	\N	f	\N	bafkreicvvsdt2syz7rvym5xcqsc3usmcaqhzafa6hfogz76tr7n5jao764
209d0482-fbb5-4f3c-af00-8657392318e2	\N	insurance_cert	document-1770378522069-367982880.pdf	Insurance_Certificate_CTPL-2026-PUZNHF.pdf	/app/backend/uploads/document-1770378522069-367982880.pdf	69315	application/pdf	10f0075ee74b503cf1ee710cda5361bbe23816c63132a866a47206a75eb1f55a	\N	2026-02-06 11:48:42.188164	f	\N	\N	f	\N	bafkreiaq6adv5z2lka6pd3trbtnfgyn34i4bnrrrgkugnjdsa2tv5mpvli
d1fb15f9-41ac-47af-9fdb-c714365cbd73	\N	sales_invoice	document-1770378522070-131489297.pdf	Sales_Invoice_INV-20260206-96VR8K.pdf	/app/backend/uploads/document-1770378522070-131489297.pdf	104286	application/pdf	07974cc4ef9c9d2a9af9643b8656a790c51a07df7bc32a8968b81942a531f7c7	\N	2026-02-06 11:48:42.288851	f	\N	\N	f	\N	bafkreiahs5gmj344tuvjv6lehodfnj4qyunapx33ymvis2fydfbkkmpxy4
a65168b3-f431-4689-af3f-bffc626b4db9	\N	owner_id	document-1770378522080-770838586.jpg	download (3).jpg	/app/backend/uploads/document-1770378522080-770838586.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-06 11:48:42.384104	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
c2fb98e8-fe08-44cd-9a11-f88bed2f0975	d50832ba-fd65-497c-8e23-cfef1850df37	deed_of_sale	document-1770473733686-726074301.pdf	Deed_of_Sale_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	/app/backend/uploads/document-1770473733686-726074301.pdf	83274	application/pdf	3c3d1eeb0ed5bb773e666af2ed7d8da85372be1b2c928a211ae66901480f6fe2	\N	2026-02-07 14:15:33.716703	f	\N	\N	f	\N	bafkreib4hupowdwvxn3t4ztk6lwx3dniknzl4gzmskfccgxgneauqd3p4i
a3adac8d-2ce4-4ee7-8cfb-c5338acdcf6e	d50832ba-fd65-497c-8e23-cfef1850df37	seller_id	document-1770473737926-392837831.jpg	driver.jpg	/app/backend/uploads/document-1770473737926-392837831.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	\N	2026-02-07 14:15:37.947034	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
f89cd402-11e3-4b75-8e20-4db84820c792	aac4dc07-379b-4cdc-9250-6e80aaed676a	owner_id	document-1770479504454-654538356.jpg	download (4).jpg	/app/backend/uploads/document-1770479504454-654538356.jpg	108204	image/jpeg	424b7de930c353c8af2071e5df0fe433bd57bace990c51843b42ff939ed8a3b6	\N	2026-02-07 15:51:44.47606	f	\N	\N	f	\N	bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy
8f232c58-4a33-4edd-884b-57a8b90f4234	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	deed_of_sale	Deed_of_Sale_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	Deed_of_Sale_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	/app/uploads/temp/transfer-cert-1770520494757-emiy3v.pdf	84078	application/pdf	7816b1d98eb3e8f3f8362de15b20fe674a39999ed898bd2d3164b6f42db1a753	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-08 03:14:54.80547	f	\N	\N	f	\N	bafkreidyc2y5tdvt5dz7qnrn4fnsb7thji4zthwytc6s2mlew32c3mnhkm
ebeded86-e92c-45bf-82c1-1352c7a9d4e6	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	hpg_clearance	HPG_Clearance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	HPG_Clearance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	/app/uploads/temp/transfer-cert-1770520498459-3wwk1.pdf	56233	application/pdf	81e333023dbe4662076d7ba1e6e72a98288c4d13d1a265844301070418427bf5	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-08 03:14:58.486196	f	\N	\N	f	\N	bafkreieb4mzqepn6izrao3l3uhtookuyfcge2e6rujsyiqyba4cbqqt36u
ecaf0249-68c7-4176-86b9-49fc2afe4f05	84a15919-868f-44f9-b9ed-141fdfb62529	hpg_clearance	document-1770379030031-491455223.pdf	HPG_Clearance_HPG-2026-VN74AN.pdf	/app/backend/uploads/document-1770379030031-491455223.pdf	56889	application/pdf	626c5b9abd724e08f9b7bd3ac3385d14ee397f39c525145b671536ca869102e4	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:10.058824	f	\N	\N	f	\N	bafkreidcnrnzvplsjyeptn55hlbtqxiu5y4x6oofeukfwzyvg3fineic4q
dd653a1b-fd25-4b8d-900c-38a55f9e833e	84a15919-868f-44f9-b9ed-141fdfb62529	insurance_cert	document-1770379030143-808959547.pdf	Insurance_Certificate_CTPL-2026-7XUVA0.pdf	/app/backend/uploads/document-1770379030143-808959547.pdf	69070	application/pdf	33f25859a931dc332fd7a5197499ab5d36ad76df7a280ef798e472e388edc90b	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:10.174903	f	\N	\N	f	\N	bafkreibt6jmftkjr3qzs7v5fdf2jtk25g2wxnx32fahppgheolryr3ojbm
36f8bc38-14f0-45cb-8606-e3c65892cc70	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	insurance_cert	CTPL_Insurance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	CTPL_Insurance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	/app/uploads/temp/transfer-cert-1770520502878-7k3fp.pdf	69823	application/pdf	4c050a75f3e58e65bf5da5b09756f4964b1a7f177345fbbf46dd5a82d8a6beac	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-08 03:15:02.950052	f	\N	\N	f	\N	bafkreicmaufhl47frzs36xnfwclvn5ewjmnh6f3tix536rw5lkbnrjv6vq
b0a17b98-b35e-400c-9651-aaa57934eaf2	84a15919-868f-44f9-b9ed-141fdfb62529	owner_id	document-1770379030955-17684224.jpg	download (3).jpg	/app/backend/uploads/document-1770379030955-17684224.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:10.975197	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
422f7610-883a-4175-8477-8703fb739099	84a15919-868f-44f9-b9ed-141fdfb62529	sales_invoice	document-1770379030984-782547264.pdf	Sales_Invoice_INV-20260206-UGJ7AB.pdf	/app/backend/uploads/document-1770379030984-782547264.pdf	102899	application/pdf	ef1ca2a0867e4c859f002330dcdb6120851d389d20d0de482ca4d3affe8ef724	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:11.003772	t	2026-02-06 11:57:11.432553	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	f	\N	bafkreihpdsrkbbt6jscz6abdgdonwyjaquotrhja2dpeqlfe2ox75dxxeq
de0863d6-c60c-4a10-be46-eae76e1239de	84a15919-868f-44f9-b9ed-141fdfb62529	csr	document-1770379030156-332587317.pdf	CSR_CSR-2026-2WPMXV.pdf	/app/backend/uploads/document-1770379030156-332587317.pdf	151415	application/pdf	c362e5a7b60ece87e8906a1a60480a786d65e56375ddbe58ec891b883fcd9745	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:10.184357	t	2026-02-06 11:57:11.43741	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	f	\N	bafkreigdmls2pnqoz2d6redkdjqeqctynvs6ky3v3w7fr3ejdoed7tmxiu
2f5f68d7-1a06-49bc-a7b8-73da641b9b6d	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	hpg_clearance	document-1770383153113-848224931.pdf	HPG_Clearance_HPG-2026-902GBI.pdf	/app/backend/uploads/document-1770383153113-848224931.pdf	57308	application/pdf	90793bb591bcac568fb8fb95c1dad4cd7149fb802428e75e17a65cab58a18b01	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:53.170525	f	\N	\N	f	\N	bafkreieqpe53len4vrli7oh3sxa5vvgnofe7xabefdtv4f5glsvvrimlae
4b720289-a2ef-4598-aa2b-b2a13f8a16aa	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	insurance_cert	document-1770383153269-317880937.pdf	Insurance_Certificate_CTPL-2026-LG58U4.pdf	/app/backend/uploads/document-1770383153269-317880937.pdf	70318	application/pdf	2f21b450c681a6cee7e1ee1dd7a6ca854275d141163c2e217a0b47067afff20c	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:53.350494	f	\N	\N	f	\N	bafkreibpeg2fbrubu3hopypodxl2nsufij25cqiwhqxcc6qli4dhv77sbq
9152f2f8-46a1-4400-870b-624251d2649c	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	csr	document-1770383153158-167731091.pdf	CSR_CSR-2026-JVH20X.pdf	/app/backend/uploads/document-1770383153158-167731091.pdf	152042	application/pdf	41fd42f47c09e5e99af42a5c09fc3ab464a2fe73a959181d50561101515d30c1	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:53.26439	t	2026-02-06 13:05:53.50834	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreicb7vbpi7aj4xuzv5bklqe7yovumsrp445jlemb2ucwceavcxjqye
8a7b291e-b0ac-4c4b-ae6b-d3572f8412c8	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	sales_invoice	document-1770383153168-946189319.pdf	Sales_Invoice_INV-20260206-GGMHA8.pdf	/app/backend/uploads/document-1770383153168-946189319.pdf	104849	application/pdf	5a2ae6a1d001ed24ba68be8e74acc50bfe2a631fd369242c529c637075dfdc8b	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:53.238242	t	2026-02-06 13:05:53.515844	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreic2fltkduab5uslu2f6rz2kzril7yvggh6tnescyuu4mnyhlx64rm
02c19ec9-471d-47e2-86eb-a9ed45919dc6	d50832ba-fd65-497c-8e23-cfef1850df37	buyer_id	document-1770473890432-313099435.jpg	driver.jpg	/app/backend/uploads/document-1770473890432-313099435.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	\N	2026-02-07 14:18:10.455028	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
c7e31259-8d9f-49e7-9255-8eb18f235621	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	owner_id	document-1770383153272-634326650.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770383153272-634326650.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:53.386241	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
0fa541c8-273a-493e-832d-dc6feba57084	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	deed_of_sale	Deed_of_Sale_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	Deed_of_Sale_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	/app/uploads/temp/transfer-cert-1770383382166-vfkoyn.pdf	85056	application/pdf	9b293eb18f9458f8b056eef43e2933ffea420a4fe9108fa564df1e5011b40379	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-06 13:09:42.253936	f	\N	\N	f	\N	bafkreie3fe7ldd4uld4lavxo6q7csm775jbaut7jcch2kzg7dzibdnadpe
978dff4d-1481-4c4d-acc8-2cb633afef05	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	hpg_clearance	HPG_Clearance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	HPG_Clearance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	/app/uploads/temp/transfer-cert-1770383385742-q1qo7q.pdf	56957	application/pdf	74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-06 13:09:45.782338	f	\N	\N	f	\N	bafkreiduvx4v74fpiqxg4ce5ctwu7xqhjbywogfiakhp2o6sghqkfrcaeu
ab4c2ced-177d-4e87-a45b-18e5a3089c57	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	insurance_cert	CTPL_Insurance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	CTPL_Insurance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	/app/uploads/temp/transfer-cert-1770383390034-w0slf.pdf	70337	application/pdf	acf7bbbd3c522476bb523b52a9dc0820c109dc45fcdc2206cd563ec0384da1ef	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-06 13:09:50.054731	f	\N	\N	f	\N	bafkreifm66532pcser3lwur3kku5ycbayee5yrp43qrantkwh3adqtnb54
f2a78d77-117f-4270-a6ca-e4ab77b043d2	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	deed_of_sale	document-1770383417729-26549795.pdf	Deed_of_Sale_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	/app/backend/uploads/document-1770383417729-26549795.pdf	85056	application/pdf	9b293eb18f9458f8b056eef43e2933ffea420a4fe9108fa564df1e5011b40379	\N	2026-02-06 13:10:17.750919	f	\N	\N	f	\N	bafkreie3fe7ldd4uld4lavxo6q7csm775jbaut7jcch2kzg7dzibdnadpe
c9bc9efb-c834-4ce5-b834-9177cec096aa	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	seller_id	document-1770383424841-615213025.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770383424841-615213025.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	\N	2026-02-06 13:10:24.862191	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
91398931-e41f-462b-bf77-f5325d017acc	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	hpg_clearance	document-1770383491046-278769205.pdf	HPG_Clearance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	/app/backend/uploads/document-1770383491046-278769205.pdf	56957	application/pdf	74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025	\N	2026-02-06 13:11:31.064186	f	\N	\N	f	\N	bafkreiduvx4v74fpiqxg4ce5ctwu7xqhjbywogfiakhp2o6sghqkfrcaeu
9a828788-8d74-4746-aacb-b9a0ebe17cce	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	insurance_cert	document-1770383494902-890775357.pdf	CTPL_Insurance_02ea78e9-57d6-436b-ad6b-154d06e6ea6c.pdf	/app/backend/uploads/document-1770383494902-890775357.pdf	70337	application/pdf	acf7bbbd3c522476bb523b52a9dc0820c109dc45fcdc2206cd563ec0384da1ef	\N	2026-02-06 13:11:34.922526	f	\N	\N	f	\N	bafkreifm66532pcser3lwur3kku5ycbayee5yrp43qrantkwh3adqtnb54
68783a42-2a70-4d4c-9499-aecc096661f3	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	buyer_id	document-1770383500476-412133912.jpg	download (3).jpg	/app/backend/uploads/document-1770383500476-412133912.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-06 13:11:40.500815	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
379a8aed-aea3-4e5a-85da-504149f09d68	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	owner_id	document-1770383506492-18016110.jpg	download (4).jpg	/app/backend/uploads/document-1770383506492-18016110.jpg	108204	image/jpeg	424b7de930c353c8af2071e5df0fe433bd57bace990c51843b42ff939ed8a3b6	\N	2026-02-06 13:11:46.523066	f	\N	\N	f	\N	bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy
2a9919fa-242d-45fe-b65f-c775554ad3ba	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	hpg_clearance	document-1770518800424-89147547.pdf	HPG_Clearance_HPG-2026-PAW8XM.pdf	/app/backend/uploads/document-1770518800424-89147547.pdf	56476	application/pdf	9a177339216728330a366836dc80ce055f226ff2d9fb5f8b9a8911be709d822f	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:40.458078	f	\N	\N	f	\N	bafkreie2c5ztsilhfazquntig3oibtqfl4rg74wz7npyxgujcg7hbhmcf4
96edd85f-c6f2-43bf-bc2e-04711e0425da	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	deed_of_sale	document-1770520753864-395935262.pdf	Deed_of_Sale_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	/app/backend/uploads/document-1770520753864-395935262.pdf	84078	application/pdf	7816b1d98eb3e8f3f8362de15b20fe674a39999ed898bd2d3164b6f42db1a753	\N	2026-02-08 03:19:13.892372	f	\N	\N	f	\N	bafkreidyc2y5tdvt5dz7qnrn4fnsb7thji4zthwytc6s2mlew32c3mnhkm
356252da-5145-4e17-96db-cd3ed6d5885d	aac4dc07-379b-4cdc-9250-6e80aaed676a	hpg_clearance	document-1770387203305-268621139.pdf	HPG_Clearance_HPG-2026-IC1WZW.pdf	/app/backend/uploads/document-1770387203305-268621139.pdf	56914	application/pdf	db410c26d4c68aaf54a3b978f9ac73cc978afc458f3d483f4f486eca2d82e790	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:23.33734	f	\N	\N	f	\N	bafkreig3iegcnvggrkxvji5zpd42y46ms6fpyrmphved6t2in3fc3axhsa
ef5c6653-6d3c-48c1-ab98-207e6eca992d	aac4dc07-379b-4cdc-9250-6e80aaed676a	owner_id	document-1770387203373-583679546.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770387203373-583679546.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:23.444048	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
56ddfb75-fb58-48b5-96cc-08e81673315e	aac4dc07-379b-4cdc-9250-6e80aaed676a	insurance_cert	document-1770387203394-534782498.pdf	Insurance_Certificate_CTPL-2026-CE1WZR.pdf	/app/backend/uploads/document-1770387203394-534782498.pdf	69341	application/pdf	eebdc6499cc233c18340a57c518c63d0685ae3e67886f85cd5e7a613e6443ab4	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:23.466993	f	\N	\N	f	\N	bafkreihoxxdethgcgpaygqffpriyyy6qnbnohztyq34fzvphuyj6mrb2wq
de110d01-c538-40b5-a539-4346763e855d	aac4dc07-379b-4cdc-9250-6e80aaed676a	csr	document-1770387203395-482482234.pdf	CSR_CSR-2026-V8BQ20.pdf	/app/backend/uploads/document-1770387203395-482482234.pdf	151500	application/pdf	f15bc97c2408c139781f29c1ecc4bee5dd41ddcb83c1fc4898deed30aa204e57	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:23.476082	t	2026-02-06 14:13:23.591897	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreihrlpexyjaiye4xqhzjyhwmjpxf3va53s4dyh6ergg65uykuicok4
66604f60-cef9-4445-bdaa-17739215d215	aac4dc07-379b-4cdc-9250-6e80aaed676a	sales_invoice	document-1770387203349-122881797.pdf	Sales_Invoice_INV-20260206-TVXFE6.pdf	/app/backend/uploads/document-1770387203349-122881797.pdf	104109	application/pdf	400efd81e32183d032bbeb627bc99982ced149276571c756c5a86f6331e03b54	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:23.386371	t	2026-02-06 14:13:23.597195	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreicab36ydyzbqpidfo7lmj54tgmcz3iusj3fohdvnrnin5rtdyb3kq
8dc6170e-0196-4524-825d-d6b2d9ba085b	c8babe0e-e748-4942-9025-53c1600a476f	hpg_clearance	document-1770394551482-851636087.pdf	HPG_Clearance_HPG-2026-WML72K.pdf	/app/backend/uploads/document-1770394551482-851636087.pdf	57168	application/pdf	006c2e21a11ca0fbabe881d8c0a1308b9cc0fd12b682b4cf678c01f7b2d58705	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:51.533108	f	\N	\N	f	\N	bafkreiaanqxcdii4ud52x2eb3dakcmelttap2evwqk2m6z4mah33fvmhau
39f9441e-3835-46b4-b2b6-35b3ee449206	c8babe0e-e748-4942-9025-53c1600a476f	csr	document-1770394551530-893690877.pdf	CSR_CSR-2026-KBQ1PB.pdf	/app/backend/uploads/document-1770394551530-893690877.pdf	152024	application/pdf	891e7a75947e0fe2cd3432b14beec20a611d4aae95f5d42fbf002ba909d371fc	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:51.570795	t	2026-02-06 16:15:51.753495	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreiejdz5hlfd6b7rm2nbswff65qqkmeouvluv6xkc7pyafouqtu3r7q
d1e32853-e366-4dae-ae86-02455e5f0857	d50832ba-fd65-497c-8e23-cfef1850df37	owner_id	document-1770473894844-801333425.jpg	driver.jpg	/app/backend/uploads/document-1770473894844-801333425.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	\N	2026-02-07 14:18:14.872677	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
a3cd7e1e-5f51-483e-86db-4a896a36eb30	d50832ba-fd65-497c-8e23-cfef1850df37	owner_id	document-1770473898820-925120209.pdf	HPG_Clearance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	/app/backend/uploads/document-1770473898820-925120209.pdf	56253	application/pdf	57005039c7f7a3b2630056eff12c3a95b27983e6a146e66b88817430f7f3d174	\N	2026-02-07 14:18:18.842126	f	\N	\N	f	\N	bafkreicxabidtr7xuozggacw57ysyouvwj4yhzvbi3tgxceboqypp46roq
5fb90591-9982-4d9e-898f-b23b64a984dd	c8babe0e-e748-4942-9025-53c1600a476f	owner_id	document-1770394551553-317877638.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770394551553-317877638.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:51.631636	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
12d29645-ed1a-4430-9479-929eee59b043	c8babe0e-e748-4942-9025-53c1600a476f	insurance_cert	document-1770394551579-489333329.pdf	Insurance_Certificate_CTPL-2026-OGQYZB.pdf	/app/backend/uploads/document-1770394551579-489333329.pdf	68942	application/pdf	bef0eee618c3d2112baaea78b231c3642323475085450654589d1aaa7682d403	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:51.633309	f	\N	\N	f	\N	bafkreif66dxomggd2iisxkxkpczddq3eemruouefiudfiwe5dkvhnawuam
e1fbac56-013a-4062-83c4-40e945179514	c8babe0e-e748-4942-9025-53c1600a476f	sales_invoice	document-1770394551585-606488072.pdf	Sales_Invoice_INV-20260206-DE4F8P.pdf	/app/backend/uploads/document-1770394551585-606488072.pdf	103362	application/pdf	f7bf019bcbdc2e5b5a4f25c865227c279be0721707d52fc386e3994fee47ec7f	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:51.634283	t	2026-02-06 16:15:51.749172	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreihxx4azxs64fznvutzfzbsse7bhtpqhefyh2ux4hbxdtfh64r7mp4
fdb73ee2-5d95-4bc6-90d9-8cab2ef145fe	c8babe0e-e748-4942-9025-53c1600a476f	deed_of_sale	Deed_of_Sale_c8babe0e-e748-4942-9025-53c1600a476f.pdf	Deed_of_Sale_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/uploads/temp/transfer-cert-1770394840440-jl7o1q.pdf	84465	application/pdf	32fe20eee7a0b91fe0cb5734b242326de7be245499630965db23290be3c20578	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-06 16:20:40.466802	f	\N	\N	f	\N	bafkreibs7yqo5z5axep6bs2xgszeemtn467civezmmewlwzdfef6hqqfpa
f0469ac5-61a4-473b-89c8-7e2743aa4120	c8babe0e-e748-4942-9025-53c1600a476f	hpg_clearance	HPG_Clearance_c8babe0e-e748-4942-9025-53c1600a476f.pdf	HPG_Clearance_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/uploads/temp/transfer-cert-1770394843829-h6dlnc.pdf	56247	application/pdf	211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-06 16:20:43.856086	f	\N	\N	f	\N	bafkreibbdfc2i4edncyd6scpaz2k3t75ehdrgdkgiz3huiodvhpkcyrs5a
f7ed07c3-31ec-443f-8dd8-644139b51a2b	c8babe0e-e748-4942-9025-53c1600a476f	insurance_cert	CTPL_Insurance_c8babe0e-e748-4942-9025-53c1600a476f.pdf	CTPL_Insurance_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/uploads/temp/transfer-cert-1770394847935-w64a2t.pdf	68640	application/pdf	6ff47acba700fca813a94c9eb94fb8bc05b2a54fd83f5e89038b7a2c2e5ca2ca	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-06 16:20:47.962629	f	\N	\N	f	\N	bafkreidp6r5mxjya7subhkkmt24u7of4awzkkt6yh5pisa4lpiwc4xfczi
d1ba8157-3849-4c81-b7b5-80910973c09f	aac4dc07-379b-4cdc-9250-6e80aaed676a	deed_of_sale	document-1770394876257-256092816.pdf	Deed_of_Sale_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/backend/uploads/document-1770394876257-256092816.pdf	84465	application/pdf	32fe20eee7a0b91fe0cb5734b242326de7be245499630965db23290be3c20578	\N	2026-02-06 16:21:16.281923	f	\N	\N	f	\N	bafkreibs7yqo5z5axep6bs2xgszeemtn467civezmmewlwzdfef6hqqfpa
f76727bf-ef89-4e39-82f5-0eeff6307b69	aac4dc07-379b-4cdc-9250-6e80aaed676a	seller_id	document-1770394884607-654427971.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770394884607-654427971.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	\N	2026-02-06 16:21:24.628463	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
4aee0ff6-0e2d-45ac-b768-7980cb92e64d	c8babe0e-e748-4942-9025-53c1600a476f	deed_of_sale	document-1770394935767-491617312.pdf	Deed_of_Sale_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/backend/uploads/document-1770394935767-491617312.pdf	84465	application/pdf	32fe20eee7a0b91fe0cb5734b242326de7be245499630965db23290be3c20578	\N	2026-02-06 16:22:15.791247	f	\N	\N	f	\N	bafkreibs7yqo5z5axep6bs2xgszeemtn467civezmmewlwzdfef6hqqfpa
55f12808-7666-4c77-bb5f-eaa09322a206	c8babe0e-e748-4942-9025-53c1600a476f	deed_of_sale	document-1770394986842-47240475.pdf	Deed_of_Sale_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/backend/uploads/document-1770394986842-47240475.pdf	84465	application/pdf	32fe20eee7a0b91fe0cb5734b242326de7be245499630965db23290be3c20578	\N	2026-02-06 16:23:06.864074	f	\N	\N	f	\N	bafkreibs7yqo5z5axep6bs2xgszeemtn467civezmmewlwzdfef6hqqfpa
1178cf62-2cb3-4756-b004-aaa2ff418437	c8babe0e-e748-4942-9025-53c1600a476f	seller_id	document-1770394992589-131359234.png	sales-invoice.png	/app/backend/uploads/document-1770394992589-131359234.png	556782	image/png	887b84f1a8706944fdd04d308d56fde0fa91b7ce0e1fb1cc7a8919b9accaf23d	\N	2026-02-06 16:23:12.63123	f	\N	\N	f	\N	bafybeia2mkkeb6vgjdtbdzk4ofkjrposopipvgwkmid2t27kjk3epm5lse
7d6e57fa-493f-4292-bccd-10464837ea5f	c8babe0e-e748-4942-9025-53c1600a476f	buyer_id	document-1770395048091-620747312.jpg	download (3).jpg	/app/backend/uploads/document-1770395048091-620747312.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-06 16:24:08.111882	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
b0f0e49b-4c27-447d-8943-9cb0bfa8ecc3	c8babe0e-e748-4942-9025-53c1600a476f	owner_id	document-1770395053095-596892064.jpg	download (4).jpg	/app/backend/uploads/document-1770395053095-596892064.jpg	108204	image/jpeg	424b7de930c353c8af2071e5df0fe433bd57bace990c51843b42ff939ed8a3b6	\N	2026-02-06 16:24:13.124494	f	\N	\N	f	\N	bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy
023698c1-3747-47df-af38-bae074d03846	c8babe0e-e748-4942-9025-53c1600a476f	hpg_clearance	document-1770395057032-500539986.pdf	HPG_Clearance_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/backend/uploads/document-1770395057032-500539986.pdf	56247	application/pdf	211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8	\N	2026-02-06 16:24:17.054638	f	\N	\N	f	\N	bafkreibbdfc2i4edncyd6scpaz2k3t75ehdrgdkgiz3huiodvhpkcyrs5a
0e02102b-9ff6-43a3-a266-d8b3ffbf9d70	c8babe0e-e748-4942-9025-53c1600a476f	insurance_cert	document-1770395060756-778808974.pdf	CTPL_Insurance_c8babe0e-e748-4942-9025-53c1600a476f.pdf	/app/backend/uploads/document-1770395060756-778808974.pdf	68640	application/pdf	6ff47acba700fca813a94c9eb94fb8bc05b2a54fd83f5e89038b7a2c2e5ca2ca	\N	2026-02-06 16:24:20.813257	f	\N	\N	f	\N	bafkreidp6r5mxjya7subhkkmt24u7of4awzkkt6yh5pisa4lpiwc4xfczi
32c29922-8de9-49c0-9d38-398353227dda	d50832ba-fd65-497c-8e23-cfef1850df37	insurance_cert	document-1770473902678-673306519.pdf	CTPL_Insurance_d50832ba-fd65-497c-8e23-cfef1850df37.pdf	/app/backend/uploads/document-1770473902678-673306519.pdf	69373	application/pdf	64576488a82bfe6f76f96f5245e7e13d38f47d9c0671d3cdbf64c066f072bf62	\N	2026-02-07 14:18:22.703156	f	\N	\N	f	\N	bafkreidek5sirkbl7zxxn6lpkjc6pyj5hd2h3hagohj43p3eybtpa4v7mi
31e0bda2-0c74-4132-9eef-228c911c9d4d	47916952-a48c-486a-8421-014905e38968	hpg_clearance	document-1770398269958-448241581.pdf	HPG_Clearance_HPG-2026-IQ7T5V.pdf	/app/backend/uploads/document-1770398269958-448241581.pdf	56887	application/pdf	8920a4a68797687fcf3a287a64d4867c278e571742277d1f70b454bb2b81609b	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:49.98495	f	\N	\N	f	\N	bafkreiejecsknb4xnb746oripjsnjbt4e6hfof2ce56r64fuks5sxalatm
7f494d3d-4243-4dd0-812b-4c8919194ac0	47916952-a48c-486a-8421-014905e38968	csr	document-1770398270001-599435997.pdf	CSR_CSR-2026-EH5ZJ4.pdf	/app/backend/uploads/document-1770398270001-599435997.pdf	150723	application/pdf	53e330c12bee5556790dc010758d6bd8c1b7424283d528aabce9f15a880df19c	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:50.025903	t	2026-02-06 17:17:50.197797	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreict4mymck7okvlhsdoacb2y226yyg3uequd2uukvphj6fniqdprtq
a011fe54-4e9f-4591-8c3e-b2afb51f1f35	aac4dc07-379b-4cdc-9250-6e80aaed676a	deed_of_sale	Deed_of_Sale_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	Deed_of_Sale_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	/app/uploads/temp/transfer-cert-1770479189020-7yyh8e.pdf	85112	application/pdf	4f0271ee027fa1c9cb8dde430c5397c1837431b8e4e2d613c615ab1b53c572f2	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 15:46:29.06917	f	\N	\N	f	\N	bafkreicpajy64at7uhe4xdo6imgfhf6bqn2ddohe4llbhrqvvmnvhrls6i
116a4497-aff3-47ff-ac49-f02cbb16c2cb	47916952-a48c-486a-8421-014905e38968	owner_id	document-1770398270016-575971889.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770398270016-575971889.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:50.041943	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
af65b42a-981f-468f-b781-09215825ae73	47916952-a48c-486a-8421-014905e38968	insurance_cert	document-1770398270034-881915683.pdf	Insurance_Certificate_CTPL-2026-F8L8LU.pdf	/app/backend/uploads/document-1770398270034-881915683.pdf	68666	application/pdf	d5cb10c1d7d836bc8a2ea4edaef42125a70ae1a2e1be637dfd0a9de4a15c17ba	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:50.089898	f	\N	\N	f	\N	bafkreigvzmimdv6yg26iulve5wxpiijfu4fodixbxzrx37iktxskcxaxxi
2971c217-5583-43b5-b584-c01b9e71590e	47916952-a48c-486a-8421-014905e38968	sales_invoice	document-1770398270012-504057695.pdf	Sales_Invoice_INV-20260206-KW0YUJ.pdf	/app/backend/uploads/document-1770398270012-504057695.pdf	103392	application/pdf	7b28f936acb274e93a7b0c69ed08dc7aa3a41213569d471e33bfb821c6d8e6c8	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:50.032	t	2026-02-06 17:17:50.194407	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreid3fd4tnlfsotutu6ymnhwqrxd2uosbee2wtvdr4m57xaq4nwhgza
fefd5349-74ae-4f3b-8c76-b44e7dab2903	ed358d5a-ac0d-4a12-b593-8251152c9457	insurance_cert	document-1770452323887-352497392.pdf	Insurance_Certificate_CTPL-2026-2JJ4CI.pdf	/app/backend/uploads/document-1770452323887-352497392.pdf	69319	application/pdf	f611bc18693b06edd3d87dc24233736095f75125165490b2360d45988c5932c1	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:43.917635	f	\N	\N	f	\N	bafkreihwcg6bq2j3a3w5hwd5yjbdg43asx3vcjiwksilenqniwmiywjsye
90a99c50-422e-4ae9-a613-7bd32e10d577	ed358d5a-ac0d-4a12-b593-8251152c9457	hpg_clearance	document-1770452323934-542495295.pdf	HPG_Clearance_HPG-2026-NVJX05.pdf	/app/backend/uploads/document-1770452323934-542495295.pdf	57558	application/pdf	170b1cdae041da4baa522bb395d9e94b87522c8fae930377d507c06bc155ee3e	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:43.956869	f	\N	\N	f	\N	bafkreiaxbmonvycb3jf2uurlwok5t2klq5jczd5osmbxpvihybv4cvpohy
881d2a45-c32f-4ec8-aeb9-0b2b742ee065	ed358d5a-ac0d-4a12-b593-8251152c9457	owner_id	document-1770452324058-373998127.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770452324058-373998127.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.079455	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
46338027-60c6-451c-afdb-de3d120305a8	ed358d5a-ac0d-4a12-b593-8251152c9457	sales_invoice	document-1770452324033-638946888.pdf	Sales_Invoice_INV-20260207-PW1URI.pdf	/app/backend/uploads/document-1770452324033-638946888.pdf	104111	application/pdf	464cb449496a072ec4883638304efba023d2df5aa334813b69cbc96b7671690f	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.059856	t	2026-02-07 08:18:44.189348	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreicgjs2esslka4xmjcbwhaye565aepjn6wvdgsatw2olzfvxm4ljb4
fee5b21c-fc3b-46aa-a93b-b69314635aa1	ed358d5a-ac0d-4a12-b593-8251152c9457	csr	document-1770452323983-969500965.pdf	CSR_CSR-2026-CH242N.pdf	/app/backend/uploads/document-1770452323983-969500965.pdf	151378	application/pdf	8e7e9c26dcded7d6fe181453b5b11a23f9b8ccb152f45dfeebd20d6c206ee51b	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.000825	t	2026-02-07 08:18:44.192603	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreieop2ocnxg627lp4gauko23cgrd7g4mzmks6ro7526sbvwca3xfdm
a497ec7d-a07c-40e6-953a-37cd3a38e63e	ed358d5a-ac0d-4a12-b593-8251152c9457	deed_of_sale	Deed_of_Sale_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	Deed_of_Sale_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/uploads/temp/transfer-cert-1770452657015-8g010f.pdf	84769	application/pdf	4f7899379880f90e86bbbc4c6c3d6c33f6ef4ba7442a29dbc91ca99d74780f1b	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 08:24:17.045234	f	\N	\N	f	\N	bafkreicppcmtpgea7ehino54jrwd23bt63xuxj2efiu5xsi4vgoxi6apdm
42150425-4e7b-47a0-ac87-0b16c0a13b03	ed358d5a-ac0d-4a12-b593-8251152c9457	hpg_clearance	HPG_Clearance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	HPG_Clearance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/uploads/temp/transfer-cert-1770452660613-epdpt8.pdf	56819	application/pdf	7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 08:24:20.635304	f	\N	\N	f	\N	bafkreidzthapgtjdghsu3jnb5b6rg2zf75rpzdaivizwkshjnfftnspo7i
668ef130-fb0b-464d-917f-389db4aa800a	ed358d5a-ac0d-4a12-b593-8251152c9457	insurance_cert	CTPL_Insurance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	CTPL_Insurance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/uploads/temp/transfer-cert-1770452664914-ghpvzd.pdf	69651	application/pdf	80ed2c25240fb6eeed2ff9002779cf2fac931a0f3f582aecea91876e4002ec76	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 08:24:24.935839	f	\N	\N	f	\N	bafkreiea5uwckjapw3xo2l7zaatxttzpvsjrudz7lavoz2urq5xeaaxmoy
80b2500a-37e3-4ba1-b34e-28fb7c132c30	ed358d5a-ac0d-4a12-b593-8251152c9457	deed_of_sale	document-1770452709531-771220756.pdf	Deed_of_Sale_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/backend/uploads/document-1770452709531-771220756.pdf	84769	application/pdf	4f7899379880f90e86bbbc4c6c3d6c33f6ef4ba7442a29dbc91ca99d74780f1b	\N	2026-02-07 08:25:09.5543	f	\N	\N	f	\N	bafkreicppcmtpgea7ehino54jrwd23bt63xuxj2efiu5xsi4vgoxi6apdm
d9bacc27-7a98-4798-b895-41da53f1857d	ed358d5a-ac0d-4a12-b593-8251152c9457	seller_id	document-1770452716546-883041460.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770452716546-883041460.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	\N	2026-02-07 08:25:16.574834	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
c364b6b2-4b92-4b2e-8833-c4e4972a6805	ed358d5a-ac0d-4a12-b593-8251152c9457	buyer_id	document-1770452743781-692765296.jpg	download (3).jpg	/app/backend/uploads/document-1770452743781-692765296.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-07 08:25:43.808663	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
66aee559-1341-4cb4-9275-d1eb886fbb04	ed358d5a-ac0d-4a12-b593-8251152c9457	owner_id	document-1770452747173-431454562.jpg	download (4).jpg	/app/backend/uploads/document-1770452747173-431454562.jpg	108204	image/jpeg	424b7de930c353c8af2071e5df0fe433bd57bace990c51843b42ff939ed8a3b6	\N	2026-02-07 08:25:47.196998	f	\N	\N	f	\N	bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy
f1ae7553-08be-4045-94f7-fc803305947e	ed358d5a-ac0d-4a12-b593-8251152c9457	hpg_clearance	document-1770452751362-846854512.pdf	HPG_Clearance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/backend/uploads/document-1770452751362-846854512.pdf	56819	application/pdf	7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa	\N	2026-02-07 08:25:51.383102	f	\N	\N	f	\N	bafkreidzthapgtjdghsu3jnb5b6rg2zf75rpzdaivizwkshjnfftnspo7i
a4c57d59-fd65-424c-83e1-2b5dc9486d8f	ed358d5a-ac0d-4a12-b593-8251152c9457	insurance_cert	document-1770452756889-108653372.pdf	CTPL_Insurance_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/backend/uploads/document-1770452756889-108653372.pdf	69651	application/pdf	80ed2c25240fb6eeed2ff9002779cf2fac931a0f3f582aecea91876e4002ec76	\N	2026-02-07 08:25:56.913789	f	\N	\N	f	\N	bafkreiea5uwckjapw3xo2l7zaatxttzpvsjrudz7lavoz2urq5xeaaxmoy
35173f7f-2793-4bca-af4b-094574d5d608	47916952-a48c-486a-8421-014905e38968	deed_of_sale	document-1770464189891-138267261.pdf	Deed_of_Sale_ed358d5a-ac0d-4a12-b593-8251152c9457.pdf	/app/backend/uploads/document-1770464189891-138267261.pdf	84769	application/pdf	4f7899379880f90e86bbbc4c6c3d6c33f6ef4ba7442a29dbc91ca99d74780f1b	\N	2026-02-07 11:36:29.97571	f	\N	\N	f	\N	bafkreicppcmtpgea7ehino54jrwd23bt63xuxj2efiu5xsi4vgoxi6apdm
d37c9482-8eba-4cfc-8c91-887251dd59dc	47916952-a48c-486a-8421-014905e38968	seller_id	document-1770464249589-933999852.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770464249589-933999852.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	\N	2026-02-07 11:37:29.61718	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
abf7c010-454d-4399-953f-de25b7c91c71	aac4dc07-379b-4cdc-9250-6e80aaed676a	hpg_clearance	HPG_Clearance_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	HPG_Clearance_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	/app/uploads/temp/transfer-cert-1770479192628-29v2tf.pdf	55935	application/pdf	d3daa401e9f104d9175d97875df843e536e8bcf27a4acac08b3fda5cea5e34c2	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 15:46:32.774435	f	\N	\N	f	\N	bafkreigt3ksad2pratmroxmxq5o7qq7fg3ulz4t2jlfmbcz73joouxruyi
ae17400c-a601-45cb-97f7-0eafa74b4a09	aac4dc07-379b-4cdc-9250-6e80aaed676a	insurance_cert	CTPL_Insurance_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	CTPL_Insurance_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	/app/uploads/temp/transfer-cert-1770479197017-n0ryir.pdf	69734	application/pdf	8cca8891002ce50224284caa91ccd167f68c25d8580244d4908299ee0fd2a18e	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 15:46:37.039162	f	\N	\N	f	\N	bafkreiemzkejcabm4ubcikcmvki4zulh62gclwcyajcnjeecthxa7uvbry
580843d6-7d9b-4b2c-88c9-b1c26fbc8a76	9227a1b3-9b77-4506-a2c5-068827b86f6d	hpg_clearance	document-1770465282087-791143146.pdf	HPG_Clearance_HPG-2026-DL6BGF.pdf	/app/backend/uploads/document-1770465282087-791143146.pdf	56514	application/pdf	903bced1bd2870f0b38e725a8fb40a8e0fadb91212bb387914b6f7cda76dcd08	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:42.172549	f	\N	\N	f	\N	bafkreieqhphndpjiodylhdtslkh3icuob6w3seqsxm4hsffw67g2o3onba
4ea70109-9838-4d82-bc7a-c1d326f7e89a	9227a1b3-9b77-4506-a2c5-068827b86f6d	owner_id	document-1770465282164-844135389.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770465282164-844135389.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:42.27278	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
4d40a661-42f9-4eb8-baf2-4a6f98696111	9227a1b3-9b77-4506-a2c5-068827b86f6d	insurance_cert	document-1770465282200-297485345.pdf	Insurance_Certificate_CTPL-2026-IOQ9U2.pdf	/app/backend/uploads/document-1770465282200-297485345.pdf	69606	application/pdf	0a35b10e1e2b9c79f73a5a4c1bb8eaf95540105488578878d578112a7750ff35	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:42.280771	f	\N	\N	f	\N	bafkreiakgwyq4hrltr47oos2jqn3r2xzkvabaveik6ehrvlycevhouh7gu
afd45ddd-2974-4a8c-95fd-a6d78debe936	9227a1b3-9b77-4506-a2c5-068827b86f6d	sales_invoice	document-1770465282148-502313390.pdf	Sales_Invoice_INV-20260207-P0RA83.pdf	/app/backend/uploads/document-1770465282148-502313390.pdf	104024	application/pdf	87ee48ccb8f9af973c7f02d25737db43c71e6c746f8d484bea54d2d8e6183ae1	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:42.209454	t	2026-02-07 11:54:42.392052	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreieh5zemzohzv6lty7yc2jltpw2dy4pgy5dprveex2su2lmomgb24e
204afbf8-6546-487b-a180-36960b34227f	9227a1b3-9b77-4506-a2c5-068827b86f6d	csr	document-1770465282132-334247992.pdf	CSR_CSR-2026-Y7XF86.pdf	/app/backend/uploads/document-1770465282132-334247992.pdf	152333	application/pdf	c0e2e66cd50ad91fc7ad5ea55c437f6cf0516a6b4ba775867b89517b565fb896	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:42.191651	t	2026-02-07 11:54:42.395675	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreiga4ltgzvik3ep4plk6uvoeg73m6biwu22lu52ym64jkf5vmx5ysy
99834711-1893-459d-9daf-b039a3c1ba63	d7463eaa-e937-4e14-ac30-a0bb43dc5747	deed_of_sale	Deed_of_Sale_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	Deed_of_Sale_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	/app/uploads/temp/transfer-cert-1770467178785-kn3cdq.pdf	84132	application/pdf	4cabbe6709f94fd517addbc22782ab98aac858f50d2b43af0a34e8b68d7ac0c3	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 12:26:18.879271	f	\N	\N	f	\N	bafkreicmvo7gocpzj7krplo3yityfk4yvlefr5infnb26cru5c3i26waym
07fadee3-79c0-4ecb-b5d9-17dc4a7f9f72	d7463eaa-e937-4e14-ac30-a0bb43dc5747	hpg_clearance	HPG_Clearance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	HPG_Clearance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	/app/uploads/temp/transfer-cert-1770467182266-de2kh.pdf	56247	application/pdf	35a7816e73847c683d80ad1fa4af8402b769ca2038f708756548eaba43610174	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 12:26:22.291778	f	\N	\N	f	\N	bafkreibvu6aw444eprud3afnd6sk7bacw5u4uiby64ehkzki5k5egyiboq
473a40ed-89b1-4ff8-b771-51fcd6d5791a	d7463eaa-e937-4e14-ac30-a0bb43dc5747	insurance_cert	CTPL_Insurance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	CTPL_Insurance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	/app/uploads/temp/transfer-cert-1770467186472-zqunr7.pdf	69393	application/pdf	15144e3b34af282c1ef1e22d70e9cf15f122cc3a956b333546923732a51cc9a1	e71fccc9-57c4-42c5-9a59-324078118fda	2026-02-07 12:26:26.496733	f	\N	\N	f	\N	bafkreiavcrhdwnfpfawb54pcfvyottyv6ermyouvnmztkrusg4zkkhgjue
72f487ed-fed0-4d71-bd64-339bf18cc93b	9227a1b3-9b77-4506-a2c5-068827b86f6d	deed_of_sale	document-1770467445623-510997639.pdf	Deed_of_Sale_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	/app/backend/uploads/document-1770467445623-510997639.pdf	84132	application/pdf	4cabbe6709f94fd517addbc22782ab98aac858f50d2b43af0a34e8b68d7ac0c3	\N	2026-02-07 12:30:45.650277	f	\N	\N	f	\N	bafkreicmvo7gocpzj7krplo3yityfk4yvlefr5infnb26cru5c3i26waym
dd4c74af-79de-415b-abca-210d7686e2be	9227a1b3-9b77-4506-a2c5-068827b86f6d	seller_id	document-1770467696446-359824845.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770467696446-359824845.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	\N	2026-02-07 12:34:56.469684	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
dcee11c3-cd27-4a2b-8964-39051a423831	47916952-a48c-486a-8421-014905e38968	buyer_id	document-1770469315916-907970565.jpg	download (3).jpg	/app/backend/uploads/document-1770469315916-907970565.jpg	88117	image/jpeg	b7652be59de5f8c4b8f5dc121089641b92befdd46c23b33814972c1010f45cd4	\N	2026-02-07 13:01:55.955507	f	\N	\N	f	\N	bafkreifxmuv6lhpf7dclr5o4ciiisza3sk7p3vdmeoztqfexfqibb5c42q
4dd1263e-9ae0-49a5-aec1-295949b1abba	47916952-a48c-486a-8421-014905e38968	owner_id	document-1770469320793-965638488.jpg	download (4).jpg	/app/backend/uploads/document-1770469320793-965638488.jpg	108204	image/jpeg	424b7de930c353c8af2071e5df0fe433bd57bace990c51843b42ff939ed8a3b6	\N	2026-02-07 13:02:00.816937	f	\N	\N	f	\N	bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy
dfd2a30d-ffa0-4457-9784-9a3596988f2a	47916952-a48c-486a-8421-014905e38968	hpg_clearance	document-1770469324273-278332018.pdf	HPG_Clearance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	/app/backend/uploads/document-1770469324273-278332018.pdf	56247	application/pdf	35a7816e73847c683d80ad1fa4af8402b769ca2038f708756548eaba43610174	\N	2026-02-07 13:02:04.294199	f	\N	\N	f	\N	bafkreibvu6aw444eprud3afnd6sk7bacw5u4uiby64ehkzki5k5egyiboq
6c7cd31c-23cf-44c5-842a-5bb33970fe4e	47916952-a48c-486a-8421-014905e38968	insurance_cert	document-1770469327699-557192481.pdf	CTPL_Insurance_d7463eaa-e937-4e14-ac30-a0bb43dc5747.pdf	/app/backend/uploads/document-1770469327699-557192481.pdf	69393	application/pdf	15144e3b34af282c1ef1e22d70e9cf15f122cc3a956b333546923732a51cc9a1	\N	2026-02-07 13:02:07.717816	f	\N	\N	f	\N	bafkreiavcrhdwnfpfawb54pcfvyottyv6ermyouvnmztkrusg4zkkhgjue
406959eb-fc72-4e7d-8767-149342941918	d50832ba-fd65-497c-8e23-cfef1850df37	hpg_clearance	document-1770473268752-279947645.pdf	HPG_Clearance_HPG-2026-4WRSAB.pdf	/app/backend/uploads/document-1770473268752-279947645.pdf	56421	application/pdf	84f146e8e33fa98f2c80d52feddc69514eb510082db08e946a197faa80184122	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:48.782324	f	\N	\N	f	\N	bafkreiee6fdoryz7vghszagvf7w5y2krj22racbnwchji2qzp6viagcbei
212d09b8-a7b3-484b-b732-26dda84f5456	d50832ba-fd65-497c-8e23-cfef1850df37	insurance_cert	document-1770473268814-464635337.pdf	Insurance_Certificate_CTPL-2026-VAI1IQ.pdf	/app/backend/uploads/document-1770473268814-464635337.pdf	69388	application/pdf	b7f3a7bb4d6c16932122c20348cd5d9d36df56b865ca0fa203456d3d80738832	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:48.858227	f	\N	\N	f	\N	bafkreifx6ot3wtlmc2jsciwcanem2xm5g3pvnodfzih2ea2fnu6ya44igi
ae78ab6e-4b6a-46fc-9948-a4931427bd9c	aac4dc07-379b-4cdc-9250-6e80aaed676a	deed_of_sale	document-1770479238396-997043401.pdf	Deed_of_Sale_aac4dc07-379b-4cdc-9250-6e80aaed676a.pdf	/app/backend/uploads/document-1770479238396-997043401.pdf	85112	application/pdf	4f0271ee027fa1c9cb8dde430c5397c1837431b8e4e2d613c615ab1b53c572f2	\N	2026-02-07 15:47:18.435028	f	\N	\N	f	\N	bafkreicpajy64at7uhe4xdo6imgfhf6bqn2ddohe4llbhrqvvmnvhrls6i
637a858b-b7ab-4bb1-98de-fceb952f6c26	aac4dc07-379b-4cdc-9250-6e80aaed676a	seller_id	document-1770479246002-124915873.jpg	e8eda5ed-8394-4083-81b0-3b570f3a9561.jpg	/app/backend/uploads/document-1770479246002-124915873.jpg	141782	image/jpeg	e8fac33ed5e69b4adc23dbd510dcd62ffa64685ff0aeb240a2d0ff9fb1424746	\N	2026-02-07 15:47:26.028846	f	\N	\N	f	\N	bafkreihi7lbt5vpgtnfnyi632uinzvrp7jsgqx7qv2zebiwq76p3cqshiy
ed311054-8f27-4335-b3f9-36c46607d095	d50832ba-fd65-497c-8e23-cfef1850df37	owner_id	document-1770473268964-968756169.jpg	driver.jpg	/app/backend/uploads/document-1770473268964-968756169.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:48.985048	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
c280bbdb-b733-491c-89bc-e1608f9947dd	d50832ba-fd65-497c-8e23-cfef1850df37	csr	document-1770473268918-995520139.pdf	CSR_CSR-2026-WDXM40.pdf	/app/backend/uploads/document-1770473268918-995520139.pdf	151695	application/pdf	119fc6eb1e73817c12b0c3688c4947e1461dd44145235e35690a584d87e486f9	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:48.977797	t	2026-02-07 14:07:49.105245	36b86e7e-7668-49dc-8dd6-6610ce092a73	f	\N	bafkreiart7dowhttqf6bfmgdncgesr7biyo5iqkfenpdk2iklbgypzeg7e
5bef6221-48bb-4846-9704-8e8025c3167b	d50832ba-fd65-497c-8e23-cfef1850df37	sales_invoice	document-1770473268865-164308686.pdf	Sales_Invoice_INV-20260207-JEVTUZ.pdf	/app/backend/uploads/document-1770473268865-164308686.pdf	103861	application/pdf	5b4d85bbedd0591df16782473d6091cbc1f32c8121e729568953a6e435c0244e	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:48.881408	t	2026-02-07 14:07:49.108512	36b86e7e-7668-49dc-8dd6-6610ce092a73	f	\N	bafkreic3jwc3x3oqleo7cz4ci46wbeolyhzszajb44uvncktu3sdlqbejy
94c203c1-ab31-41b9-8482-1a28011d4882	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	insurance_cert	document-1770518800502-96115874.pdf	Insurance_Certificate_CTPL-2026-JXP007.pdf	/app/backend/uploads/document-1770518800502-96115874.pdf	69450	application/pdf	71e8f9e776b09c876e16a8c04eef7e4fd76ae897fd038e539cf61029539ead0a	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:40.571762	f	\N	\N	f	\N	bafkreidr5d46o5vqtsdw4fviybho67sp25vorf75aohfhhhwcauvhhvnbi
8713456c-2b83-49e5-8aeb-1b5c209e546f	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	owner_id	document-1770518800505-143704273.jpg	download (4).jpg	/app/backend/uploads/document-1770518800505-143704273.jpg	108204	image/jpeg	424b7de930c353c8af2071e5df0fe433bd57bace990c51843b42ff939ed8a3b6	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:40.622193	f	\N	\N	f	\N	bafkreiccjn66smgdkpek6idr4xpq7zbtxvl3vtuzbriyio2c76jz5wfdwy
f7d6f390-b94e-41a2-85f4-aafda43ff3cf	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	csr	document-1770518800499-923450736.pdf	CSR_CSR-2026-OFUR03.pdf	/app/backend/uploads/document-1770518800499-923450736.pdf	151956	application/pdf	e61184b70d3035d5f9c561cb390423f0d292b5bb2b4a9df41db6c3bb5b7b6805	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:40.56156	t	2026-02-08 02:46:40.740536	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreihgcgclodjqgxk7trlbzm4qii7q2kjllozljko7ihnwyo5vw63iau
b9be78b6-19e6-42b7-8296-820584f2ba10	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	sales_invoice	document-1770518800476-590612385.pdf	Sales_Invoice_INV-20260208-O6TF0U.pdf	/app/backend/uploads/document-1770518800476-590612385.pdf	104607	application/pdf	feb6fc14179d7a8f9a7d747dd569576f0e0139f7be7fd3626fd876e0ecd0985d	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:40.546085	t	2026-02-08 02:46:40.744553	5a672d9b-dabc-4778-b380-7587dadab040	f	\N	bafkreih6w36bif45pkhzu7lupxkwsv3pbyatt556p7jwe36yo3qozueylu
4c7d8b2a-3ff3-4a19-a13a-dbbec6bff494	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	seller_id	document-1770520765945-176546183.jpg	driver.jpg	/app/backend/uploads/document-1770520765945-176546183.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	\N	2026-02-08 03:19:25.978095	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
8ea1d7e0-dc13-4803-8ea4-9a633c495a98	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	buyer_id	document-1770520796263-613041970.jpg	driver.jpg	/app/backend/uploads/document-1770520796263-613041970.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	\N	2026-02-08 03:19:56.290276	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
1814ce67-ee43-41a7-8f7f-db919acd0f70	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	owner_id	document-1770520802623-701523696.jpg	driver.jpg	/app/backend/uploads/document-1770520802623-701523696.jpg	204486	image/jpeg	7533ea1855116289c7c0e60f81de32b055a809c531db7efab0ccfe993ec2eb8b	\N	2026-02-08 03:20:02.649988	f	\N	\N	f	\N	bafkreidvgpvbqvirmke4pqhgb6a54mvqkwuatrjr3n7pvmgm72mt5qxlrm
6cd2d9f0-0386-49e7-8bc5-b90568d1f4b0	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	owner_id	document-1770520809532-732029539.pdf	HPG_Clearance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	/app/backend/uploads/document-1770520809532-732029539.pdf	56233	application/pdf	81e333023dbe4662076d7ba1e6e72a98288c4d13d1a265844301070418427bf5	\N	2026-02-08 03:20:09.55377	f	\N	\N	f	\N	bafkreieb4mzqepn6izrao3l3uhtookuyfcge2e6rujsyiqyba4cbqqt36u
80adf8b6-9689-4fad-8cf7-babc55fcdf14	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	insurance_cert	document-1770520815344-534663371.pdf	CTPL_Insurance_4651a545-fdfc-4506-8a8f-1cc3ce7b20f3.pdf	/app/backend/uploads/document-1770520815344-534663371.pdf	69823	application/pdf	4c050a75f3e58e65bf5da5b09756f4964b1a7f177345fbbf46dd5a82d8a6beac	\N	2026-02-08 03:20:15.367031	f	\N	\N	f	\N	bafkreicmaufhl47frzs36xnfwclvn5ewjmnh6f3tix536rw5lkbnrjv6vq
\.


--
-- TOC entry 3971 (class 0 OID 16615)
-- Dependencies: 221
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.email_verification_tokens (id, user_id, token_hash, token_secret, expires_at, created_at, used_at, used_by_ip) FROM stdin;
\.


--
-- TOC entry 3972 (class 0 OID 16622)
-- Dependencies: 222
-- Data for Name: expiry_notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.expiry_notifications (id, vehicle_id, user_id, notification_type, sent_at, email_sent, sms_sent) FROM stdin;
\.


--
-- TOC entry 3973 (class 0 OID 16629)
-- Dependencies: 223
-- Data for Name: external_issuers; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.external_issuers (id, issuer_type, company_name, license_number, api_key, is_active, contact_email, contact_phone, address, created_at, updated_at) FROM stdin;
aa6d3111-ad58-47af-a235-c45fa869a133	insurance	LTO Insurance Services	INS-2026-001	test_insurance_api_key_12345	t	insurance@lto.gov.ph	\N	\N	2026-01-24 06:55:24.860016	2026-01-24 06:55:24.860016
f8aab84b-614c-4060-a81c-2f3100daa1c5	emission	LTO Emission Testing Center	EMIT-2026-001	test_emission_api_key_67890	t	emission@lto.gov.ph	\N	\N	2026-01-24 06:55:24.865858	2026-01-24 06:55:24.865858
3d2b139b-df76-4885-afba-a47995b2c134	hpg	PNP-HPG National Office	HPG-2026-001	test_hpg_api_key_abcde	t	hpg@lto.gov.ph	\N	\N	2026-01-24 06:55:24.868123	2026-01-24 06:55:24.868123
e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	Default CSR Issuer	CSR-001-DEFAULT	default-csr-api-key	t	csr@default.com	\N	\N	2026-01-24 19:10:36.880507	2026-01-24 19:10:36.880507
bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	Default Sales Invoice Issuer	SALES-001-DEFAULT	default-sales-api-key	t	sales@default.com	\N	\N	2026-01-24 19:10:36.884664	2026-01-24 19:10:36.884664
\.


--
-- TOC entry 3974 (class 0 OID 16639)
-- Dependencies: 224
-- Data for Name: issued_certificates; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.issued_certificates (id, issuer_id, certificate_type, certificate_number, vehicle_vin, owner_name, owner_id, file_hash, composite_hash, issued_at, expires_at, blockchain_tx_id, is_revoked, revocation_reason, revoked_at, metadata, created_at) FROM stdin;
7956697b-1d56-449a-b68b-20a48c1a2414	\N	csr	CSR-2026-OOVQ91	VFYD3SRG9DYJDAHT2	LTO Pre-Minted (CSR Verified)	\N	8188551b76a2a09e5cac605572ed9533db606a92baa5ab5753eb3e6e1056d769	e877489494cb58fa9f0e57656b601cd83bc4940f780d6f267cfe25a86be605c1	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Brown", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Toyota", "vehicleYear": 2025, "engineNumber": "3UR-FE730776", "vehicleModel": "Corolla Altis"}	2026-02-06 10:02:00.498389
c1301fa3-2c96-4c15-943e-4f03b8727e9b	\N	sales_invoice	INV-20260206-VQGVZR	VFYD3SRG9DYJDAHT2	LTO Pre-Minted (CSR Verified)	\N	666dae13028c28db2b7b0fd594585faee0c24412e83d16387d4a550bbb728087	de4e878e0b9ace11a26f2c299b4cc24d26aba940f60d8286242c141716992d90	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Toyota", "vehicleYear": 2025, "vehicleModel": "Corolla Altis", "invoiceNumber": "INV-20260206-VQGVZR", "purchasePrice": 809048}	2026-02-06 10:02:06.203626
aa01d4ff-9728-43bf-a7b5-7ecb1f0df176	\N	csr	CSR-2026-F0IFQ8	2UM566CX7SXPANBXH	LTO Pre-Minted (CSR Verified)	\N	55ac873d4b19fc6b8676e28485ba4982040f90141e395c6cffd38fdbd481dff7	8a5528001ee509b8a215d61ab0748508a3e68289c21e95d70d3c375cf652fab0	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Red", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Honda", "vehicleYear": 2025, "engineNumber": "4GR-BE888155", "vehicleModel": "Civic"}	2026-02-06 10:57:44.539168
35599ec2-f26c-4be8-8788-965cf565fec6	\N	sales_invoice	INV-20260206-96VR8K	2UM566CX7SXPANBXH	LTO Pre-Minted (CSR Verified)	\N	07974cc4ef9c9d2a9af9643b8656a790c51a07df7bc32a8968b81942a531f7c7	0a15a4fec2f65d1467a87cb450e85db19d63f18a100037ea943a7300e742f2fc	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Honda", "vehicleYear": 2025, "vehicleModel": "Civic", "invoiceNumber": "INV-20260206-96VR8K", "purchasePrice": 1489657}	2026-02-06 10:57:50.435889
a5c691cb-4360-4fc0-b43f-2f8aa9537e4e	\N	csr	CSR-2026-2WPMXV	9BL8DV2DCHUB2R2LT	LTO Pre-Minted (CSR Verified)	\N	c362e5a7b60ece87e8906a1a60480a786d65e56375ddbe58ec891b883fcd9745	729d1e9452a0aa8da522f3af23a07b6018cd769e5b944585d6e6f90d2f8a5593	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Blue", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Hyundai", "vehicleYear": 2022, "engineNumber": "1GR-DE857112", "vehicleModel": "Accent"}	2026-02-06 11:51:47.977808
4cd89203-b724-4396-97a6-37c7ba0b7b49	\N	sales_invoice	INV-20260206-UGJ7AB	9BL8DV2DCHUB2R2LT	LTO Pre-Minted (CSR Verified)	\N	ef1ca2a0867e4c859f002330dcdb6120851d389d20d0de482ca4d3affe8ef724	8aba9c3de2168bb4abfe2309efa31d32b6dd67f5e58b9eac50bc8f6aaee37ae4	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Hyundai", "vehicleYear": 2022, "vehicleModel": "Accent", "invoiceNumber": "INV-20260206-UGJ7AB", "purchasePrice": 875747}	2026-02-06 11:51:54.064062
ed555dad-b437-4196-bd7d-4ef422833289	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-54TPJZ	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	ab42c35b9c9c86d5ce1e68f7d2ebf34d1dd81c7808cee377a25caf602fa4e270	f30c71516c3341a12735071ddb27ae9bfc2ea4a4c8494ddcd41bebcb6008fc92	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 12:24:26.234627
9cbbd20b-7d3e-48be-80f3-8ffdd524041b	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-1QZNQ7	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	4521abe890b42c48f27f48af13d58a1ef4210f2b4aed9eb8f62ed71114232b96	0510207b3878eb128efb0ecb77d176adee5682d1a0c49e494911fc4800792e4d	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "XXT-6053", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 12:24:32.025766
943f8210-17c5-49aa-9a86-42af72aa054a	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-UNSVMD	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	25bd21b967390086ded4f4aa49144088977720b8d2e5abf231b586ef94e848f3	11213673264c7ea86533a1fd5fc372e81b5846aca363c9e83dcdabe21b3278f1	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 12:24:35.225818
b17270da-7d31-41ca-ad86-e68e0301115d	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-55KQGE	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	7ef9f9acd206b9b2240ce99f9ca436ed8479cab9e0f3c32c74f6906eef58021d	bf803e1cb56bc8d4114f0cf5c8ceee910a26a0b5ee4938d20591d975cd5b56e8	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "XXT-6053", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 12:24:40.027687
862451c7-1803-4ea4-bbbc-20e9b25685f6	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-9DH3Z4	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	20472299c65133976fc77cecfc95ade1ef8a76344ff73055c7f32dd28037029e	0d6e41685004cd816f09bd8a884d2d868a3b23e76234cf37a2c54f8f9511de11	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 12:28:50.289467
fa2208a3-fa20-4cb0-a24c-b48ef906b3d7	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-N72FTF	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	0c904ac86f1df6f36b2fe93407e019b99b22975d501a0bbb71eb2dd0be971a78	05af15f6b6be1c4770045e94da4c83a432d11a48b2eb42727f9a082bf2553763	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "XXT-6053", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 12:28:55.395103
bd9e8d31-08f5-4f7d-b8c5-65c2b5a0a6f6	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-S2KAY5	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	f58de614eac9c830f892b3bcfc30647f2f6a45c73d2aff14b21b1123471ad7d5	60e249314a088dd56f93566faa0cd5f081a9fd808ed8771b27d8a65bca552119	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 12:40:11.436286
8453f6a2-c72c-40ef-9d0e-093a67a98652	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-A09ALN	9BL8DV2DCHUB2R2LT	Joshua Ivan Latag	\N	d8f4e855ae8093b54b46c678a8c42fa6bfaef0395900c4bf1136dfe36f3b8c1f	400bb8011317e70549d3ec209f2702d2ffb46855e4910823e2ab193fb2bc4fdc	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "XXT-6053", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 12:40:16.757912
a00ec260-5bed-4222-a5ab-c192d7ed8a09	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-JVH20X	MFXJMZV6W8DWZ8TGK	LTO Pre-Minted (CSR Verified)	\N	41fd42f47c09e5e99af42a5c09fc3ab464a2fe73a959181d50561101515d30c1	a844ef6b86b4e152e865ad9b76802f1e98b9eab7b065f6f957a133431cc873c1	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Red", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Honda", "vehicleYear": 2022, "engineNumber": "3UR-BE565637", "vehicleModel": "Civic"}	2026-02-06 12:45:05.629037
7e05d46e-7cc2-4d42-8094-f5dca88b05dc	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260206-GGMHA8	MFXJMZV6W8DWZ8TGK	LTO Pre-Minted (CSR Verified)	\N	5a2ae6a1d001ed24ba68be8e74acc50bfe2a631fd369242c529c637075dfdc8b	b6d7180bfc339d67069a22c79f16fb5f0db22ada74617b79093bfc4ce03764af	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Honda", "vehicleYear": 2022, "vehicleModel": "Civic", "invoiceNumber": "INV-20260206-GGMHA8", "purchasePrice": 1486727}	2026-02-06 12:45:11.405035
aed3e74d-f2bc-4231-886a-4a61d6b12b69	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-5PTM3M	VFYD3SRG9DYJDAHT2	Jasper Dulla	\N	1b3c32008221c0207116bb8ef75600df9f19aff1e814d78fa5c6a49987cc3fee	70a8e5207afccf4e72bc965cf1b5983b89503170f01ea01ab604154c0ba439c6	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 12:58:32.244456
1aa08114-cc2f-4737-8f5e-d144673e5ac5	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-F2W3W5	VFYD3SRG9DYJDAHT2	Jasper Dulla	\N	ab77df05f887a52c36624723ca413a4b4148c93b7f6fe77922420eba1187207f	3988b68b3eaf62fcf13f6d1ac726e8b5b6eefcee3bff24000a7c5873744b36d0	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "LKF-9216", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 12:58:37.733948
37269faa-adc9-4cef-9872-e4d62c742e7d	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-LG58U4	MFXJMZV6W8DWZ8TGK	Jasper Dulla	\N	2f21b450c681a6cee7e1ee1dd7a6ca854275d141163c2e217a0b47067afff20c	b5fa0658a59d7bc650e76e1ad1b1373c1eb0dcf0c4176d51e9812e2687d8310b	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 12:59:55.535717
01b5e5fb-ec20-409c-a21d-9d28ab8cedf1	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-902GBI	MFXJMZV6W8DWZ8TGK	Jasper Dulla	\N	90793bb591bcac568fb8fb95c1dad4cd7149fb802428e75e17a65cab58a18b01	2d02d2ab5a8ec393ae731946176df0e5298de867c433ac36413befe7d6e39981	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "BXY-6090", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 13:00:00.555758
f3e30741-89ed-46c7-8e88-7bfd8059039d	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-KPZCLL	MFXJMZV6W8DWZ8TGK	Jasper Dulla	\N	9b293eb18f9458f8b056eef43e2933ffea420a4fe9108fa564df1e5011b40379	6da9c37905ed7113aec2dd9c270386037c269df53ead9dc7e0dba6e037bbfcc9	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Joshua Ivan Latag", "purchasePrice": "50000", "originalCertificateType": "deed_of_sale"}	2026-02-06 13:09:42.261253
bb20b338-548e-45f6-b4f3-f0826db71256	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-MTR0GI	MFXJMZV6W8DWZ8TGK	Joshua Ivan Latag	\N	74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025	4e55e7a8b256bb958cf652c1c84ee62c5b7f14670f55d42a8706fd2e25799747	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "BXY-6090", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-06 13:09:45.786865
20c8ff96-0583-4075-8424-5be7f914598d	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-QKLLA4	MFXJMZV6W8DWZ8TGK	Joshua Ivan Latag	\N	acf7bbbd3c522476bb523b52a9dc0820c109dc45fcdc2206cd563ec0384da1ef	dabaf5cda836288b26feffd4570e70a750c251a31dbf9189603652150260648c	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-06 13:09:50.057824
4d533ff1-672b-4ec8-bcc3-299b98fb19cc	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-V8BQ20	3FTF50PTKHZ8EA715	LTO Pre-Minted (CSR Verified)	\N	f15bc97c2408c139781f29c1ecc4bee5dd41ddcb83c1fc4898deed30aa204e57	e2799f4fc82fdbab34349106b13f32943005a231376f694beacab59951dde9e5	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Brown", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Mitsubishi", "vehicleYear": 2022, "engineNumber": "4GR-CE483859", "vehicleModel": "Mirage G4"}	2026-02-06 14:10:15.679456
d75b3269-4c7e-49b9-b0e0-f622cae87435	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260206-TVXFE6	3FTF50PTKHZ8EA715	LTO Pre-Minted (CSR Verified)	\N	400efd81e32183d032bbeb627bc99982ced149276571c756c5a86f6331e03b54	273a51685e5457e1e0f0df46af03ad099960f4ff3e95a1cd2279ebb82125ff1d	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Mitsubishi", "vehicleYear": 2022, "vehicleModel": "Mirage G4", "invoiceNumber": "INV-20260206-TVXFE6", "purchasePrice": 541889}	2026-02-06 14:10:21.941977
1d67820e-b6d8-4929-a59f-6fa9f6fe4e52	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-CE1WZR	3FTF50PTKHZ8EA715	Jasper Dulla	\N	eebdc6499cc233c18340a57c518c63d0685ae3e67886f85cd5e7a613e6443ab4	cc54ca17aefd03100b413c9962397293595bdc0a67e63d2262f30b41c9c1c2f4	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 14:11:10.041933
6e4d03ca-fca9-4376-b353-499798542a5c	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-IC1WZW	3FTF50PTKHZ8EA715	Jasper Dulla	\N	db410c26d4c68aaf54a3b978f9ac73cc978afc458f3d483f4f486eca2d82e790	08dedbaaf2ac282330097f97ab210fe3750cefc8154cd8be27da6dbc308569cc	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "4GR-CE483859", "vehiclePlate": "CCW-6129", "chassisNumber": "WLVFCY822FNW0L0E", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 14:11:14.948796
25b014fa-729d-446b-a64f-ab014846329e	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-KBQ1PB	9S2T7H6CLA91ZMYU5	LTO Pre-Minted (CSR Verified)	\N	891e7a75947e0fe2cd3432b14beec20a611d4aae95f5d42fbf002ba909d371fc	f61858dda0d10e0a8177b788c97d8ff0fec8e0062a7b8320e09ad0770ff0485d	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Silver", "bodyType": "Truck", "fuelType": "Gasoline", "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "5VZ-FE275580", "vehicleModel": "Hilux"}	2026-02-06 16:12:59.829003
bee08b0a-27f6-4e8b-b0be-d4a6fcd156ab	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260206-DE4F8P	9S2T7H6CLA91ZMYU5	LTO Pre-Minted (CSR Verified)	\N	f7bf019bcbdc2e5b5a4f25c865227c279be0721707d52fc386e3994fee47ec7f	865725f8102fd2c297dcfbfeb909364d0657f387c4b48e977f3c9ba24dd71118	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Toyota", "vehicleYear": 2024, "vehicleModel": "Hilux", "invoiceNumber": "INV-20260206-DE4F8P", "purchasePrice": 2462369}	2026-02-06 16:13:06.239081
e3908a11-7aa7-41f8-b718-59f2f0cd1651	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-OGQYZB	9S2T7H6CLA91ZMYU5	Jasper Dulla	\N	bef0eee618c3d2112baaea78b231c3642323475085450654589d1aaa7682d403	097e2b5e5b5de0bc5afcdd567d9dc939b8c12211d65c03f9bc0c14c2ae2e3c22	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 16:14:06.446875
a9d62036-57cb-41b6-94bc-45290967c6e7	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-WML72K	9S2T7H6CLA91ZMYU5	Jasper Dulla	\N	006c2e21a11ca0fbabe881d8c0a1308b9cc0fd12b682b4cf678c01f7b2d58705	f649cf3c349fd3602e13a62bfbe49b824cd5a85d12009b52b88762d5bd954aa9	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "5VZ-FE275580", "vehiclePlate": "EPP-8740", "chassisNumber": "SHWA7GZSPP2G9YFK", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 16:14:11.445949
e30b70c8-368a-4b9b-bf68-90aaef87047e	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-XUYT9Z	9S2T7H6CLA91ZMYU5	Jasper Dulla	\N	32fe20eee7a0b91fe0cb5734b242326de7be245499630965db23290be3c20578	f5e3de39061ad18de3be074fe783a51cc94af9c7b0c3b31a2d9d71ac6427f87c	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Joshua Ivan Latag", "purchasePrice": "50000", "originalCertificateType": "deed_of_sale"}	2026-02-06 16:20:40.474408
a41dc51e-66ad-42b7-a075-07f688f91ff9	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-FBBRI9	9S2T7H6CLA91ZMYU5	Joshua Ivan Latag	\N	211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8	491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-06 16:20:43.860628
36dcf63f-5e9c-4c04-88a6-1d168689d3c2	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-1FIN66	9S2T7H6CLA91ZMYU5	Joshua Ivan Latag	\N	6ff47acba700fca813a94c9eb94fb8bc05b2a54fd83f5e89038b7a2c2e5ca2ca	4695c416f7dacbfac76ff0318f0adde024c625f3dd57e296463421150002fcbb	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-06 16:20:47.967053
57fb9ac9-a531-4fa7-a9fa-6ff2048bd1a6	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-EH5ZJ4	LMJH22V3X6MPEM2VU	LTO Pre-Minted (CSR Verified)	\N	53e330c12bee5556790dc010758d6bd8c1b7424283d528aabce9f15a880df19c	9b459d57d9d9ea3a585a16b08577bfaf4d95283a7b014c22fdecb2f254a1dc71	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"color": "Pearl White", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "5VZ-CE605906", "vehicleModel": "City"}	2026-02-06 17:14:26.592245
457e503c-f4b5-4053-9d2a-7b116d99abaf	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260206-KW0YUJ	LMJH22V3X6MPEM2VU	LTO Pre-Minted (CSR Verified)	\N	7b28f936acb274e93a7b0c69ed08dc7aa3a41213569d471e33bfb821c6d8e6c8	85ad6da07bce90533672e2315e6c88160fef623e1da61dd13db6538ee2644cda	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Honda", "vehicleYear": 2023, "vehicleModel": "City", "invoiceNumber": "INV-20260206-KW0YUJ", "purchasePrice": 1835688}	2026-02-06 17:14:32.495056
9477adfb-8636-44c1-91fc-bbd460564788	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-F8L8LU	LMJH22V3X6MPEM2VU	Jasper Dulla	\N	d5cb10c1d7d836bc8a2ea4edaef42125a70ae1a2e1be637dfd0a9de4a15c17ba	2880f16f4aef9d8f9cda4a1b96a717e096b68fa99d6cbe7e183ab1c4937de385	2026-02-06 00:00:00	2027-02-06 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-06 17:15:40.85222
abb52dec-743c-4a1c-96d7-65e27f2c0746	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-IQ7T5V	LMJH22V3X6MPEM2VU	Jasper Dulla	\N	8920a4a68797687fcf3a287a64d4867c278e571742277d1f70b454bb2b81609b	9947ef1c96172ef2a3674b2bc8c30a3ce6554aa1c8e48fa2a443b7a3ce06a5fa	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "5VZ-CE605906", "vehiclePlate": "EUE-5843", "chassisNumber": "PMASNRXCUS", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-06 17:15:45.832346
b62715e9-cf58-4c32-8fa1-ce60085ae5a6	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-CH242N	7MTTNKS3BFKW7384D	LTO Pre-Minted (CSR Verified)	\N	8e7e9c26dcded7d6fe181453b5b11a23f9b8ccb152f45dfeebd20d6c206ee51b	12ce843854bf568a730a2440b4d489c9eca0a7027da3c3764c87b135a9d5e77e	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"color": "Blue", "bodyType": "Motorcycle", "fuelType": "Gasoline", "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "3UR-FE462946", "vehicleModel": "Click 125"}	2026-02-07 08:15:41.886413
bf391589-c065-4ae9-a832-6a0ead09a22e	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260207-PW1URI	7MTTNKS3BFKW7384D	LTO Pre-Minted (CSR Verified)	\N	464cb449496a072ec4883638304efba023d2df5aa334813b69cbc96b7671690f	6ff372f12795fa255dd1c59c9b0a12485f0cb40818d9b23be4eefbdea9be7395	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Honda", "vehicleYear": 2023, "vehicleModel": "Click 125", "invoiceNumber": "INV-20260207-PW1URI", "purchasePrice": 1074151}	2026-02-07 08:15:48.246966
5384cf02-c718-4ffd-8742-9b04f7d8f855	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-2JJ4CI	7MTTNKS3BFKW7384D	Jasper Dulla	\N	f611bc18693b06edd3d87dc24233736095f75125165490b2360d45988c5932c1	228b0a481de9fb22972792274d4c5aff6ace18587b477351fbc4758e26e50d7b	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-07 08:16:26.137044
07c3f547-0ebf-4c19-b9d3-268c943dc280	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-NVJX05	7MTTNKS3BFKW7384D	Jasper Dulla	\N	170b1cdae041da4baa522bb395d9e94b87522c8fae930377d507c06bc155ee3e	9162ec9abb484b78034e64b5ffc107e60024ea94e092362e69af970f568d50ae	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "3UR-FE462946", "vehiclePlate": "TZK-5341", "chassisNumber": "H8CVHKLX8C4", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-07 08:16:31.010728
fb9721ae-2bd7-4226-8f9b-39faae96a6fc	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-76HEHS	7MTTNKS3BFKW7384D	Jasper Dulla	\N	4f7899379880f90e86bbbc4c6c3d6c33f6ef4ba7442a29dbc91ca99d74780f1b	0424e19a457dd27b4db8abc8b7922405728ea7e9f613660f3965a81ff22c63b6	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Joshua Ivan Latag", "purchasePrice": "50000", "originalCertificateType": "deed_of_sale"}	2026-02-07 08:24:17.054766
3597ba63-34b2-4c00-b51d-d18102fb1c87	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-BS5LYT	7MTTNKS3BFKW7384D	Joshua Ivan Latag	\N	7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa	adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-07 08:24:20.639433
903f3367-2bf7-43ff-aa1a-43cb057dcfec	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-6G8AT1	7MTTNKS3BFKW7384D	Joshua Ivan Latag	\N	80ed2c25240fb6eeed2ff9002779cf2fac931a0f3f582aecea91876e4002ec76	1a57c9076584b0d5ee51b065b3b5b905daaca10c427902a81ce1a09b0e70483c	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-07 08:24:24.940616
1c4652b0-5365-46d8-bb84-3ec86ac55ecf	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-Y7XF86	TE6ATEHZNKBY6N2EK	LTO Pre-Minted (CSR Verified)	\N	c0e2e66cd50ad91fc7ad5ea55c437f6cf0516a6b4ba775867b89517b565fb896	a48e92b4e2c55c6c79f930cb5ea60df6f34551dea090cdc1d5747c1bcc5bc983	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"color": "Pearl White", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "1GR-BE500494", "vehicleModel": "Corolla Altis"}	2026-02-07 11:22:34.070375
3e4fb34b-a34b-49aa-b65b-74134e3acedf	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260207-P0RA83	TE6ATEHZNKBY6N2EK	LTO Pre-Minted (CSR Verified)	\N	87ee48ccb8f9af973c7f02d25737db43c71e6c746f8d484bea54d2d8e6183ae1	3e145cf6d01c100e49be42d56678bf794125762676e769dd31723c6c01639f0a	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Toyota", "vehicleYear": 2024, "vehicleModel": "Corolla Altis", "invoiceNumber": "INV-20260207-P0RA83", "purchasePrice": 921534}	2026-02-07 11:22:39.810488
4ca9844c-b5a1-464f-ad72-a60dfbedc5af	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-IOQ9U2	TE6ATEHZNKBY6N2EK	Jasper Dulla	\N	0a35b10e1e2b9c79f73a5a4c1bb8eaf95540105488578878d578112a7750ff35	7d580f2e796d76bb889c6076365c905d52476e30d0787eff65cccd415f8580b9	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-07 11:23:03.1127
8ee1704a-6e13-4ddf-a8dd-7d7004bf2092	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-DL6BGF	TE6ATEHZNKBY6N2EK	Jasper Dulla	\N	903bced1bd2870f0b38e725a8fb40a8e0fadb91212bb387914b6f7cda76dcd08	e18e166c3c7cdf9a4cff914163d340e0a5dfb22553c65154fafa1f1d22c7db9a	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "1GR-BE500494", "vehiclePlate": "CBY-9590", "chassisNumber": "0YAF3MYMVL212", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-07 11:23:07.910207
5ea4e02f-6016-4e14-8a68-687875da7f2e	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-8GPX9B	VFYD3SRG9DYJDAHT2	Jasper Dulla	\N	4cabbe6709f94fd517addbc22782ab98aac858f50d2b43af0a34e8b68d7ac0c3	9dce6d6e9a267502b1ce60ad30283a2fc055e12c44c3bee3e07e67f1df35d2d0	2026-02-06 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Joshua Ivan Latag", "purchasePrice": "50000", "originalCertificateType": "deed_of_sale"}	2026-02-07 12:26:18.885179
30f93b30-1760-49cc-b084-e09abee42622	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-AB5BRF	VFYD3SRG9DYJDAHT2	Joshua Ivan Latag	\N	35a7816e73847c683d80ad1fa4af8402b769ca2038f708756548eaba43610174	2fdbcd15f27a0f7d8798fe1e3bde885f59fd89f0d9de345ec16d4d2234e8fba4	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "LKF-9216", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-07 12:26:22.296463
7c768865-3806-4358-8fe0-a681311255fc	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-0QJG4I	VFYD3SRG9DYJDAHT2	Joshua Ivan Latag	\N	15144e3b34af282c1ef1e22d70e9cf15f122cc3a956b333546923732a51cc9a1	9999b777195c4e26e080d1fe4b90d50bd37c4149022ea9cef8fbfb7303faae42	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-07 12:26:26.558363
549b84fb-8ec6-4fb6-a729-5ae1bbdc6737	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-WDXM40	5VH6EN0UC1WK3354M	LTO Pre-Minted (CSR Verified)	\N	119fc6eb1e73817c12b0c3688c4947e1461dd44145235e35690a584d87e486f9	e6f462f50c2de2e444fbe7abd605c8b37ac070849dddba9098f65419445337f5	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"color": "Beige", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Honda", "vehicleYear": 2023, "engineNumber": "4GR-BE103259", "vehicleModel": "City"}	2026-02-07 14:04:08.384292
5908ea41-1dc4-442f-a7e1-dc557ec633b1	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260207-JEVTUZ	5VH6EN0UC1WK3354M	LTO Pre-Minted (CSR Verified)	\N	5b4d85bbedd0591df16782473d6091cbc1f32c8121e729568953a6e435c0244e	b5c7a8a8e5dfd06df729aabff65993a3f01fb8769cf70d2b6f652aafd747d39b	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Honda", "vehicleYear": 2023, "vehicleModel": "City", "invoiceNumber": "INV-20260207-JEVTUZ", "purchasePrice": 2479079}	2026-02-07 14:04:14.258242
a5bd0815-70b7-4e4a-b031-c5711123f555	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-VAI1IQ	5VH6EN0UC1WK3354M	Kim Andrei Besmar	\N	b7f3a7bb4d6c16932122c20348cd5d9d36df56b865ca0fa203456d3d80738832	6a3124c57561014388c8185dae03d9c63023a50d29007250f880d58158d397c9	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-07 14:06:00.064539
3024161a-839d-4af6-8a55-3a8aef97a440	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-4WRSAB	5VH6EN0UC1WK3354M	Kim Andrei Besmar	\N	84f146e8e33fa98f2c80d52feddc69514eb510082db08e946a197faa80184122	2b3de4b7556c7e9e75e474a2f81752ac76266bf609920101df98945ecac34b8d	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "4GR-BE103259", "vehiclePlate": "KVH-8684", "chassisNumber": "9GK8K467X7XSDP", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-07 14:06:04.968225
a8ca18a6-59d8-4a27-8fde-3589bfef5ee6	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-88UNI0	5VH6EN0UC1WK3354M	Kim Andrei Besmar	\N	3c3d1eeb0ed5bb773e666af2ed7d8da85372be1b2c928a211ae66901480f6fe2	5b5acf4c9a8664387bfa2fd8d81e973ceca02d3073f4b86097cac1fa75f0bf4c	2026-02-05 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Andrei Besmar", "purchasePrice": "500000", "originalCertificateType": "deed_of_sale"}	2026-02-07 14:14:15.501283
d0a8e8ed-5f92-4ef7-82a9-4ebbf602c5d1	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-QZW2JN	5VH6EN0UC1WK3354M	Andrei Besmar	\N	57005039c7f7a3b2630056eff12c3a95b27983e6a146e66b88817430f7f3d174	9ca026147676004dd5101a306d321440d5dc7035ae4dd54bf9867f17c3ff7cd9	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "KVH-8684", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-07 14:14:19.100515
a1e8e055-fbfd-455c-b0d1-aa9df19fd35d	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-NWLH39	5VH6EN0UC1WK3354M	Andrei Besmar	\N	64576488a82bfe6f76f96f5245e7e13d38f47d9c0671d3cdbf64c066f072bf62	b5406baca95767d9e4f3bb8856f783ac81a69fe8ce524dcf623a4827ce38b93a	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-07 14:14:23.410753
6c43d030-8aa7-42cd-a35b-d76dd6cd663f	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	MVIR-2026-000003	5VH6EN0UC1WK3354M	\N	\N	118e57a1e2e656db2ca9488a35b72cdfaa5f339a1f4194f6c3c829d850e9a372	907cae25e1e02fcae559ace6bc56d043810ca2bdc9f72194757bf4841abbc35c	2026-02-07 14:28:47.087	\N	\N	f	\N	\N	{"inspectionNotes": null, "inspectionResult": "PASS", "inspectionOfficer": "Admin User", "roadworthinessStatus": "ROADWORTHY", "originalCertificateType": "mvir_cert"}	2026-02-07 14:28:47.09568
884ade43-46f6-40da-b4de-b9fe0451db43	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-86QFBN	3FTF50PTKHZ8EA715	Jasper Dulla	\N	4f0271ee027fa1c9cb8dde430c5397c1837431b8e4e2d613c615ab1b53c572f2	967e5020469ff421ec7d5064e68caa34832dfdfc238c056fee1ca662e98ea885	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Joshua Ivan Latag", "purchasePrice": "500000", "originalCertificateType": "deed_of_sale"}	2026-02-07 15:46:29.078851
5c79d790-7c05-423f-a92f-aa6fa63e70d8	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-GSVMIE	3FTF50PTKHZ8EA715	Joshua Ivan Latag	\N	d3daa401e9f104d9175d97875df843e536e8bcf27a4acac08b3fda5cea5e34c2	1e0a44857ad32114e3472dbb126877cbe1e97e3ad59aff2366cc4a81d0056bc8	2026-02-07 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "CCW-6129", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-07 15:46:32.778771
1bf15bea-b0de-4248-85d3-6f40ad5822c4	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-X4XIVQ	3FTF50PTKHZ8EA715	Joshua Ivan Latag	\N	8cca8891002ce50224284caa91ccd167f68c25d8580244d4908299ee0fd2a18e	9e911fc1788a62733560001896af78e0bd5a7b95b27885d2ca7ad0d360f1718d	2026-02-07 00:00:00	2027-02-07 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-07 15:46:37.044961
e0686173-aa6d-4cda-9874-4e5aa9fc6db2	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	CSR-2026-OFUR03	XRU7EB0PUX47FRHYV	LTO Pre-Minted (CSR Verified)	\N	e61184b70d3035d5f9c561cb390423f0d292b5bb2b4a9df41db6c3bb5b7b6805	cd525ceb97aa0aac8de304489f00ed5fcb112210f5a4e536bee9bd76b40d1297	2026-02-08 00:00:00	\N	\N	f	\N	\N	{"color": "White", "bodyType": "Car", "fuelType": "Gasoline", "vehicleMake": "Toyota", "vehicleYear": 2024, "engineNumber": "3UR-DE284537", "vehicleModel": "Vios"}	2026-02-08 02:39:15.622369
06dabdb3-22da-4ee4-9f43-612464eaa097	bd059957-bf60-4afc-9506-fce067bbdd5b	sales_invoice	INV-20260208-O6TF0U	XRU7EB0PUX47FRHYV	LTO Pre-Minted (CSR Verified)	\N	feb6fc14179d7a8f9a7d747dd569576f0e0139f7be7fd3626fd876e0ecd0985d	3c52ea3603cbefe87ae3fb41c1febc80d0a2b69b72a798fc0d352754fabbf30d	2026-02-08 00:00:00	\N	\N	f	\N	\N	{"vehicleMake": "Toyota", "vehicleYear": 2024, "vehicleModel": "Vios", "invoiceNumber": "INV-20260208-O6TF0U", "purchasePrice": 1590827}	2026-02-08 02:39:22.090658
d757da6c-e64e-4764-a558-309738e66178	aa6d3111-ad58-47af-a235-c45fa869a133	ctpl	CTPL-2026-JXP007	XRU7EB0PUX47FRHYV	Jasper Dulla	\N	71e8f9e776b09c876e16a8c04eef7e4fd76ae897fd038e539cf61029539ead0a	3e8c30e5b1756b2348244d8641fd595528924dcba21f3e07b877ec539d4bf82e	2026-02-08 00:00:00	2027-02-08 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}	2026-02-08 02:44:13.849358
88f772ca-69cf-425e-aa44-f2f3f8bedc8e	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-PAW8XM	XRU7EB0PUX47FRHYV	Jasper Dulla	\N	9a177339216728330a366836dc80ce055f226ff2d9fb5f8b9a8911be709d822f	99f6a9a291e7cdffd2c38a7b1ddc02189b260f4c8ddf25051f68a9255a31dc5c	2026-02-08 00:00:00	\N	\N	f	\N	\N	{"engineNumber": "3UR-DE284537", "vehiclePlate": "WUG-5803", "chassisNumber": "GC7ER4MPRYPX", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}	2026-02-08 02:44:18.844426
5fdfa633-db61-465d-b72b-d8210c820f5c	e54b05a2-8a65-4396-8457-6ae50dd702ba	csr	DEED-standalone-ZJ8E77	XRU7EB0PUX47FRHYV	Jasper Dulla	\N	7816b1d98eb3e8f3f8362de15b20fe674a39999ed898bd2d3164b6f42db1a753	8cc28ce181b534259053d0fd3d12f520607d0925f86fecc5c1bdde5288319783	2026-02-03 00:00:00	\N	\N	f	\N	\N	{"buyerName": "Kim Andrei Besmar", "purchasePrice": "500000", "originalCertificateType": "deed_of_sale"}	2026-02-08 03:14:54.813724
79094cfb-13e3-4eeb-8ee2-8087c7231463	3d2b139b-df76-4885-afba-a47995b2c134	hpg_clearance	HPG-2026-P9VSGW	XRU7EB0PUX47FRHYV	Kim Andrei Besmar	\N	81e333023dbe4662076d7ba1e6e72a98288c4d13d1a265844301070418427bf5	85588aeb191118d099140b37ad7810dad88fe2cc15eb5afcad91d0dbd885fe3a	2026-02-08 00:00:00	\N	\N	f	\N	\N	{"vehiclePlate": "WUG-5803", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}	2026-02-08 03:14:58.490431
d431c5ce-909f-491f-9206-2e7dea83edf7	aa6d3111-ad58-47af-a235-c45fa869a133	insurance	CTPL-2026-0VDAN0	XRU7EB0PUX47FRHYV	Kim Andrei Besmar	\N	4c050a75f3e58e65bf5da5b09756f4964b1a7f177345fbbf46dd5a82d8a6beac	79623042008b1be1af96bae2cc4f502f6e44a4eefcd9328ef802278d78bcdd5e	2026-02-08 00:00:00	2027-02-08 00:00:00	\N	f	\N	\N	{"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}	2026-02-08 03:15:02.955607
\.


--
-- TOC entry 3976 (class 0 OID 16650)
-- Dependencies: 226
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.notifications (id, user_id, title, message, type, read, sent_at, read_at) FROM stdin;
c446558d-dbbd-462b-b1c2-022f7613196e	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle LKF-9216	info	f	2026-02-06 10:17:30.271234	\N
80298c9a-c1f3-4a05-a22b-0760c99b19a9	21d178c0-37c5-466e-b2eb-560e32981cbd	New Insurance Verification Request	New insurance verification request for vehicle LKF-9216	info	f	2026-02-06 10:17:30.431066	\N
8ab79b53-b42a-4cc3-b7c8-5bc556034d38	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle LKF-9216	success	f	2026-02-06 10:18:34.019334	\N
f10804a7-6db8-43bc-8a89-d652eed3cacc	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle LKF-9216 has been approved.	success	f	2026-02-06 10:18:34.020765	\N
7db5bd8f-9004-4302-b137-fadf0f3ea185	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle DAS-2869	info	f	2026-02-06 11:03:59.223711	\N
d34b7b2e-cfcb-420d-9d9a-addcb2bd95b3	21d178c0-37c5-466e-b2eb-560e32981cbd	New Insurance Verification Request	New insurance verification request for vehicle DAS-2869	info	f	2026-02-06 11:03:59.33635	\N
25a5185e-5fc3-47ca-a4d5-8c51ffdab9c4	5a672d9b-dabc-4778-b380-7587dadab040	Application Rejected	Your vehicle registration (DAS-2869) has been rejected. Reason: haha. You may resubmit after correcting the issues.	warning	f	2026-02-06 11:47:50.086659	\N
659e601a-a345-44b4-9a64-526148729ce5	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle XXT-6053	info	f	2026-02-06 11:57:12.047896	\N
1f597c37-9631-4b05-8691-64a63ebe40ea	21d178c0-37c5-466e-b2eb-560e32981cbd	New Insurance Verification Request	New insurance verification request for vehicle XXT-6053	info	f	2026-02-06 11:57:12.149005	\N
e46679fa-2013-4d6a-942a-f85c4d190971	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle BXY-6090	info	f	2026-02-06 13:05:54.16172	\N
2e60a9e9-9d03-4bb9-aa16-b90b093c5205	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle BXY-6090 was auto-verified and approved. Score: 100%	success	f	2026-02-06 13:05:55.063295	\N
4731f1da-ce8f-4b99-9a72-75fc6c67d9de	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle BXY-6090	success	f	2026-02-06 13:07:31.331134	\N
194814ea-0a1f-40ad-868f-ba5e467ed438	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle BXY-6090 has been approved.	success	f	2026-02-06 13:07:31.332423	\N
b8014f0c-3731-4e2a-ab62-7dee75401e89	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (BXY-6090) has been approved! OR: OR-2026-000001, CR: CR-2026-000001	success	f	2026-02-06 13:07:56.96739	\N
5ca87f76-6798-4c16-b476-c7ddb27131ea	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle BXY-6090 to you. Please review and accept or reject the request.	info	f	2026-02-06 13:10:29.220917	\N
429127d5-6df5-4322-8918-a54d27157ccc	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Accepted by Buyer	Joshua Ivan Latag has accepted your transfer request for vehicle BXY-6090. The request is now under review.	success	f	2026-02-06 13:11:52.923613	\N
a11defc6-c3aa-46bb-a126-1a4db52425f2	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	Documents Auto-Forwarded	Your documents have been automatically sent to HPG and Insurance for verification. The transfer request is now under review.	info	f	2026-02-06 13:11:53.419833	\N
75ed12b6-9d58-4f78-84e5-8ac71b6aeb00	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle BXY-6090	success	f	2026-02-06 13:16:29.76819	\N
b17db507-74c6-490a-88af-bb58fdedf03e	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle BXY-6090 has been approved.	success	f	2026-02-06 13:16:29.77062	\N
225903fe-ee19-42ad-ba13-a05e4ba03494	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle CCW-6129	info	f	2026-02-06 14:13:24.30203	\N
8953ff02-ca5a-4909-b6ae-0716b4b10cb8	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle CCW-6129 was auto-verified and approved. Score: 100%	success	f	2026-02-06 14:13:24.690079	\N
58ab0ed2-0d8e-4e00-96f7-cb1b00250a78	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle CCW-6129	success	f	2026-02-06 14:15:24.294177	\N
c20f556f-8ec7-4848-8825-6e18c8a3a90b	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle CCW-6129 has been approved.	success	f	2026-02-06 14:15:24.296842	\N
e1680d2b-24fc-4e85-8749-3159914ee836	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (CCW-6129) has been approved! OR: OR-2026-000002, CR: CR-2026-000002	success	f	2026-02-06 14:15:41.673428	\N
bd0a6b8e-9fb0-432b-80db-7be455a101a1	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle EPP-8740	info	f	2026-02-06 16:15:52.386422	\N
5af26be4-833f-4297-a875-2525a50beb45	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle EPP-8740 was auto-verified and approved. Score: 100%	success	f	2026-02-06 16:15:53.224751	\N
a1874f96-61f3-4d54-a63c-c1c0424b239d	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle EPP-8740	success	f	2026-02-06 16:18:36.055676	\N
6d2415c2-ef14-43f3-97e1-60ee53131b14	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle EPP-8740 has been approved.	success	f	2026-02-06 16:18:36.058853	\N
aba59b70-1e93-4a8c-bd19-e16f440bb788	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (EPP-8740) has been approved! OR: OR-2026-000003, CR: CR-2026-000003	success	f	2026-02-06 16:19:44.789964	\N
094ae206-4ca3-47e7-8b83-b6719d57b756	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle CCW-6129 to you. Please review and accept or reject the request.	info	f	2026-02-06 16:21:28.466223	\N
6024b85c-a21d-435c-a17f-f70a90633b0c	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle EPP-8740 to you. Please review and accept or reject the request.	info	f	2026-02-06 16:23:17.074315	\N
13acb5f8-c200-4ea0-83a5-603f2e48fca6	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Accepted by Buyer	Joshua Ivan Latag has accepted your transfer request for vehicle EPP-8740. The request is now under review.	success	f	2026-02-06 16:24:24.071887	\N
bbc295cd-8e3b-4aee-a861-f44b3d202404	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	Documents Auto-Forwarded	Your documents have been automatically sent to HPG and Insurance for verification. The transfer request is now under review.	info	f	2026-02-06 16:24:25.105249	\N
eba82c26-c65e-4614-abe2-94ae0d06cd74	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Rejected by Buyer	Joshua Ivan Latag has rejected your transfer request for vehicle CCW-6129.	error	f	2026-02-06 16:24:33.771149	\N
602942e5-50b9-4777-99ba-8e1e5de9b681	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle EUE-5843	info	f	2026-02-06 17:17:51.2924	\N
2ad1e170-ca0c-4fb5-ac70-6625245c3450	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle EUE-5843 was auto-verified and approved. Score: 100%	success	f	2026-02-06 17:17:51.732814	\N
eb6ec627-647c-4714-91f3-b6700298f830	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle EUE-5843	success	f	2026-02-06 17:22:57.028283	\N
a4faa8ec-d46c-4aed-a17e-c2f5c0c61dc3	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle EUE-5843 has been approved.	success	f	2026-02-06 17:22:57.02962	\N
00625953-c7f2-4da7-aa97-f758fe589757	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (EUE-5843) has been approved! OR: OR-2026-000004, CR: CR-2026-000004	success	f	2026-02-06 17:23:13.123222	\N
8daab5f4-77de-46ce-9fc2-46b3c4061ae2	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle TZK-5341	info	f	2026-02-07 08:18:44.786274	\N
31d44a20-e942-47c1-82b5-62af815e5ca8	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle TZK-5341 was auto-verified and approved. Score: 100%	success	f	2026-02-07 08:18:45.538997	\N
0db18af0-fc5f-44d7-b2e2-1b3f45e242f3	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle TZK-5341	success	f	2026-02-07 08:20:00.524458	\N
b69ea158-7c13-44ad-bb70-8fba050904f9	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle TZK-5341 has been approved.	success	f	2026-02-07 08:20:00.526324	\N
790d7b49-f6fb-43ee-8f93-74953b473ca6	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (TZK-5341) has been approved! OR: OR-2026-000005, CR: CR-2026-000005	success	f	2026-02-07 08:20:23.022551	\N
77eae7d1-251f-49a9-8c2f-898b59626681	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle TZK-5341 to you. Please review and accept or reject the request.	info	f	2026-02-07 08:25:21.176445	\N
6bee3b73-aa55-4650-bc67-4a12ce02f88c	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Accepted by Buyer	Joshua Ivan Latag has accepted your transfer request for vehicle TZK-5341. The request is now under review.	success	f	2026-02-07 08:26:00.526967	\N
1ba219b6-ab8e-4c98-bcfa-19902e0cbe2c	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	Documents Auto-Forwarded	Your documents have been automatically sent to HPG and Insurance for verification. The transfer request is now under review.	info	f	2026-02-07 08:26:01.477722	\N
55d86e29-66d2-4eb7-8fff-8aca891b3b9d	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle TZK-5341	success	f	2026-02-07 08:27:02.305772	\N
3c5f58c3-7475-4eac-bed8-de2f5da17526	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle TZK-5341 has been approved.	success	f	2026-02-07 08:27:02.309228	\N
25ef61a6-8b24-4909-8cb1-51d1e8e1f3c8	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle EUE-5843 to you. Please review and accept or reject the request.	info	f	2026-02-07 11:37:39.516954	\N
7528a381-a27a-4c73-9209-337bb726ba85	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle CBY-9590	info	f	2026-02-07 11:54:43.038266	\N
354407b1-5241-473e-9887-6f19f2b6039f	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle CBY-9590 was auto-verified and approved. Score: 100%	success	f	2026-02-07 11:54:43.740582	\N
254d3907-956d-4dfd-8942-6d0004c411e8	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle CBY-9590. Blockchain TX: 2a4af0b2a15e2148...	success	f	2026-02-07 11:59:32.939284	\N
5839d35a-a279-410d-9c88-df1051f8884a	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle CBY-9590 has been approved. Transaction ID: 2a4af0b2a15e2148...	success	f	2026-02-07 11:59:32.941565	\N
c0faccad-fef7-40ef-86d7-64ff1713bcc5	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (CBY-9590) has been approved! OR: OR-2026-000006, CR: CR-2026-000006	success	f	2026-02-07 11:59:43.244643	\N
a037c146-f66c-4f41-b5d8-305ee29ede10	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle CBY-9590 to you. Please review and accept or reject the request.	info	f	2026-02-07 12:34:59.1667	\N
772f3dc8-8eaf-466d-badf-37c2aa31ee70	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Accepted by Buyer	Joshua Ivan Latag has accepted your transfer request for vehicle EUE-5843. The request is now under review.	success	f	2026-02-07 13:02:10.908096	\N
425e046f-dfbb-4632-96e4-b8647596752d	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	Documents Auto-Forwarded	Your documents have been automatically sent to HPG and Insurance for verification. The transfer request is now under review.	info	f	2026-02-07 13:02:12.195784	\N
85c9b578-2784-4608-8e4e-3cf252db91ab	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle KVH-8684	info	f	2026-02-07 14:07:49.850687	\N
8756b6c7-9ba8-49c4-b3a9-23a07d37fc8e	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle KVH-8684 was auto-verified and approved. Score: 100%	success	f	2026-02-07 14:07:50.614092	\N
f5c2a396-5183-4633-a4da-3ddc701a6f04	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle KVH-8684. Blockchain TX: 82edc114201801b8...	success	f	2026-02-07 14:11:21.191639	\N
fc7b6346-2629-4190-8308-68307b74e48f	36b86e7e-7668-49dc-8dd6-6610ce092a73	HPG Clearance Approved	Your HPG clearance request for vehicle KVH-8684 has been approved. Transaction ID: 82edc114201801b8...	success	f	2026-02-07 14:11:21.1941	\N
922524e2-87ff-4216-8f83-119f48e813ed	36b86e7e-7668-49dc-8dd6-6610ce092a73	Vehicle Registration Approved	Your vehicle registration (KVH-8684) has been approved! OR: OR-2026-000007, CR: CR-2026-000007	success	f	2026-02-07 14:13:03.308112	\N
ad440bc7-d3db-4ff5-bffb-60558575b63a	09752f67-da7e-4a6c-97c9-174760bc0d9c	New Transfer Request	Kim Andrei Besmar has requested to transfer vehicle KVH-8684 to you. Please review and accept or reject the request.	info	f	2026-02-07 14:15:40.170278	\N
c8678344-111f-4ea1-a92e-38becf783d18	36b86e7e-7668-49dc-8dd6-6610ce092a73	Transfer Request Accepted by Buyer	Andrei Besmar has accepted your transfer request for vehicle KVH-8684. The request is now under review.	success	f	2026-02-07 14:18:25.608455	\N
76d32e2a-cd80-4223-a577-d6f6e2962aa6	09752f67-da7e-4a6c-97c9-174760bc0d9c	Documents Auto-Forwarded	Your documents have been automatically sent to HPG and Insurance for verification. The transfer request is now under review.	info	f	2026-02-07 14:18:26.394778	\N
9907cb3c-53f8-401a-8465-63a94a834db1	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle KVH-8684. Blockchain TX: b4ca1a093b5de428...	success	f	2026-02-07 14:27:49.464433	\N
da2da66a-aa9c-4131-a43d-ae2b115ab38b	36b86e7e-7668-49dc-8dd6-6610ce092a73	HPG Clearance Approved	Your HPG clearance request for vehicle KVH-8684 has been approved. Transaction ID: b4ca1a093b5de428...	success	f	2026-02-07 14:27:49.467062	\N
c27607ce-1c2a-42ec-b5ca-75f651522f75	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	New Transfer Request	Jasper Dulla has requested to transfer vehicle CCW-6129 to you. Please review and accept or reject the request.	info	f	2026-02-07 15:47:28.846807	\N
f0110c77-f410-4df9-aeb7-ec56cc50b2c2	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Accepted by Buyer	Joshua Ivan Latag has accepted your transfer request for vehicle CCW-6129. The request is now under review.	success	f	2026-02-07 15:52:00.663827	\N
2a4b71ec-ded8-4857-8d75-89b75c569a12	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	New HPG Clearance Request	New clearance request for vehicle WUG-5803	info	f	2026-02-08 02:46:41.387852	\N
b94caa00-e87c-4d56-9c32-d455245c6f84	21d178c0-37c5-466e-b2eb-560e32981cbd	Insurance Auto-Verified and Approved	Insurance for vehicle WUG-5803 was auto-verified and approved. Score: 100%	success	f	2026-02-08 02:46:42.175064	\N
c266675f-008b-4e48-bf91-70d1cbbf0822	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle WUG-5803. Blockchain TX: b99c26045db968da...	success	f	2026-02-08 02:48:32.448877	\N
1788aa25-8d51-4fe8-a789-c0ecbb0826b4	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle WUG-5803 has been approved. Transaction ID: b99c26045db968da...	success	f	2026-02-08 02:48:32.450768	\N
9de214c5-6190-4070-9233-031829f25194	5a672d9b-dabc-4778-b380-7587dadab040	Vehicle Registration Approved	Your vehicle registration (WUG-5803) has been approved! OR: OR-2026-000009, CR: CR-2026-000009	success	f	2026-02-08 03:09:08.10286	\N
c5151409-8614-4747-a5f2-31f70588ba40	36b86e7e-7668-49dc-8dd6-6610ce092a73	Transfer Request Rejected	Your transfer request has been rejected. Reason: No owner	error	f	2026-02-08 03:13:13.748254	\N
97901db4-eddf-4546-8554-a3afdc99bb11	36b86e7e-7668-49dc-8dd6-6610ce092a73	New Transfer Request	Jasper Dulla has requested to transfer vehicle WUG-5803 to you. Please review and accept or reject the request.	info	f	2026-02-08 03:19:29.28308	\N
8a3b37fe-61de-4998-bd3f-d9ff049d0d55	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Accepted by Buyer	Kim Andrei Besmar has accepted your transfer request for vehicle WUG-5803. The request is now under review.	success	f	2026-02-08 03:20:19.455669	\N
25d54eeb-70e4-4451-badb-71ae2d573708	5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	HPG Verification Approved	HPG verification approved for vehicle WUG-5803. Blockchain TX: 03d4b5b123c5058a...	success	f	2026-02-08 03:36:45.739642	\N
ff8e2cd3-6279-4255-8108-1b8f029f26ed	5a672d9b-dabc-4778-b380-7587dadab040	HPG Clearance Approved	Your HPG clearance request for vehicle WUG-5803 has been approved. Transaction ID: 03d4b5b123c5058a...	success	f	2026-02-08 03:36:45.742434	\N
02944ca6-9e59-4117-bb7c-1b80f5bdc226	5a672d9b-dabc-4778-b380-7587dadab040	Transfer Request Approved	Your transfer request for vehicle WUG-5803 has been approved.	success	f	2026-02-08 03:40:00.701528	\N
f076574d-356c-455b-ace2-218e41cc7950	36b86e7e-7668-49dc-8dd6-6610ce092a73	Vehicle Ownership Transferred	You are now the owner of vehicle WUG-5803.	info	f	2026-02-08 03:40:00.704091	\N
\.


--
-- TOC entry 3977 (class 0 OID 16659)
-- Dependencies: 227
-- Data for Name: officer_activity_log; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.officer_activity_log (id, officer_id, activity_type, entity_type, entity_id, action, duration_seconds, notes, ip_address, user_agent, session_id, metadata, created_at) FROM stdin;
a21d579f-0d63-4275-bd75-f795f3b900f8	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d7463eaa-e937-4e14-ac30-a0bb43dc5747	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 85%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "7d0dec74-4e14-4b73-a14d-b9721205116c"}	2026-02-06 10:18:18.120145
74702ef6-71ed-489d-93e0-ddf9521cc80b	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d7463eaa-e937-4e14-ac30-a0bb43dc5747	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "ec16939f-97d7-4c1f-8227-cb6dd0089b67"}	2026-02-06 10:18:34.015895
7aa517a9-4656-40c4-be3e-acaafbf49a64	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	5735abaf-cd58-46ca-a6a5-0a864050ac8d	STATUS_REJECTED	\N	Application rejected: haha	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "0802d3ea-7e2d-4685-a06e-0df33b563c72"}	2026-02-06 11:47:49.490557
ea171db3-8fc6-4365-aa86-bf827eaff90c	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 100%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "079bdade-85a6-4a3c-90a6-3e76dce6a532"}	2026-02-06 13:07:23.472978
396e4147-dc7b-48c4-a619-538f1865041a	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "83dcb52f-d2fd-49a9-864d-eb201c15cfec"}	2026-02-06 13:07:31.328218
d5e6588f-df55-4443-830f-186c2aa29c3c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079	\N	\N	\N	{"transaction_id": "ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079", "vehicle_history_id": "b48bb28d-4ec8-4a12-832d-902d5b9f9428"}	2026-02-06 13:07:56.34193
bfcab585-a235-4920-94a9-6c060d1d32b8	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000001, CR: CR-2026-000001. Application approved by admin	\N	\N	\N	{"transaction_id": "ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079", "vehicle_history_id": "0185ca1e-3046-4222-bb99-03259ceb394a"}	2026-02-06 13:07:56.964287
62420baa-7688-43b1-8a8a-c3bccce0e246	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "fda29d6f-9484-4956-9e06-03a46b5c8684"}	2026-02-06 13:13:36.080501
6171c010-b3e4-4c05-aea5-e445bf5c5c56	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_HPG_APPROVED	\N	HPG approved transfer request 035d6f28-5ed7-4261-8d1a-f6d1174fa4f6 via clearance request b29a9117-a0f1-4722-90d7-c66df0f7350b	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "e4c0d07e-5416-4b72-80b2-7c4de4e74c4d"}	2026-02-06 13:16:28.945531
e36c3a70-1135-45e4-9721-c144f8a3cd4c	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "97f90cc4-8377-4a3b-82e2-48aeee2971f0"}	2026-02-06 13:16:29.765095
a99d0d87-16ae-44bc-9cd6-c28889063c6a	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	LTO_INSPECTION_COMPLETED	\N	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000001	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "521aa512-050c-4623-8a6f-aca39940c573"}	2026-02-06 13:17:09.818917
1cc7f4a2-f373-4c19-9b79-711c5c7083b2	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	aac4dc07-379b-4cdc-9250-6e80aaed676a	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "30a89adb-feba-4c4f-90a7-ff124d46c827"}	2026-02-06 14:14:42.205245
863b2163-d51b-4b01-b770-bb07e6bab680	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	aac4dc07-379b-4cdc-9250-6e80aaed676a	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "5292cc7f-1a9e-4b66-9f33-eca7b4606ad1"}	2026-02-06 14:15:24.281262
abe08bed-6e66-4463-9e49-25d6063eb8e1	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	aac4dc07-379b-4cdc-9250-6e80aaed676a	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072	\N	\N	\N	{"transaction_id": "a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072", "vehicle_history_id": "990cfdc1-0b09-4f69-9e60-59dafbdf716b"}	2026-02-06 14:15:41.07076
80ae9858-23fe-4161-9464-228d499c4617	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	aac4dc07-379b-4cdc-9250-6e80aaed676a	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000002, CR: CR-2026-000002. Application approved by admin	\N	\N	\N	{"transaction_id": "a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072", "vehicle_history_id": "25299115-1238-4216-8727-5152a3cd245b"}	2026-02-06 14:15:41.670007
881f647d-88a5-40cd-9065-5ab196a176dc	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "2fa1afc1-dc4d-4852-8442-004eee61caaf"}	2026-02-06 16:17:59.309353
d0e73b1c-60cf-49e9-9643-624bdcdc8d12	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	c8babe0e-e748-4942-9025-53c1600a476f	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "b472c660-8d36-475f-871d-76a7d07fbe9f"}	2026-02-06 16:18:36.046214
bb5bd602-395f-4583-86ac-9318eda92c83	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	c8babe0e-e748-4942-9025-53c1600a476f	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: 0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18	\N	\N	\N	{"transaction_id": "0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18", "vehicle_history_id": "23fae44e-5428-4345-af1e-3478cacca981"}	2026-02-06 16:19:44.185
8affe8a6-3e62-44a4-8ef2-a473f5c04822	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	c8babe0e-e748-4942-9025-53c1600a476f	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000003, CR: CR-2026-000003. Application approved by admin	\N	\N	\N	{"transaction_id": "0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18", "vehicle_history_id": "059fb5d5-568c-4b50-b41e-8ee3c4aaa45d"}	2026-02-06 16:19:44.786269
a6e57160-b634-4bda-97da-0f2ac61221ad	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests without required role: admin or hpg_admin	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-06 16:21:12.811881
92ed97c4-49cd-42cd-a7e6-7bb677f33171	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "b207c831-8752-433b-804e-893561b5b9d4"}	2026-02-06 16:24:51.322827
315bb48c-0b4e-4e86-8e59-d33ae23bf8f4	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	47916952-a48c-486a-8421-014905e38968	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "64cb8fef-a015-4ff7-b0b5-8ed8c7112581"}	2026-02-06 17:19:11.368894
666aaa29-fb21-4b4a-8b94-e9b1d3f29dd9	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	47916952-a48c-486a-8421-014905e38968	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "b69555d6-2919-464e-9705-29ee6c405d42"}	2026-02-06 17:19:19.948066
0c213308-01a7-4b65-bfb3-4149d22078db	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	47916952-a48c-486a-8421-014905e38968	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "b3731ee3-0d9e-40bc-8567-a96dffb740e2"}	2026-02-06 17:19:42.520904
d15e93f3-e6ce-40e2-a8b0-785694730c01	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	47916952-a48c-486a-8421-014905e38968	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "1a0add58-afaf-48b5-9134-748f13eebd68"}	2026-02-06 17:22:57.019894
e5ec95b4-7936-44ba-9b59-864b444f3bee	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	47916952-a48c-486a-8421-014905e38968	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: 69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f	\N	\N	\N	{"transaction_id": "69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f", "vehicle_history_id": "a97c246d-b373-45db-9c8c-c6e0a4e018c4"}	2026-02-06 17:23:12.503276
25208aed-5d2c-4397-bb16-f84d68afafbc	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	47916952-a48c-486a-8421-014905e38968	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000004, CR: CR-2026-000004. Application approved by admin	\N	\N	\N	{"transaction_id": "69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f", "vehicle_history_id": "97962623-1f02-4780-86b8-fa2cfa0a2eee"}	2026-02-06 17:23:13.120864
369eb6c8-af0a-4fa2-8fb0-71da89a0c465	5a672d9b-dabc-4778-b380-7587dadab040	unauthorized_access	system	\N	denied	\N	Attempted to access /proof/tx/69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f without required role: admin or lto_admin or lto_officer	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	\N	{}	2026-02-06 17:24:03.236903
bbca9d8d-7a76-4430-b1a9-1bca48b1cbc9	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "4ea929c8-a65d-47ea-a997-ac2b13788624"}	2026-02-07 08:19:26.417401
364b74e4-c36f-4a7a-b536-f469de6355df	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "fcef2b27-cd30-433d-98af-58f5910f7d53"}	2026-02-07 08:19:32.147921
9f4e1689-fb2a-4667-b540-1bc0d53b59b8	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "d8f234f3-e69c-4d81-abfd-129575c3777c"}	2026-02-07 08:20:00.52073
a832a258-f51c-47a5-9268-5b0aa94b07ab	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: 800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43	\N	\N	\N	{"transaction_id": "800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43", "vehicle_history_id": "60b0a36f-5b68-441f-82f5-f4fd2d7211c5"}	2026-02-07 08:20:22.43729
8d5936f5-6994-4679-9566-f81df1eb987f	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000005, CR: CR-2026-000005. Application approved by admin	\N	\N	\N	{"transaction_id": "800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43", "vehicle_history_id": "1cb7db25-16d3-4398-aa57-03385b03e9f9"}	2026-02-07 08:20:23.019134
b16f8d12-7fce-4998-81bf-7b8d28b22f55	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests without required role: admin or hpg_admin	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-07 08:24:56.376161
aff19c1e-3cdb-4e9c-bc1c-8fe1d186d50f	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests without required role: admin or hpg_admin	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-07 08:24:57.570771
e865e583-ada2-40cf-8bdb-fba73cd3c15c	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "e1a68fb0-afe0-428e-838e-299074343487"}	2026-02-07 08:26:28.485293
39e0eef2-1d09-4e9b-8c29-ac1bc2bc60b8	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_HPG_APPROVED	\N	HPG approved transfer request 9c316439-0fed-40ac-affb-aaa7703a3843 via clearance request 08c3c8cc-8319-4b65-8ab7-2480d732cb25	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "308c358a-0c3e-4fdd-835f-6988bfd2bc9d"}	2026-02-07 08:27:01.844996
15724be0-5c77-4154-a7eb-e8639ce4090f	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph. 	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "5f001861-7db7-42d3-bcb2-0233f5892a4e"}	2026-02-07 08:27:02.302046
0d0238f3-614c-4bfe-bdfb-73c06dbb7bc6	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	LTO_INSPECTION_COMPLETED	\N	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000002	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "e32ea186-3ef4-43dc-92ed-ee59e7824232"}	2026-02-07 08:28:13.912349
5ed40399-d7ca-4d21-b4ee-876b7a1afcaa	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "61793a8d-bdd2-4076-9abc-8ec21b88e4b2"}	2026-02-07 11:38:12.072215
acaed892-822f-4d4f-a186-b0878decf90a	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "25c6a230-bd0f-4dc1-9f57-1e6460a33880"}	2026-02-07 11:58:17.364685
f08b0038-5a52-455e-b9f3-605dd2594657	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: 2a4af0b2a15e21488b01776edb4d13088e70fb58029829d465f561bed85c5090	\N	\N	\N	{"transaction_id": "2a4af0b2a15e21488b01776edb4d13088e70fb58029829d465f561bed85c5090", "vehicle_history_id": "7a6b040d-be5a-485d-8660-209cecba6979"}	2026-02-07 11:59:32.930513
e90e231e-3e63-4806-9f15-7193a5d9d4a8	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: 766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c	\N	\N	\N	{"transaction_id": "766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c", "vehicle_history_id": "74f72cf0-8ccb-4271-bd01-4559b378f892"}	2026-02-07 11:59:42.645887
4a5def9e-f76c-4f2a-abc8-c1ca3cbd6488	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000006, CR: CR-2026-000006. Application approved by admin	\N	\N	\N	{"transaction_id": "766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c", "vehicle_history_id": "cfba308f-6e6d-44b7-a8ad-c346e9a69d0b"}	2026-02-07 11:59:43.24115
2010b812-aa44-4671-a1b2-7742009f02bb	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTOMATION_PHASE1	\N	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "693b8a00-90f6-40d6-b0c2-00bea590822f"}	2026-02-07 12:43:15.558902
db64a3a0-20bf-4e7d-8573-edefbee39976	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	TRANSFER_FORWARDED_TO_HPG	\N	Transfer request forwarded to HPG for clearance review	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "98596aad-12b7-4fbf-8c28-6423c2d16410"}	2026-02-07 12:43:15.568554
1d99a06b-d23b-4023-9129-b3da7e3d0ede	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	TRANSFER_FORWARDED_TO_INSURANCE	\N	Transfer request forwarded to Insurance for clearance review	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "dd0089d0-2ff4-40d7-825f-fd3ca643e6b3"}	2026-02-07 12:43:18.561427
e9a4daa9-345f-49fa-a510-78bb7ae34daa	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "c98a3077-1239-49db-bc79-b9d2c6eea123"}	2026-02-07 12:44:58.690126
59f5eef3-fbf9-406a-802b-fe79bdb8e652	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "029892e0-1942-4c2e-8861-ba673c0e06b5"}	2026-02-07 12:47:09.117942
c96756ec-e2d3-45b1-ae50-17a56a44b558	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "229dd502-4af0-4033-b9fb-0123cc4ad5c2"}	2026-02-07 12:47:14.530005
fd91dc3c-8022-4796-b0c8-31bc3cbecddf	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests without required role: admin or hpg_admin	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-07 13:01:11.768333
993d1159-697d-48b4-bfb0-f581cf7f2b19	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "5074aeca-8adb-4784-b0cc-567bcb590891"}	2026-02-07 14:09:54.745579
0653afd9-81fd-464d-af40-9d53d0e64698	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: 82edc114201801b8a249755b5a5cf2fd24d2d3ce2cdefda6ea66a99f0e94b9d7	\N	\N	\N	{"transaction_id": "82edc114201801b8a249755b5a5cf2fd24d2d3ce2cdefda6ea66a99f0e94b9d7", "vehicle_history_id": "ed2e6abe-b9d0-48f8-afa7-fbb71ebe553f"}	2026-02-07 14:11:21.18145
b5632456-d996-412f-9c0b-4554af25878d	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00	\N	\N	\N	{"transaction_id": "f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00", "vehicle_history_id": "4ad9683c-b24a-4386-bcf8-12f4821e071d"}	2026-02-07 14:13:02.711032
7713b90e-e8fd-4383-9f21-1287ba36c319	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000007, CR: CR-2026-000007. Application approved by admin	\N	\N	\N	{"transaction_id": "f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00", "vehicle_history_id": "fcc72d65-af8d-4461-bc47-0669c297dc49"}	2026-02-07 14:13:03.304506
e4268dae-7e6f-412e-b018-8f4addc1e778	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 100%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "24a527c4-e4d9-4ee8-90ce-fc7dcf42ab63"}	2026-02-07 14:26:41.694214
5f30774a-651f-406b-91d8-f347a2ef29fa	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_HPG_APPROVED	\N	HPG approved transfer request 5e09c9fb-0dd4-470a-8e02-77907e76988f via clearance request 5784599e-7b57-485a-8273-bca2b9dec134	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "c7c310e4-bb9d-4da6-865f-bee9ec77bb7b"}	2026-02-07 14:27:49.024445
3ddf12b0-7baa-4fb3-8f04-c7c174d50532	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: b4ca1a093b5de42801088a4b8c25e56ba77a08fc44b974e2804aa964e516353d	\N	\N	\N	{"transaction_id": "b4ca1a093b5de42801088a4b8c25e56ba77a08fc44b974e2804aa964e516353d", "vehicle_history_id": "591ea0fd-64e0-43a2-b09c-97acd0bbca64"}	2026-02-07 14:27:49.46167
aa31d922-dad5-485c-b768-5a7087c29c69	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	LTO_INSPECTION_COMPLETED	\N	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000003	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "94d42b6d-ff58-46ca-8075-2fd661f3a9d0"}	2026-02-07 14:28:47.099858
3cd21f2b-b964-4bf3-b684-3659d2d2fea3	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests without required role: admin or hpg_admin	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-07 15:50:33.280224
66dcdd2f-b688-4aec-82f6-11c536665970	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	unauthorized_access	system	\N	denied	\N	Attempted to access /requests without required role: admin or hpg_admin	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-07 15:51:01.787879
505f357b-1d71-406c-91d8-b7a9157be254	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "537b018c-1f51-499b-8471-c986bca93a95"}	2026-02-08 02:48:18.17665
da4bdc47-48db-4d0c-a726-4e75bcb3d9cb	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: b99c26045db968da71be875709aeb5060f9668da25dfc15a0b842aad1d8c45bd	\N	\N	\N	{"transaction_id": "b99c26045db968da71be875709aeb5060f9668da25dfc15a0b842aad1d8c45bd", "vehicle_history_id": "c9b77e74-e5b0-4d42-87a1-8235a988f18e"}	2026-02-08 02:48:32.445299
4c08a158-a6d0-446c-a867-5fc5c12a701b	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	BLOCKCHAIN_REGISTERED	\N	Vehicle registered on Hyperledger Fabric. TX: 2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0	\N	\N	\N	{"transaction_id": "2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0", "vehicle_history_id": "e720bab0-0d8f-4515-b429-7646c81fc817"}	2026-02-08 03:09:06.999348
240d10bc-564d-4841-8bef-6db16106901e	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	CLEARANCE_APPROVED	\N	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000009, CR: CR-2026-000009. Application approved by admin	\N	\N	\N	{"transaction_id": "2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0", "vehicle_history_id": "9e6ecd7d-7140-49e1-be25-e7583c896923"}	2026-02-08 03:09:08.099826
45eeb739-2601-40a7-a926-d425d942682c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_REQUEST_REJECTED	\N	Transfer request rejected by admin@lto.gov.ph. Reason: No owner	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "f899fa48-fb5d-4e35-b09d-a5ae1b20ca6e"}	2026-02-08 03:13:13.740153
94883046-12b8-4a9e-b44b-94fbb4dd43f6	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTOMATION_PHASE1	\N	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "d38a10af-378f-43a4-9def-08be294f76e4"}	2026-02-08 03:34:10.441832
5ed3fac5-982e-41fd-a904-09b46a77bede	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_FORWARDED_TO_HPG	\N	Transfer request forwarded to HPG for clearance review	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "3b71bb51-1e23-416b-b6ad-72b5000cc32b"}	2026-02-08 03:34:10.45016
4ced44e3-a85f-4bd1-a488-36014af18106	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_FORWARDED_TO_INSURANCE	\N	Transfer request forwarded to Insurance for clearance review	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "334b80e2-be13-43d9-a068-dc960034b0dd"}	2026-02-08 03:34:13.638604
42af6afb-8a4e-451f-821b-5cf50c47d46e	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	\N	Transfer Insurance auto-verified and approved. Score: 100%	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "5298d579-0f37-4384-a0e6-2bb72877d9a8"}	2026-02-08 03:34:14.790695
4acc3abb-ad61-457f-97e8-0482ef39b1b9	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTO_VERIFY	\N	HPG auto-verification completed. Confidence: 100%. Recommendation: AUTO_APPROVE	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "73b2f693-196f-4598-a632-5ea1ef9b1c7b"}	2026-02-08 03:36:29.286963
a6c5f71e-8058-46d9-90c7-200aa074bd96	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_HPG_APPROVED	\N	HPG approved transfer request 36bd5846-8247-48fa-8271-6f7400bee66d via clearance request 4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "30de53b6-46eb-4b64-aacc-01d23ccec5ab"}	2026-02-08 03:36:45.137266
055637c5-fe7e-4a58-b1f7-70463127d1aa	654bb34d-fec4-458c-94bc-2223d885a6d7	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_CLEARANCE_APPROVED	\N	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: 03d4b5b123c5058acb23170bfd922c1e3db55fc7ab700e9182a1556798c853ce	\N	\N	\N	{"transaction_id": "03d4b5b123c5058acb23170bfd922c1e3db55fc7ab700e9182a1556798c853ce", "vehicle_history_id": "dc994828-22ed-49d0-adac-ca96fb8c911b"}	2026-02-08 03:36:45.736787
1f4f0dbe-46a5-4769-b650-6f588d9950bd	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	LTO_INSPECTION_COMPLETED	\N	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000004	\N	\N	\N	{"transaction_id": null, "vehicle_history_id": "731d2f4f-5ee3-4402-bcc7-a50e61f2fc25"}	2026-02-08 03:38:16.495741
249eb118-ffe0-47c9-9049-0f2a4149736b	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	BLOCKCHAIN_TRANSFERRED	\N	Ownership transfer recorded on Hyperledger Fabric. TX: 38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d	\N	\N	\N	{"transaction_id": "38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d", "vehicle_history_id": "0cceb628-92b0-4a3c-afb2-cd44751c8587"}	2026-02-08 03:40:00.645297
b519f923-f894-4d71-b375-e41a071c1f18	a57fd791-bef2-4881-baa9-bfbd1c8b799c	registration	vehicle	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_COMPLETED	\N	Transfer completed: Ownership transferred from Jasper Dulla to Kim Andrei Besmar	\N	\N	\N	{"transaction_id": "38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d", "vehicle_history_id": "458623d6-d0dc-45ad-8be6-83318da88d15"}	2026-02-08 03:40:00.686888
da2186c1-902d-4e23-8984-f598ecd2ac56	36b86e7e-7668-49dc-8dd6-6610ce092a73	unauthorized_access	system	\N	denied	\N	Attempted to access /proof/tx/2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0 without required role: admin or lto_admin or lto_officer	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-08 03:47:44.320524
4d6022d6-d81f-412c-b8cb-20d3f5a62828	36b86e7e-7668-49dc-8dd6-6610ce092a73	unauthorized_access	system	\N	denied	\N	Attempted to access /proof/tx/2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0 without required role: admin or lto_admin or lto_officer	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	\N	{}	2026-02-08 04:07:57.568494
\.


--
-- TOC entry 3982 (class 0 OID 16712)
-- Dependencies: 233
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, created_at) FROM stdin;
6785a1fd-6f70-42f5-b0a7-fccef6c489b4	e71fccc9-57c4-42c5-9a59-324078118fda	cb74df9c3540d0a760d95aad4b0e841d728531e836dacb84aa62af6fc3e09b89	2026-02-13 10:00:08.691	2026-02-06 10:00:08.692035
97972356-9feb-4d5d-af69-5ccaefa39809	a57fd791-bef2-4881-baa9-bfbd1c8b799c	831f16ed55371a854952788b103c707308bbf48645d9cd290ba84a73511098f5	2026-02-13 10:01:04.694	2026-02-06 10:01:04.694526
a494b4a1-8eaa-4183-9e7a-1d80ef2d8321	5a672d9b-dabc-4778-b380-7587dadab040	ed0a73ad76f956fe9b86d1a5ebf050ad819594338ced4dbf376bb14a8956140a	2026-02-13 10:04:02.146	2026-02-06 10:04:02.147223
872cba11-2eb8-40fc-aaff-47a7197590f6	654bb34d-fec4-458c-94bc-2223d885a6d7	b614d37a768a5062d3465625332a6013831b9b26b5244c6c6599d0c6b164e810	2026-02-13 10:06:05.22	2026-02-06 10:06:05.221127
d60e3c34-a5c1-4a0e-b02f-1ea54e438212	a57fd791-bef2-4881-baa9-bfbd1c8b799c	18b1a1d31bf7f651a565bc181afb64ace6239f8ed6a6f3a9b5c8b600b2ccf5f8	2026-02-13 10:17:59.962	2026-02-06 10:17:59.962766
e5c602d3-b8d0-41cc-aabf-6e9dbf55c97f	e71fccc9-57c4-42c5-9a59-324078118fda	6f5e95d9d557c82edfc5462e45eb1f4ea7c97b4742fdff56e1eacb4ac6d84859	2026-02-13 10:58:50.747	2026-02-06 10:58:50.748264
8144e538-2d0e-49fc-b597-3bab030403b3	73477102-f36b-448a-89d4-9dc3e93466f8	b433ba0028dbd1f7fdde563eb76f23602f68b5d5e449996e701ff5f8811e8ba2	2026-02-13 11:00:11.463	2026-02-06 11:00:11.463738
5f915ca6-ac21-4ee9-9e96-7b5e617b3c7e	a57fd791-bef2-4881-baa9-bfbd1c8b799c	f36e410c60471cc233163c6bebb051f6f8e2abc17cb2f3c83bc3db68055cb9cf	2026-02-13 11:06:21.709	2026-02-06 11:06:21.710376
5a8db62d-6e38-42cb-96e9-00929d7572ae	a57fd791-bef2-4881-baa9-bfbd1c8b799c	e9451882d7d34ef2e6fd3eae731fa40b2cbc8bcbd9e06bdb57d9ebae42228539	2026-02-13 11:31:24.662	2026-02-06 11:31:24.663296
6261b8b8-2416-4975-a49c-c749c469c893	a57fd791-bef2-4881-baa9-bfbd1c8b799c	ab6b32f74f77db2b7568bd1a0df8e07ba0ad80be4efd8c89fd71baebfdeabf2d	2026-02-13 11:40:53.261	2026-02-06 11:40:53.262148
4c2ecf9d-9e05-4f73-8323-d87de1a5dfe9	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	858db821488c9d3e829910d0e256930a4b60d08c23081e54e6e8555b981481c6	2026-02-13 11:44:46.065	2026-02-06 11:44:46.066005
bca07658-eed8-4275-91f8-5a6ed60e825d	a57fd791-bef2-4881-baa9-bfbd1c8b799c	ef46f03070494080c2113d04277da44ab00b25959a93ec6cf6a2f29f4d7850fb	2026-02-13 11:51:30.732	2026-02-06 11:51:30.732873
e265e779-b27a-451a-9290-a3368acadff8	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	dab38bcd28050a72df4b0f6c476c7410f75b95a0963018abc68e855793d6c56b	2026-02-13 11:55:55.375	2026-02-06 11:55:55.375541
23e52eb8-1019-41ef-a4d2-cda620e8e7a5	a57fd791-bef2-4881-baa9-bfbd1c8b799c	979b02fbe95c36afa00887d3109df629a439d2e4e2c30e6d436effbf37f766d8	2026-02-13 12:24:08.514	2026-02-06 12:24:08.514573
5389b50e-1ef1-42c2-bf6f-19a47baa79c1	a57fd791-bef2-4881-baa9-bfbd1c8b799c	8a02e69e2ac13beb9b811df3134e3e629d0e6a6cc8ed80c2b935c0793d3353b6	2026-02-13 12:39:36.38	2026-02-06 12:39:36.3809
c130e41d-22c8-43a3-bb65-ab1a3adb2b03	e71fccc9-57c4-42c5-9a59-324078118fda	a244e0ffaa63cde7153226d93c7dcc57cff046b48c575954fe2258149b965933	2026-02-13 12:57:40.199	2026-02-06 12:57:40.200183
a0c6755a-3b78-4d41-80a7-29d6cd60a7a2	5a672d9b-dabc-4778-b380-7587dadab040	c9450f456b081d7124fe357b1d0109c8959fb8036309e4f877a671ec15712693	2026-02-13 13:05:04.049	2026-02-06 13:05:04.049356
0e2ecf7c-b1b2-4301-bf96-a15a66337c2f	654bb34d-fec4-458c-94bc-2223d885a6d7	b8f786c62480207abd934bd33d965f95fd32ba2f2625ac8fed149bdd414b499a	2026-02-13 13:07:10.379	2026-02-06 13:07:10.379493
a3eb9594-f8e7-487c-8f93-4a39cd375b4b	e71fccc9-57c4-42c5-9a59-324078118fda	0c8a79b87a12e64ea02686619625abf1a0f5d99c002763e612e7c636539e0215	2026-02-13 13:09:09.825	2026-02-06 13:09:09.826092
67da5995-f190-402b-9649-f08c9adccd4d	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	411b1f3d4724fa9ae1f36957454b8de199d3fe9162ba82f6c4649c3af922f0b1	2026-02-13 13:10:30.793	2026-02-06 13:10:30.793477
115d3309-4651-4b3d-8611-f951c19b9b63	a57fd791-bef2-4881-baa9-bfbd1c8b799c	08613f68e85e2e0549112f95a02aa1652aee9ec396a62a19b1fce4e2a39bdb29	2026-02-13 13:13:09.462	2026-02-06 13:13:09.463191
2389cac7-f8a6-49cf-9b8a-40adba89aba0	a57fd791-bef2-4881-baa9-bfbd1c8b799c	3ce5f445db68a4ac3bc779fa9222bdc2babf7693f6d9ec34a60fbac5b283daca	2026-02-13 14:10:05.355	2026-02-06 14:10:05.355747
46426338-2cc1-4758-9964-b294c7c4a206	e71fccc9-57c4-42c5-9a59-324078118fda	3dfce6eac1c17d119aa50f277fbbfc88283311448b88313e294ea07d080c172d	2026-02-13 14:10:29.599	2026-02-06 14:10:29.599995
8d2ea2a5-5981-46f7-8c9d-235457119bb0	5a672d9b-dabc-4778-b380-7587dadab040	1e7299e65c4abdd730172b95decc3d8822b630df9b56a1c03ed9a5fd58ed4adf	2026-02-13 14:12:19.453	2026-02-06 14:12:19.453824
b8d551c0-c2c3-4b1e-a16a-417df7fe4df7	a57fd791-bef2-4881-baa9-bfbd1c8b799c	b168432e7194dc6579b72278e2560b7d33f0c5d5cb768c356775ce94f0bb5cfd	2026-02-13 14:14:07.653	2026-02-06 14:14:07.653674
de90f799-d812-46f6-9dfc-cdab4884d5a0	654bb34d-fec4-458c-94bc-2223d885a6d7	320955ecdb002ccd0d061f0e781c2a9706b59fc186d51a146c6953c7540e938e	2026-02-13 14:14:33.516	2026-02-06 14:14:33.516439
4bf0d757-3635-4dbe-9101-9b546e2eac70	5a672d9b-dabc-4778-b380-7587dadab040	765e526d1e2fb6293ccebd26ef55eb8d52d4dad2dc5c5607272f4baddaa4897e	2026-02-13 16:12:23.972	2026-02-06 16:12:23.974617
dd45879d-06a5-400f-a5c2-0917b581beb2	e71fccc9-57c4-42c5-9a59-324078118fda	81a47f48565e733d513748af0100d628838947a89dcc12fcbfa2c790e129cf11	2026-02-13 16:13:47.994	2026-02-06 16:13:47.994965
b6915c6c-80dd-4b1c-8f76-8b29a7d24283	654bb34d-fec4-458c-94bc-2223d885a6d7	59d8ef27b0485e28b4d274f88b9a70c07aa8a44a970802ddb15ceb3dcb36bd46	2026-02-13 16:17:43.069	2026-02-06 16:17:43.069804
94643681-c9d5-45d7-aee5-b03b0136a382	a57fd791-bef2-4881-baa9-bfbd1c8b799c	f7cdd80325d2740649fe6daaa6db4a24c0993f5cf99251bdbaa3462895c76295	2026-02-13 16:19:36.468	2026-02-06 16:19:36.468537
dea09ae3-ddee-4bcd-9fa4-70a4316a87fc	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	d7d2dd0d3c63765e1a47ae270e7f5c3c28d320e1ccd01f1778b270696278843e	2026-02-13 16:21:10.579	2026-02-06 16:21:10.580023
ed000ddc-c680-4f92-9acb-a7bac1f1a8ad	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	0228a7dadd70533ca32d263435f841b78480c458ecac953bd8b650d05f3e7e7f	2026-02-13 16:21:27.108	2026-02-06 16:21:27.1084
f00000ea-e20e-4cef-8a68-36e1c76a5559	5a672d9b-dabc-4778-b380-7587dadab040	b05853ad140760b385565258646bc96ad11b28149a3f669d4a7c054fb5052173	2026-02-13 16:22:52.328	2026-02-06 16:22:52.329208
91463b66-0c64-4a3a-81f8-4d7ea45fc3dc	e71fccc9-57c4-42c5-9a59-324078118fda	c9742759ee9898a1de5f91625801e6a3056a8fa45305cb5e16789df58202a0c6	2026-02-13 17:15:28.71	2026-02-06 17:15:28.710553
acb764a9-a183-4341-8421-eddde6c5097e	5a672d9b-dabc-4778-b380-7587dadab040	554dde7c1ef8973ac175f4fafbefce23315a942b93e4a486f5df9b0a5ce191ad	2026-02-13 17:16:11.846	2026-02-06 17:16:11.846359
258ed5b3-8e06-4b6c-89ba-ed53b5d37919	a57fd791-bef2-4881-baa9-bfbd1c8b799c	41cc828b4eed4b5d5233832b13d000f1cb3fcae6383cfe2f0f3310b6c50e4ed6	2026-02-13 17:18:19.113	2026-02-06 17:18:19.113621
d5ba098c-2f9b-4bf9-97b0-b745d5422ea8	654bb34d-fec4-458c-94bc-2223d885a6d7	039e5ce3e31dfe1c74430a7e74bae368a9821ae7557b540b28dc2db423dcb296	2026-02-13 17:19:03.876	2026-02-06 17:19:03.876329
1ee033a0-e574-48d0-bb51-1850866eb0d0	5a672d9b-dabc-4778-b380-7587dadab040	7e0dbb07ba74908d77cddfb87d7e394ba6372e1713db5bb71924a333acb8b4f0	2026-02-13 17:28:15.654	2026-02-06 17:28:15.65452
0a86d08c-f3e1-4c74-81a9-c33feef498a7	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	d766e626610e6850dce9c472670322591d90800ba96c32c36a61a3322d998976	2026-02-14 08:04:38.392	2026-02-07 08:04:38.392741
e20c5b10-8e74-4514-b7d9-8f526d2ac25a	5a672d9b-dabc-4778-b380-7587dadab040	21743164fe1999695dae24d1ee38845f23a21641e1d7cbd6c3bf20147b7cea39	2026-02-14 08:13:38.411	2026-02-07 08:13:38.412545
4c106eb6-16a3-4030-818b-004d24759ff4	a57fd791-bef2-4881-baa9-bfbd1c8b799c	7c55ee654a3a599ee7cef643173e5b9108487b3c871b96db3e64974ac3567da2	2026-02-14 08:15:00.558	2026-02-07 08:15:00.558504
fb55db9c-73f8-43fb-8ce6-68eb5ab37688	e71fccc9-57c4-42c5-9a59-324078118fda	4592154d8343ca45468b4f25d6be015659748d1165c39d006122953138c593f6	2026-02-14 08:16:12.971	2026-02-07 08:16:12.972275
9c6983cb-ea10-40ef-b434-dba97202a5e9	654bb34d-fec4-458c-94bc-2223d885a6d7	a4c5edbfbfff42554af25e9ed1b8b6e70fff12ba843404a4029901ca9340cffc	2026-02-14 08:19:12.391	2026-02-07 08:19:12.392399
97ce3ff7-8899-42ce-8b31-e92b203123f1	5a672d9b-dabc-4778-b380-7587dadab040	e08b22030b2d4071f0cf66affb5d4dd0f984470aa872ef10d30bc18551487229	2026-02-14 08:24:50.174	2026-02-07 08:24:50.175075
36697b5f-908e-43aa-91dd-ba72f9c007af	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	450a84aa7a349a65437a4bf9c77dfb2fc2c95ebbb6403ee3ec93b0dc180d4695	2026-02-14 08:24:54.73	2026-02-07 08:24:54.730783
3110b1c6-74c5-4b5d-99a0-cdb87eedc3e5	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	44c14b4b295ab1f26a2e2b25a6baf9e037ee77a305c981899172470924113c19	2026-02-14 08:25:07.909	2026-02-07 08:25:07.90936
51b75501-c66e-45c9-8634-ea745e23061d	a57fd791-bef2-4881-baa9-bfbd1c8b799c	9d2cdda04b0a60b77c2bfd018ea7adb948bba93541a5458752525828514ee4f6	2026-02-14 08:27:33.572	2026-02-07 08:27:33.572432
9b94233a-fd0c-49b4-badc-0058a1652dd8	5a672d9b-dabc-4778-b380-7587dadab040	bf1ac4395a10de6b77e2a097d7c1262558a1a278081903ea763aa1afc6627bfc	2026-02-14 09:16:03.108	2026-02-07 09:16:03.109132
74bc80ee-1eb1-4689-b696-792080d04e69	5a672d9b-dabc-4778-b380-7587dadab040	7568350dbed0b782c0b92653bf8551ec0e9d10a7ee76cdff054ce7d8f97a1610	2026-02-14 09:36:18.805	2026-02-07 09:36:18.80597
3fc1f801-af21-4ba2-a1e3-5d606a8d6bc7	e71fccc9-57c4-42c5-9a59-324078118fda	415a688a0d10ef82dfb596b13459774874b7d2078fd293c616c5a9d649a84c1a	2026-02-14 11:21:19.405	2026-02-07 11:21:19.405289
3c816d71-658b-4ae7-b23a-7948e950da2e	a57fd791-bef2-4881-baa9-bfbd1c8b799c	dfa6e04f3e1f2c2419a89e1168576b0292e138c870615be2e1bc21c7f26fd0bd	2026-02-14 11:22:17.634	2026-02-07 11:22:17.634806
47d5c454-2d76-48b5-8b0c-ae2bd767a87d	5a672d9b-dabc-4778-b380-7587dadab040	4602e1608f9a8227b558d262e7ca708146320640366f03de64a7e18a0cd3fe26	2026-02-14 11:35:01.587	2026-02-07 11:35:01.588065
c0ebfe2b-d48a-4eff-9a7c-5f1875397f6e	654bb34d-fec4-458c-94bc-2223d885a6d7	9f73723362016054e1a36d239fbe17582c898de930506beeedbea54887436c64	2026-02-14 11:58:07.72	2026-02-07 11:58:07.720348
f6c40b4b-2559-4fdd-9661-48caaf1604c4	e71fccc9-57c4-42c5-9a59-324078118fda	6fc60c429b3d7fc0b43e7e9082d60dae7acb521307ae998ebb6ba8511347bb41	2026-02-14 12:25:53.329	2026-02-07 12:25:53.33019
aa07f852-edb2-400c-8ddd-bf3b603701b6	5a672d9b-dabc-4778-b380-7587dadab040	5f79b56aad0b23f2ce43f492b177df6737a477c01f86d5372f200f09e446401e	2026-02-14 12:26:51.844	2026-02-07 12:26:51.845087
a67bcc65-34ca-4fe8-b35c-a38de3f911a3	a57fd791-bef2-4881-baa9-bfbd1c8b799c	0039cde8bde8fa9d4a6fba188150c473b27f4ab95cd39cc42b46befc1bf76e83	2026-02-14 12:39:12.791	2026-02-07 12:39:12.7922
042a70d6-d0ec-43e9-9b35-adcdcb670af0	654bb34d-fec4-458c-94bc-2223d885a6d7	da4baae65e0059c57b82dc53c57c40450718b0556fb825d982ce95d245294f1e	2026-02-14 12:44:41.068	2026-02-07 12:44:41.069171
4e55c470-fc07-431f-8473-f2b9bd735ada	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	e4302f06321f4be64a41d23a3ec36ca965c330edcf385f1d7dc8dce17510be21	2026-02-14 13:01:10.092	2026-02-07 13:01:10.092694
69353618-bd85-43a9-a9aa-82f2e1872c06	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	7d30d17c745ba3d75e5ed093f786992cfef01157277ac25fab3d7c58dde6164a	2026-02-14 13:01:26.582	2026-02-07 13:01:26.582499
4604e53a-2e33-4e5a-be19-5c08444d237b	a57fd791-bef2-4881-baa9-bfbd1c8b799c	37343db87345b004ffd34b3da143092ca94cfe8da6a57317b9e2a6bcdf5f701e	2026-02-14 14:03:53.77	2026-02-07 14:03:53.77042
9b387937-820e-4b43-9342-2e5883d73f4c	654bb34d-fec4-458c-94bc-2223d885a6d7	1ad6abe6c975162fc629d0a4360aa0d46958a5b7fdf773fdc16a2f615d026a5c	2026-02-14 14:09:42.87	2026-02-07 14:09:42.870538
3700fbcd-60b2-49b5-97a1-26f0f1f784b5	e71fccc9-57c4-42c5-9a59-324078118fda	2e5b8c4a6f55ed6ebb27c905f8210e1c9d6c332192a095510bad79a1affc2ba8	2026-02-14 14:13:43.539	2026-02-07 14:13:43.539661
a84257d6-f879-47a6-9561-7f63e572506b	36b86e7e-7668-49dc-8dd6-6610ce092a73	08d2bacd7674dbb79a0bfc0a68a87617a9b33c9a10cca0819cfd15d15e714e90	2026-02-14 14:15:16.359	2026-02-07 14:15:16.359498
469c2f44-0fcd-43fd-8ebb-21ead039d601	654bb34d-fec4-458c-94bc-2223d885a6d7	7c46cad54224a7a91ce6b690d49f6bd3b10f0edf36e6813acb5bb6f7b962a42d	2026-02-14 14:18:04.026	2026-02-07 14:18:04.028286
3bce6de9-915e-421e-94f6-f22e877f0d8d	a57fd791-bef2-4881-baa9-bfbd1c8b799c	f612d7838a5474bae58e3d68513ff38df2b99d864231858f586d84332df6fa67	2026-02-14 14:19:52.423	2026-02-07 14:19:52.42369
32e4ef55-874a-4089-af87-4ab53f696cbf	654bb34d-fec4-458c-94bc-2223d885a6d7	8e04b0279be1222806bb304bcb0cc36a821909d64a25c5e9541b1cb995d2d873	2026-02-14 14:23:39.638	2026-02-07 14:23:39.638519
c495d73a-1756-4976-a624-020f8c8144bf	e71fccc9-57c4-42c5-9a59-324078118fda	c37963c9977b0c8f1ccc2e1e03fa5e7ecc20549f916299e0ed53ff23fd67decf	2026-02-14 14:24:57.732	2026-02-07 14:24:57.73251
a4e148c7-77db-4207-b705-62f4b9d10ebe	a57fd791-bef2-4881-baa9-bfbd1c8b799c	3faa6873a4a45ca205f8dc8699d6f898da195efea4d0dcb4a48ff8aa47fe4922	2026-02-14 14:28:08.445	2026-02-07 14:28:08.446208
ebcac979-dc79-4ba3-833d-d29ea6bb89fa	5a672d9b-dabc-4778-b380-7587dadab040	cc0b67d7c583f8335a8aeb3cd27c287fb85e396f03ba3800e0d2f6a8855129e0	2026-02-14 15:44:59.609	2026-02-07 15:44:59.609927
995b3440-206a-480a-8fc0-db29c3258ce1	e71fccc9-57c4-42c5-9a59-324078118fda	fc4fe70dbf1a3229120004a2d8c3bcacbf8d777153f2321bc713659e9e984814	2026-02-14 15:45:40.513	2026-02-07 15:45:40.513308
6a1e7c78-e67a-4743-9d5e-af79a129513e	a57fd791-bef2-4881-baa9-bfbd1c8b799c	e6a10324e0c771189d54bb9abe12870f7b945e6a6506eec5c1923e8acdb45396	2026-02-14 15:48:43.549	2026-02-07 15:48:43.550064
c82e5e6e-8e63-4193-a5a1-b31493fabfa1	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	1745933e1ccf8efa53136c2f20f19a21e920063fcddff2a54531bddfa22e53d6	2026-02-14 15:50:31.611	2026-02-07 15:50:31.611642
bdc1d552-f7c5-48d3-909e-dc263bdee5da	a57fd791-bef2-4881-baa9-bfbd1c8b799c	74d531f7861df29f486871eb38d9836fb14dc418d14092b69198019971224873	2026-02-14 15:53:28.63	2026-02-07 15:53:28.630698
0f113db1-a173-4045-8c6b-2c9cbe4fe006	a57fd791-bef2-4881-baa9-bfbd1c8b799c	72ae6a79a5193aafbcb198a8792f9dde46f7d8df485bdf3964db9c3bccacc31b	2026-02-15 01:59:25.278	2026-02-08 01:59:25.279061
07c880a5-5a3c-4f87-8a0d-e16b6ceb0b38	a57fd791-bef2-4881-baa9-bfbd1c8b799c	4337ab89c1dd504944cfa16b081e3ec550da0c82eb38b11fc9e2e635a7c0564e	2026-02-15 02:26:44.989	2026-02-08 02:26:44.989817
ddcc392a-95a3-4184-9e52-e6d8ffa1d305	a57fd791-bef2-4881-baa9-bfbd1c8b799c	1934b7d855e72ca722f385b1545415f689388b1565821a8c039175bf61cb08ce	2026-02-15 02:38:57.351	2026-02-08 02:38:57.351716
5c8ee88e-b645-418a-a7a6-a021d17c63e6	5a672d9b-dabc-4778-b380-7587dadab040	c8a84c079ad68b900eff41d71a98e40612917fd66d71690d91cdef8eff5bd76d	2026-02-15 02:39:55.763	2026-02-08 02:39:55.764291
b9c87545-3a94-4a59-ab1a-9d978d9d7d01	e71fccc9-57c4-42c5-9a59-324078118fda	9e544d07be47e58bcfb5c37f1ac95d8ec495f972231e2065fb7c8acebb604b0e	2026-02-15 02:41:35.033	2026-02-08 02:41:35.033911
68b011aa-acce-427a-ab8d-a5e59e1810ca	654bb34d-fec4-458c-94bc-2223d885a6d7	f56f59fdf8b3c4531d0f05999506c5ac46119ffb66db5a46081f6e4508d84f50	2026-02-15 02:48:09.311	2026-02-08 02:48:09.311681
54ffc1f8-cb5d-49ae-9c18-6ad81600379d	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2cbd24888b6fec0032c942f865c040b2e58fcef6056c630c9d7107cc1e003ce2	2026-02-15 02:49:12.624	2026-02-08 02:49:12.624273
c7aea0a1-f485-45f9-974e-17c08dfb0a22	a57fd791-bef2-4881-baa9-bfbd1c8b799c	225b85ae0e43169f029d1463bbdbf121c1d9b9f12faed9824f5369fc4c1dc656	2026-02-15 03:08:08.953	2026-02-08 03:08:08.954392
81f9f60d-435b-4ab5-818b-dfb703390014	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	c366d79d36329f798c8f627b3a3b335545dd2d92d617cea206387fa9e505fc49	2026-02-15 03:12:24.12	2026-02-08 03:12:24.120992
3bf6ab29-a359-4b1f-bb23-06aee93098f1	a57fd791-bef2-4881-baa9-bfbd1c8b799c	286c1541f837635d35fb275db773159a04021f06356be9e46339da6ee96e945f	2026-02-15 03:12:49.952	2026-02-08 03:12:49.953021
e8a5dd2f-d9dc-462e-847f-b6d693c79328	5a672d9b-dabc-4778-b380-7587dadab040	28d900fc429f5760d0ca9f15f5b4a3ee126ec7c4d5e6c1e0169bde93c3d6726d	2026-02-15 03:13:38.168	2026-02-08 03:13:38.168568
642a62a5-2fb7-4cdb-b340-d6c5e2dc8093	e71fccc9-57c4-42c5-9a59-324078118fda	27ae04f206bf13f609a4d5038cb8f4adbcff70402873bb844b8a664a85bd9261	2026-02-15 03:14:21.686	2026-02-08 03:14:21.686546
0b7c6422-4ef4-48df-9dcc-63fa82d4f2fd	5a672d9b-dabc-4778-b380-7587dadab040	e32fe448a7d512a12f61c137353a0e8da9965b2fb59db1b901bed437fe35b0da	2026-02-15 03:18:47.248	2026-02-08 03:18:47.249311
7f84670b-f48c-4595-82b1-21c5a5ca45a6	36b86e7e-7668-49dc-8dd6-6610ce092a73	27ed3089724ae3eeb2070e0685f2437be33f16286e2097f7e6f74732836a5f95	2026-02-15 03:19:40.885	2026-02-08 03:19:40.885663
8a060685-44fe-48f8-ad89-6519d831dbd7	a57fd791-bef2-4881-baa9-bfbd1c8b799c	c6e95d915cf8e63dd42262c53375c2149de3912b5544768c03d8dc2fbd9a3789	2026-02-15 03:21:24.755	2026-02-08 03:21:24.755783
36772985-75a3-4cd6-8c28-cb0f5d59301c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	675407da7341312b907ee9ca1ff5f274e3df2551af97cd6ca6a64a0532a9a3f3	2026-02-15 03:33:51.843	2026-02-08 03:33:51.844048
463b7810-156a-40a7-9d28-933299b5ed62	654bb34d-fec4-458c-94bc-2223d885a6d7	5534ab443447cfdc3ac8f6b639a1895a4547a644b6dec388e80d0c5147e8305c	2026-02-15 03:36:18.738	2026-02-08 03:36:18.738666
31ba67f9-3a24-4c9c-aca0-72f2ab03c028	36b86e7e-7668-49dc-8dd6-6610ce092a73	f925e571f958b103b2b4d737cabc260e344034af17f616122a8ae188f2ac7075	2026-02-15 03:42:08.661	2026-02-08 03:42:08.662194
d2716ca3-7d36-46b1-88a1-980a8f1bc5fb	36b86e7e-7668-49dc-8dd6-6610ce092a73	2129c6aef4e0673f524ef9a3e2a7f655415c4aa95ce8a1cbb20abd29e6abed76	2026-02-15 04:07:19.769	2026-02-08 04:07:19.769461
049c0b5c-f616-486d-b797-da065bf75235	36b86e7e-7668-49dc-8dd6-6610ce092a73	006464f92b9fb5126e4cf05540e20972b60c8d359974c22302ec1ff8aaf954ec	2026-02-15 04:16:06.024	2026-02-08 04:16:06.025312
\.


--
-- TOC entry 3983 (class 0 OID 16717)
-- Dependencies: 234
-- Data for Name: registration_document_requirements; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.registration_document_requirements (id, registration_type, vehicle_category, document_type, is_required, display_name, description, accepted_formats, max_file_size_mb, display_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3984 (class 0 OID 16731)
-- Dependencies: 235
-- Data for Name: request_logs; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.request_logs (id, user_id, method, path, status_code, response_time_ms, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- TOC entry 3985 (class 0 OID 16738)
-- Dependencies: 236
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.sessions (id, user_id, refresh_token_id, ip_address, user_agent, created_at, last_activity, expires_at) FROM stdin;
5a45e8fa-a57e-4fa1-ac2c-fb4ce18844b4	e71fccc9-57c4-42c5-9a59-324078118fda	6785a1fd-6f70-42f5-b0a7-fccef6c489b4	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 10:00:08.69798	2026-02-06 10:00:08.69798	2026-02-13 10:00:08.697
19c806b0-0310-4f02-8609-1d9db7859762	a57fd791-bef2-4881-baa9-bfbd1c8b799c	97972356-9feb-4d5d-af69-5ccaefa39809	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 10:01:04.700074	2026-02-06 10:01:04.700074	2026-02-13 10:01:04.699
d9f3fe8a-4e4a-42a1-bf82-ff48bd1cbdda	5a672d9b-dabc-4778-b380-7587dadab040	a494b4a1-8eaa-4183-9e7a-1d80ef2d8321	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 10:04:02.152398	2026-02-06 10:04:02.152398	2026-02-13 10:04:02.152
1b19675a-0d29-4a8e-b964-5576044e0292	654bb34d-fec4-458c-94bc-2223d885a6d7	872cba11-2eb8-40fc-aaff-47a7197590f6	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 10:06:05.227091	2026-02-06 10:15:06.572664	2026-02-13 10:06:05.226
948a0ca9-cb5b-4ee9-965c-98b155224d52	a57fd791-bef2-4881-baa9-bfbd1c8b799c	5389b50e-1ef1-42c2-bf6f-19a47baa79c1	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 12:39:36.385238	2026-02-06 12:39:36.385238	2026-02-13 12:39:36.384
baf6ba1f-63fa-4253-9c37-cb7ef30687fc	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	dea09ae3-ddee-4bcd-9fa4-70a4316a87fc	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 16:21:10.585467	2026-02-06 16:21:10.585467	2026-02-13 16:21:10.585
704cfd29-d25b-476c-bb24-0ee20aac6522	a57fd791-bef2-4881-baa9-bfbd1c8b799c	bca07658-eed8-4275-91f8-5a6ed60e825d	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:51:30.739578	2026-02-06 11:51:30.739578	2026-02-13 11:51:30.739
0621da54-ca2a-4c96-b4c2-ff665b79d975	5a672d9b-dabc-4778-b380-7587dadab040	8d2ea2a5-5981-46f7-8c9d-235457119bb0	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 14:12:19.460643	2026-02-06 15:06:48.754654	2026-02-13 14:12:19.46
dcaad192-44fa-4fbf-aa96-8cf2e434f4bb	a57fd791-bef2-4881-baa9-bfbd1c8b799c	d60e3c34-a5c1-4a0e-b02f-1ea54e438212	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 10:17:59.968253	2026-02-06 10:51:02.958087	2026-02-13 10:17:59.968
47a56838-e50f-4fc2-b0ed-2702fc9be596	e71fccc9-57c4-42c5-9a59-324078118fda	e5c602d3-b8d0-41cc-aabf-6e9dbf55c97f	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 10:58:50.753528	2026-02-06 10:58:50.753528	2026-02-13 10:58:50.753
abbd7856-e4a1-4f9d-b2ba-87cb0f9b0d08	5a672d9b-dabc-4778-b380-7587dadab040	4bf0d757-3635-4dbe-9101-9b546e2eac70	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 16:12:23.981752	2026-02-06 16:12:23.981752	2026-02-13 16:12:23.981
445b7f5c-c772-4239-8369-c978757b01aa	73477102-f36b-448a-89d4-9dc3e93466f8	8144e538-2d0e-49fc-b597-3bab030403b3	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:00:11.469062	2026-02-06 13:51:30.645122	2026-02-13 11:00:11.468
d8096e6c-210a-4f38-97e6-889454271d93	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2389cac7-f8a6-49cf-9b8a-40adba89aba0	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 14:10:05.362629	2026-02-06 14:10:05.362629	2026-02-13 14:10:05.362
c0c9b863-55e4-4253-9d6c-8da4ea71b75c	e71fccc9-57c4-42c5-9a59-324078118fda	46426338-2cc1-4758-9964-b294c7c4a206	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 14:10:29.603969	2026-02-06 14:10:29.603969	2026-02-13 14:10:29.603
52116982-270a-45e4-912e-db4092443283	e71fccc9-57c4-42c5-9a59-324078118fda	c130e41d-22c8-43a3-bb65-ab1a3adb2b03	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 12:57:40.204367	2026-02-06 12:57:40.204367	2026-02-13 12:57:40.204
232ef3a8-c2fb-4a45-8944-44f85d47b8fc	a57fd791-bef2-4881-baa9-bfbd1c8b799c	5f915ca6-ac21-4ee9-9e96-7b5e617b3c7e	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:06:21.717221	2026-02-06 12:59:02.989288	2026-02-13 11:06:21.717
321d6ca1-d74b-4f42-a61d-c30ecfaa1035	5a672d9b-dabc-4778-b380-7587dadab040	a0c6755a-3b78-4d41-80a7-29d6cd60a7a2	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 13:05:04.053626	2026-02-06 13:05:04.053626	2026-02-13 13:05:04.053
4e594ee1-f8f1-43e6-88db-3eae48b7c70c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	5a8db62d-6e38-42cb-96e9-00929d7572ae	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:31:24.669111	2026-02-06 11:31:24.669111	2026-02-13 11:31:24.668
40fb8559-06d7-4576-92f3-ac7e9716e5da	a57fd791-bef2-4881-baa9-bfbd1c8b799c	b8d551c0-c2c3-4b1e-a16a-417df7fe4df7	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 14:14:07.658548	2026-02-06 16:12:32.253019	2026-02-13 14:14:07.658
dc54fbde-6fe4-4f4a-8f4f-4e56be264500	654bb34d-fec4-458c-94bc-2223d885a6d7	0e2ecf7c-b1b2-4301-bf96-a15a66337c2f	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 13:07:10.384945	2026-02-06 13:07:10.384945	2026-02-13 13:07:10.384
ea8084ae-fbd4-45eb-84fe-79d412c45a49	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	e265e779-b27a-451a-9290-a3368acadff8	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:55:55.3839	2026-02-06 13:08:23.417499	2026-02-13 11:55:55.383
87fe3f1f-2f34-4f69-b43e-dacd1e5d5dae	a57fd791-bef2-4881-baa9-bfbd1c8b799c	6261b8b8-2416-4975-a49c-c749c469c893	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:40:53.270829	2026-02-06 11:40:53.270829	2026-02-13 11:40:53.27
3791db72-6068-4ee1-b268-2d3152f54ff0	e71fccc9-57c4-42c5-9a59-324078118fda	a3eb9594-f8e7-487c-8f93-4a39cd375b4b	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 13:09:09.831143	2026-02-06 13:09:09.831143	2026-02-13 13:09:09.83
cc9df767-940f-49f6-aae6-1ff56e18389e	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	4c2ecf9d-9e05-4f73-8323-d87de1a5dfe9	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 11:44:46.072025	2026-02-06 11:44:46.072025	2026-02-13 11:44:46.071
834f74ec-9c65-479e-9e49-53f890200f01	a57fd791-bef2-4881-baa9-bfbd1c8b799c	23e52eb8-1019-41ef-a4d2-cda620e8e7a5	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 12:24:08.520396	2026-02-06 12:24:08.520396	2026-02-13 12:24:08.52
d2cbb0b2-c176-47b3-8f37-b2776460994d	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	67da5995-f190-402b-9649-f08c9adccd4d	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 13:10:30.798111	2026-02-06 13:10:30.798111	2026-02-13 13:10:30.797
7ffcffc1-4026-4ea0-867e-6b7a5b7ed6bb	654bb34d-fec4-458c-94bc-2223d885a6d7	de90f799-d812-46f6-9dfc-cdab4884d5a0	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 14:14:33.522011	2026-02-06 14:14:33.522011	2026-02-13 14:14:33.521
50d4d072-09d4-428f-bdf2-4ef320426726	e71fccc9-57c4-42c5-9a59-324078118fda	dd45879d-06a5-400f-a5c2-0917b581beb2	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 16:13:47.997265	2026-02-06 16:13:47.997265	2026-02-13 16:13:47.997
d2816b61-a002-4460-b688-0ce902c527db	5a672d9b-dabc-4778-b380-7587dadab040	f00000ea-e20e-4cef-8a68-36e1c76a5559	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 16:22:52.334265	2026-02-06 16:22:52.334265	2026-02-13 16:22:52.334
345e0e79-de9a-4ef1-8547-10a94faa56ba	a57fd791-bef2-4881-baa9-bfbd1c8b799c	115d3309-4651-4b3d-8611-f951c19b9b63	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 13:13:09.468058	2026-02-06 13:13:09.468058	2026-02-13 13:13:09.467
2b9bc168-2552-4cc8-87ce-7d7392455e63	654bb34d-fec4-458c-94bc-2223d885a6d7	b6915c6c-80dd-4b1c-8f76-8b29a7d24283	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 16:17:43.074633	2026-02-06 16:17:43.074633	2026-02-13 16:17:43.074
753bbd0d-fd95-47df-8cc9-a6672bd94e76	a57fd791-bef2-4881-baa9-bfbd1c8b799c	258ed5b3-8e06-4b6c-89ba-ed53b5d37919	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 17:18:19.118985	2026-02-06 17:49:11.32005	2026-02-13 17:18:19.118
0fba9234-7f11-4897-a61e-fbc0a3991f08	e71fccc9-57c4-42c5-9a59-324078118fda	91463b66-0c64-4a3a-81f8-4d7ea45fc3dc	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 17:15:28.715692	2026-02-06 17:15:28.715692	2026-02-13 17:15:28.715
3d074b53-7725-4e43-b896-bd28300c7496	a57fd791-bef2-4881-baa9-bfbd1c8b799c	94643681-c9d5-45d7-aee5-b03b0136a382	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 16:19:36.473467	2026-02-06 17:04:50.292052	2026-02-13 16:19:36.473
d293e039-ce3a-47f9-bf36-bef5da550f2f	5a672d9b-dabc-4778-b380-7587dadab040	acb764a9-a183-4341-8421-eddde6c5097e	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 17:16:11.848839	2026-02-06 17:16:11.848839	2026-02-13 17:16:11.848
bc3ef85f-b63a-4593-8e8a-53bc01a5acb6	654bb34d-fec4-458c-94bc-2223d885a6d7	d5ba098c-2f9b-4bf9-97b0-b745d5422ea8	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 17:19:03.881125	2026-02-06 17:19:03.881125	2026-02-13 17:19:03.88
7d77f767-ece8-43c8-b047-74ed606c7b56	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	ed000ddc-c680-4f92-9acb-a7bac1f1a8ad	180.195.72.229	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-06 16:21:27.111439	2026-02-06 17:30:38.829022	2026-02-13 16:21:27.111
e7a9cf77-5c1b-45fd-affd-8b51c1f6b0bd	5a672d9b-dabc-4778-b380-7587dadab040	47d5c454-2d76-48b5-8b0c-ae2bd767a87d	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 11:35:01.595323	2026-02-07 12:20:45.873393	2026-02-14 11:35:01.595
2e4b9bc5-ad25-4e42-b492-896ba2e64659	a57fd791-bef2-4881-baa9-bfbd1c8b799c	4604e53a-2e33-4e5a-be19-5c08444d237b	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:03:53.773211	2026-02-07 14:03:53.773211	2026-02-14 14:03:53.773
4fa233eb-c608-41a7-8b81-cf78ea680fd0	5a672d9b-dabc-4778-b380-7587dadab040	1ee033a0-e574-48d0-bb51-1850866eb0d0	112.201.203.28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-06 17:28:15.661444	2026-02-06 17:55:15.967145	2026-02-13 17:28:15.661
8b62e94d-3693-4eac-a3be-78b82bad01d3	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	0a86d08c-f3e1-4c74-81a9-c33feef498a7	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:04:38.402945	2026-02-07 08:04:38.402945	2026-02-14 08:04:38.402
34544f7c-1b03-4b85-b9da-7c8727609e63	5a672d9b-dabc-4778-b380-7587dadab040	e20c5b10-8e74-4514-b7d9-8f526d2ac25a	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-07 08:13:38.419306	2026-02-07 08:13:38.419306	2026-02-14 08:13:38.418
c03ed66b-8427-43eb-b95a-0ac472ed2126	a57fd791-bef2-4881-baa9-bfbd1c8b799c	4c106eb6-16a3-4030-818b-004d24759ff4	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:15:00.563864	2026-02-07 08:15:00.563864	2026-02-14 08:15:00.563
0d0254b4-af7c-4d35-871a-9cae1a9560aa	e71fccc9-57c4-42c5-9a59-324078118fda	fb55db9c-73f8-43fb-8ce6-68eb5ab37688	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:16:12.977828	2026-02-07 08:16:12.977828	2026-02-14 08:16:12.977
9674e5f4-d290-493c-b61b-e0790d19043f	5a672d9b-dabc-4778-b380-7587dadab040	97ce3ff7-8899-42ce-8b31-e92b203123f1	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-07 08:24:50.181171	2026-02-07 08:24:50.181171	2026-02-14 08:24:50.18
4cfd0c05-d344-41b7-b176-2dc63c033126	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	36697b5f-908e-43aa-91dd-ba72f9c007af	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:24:54.734033	2026-02-07 08:24:54.734033	2026-02-14 08:24:54.733
089e8325-b54d-499e-9e8d-ace2ae7d1402	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	3110b1c6-74c5-4b5d-99a0-cdb87eedc3e5	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:25:07.911709	2026-02-07 08:25:07.911709	2026-02-14 08:25:07.911
d34e7ba9-55ea-4635-ad34-5c28cb54654a	a57fd791-bef2-4881-baa9-bfbd1c8b799c	51b75501-c66e-45c9-8634-ea745e23061d	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:27:33.578384	2026-02-07 08:27:33.578384	2026-02-14 08:27:33.578
d26c0467-8e30-4e70-ae4f-621c8d9bca53	e71fccc9-57c4-42c5-9a59-324078118fda	f6c40b4b-2559-4fdd-9661-48caaf1604c4	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 12:25:53.332914	2026-02-07 12:25:53.332914	2026-02-14 12:25:53.332
7db87ed9-cb97-43d9-8e8c-345fc16c1786	5a672d9b-dabc-4778-b380-7587dadab040	aa07f852-edb2-400c-8ddd-bf3b603701b6	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 12:26:51.851937	2026-02-07 12:43:01.003421	2026-02-14 12:26:51.851
89aca68e-5430-4f9b-ae21-63cfea0828ca	e71fccc9-57c4-42c5-9a59-324078118fda	3fc1f801-af21-4ba2-a1e3-5d606a8d6bc7	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 11:21:19.410381	2026-02-07 11:21:19.410381	2026-02-14 11:21:19.41
21f77a6d-5842-4cc1-bc30-7e9f7ce925d0	5a672d9b-dabc-4778-b380-7587dadab040	9b94233a-fd0c-49b4-badc-0058a1652dd8	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 09:16:03.111905	2026-02-07 09:25:02.942764	2026-02-14 09:16:03.111
02d77a49-7b1d-4cc1-bf3e-652381791ed2	a57fd791-bef2-4881-baa9-bfbd1c8b799c	3c816d71-658b-4ae7-b23a-7948e950da2e	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-07 11:22:17.639458	2026-02-07 11:22:17.639458	2026-02-14 11:22:17.639
11aa0da8-8748-4d20-87c6-51b45f202010	5a672d9b-dabc-4778-b380-7587dadab040	74bc80ee-1eb1-4689-b696-792080d04e69	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 09:36:18.809315	2026-02-07 09:36:18.809315	2026-02-14 09:36:18.809
24e0ef2c-574c-4eb1-90da-1b838fc32ada	654bb34d-fec4-458c-94bc-2223d885a6d7	042a70d6-d0ec-43e9-9b35-adcdcb670af0	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 12:44:41.073933	2026-02-07 12:44:41.073933	2026-02-14 12:44:41.073
672b02d4-909f-4249-8f39-da697d24af11	654bb34d-fec4-458c-94bc-2223d885a6d7	9c6983cb-ea10-40ef-b434-dba97202a5e9	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 08:19:12.398216	2026-02-07 11:35:20.24229	2026-02-14 08:19:12.398
e00e8d59-6379-4d78-922b-28b4320f6a34	654bb34d-fec4-458c-94bc-2223d885a6d7	469c2f44-0fcd-43fd-8ebb-21ead039d601	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:18:04.032467	2026-02-08 02:08:01.305049	2026-02-14 14:18:04.032
8f9d8f18-bf49-4a2f-9ba8-8dfb0fddbcbb	654bb34d-fec4-458c-94bc-2223d885a6d7	c0ebfe2b-d48a-4eff-9a7c-5f1875397f6e	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 11:58:07.724692	2026-02-07 11:58:07.724692	2026-02-14 11:58:07.724
7159c105-dd22-4aff-9a71-dc21f52044fe	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	4e55c470-fc07-431f-8473-f2b9bd735ada	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 13:01:10.098511	2026-02-07 13:01:10.098511	2026-02-14 13:01:10.098
4160eafb-1dc4-4cf0-b351-ea5c0294d652	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	69353618-bd85-43a9-a9aa-82f2e1872c06	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 13:01:26.586307	2026-02-07 13:01:26.586307	2026-02-14 13:01:26.586
79a21bad-8591-4b84-8d0a-1865a0251ec2	654bb34d-fec4-458c-94bc-2223d885a6d7	9b387937-820e-4b43-9342-2e5883d73f4c	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:09:42.873053	2026-02-07 14:09:42.873053	2026-02-14 14:09:42.872
f8dcc7b2-59c8-4d66-9523-80a90c751e2a	e71fccc9-57c4-42c5-9a59-324078118fda	3700fbcd-60b2-49b5-97a1-26f0f1f784b5	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:13:43.542985	2026-02-07 14:13:43.542985	2026-02-14 14:13:43.542
e57a8a9c-c00f-46f2-9eb8-24e96968356f	a57fd791-bef2-4881-baa9-bfbd1c8b799c	a67bcc65-34ca-4fe8-b35c-a38de3f911a3	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0	2026-02-07 12:39:12.794989	2026-02-07 14:16:15.280443	2026-02-14 12:39:12.794
18727960-65c1-45e7-ab35-44ad6546f624	36b86e7e-7668-49dc-8dd6-6610ce092a73	a84257d6-f879-47a6-9561-7f63e572506b	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:15:16.365947	2026-02-07 14:15:16.365947	2026-02-14 14:15:16.365
e9a980d8-d4ab-4ccb-90bd-5fd6ce062e84	a57fd791-bef2-4881-baa9-bfbd1c8b799c	3bce6de9-915e-421e-94f6-f22e877f0d8d	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:19:52.431324	2026-02-07 14:19:52.431324	2026-02-14 14:19:52.431
18c79be1-30e3-4f87-afd5-4131b5426aa6	654bb34d-fec4-458c-94bc-2223d885a6d7	32e4ef55-874a-4089-af87-4ab53f696cbf	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:23:39.644934	2026-02-07 14:23:39.644934	2026-02-14 14:23:39.644
3fbb6606-d0aa-434d-9840-3459151f09d9	e71fccc9-57c4-42c5-9a59-324078118fda	c495d73a-1756-4976-a624-020f8c8144bf	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:24:57.737492	2026-02-07 14:24:57.737492	2026-02-14 14:24:57.737
9dc0cc8a-bbb9-4a02-86ac-927a4e304098	a57fd791-bef2-4881-baa9-bfbd1c8b799c	a4e148c7-77db-4207-b705-62f4b9d10ebe	180.195.65.85	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 14:28:08.449308	2026-02-07 14:28:08.449308	2026-02-14 14:28:08.449
2859a0c7-8cfe-4aad-b9bc-72bf89750713	e71fccc9-57c4-42c5-9a59-324078118fda	995b3440-206a-480a-8fc0-db29c3258ce1	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 15:45:40.518815	2026-02-07 15:45:40.518815	2026-02-14 15:45:40.518
863117d3-0d82-4789-80e7-aef68e768a43	5a672d9b-dabc-4778-b380-7587dadab040	ebcac979-dc79-4ba3-833d-d29ea6bb89fa	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 15:44:59.616784	2026-02-08 02:08:00.911727	2026-02-14 15:44:59.616
4d71fc7b-b33c-4e9b-b53e-8f16da90856a	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	c82e5e6e-8e63-4193-a5a1-b31493fabfa1	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 15:50:31.616674	2026-02-07 15:50:31.616674	2026-02-14 15:50:31.616
94fd65f2-4b62-48e3-9ff7-d3afda7429dc	a57fd791-bef2-4881-baa9-bfbd1c8b799c	bdc1d552-f7c5-48d3-909e-dc263bdee5da	180.195.75.235	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 15:53:28.637442	2026-02-07 15:53:28.637442	2026-02-14 15:53:28.637
ef9c8378-ae82-48ce-86c3-e4557e5f0ba7	a57fd791-bef2-4881-baa9-bfbd1c8b799c	c7aea0a1-f485-45f9-974e-17c08dfb0a22	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:08:08.961108	2026-02-08 04:02:02.980645	2026-02-15 03:08:08.96
502e47cd-1da0-498a-83cb-b2c5492c2737	5a672d9b-dabc-4778-b380-7587dadab040	0b7c6422-4ef4-48df-9dcc-63fa82d4f2fd	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:18:47.255959	2026-02-08 03:18:47.255959	2026-02-15 03:18:47.255
766f4444-8a73-4b69-8a24-feef2dbef659	36b86e7e-7668-49dc-8dd6-6610ce092a73	7f84670b-f48c-4595-82b1-21c5a5ca45a6	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:19:40.890129	2026-02-08 03:19:40.890129	2026-02-15 03:19:40.889
6b9beabb-825a-4e52-acc9-e9ff0e8d506d	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	81f9f60d-435b-4ab5-818b-dfb703390014	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:12:24.127574	2026-02-08 05:00:12.625995	2026-02-15 03:12:24.127
c52da41a-bebc-466b-afa6-7643e6731d3b	a57fd791-bef2-4881-baa9-bfbd1c8b799c	8a060685-44fe-48f8-ad89-6519d831dbd7	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:21:24.7592	2026-02-08 03:21:24.7592	2026-02-15 03:21:24.759
ee500387-4d02-4d7a-a191-9b595a4a4097	5a672d9b-dabc-4778-b380-7587dadab040	5c8ee88e-b645-418a-a7a6-a021d17c63e6	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 02:39:55.772341	2026-02-08 03:21:41.459462	2026-02-15 02:39:55.771
02adfdc2-a1f8-45cf-afd2-89623f1c5340	36b86e7e-7668-49dc-8dd6-6610ce092a73	d2716ca3-7d36-46b1-88a1-980a8f1bc5fb	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 04:07:19.775174	2026-02-08 04:07:19.775174	2026-02-15 04:07:19.774
f13c746b-6818-450c-a930-8d17cbe30fd3	36b86e7e-7668-49dc-8dd6-6610ce092a73	049c0b5c-f616-486d-b797-da065bf75235	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 04:16:06.032515	2026-02-08 05:08:04.869952	2026-02-15 04:16:06.032
6ec54913-1db9-47c3-83bd-ac75091bbeac	a57fd791-bef2-4881-baa9-bfbd1c8b799c	36772985-75a3-4cd6-8c28-cb0f5d59301c	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:33:51.851545	2026-02-08 03:33:51.851545	2026-02-15 03:33:51.851
83c2e9e7-51f4-4109-86e3-4e08c4fe7981	654bb34d-fec4-458c-94bc-2223d885a6d7	463b7810-156a-40a7-9d28-933299b5ed62	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:36:18.746143	2026-02-08 03:36:18.746143	2026-02-15 03:36:18.745
e294d597-c73a-41d3-a074-86b984c9a591	a57fd791-bef2-4881-baa9-bfbd1c8b799c	6a1e7c78-e67a-4743-9d5e-af79a129513e	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-07 15:48:43.555104	2026-02-08 01:50:00.856183	2026-02-14 15:48:43.554
fe40fbcb-6e09-4c6d-8690-c020393189ef	a57fd791-bef2-4881-baa9-bfbd1c8b799c	0f113db1-a173-4045-8c6b-2c9cbe4fe006	180.195.68.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 01:59:25.281934	2026-02-08 01:59:25.281934	2026-02-15 01:59:25.281
9f203378-7d83-4a0a-9324-046625621f95	a57fd791-bef2-4881-baa9-bfbd1c8b799c	07c880a5-5a3c-4f87-8a0d-e16b6ceb0b38	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 02:26:44.995179	2026-02-08 02:26:44.995179	2026-02-15 02:26:44.994
f2ad3c55-0ab4-48aa-abdb-9bcbb883a1b8	a57fd791-bef2-4881-baa9-bfbd1c8b799c	ddcc392a-95a3-4184-9e52-e6d8ffa1d305	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 02:38:57.358946	2026-02-08 02:38:57.358946	2026-02-15 02:38:57.358
35086d87-340a-4c38-9f83-2ded44439998	e71fccc9-57c4-42c5-9a59-324078118fda	b9c87545-3a94-4a59-ab1a-9d978d9d7d01	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 02:41:35.040365	2026-02-08 02:41:35.040365	2026-02-15 02:41:35.04
8994bbc6-adbd-4c31-bac7-faa2a7b9a831	654bb34d-fec4-458c-94bc-2223d885a6d7	68b011aa-acce-427a-ab8d-a5e59e1810ca	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 02:48:09.316526	2026-02-08 02:48:09.316526	2026-02-15 02:48:09.316
ed982ba3-3cdc-4992-95aa-d5632972b99c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	54ffc1f8-cb5d-49ae-9c18-6ad81600379d	112.201.192.141	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 02:49:12.626631	2026-02-08 02:58:11.869319	2026-02-15 02:49:12.626
37c5768f-b5f9-4e46-a0ec-095630a14ca6	a57fd791-bef2-4881-baa9-bfbd1c8b799c	3bf6ab29-a359-4b1f-bb23-06aee93098f1	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:12:49.956842	2026-02-08 03:12:49.956842	2026-02-15 03:12:49.956
5c114ee1-ff5e-49e0-bedd-4a507e7e2562	5a672d9b-dabc-4778-b380-7587dadab040	e8a5dd2f-d9dc-462e-847f-b6d693c79328	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:13:38.172047	2026-02-08 03:13:38.172047	2026-02-15 03:13:38.171
4de371e1-16d5-489c-ba5e-021709193b2c	e71fccc9-57c4-42c5-9a59-324078118fda	642a62a5-2fb7-4cdb-b340-d6c5e2dc8093	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:14:21.690464	2026-02-08 03:14:21.690464	2026-02-15 03:14:21.69
a5b40076-c84e-423a-ac18-397dcfcb8ad6	36b86e7e-7668-49dc-8dd6-6610ce092a73	31ba67f9-3a24-4c9c-aca0-72f2ab03c028	180.195.66.10	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-08 03:42:08.666695	2026-02-08 03:53:38.88288	2026-02-15 03:42:08.666
\.


--
-- TOC entry 3986 (class 0 OID 16746)
-- Dependencies: 237
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.system_settings (key, value, description, updated_at, updated_by) FROM stdin;
\.


--
-- TOC entry 3987 (class 0 OID 16752)
-- Dependencies: 238
-- Data for Name: token_blacklist; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.token_blacklist (token_jti, token_hash, expires_at, created_at, reason) FROM stdin;
\.


--
-- TOC entry 3988 (class 0 OID 16759)
-- Dependencies: 239
-- Data for Name: transfer_documents; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_documents (id, transfer_request_id, document_type, document_id, uploaded_by, uploaded_at, notes) FROM stdin;
5e799df8-d999-480c-aee6-b6a0f7d1ff60	035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	deed_of_sale	f2a78d77-117f-4270-a6ca-e4ab77b043d2	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:10:28.610299	\N
301d0940-1fe9-4107-936f-eb1b8b42c9bf	035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	seller_id	c9bc9efb-c834-4ce5-b834-9177cec096aa	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:10:28.615212	\N
1b2585c0-cca5-4ea2-beb1-8a5d710411be	035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	buyer_hpg_clearance	91398931-e41f-462b-bf77-f5325d017acc	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:31.13895	\N
40db496e-7f5b-4cd7-8461-166b443f2c13	035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	buyer_ctpl	9a828788-8d74-4746-aacb-b9a0ebe17cce	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:34.987281	\N
6250db6f-f733-4fc3-aea3-87bb22a6f1ba	035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	buyer_id	68783a42-2a70-4d4c-9499-aecc096661f3	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:40.565526	\N
460fe922-bb45-4500-8ed5-04b188aeedff	035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	buyer_tin	379a8aed-aea3-4e5a-85da-504149f09d68	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:46.589638	\N
7c8f92c4-ca1f-4bb8-b7cd-0b47560a7842	b9d4b298-be8a-44e8-bf87-990f55137061	deed_of_sale	d1ba8157-3849-4c81-b7b5-80910973c09f	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:21:27.861688	\N
f4c60c87-70d2-4bf1-ae50-8d3f7eaca7f5	b9d4b298-be8a-44e8-bf87-990f55137061	seller_id	f76727bf-ef89-4e39-82f5-0eeff6307b69	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:21:27.866275	\N
50a746c4-55b8-4ffd-b1d7-543421271d73	3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	deed_of_sale	55f12808-7666-4c77-bb5f-eaa09322a206	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:23:16.437997	\N
04632517-4c17-474d-bd96-5e909b1f9d46	3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	seller_id	1178cf62-2cb3-4756-b004-aaa2ff418437	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:23:16.443365	\N
e401d872-8464-4a03-bce3-3f2285470cec	3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	buyer_id	7d6e57fa-493f-4292-bccd-10464837ea5f	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:08.186523	\N
ecba90aa-44f2-45b9-b165-a7b3ee79ae3a	3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	buyer_tin	b0f0e49b-4c27-447d-8943-9cb0bfa8ecc3	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:13.332868	\N
bc9ed810-0c6d-4c46-b0bb-fd1997e1295e	3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	buyer_hpg_clearance	023698c1-3747-47df-af38-bae074d03846	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:17.123022	\N
0f5a4d8d-ea1d-4a85-9432-a8420543b2db	3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	buyer_ctpl	0e02102b-9ff6-43a3-a266-d8b3ffbf9d70	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:20.879061	\N
5750367b-c094-4a40-85b0-edff0a3095be	9c316439-0fed-40ac-affb-aaa7703a3843	deed_of_sale	80b2500a-37e3-4ba1-b34e-28fb7c132c30	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:25:20.098326	\N
1896efe9-9b37-4a76-8a04-397705631f5c	9c316439-0fed-40ac-affb-aaa7703a3843	seller_id	d9bacc27-7a98-4798-b895-41da53f1857d	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:25:20.102516	\N
35f88cb7-4af1-4ed0-8d16-6bb5eebd41f2	9c316439-0fed-40ac-affb-aaa7703a3843	buyer_id	c364b6b2-4b92-4b2e-8833-c4e4972a6805	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:25:43.878621	\N
6274cee2-b447-44a5-87c6-b0aeff92107c	9c316439-0fed-40ac-affb-aaa7703a3843	buyer_tin	66aee559-1341-4cb4-9275-d1eb886fbb04	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:25:47.268876	\N
4878d027-b3b7-46a4-8f7f-58d6bdfff24d	9c316439-0fed-40ac-affb-aaa7703a3843	buyer_hpg_clearance	f1ae7553-08be-4045-94f7-fc803305947e	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:25:51.453818	\N
1dc83f2d-3bbe-4260-b89a-750055bebcd5	9c316439-0fed-40ac-affb-aaa7703a3843	buyer_ctpl	a4c57d59-fd65-424c-83e1-2b5dc9486d8f	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:25:56.981969	\N
5b40ce06-775f-4c24-9b2c-f5ce252dcffb	8a3dae85-09b0-4286-8ce3-03e37dcc79fc	deed_of_sale	35173f7f-2793-4bca-af4b-094574d5d608	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:37:38.777575	\N
c56361d0-8f7d-424b-9e0b-1a4fe8cbea27	8a3dae85-09b0-4286-8ce3-03e37dcc79fc	seller_id	d37c9482-8eba-4cfc-8c91-887251dd59dc	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:37:38.781299	\N
de7a7554-7e13-4ff6-b156-ee8a11a08c61	f4073003-69fb-4b39-aef1-a58f65bbd373	deed_of_sale	72f487ed-fed0-4d71-bd64-339bf18cc93b	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 12:34:58.442031	\N
c4532faa-6de7-414b-aa48-c63cc591b186	f4073003-69fb-4b39-aef1-a58f65bbd373	seller_id	dd4c74af-79de-415b-abca-210d7686e2be	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 12:34:58.445806	\N
fb8047a4-6324-40ea-8c2f-019dbf08266c	8a3dae85-09b0-4286-8ce3-03e37dcc79fc	buyer_id	dcee11c3-cd27-4a2b-8964-39051a423831	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:01:56.060199	\N
99615ccc-0a6c-49c6-963a-2695064584f7	8a3dae85-09b0-4286-8ce3-03e37dcc79fc	buyer_tin	4dd1263e-9ae0-49a5-aec1-295949b1abba	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:00.886631	\N
53f61f80-cfae-4990-97ed-72b91105f01e	8a3dae85-09b0-4286-8ce3-03e37dcc79fc	buyer_hpg_clearance	dfd2a30d-ffa0-4457-9784-9a3596988f2a	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:04.362161	\N
72edb828-1968-4ccd-9d92-b4b00ed99ddb	8a3dae85-09b0-4286-8ce3-03e37dcc79fc	buyer_ctpl	6c7cd31c-23cf-44c5-842a-5bb33970fe4e	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:07.786297	\N
4fab52a7-97c5-4375-9e1a-a49db6184c9d	5e09c9fb-0dd4-470a-8e02-77907e76988f	deed_of_sale	c2fb98e8-fe08-44cd-9a11-f88bed2f0975	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:15:39.529341	\N
69cbc00a-1868-455e-bf87-acce568e7649	5e09c9fb-0dd4-470a-8e02-77907e76988f	seller_id	a3adac8d-2ce4-4ee7-8cfb-c5338acdcf6e	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:15:39.533544	\N
fe90b213-00b9-4090-922d-1aa7ad5d9708	5e09c9fb-0dd4-470a-8e02-77907e76988f	buyer_id	02c19ec9-471d-47e2-86eb-a9ed45919dc6	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:10.547981	\N
b15e3ff8-38b8-44e9-a67a-8afe5e019947	5e09c9fb-0dd4-470a-8e02-77907e76988f	buyer_tin	d1e32853-e366-4dae-ae86-02455e5f0857	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:14.958783	\N
b00cb106-d4a1-49d4-90f5-b421350c7195	5e09c9fb-0dd4-470a-8e02-77907e76988f	buyer_hpg_clearance	a3cd7e1e-5f51-483e-86db-4a896a36eb30	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:18.920654	\N
80e797e5-3dbe-4fba-a3ba-dbb8a992ac5a	5e09c9fb-0dd4-470a-8e02-77907e76988f	buyer_ctpl	32c29922-8de9-49c0-9d38-398353227dda	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:22.782436	\N
7dc66375-4f6d-4852-a719-d5e65e7d29ac	763829ad-01c1-48c9-9ce6-c60c3ae7ea42	deed_of_sale	ae78ab6e-4b6a-46fc-9948-a4931427bd9c	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 15:47:28.220437	\N
6a7409b4-097d-4263-a585-be0a24f97b33	763829ad-01c1-48c9-9ce6-c60c3ae7ea42	seller_id	637a858b-b7ab-4bb1-98de-fceb952f6c26	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 15:47:28.224523	\N
44098316-4b60-4643-bf94-2eaf2bf2b77c	763829ad-01c1-48c9-9ce6-c60c3ae7ea42	buyer_id	453158af-3023-4881-a2c3-b605ca4f7f6a	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 15:51:31.424451	\N
d9a0d4f3-da51-4112-9667-b4177ecde082	763829ad-01c1-48c9-9ce6-c60c3ae7ea42	buyer_hpg_clearance	8e115d2f-620d-4fe8-a1de-06b8ab3b88a7	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 15:51:36.248377	\N
c3386ee8-6a3f-40fb-8836-d391f03588db	763829ad-01c1-48c9-9ce6-c60c3ae7ea42	buyer_ctpl	403a34a4-79bc-441d-8693-c48cd6d31e1b	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 15:51:39.383349	\N
0c5d326e-fe99-4754-b3fe-cdff85ced93a	763829ad-01c1-48c9-9ce6-c60c3ae7ea42	buyer_tin	f89cd402-11e3-4b75-8e20-4db84820c792	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 15:51:44.543223	\N
d43272a5-7943-4e95-89f2-ba4516237b50	36bd5846-8247-48fa-8271-6f7400bee66d	deed_of_sale	96edd85f-c6f2-43bf-bc2e-04711e0425da	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 03:19:28.196017	\N
55b7928a-0b60-4ccf-957a-c0b09eb45c16	36bd5846-8247-48fa-8271-6f7400bee66d	seller_id	4c7d8b2a-3ff3-4a19-a13a-dbbec6bff494	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 03:19:28.199296	\N
461c49a0-24ba-4def-b1df-fb4b807dc5a1	36bd5846-8247-48fa-8271-6f7400bee66d	buyer_id	8ea1d7e0-dc13-4803-8ea4-9a633c495a98	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-08 03:19:56.367582	\N
1b6dbcb8-97a3-4ade-a88c-1c00d5ced6f9	36bd5846-8247-48fa-8271-6f7400bee66d	buyer_tin	1814ce67-ee43-41a7-8f7f-db919acd0f70	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-08 03:20:02.731103	\N
75d3a512-38f0-4834-92d9-65231d25e880	36bd5846-8247-48fa-8271-6f7400bee66d	buyer_hpg_clearance	6cd2d9f0-0386-49e7-8bc5-b90568d1f4b0	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-08 03:20:09.625683	\N
60162457-b92a-454f-b9dd-bdcb10a0aea6	36bd5846-8247-48fa-8271-6f7400bee66d	buyer_ctpl	80adf8b6-9689-4fad-8cf7-babc55fcdf14	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-08 03:20:15.450788	\N
\.


--
-- TOC entry 3978 (class 0 OID 16667)
-- Dependencies: 228
-- Data for Name: transfer_requests; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_requests (id, vehicle_id, seller_id, buyer_id, buyer_info, status, submitted_at, reviewed_by, reviewed_at, rejection_reason, forwarded_to_hpg, hpg_clearance_request_id, metadata, created_at, updated_at, insurance_clearance_request_id, emission_clearance_request_id, insurance_approval_status, emission_approval_status, hpg_approval_status, insurance_approved_at, emission_approved_at, hpg_approved_at, insurance_approved_by, emission_approved_by, hpg_approved_by, expires_at, remarks) FROM stdin;
8a3dae85-09b0-4286-8ce3-03e37dcc79fc	47916952-a48c-486a-8421-014905e38968	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	FORWARDED_TO_HPG	2026-02-07 11:37:38.763475	\N	2026-02-07 13:02:10.296127	\N	t	68d7ea46-9c5f-49d5-b23d-724cb62b3e2b	{"expiresAt": "2026-02-10T11:37:38.742Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "dfd2a30d-ffa0-4457-9784-9a3596988f2a"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "6c7cd31c-23cf-44c5-842a-5bb33970fe4e"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "4dd1263e-9ae0-49a5-aec1-295949b1abba"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-07T13:02:10.295Z", "vehicleId": "47916952-a48c-486a-8421-014905e38968", "transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc"}, "autoForward": {"results": {"hpg": {"success": true, "clearanceRequestId": "68d7ea46-9c5f-49d5-b23d-724cb62b3e2b"}, "insurance": {"success": true, "clearanceRequestId": "9156e97d-655f-45ef-8f6b-8a02f4359073"}}, "version": "2026-01", "startedAt": "2026-02-07T13:02:10.916Z", "finishedAt": "2026-02-07T13:02:12.190Z", "triggeredBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "autoTriggered": true}, "buyerAcceptedAt": "2026-02-07T13:02:10.276Z", "buyerAcceptedBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "buyerSubmittedAt": "2026-02-07T13:02:10.276Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "68d7ea46-9c5f-49d5-b23d-724cb62b3e2b", "insuranceClearanceRequestId": "9156e97d-655f-45ef-8f6b-8a02f4359073"}	2026-02-07 11:37:38.763475	2026-02-07 13:02:12.191004	9156e97d-655f-45ef-8f6b-8a02f4359073	\N	APPROVED	PENDING	PENDING	2026-02-07 13:02:12.184007	\N	\N	\N	\N	\N	2026-02-10 11:37:38.742	\N
5e09c9fb-0dd4-470a-8e02-77907e76988f	d50832ba-fd65-497c-8e23-cfef1850df37	36b86e7e-7668-49dc-8dd6-6610ce092a73	09752f67-da7e-4a6c-97c9-174760bc0d9c	{"email": "longganisaseller11@gmail.com", "phone": "09672564545", "lastName": "Besmar", "firstName": "Andrei"}	REJECTED	2026-02-07 14:15:39.52109	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:13:13.727671	No owner	t	\N	{"expiresAt": "2026-02-10T14:15:39.513Z", "returnedAt": "2026-02-07T14:27:49.018Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "a3cd7e1e-5f51-483e-86db-4a896a36eb30"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "32c29922-8de9-49c0-9d38-398353227dda"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "d1e32853-e366-4dae-ae86-02455e5f0857"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-07T14:18:24.993Z", "vehicleId": "d50832ba-fd65-497c-8e23-cfef1850df37", "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f"}, "autoForward": {"results": {"hpg": {"success": true, "clearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134"}, "insurance": {"success": true, "clearanceRequestId": "bbd6c04c-5c18-487b-aaf3-f7e9422d76cb"}}, "version": "2026-01", "startedAt": "2026-02-07T14:18:25.616Z", "finishedAt": "2026-02-07T14:18:26.389Z", "triggeredBy": "09752f67-da7e-4a6c-97c9-174760bc0d9c", "autoTriggered": true}, "hpgApproved": true, "returnedToLTO": true, "buyerAcceptedAt": "2026-02-07T14:18:24.976Z", "buyerAcceptedBy": "09752f67-da7e-4a6c-97c9-174760bc0d9c", "buyerSubmittedAt": "2026-02-07T14:18:24.976Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134", "insuranceClearanceRequestId": "bbd6c04c-5c18-487b-aaf3-f7e9422d76cb"}	2026-02-07 14:15:39.52109	2026-02-08 03:13:13.735379	\N	\N	APPROVED	PENDING	APPROVED	2026-02-07 14:18:26.382376	\N	2026-02-07 14:27:49.011189	\N	\N	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-10 14:15:39.513	\N
035d6f28-5ed7-4261-8d1a-f6d1174fa4f6	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	UNDER_REVIEW	2026-02-06 13:10:28.596434	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:16:28.939346	\N	t	b29a9117-a0f1-4722-90d7-c66df0f7350b	{"expiresAt": "2026-02-09T13:10:28.575Z", "returnedAt": "2026-02-06T13:16:28.939Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "91398931-e41f-462b-bf77-f5325d017acc"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "9a828788-8d74-4746-aacb-b9a0ebe17cce"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "379a8aed-aea3-4e5a-85da-504149f09d68"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-06T13:11:52.326Z", "vehicleId": "02ea78e9-57d6-436b-ad6b-154d06e6ea6c", "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6"}, "autoForward": {"results": {"hpg": {"success": true, "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b"}, "insurance": {"success": true, "clearanceRequestId": "d1f7229f-a7e5-4262-a816-9d6b4f35fc57"}}, "version": "2026-01", "startedAt": "2026-02-06T13:11:52.932Z", "finishedAt": "2026-02-06T13:11:53.414Z", "triggeredBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "autoTriggered": true}, "hpgApproved": true, "returnedToLTO": true, "buyerAcceptedAt": "2026-02-06T13:11:52.311Z", "buyerAcceptedBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "buyerSubmittedAt": "2026-02-06T13:11:52.311Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b", "insuranceClearanceRequestId": "d1f7229f-a7e5-4262-a816-9d6b4f35fc57"}	2026-02-06 13:10:28.596434	2026-02-06 13:16:28.939346	d1f7229f-a7e5-4262-a816-9d6b4f35fc57	\N	APPROVED	PENDING	APPROVED	2026-02-06 13:11:53.407668	\N	2026-02-06 13:16:28.931582	\N	\N	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-09 13:10:28.575	\N
3f6b15b9-7521-4ffb-8f93-889ebcdb60ea	c8babe0e-e748-4942-9025-53c1600a476f	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	FORWARDED_TO_HPG	2026-02-06 16:23:16.420235	\N	2026-02-06 16:24:23.483042	\N	t	59496941-6874-473a-a9d1-84b16f1eeda5	{"expiresAt": "2026-02-09T16:23:16.408Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "023698c1-3747-47df-af38-bae074d03846"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "0e02102b-9ff6-43a3-a266-d8b3ffbf9d70"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "b0f0e49b-4c27-447d-8943-9cb0bfa8ecc3"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-06T16:24:23.482Z", "vehicleId": "c8babe0e-e748-4942-9025-53c1600a476f", "transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea"}, "autoForward": {"results": {"hpg": {"success": true, "clearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5"}, "insurance": {"success": true, "clearanceRequestId": "7093be2c-da08-4937-8dc2-9a334650ee1d"}}, "version": "2026-01", "startedAt": "2026-02-06T16:24:24.078Z", "finishedAt": "2026-02-06T16:24:25.100Z", "triggeredBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "autoTriggered": true}, "buyerAcceptedAt": "2026-02-06T16:24:23.467Z", "buyerAcceptedBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "buyerSubmittedAt": "2026-02-06T16:24:23.467Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5", "insuranceClearanceRequestId": "7093be2c-da08-4937-8dc2-9a334650ee1d"}	2026-02-06 16:23:16.420235	2026-02-06 16:24:25.100938	7093be2c-da08-4937-8dc2-9a334650ee1d	\N	APPROVED	PENDING	PENDING	2026-02-06 16:24:25.094721	\N	\N	\N	\N	\N	2026-02-09 16:23:16.408	\N
b9d4b298-be8a-44e8-bf87-990f55137061	aac4dc07-379b-4cdc-9250-6e80aaed676a	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	REJECTED	2026-02-06 16:21:27.851342	\N	2026-02-06 16:24:32.715003	Rejected by buyer	f	\N	{"expiresAt": "2026-02-09T16:21:27.841Z", "rejectedBy": "buyer", "buyerRejectedAt": "2026-02-06T16:24:32.714Z", "rejectedByUserId": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "autoForwardVersion": "2026-01", "autoForwardEligible": true}	2026-02-06 16:21:27.851342	2026-02-06 16:24:32.715003	\N	\N	PENDING	PENDING	PENDING	\N	\N	\N	\N	\N	\N	2026-02-09 16:21:27.841	\N
9c316439-0fed-40ac-affb-aaa7703a3843	ed358d5a-ac0d-4a12-b593-8251152c9457	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	UNDER_REVIEW	2026-02-07 08:25:20.082542	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:27:01.838974	\N	t	08c3c8cc-8319-4b65-8ab7-2480d732cb25	{"expiresAt": "2026-02-10T08:25:20.074Z", "returnedAt": "2026-02-07T08:27:01.838Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "f1ae7553-08be-4045-94f7-fc803305947e"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "a4c57d59-fd65-424c-83e1-2b5dc9486d8f"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "66aee559-1341-4cb4-9275-d1eb886fbb04"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-07T08:25:59.920Z", "vehicleId": "ed358d5a-ac0d-4a12-b593-8251152c9457", "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843"}, "autoForward": {"results": {"hpg": {"success": true, "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25"}, "insurance": {"success": true, "clearanceRequestId": "954bd8aa-318d-455f-916a-06830dde262e"}}, "version": "2026-01", "startedAt": "2026-02-07T08:26:00.535Z", "finishedAt": "2026-02-07T08:26:01.472Z", "triggeredBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "autoTriggered": true}, "hpgApproved": true, "returnedToLTO": true, "buyerAcceptedAt": "2026-02-07T08:25:59.904Z", "buyerAcceptedBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "buyerSubmittedAt": "2026-02-07T08:25:59.904Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25", "insuranceClearanceRequestId": "954bd8aa-318d-455f-916a-06830dde262e"}	2026-02-07 08:25:20.082542	2026-02-07 08:27:01.838974	954bd8aa-318d-455f-916a-06830dde262e	\N	APPROVED	PENDING	APPROVED	2026-02-07 08:26:01.465117	\N	2026-02-07 08:27:01.830238	\N	\N	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-10 08:25:20.074	\N
f4073003-69fb-4b39-aef1-a58f65bbd373	9227a1b3-9b77-4506-a2c5-068827b86f6d	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	FORWARDED_TO_HPG	2026-02-07 12:34:58.428817	\N	\N	\N	t	8861c975-2b6b-4ae0-af49-a679e7e5f617	{"expiresAt": "2026-02-10T12:34:58.410Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "8861c975-2b6b-4ae0-af49-a679e7e5f617", "insuranceClearanceRequestId": "9eccfa85-7b83-4278-8c58-75fb3466f39a"}	2026-02-07 12:34:58.428817	2026-02-07 12:43:18.557574	9eccfa85-7b83-4278-8c58-75fb3466f39a	\N	PENDING	PENDING	PENDING	\N	\N	\N	\N	\N	\N	2026-02-10 12:34:58.41	\N
763829ad-01c1-48c9-9ce6-c60c3ae7ea42	aac4dc07-379b-4cdc-9250-6e80aaed676a	5a672d9b-dabc-4778-b380-7587dadab040	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	{"email": "latagjoshuaivan@gmail.com", "phone": "+639154788771", "lastName": "Latag", "firstName": "Joshua Ivan"}	UNDER_REVIEW	2026-02-07 15:47:28.205341	\N	2026-02-07 15:52:00.041873	\N	f	\N	{"expiresAt": "2026-02-10T15:47:28.184Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "8e115d2f-620d-4fe8-a1de-06b8ab3b88a7"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "403a34a4-79bc-441d-8693-c48cd6d31e1b"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "f89cd402-11e3-4b75-8e20-4db84820c792"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-07T15:52:00.041Z", "vehicleId": "aac4dc07-379b-4cdc-9250-6e80aaed676a", "transferRequestId": "763829ad-01c1-48c9-9ce6-c60c3ae7ea42"}, "buyerAcceptedAt": "2026-02-07T15:52:00.022Z", "buyerAcceptedBy": "1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc", "buyerSubmittedAt": "2026-02-07T15:52:00.022Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true}	2026-02-07 15:47:28.205341	2026-02-07 15:52:00.041873	\N	\N	PENDING	PENDING	PENDING	\N	\N	\N	\N	\N	\N	2026-02-10 15:47:28.184	\N
36bd5846-8247-48fa-8271-6f7400bee66d	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	5a672d9b-dabc-4778-b380-7587dadab040	36b86e7e-7668-49dc-8dd6-6610ce092a73	{"email": "kimandrei012@gmail.com", "phone": "09672564545", "lastName": "Besmar", "firstName": "Kim Andrei"}	COMPLETED	2026-02-08 03:19:28.183258	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:40:00.66094	\N	t	4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d	{"notes": null, "expiresAt": "2026-02-11T03:19:28.172Z", "approvedAt": "2026-02-08T03:40:00.660Z", "returnedAt": "2026-02-08T03:36:45.131Z", "validation": {"checks": [{"type": "HPG_CLEARANCE", "notes": "Document present with hash", "status": "READY", "documentId": "6cd2d9f0-0386-49e7-8bc5-b90568d1f4b0"}, {"type": "MVIR", "notes": "Required document not provided", "status": "MISSING"}, {"type": "CTPL", "notes": "Document present with hash", "status": "READY", "documentId": "80adf8b6-9689-4fad-8cf7-babc55fcdf14"}, {"type": "BUYER_TIN", "notes": "Document present with hash", "status": "READY", "documentId": "1814ce67-ee43-41a7-8f7f-db919acd0f70"}], "status": "INCOMPLETE", "missing": ["MVIR"], "pending": [], "checkedAt": "2026-02-08T03:20:18.851Z", "vehicleId": "4651a545-fdfc-4506-8a8f-1cc3ce7b20f3", "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d"}, "hpgApproved": true, "returnedToLTO": true, "blockchainTxId": "38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d", "buyerAcceptedAt": "2026-02-08T03:20:18.829Z", "buyerAcceptedBy": "36b86e7e-7668-49dc-8dd6-6610ce092a73", "buyerSubmittedAt": "2026-02-08T03:20:18.829Z", "autoForwardVersion": "2026-01", "autoForwardEligible": true, "hpgClearanceRequestId": "4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d", "insuranceClearanceRequestId": "057c9da0-e1c7-4811-bc35-d81efec534d0"}	2026-02-08 03:19:28.183258	2026-02-08 03:40:00.66094	057c9da0-e1c7-4811-bc35-d81efec534d0	\N	APPROVED	PENDING	APPROVED	2026-02-08 03:34:14.788945	\N	2026-02-08 03:36:45.125372	\N	\N	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-11 03:19:28.172	\N
\.


--
-- TOC entry 3989 (class 0 OID 16767)
-- Dependencies: 240
-- Data for Name: transfer_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.transfer_verifications (id, transfer_request_id, document_id, verified_by, status, notes, checklist, flagged, verified_at) FROM stdin;
\.


--
-- TOC entry 3979 (class 0 OID 16686)
-- Dependencies: 229
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.users (id, email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified, two_factor_enabled, last_login, created_at, updated_at, employee_id, badge_number, department, branch_office, supervisor_id, hire_date, "position", signature_file_path, digital_signature_hash, address, is_trusted_partner, trusted_partner_type, personal_email) FROM stdin;
90ee862b-c410-4370-9cf9-fa1400d9bd4f	owner@example.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Vehicle	Owner	vehicle_owner	Individual	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:02:26.045623	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
d5a83d69-7fba-4f89-bac1-c88fdcee3266	ltoofficer@lto.gov.ph	$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	\N	2026-01-24 09:58:59.148298	2026-01-24 09:58:59.148298	LTO-OFF-001	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N	\N	f	\N	\N
f4fe76a5-d900-4d3d-8c6a-e9b83472b2cb	staff@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Staff	User	staff	LTO	\N	t	t	f	\N	2026-01-24 06:02:26.045623	2026-01-24 06:17:41.578232	LTO-STAFF-001	STAFF-001	Vehicle Registration	LTO Manila Central	\N	2024-01-01	Registration Clerk	\N	\N	\N	f	\N	\N
73b6d066-9cb7-4b85-94c0-a808d13b005d	emission@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Emission	Verifier	emission_verifier	Emission Testing Center	\N	t	t	f	2026-01-29 04:25:47.921	2026-01-24 06:02:26.045623	2026-01-29 04:25:47.921	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
5eff4107-d246-4f21-b8f4-9f9e7e5b64a9	hpgadmin@hpg.gov.ph	$2a$12$8K1p/a0dL3YvEZrj8nH3hO5vJ5K5K5K5K5K5K5K5K5K5K5K5K5K5K	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	\N	2026-01-24 06:13:28.265259	2026-01-24 09:24:41.599913	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
c7179b34-ff7f-4004-9495-2cf9f049c3d1	ltofficer@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Juan	Dela Cruz	lto_officer	Land Transportation Office	+63 917 123 4567	t	t	f	2026-01-24 10:42:22.140097	2026-01-24 06:13:28.262002	2026-01-24 10:42:22.140097	\N	OFF-001	Vehicle Registration	LTO Manila Central	\N	\N	Registration Officer	\N	\N	\N	f	\N	\N
276b0346-be41-4f47-b3fe-256dbfec0a74	reinzpoqi@gmail.com	$2a$12$bRXmV8Bw6.nxleMHNWdhleDklY5EgYw5SZoGkb5zBafHYeIOh9.UO	Reinz	Cejalvo	vehicle_owner	Individual	09638645674	t	t	f	2026-01-27 00:55:32.729613	2026-01-27 00:54:46.332642	2026-01-27 00:55:32.729613	\N	\N	\N	\N	\N	\N	\N	\N	\N	Brgy. Bongco, Pototan	f	\N	\N
4651da8f-85ea-4942-86b8-58fde85d1d09	freyniedulla@gmail.com	$2a$12$c2R8utYk/wdxv5asa3pGBe1pF1/kCgjfj8igrA34Bp8d.bvs04dFa	Freynie Rose	Dulla	vehicle_owner	Individual	+639501186724	t	t	f	2026-01-27 01:04:14.130234	2026-01-27 00:42:55.857385	2026-01-27 01:04:14.130234	\N	\N	\N	\N	\N	\N	\N	\N	\N	Brgy. Dongsol Pototan, Iloilo 5008	f	\N	\N
842bac3c-0b3e-4475-9ffc-8eeae7627819	2220503@ub.edu.ph	$2a$12$BvVor4oIV.8a4kx83GTLTeZkBNFgOEaVg7wcxMQP9cO.3dilEyL4O	Jasper	Dave	vehicle_owner	Individual	09482106236	t	t	f	2026-01-27 01:10:40.679153	2026-01-27 00:43:14.964339	2026-01-27 01:10:40.679153	\N	\N	\N	\N	\N	\N	\N	\N	\N	Lipa City	f	\N	\N
21d178c0-37c5-466e-b2eb-560e32981cbd	insurance@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Company	\N	t	t	f	2026-01-31 07:33:49.64609	2026-01-24 06:02:26.045623	2026-01-31 07:33:49.64609	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N
654bb34d-fec4-458c-94bc-2223d885a6d7	hpg@hpg.gov.ph	$2a$12$x58ZhXS8osrdmdZYTu108etBlEqQjpxLa7WwNqFESC809KnyN9Tx6	HPG	Administrator	admin	Highway Patrol Group	+63 2 2345 6789	t	t	f	2026-02-08 03:36:18.72835	2026-01-24 09:53:44.574528	2026-02-08 03:36:18.72835	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	hpg.lipaph@gmail.com
a57fd791-bef2-4881-baa9-bfbd1c8b799c	admin@lto.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Admin	User	admin	Land Transportation Office	\N	t	t	f	2026-02-08 03:37:06.137305	2026-01-24 06:02:26.045623	2026-02-08 03:37:06.137305	LTO-ADMIN-001	ADMIN-001	Administration	LTO Manila Central	\N	2024-01-01	LTO Administrator	\N	\N	\N	f	\N	lto.lipaph@gmail.com
1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	latagjoshuaivan@gmail.com	$2a$12$QmquG9pNfaOk8e8kD1i5iusw0NzHDRCjaf3YpY3Jk1YqjICBUufVq	Joshua Ivan	Latag	vehicle_owner	Individual	+639154788771	t	t	f	2026-02-08 03:12:24.109362	2026-01-24 08:23:47.841908	2026-02-08 03:12:24.109362	\N	\N	\N	\N	\N	\N	\N	\N	\N	Dagatan	f	\N	\N
09752f67-da7e-4a6c-97c9-174760bc0d9c	longganisaseller11@gmail.com	$2a$12$/9mBiAXD1plyBwjOYvI73ObrBHOQIxM3SRmqNGSTucD5hY.xW4lke	Andrei	Besmar	vehicle_owner	Individual	09672564545	t	t	f	2026-02-07 14:16:46.76264	2026-01-27 04:04:53.683016	2026-02-07 14:16:46.76264	\N	\N	\N	\N	\N	\N	\N	\N	\N	Lipa City	f	\N	\N
36b86e7e-7668-49dc-8dd6-6610ce092a73	kimandrei012@gmail.com	$2a$12$6/RiYmpgAnT0J5Jr8spPNe/cKKQjj8NcvCl4gOzS86ZJZ2oWZZHRu	Kim Andrei	Besmar	vehicle_owner	Individual	09672564545	t	t	f	2026-02-08 04:16:06.01414	2026-01-25 03:38:54.665833	2026-02-08 04:16:06.01414	\N	\N	\N	\N	\N	\N	\N	\N	\N	Lipa City	f	\N	\N
73477102-f36b-448a-89d4-9dc3e93466f8	insurance@insurance.gov.ph	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Insurance	Verifier	insurance_verifier	Insurance Verification Office	+63 2 3456 7890	t	t	f	2026-02-06 11:00:11.453831	2026-01-24 06:29:41.287341	2026-02-06 11:00:11.453831	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	insurance.lipaph@gmail.com
e71fccc9-57c4-42c5-9a59-324078118fda	certificategenerator@generator.com	$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG	Certificate	Generator	admin	Certificate Generation Service	\N	t	t	f	2026-02-08 03:14:21.679216	2026-01-29 14:08:42.108655	2026-02-08 03:14:21.679216	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	lto.lipaph@gmail.com
5a672d9b-dabc-4778-b380-7587dadab040	dullajasperdave@gmail.com	$2a$12$ReVqd9sepf/4BWPKk.S6QeNSGNKUJM3/zlzWfGnztLzebyBOPGlTy	Jasper	Dulla	vehicle_owner	Individual	09482106236	t	t	f	2026-02-08 03:18:47.230663	2026-01-25 08:11:36.069813	2026-02-08 03:18:47.230663	\N	\N	\N	\N	\N	\N	\N	\N	\N	San Lucas, Lipa City	f	\N	\N
\.


--
-- TOC entry 3980 (class 0 OID 16699)
-- Dependencies: 230
-- Data for Name: vehicle_history; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_history (id, vehicle_id, action, description, performed_by, performed_at, transaction_id, metadata) FROM stdin;
698acfe2-6dcb-4a12-9564-0bfbd30d7cf7	d7463eaa-e937-4e14-ac30-a0bb43dc5747	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:29.570733	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-06T10:17:29.569Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "VFYD3SRG9DYJDAHT2", "vehicleMake": "Toyota", "hasDocuments": true, "vehicleModel": "Corolla Altis", "documentCount": 5, "documentTypes": ["certificateOfStockReport", "pnpHpgClearance", "ownerValidId", "salesInvoice", "insuranceCertificate"], "vehiclePlateNumber": "LKF-9216"}
3a7f407c-fbe4-4b41-a7bd-94ef5e057a2e	d7463eaa-e937-4e14-ac30-a0bb43dc5747	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:30.269302	\N	{"clearanceRequestId": "ed9aad26-72fc-4d1a-9c62-9426343f89a8"}
e37ffd3c-f850-4c6d-8911-5bf4a2bea9cf	d7463eaa-e937-4e14-ac30-a0bb43dc5747	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:30.283176	\N	{"extractedData": {"vin": "VFYD3SRG9DYJDAHT2", "source": "vehicle_metadata", "plateNumber": "LKF-9216", "engineNumber": "3UR-FE730776", "ocrExtracted": false, "chassisNumber": "VFYD3SRG9DYJDAHT2"}, "clearanceRequestId": "ed9aad26-72fc-4d1a-9c62-9426343f89a8", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T10:17:30.275Z", "matchedRecords": [], "recommendation": "PROCEED"}}
9dcd29ae-91e5-48c0-80c3-5b5a0d7f87e1	d7463eaa-e937-4e14-ac30-a0bb43dc5747	INSURANCE_AUTO_VERIFIED_PENDING	Insurance auto-verified but flagged for manual review. Score: 100%, Reason: Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:30.428172	\N	{"documentId": "1bdb7fd8-4e3a-4bf2-9307-65c79f8b0422", "clearanceRequestId": "96775303-d7b4-41d6-b340-db7f48b76283", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-8C6FII"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-8C6FII"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "6466664de1bc35130f8af0135bd1215e...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}
9eb4d417-a6d6-49c6-b3aa-00e34349f31f	d7463eaa-e937-4e14-ac30-a0bb43dc5747	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: PENDING (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 10:17:30.437326	\N	{"hpgRequestId": "ed9aad26-72fc-4d1a-9c62-9426343f89a8", "insuranceRequestId": "96775303-d7b4-41d6-b340-db7f48b76283", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-8C6FII"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-8C6FII"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "6466664de1bc35130f8af0135bd1215e...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}}
7d0dec74-4e14-4b73-a14d-b9721205116c	d7463eaa-e937-4e14-ac30-a0bb43dc5747	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 85%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 10:18:18.120145	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "decf9222d33375c64e4ad8af405635d012fafa7a3b6e716d736287133541b7b2", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 85, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 15}, "confidenceScore": 85, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "hpg_clearance", "searchedFileHash": "32a58cd9f9c50bd3e9d577cee2d6abcb...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "clearanceRequestId": "ed9aad26-72fc-4d1a-9c62-9426343f89a8"}
ec16939f-97d7-4c1f-8227-cb6dd0089b67	d7463eaa-e937-4e14-ac30-a0bb43dc5747	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 10:18:34.015895	\N	{"engineNumber": "3UR-FE730776", "macroEtching": false, "chassisNumber": "VFYD3SRG9DYJDAHT2", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "ed9aad26-72fc-4d1a-9c62-9426343f89a8"}
a8530c34-8cb3-4345-b8f7-ec67dae0335e	5735abaf-cd58-46ca-a6a5-0a864050ac8d	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:58.546057	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-06T11:03:58.545Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "2UM566CX7SXPANBXH", "vehicleMake": "Honda", "hasDocuments": true, "vehicleModel": "Civic", "documentCount": 5, "documentTypes": ["certificateOfStockReport", "salesInvoice", "pnpHpgClearance", "insuranceCertificate", "ownerValidId"], "vehiclePlateNumber": "DAS-2869"}
f0e8e615-d45b-4636-be8b-804090dac8e2	5735abaf-cd58-46ca-a6a5-0a864050ac8d	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:59.221635	\N	{"clearanceRequestId": "f516e027-c014-4bb0-a3e0-55b6fea43cca"}
6c6fec9d-da5f-4b8a-a561-f4a14a88e3fa	5735abaf-cd58-46ca-a6a5-0a864050ac8d	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:59.233235	\N	{"extractedData": {"vin": "2UM566CX7SXPANBXH", "source": "vehicle_metadata", "plateNumber": "DAS-2869", "engineNumber": "4GR-BE888155", "ocrExtracted": false, "chassisNumber": "2UM566CX7SXPANBXH"}, "clearanceRequestId": "f516e027-c014-4bb0-a3e0-55b6fea43cca", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T11:03:59.227Z", "matchedRecords": [], "recommendation": "PROCEED"}}
8a09c27d-e9a7-4668-8638-5c2edc30f742	5735abaf-cd58-46ca-a6a5-0a864050ac8d	INSURANCE_AUTO_VERIFIED_PENDING	Insurance auto-verified but flagged for manual review. Score: 100%, Reason: Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:59.333469	\N	{"documentId": "25d01d75-54d8-41c6-a3a9-a52055a18f03", "clearanceRequestId": "8c69ba84-289b-4888-90c0-625ecddc802a", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-T9OZB3"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-T9OZB3"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "27c54a3623595accc135f092c3d2a9d0...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}
ece3db9a-9e6a-4807-a7d1-ac5a69ae634e	5735abaf-cd58-46ca-a6a5-0a864050ac8d	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: PENDING (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 11:03:59.341334	\N	{"hpgRequestId": "f516e027-c014-4bb0-a3e0-55b6fea43cca", "insuranceRequestId": "8c69ba84-289b-4888-90c0-625ecddc802a", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-T9OZB3"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-T9OZB3"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "27c54a3623595accc135f092c3d2a9d0...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}}
0802d3ea-7e2d-4685-a06e-0df33b563c72	5735abaf-cd58-46ca-a6a5-0a864050ac8d	STATUS_REJECTED	Application rejected: haha	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 11:47:49.490557	\N	{"notes": "Application rejected: haha", "newStatus": "REJECTED", "previousStatus": "SUBMITTED"}
81247304-1d12-41a2-b27a-ef9bd2c682b2	84a15919-868f-44f9-b9ed-141fdfb62529	REGISTERED	Vehicle registration submitted	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:11.381906	\N	{"ownerName": "Joshua Ivan Latag", "timestamp": "2026-02-06T11:57:11.381Z", "ownerEmail": "latagjoshuaivan@gmail.com", "vehicleVin": "9BL8DV2DCHUB2R2LT", "vehicleMake": "Hyundai", "hasDocuments": true, "vehicleModel": "Accent", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "insuranceCertificate", "certificateOfStockReport", "ownerValidId", "salesInvoice"], "vehiclePlateNumber": "XXT-6053"}
1b33c296-2336-4453-aa03-5724ce0a95f3	84a15919-868f-44f9-b9ed-141fdfb62529	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:12.046235	\N	{"clearanceRequestId": "8599b486-b156-4f4e-8813-b3569d4aed51"}
019f2f01-b4aa-451b-9605-788600ad1188	84a15919-868f-44f9-b9ed-141fdfb62529	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:12.055152	\N	{"extractedData": {"vin": "9BL8DV2DCHUB2R2LT", "source": "vehicle_metadata", "plateNumber": "XXT-6053", "engineNumber": "1GR-DE857112", "ocrExtracted": false, "chassisNumber": "9BL8DV2DCHUB2R2LT"}, "clearanceRequestId": "8599b486-b156-4f4e-8813-b3569d4aed51", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T11:57:12.050Z", "matchedRecords": [], "recommendation": "PROCEED"}}
f43b2c0b-cc3b-4fe8-99ce-93edfe025824	84a15919-868f-44f9-b9ed-141fdfb62529	INSURANCE_AUTO_VERIFIED_PENDING	Insurance auto-verified but flagged for manual review. Score: 100%, Reason: Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:12.147331	\N	{"documentId": "dd653a1b-fd25-4b8d-900c-38a55f9e833e", "clearanceRequestId": "f805b5d5-0e50-4ef7-8e2f-45ff7570e9f4", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-7XUVA0"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-7XUVA0"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "33f25859a931dc332fd7a5197499ab5d...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}
ead614a2-ac0d-4e7f-ad2e-3fa2316dd44c	c8babe0e-e748-4942-9025-53c1600a476f	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:24.105346	\N	{"autoTriggered": true, "documentsSent": 2, "transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "clearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5"}
75bdf7fd-d487-4198-a576-0e359a6b0e53	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:00.555263	\N	{"extractedData": null, "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T08:26:00.549Z", "matchedRecords": [], "recommendation": "PROCEED"}}
970bdc50-9ddc-4e55-86c6-c2bd5eeb372b	84a15919-868f-44f9-b9ed-141fdfb62529	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: PENDING (Auto)	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 11:57:12.152266	\N	{"hpgRequestId": "8599b486-b156-4f4e-8813-b3569d4aed51", "insuranceRequestId": "f805b5d5-0e50-4ef7-8e2f-45ff7570e9f4", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-7XUVA0"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-7XUVA0"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "33f25859a931dc332fd7a5197499ab5d...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}}}
27c83905-c731-4fca-aa49-96bc9d32ac6b	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:53.458346	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-06T13:05:53.456Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "MFXJMZV6W8DWZ8TGK", "vehicleMake": "Honda", "hasDocuments": true, "vehicleModel": "Civic", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "salesInvoice", "certificateOfStockReport", "insuranceCertificate", "ownerValidId"], "vehiclePlateNumber": "BXY-6090"}
860efa28-3b5e-4823-b518-f54871366b4c	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:54.159383	\N	{"clearanceRequestId": "396fa651-54b6-4bfe-bcec-aee68d7a65c9"}
7c2aaf0c-ca7c-45b5-ae80-fb2d6445bd92	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:54.170867	\N	{"extractedData": {"vin": "MFXJMZV6W8DWZ8TGK", "source": "vehicle_metadata", "plateNumber": "BXY-6090", "engineNumber": "3UR-BE565637", "ocrExtracted": false, "chassisNumber": "MFXJMZV6W8DWZ8TGK"}, "clearanceRequestId": "396fa651-54b6-4bfe-bcec-aee68d7a65c9", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T13:05:54.165Z", "matchedRecords": [], "recommendation": "PROCEED"}}
f6976711-f6cc-4431-bb4e-8373928e806a	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:55.060837	\N	{"documentId": "4b720289-a2ef-4598-aa2b-b2a13f8a16aa", "clearanceRequestId": "88438ed8-4194-47b9-8b89-078faf491385", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-LG58U4"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-LG58U4"}, "compositeHash": "4efd16f82e7a2188a1957c00bffec478c6cf4a6af48616a672f66761ebaf0ae8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "2f21b450c681a6cee7e1ee1dd7a6ca854275d141163c2e217a0b47067afff20c", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "37269faa-adc9-4cef-9872-e4d62c742e7d", "originalCompositeHash": "b5fa0658a59d7bc650e76e1ad1b1373c1eb0dcf0c4176d51e9812e2687d8310b", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-LG58U4"}}}
08c491f2-4e4c-458f-adaa-1a6c79a64f9d	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:05:55.067627	\N	{"hpgRequestId": "396fa651-54b6-4bfe-bcec-aee68d7a65c9", "insuranceRequestId": "88438ed8-4194-47b9-8b89-078faf491385", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-LG58U4"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-LG58U4"}, "compositeHash": "4efd16f82e7a2188a1957c00bffec478c6cf4a6af48616a672f66761ebaf0ae8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "2f21b450c681a6cee7e1ee1dd7a6ca854275d141163c2e217a0b47067afff20c", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "37269faa-adc9-4cef-9872-e4d62c742e7d", "originalCompositeHash": "b5fa0658a59d7bc650e76e1ad1b1373c1eb0dcf0c4176d51e9812e2687d8310b", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-LG58U4"}}}}
1a0add58-afaf-48b5-9134-748f13eebd68	47916952-a48c-486a-8421-014905e38968	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 17:22:57.019894	\N	{"engineNumber": "5VZ-CE605906", "macroEtching": false, "chassisNumber": "LMJH22V3X6MPEM2VU", "blockchainTxId": null, "blockchainError": "Verification update failed: No valid responses from any peers. Errors:\\n    peer=peer0.lto.gov.ph, status=500, message=Failed to update verification status: Unauthorized: Only HPGMSP can set hpg verification. Current MSP: LTOMSP\\n    peer=peer0.insurance.gov.ph, status=500, message=Failed to update verification status: Unauthorized: Only HPGMSP can set hpg verification. Current MSP: LTOMSP", "clearanceRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7"}
96cbccbe-e624-45e2-a5db-ad0e5c618fd2	ed358d5a-ac0d-4a12-b593-8251152c9457	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.148413	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-07T08:18:44.147Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "7MTTNKS3BFKW7384D", "vehicleMake": "Honda", "hasDocuments": true, "vehicleModel": "Click 125", "documentCount": 5, "documentTypes": ["insuranceCertificate", "pnpHpgClearance", "certificateOfStockReport", "salesInvoice", "ownerValidId"], "vehiclePlateNumber": "TZK-5341"}
079bdade-85a6-4a3c-90a6-3e76dce6a532	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 100%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:07:23.472978	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "42f913183652888db7731da9ce536f30afb16aa3f4318ac0c81b0a2bd60aab0d", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 100, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "90793bb591bcac568fb8fb95c1dad4cd7149fb802428e75e17a65cab58a18b01", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "01b5e5fb-ec20-409c-a21d-9d28ab8cedf1", "originalCompositeHash": "2d02d2ab5a8ec393ae731946176df0e5298de867c433ac36413befe7d6e39981", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-902GBI"}, "clearanceRequestId": "396fa651-54b6-4bfe-bcec-aee68d7a65c9"}
83dcb52f-d2fd-49a9-864d-eb201c15cfec	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:07:31.328218	\N	{"engineNumber": "3UR-BE565637", "macroEtching": false, "chassisNumber": "MFXJMZV6W8DWZ8TGK", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "396fa651-54b6-4bfe-bcec-aee68d7a65c9"}
b48bb28d-4ec8-4a12-832d-902d5b9f9428	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 13:07:56.34193	ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079	{"source": "lto_final_approval", "crNumber": "CR-2026-000001", "orNumber": "OR-2026-000001", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-06T13:07:56.341Z", "fabricNetwork": "ltochannel"}
0185ca1e-3046-4222-bb99-03259ceb394a	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000001, CR: CR-2026-000001. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 13:07:56.964287	ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079	{"notes": "Application approved by admin", "crNumber": "CR-2026-000001", "orNumber": "OR-2026-000001", "crIssuedAt": "2026-02-06T13:07:56.310Z", "orCrNumber": "OR-2026-000001", "orIssuedAt": "2026-02-06T13:07:56.310Z", "orCrIssuedAt": "2026-02-06T13:07:56.310Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "ffd4893a67170841e73c609f42e54c0ad16ac33c91b1b1d5fde0711bb05b9079"}
f4617119-e6f6-4c57-8eac-4f855e2918e0	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 13:10:28.618104	\N	{"transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6"}
59185621-2668-4d9c-af6d-cef05a290dc1	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:52.946941	\N	{"extractedData": null, "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T13:11:52.941Z", "matchedRecords": [], "recommendation": "PROCEED"}}
f481004d-01e7-4dd6-9c37-808a58c0eb9c	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:52.956406	\N	{"autoTriggered": true, "documentsSent": 2, "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b"}
824fdd8e-50f0-47b6-95d2-ffd9364dc9ec	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_HPG_AUTO_VERIFIED_PENDING	Transfer HPG auto-verified but flagged for manual review. Score: 93%, Reason: undefined	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:53.065385	\N	{"transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b", "autoVerificationResult": {"score": 93, "status": "PENDING", "ocrData": {"year": "2022", "color": "White", "model": "Honda Civic", "series": "Honda Civic", "yearModel": "2022", "plateNumber": "BXY-6090"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 0.93, "compositeHash": "7ea2b7446ee4d0a5daa712532bf7dd728694c30336e7804e44229076f3fb2976", "preFilledData": {"engineNumber": "3UR-BE565637", "chassisNumber": "MFXJMZV6W8DWZ8TGK"}, "dataComparison": {"engineMatchVehicle": true, "chassisMatchVehicle": true, "engineMatchOriginal": false, "chassisMatchOriginal": false, "originalCertificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "bb20b338-548e-45f6-b4f3-f0826db71256", "originalCompositeHash": "4e55e7a8b256bb958cf652c1c84ee62c5b7f14670f55d42a8706fd2e25799747", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-MTR0GI"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}}
c1aba9aa-3716-40ca-b56a-c1efc44ba6b5	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:53.080999	\N	{"autoTriggered": true, "documentsSent": 1, "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "clearanceRequestId": "d1f7229f-a7e5-4262-a816-9d6b4f35fc57"}
a97c246d-b373-45db-9c8c-c6e0a4e018c4	47916952-a48c-486a-8421-014905e38968	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: 69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 17:23:12.503276	69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f	{"source": "lto_final_approval", "crNumber": "CR-2026-000004", "orNumber": "OR-2026-000004", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-06T17:23:12.503Z", "fabricNetwork": "ltochannel"}
97962623-1f02-4780-86b8-fa2cfa0a2eee	47916952-a48c-486a-8421-014905e38968	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000004, CR: CR-2026-000004. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 17:23:13.120864	69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f	{"notes": "Application approved by admin", "crNumber": "CR-2026-000004", "orNumber": "OR-2026-000004", "crIssuedAt": "2026-02-06T17:23:12.477Z", "orCrNumber": "OR-2026-000004", "orIssuedAt": "2026-02-06T17:23:12.477Z", "orCrIssuedAt": "2026-02-06T17:23:12.477Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "69b34ad3f3655bf30ccf4786f4b88155d52326047876ed81ac985815e395298f"}
b23d6abf-d82c-4465-8e06-c2ccfa2a2964	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.784441	\N	{"clearanceRequestId": "a72838df-accd-46ba-8c74-536ffaaa6550"}
0a39b323-6c9b-4131-8971-61e734940734	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	Transfer Insurance auto-verified and approved. Score: 100%	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 13:11:53.409297	\N	{"transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "clearanceRequestId": "d1f7229f-a7e5-4262-a816-9d6b4f35fc57", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-QKLLA4"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-QKLLA4"}, "compositeHash": "d11b7e7b66ef15c93c7c8e0c96001afeb441d05478cb9d333511b6d33c86b7d2", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "acf7bbbd3c522476bb523b52a9dc0820c109dc45fcdc2206cd563ec0384da1ef", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "20c8ff96-0583-4075-8424-5be7f914598d", "originalCompositeHash": "dabaf5cda836288b26feffd4570e70a750c251a31dbf9189603652150260648c", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-QKLLA4"}}}
fda29d6f-9484-4956-9e06-03a46b5c8684	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:13:36.080501	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "7ea2b7446ee4d0a5daa712532bf7dd728694c30336e7804e44229076f3fb2976", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "bb20b338-548e-45f6-b4f3-f0826db71256", "originalCompositeHash": "4e55e7a8b256bb958cf652c1c84ee62c5b7f14670f55d42a8706fd2e25799747", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-MTR0GI"}, "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b"}
e4c0d07e-5416-4b72-80b2-7c4de4e74c4d	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	TRANSFER_HPG_APPROVED	HPG approved transfer request 035d6f28-5ed7-4261-8d1a-f6d1174fa4f6 via clearance request b29a9117-a0f1-4722-90d7-c66df0f7350b	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:16:28.945531	\N	{"notes": null, "transferRequestId": "035d6f28-5ed7-4261-8d1a-f6d1174fa4f6", "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b"}
97f90cc4-8377-4a3b-82e2-48aeee2971f0	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:16:29.765095	\N	{"engineNumber": "3UR-BE565637", "macroEtching": false, "chassisNumber": "MFXJMZV6W8DWZ8TGK", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "b29a9117-a0f1-4722-90d7-c66df0f7350b"}
521aa512-050c-4623-8a6f-aca39940c573	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	LTO_INSPECTION_COMPLETED	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000001	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 13:17:09.818917	\N	{"mvirNumber": "MVIR-2026-000001", "inspectionResult": "PASS", "inspectionOfficer": "Admin User", "roadworthinessStatus": "ROADWORTHY"}
31cee583-7ea1-4d84-9c3a-f549d56b49fd	aac4dc07-379b-4cdc-9250-6e80aaed676a	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:23.542811	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-06T14:13:23.541Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "3FTF50PTKHZ8EA715", "vehicleMake": "Mitsubishi", "hasDocuments": true, "vehicleModel": "Mirage G4", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "salesInvoice", "ownerValidId", "insuranceCertificate", "certificateOfStockReport"], "vehiclePlateNumber": "CCW-6129"}
a955cf39-1c5e-44e4-99cb-4e97cb44290b	aac4dc07-379b-4cdc-9250-6e80aaed676a	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:24.30021	\N	{"clearanceRequestId": "2d98d0f6-89d3-4889-aa5c-ddbd613d40bb"}
5c1ade0e-4315-4c4a-beb1-356aaccb6543	aac4dc07-379b-4cdc-9250-6e80aaed676a	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:24.310419	\N	{"extractedData": {"vin": "3FTF50PTKHZ8EA715", "source": "vehicle_metadata", "plateNumber": "CCW-6129", "engineNumber": "4GR-CE483859", "ocrExtracted": false, "chassisNumber": "3FTF50PTKHZ8EA715"}, "clearanceRequestId": "2d98d0f6-89d3-4889-aa5c-ddbd613d40bb", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T14:13:24.305Z", "matchedRecords": [], "recommendation": "PROCEED"}}
e3f7d583-7705-4d53-9402-7254aef55057	aac4dc07-379b-4cdc-9250-6e80aaed676a	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:24.687839	\N	{"documentId": "56ddfb75-fb58-48b5-96cc-08e81673315e", "clearanceRequestId": "9e42647b-a8e8-4265-962f-a2f434a9a9b7", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-CE1WZR"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-CE1WZR"}, "compositeHash": "0b596022d7355807ee2e46e7607263a8166698fab1222fe2892fda89264f69da", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "eebdc6499cc233c18340a57c518c63d0685ae3e67886f85cd5e7a613e6443ab4", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "1d67820e-b6d8-4929-a59f-6fa9f6fe4e52", "originalCompositeHash": "cc54ca17aefd03100b413c9962397293595bdc0a67e63d2262f30b41c9c1c2f4", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-CE1WZR"}}}
d6174eba-bdde-4491-b503-ac3aa2a504f9	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:00.559204	\N	{"autoTriggered": true, "documentsSent": 2, "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25"}
2bb3a7ec-f29b-446d-8690-e1fb75c855fb	aac4dc07-379b-4cdc-9250-6e80aaed676a	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 14:13:24.694965	\N	{"hpgRequestId": "2d98d0f6-89d3-4889-aa5c-ddbd613d40bb", "insuranceRequestId": "9e42647b-a8e8-4265-962f-a2f434a9a9b7", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-CE1WZR"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-CE1WZR"}, "compositeHash": "0b596022d7355807ee2e46e7607263a8166698fab1222fe2892fda89264f69da", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "eebdc6499cc233c18340a57c518c63d0685ae3e67886f85cd5e7a613e6443ab4", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "1d67820e-b6d8-4929-a59f-6fa9f6fe4e52", "originalCompositeHash": "cc54ca17aefd03100b413c9962397293595bdc0a67e63d2262f30b41c9c1c2f4", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-CE1WZR"}}}}
30a89adb-feba-4c4f-90a7-ff124d46c827	aac4dc07-379b-4cdc-9250-6e80aaed676a	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 14:14:42.205245	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "93e41060d18aed542e1b614c5d309a498054684a951554804ec1bb016316deca", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "4GR-CE483859", "vehiclePlate": "CCW-6129", "chassisNumber": "WLVFCY822FNW0L0E", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "db410c26d4c68aaf54a3b978f9ac73cc978afc458f3d483f4f486eca2d82e790", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "6e4d03ca-fca9-4376-b353-499798542a5c", "originalCompositeHash": "08dedbaaf2ac282330097f97ab210fe3750cefc8154cd8be27da6dbc308569cc", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IC1WZW"}, "clearanceRequestId": "2d98d0f6-89d3-4889-aa5c-ddbd613d40bb"}
5292cc7f-1a9e-4b66-9f33-eca7b4606ad1	aac4dc07-379b-4cdc-9250-6e80aaed676a	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 14:15:24.281262	\N	{"engineNumber": "4GR-CE483859", "macroEtching": false, "chassisNumber": "3FTF50PTKHZ8EA715", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "2d98d0f6-89d3-4889-aa5c-ddbd613d40bb"}
990cfdc1-0b09-4f69-9e60-59dafbdf716b	aac4dc07-379b-4cdc-9250-6e80aaed676a	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 14:15:41.07076	a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072	{"source": "lto_final_approval", "crNumber": "CR-2026-000002", "orNumber": "OR-2026-000002", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-06T14:15:41.070Z", "fabricNetwork": "ltochannel"}
25299115-1238-4216-8727-5152a3cd245b	aac4dc07-379b-4cdc-9250-6e80aaed676a	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000002, CR: CR-2026-000002. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 14:15:41.670007	a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072	{"notes": "Application approved by admin", "crNumber": "CR-2026-000002", "orNumber": "OR-2026-000002", "crIssuedAt": "2026-02-06T14:15:41.035Z", "orCrNumber": "OR-2026-000002", "orIssuedAt": "2026-02-06T14:15:41.035Z", "orCrIssuedAt": "2026-02-06T14:15:41.035Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "a623f88d9603c9b2834182dac0ac3e457e8633dd5269cf5b8e6b591811d10072"}
b5e20be5-5639-4189-9bc0-e13fb65cc614	c8babe0e-e748-4942-9025-53c1600a476f	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:51.707763	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-06T16:15:51.706Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "9S2T7H6CLA91ZMYU5", "vehicleMake": "Toyota", "hasDocuments": true, "vehicleModel": "Hilux", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "certificateOfStockReport", "salesInvoice", "ownerValidId", "insuranceCertificate"], "vehiclePlateNumber": "EPP-8740"}
ff866d71-e2a2-47bb-9e67-07acb102adc1	c8babe0e-e748-4942-9025-53c1600a476f	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:52.383915	\N	{"clearanceRequestId": "c7eb6483-24c3-48aa-99e3-e0ab741597c6"}
728c403b-7f5d-49b9-b081-0c9c0237522e	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:52.395912	\N	{"extractedData": {"vin": "9S2T7H6CLA91ZMYU5", "source": "vehicle_metadata", "plateNumber": "EPP-8740", "engineNumber": "5VZ-FE275580", "ocrExtracted": false, "chassisNumber": "9S2T7H6CLA91ZMYU5"}, "clearanceRequestId": "c7eb6483-24c3-48aa-99e3-e0ab741597c6", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T16:15:52.390Z", "matchedRecords": [], "recommendation": "PROCEED"}}
8b8757a8-de6b-43ac-aef5-2a7656df6486	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:44.793709	\N	{"extractedData": {"vin": "7MTTNKS3BFKW7384D", "source": "vehicle_metadata", "plateNumber": "TZK-5341", "engineNumber": "3UR-FE462946", "ocrExtracted": false, "chassisNumber": "7MTTNKS3BFKW7384D"}, "clearanceRequestId": "a72838df-accd-46ba-8c74-536ffaaa6550", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T08:18:44.789Z", "matchedRecords": [], "recommendation": "PROCEED"}}
6ed56cad-2b35-443f-b381-b359f73ea3b6	c8babe0e-e748-4942-9025-53c1600a476f	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:53.13716	\N	{"documentId": "12d29645-ed1a-4430-9479-929eee59b043", "clearanceRequestId": "7a411501-4663-41c3-9328-da6cb9ffe2d3", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-OGQYZB"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-OGQYZB"}, "compositeHash": "81dae3a78cfc37c48eb75717cb210eb680875b8ae2d56e04f8dde35146e48931", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "bef0eee618c3d2112baaea78b231c3642323475085450654589d1aaa7682d403", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "e3908a11-7aa7-41f8-b718-59f2f0cd1651", "originalCompositeHash": "097e2b5e5b5de0bc5afcdd567d9dc939b8c12211d65c03f9bc0c14c2ae2e3c22", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-OGQYZB"}}}
39b4ca3c-a373-44f2-824a-d98962255d5f	c8babe0e-e748-4942-9025-53c1600a476f	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:15:53.232518	\N	{"hpgRequestId": "c7eb6483-24c3-48aa-99e3-e0ab741597c6", "insuranceRequestId": "7a411501-4663-41c3-9328-da6cb9ffe2d3", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-OGQYZB"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-OGQYZB"}, "compositeHash": "81dae3a78cfc37c48eb75717cb210eb680875b8ae2d56e04f8dde35146e48931", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "bef0eee618c3d2112baaea78b231c3642323475085450654589d1aaa7682d403", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "e3908a11-7aa7-41f8-b718-59f2f0cd1651", "originalCompositeHash": "097e2b5e5b5de0bc5afcdd567d9dc939b8c12211d65c03f9bc0c14c2ae2e3c22", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-OGQYZB"}}}}
2fa1afc1-dc4d-4852-8442-004eee61caaf	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 16:17:59.309353	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "6f489daf749ccf12d2c6079a342e98b87ddfae05bc5c3e8c68ce46074f124f46", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "5VZ-FE275580", "vehiclePlate": "EPP-8740", "chassisNumber": "SHWA7GZSPP2G9YFK", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "006c2e21a11ca0fbabe881d8c0a1308b9cc0fd12b682b4cf678c01f7b2d58705", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a9d62036-57cb-41b6-94bc-45290967c6e7", "originalCompositeHash": "f649cf3c349fd3602e13a62bfbe49b824cd5a85d12009b52b88762d5bd954aa9", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-WML72K"}, "clearanceRequestId": "c7eb6483-24c3-48aa-99e3-e0ab741597c6"}
b472c660-8d36-475f-871d-76a7d07fbe9f	c8babe0e-e748-4942-9025-53c1600a476f	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 16:18:36.046214	\N	{"engineNumber": "5VZ-FE275580", "macroEtching": false, "chassisNumber": "9S2T7H6CLA91ZMYU5", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "c7eb6483-24c3-48aa-99e3-e0ab741597c6"}
23fae44e-5428-4345-af1e-3478cacca981	c8babe0e-e748-4942-9025-53c1600a476f	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: 0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 16:19:44.185	0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18	{"source": "lto_final_approval", "crNumber": "CR-2026-000003", "orNumber": "OR-2026-000003", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-06T16:19:44.184Z", "fabricNetwork": "ltochannel"}
059fb5d5-568c-4b50-b41e-8ee3c4aaa45d	c8babe0e-e748-4942-9025-53c1600a476f	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000003, CR: CR-2026-000003. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-06 16:19:44.786269	0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18	{"notes": "Application approved by admin", "crNumber": "CR-2026-000003", "orNumber": "OR-2026-000003", "crIssuedAt": "2026-02-06T16:19:44.143Z", "orCrNumber": "OR-2026-000003", "orIssuedAt": "2026-02-06T16:19:44.143Z", "orCrIssuedAt": "2026-02-06T16:19:44.143Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "0a66f6c77ebae2aa6d7987aae7c15ffc48a994e912a8c083de146a4dd7609d18"}
c006500f-9b33-4d8b-93e5-739bdd2e8c9c	aac4dc07-379b-4cdc-9250-6e80aaed676a	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:21:27.869397	\N	{"transferRequestId": "b9d4b298-be8a-44e8-bf87-990f55137061"}
6fdfe923-13cc-40a1-8e67-621c1072e3f8	c8babe0e-e748-4942-9025-53c1600a476f	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 16:23:16.446002	\N	{"transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea"}
1b1964a0-3d86-4694-afd8-70f65165da52	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:24.096965	\N	{"extractedData": null, "transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "clearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T16:24:24.090Z", "matchedRecords": [], "recommendation": "PROCEED"}}
397030ff-030f-4413-80ab-7738271e0ad5	c8babe0e-e748-4942-9025-53c1600a476f	TRANSFER_HPG_AUTO_VERIFIED_PENDING	Transfer HPG auto-verified but flagged for manual review. Score: 93%, Reason: undefined	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:24.309006	\N	{"transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "clearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5", "autoVerificationResult": {"score": 93, "status": "PENDING", "ocrData": {"year": "2024", "color": "White", "model": "Toyota Hilux", "series": "Toyota Hilux", "yearModel": "2024", "plateNumber": "EPP-8740"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 0.93, "compositeHash": "0c02d75f47bab18cfbd3a520f1bbf0f95c4d9626ddfdcb07ef214565e1364606", "preFilledData": {"engineNumber": "5VZ-FE275580", "chassisNumber": "9S2T7H6CLA91ZMYU5"}, "dataComparison": {"engineMatchVehicle": true, "chassisMatchVehicle": true, "engineMatchOriginal": false, "chassisMatchOriginal": false, "originalCertificateData": {"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a41dc51e-66ad-42b7-a075-07f688f91ff9", "originalCompositeHash": "491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-FBBRI9"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}}
c7c04388-05fe-4a96-a67e-a84091612d6a	c8babe0e-e748-4942-9025-53c1600a476f	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:24.332289	\N	{"autoTriggered": true, "documentsSent": 1, "transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "clearanceRequestId": "7093be2c-da08-4937-8dc2-9a334650ee1d"}
cb16cbad-2006-41a0-95b5-856ef0ede34e	c8babe0e-e748-4942-9025-53c1600a476f	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	Transfer Insurance auto-verified and approved. Score: 100%	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-06 16:24:25.096088	\N	{"transferRequestId": "3f6b15b9-7521-4ffb-8f93-889ebcdb60ea", "clearanceRequestId": "7093be2c-da08-4937-8dc2-9a334650ee1d", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-1FIN66"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-1FIN66"}, "compositeHash": "9fe70af7bd1b06830986c15eec1cc84977c79bce46ed6dbce424e6b368e66f6c", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "6ff47acba700fca813a94c9eb94fb8bc05b2a54fd83f5e89038b7a2c2e5ca2ca", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "36dcf63f-5e9c-4c04-88a6-1d168689d3c2", "originalCompositeHash": "4695c416f7dacbfac76ff0318f0adde024c625f3dd57e296463421150002fcbb", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-1FIN66"}}}
b207c831-8752-433b-804e-893561b5b9d4	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 16:24:51.322827	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "0c02d75f47bab18cfbd3a520f1bbf0f95c4d9626ddfdcb07ef214565e1364606", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a41dc51e-66ad-42b7-a075-07f688f91ff9", "originalCompositeHash": "491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-FBBRI9"}, "clearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5"}
e66b7599-9089-459a-b5a1-13c3699c1047	47916952-a48c-486a-8421-014905e38968	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:50.154024	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-06T17:17:50.153Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "LMJH22V3X6MPEM2VU", "vehicleMake": "Honda", "hasDocuments": true, "vehicleModel": "City", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "certificateOfStockReport", "salesInvoice", "ownerValidId", "insuranceCertificate"], "vehiclePlateNumber": "EUE-5843"}
ae8ff6d6-d1b1-4457-b166-8d06b8290262	47916952-a48c-486a-8421-014905e38968	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:51.289461	\N	{"clearanceRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7"}
35197e04-5742-4ad1-8626-8adfef1f1ed0	47916952-a48c-486a-8421-014905e38968	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:51.301972	\N	{"extractedData": {"vin": "LMJH22V3X6MPEM2VU", "source": "vehicle_metadata", "plateNumber": "EUE-5843", "engineNumber": "5VZ-CE605906", "ocrExtracted": false, "chassisNumber": "LMJH22V3X6MPEM2VU"}, "clearanceRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-06T17:17:51.296Z", "matchedRecords": [], "recommendation": "PROCEED"}}
1cb7db25-16d3-4398-aa57-03385b03e9f9	ed358d5a-ac0d-4a12-b593-8251152c9457	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000005, CR: CR-2026-000005. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 08:20:23.019134	800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43	{"notes": "Application approved by admin", "crNumber": "CR-2026-000005", "orNumber": "OR-2026-000005", "crIssuedAt": "2026-02-07T08:20:22.407Z", "orCrNumber": "OR-2026-000005", "orIssuedAt": "2026-02-07T08:20:22.407Z", "orCrIssuedAt": "2026-02-07T08:20:22.407Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43"}
4aafc98c-6c87-48c4-8e77-5a55891d2714	47916952-a48c-486a-8421-014905e38968	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:51.730693	\N	{"documentId": "af65b42a-981f-468f-b781-09215825ae73", "clearanceRequestId": "159ef0a6-d912-4bcb-ae3c-6bc6d19acd85", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-F8L8LU"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-F8L8LU"}, "compositeHash": "99e06767daf95a10f926166b01b953cbb639c705464fa73cc786796461256184", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "d5cb10c1d7d836bc8a2ea4edaef42125a70ae1a2e1be637dfd0a9de4a15c17ba", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "9477adfb-8636-44c1-91fc-bbd460564788", "originalCompositeHash": "2880f16f4aef9d8f9cda4a1b96a717e096b68fa99d6cbe7e183ab1c4937de385", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-F8L8LU"}}}
9809690e-290f-4243-a479-f8a8787f991e	47916952-a48c-486a-8421-014905e38968	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-06 17:17:51.737231	\N	{"hpgRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7", "insuranceRequestId": "159ef0a6-d912-4bcb-ae3c-6bc6d19acd85", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-F8L8LU"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-F8L8LU"}, "compositeHash": "99e06767daf95a10f926166b01b953cbb639c705464fa73cc786796461256184", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "d5cb10c1d7d836bc8a2ea4edaef42125a70ae1a2e1be637dfd0a9de4a15c17ba", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "9477adfb-8636-44c1-91fc-bbd460564788", "originalCompositeHash": "2880f16f4aef9d8f9cda4a1b96a717e096b68fa99d6cbe7e183ab1c4937de385", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-F8L8LU"}}}}
64cb8fef-a015-4ff7-b0b5-8ed8c7112581	47916952-a48c-486a-8421-014905e38968	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 17:19:11.368894	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "3e06b0d8b1b264a15f570ff6dc6b3f635dc1e28a8c2c3735f07f92f529a2a81c", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "5VZ-CE605906", "vehiclePlate": "EUE-5843", "chassisNumber": "PMASNRXCUS", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "8920a4a68797687fcf3a287a64d4867c278e571742277d1f70b454bb2b81609b", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "abb52dec-743c-4a1c-96d7-65e27f2c0746", "originalCompositeHash": "9947ef1c96172ef2a3674b2bc8c30a3ce6554aa1c8e48fa2a443b7a3ce06a5fa", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IQ7T5V"}, "clearanceRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7"}
b69555d6-2919-464e-9705-29ee6c405d42	47916952-a48c-486a-8421-014905e38968	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 17:19:19.948066	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "3e06b0d8b1b264a15f570ff6dc6b3f635dc1e28a8c2c3735f07f92f529a2a81c", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "5VZ-CE605906", "vehiclePlate": "EUE-5843", "chassisNumber": "PMASNRXCUS", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "8920a4a68797687fcf3a287a64d4867c278e571742277d1f70b454bb2b81609b", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "abb52dec-743c-4a1c-96d7-65e27f2c0746", "originalCompositeHash": "9947ef1c96172ef2a3674b2bc8c30a3ce6554aa1c8e48fa2a443b7a3ce06a5fa", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IQ7T5V"}, "clearanceRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7"}
b3731ee3-0d9e-40bc-8567-a96dffb740e2	47916952-a48c-486a-8421-014905e38968	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 17:19:42.520904	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "3e06b0d8b1b264a15f570ff6dc6b3f635dc1e28a8c2c3735f07f92f529a2a81c", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "5VZ-CE605906", "vehiclePlate": "EUE-5843", "chassisNumber": "PMASNRXCUS", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "8920a4a68797687fcf3a287a64d4867c278e571742277d1f70b454bb2b81609b", "authenticityScore": 100, "originalVehicleVin": "LMJH22V3X6MPEM2VU", "originalCertificateId": "abb52dec-743c-4a1c-96d7-65e27f2c0746", "originalCompositeHash": "9947ef1c96172ef2a3674b2bc8c30a3ce6554aa1c8e48fa2a443b7a3ce06a5fa", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IQ7T5V"}, "clearanceRequestId": "42c35d63-5f06-49e2-afbe-48fc1b7695d7"}
49f84546-a851-48a9-8a2f-53d66c9c242b	ed358d5a-ac0d-4a12-b593-8251152c9457	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:45.536684	\N	{"documentId": "fefd5349-74ae-4f3b-8c76-b44e7dab2903", "clearanceRequestId": "3d2b1814-66f5-4c7b-8d95-44892ce036c7", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-2JJ4CI"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-2JJ4CI"}, "compositeHash": "dceb461feec33799b146b3aa06e6a2e88046567677c81a358775f5cb360c34fb", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "f611bc18693b06edd3d87dc24233736095f75125165490b2360d45988c5932c1", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "5384cf02-c718-4ffd-8742-9b04f7d8f855", "originalCompositeHash": "228b0a481de9fb22972792274d4c5aff6ace18587b477351fbc4758e26e50d7b", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-2JJ4CI"}}}
a3e0e1bf-1572-4b7e-8c79-09d55ccd5770	ed358d5a-ac0d-4a12-b593-8251152c9457	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:18:45.54378	\N	{"hpgRequestId": "a72838df-accd-46ba-8c74-536ffaaa6550", "insuranceRequestId": "3d2b1814-66f5-4c7b-8d95-44892ce036c7", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-2JJ4CI"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-2JJ4CI"}, "compositeHash": "dceb461feec33799b146b3aa06e6a2e88046567677c81a358775f5cb360c34fb", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "f611bc18693b06edd3d87dc24233736095f75125165490b2360d45988c5932c1", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "5384cf02-c718-4ffd-8742-9b04f7d8f855", "originalCompositeHash": "228b0a481de9fb22972792274d4c5aff6ace18587b477351fbc4758e26e50d7b", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-2JJ4CI"}}}}
4ea929c8-a65d-47ea-a997-ac2b13788624	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:19:26.417401	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "69d37c0a155e2a9ce3bc32948c0b03366134b6d8ba728a5b5f80a8d0c6dc902e", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "3UR-FE462946", "vehiclePlate": "TZK-5341", "chassisNumber": "H8CVHKLX8C4", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "170b1cdae041da4baa522bb395d9e94b87522c8fae930377d507c06bc155ee3e", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "07c3f547-0ebf-4c19-b9d3-268c943dc280", "originalCompositeHash": "9162ec9abb484b78034e64b5ffc107e60024ea94e092362e69af970f568d50ae", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-NVJX05"}, "clearanceRequestId": "a72838df-accd-46ba-8c74-536ffaaa6550"}
fcef2b27-cd30-433d-98af-58f5910f7d53	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:19:32.147921	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "69d37c0a155e2a9ce3bc32948c0b03366134b6d8ba728a5b5f80a8d0c6dc902e", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "3UR-FE462946", "vehiclePlate": "TZK-5341", "chassisNumber": "H8CVHKLX8C4", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "170b1cdae041da4baa522bb395d9e94b87522c8fae930377d507c06bc155ee3e", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "07c3f547-0ebf-4c19-b9d3-268c943dc280", "originalCompositeHash": "9162ec9abb484b78034e64b5ffc107e60024ea94e092362e69af970f568d50ae", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-NVJX05"}, "clearanceRequestId": "a72838df-accd-46ba-8c74-536ffaaa6550"}
d8f234f3-e69c-4d81-abfd-129575c3777c	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:20:00.52073	\N	{"engineNumber": "3UR-FE462946", "macroEtching": false, "chassisNumber": "7MTTNKS3BFKW7384D", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "a72838df-accd-46ba-8c74-536ffaaa6550"}
60b0a36f-5b68-441f-82f5-f4fd2d7211c5	ed358d5a-ac0d-4a12-b593-8251152c9457	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: 800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 08:20:22.43729	800081ee6cdee0572126c670df23ef4242171c2d0b5306035e56fa54026efa43	{"source": "lto_final_approval", "crNumber": "CR-2026-000005", "orNumber": "OR-2026-000005", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-07T08:20:22.436Z", "fabricNetwork": "ltochannel"}
d2c696fa-218e-485a-b24d-ba98b794bdfd	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 08:25:20.104778	\N	{"transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843"}
394b77bb-ceef-4326-a170-c66523f9b80e	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_HPG_AUTO_VERIFIED_PENDING	Transfer HPG auto-verified but flagged for manual review. Score: 93%, Reason: undefined	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:00.832424	\N	{"transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25", "autoVerificationResult": {"score": 93, "status": "PENDING", "ocrData": {"year": "2023", "color": "White", "model": "Honda Click 125", "series": "Honda Click 125", "yearModel": "2023", "plateNumber": "TZK-5341"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 0.93, "compositeHash": "c058b12e9062a32c78fdbe5149326945420d13d818a6c95d573b0f859deca768", "preFilledData": {"engineNumber": "3UR-FE462946", "chassisNumber": "7MTTNKS3BFKW7384D"}, "dataComparison": {"engineMatchVehicle": true, "chassisMatchVehicle": true, "engineMatchOriginal": false, "chassisMatchOriginal": false, "originalCertificateData": {"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "3597ba63-34b2-4c00-b51d-d18102fb1c87", "originalCompositeHash": "adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-BS5LYT"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}}
09a5d1dc-edc9-4f6d-a4e5-65fc4eedfca4	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:00.846265	\N	{"autoTriggered": true, "documentsSent": 1, "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "clearanceRequestId": "954bd8aa-318d-455f-916a-06830dde262e"}
8f3b1176-3aa1-4c59-90d6-9617119e9889	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	Transfer Insurance auto-verified and approved. Score: 100%	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 08:26:01.467069	\N	{"transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "clearanceRequestId": "954bd8aa-318d-455f-916a-06830dde262e", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-6G8AT1"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-6G8AT1"}, "compositeHash": "6147530a7af771cb75a3fd2f661fe5d7ea24b2dcd652ae9414b749d003e46210", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "80ed2c25240fb6eeed2ff9002779cf2fac931a0f3f582aecea91876e4002ec76", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "903f3367-2bf7-43ff-aa1a-43cb057dcfec", "originalCompositeHash": "1a57c9076584b0d5ee51b065b3b5b905daaca10c427902a81ce1a09b0e70483c", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-6G8AT1"}}}
e1a68fb0-afe0-428e-838e-299074343487	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:26:28.485293	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "c058b12e9062a32c78fdbe5149326945420d13d818a6c95d573b0f859deca768", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "3597ba63-34b2-4c00-b51d-d18102fb1c87", "originalCompositeHash": "adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-BS5LYT"}, "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25"}
308c358a-0c3e-4fdd-835f-6988bfd2bc9d	ed358d5a-ac0d-4a12-b593-8251152c9457	TRANSFER_HPG_APPROVED	HPG approved transfer request 9c316439-0fed-40ac-affb-aaa7703a3843 via clearance request 08c3c8cc-8319-4b65-8ab7-2480d732cb25	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:27:01.844996	\N	{"notes": null, "transferRequestId": "9c316439-0fed-40ac-affb-aaa7703a3843", "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25"}
5f001861-7db7-42d3-bcb2-0233f5892a4e	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph. 	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 08:27:02.302046	\N	{"engineNumber": "3UR-FE462946", "macroEtching": false, "chassisNumber": "7MTTNKS3BFKW7384D", "blockchainTxId": null, "blockchainError": "Verification update failed: DiscoveryService: vehicle-registration error: failed constructing descriptor for chaincodes:<name:\\"vehicle-registration\\" > ", "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25"}
e32ea186-3ef4-43dc-92ed-ee59e7824232	ed358d5a-ac0d-4a12-b593-8251152c9457	LTO_INSPECTION_COMPLETED	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000002	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 08:28:13.912349	\N	{"mvirNumber": "MVIR-2026-000002", "inspectionResult": "PASS", "inspectionOfficer": "Admin User", "roadworthinessStatus": "ROADWORTHY"}
1a9424e1-7ea2-4b8a-a5ba-16d5d61d1cae	47916952-a48c-486a-8421-014905e38968	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:37:38.783406	\N	{"transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc"}
61793a8d-bdd2-4076-9abc-8ec21b88e4b2	c8babe0e-e748-4942-9025-53c1600a476f	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 11:38:12.072215	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "0c02d75f47bab18cfbd3a520f1bbf0f95c4d9626ddfdcb07ef214565e1364606", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a41dc51e-66ad-42b7-a075-07f688f91ff9", "originalCompositeHash": "491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-FBBRI9"}, "clearanceRequestId": "59496941-6874-473a-a9d1-84b16f1eeda5"}
92bd6e4f-064f-40ee-a738-079142f6885d	aac4dc07-379b-4cdc-9250-6e80aaed676a	BLOCKCHAIN_REGISTERED	Vehicle registered on blockchain (backfill script). TX: 467034ae8ad467d2caa9e0eed0507bbc4a9dcefacd753323bf2fc5d5b6f628c0	\N	2026-02-07 11:47:47.510553	467034ae8ad467d2caa9e0eed0507bbc4a9dcefacd753323bf2fc5d5b6f628c0	{"source": "backfill_script", "registered": true, "scriptHost": "f4f5c25629d2", "scriptUser": "unknown", "scriptTimestamp": "2026-02-07T11:47:47.509Z"}
cd3427cf-d727-40c5-a77f-8a90570ee90d	9227a1b3-9b77-4506-a2c5-068827b86f6d	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:42.352268	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-07T11:54:42.351Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "TE6ATEHZNKBY6N2EK", "vehicleMake": "Toyota", "hasDocuments": true, "vehicleModel": "Corolla Altis", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "certificateOfStockReport", "salesInvoice", "ownerValidId", "insuranceCertificate"], "vehiclePlateNumber": "CBY-9590"}
36609d04-51de-4eee-a811-816cf70fb846	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:43.036719	\N	{"clearanceRequestId": "56f87e5c-777a-4b6d-ac0f-882f9bb138ad"}
d123d4d2-eb97-4766-83ca-8a9c93fbaef3	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:43.045703	\N	{"extractedData": {"vin": "TE6ATEHZNKBY6N2EK", "source": "vehicle_metadata", "plateNumber": "CBY-9590", "engineNumber": "1GR-BE500494", "ocrExtracted": false, "chassisNumber": "TE6ATEHZNKBY6N2EK"}, "clearanceRequestId": "56f87e5c-777a-4b6d-ac0f-882f9bb138ad", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T11:54:43.041Z", "matchedRecords": [], "recommendation": "PROCEED"}}
54a7bb61-42d7-4886-90ad-69d8fc3f56ef	9227a1b3-9b77-4506-a2c5-068827b86f6d	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:43.738803	\N	{"documentId": "4d40a661-42f9-4eb8-baf2-4a6f98696111", "clearanceRequestId": "eff2f865-53f8-4a38-a14a-376edf0e06c2", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-IOQ9U2"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-IOQ9U2"}, "compositeHash": "e3c36f396a8e4ff5a0a2f6b8c513fcde450a4009df2108bb3cfa10950daba7a8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "0a35b10e1e2b9c79f73a5a4c1bb8eaf95540105488578878d578112a7750ff35", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "4ca9844c-b5a1-464f-ad72-a60dfbedc5af", "originalCompositeHash": "7d580f2e796d76bb889c6076365c905d52476e30d0787eff65cccd415f8580b9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-IOQ9U2"}}}
e25172e5-4534-4728-bed8-5a1c8d4fd9e6	9227a1b3-9b77-4506-a2c5-068827b86f6d	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 11:54:43.745966	\N	{"hpgRequestId": "56f87e5c-777a-4b6d-ac0f-882f9bb138ad", "insuranceRequestId": "eff2f865-53f8-4a38-a14a-376edf0e06c2", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-IOQ9U2"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-IOQ9U2"}, "compositeHash": "e3c36f396a8e4ff5a0a2f6b8c513fcde450a4009df2108bb3cfa10950daba7a8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "0a35b10e1e2b9c79f73a5a4c1bb8eaf95540105488578878d578112a7750ff35", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "4ca9844c-b5a1-464f-ad72-a60dfbedc5af", "originalCompositeHash": "7d580f2e796d76bb889c6076365c905d52476e30d0787eff65cccd415f8580b9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-IOQ9U2"}}}}
25c6a230-bd0f-4dc1-9f57-1e6460a33880	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 11:58:17.364685	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "2adb86be0f3bdf2caee9e9163d7fe1f2c719908304a2e983733499a65acda536", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "1GR-BE500494", "vehiclePlate": "CBY-9590", "chassisNumber": "0YAF3MYMVL212", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "903bced1bd2870f0b38e725a8fb40a8e0fadb91212bb387914b6f7cda76dcd08", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "8ee1704a-6e13-4ddf-a8dd-7d7004bf2092", "originalCompositeHash": "e18e166c3c7cdf9a4cff914163d340e0a5dfb22553c65154fafa1f1d22c7db9a", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-DL6BGF"}, "clearanceRequestId": "56f87e5c-777a-4b6d-ac0f-882f9bb138ad"}
7a6b040d-be5a-485d-8660-209cecba6979	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: 2a4af0b2a15e21488b01776edb4d13088e70fb58029829d465f561bed85c5090	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 11:59:32.930513	2a4af0b2a15e21488b01776edb4d13088e70fb58029829d465f561bed85c5090	{"engineNumber": "1GR-BE500494", "macroEtching": false, "chassisNumber": "TE6ATEHZNKBY6N2EK", "blockchainTxId": "2a4af0b2a15e21488b01776edb4d13088e70fb58029829d465f561bed85c5090", "blockchainError": null, "clearanceRequestId": "56f87e5c-777a-4b6d-ac0f-882f9bb138ad"}
74f72cf0-8ccb-4271-bd01-4559b378f892	9227a1b3-9b77-4506-a2c5-068827b86f6d	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: 766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 11:59:42.645887	766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c	{"source": "lto_final_approval", "crNumber": "CR-2026-000006", "orNumber": "OR-2026-000006", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-07T11:59:42.645Z", "fabricNetwork": "ltochannel"}
cfba308f-6e6d-44b7-a8ad-c346e9a69d0b	9227a1b3-9b77-4506-a2c5-068827b86f6d	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000006, CR: CR-2026-000006. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 11:59:43.24115	766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c	{"notes": "Application approved by admin", "crNumber": "CR-2026-000006", "orNumber": "OR-2026-000006", "crIssuedAt": "2026-02-07T11:59:42.612Z", "orCrNumber": "OR-2026-000006", "orIssuedAt": "2026-02-07T11:59:42.612Z", "orCrIssuedAt": "2026-02-07T11:59:42.612Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c"}
5d4b7be8-a9dd-4089-b12f-ec16013460d5	9227a1b3-9b77-4506-a2c5-068827b86f6d	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 12:34:58.447515	\N	{"transferRequestId": "f4073003-69fb-4b39-aef1-a58f65bbd373"}
693b8a00-90f6-40d6-b0c2-00bea590822f	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 12:43:15.558902	\N	{"extractedData": null, "transferRequestId": "f4073003-69fb-4b39-aef1-a58f65bbd373", "clearanceRequestId": "8861c975-2b6b-4ae0-af49-a679e7e5f617", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T12:43:15.552Z", "matchedRecords": [], "recommendation": "PROCEED"}}
98596aad-12b7-4fbf-8c28-6423c2d16410	9227a1b3-9b77-4506-a2c5-068827b86f6d	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 12:43:15.568554	\N	{"autoTriggered": false, "documentsSent": 1, "transferRequestId": "f4073003-69fb-4b39-aef1-a58f65bbd373", "clearanceRequestId": "8861c975-2b6b-4ae0-af49-a679e7e5f617"}
dd0089d0-2ff4-40d7-825f-fd3ca643e6b3	9227a1b3-9b77-4506-a2c5-068827b86f6d	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 12:43:18.561427	\N	{"autoTriggered": false, "documentsSent": 0, "transferRequestId": "f4073003-69fb-4b39-aef1-a58f65bbd373", "clearanceRequestId": "9eccfa85-7b83-4278-8c58-75fb3466f39a"}
c98a3077-1239-49db-bc79-b9d2c6eea123	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 12:44:58.690126	\N	{"hashCheck": {}, "compositeHash": null, "recommendation": "MANUAL_REVIEW", "scoreBreakdown": {}, "confidenceScore": 0, "authenticityCheck": {}, "clearanceRequestId": "8861c975-2b6b-4ae0-af49-a679e7e5f617"}
029892e0-1942-4c2e-8861-ba673c0e06b5	ed358d5a-ac0d-4a12-b593-8251152c9457	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 93%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 12:47:09.117942	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "c058b12e9062a32c78fdbe5149326945420d13d818a6c95d573b0f859deca768", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "confidenceScore": 93, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "3597ba63-34b2-4c00-b51d-d18102fb1c87", "originalCompositeHash": "adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-BS5LYT"}, "clearanceRequestId": "08c3c8cc-8319-4b65-8ab7-2480d732cb25"}
229dd502-4af0-4033-b9fb-0123cc4ad5c2	9227a1b3-9b77-4506-a2c5-068827b86f6d	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 0%. Recommendation: MANUAL_REVIEW	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 12:47:14.530005	\N	{"hashCheck": {}, "compositeHash": null, "recommendation": "MANUAL_REVIEW", "scoreBreakdown": {}, "confidenceScore": 0, "authenticityCheck": {}, "clearanceRequestId": "8861c975-2b6b-4ae0-af49-a679e7e5f617"}
c27e67c3-a15b-41b7-b2ee-d38a60fa8dad	47916952-a48c-486a-8421-014905e38968	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:10.932283	\N	{"extractedData": null, "transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "clearanceRequestId": "68d7ea46-9c5f-49d5-b23d-724cb62b3e2b", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T13:02:10.926Z", "matchedRecords": [], "recommendation": "PROCEED"}}
ed489f67-9584-4bc1-8ffb-fc129042956c	47916952-a48c-486a-8421-014905e38968	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:10.94092	\N	{"autoTriggered": true, "documentsSent": 2, "transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "clearanceRequestId": "68d7ea46-9c5f-49d5-b23d-724cb62b3e2b"}
904bf616-ef90-45e1-b3a0-1fb27255c33d	47916952-a48c-486a-8421-014905e38968	TRANSFER_HPG_AUTO_VERIFIED_PENDING	Transfer HPG auto-verified but flagged for manual review. Score: 93%, Reason: undefined	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:11.234839	\N	{"transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "clearanceRequestId": "68d7ea46-9c5f-49d5-b23d-724cb62b3e2b", "autoVerificationResult": {"score": 93, "status": "PENDING", "ocrData": {"year": "2025", "color": "White", "model": "Toyota Corolla Altis", "series": "Toyota Corolla Altis", "yearModel": "2025", "plateNumber": "LKF-9216"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 0.93, "compositeHash": "11c1a65ff3626709e754e856f1ad696be1553b2dbdf86b7fbd57cd4130bdc143", "preFilledData": {"engineNumber": "5VZ-CE605906", "chassisNumber": "LMJH22V3X6MPEM2VU"}, "dataComparison": {"engineMatchVehicle": true, "chassisMatchVehicle": true, "engineMatchOriginal": false, "chassisMatchOriginal": false, "originalCertificateData": {"vehiclePlate": "LKF-9216", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}}, "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "LKF-9216", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "35a7816e73847c683d80ad1fa4af8402b769ca2038f708756548eaba43610174", "authenticityScore": 100, "originalVehicleVin": "VFYD3SRG9DYJDAHT2", "originalCertificateId": "30f93b30-1760-49cc-b084-e09abee42622", "originalCompositeHash": "2fdbcd15f27a0f7d8798fe1e3bde885f59fd89f0d9de345ec16d4d2234e8fba4", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-AB5BRF"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}}
ce712cc0-9910-4020-9bf9-ef28b1184855	47916952-a48c-486a-8421-014905e38968	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:11.250573	\N	{"autoTriggered": true, "documentsSent": 1, "transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "clearanceRequestId": "9156e97d-655f-45ef-8f6b-8a02f4359073"}
e85fa3ba-ae4b-4970-9fda-1b914cb7c798	47916952-a48c-486a-8421-014905e38968	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	Transfer Insurance auto-verified and approved. Score: 100%	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	2026-02-07 13:02:12.185499	\N	{"transferRequestId": "8a3dae85-09b0-4286-8ce3-03e37dcc79fc", "clearanceRequestId": "9156e97d-655f-45ef-8f6b-8a02f4359073", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-0QJG4I"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0QJG4I"}, "compositeHash": "7a66fddd3d60482e7570116e9a6ecf98f4098010461472baf91141b469e2593f", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "15144e3b34af282c1ef1e22d70e9cf15f122cc3a956b333546923732a51cc9a1", "authenticityScore": 100, "originalVehicleVin": "VFYD3SRG9DYJDAHT2", "originalCertificateId": "7c768865-3806-4358-8fe0-a681311255fc", "originalCompositeHash": "9999b777195c4e26e080d1fe4b90d50bd37c4149022ea9cef8fbfb7303faae42", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-0QJG4I"}}}
0cca4c22-9c10-44df-841e-10721c0a9778	d50832ba-fd65-497c-8e23-cfef1850df37	REGISTERED	Vehicle registration submitted	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:49.066349	\N	{"ownerName": "Kim Andrei Besmar", "timestamp": "2026-02-07T14:07:49.065Z", "ownerEmail": "kimandrei012@gmail.com", "vehicleVin": "5VH6EN0UC1WK3354M", "vehicleMake": "Honda", "hasDocuments": true, "vehicleModel": "City", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "insuranceCertificate", "salesInvoice", "certificateOfStockReport", "ownerValidId"], "vehiclePlateNumber": "KVH-8684"}
97e7f28d-69d2-4d80-b608-404692c61f56	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:49.849057	\N	{"clearanceRequestId": "f8ded7e8-6ac8-4073-a562-62c90add19e3"}
b56926c6-7e06-4df8-ae8c-84f4af22e32c	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:49.859901	\N	{"extractedData": {"vin": "5VH6EN0UC1WK3354M", "source": "vehicle_metadata", "plateNumber": "KVH-8684", "engineNumber": "4GR-BE103259", "ocrExtracted": false, "chassisNumber": "5VH6EN0UC1WK3354M"}, "clearanceRequestId": "f8ded7e8-6ac8-4073-a562-62c90add19e3", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T14:07:49.853Z", "matchedRecords": [], "recommendation": "PROCEED"}}
a17448ea-8b2a-44e5-bb93-d016dcf08e03	d50832ba-fd65-497c-8e23-cfef1850df37	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:50.612418	\N	{"documentId": "212d09b8-a7b3-484b-b732-26dda84f5456", "clearanceRequestId": "9b8cda80-0ca9-422b-b5d6-90528d5c53f3", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-VAI1IQ"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-VAI1IQ"}, "compositeHash": "c652cf1fab5b4db19ab5b9136a2dab8ef7bf79d863d429d3c8ee622f7e8ad2dd", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "b7f3a7bb4d6c16932122c20348cd5d9d36df56b865ca0fa203456d3d80738832", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "a5bd0815-70b7-4e4a-b031-c5711123f555", "originalCompositeHash": "6a3124c57561014388c8185dae03d9c63023a50d29007250f880d58158d397c9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-VAI1IQ"}}}
765b61af-153b-4368-899d-ee3c7b6e6adc	d50832ba-fd65-497c-8e23-cfef1850df37	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:07:50.619272	\N	{"hpgRequestId": "f8ded7e8-6ac8-4073-a562-62c90add19e3", "insuranceRequestId": "9b8cda80-0ca9-422b-b5d6-90528d5c53f3", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-VAI1IQ"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-VAI1IQ"}, "compositeHash": "c652cf1fab5b4db19ab5b9136a2dab8ef7bf79d863d429d3c8ee622f7e8ad2dd", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "b7f3a7bb4d6c16932122c20348cd5d9d36df56b865ca0fa203456d3d80738832", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "a5bd0815-70b7-4e4a-b031-c5711123f555", "originalCompositeHash": "6a3124c57561014388c8185dae03d9c63023a50d29007250f880d58158d397c9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-VAI1IQ"}}}}
5074aeca-8adb-4784-b0cc-567bcb590891	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:09:54.745579	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "dd3e177f8e26efeb0e29aa6bfb764f8971555d75b8b3974fe3c287630c7f81f3", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "4GR-BE103259", "vehiclePlate": "KVH-8684", "chassisNumber": "9GK8K467X7XSDP", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "84f146e8e33fa98f2c80d52feddc69514eb510082db08e946a197faa80184122", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "3024161a-839d-4af6-8a55-3a8aef97a440", "originalCompositeHash": "2b3de4b7556c7e9e75e474a2f81752ac76266bf609920101df98945ecac34b8d", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-4WRSAB"}, "clearanceRequestId": "f8ded7e8-6ac8-4073-a562-62c90add19e3"}
ed2e6abe-b9d0-48f8-afa7-fbb71ebe553f	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: 82edc114201801b8a249755b5a5cf2fd24d2d3ce2cdefda6ea66a99f0e94b9d7	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:11:21.18145	82edc114201801b8a249755b5a5cf2fd24d2d3ce2cdefda6ea66a99f0e94b9d7	{"engineNumber": "4GR-BE103259", "macroEtching": false, "chassisNumber": "5VH6EN0UC1WK3354M", "blockchainTxId": "82edc114201801b8a249755b5a5cf2fd24d2d3ce2cdefda6ea66a99f0e94b9d7", "blockchainError": null, "clearanceRequestId": "f8ded7e8-6ac8-4073-a562-62c90add19e3"}
4ad9683c-b24a-4386-bcf8-12f4821e071d	d50832ba-fd65-497c-8e23-cfef1850df37	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 14:13:02.711032	f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00	{"source": "lto_final_approval", "crNumber": "CR-2026-000007", "orNumber": "OR-2026-000007", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-07T14:13:02.710Z", "fabricNetwork": "ltochannel"}
fcc72d65-af8d-4461-bc47-0669c297dc49	d50832ba-fd65-497c-8e23-cfef1850df37	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000007, CR: CR-2026-000007. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 14:13:03.304506	f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00	{"notes": "Application approved by admin", "crNumber": "CR-2026-000007", "orNumber": "OR-2026-000007", "crIssuedAt": "2026-02-07T14:13:02.685Z", "orCrNumber": "OR-2026-000007", "orIssuedAt": "2026-02-07T14:13:02.685Z", "orCrIssuedAt": "2026-02-07T14:13:02.685Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00"}
b14cd5a4-b080-46ad-9d7d-b29dde5d96ed	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_REQUESTED	Transfer request submitted by kimandrei012@gmail.com	36b86e7e-7668-49dc-8dd6-6610ce092a73	2026-02-07 14:15:39.535583	\N	{"transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f"}
ec563bd9-01aa-4564-9c42-1300e10a03ff	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:25.631335	\N	{"extractedData": null, "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "clearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-07T14:18:25.625Z", "matchedRecords": [], "recommendation": "PROCEED"}}
ecdb210b-8751-4bb1-bd83-2c7d510b729f	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:25.640764	\N	{"autoTriggered": true, "documentsSent": 2, "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "clearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134"}
48ae8ebc-b4dc-4ec9-9f1b-65fc4a056b61	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:25.663678	\N	{"autoTriggered": true, "documentsSent": 1, "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "clearanceRequestId": "bbd6c04c-5c18-487b-aaf3-f7e9422d76cb"}
26c526b1-e62c-40cc-a7c9-6a925094bec4	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	Transfer Insurance auto-verified and approved. Score: 100%	09752f67-da7e-4a6c-97c9-174760bc0d9c	2026-02-07 14:18:26.384361	\N	{"transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "clearanceRequestId": "bbd6c04c-5c18-487b-aaf3-f7e9422d76cb", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-NWLH39"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-NWLH39"}, "compositeHash": "254c86539b846cbee78656bf1f49f5a3cf37d44f7ced425f22c9b19f83e68539", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "64576488a82bfe6f76f96f5245e7e13d38f47d9c0671d3cdbf64c066f072bf62", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "a1e8e055-fbfd-455c-b0d1-aa9df19fd35d", "originalCompositeHash": "b5406baca95767d9e4f3bb8856f783ac81a69fe8ce524dcf623a4827ce38b93a", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-NWLH39"}}}
24a527c4-e4d9-4ee8-90ce-fc7dcf42ab63	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 100%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:26:41.694214	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "063d76dccb2f26009490505726febeb83d55acd333b77d20b45a442896b3c29b", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 100, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "KVH-8684", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "57005039c7f7a3b2630056eff12c3a95b27983e6a146e66b88817430f7f3d174", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "d0a8e8ed-5f92-4ef7-82a9-4ebbf602c5d1", "originalCompositeHash": "9ca026147676004dd5101a306d321440d5dc7035ae4dd54bf9867f17c3ff7cd9", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-QZW2JN"}, "clearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134"}
c7c310e4-bb9d-4da6-865f-bee9ec77bb7b	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_HPG_APPROVED	HPG approved transfer request 5e09c9fb-0dd4-470a-8e02-77907e76988f via clearance request 5784599e-7b57-485a-8273-bca2b9dec134	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:27:49.024445	\N	{"notes": null, "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f", "clearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134"}
591ea0fd-64e0-43a2-b09c-97acd0bbca64	d50832ba-fd65-497c-8e23-cfef1850df37	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: b4ca1a093b5de42801088a4b8c25e56ba77a08fc44b974e2804aa964e516353d	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:27:49.46167	b4ca1a093b5de42801088a4b8c25e56ba77a08fc44b974e2804aa964e516353d	{"engineNumber": "4GR-BE103259", "macroEtching": false, "chassisNumber": "5VH6EN0UC1WK3354M", "blockchainTxId": "b4ca1a093b5de42801088a4b8c25e56ba77a08fc44b974e2804aa964e516353d", "blockchainError": null, "clearanceRequestId": "5784599e-7b57-485a-8273-bca2b9dec134"}
94d42b6d-ff58-46ca-8075-2fd661f3a9d0	d50832ba-fd65-497c-8e23-cfef1850df37	LTO_INSPECTION_COMPLETED	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000003	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-07 14:28:47.099858	\N	{"mvirNumber": "MVIR-2026-000003", "inspectionResult": "PASS", "inspectionOfficer": "Admin User", "roadworthinessStatus": "ROADWORTHY"}
8c47bcaf-f3f0-486b-bc05-8b4943909476	aac4dc07-379b-4cdc-9250-6e80aaed676a	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-07 15:47:28.226797	\N	{"transferRequestId": "763829ad-01c1-48c9-9ce6-c60c3ae7ea42"}
c1bdf310-6af5-4aa6-93e1-33e401d73dab	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	REGISTERED	Vehicle registration submitted	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:40.690837	\N	{"ownerName": "Jasper Dulla", "timestamp": "2026-02-08T02:46:40.689Z", "ownerEmail": "dullajasperdave@gmail.com", "vehicleVin": "XRU7EB0PUX47FRHYV", "vehicleMake": "Toyota", "hasDocuments": true, "vehicleModel": "Vios", "documentCount": 5, "documentTypes": ["pnpHpgClearance", "salesInvoice", "certificateOfStockReport", "insuranceCertificate", "ownerValidId"], "vehiclePlateNumber": "WUG-5803"}
d38a5ae3-2f01-4d9e-a8cf-9c6f02da23fb	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_CLEARANCE_REQUESTED	HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:41.385634	\N	{"clearanceRequestId": "1fa0933a-01b8-49be-8bec-79ce4dd00724"}
caa80406-d727-492d-981b-07361b9ce966	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed. Metadata used, Database: CLEAN	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:41.396166	\N	{"extractedData": {"vin": "XRU7EB0PUX47FRHYV", "source": "vehicle_metadata", "plateNumber": "WUG-5803", "engineNumber": "3UR-DE284537", "ocrExtracted": false, "chassisNumber": "XRU7EB0PUX47FRHYV"}, "clearanceRequestId": "1fa0933a-01b8-49be-8bec-79ce4dd00724", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-08T02:46:41.391Z", "matchedRecords": [], "recommendation": "PROCEED"}}
60b9edd3-5b1a-48dd-8183-3b82e5ef294a	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	INSURANCE_AUTO_VERIFIED_APPROVED	Insurance auto-verified and approved. Score: 100%	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:42.172948	\N	{"documentId": "94c203c1-ab31-41b9-8482-1a28011d4882", "clearanceRequestId": "a46b1ff8-8d8e-4047-bb49-d80c00fc7e5b", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "08-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-JXP007"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-JXP007"}, "compositeHash": "1f3288d06ad975e347179768c1be7c89e081305bce23617e2574284ea6e4ba68", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "71e8f9e776b09c876e16a8c04eef7e4fd76ae897fd038e539cf61029539ead0a", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "d757da6c-e64e-4764-a558-309738e66178", "originalCompositeHash": "3e8c30e5b1756b2348244d8641fd595528924dcba21f3e07b877ec539d4bf82e", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-JXP007"}}}
615d7c33-11bc-496a-a23a-7bfa4c7f8933	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	CLEARANCE_REQUESTS_AUTO_SENT	Clearance requests automatically sent to organizations. HPG: Yes, Insurance: Yes. Auto-verification: Insurance: APPROVED (Auto)	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 02:46:42.179959	\N	{"hpgRequestId": "1fa0933a-01b8-49be-8bec-79ce4dd00724", "insuranceRequestId": "a46b1ff8-8d8e-4047-bb49-d80c00fc7e5b", "autoVerificationResults": {"insurance": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "08-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-JXP007"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-JXP007"}, "compositeHash": "1f3288d06ad975e347179768c1be7c89e081305bce23617e2574284ea6e4ba68", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "71e8f9e776b09c876e16a8c04eef7e4fd76ae897fd038e539cf61029539ead0a", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "d757da6c-e64e-4764-a558-309738e66178", "originalCompositeHash": "3e8c30e5b1756b2348244d8641fd595528924dcba21f3e07b877ec539d4bf82e", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-JXP007"}}}}
537b018c-1f51-499b-8471-c986bca93a95	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 98%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 02:48:18.17665	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "71fdc87ec40b9c21c228ef58d43bc437ed4161471c49ae62fb37ff89a399d11c", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 98, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "3UR-DE284537", "vehiclePlate": "WUG-5803", "chassisNumber": "GC7ER4MPRYPX", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "9a177339216728330a366836dc80ce055f226ff2d9fb5f8b9a8911be709d822f", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "88f772ca-69cf-425e-aa44-f2f3f8bedc8e", "originalCompositeHash": "99f6a9a291e7cdffd2c38a7b1ddc02189b260f4c8ddf25051f68a9255a31dc5c", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-PAW8XM"}, "clearanceRequestId": "1fa0933a-01b8-49be-8bec-79ce4dd00724"}
c9b77e74-e5b0-4d42-87a1-8235a988f18e	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: b99c26045db968da71be875709aeb5060f9668da25dfc15a0b842aad1d8c45bd	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 02:48:32.445299	b99c26045db968da71be875709aeb5060f9668da25dfc15a0b842aad1d8c45bd	{"engineNumber": "3UR-DE284537", "macroEtching": false, "chassisNumber": "XRU7EB0PUX47FRHYV", "blockchainTxId": "b99c26045db968da71be875709aeb5060f9668da25dfc15a0b842aad1d8c45bd", "blockchainError": null, "clearanceRequestId": "1fa0933a-01b8-49be-8bec-79ce4dd00724"}
e720bab0-0d8f-4515-b429-7646c81fc817	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	BLOCKCHAIN_REGISTERED	Vehicle registered on Hyperledger Fabric. TX: 2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:09:06.999348	2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0	{"source": "lto_final_approval", "crNumber": "CR-2026-000009", "orNumber": "OR-2026-000009", "chaincode": "vehicle-registration", "mvirNumber": null, "registeredAt": "2026-02-08T03:09:06.998Z", "fabricNetwork": "ltochannel"}
9e6ecd7d-7140-49e1-be25-e7583c896923	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	CLEARANCE_APPROVED	Clearance approved by admin@lto.gov.ph. OR: OR-2026-000009, CR: CR-2026-000009. Application approved by admin	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:09:08.099826	2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0	{"notes": "Application approved by admin", "crNumber": "CR-2026-000009", "orNumber": "OR-2026-000009", "crIssuedAt": "2026-02-08T03:09:06.255Z", "orCrNumber": "OR-2026-000009", "orIssuedAt": "2026-02-08T03:09:06.255Z", "orCrIssuedAt": "2026-02-08T03:09:06.255Z", "verifications": [{"type": "insurance", "status": "APPROVED"}, {"type": "hpg", "status": "APPROVED"}], "blockchainTxId": "2829abb06c0551b89798cbe8190ca2a43424f04709e1268ba83049bde1dc90a0"}
f899fa48-fb5d-4e35-b09d-a5ae1b20ca6e	d50832ba-fd65-497c-8e23-cfef1850df37	TRANSFER_REQUEST_REJECTED	Transfer request rejected by admin@lto.gov.ph. Reason: No owner	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:13:13.740153	\N	{"rejectionReason": "No owner", "transferRequestId": "5e09c9fb-0dd4-470a-8e02-77907e76988f"}
df6cca9f-988b-4b29-a2eb-f88af40454b3	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_REQUESTED	Transfer request submitted by dullajasperdave@gmail.com	5a672d9b-dabc-4778-b380-7587dadab040	2026-02-08 03:19:28.200989	\N	{"transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d"}
d38a10af-378f-43a4-9def-08be294f76e4	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTOMATION_PHASE1	HPG Phase 1 automation completed for transfer. OCR: No, Database: CLEAN	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:34:10.441832	\N	{"extractedData": null, "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "clearanceRequestId": "4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d", "databaseCheckResult": {"status": "CLEAN", "details": "Vehicle not found in HPG hot list", "checkedAt": "2026-02-08T03:34:10.433Z", "matchedRecords": [], "recommendation": "PROCEED"}}
3b71bb51-1e23-416b-b6ad-72b5000cc32b	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_FORWARDED_TO_HPG	Transfer request forwarded to HPG for clearance review	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:34:10.45016	\N	{"autoTriggered": false, "documentsSent": 2, "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "clearanceRequestId": "4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d"}
334b80e2-be13-43d9-a068-dc960034b0dd	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_FORWARDED_TO_INSURANCE	Transfer request forwarded to Insurance for clearance review	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:34:13.638604	\N	{"autoTriggered": false, "documentsSent": 1, "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "clearanceRequestId": "057c9da0-e1c7-4811-bc35-d81efec534d0"}
5298d579-0f37-4384-a0e6-2bb72877d9a8	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED	Transfer Insurance auto-verified and approved. Score: 100%	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:34:14.790695	\N	{"transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "clearanceRequestId": "057c9da0-e1c7-4811-bc35-d81efec534d0", "autoVerificationResult": {"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "08-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-0VDAN0"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0VDAN0"}, "compositeHash": "ffff461d16101f5d51fac55c6f99b01bcb23d6686e4b3e9f0aa14ad0de54598f", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "4c050a75f3e58e65bf5da5b09756f4964b1a7f177345fbbf46dd5a82d8a6beac", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "d431c5ce-909f-491f-9206-2e7dea83edf7", "originalCompositeHash": "79623042008b1be1af96bae2cc4f502f6e44a4eefcd9328ef802278d78bcdd5e", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-0VDAN0"}}}
73b2f693-196f-4598-a632-5ea1ef9b1c7b	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_AUTO_VERIFY	HPG auto-verification completed. Confidence: 100%. Recommendation: AUTO_APPROVE	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 03:36:29.286963	\N	{"hashCheck": {"exists": false, "source": "database"}, "compositeHash": "320a9e5d6c9c9370e7d158b4159e217af48f725550fe286b00f1d5007bfa350e", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "confidenceScore": 100, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "WUG-5803", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "81e333023dbe4662076d7ba1e6e72a98288c4d13d1a265844301070418427bf5", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "79094cfb-13e3-4eeb-8ee2-8087c7231463", "originalCompositeHash": "85588aeb191118d099140b37ad7810dad88fe2cc15eb5afcad91d0dbd885fe3a", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-P9VSGW"}, "clearanceRequestId": "4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d"}
30de53b6-46eb-4b64-aacc-01d23ccec5ab	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_HPG_APPROVED	HPG approved transfer request 36bd5846-8247-48fa-8271-6f7400bee66d via clearance request 4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 03:36:45.137266	\N	{"notes": null, "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "clearanceRequestId": "4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d"}
dc994828-22ed-49d0-adac-ca96fb8c911b	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	HPG_CLEARANCE_APPROVED	HPG verification approved by hpg@hpg.gov.ph.  Blockchain TX: 03d4b5b123c5058acb23170bfd922c1e3db55fc7ab700e9182a1556798c853ce	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 03:36:45.736787	03d4b5b123c5058acb23170bfd922c1e3db55fc7ab700e9182a1556798c853ce	{"engineNumber": "3UR-DE284537", "macroEtching": false, "chassisNumber": "XRU7EB0PUX47FRHYV", "blockchainTxId": "03d4b5b123c5058acb23170bfd922c1e3db55fc7ab700e9182a1556798c853ce", "blockchainError": null, "clearanceRequestId": "4f4ec9dc-5bad-474c-8ae1-bbe177c6a63d"}
731d2f4f-5ee3-4402-bcc7-a50e61f2fc25	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	LTO_INSPECTION_COMPLETED	LTO inspection completed. Result: PASS, Roadworthiness: ROADWORTHY. MVIR: MVIR-2026-000004	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:38:16.495741	\N	{"mvirNumber": "MVIR-2026-000004", "inspectionResult": "PASS", "inspectionOfficer": "Admin User", "roadworthinessStatus": "ROADWORTHY"}
0cceb628-92b0-4a3c-afb2-cd44751c8587	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	BLOCKCHAIN_TRANSFERRED	Ownership transfer recorded on Hyperledger Fabric. TX: 38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:40:00.645297	38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d	{"source": "transfer_approval", "newOwner": "kimandrei012@gmail.com", "chaincode": "vehicle-registration", "fabricNetwork": "ltochannel", "previousOwner": "dullajasperdave@gmail.com", "transferredAt": "2026-02-08T03:40:00.645Z", "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d"}
458623d6-d0dc-45ad-8be6-83318da88d15	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	TRANSFER_COMPLETED	Transfer completed: Ownership transferred from Jasper Dulla to Kim Andrei Besmar	a57fd791-bef2-4881-baa9-bfbd1c8b799c	2026-02-08 03:40:00.686888	38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d	{"approvedBy": "a57fd791-bef2-4881-baa9-bfbd1c8b799c", "newOwnerId": "36b86e7e-7668-49dc-8dd6-6610ce092a73", "newOwnerName": "Kim Andrei Besmar", "transferDate": "2026-02-08T03:40:00.686Z", "newOwnerEmail": "kimandrei012@gmail.com", "blockchainTxId": "38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d", "transferReason": "Sale", "previousOwnerId": "5a672d9b-dabc-4778-b380-7587dadab040", "previousOwnerName": "Jasper Dulla", "transferRequestId": "36bd5846-8247-48fa-8271-6f7400bee66d", "previousOwnerEmail": "dullajasperdave@gmail.com"}
\.


--
-- TOC entry 3991 (class 0 OID 16800)
-- Dependencies: 243
-- Data for Name: vehicle_verifications; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicle_verifications (id, vehicle_id, verification_type, status, verified_by, verified_at, notes, created_at, updated_at, clearance_request_id, automated, verification_score, verification_metadata, auto_verified_at) FROM stdin;
b5413bbe-1089-4a33-841e-97ad5f671dd8	d7463eaa-e937-4e14-ac30-a0bb43dc5747	insurance	PENDING	\N	2026-02-06 10:17:30.425476	Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables	2026-02-06 10:17:30.412481	2026-02-06 10:17:30.425476	\N	t	100	{"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-8C6FII"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "autoVerified": true, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-8C6FII"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "6466664de1bc35130f8af0135bd1215e...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}	2026-02-06 10:17:30.425476
230050d6-4d6b-40c3-9a9d-85ad954a7e3e	d7463eaa-e937-4e14-ac30-a0bb43dc5747	hpg	APPROVED	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 10:18:34.013222	\N	2026-02-06 10:17:30.266454	2026-02-06 10:18:34.013222	\N	t	85	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2025", "color": "Brown", "model": "Toyota Corolla Altis", "series": "Toyota Corolla Altis", "yearModel": "2025", "plateNumber": "LKF-9216"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "decf9222d33375c64e4ad8af405635d012fafa7a3b6e716d736287133541b7b2", "autoVerifiedAt": "2026-02-06T10:18:18.078Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 85, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 15}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "hpg_clearance", "searchedFileHash": "32a58cd9f9c50bd3e9d577cee2d6abcb...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "originalCertificate": null, "recommendationReason": "High confidence score. All checks passed. Manual physical inspection still required."}	2026-02-06 10:18:18.111504
c022c01e-44a4-45d4-9564-f58bd05baea5	5735abaf-cd58-46ca-a6a5-0a864050ac8d	hpg	PENDING	\N	\N	\N	2026-02-06 11:03:59.219422	2026-02-06 11:03:59.219422	\N	f	\N	{}	\N
904f778a-3a85-4cee-9ca2-a55a8076190b	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	insurance	APPROVED	\N	2026-02-06 13:11:53.403518	Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score 100%, Policy: CTPL-2026-QKLLA4	2026-02-06 13:05:55.039643	2026-02-06 13:11:53.403518	\N	t	100	{"ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-QKLLA4"}, "hashCheck": {"exists": false, "source": "database"}, "verifiedAt": "2026-02-06T13:11:53.396Z", "expiryCheck": {"reason": "Valid", "isValid": true, "expiryDate": "2027-02-06T23:59:59.999Z", "daysUntilExpiry": 365}, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-QKLLA4"}, "compositeHash": "d11b7e7b66ef15c93c7c8e0c96001afeb441d05478cb9d333511b6d33c86b7d2", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "acf7bbbd3c522476bb523b52a9dc0820c109dc45fcdc2206cd563ec0384da1ef", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "20c8ff96-0583-4075-8424-5be7f914598d", "originalCompositeHash": "dabaf5cda836288b26feffd4570e70a750c251a31dbf9189603652150260648c", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-QKLLA4"}, "verificationScore": {"score": 100, "checks": {"hashUnique": true, "notExpired": true, "patternValid": true}, "decision": "APPROVE", "maxScore": 100, "percentage": 100, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-QKLLA4"}}}	2026-02-06 13:11:53.403518
a3271b8d-078f-42f9-a596-53266bd08b9d	02ea78e9-57d6-436b-ad6b-154d06e6ea6c	hpg	APPROVED	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 13:16:29.761986	\N	2026-02-06 13:05:54.156569	2026-02-06 13:16:29.761986	\N	t	93	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2022", "color": "White", "model": "Honda Civic", "series": "Honda Civic", "yearModel": "2022", "plateNumber": "BXY-6090"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "7ea2b7446ee4d0a5daa712532bf7dd728694c30336e7804e44229076f3fb2976", "autoVerifiedAt": "2026-02-06T13:13:36.045Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "BXY-6090", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "74adf95ff0af442e6e089d14ed4fde0748716718a8028efd3bd231e0a2c44025", "authenticityScore": 100, "originalVehicleVin": "MFXJMZV6W8DWZ8TGK", "originalCertificateId": "bb20b338-548e-45f6-b4f3-f0826db71256", "originalCompositeHash": "4e55e7a8b256bb958cf652c1c84ee62c5b7f14670f55d42a8706fd2e25799747", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-MTR0GI"}, "originalCertificate": {"issuedAt": "2026-02-06T00:00:00.000Z", "compositeHash": "4e55e7a8b256bb958cf652c1c84ee62c5b7f14670f55d42a8706fd2e25799747", "certificateNumber": "HPG-2026-MTR0GI"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-06 13:13:36.072833
f9405338-73b3-45f2-869e-b89a5b5e3870	5735abaf-cd58-46ca-a6a5-0a864050ac8d	insurance	PENDING	\N	2026-02-06 11:03:59.331137	Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables	2026-02-06 11:03:59.319174	2026-02-06 11:03:59.331137	\N	t	100	{"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-T9OZB3"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "autoVerified": true, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-T9OZB3"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "27c54a3623595accc135f092c3d2a9d0...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}	2026-02-06 11:03:59.331137
0603b148-8a16-4a32-9862-972997c53f40	84a15919-868f-44f9-b9ed-141fdfb62529	hpg	PENDING	\N	\N	\N	2026-02-06 11:57:12.04388	2026-02-06 11:57:12.04388	\N	f	\N	{}	\N
e45f04bf-0cc9-416a-bb63-4c898eb7c1fd	84a15919-868f-44f9-b9ed-141fdfb62529	insurance	PENDING	\N	2026-02-06 11:57:12.145891	Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables	2026-02-06 11:57:12.137372	2026-02-06 11:57:12.145891	\N	t	100	{"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "reason": "Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables", "status": "PENDING", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-7XUVA0"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "flagReasons": ["Certificate authenticity failed: No original certificate found with matching file hash in issued_certificates or certificates tables"], "autoVerified": true, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-7XUVA0"}, "authenticityCheck": {"reason": "No original certificate found with matching file hash in issued_certificates or certificates tables", "source": "none", "authentic": false, "debugInfo": {"certificateType": "insurance", "searchedFileHash": "33f25859a931dc332fd7a5197499ab5d...", "totalCertificatesChecked": 0}, "authenticityScore": 0, "originalCertificateFound": false}, "verificationResult": "FAILED"}	2026-02-06 11:57:12.145891
d042de16-d8c9-4206-9dcc-c64e105517dc	aac4dc07-379b-4cdc-9250-6e80aaed676a	insurance	APPROVED	\N	2026-02-06 14:13:24.685548	\N	2026-02-06 14:13:24.670341	2026-02-06 14:13:24.685548	\N	t	100	{"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-CE1WZR"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "autoVerified": true, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-CE1WZR"}, "compositeHash": "0b596022d7355807ee2e46e7607263a8166698fab1222fe2892fda89264f69da", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "eebdc6499cc233c18340a57c518c63d0685ae3e67886f85cd5e7a613e6443ab4", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "1d67820e-b6d8-4929-a59f-6fa9f6fe4e52", "originalCompositeHash": "cc54ca17aefd03100b413c9962397293595bdc0a67e63d2262f30b41c9c1c2f4", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-CE1WZR"}, "verificationResult": "APPROVED"}	2026-02-06 14:13:24.685548
8e584aa0-74db-493d-9a2a-35ec164474cf	aac4dc07-379b-4cdc-9250-6e80aaed676a	hpg	APPROVED	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-06 14:15:24.277817	\N	2026-02-06 14:13:24.298138	2026-02-06 14:15:24.277817	\N	t	98	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2022", "color": "Brown", "model": "Mitsubishi Mirage G4", "series": "Mitsubishi Mirage G4", "yearModel": "2022", "plateNumber": "CCW-6129"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "93e41060d18aed542e1b614c5d309a498054684a951554804ec1bb016316deca", "autoVerifiedAt": "2026-02-06T14:14:42.167Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "4GR-CE483859", "vehiclePlate": "CCW-6129", "chassisNumber": "WLVFCY822FNW0L0E", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "db410c26d4c68aaf54a3b978f9ac73cc978afc458f3d483f4f486eca2d82e790", "authenticityScore": 100, "originalVehicleVin": "3FTF50PTKHZ8EA715", "originalCertificateId": "6e4d03ca-fca9-4376-b353-499798542a5c", "originalCompositeHash": "08dedbaaf2ac282330097f97ab210fe3750cefc8154cd8be27da6dbc308569cc", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-IC1WZW"}, "originalCertificate": {"issuedAt": "2026-02-06T00:00:00.000Z", "compositeHash": "08dedbaaf2ac282330097f97ab210fe3750cefc8154cd8be27da6dbc308569cc", "certificateNumber": "HPG-2026-IC1WZW"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-06 14:14:42.195475
e33e77f0-7c45-49de-a5ac-79c65b3fae0b	c8babe0e-e748-4942-9025-53c1600a476f	insurance	APPROVED	\N	2026-02-06 16:24:25.069717	Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score 100%, Policy: CTPL-2026-1FIN66	2026-02-06 16:15:53.065829	2026-02-06 16:24:25.069717	\N	t	100	{"ocrData": {"insuranceExpiry": "06-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-1FIN66"}, "hashCheck": {"exists": false, "source": "database"}, "verifiedAt": "2026-02-06T16:24:25.063Z", "expiryCheck": {"reason": "Valid", "isValid": true, "expiryDate": "2027-02-06T23:59:59.999Z", "daysUntilExpiry": 365}, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-1FIN66"}, "compositeHash": "9fe70af7bd1b06830986c15eec1cc84977c79bce46ed6dbce424e6b368e66f6c", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "6ff47acba700fca813a94c9eb94fb8bc05b2a54fd83f5e89038b7a2c2e5ca2ca", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "36dcf63f-5e9c-4c04-88a6-1d168689d3c2", "originalCompositeHash": "4695c416f7dacbfac76ff0318f0adde024c625f3dd57e296463421150002fcbb", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-1FIN66"}, "verificationScore": {"score": 100, "checks": {"hashUnique": true, "notExpired": true, "patternValid": true}, "decision": "APPROVE", "maxScore": 100, "percentage": 100, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-1FIN66"}}}	2026-02-06 16:24:25.069717
5506eee9-1b93-4af4-aa2b-db50f40f8d53	47916952-a48c-486a-8421-014905e38968	hpg	PENDING	\N	2026-02-07 13:02:11.191646	HPG auto-verified. Confidence: 93%. High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required.	2026-02-06 17:17:51.287308	2026-02-07 13:02:11.191646	\N	t	93	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2025", "color": "White", "model": "Toyota Corolla Altis", "series": "Toyota Corolla Altis", "yearModel": "2025", "plateNumber": "LKF-9216"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "11c1a65ff3626709e754e856f1ad696be1553b2dbdf86b7fbd57cd4130bdc143", "autoVerifiedAt": "2026-02-07T13:02:11.164Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "LKF-9216", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "35a7816e73847c683d80ad1fa4af8402b769ca2038f708756548eaba43610174", "authenticityScore": 100, "originalVehicleVin": "VFYD3SRG9DYJDAHT2", "originalCertificateId": "30f93b30-1760-49cc-b084-e09abee42622", "originalCompositeHash": "2fdbcd15f27a0f7d8798fe1e3bde885f59fd89f0d9de345ec16d4d2234e8fba4", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-AB5BRF"}, "originalCertificate": {"issuedAt": "2026-02-06T00:00:00.000Z", "compositeHash": "9947ef1c96172ef2a3674b2bc8c30a3ce6554aa1c8e48fa2a443b7a3ce06a5fa", "certificateNumber": "HPG-2026-IQ7T5V"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-07 13:02:11.191646
1be62098-6079-4296-8915-120fd3e44ad5	47916952-a48c-486a-8421-014905e38968	insurance	APPROVED	\N	2026-02-07 13:02:12.102502	Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score 100%, Policy: CTPL-2026-0QJG4I	2026-02-06 17:17:51.662377	2026-02-07 13:02:12.102502	\N	t	100	{"ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-0QJG4I"}, "hashCheck": {"exists": false, "source": "database"}, "verifiedAt": "2026-02-07T13:02:12.095Z", "expiryCheck": {"reason": "Valid", "isValid": true, "expiryDate": "2027-02-07T23:59:59.999Z", "daysUntilExpiry": 365}, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0QJG4I"}, "compositeHash": "7a66fddd3d60482e7570116e9a6ecf98f4098010461472baf91141b469e2593f", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "15144e3b34af282c1ef1e22d70e9cf15f122cc3a956b333546923732a51cc9a1", "authenticityScore": 100, "originalVehicleVin": "VFYD3SRG9DYJDAHT2", "originalCertificateId": "7c768865-3806-4358-8fe0-a681311255fc", "originalCompositeHash": "9999b777195c4e26e080d1fe4b90d50bd37c4149022ea9cef8fbfb7303faae42", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-0QJG4I"}, "verificationScore": {"score": 100, "checks": {"hashUnique": true, "notExpired": true, "patternValid": true}, "decision": "APPROVE", "maxScore": 100, "percentage": 100, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0QJG4I"}}}	2026-02-07 13:02:12.102502
953616e6-f8ef-4e33-aa41-5381aa633e08	ed358d5a-ac0d-4a12-b593-8251152c9457	insurance	APPROVED	\N	2026-02-07 08:26:01.437229	Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score 100%, Policy: CTPL-2026-6G8AT1	2026-02-07 08:18:45.487651	2026-02-07 08:26:01.437229	\N	t	100	{"ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-6G8AT1"}, "hashCheck": {"exists": false, "source": "database"}, "verifiedAt": "2026-02-07T08:26:01.429Z", "expiryCheck": {"reason": "Valid", "isValid": true, "expiryDate": "2027-02-07T23:59:59.999Z", "daysUntilExpiry": 365}, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-6G8AT1"}, "compositeHash": "6147530a7af771cb75a3fd2f661fe5d7ea24b2dcd652ae9414b749d003e46210", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "80ed2c25240fb6eeed2ff9002779cf2fac931a0f3f582aecea91876e4002ec76", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "903f3367-2bf7-43ff-aa1a-43cb057dcfec", "originalCompositeHash": "1a57c9076584b0d5ee51b065b3b5b905daaca10c427902a81ce1a09b0e70483c", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-6G8AT1"}, "verificationScore": {"score": 100, "checks": {"hashUnique": true, "notExpired": true, "patternValid": true}, "decision": "APPROVE", "maxScore": 100, "percentage": 100, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-6G8AT1"}}}	2026-02-07 08:26:01.437229
f1ca5c2a-408a-409f-ac05-bd59267e7911	c8babe0e-e748-4942-9025-53c1600a476f	hpg	PENDING	\N	2026-02-07 11:38:11.938635	HPG auto-verified. Confidence: 93%. High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required.	2026-02-06 16:15:52.380534	2026-02-07 11:38:11.938635	\N	t	93	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "0c02d75f47bab18cfbd3a520f1bbf0f95c4d9626ddfdcb07ef214565e1364606", "autoVerifiedAt": "2026-02-07T11:38:11.912Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "EPP-8740", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "211945a4708368b03f484f0674adcffd21c7130d4646767a21c3a9dea16232e8", "authenticityScore": 100, "originalVehicleVin": "9S2T7H6CLA91ZMYU5", "originalCertificateId": "a41dc51e-66ad-42b7-a075-07f688f91ff9", "originalCompositeHash": "491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-FBBRI9"}, "originalCertificate": {"issuedAt": "2026-02-06T00:00:00.000Z", "compositeHash": "491bca19015bf0ff20e5ef4ded592e21fa792ab486796f099759fe2508b86e57", "certificateNumber": "HPG-2026-FBBRI9"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-07 11:38:11.938635
4816d3c5-9737-4e1e-a2c1-2ccd91a32be7	9227a1b3-9b77-4506-a2c5-068827b86f6d	insurance	APPROVED	\N	2026-02-07 11:54:43.736559	\N	2026-02-07 11:54:43.668796	2026-02-07 11:54:43.736559	\N	t	100	{"basis": {"hashUnique": true, "notExpired": true, "patternValid": true}, "score": 100, "status": "APPROVED", "ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-IOQ9U2"}, "automated": true, "hashCheck": {"exists": false, "source": "database"}, "confidence": 1, "autoVerified": true, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-IOQ9U2"}, "compositeHash": "e3c36f396a8e4ff5a0a2f6b8c513fcde450a4009df2108bb3cfa10950daba7a8", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000"}, "originalFileHash": "0a35b10e1e2b9c79f73a5a4c1bb8eaf95540105488578878d578112a7750ff35", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "4ca9844c-b5a1-464f-ad72-a60dfbedc5af", "originalCompositeHash": "7d580f2e796d76bb889c6076365c905d52476e30d0787eff65cccd415f8580b9", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-IOQ9U2"}, "verificationResult": "APPROVED"}	2026-02-07 11:54:43.736559
12abcd2f-d092-48a4-b2e2-3edce531a021	9227a1b3-9b77-4506-a2c5-068827b86f6d	hpg	APPROVED	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 11:59:32.927296	\N	2026-02-07 11:54:43.034936	2026-02-07 11:59:32.927296	\N	t	98	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2024", "color": "Pearl White", "model": "Toyota Corolla Altis", "series": "Toyota Corolla Altis", "yearModel": "2024", "plateNumber": "CBY-9590"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "2adb86be0f3bdf2caee9e9163d7fe1f2c719908304a2e983733499a65acda536", "autoVerifiedAt": "2026-02-07T11:58:17.273Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 98, "dataMatch": 3, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"engineNumber": "1GR-BE500494", "vehiclePlate": "CBY-9590", "chassisNumber": "0YAF3MYMVL212", "verificationDetails": {"engine_condition": "Good", "chassis_condition": "Good"}}, "originalFileHash": "903bced1bd2870f0b38e725a8fb40a8e0fadb91212bb387914b6f7cda76dcd08", "authenticityScore": 100, "originalVehicleVin": "TE6ATEHZNKBY6N2EK", "originalCertificateId": "8ee1704a-6e13-4ddf-a8dd-7d7004bf2092", "originalCompositeHash": "e18e166c3c7cdf9a4cff914163d340e0a5dfb22553c65154fafa1f1d22c7db9a", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-DL6BGF"}, "originalCertificate": {"issuedAt": "2026-02-07T00:00:00.000Z", "compositeHash": "e18e166c3c7cdf9a4cff914163d340e0a5dfb22553c65154fafa1f1d22c7db9a", "certificateNumber": "HPG-2026-DL6BGF"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-07 11:58:17.301405
646f981b-6c1f-46fc-892d-42de6d8386ce	ed358d5a-ac0d-4a12-b593-8251152c9457	hpg	PENDING	\N	2026-02-07 12:47:09.048962	HPG auto-verified. Confidence: 93%. High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required.	2026-02-07 08:18:44.782129	2026-02-07 12:47:09.048962	\N	t	93	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "c058b12e9062a32c78fdbe5149326945420d13d818a6c95d573b0f859deca768", "autoVerifiedAt": "2026-02-07T12:47:09.018Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 93, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 8, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "TZK-5341", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "7999c0f34d2331e54da5a1e87d136b25ff62fc8c08aa336548e9694b36c9eefa", "authenticityScore": 100, "originalVehicleVin": "7MTTNKS3BFKW7384D", "originalCertificateId": "3597ba63-34b2-4c00-b51d-d18102fb1c87", "originalCompositeHash": "adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-BS5LYT"}, "originalCertificate": {"issuedAt": "2026-02-07T00:00:00.000Z", "compositeHash": "adf9b621909a07602b5f65c107156eb0f08d4988159cf0bcc42b672749604bf5", "certificateNumber": "HPG-2026-BS5LYT"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-07 12:47:09.048962
37dce49a-208b-4da8-a9d2-6d48d88f29b2	d50832ba-fd65-497c-8e23-cfef1850df37	insurance	APPROVED	\N	2026-02-07 14:18:26.339411	Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score 100%, Policy: CTPL-2026-NWLH39	2026-02-07 14:07:50.359196	2026-02-07 14:18:26.339411	\N	t	100	{"ocrData": {"insuranceExpiry": "07-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-NWLH39"}, "hashCheck": {"exists": false, "source": "database"}, "verifiedAt": "2026-02-07T14:18:26.313Z", "expiryCheck": {"reason": "Valid", "isValid": true, "expiryDate": "2027-02-07T23:59:59.999Z", "daysUntilExpiry": 365}, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-NWLH39"}, "compositeHash": "254c86539b846cbee78656bf1f49f5a3cf37d44f7ced425f22c9b19f83e68539", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "64576488a82bfe6f76f96f5245e7e13d38f47d9c0671d3cdbf64c066f072bf62", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "a1e8e055-fbfd-455c-b0d1-aa9df19fd35d", "originalCompositeHash": "b5406baca95767d9e4f3bb8856f783ac81a69fe8ce524dcf623a4827ce38b93a", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-NWLH39"}, "verificationScore": {"score": 100, "checks": {"hashUnique": true, "notExpired": true, "patternValid": true}, "decision": "APPROVE", "maxScore": 100, "percentage": 100, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-NWLH39"}}}	2026-02-07 14:18:26.339411
29c24e2f-a975-40d1-9732-8c69ec110b2d	d50832ba-fd65-497c-8e23-cfef1850df37	hpg	APPROVED	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-07 14:27:49.458897	\N	2026-02-07 14:07:49.847001	2026-02-07 14:27:49.458897	\N	t	100	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2023", "color": "White", "model": "Honda City", "series": "Honda City", "yearModel": "2023", "plateNumber": "KVH-8684"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "063d76dccb2f26009490505726febeb83d55acd333b77d20b45a442896b3c29b", "autoVerifiedAt": "2026-02-07T14:26:41.598Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "KVH-8684", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "57005039c7f7a3b2630056eff12c3a95b27983e6a146e66b88817430f7f3d174", "authenticityScore": 100, "originalVehicleVin": "5VH6EN0UC1WK3354M", "originalCertificateId": "d0a8e8ed-5f92-4ef7-82a9-4ebbf602c5d1", "originalCompositeHash": "9ca026147676004dd5101a306d321440d5dc7035ae4dd54bf9867f17c3ff7cd9", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-QZW2JN"}, "originalCertificate": {"issuedAt": "2026-02-07T00:00:00.000Z", "compositeHash": "9ca026147676004dd5101a306d321440d5dc7035ae4dd54bf9867f17c3ff7cd9", "certificateNumber": "HPG-2026-QZW2JN"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-07 14:26:41.625512
f6a00b30-4b37-4272-be1b-28149439044d	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	insurance	APPROVED	\N	2026-02-08 03:34:14.69697	Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score 100%, Policy: CTPL-2026-0VDAN0	2026-02-08 02:46:42.096395	2026-02-08 03:34:14.69697	\N	t	100	{"ocrData": {"insuranceExpiry": "08-Feb-2027", "insuranceCompany": "Details\\nCompany Name", "insurancePolicyNumber": "CTPL-2026-0VDAN0"}, "hashCheck": {"exists": false, "source": "database"}, "verifiedAt": "2026-02-08T03:34:14.673Z", "expiryCheck": {"reason": "Valid", "isValid": true, "expiryDate": "2027-02-08T23:59:59.999Z", "daysUntilExpiry": 365}, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0VDAN0"}, "compositeHash": "ffff461d16101f5d51fac55c6f99b01bcb23d6686e4b3e9f0aa14ad0de54598f", "blockchainTxId": null, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"coverageType": "CTPL", "coverageAmount": "PHP 200,000 / PHP 50,000", "originalCertificateType": "insurance"}, "originalFileHash": "4c050a75f3e58e65bf5da5b09756f4964b1a7f177345fbbf46dd5a82d8a6beac", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "d431c5ce-909f-491f-9206-2e7dea83edf7", "originalCompositeHash": "79623042008b1be1af96bae2cc4f502f6e44a4eefcd9328ef802278d78bcdd5e", "originalCertificateFound": true, "originalCertificateNumber": "CTPL-2026-0VDAN0"}, "verificationScore": {"score": 100, "checks": {"hashUnique": true, "notExpired": true, "patternValid": true}, "decision": "APPROVE", "maxScore": 100, "percentage": 100, "patternCheck": {"valid": true, "reason": "Format matches expected pattern", "pattern": "CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)", "confidence": 100, "normalized": "CTPL-2026-0VDAN0"}}}	2026-02-08 03:34:14.69697
027fd988-3184-4dc7-8596-a5e3e5d5ff90	4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	hpg	APPROVED	654bb34d-fec4-458c-94bc-2223d885a6d7	2026-02-08 03:36:45.734577	\N	2026-02-08 02:46:41.383034	2026-02-08 03:36:45.734577	\N	t	100	{"note": "HPG always requires manual physical inspection and final approval", "ocrData": {"year": "2024", "color": "White", "model": "Toyota Vios", "series": "Toyota Vios", "yearModel": "2024", "plateNumber": "WUG-5803"}, "hashCheck": {"exists": false, "source": "database"}, "compositeHash": "320a9e5d6c9c9370e7d158b4159e217af48f725550fe286b00f1d5007bfa350e", "autoVerifiedAt": "2026-02-08T03:36:29.172Z", "recommendation": "AUTO_APPROVE", "scoreBreakdown": {"total": 100, "dataMatch": 5, "dataExtraction": 30, "hashUniqueness": 20, "documentCompleteness": 15, "certificateAuthenticity": 30}, "authenticityCheck": {"reason": "Certificate file hash matches original certificate from certificate-generator (issuer verified)", "source": "issued_certificates", "authentic": true, "matchType": "file_hash", "blockchainTxId": null, "certificateData": {"vehiclePlate": "WUG-5803", "verificationDetails": "No adverse record found. Vehicle cleared for registration.", "originalCertificateType": "hpg_clearance"}, "originalFileHash": "81e333023dbe4662076d7ba1e6e72a98288c4d13d1a265844301070418427bf5", "authenticityScore": 100, "originalVehicleVin": "XRU7EB0PUX47FRHYV", "originalCertificateId": "79094cfb-13e3-4eeb-8ee2-8087c7231463", "originalCompositeHash": "85588aeb191118d099140b37ad7810dad88fe2cc15eb5afcad91d0dbd885fe3a", "originalCertificateFound": true, "originalCertificateNumber": "HPG-2026-P9VSGW"}, "originalCertificate": {"issuedAt": "2026-02-08T00:00:00.000Z", "compositeHash": "85588aeb191118d099140b37ad7810dad88fe2cc15eb5afcad91d0dbd885fe3a", "certificateNumber": "HPG-2026-P9VSGW"}, "recommendationReason": "High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required."}	2026-02-08 03:36:29.19621
\.


--
-- TOC entry 3990 (class 0 OID 16777)
-- Dependencies: 241
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: lto_user
--

COPY public.vehicles (id, vin, plate_number, make, model, year, color, engine_number, chassis_number, vehicle_type, fuel_type, transmission, engine_displacement, owner_id, status, registration_date, last_updated, priority, notes, mvir_number, inspection_date, inspection_result, roadworthiness_status, emission_compliance, inspection_officer, inspection_notes, inspection_documents, registration_expiry_date, insurance_expiry_date, emission_expiry_date, expiry_notified_30d, expiry_notified_7d, expiry_notified_1d, blockchain_tx_id, vehicle_category, passenger_capacity, gross_vehicle_weight, net_weight, registration_type, origin_type, or_number, cr_number, or_issued_at, cr_issued_at, date_of_registration, scrapped_at, scrap_reason, scrapped_by, previous_application_id) FROM stdin;
d7463eaa-e937-4e14-ac30-a0bb43dc5747	VFYD3SRG9DYJDAHT2	LKF-9216	Toyota	Corolla Altis	2025	Brown	3UR-FE730776	VFYD3SRG9DYJDAHT2	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	SUBMITTED	2026-02-06 10:17:29.570733	2026-02-06 10:17:30.434155	MEDIUM		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f	f	\N	M1	4	3436.00	2405.00	For Hire	NEW_REG	\N	\N	\N	\N	\N	\N	\N	\N	\N
d50832ba-fd65-497c-8e23-cfef1850df37	5VH6EN0UC1WK3354M	KVH-8684	Honda	City	2023	Beige	4GR-BE103259	5VH6EN0UC1WK3354M	Car	GASOLINE	MANUAL	\N	36b86e7e-7668-49dc-8dd6-6610ce092a73	REGISTERED	2026-02-07 14:07:49.066349	2026-02-08 03:13:13.737229	MEDIUM		MVIR-2026-000003	2026-02-07 14:28:47.087	PASS	ROADWORTHY	\N	Admin User	\N	\N	2027-02-07 14:13:02.709	\N	\N	f	f	f	f5f4bf1c26878794ad51de6990f0ea9a84c6ae0cd1d299694bf21e0763f03d00	M1	8	2635.00	1844.00	Private	NEW_REG	OR-2026-000007	CR-2026-000007	2026-02-07 14:13:02.685	2026-02-07 14:13:02.685	2026-02-07 14:07:49.066349	\N	\N	\N	\N
5735abaf-cd58-46ca-a6a5-0a864050ac8d	2UM566CX7SXPANBXH	DAS-2869	Honda	Civic	2025	Red	4GR-BE888155	2UM566CX7SXPANBXH	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	REJECTED	2026-02-06 11:03:58.546057	2026-02-06 11:47:49.487679	MEDIUM	Application rejected: haha	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f	f	\N	M1	4	4163.00	2914.00	Private	NEW_REG	\N	\N	\N	\N	\N	\N	\N	\N	\N
84a15919-868f-44f9-b9ed-141fdfb62529	9BL8DV2DCHUB2R2LT	XXT-6053	Hyundai	Accent	2022	Blue	1GR-DE857112	9BL8DV2DCHUB2R2LT	Sedan	GASOLINE	MANUAL	\N	1b76c49c-b8d7-4c10-84aa-6b2bfd1c3fbc	SUBMITTED	2026-02-06 11:57:11.381906	2026-02-06 11:57:12.150446	MEDIUM		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f	f	\N	M1	4	3335.00	2334.00	Private	NEW_REG	\N	\N	\N	\N	\N	\N	\N	\N	\N
4651a545-fdfc-4506-8a8f-1cc3ce7b20f3	XRU7EB0PUX47FRHYV	WUG-5803	Toyota	Vios	2024	White	3UR-DE284537	XRU7EB0PUX47FRHYV	Car	GASOLINE	MANUAL	\N	36b86e7e-7668-49dc-8dd6-6610ce092a73	REGISTERED	2026-02-08 02:46:40.690837	2026-02-08 03:40:00.65547	MEDIUM		MVIR-2026-000004	2026-02-08 03:38:16.477	PASS	ROADWORTHY	\N	Admin User	\N	\N	2027-02-08 03:09:06.996	\N	\N	f	f	f	38eeeb6e7bb7eabf19806f1272898155b799f76e6278fc92a91b34cb06eef08d	M1	7	4349.00	3044.00	Government	TRANSFER	OR-2026-000009	CR-2026-000009	2026-02-08 03:09:06.255	2026-02-08 03:09:06.255	2026-02-08 02:46:40.690837	\N	\N	\N	\N
02ea78e9-57d6-436b-ad6b-154d06e6ea6c	MFXJMZV6W8DWZ8TGK	BXY-6090	Honda	Civic	2022	Red	3UR-BE565637	MFXJMZV6W8DWZ8TGK	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	TRANSFER_IN_PROGRESS	2026-02-06 13:05:53.458346	2026-02-07 11:47:31.717035	MEDIUM		MVIR-2026-000001	2026-02-06 13:17:09.791	PASS	ROADWORTHY	\N	Admin User	\N	\N	2027-02-06 13:07:56.339	\N	\N	f	f	f	\N	M1	5	2114.00	1479.00	Private	NEW_REG	OR-2026-000001	CR-2026-000001	2026-02-06 13:07:56.31	2026-02-06 13:07:56.31	2026-02-06 13:05:53.458346	\N	\N	\N	\N
c8babe0e-e748-4942-9025-53c1600a476f	9S2T7H6CLA91ZMYU5	EPP-8740	Toyota	Hilux	2024	Silver	5VZ-FE275580	9S2T7H6CLA91ZMYU5	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	TRANSFER_IN_PROGRESS	2026-02-06 16:15:51.707763	2026-02-07 11:47:31.717035	MEDIUM		\N	\N	\N	\N	\N	\N	\N	\N	2027-02-06 16:19:44.182	\N	\N	f	f	f	\N	M1	5	2796.00	1957.00	Private	NEW_REG	OR-2026-000003	CR-2026-000003	2026-02-06 16:19:44.143	2026-02-06 16:19:44.143	2026-02-06 16:15:51.707763	\N	\N	\N	\N
ed358d5a-ac0d-4a12-b593-8251152c9457	7MTTNKS3BFKW7384D	TZK-5341	Honda	Click 125	2023	Blue	3UR-FE462946	7MTTNKS3BFKW7384D	MC	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	TRANSFER_IN_PROGRESS	2026-02-07 08:18:44.148413	2026-02-07 11:47:31.717035	MEDIUM		MVIR-2026-000002	2026-02-07 08:28:13.901	PASS	ROADWORTHY	\N	Admin User	\N	\N	2027-02-07 08:20:22.432	\N	\N	f	f	f	\N	M1	3	3796.00	2657.00	Private	NEW_REG	OR-2026-000005	CR-2026-000005	2026-02-07 08:20:22.407	2026-02-07 08:20:22.407	2026-02-07 08:18:44.148413	\N	\N	\N	\N
47916952-a48c-486a-8421-014905e38968	LMJH22V3X6MPEM2VU	EUE-5843	Honda	City	2023	Pearl White	5VZ-CE605906	LMJH22V3X6MPEM2VU	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	TRANSFER_IN_PROGRESS	2026-02-06 17:17:50.154024	2026-02-07 11:47:31.717035	MEDIUM		\N	\N	\N	\N	\N	\N	\N	\N	2027-02-06 17:23:12.501	\N	\N	f	f	f	\N	M1	5	1562.00	1093.00	Private	NEW_REG	OR-2026-000004	CR-2026-000004	2026-02-06 17:23:12.477	2026-02-06 17:23:12.477	2026-02-06 17:17:50.154024	\N	\N	\N	\N
9227a1b3-9b77-4506-a2c5-068827b86f6d	TE6ATEHZNKBY6N2EK	CBY-9590	Toyota	Corolla Altis	2024	Pearl White	1GR-BE500494	TE6ATEHZNKBY6N2EK	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	TRANSFER_IN_PROGRESS	2026-02-07 11:54:42.352268	2026-02-07 12:34:58.433531	MEDIUM		\N	\N	\N	\N	\N	\N	\N	\N	2027-02-07 11:59:42.643	\N	\N	f	f	f	766a7e3183da784b2959dde3512712dc4378ad822491c796ef017715f1365f9c	M1	5	1742.00	1219.00	Private	NEW_REG	OR-2026-000006	CR-2026-000006	2026-02-07 11:59:42.612	2026-02-07 11:59:42.612	2026-02-07 11:54:42.352268	\N	\N	\N	\N
aac4dc07-379b-4cdc-9250-6e80aaed676a	3FTF50PTKHZ8EA715	CCW-6129	Mitsubishi	Mirage G4	2022	Brown	4GR-CE483859	3FTF50PTKHZ8EA715	Car	GASOLINE	MANUAL	\N	5a672d9b-dabc-4778-b380-7587dadab040	TRANSFER_IN_PROGRESS	2026-02-06 14:13:23.542811	2026-02-07 15:47:28.210228	MEDIUM		\N	\N	\N	\N	\N	\N	\N	\N	2027-02-06 14:15:41.068	\N	\N	f	f	f	467034ae8ad467d2caa9e0eed0507bbc4a9dcefacd753323bf2fc5d5b6f628c0	M1	5	4429.00	3100.00	Private	NEW_REG	OR-2026-000002	CR-2026-000002	2026-02-06 14:15:41.035	2026-02-06 14:15:41.035	2026-02-06 14:13:23.542811	\N	\N	\N	\N
\.


--
-- TOC entry 4036 (class 0 OID 0)
-- Dependencies: 219
-- Name: cr_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.cr_number_seq', 9, true);


--
-- TOC entry 4037 (class 0 OID 0)
-- Dependencies: 225
-- Name: mvir_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.mvir_number_seq', 4, true);


--
-- TOC entry 4038 (class 0 OID 0)
-- Dependencies: 232
-- Name: or_number_seq; Type: SEQUENCE SET; Schema: public; Owner: lto_user
--

SELECT pg_catalog.setval('public.or_number_seq', 9, true);


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
-- TOC entry 3738 (class 1259 OID 17002)
-- Name: idx_vehicles_previous_application; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_previous_application ON public.vehicles USING btree (previous_application_id) WHERE (previous_application_id IS NOT NULL);


--
-- TOC entry 3739 (class 1259 OID 17003)
-- Name: idx_vehicles_registration_expiry; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_registration_expiry ON public.vehicles USING btree (registration_expiry_date);


--
-- TOC entry 3740 (class 1259 OID 17004)
-- Name: idx_vehicles_scrapped; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_scrapped ON public.vehicles USING btree (scrapped_at) WHERE (status = 'SCRAPPED'::public.vehicle_status);


--
-- TOC entry 3741 (class 1259 OID 17005)
-- Name: idx_vehicles_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status);


--
-- TOC entry 3742 (class 1259 OID 17006)
-- Name: idx_vehicles_vin; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_vehicles_vin ON public.vehicles USING btree (vin);


--
-- TOC entry 3751 (class 1259 OID 17007)
-- Name: idx_verifications_automated; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_automated ON public.vehicle_verifications USING btree (automated, status);


--
-- TOC entry 3752 (class 1259 OID 17008)
-- Name: idx_verifications_clearance_request; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_clearance_request ON public.vehicle_verifications USING btree (clearance_request_id);


--
-- TOC entry 3753 (class 1259 OID 17009)
-- Name: idx_verifications_status; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_status ON public.vehicle_verifications USING btree (status);


--
-- TOC entry 3754 (class 1259 OID 17010)
-- Name: idx_verifications_type; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_type ON public.vehicle_verifications USING btree (verification_type);


--
-- TOC entry 3755 (class 1259 OID 17011)
-- Name: idx_verifications_vehicle; Type: INDEX; Schema: public; Owner: lto_user
--

CREATE INDEX idx_verifications_vehicle ON public.vehicle_verifications USING btree (vehicle_id);


--
-- TOC entry 3814 (class 2620 OID 17012)
-- Name: email_verification_tokens trigger_cleanup_verification_tokens; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_cleanup_verification_tokens AFTER INSERT ON public.email_verification_tokens FOR EACH ROW EXECUTE FUNCTION public.auto_cleanup_old_tokens();


--
-- TOC entry 3817 (class 2620 OID 17013)
-- Name: vehicle_history trigger_log_officer_vehicle_action; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_log_officer_vehicle_action AFTER INSERT ON public.vehicle_history FOR EACH ROW EXECUTE FUNCTION public.log_officer_vehicle_action();


--
-- TOC entry 3813 (class 2620 OID 17014)
-- Name: clearance_requests trigger_update_clearance_requests_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_clearance_requests_updated_at BEFORE UPDATE ON public.clearance_requests FOR EACH ROW EXECUTE FUNCTION public.update_clearance_requests_updated_at();


--
-- TOC entry 3818 (class 2620 OID 17015)
-- Name: registration_document_requirements trigger_update_document_requirements_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_document_requirements_updated_at BEFORE UPDATE ON public.registration_document_requirements FOR EACH ROW EXECUTE FUNCTION public.update_document_requirements_updated_at();


--
-- TOC entry 3815 (class 2620 OID 17016)
-- Name: transfer_requests trigger_update_transfer_requests_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER trigger_update_transfer_requests_updated_at BEFORE UPDATE ON public.transfer_requests FOR EACH ROW EXECUTE FUNCTION public.update_transfer_requests_updated_at();


--
-- TOC entry 3816 (class 2620 OID 17017)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3819 (class 2620 OID 17018)
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3820 (class 2620 OID 17019)
-- Name: vehicle_verifications update_verifications_updated_at; Type: TRIGGER; Schema: public; Owner: lto_user
--

CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON public.vehicle_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3760 (class 2606 OID 17020)
-- Name: certificate_submissions certificate_submissions_matched_certificate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_matched_certificate_id_fkey FOREIGN KEY (matched_certificate_id) REFERENCES public.issued_certificates(id) ON DELETE SET NULL;


--
-- TOC entry 3761 (class 2606 OID 17025)
-- Name: certificate_submissions certificate_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3762 (class 2606 OID 17030)
-- Name: certificate_submissions certificate_submissions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3763 (class 2606 OID 17035)
-- Name: certificate_submissions certificate_submissions_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificate_submissions
    ADD CONSTRAINT certificate_submissions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3764 (class 2606 OID 17040)
-- Name: certificates certificates_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_clearance_request_id_fkey FOREIGN KEY (clearance_request_id) REFERENCES public.clearance_requests(id) ON DELETE SET NULL;


--
-- TOC entry 3765 (class 2606 OID 17045)
-- Name: certificates certificates_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3766 (class 2606 OID 17050)
-- Name: certificates certificates_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- TOC entry 3767 (class 2606 OID 17055)
-- Name: certificates certificates_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3768 (class 2606 OID 17060)
-- Name: certificates certificates_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3769 (class 2606 OID 17065)
-- Name: clearance_requests clearance_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 3770 (class 2606 OID 17070)
-- Name: clearance_requests clearance_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- TOC entry 3771 (class 2606 OID 17075)
-- Name: clearance_requests clearance_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT clearance_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3773 (class 2606 OID 17080)
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3774 (class 2606 OID 17085)
-- Name: documents documents_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3775 (class 2606 OID 17090)
-- Name: documents documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3776 (class 2606 OID 17095)
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3777 (class 2606 OID 17100)
-- Name: expiry_notifications expiry_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3778 (class 2606 OID 17105)
-- Name: expiry_notifications expiry_notifications_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.expiry_notifications
    ADD CONSTRAINT expiry_notifications_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3772 (class 2606 OID 17110)
-- Name: clearance_requests fk_clearance_certificate; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.clearance_requests
    ADD CONSTRAINT fk_clearance_certificate FOREIGN KEY (certificate_id) REFERENCES public.certificates(id) ON DELETE SET NULL;


--
-- TOC entry 3779 (class 2606 OID 17115)
-- Name: issued_certificates issued_certificates_issuer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.issued_certificates
    ADD CONSTRAINT issued_certificates_issuer_id_fkey FOREIGN KEY (issuer_id) REFERENCES public.external_issuers(id) ON DELETE SET NULL;


--
-- TOC entry 4039 (class 0 OID 0)
-- Dependencies: 3779
-- Name: CONSTRAINT issued_certificates_issuer_id_fkey ON issued_certificates; Type: COMMENT; Schema: public; Owner: lto_user
--

COMMENT ON CONSTRAINT issued_certificates_issuer_id_fkey ON public.issued_certificates IS 'Foreign key to external_issuers table. Changed from users table to match code implementation.';


--
-- TOC entry 3780 (class 2606 OID 17120)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3781 (class 2606 OID 17125)
-- Name: officer_activity_log officer_activity_log_officer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.officer_activity_log
    ADD CONSTRAINT officer_activity_log_officer_id_fkey FOREIGN KEY (officer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3782 (class 2606 OID 17130)
-- Name: officer_activity_log officer_activity_log_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.officer_activity_log
    ADD CONSTRAINT officer_activity_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- TOC entry 3796 (class 2606 OID 17135)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3797 (class 2606 OID 17140)
-- Name: request_logs request_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.request_logs
    ADD CONSTRAINT request_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3798 (class 2606 OID 17145)
-- Name: sessions sessions_refresh_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_refresh_token_id_fkey FOREIGN KEY (refresh_token_id) REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;


--
-- TOC entry 3799 (class 2606 OID 17150)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3800 (class 2606 OID 17155)
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 3801 (class 2606 OID 17160)
-- Name: transfer_documents transfer_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3802 (class 2606 OID 17165)
-- Name: transfer_documents transfer_documents_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3803 (class 2606 OID 17170)
-- Name: transfer_documents transfer_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_documents
    ADD CONSTRAINT transfer_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 3783 (class 2606 OID 17175)
-- Name: transfer_requests transfer_requests_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- TOC entry 3784 (class 2606 OID 17180)
-- Name: transfer_requests transfer_requests_emission_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_emission_approved_by_fkey FOREIGN KEY (emission_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3785 (class 2606 OID 17185)
-- Name: transfer_requests transfer_requests_emission_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_emission_clearance_request_id_fkey FOREIGN KEY (emission_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3786 (class 2606 OID 17190)
-- Name: transfer_requests transfer_requests_hpg_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_hpg_approved_by_fkey FOREIGN KEY (hpg_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3787 (class 2606 OID 17195)
-- Name: transfer_requests transfer_requests_hpg_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_hpg_clearance_request_id_fkey FOREIGN KEY (hpg_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3788 (class 2606 OID 17200)
-- Name: transfer_requests transfer_requests_insurance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_insurance_approved_by_fkey FOREIGN KEY (insurance_approved_by) REFERENCES public.users(id);


--
-- TOC entry 3789 (class 2606 OID 17205)
-- Name: transfer_requests transfer_requests_insurance_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_insurance_clearance_request_id_fkey FOREIGN KEY (insurance_clearance_request_id) REFERENCES public.clearance_requests(id);


--
-- TOC entry 3790 (class 2606 OID 17210)
-- Name: transfer_requests transfer_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 3791 (class 2606 OID 17215)
-- Name: transfer_requests transfer_requests_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- TOC entry 3792 (class 2606 OID 17220)
-- Name: transfer_requests transfer_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_requests
    ADD CONSTRAINT transfer_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3804 (class 2606 OID 17225)
-- Name: transfer_verifications transfer_verifications_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- TOC entry 3805 (class 2606 OID 17230)
-- Name: transfer_verifications transfer_verifications_transfer_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_transfer_request_id_fkey FOREIGN KEY (transfer_request_id) REFERENCES public.transfer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 3806 (class 2606 OID 17235)
-- Name: transfer_verifications transfer_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.transfer_verifications
    ADD CONSTRAINT transfer_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3793 (class 2606 OID 17240)
-- Name: users users_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- TOC entry 3794 (class 2606 OID 17245)
-- Name: vehicle_history vehicle_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- TOC entry 3795 (class 2606 OID 17250)
-- Name: vehicle_history vehicle_history_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_history
    ADD CONSTRAINT vehicle_history_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3810 (class 2606 OID 17255)
-- Name: vehicle_verifications vehicle_verifications_clearance_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_clearance_request_id_fkey FOREIGN KEY (clearance_request_id) REFERENCES public.clearance_requests(id) ON DELETE SET NULL;


--
-- TOC entry 3811 (class 2606 OID 17260)
-- Name: vehicle_verifications vehicle_verifications_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- TOC entry 3812 (class 2606 OID 17265)
-- Name: vehicle_verifications vehicle_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicle_verifications
    ADD CONSTRAINT vehicle_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- TOC entry 3807 (class 2606 OID 17270)
-- Name: vehicles vehicles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- TOC entry 3808 (class 2606 OID 17275)
-- Name: vehicles vehicles_previous_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_previous_application_id_fkey FOREIGN KEY (previous_application_id) REFERENCES public.vehicles(id);


--
-- TOC entry 3809 (class 2606 OID 17280)
-- Name: vehicles vehicles_scrapped_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lto_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_scrapped_by_fkey FOREIGN KEY (scrapped_by) REFERENCES public.users(id);


-- Completed on 2026-02-08 13:09:08

--
-- PostgreSQL database dump complete
--

\unrestrict 1Sx0eRD06GUxGNkLzFKgWbead9S2kW99MurQfLpF1G2aXONEv2a5tkdfbxd9PGS

