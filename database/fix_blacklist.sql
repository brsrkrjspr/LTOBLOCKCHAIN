-- Fix missing blacklist cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_blacklist() RETURNS integer
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

-- Ensure table exists too
CREATE TABLE IF NOT EXISTS public.token_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    token_jti character varying(255) UNIQUE NOT NULL,
    token_hash character varying(255) NOT NULL,
    reason character varying(255),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.token_blacklist OWNER TO lto_user;
