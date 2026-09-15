--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user',
    'school_admin'
);


--
-- Name: adopt_rows_for_school(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adopt_rows_for_school() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles SET school_id = NEW.id
    WHERE lower(btrim(COALESCE(school_name,''))) = NEW.normalized_name AND school_id IS DISTINCT FROM NEW.id;
  UPDATE public.school_admins SET school_id = NEW.id
    WHERE normalized_school = NEW.normalized_name AND school_id IS DISTINCT FROM NEW.id;
  UPDATE public.school_rosters SET school_id = NEW.id
    WHERE normalized_school = NEW.normalized_name AND school_id IS DISTINCT FROM NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: allocate_enrollment_certificate_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allocate_enrollment_certificate_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.enrollment_certificate_ids (user_id, course_id, level, course_title, certificate_id, student_name)
  VALUES (
    NEW.user_id,
    NEW.course_id,
    NEW.level,
    NEW.course_title,
    'EDU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    (SELECT COALESCE(NULLIF(btrim(full_name), ''), email) FROM public.profiles WHERE id = NEW.user_id)
  )
  ON CONFLICT (user_id, course_id, level) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: audit_profile_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_profile_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _changed text[] := ARRAY[]::text[];
BEGIN
  IF NEW.last_password_change IS DISTINCT FROM OLD.last_password_change THEN
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, severity)
    VALUES (NEW.id, 'password_change', 'security',
            jsonb_build_object('changed_at', NEW.last_password_change), 'warning');
  END IF;

  IF NEW.deletion_status IS DISTINCT FROM OLD.deletion_status THEN
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, severity)
    VALUES (NEW.id, 'account_deletion_status', 'compliance',
            jsonb_build_object('from', OLD.deletion_status, 'to', NEW.deletion_status,
                               'deleted_at', NEW.deleted_at, 'anonymized_at', NEW.anonymized_at), 'warning');
  END IF;

  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN _changed := _changed || 'full_name'; END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN _changed := _changed || 'email'; END IF;
  IF NEW.country IS DISTINCT FROM OLD.country THEN _changed := _changed || 'country'; END IF;
  IF NEW.city IS DISTINCT FROM OLD.city THEN _changed := _changed || 'city'; END IF;
  IF NEW.mobile_number IS DISTINCT FROM OLD.mobile_number THEN _changed := _changed || 'mobile_number'; END IF;
  IF NEW.school_name IS DISTINCT FROM OLD.school_name THEN _changed := _changed || 'school_name'; END IF;

  IF array_length(_changed, 1) > 0 THEN
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, severity)
    VALUES (NEW.id, 'profile_update', 'account',
            jsonb_build_object('fields', to_jsonb(_changed)), 'info');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _name text;
BEGIN
  _name := NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), '');
  IF _name IS NULL THEN
    _name := NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), '');
  END IF;
  IF _name IS NULL THEN
    _name := NULLIF(btrim(concat_ws(' ',
      NEW.raw_user_meta_data ->> 'given_name',
      NEW.raw_user_meta_data ->> 'family_name')), '');
  END IF;
  IF _name IS NULL THEN
    _name := public.pretty_name_from_email(NEW.email);
  END IF;

  INSERT INTO public.profiles (id, full_name, email, country, city, mobile_number, signup_type, school_name)
  VALUES (
    NEW.id,
    _name,
    NEW.email,
    NEW.raw_user_meta_data ->> 'country',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'mobile_number',
    COALESCE(NEW.raw_user_meta_data ->> 'signup_type', 'standard'),
    NEW.raw_user_meta_data ->> 'school_name'
  );

  IF lower(NEW.email) = 'tinashelvurayai@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;


--
-- Name: is_school_contracted(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_school_contracted(_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contracted_schools
    WHERE normalized_name = lower(btrim(_name))
  );
$$;


--
-- Name: link_school_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_school_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _key text;
  _id uuid;
BEGIN
  _key := lower(btrim(COALESCE(NEW.school_name, '')));
  IF _key = '' THEN
    NEW.school_id := NULL;
    RETURN NEW;
  END IF;
  SELECT id INTO _id FROM public.contracted_schools WHERE normalized_name = _key LIMIT 1;
  NEW.school_id := _id;
  RETURN NEW;
END;
$$;


--
-- Name: log_audit_event(uuid, text, text, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event(_user_id uuid, _event_type text, _event_category text DEFAULT 'security'::text, _event_details jsonb DEFAULT '{}'::jsonb, _ip_address text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text, _severity text DEFAULT 'info'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, ip_address, user_agent, severity)
  VALUES (_user_id, _event_type, _event_category, coalesce(_event_details, '{}'::jsonb), _ip_address, _user_agent, coalesce(_severity, 'info'))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;


--
-- Name: pretty_name_from_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pretty_name_from_email(_email text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT initcap(regexp_replace(split_part(coalesce(_email,''),'@',1), '[._\-]+', ' ', 'g'));
$$;


--
-- Name: purge_expired_retention_archive(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_retention_archive() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _deleted integer;
BEGIN
  WITH gone AS (
    DELETE FROM public.retention_archive WHERE retain_until <= now() RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM gone;
  RETURN _deleted;
END;
$$;


--
-- Name: register_rate_limit_hit(text, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_rate_limit_hit(_bucket_key text, _ip text, _method text, _limit integer, _window_seconds integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count integer;
  _banned timestamptz;
BEGIN
  SELECT banned_until INTO _banned FROM public.ip_reputation WHERE ip_address = _ip;
  IF _banned IS NOT NULL AND _banned > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'banned', 'banned_until', _banned);
  END IF;

  DELETE FROM public.rate_limit_hits WHERE created_at < now() - interval '1 day';
  INSERT INTO public.rate_limit_hits (bucket_key, ip_address, method) VALUES (_bucket_key, _ip, _method);

  SELECT count(*) INTO _count FROM public.rate_limit_hits
  WHERE bucket_key = _bucket_key AND created_at > now() - make_interval(secs => _window_seconds);

  IF _count > _limit THEN
    INSERT INTO public.ip_reputation (ip_address, anomaly_count, banned_until, notes)
    VALUES (_ip, 1, now() + interval '10 minutes', 'rate limit exceeded')
    ON CONFLICT (ip_address) DO UPDATE
      SET anomaly_count = public.ip_reputation.anomaly_count + 1,
          last_seen_at = now(),
          banned_until = CASE
            WHEN public.ip_reputation.anomaly_count + 1 >= 5 THEN now() + interval '24 hours'
            ELSE now() + interval '10 minutes' END,
          notes = 'rate limit exceeded';
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'count', _count);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'count', _count);
END;
$$;


--
-- Name: run_engagement_sweep(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_engagement_sweep() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _nudged integer := 0; _churned integer := 0;
BEGIN
  WITH candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE p.deletion_status = 'active'
      AND p.last_active_at < now() - interval '24 hours'
      AND p.last_active_at > now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_engagement e
        WHERE e.user_id = p.id AND e.nudge_type = 'inactivity_24h'
          AND e.created_at > now() - interval '7 days')
  ), ins AS (
    INSERT INTO public.user_engagement (user_id, nudge_type, channel, message)
    SELECT id, 'inactivity_24h', 'in_app',
           'You have not studied for a day - pick up where you left off and keep your streak alive.'
    FROM candidates RETURNING 1
  )
  SELECT count(*) INTO _nudged FROM ins;

  WITH churn AS (
    UPDATE public.profiles SET engagement_segment = 'churned'
    WHERE deletion_status = 'active'
      AND last_active_at < now() - interval '48 hours'
      AND engagement_segment <> 'churned'
    RETURNING id
  ), logged AS (
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, severity)
    SELECT id, 'engagement_churned', 'engagement', '{"window":"48h"}'::jsonb, 'info' FROM churn
    RETURNING 1
  )
  SELECT count(*) INTO _churned FROM logged;

  RETURN jsonb_build_object('nudged', _nudged, 'churned', _churned);
END;
$$;


--
-- Name: school_for_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.school_for_admin(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT normalized_school FROM public.school_admins WHERE user_id = _user_id LIMIT 1;
$$;


--
-- Name: school_id_for_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.school_id_for_admin(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT school_id FROM public.school_admins WHERE user_id = _user_id LIMIT 1;
$$;


--
-- Name: session_risk_score(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_risk_score(_user_id uuid, _session_id text DEFAULT NULL::text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(points), 0)::int
  FROM public.session_anomalies
  WHERE user_id = _user_id
    AND resolved = false
    AND created_at > now() - interval '30 minutes'
    AND (_session_id IS NULL OR session_id IS NULL OR session_id = _session_id);
$$;


--
-- Name: set_partnership_program_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_partnership_program_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$ begin new.updated_at = now(); return new; end; $$;


--
-- Name: touch_last_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_last_active() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.profiles
  SET last_active_at = now(),
      engagement_segment = CASE WHEN engagement_segment = 'churned' THEN 'reactivated' ELSE engagement_segment END
  WHERE id = auth.uid();
$$;


--
-- Name: touch_last_password_change(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_last_password_change(_user_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _now timestamptz := now();
BEGIN
  UPDATE public.profiles SET last_password_change = _now WHERE id = _user_id;
  RETURN _now;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alt_payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alt_payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    student_name text,
    email text,
    course_id text NOT NULL,
    course_name text NOT NULL,
    level text NOT NULL,
    amount numeric NOT NULL,
    methods text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    received_at timestamp with time zone,
    received_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alt_payment_requests_level_check CHECK ((level = ANY (ARRAY['certificate'::text, 'diploma'::text]))),
    CONSTRAINT alt_payment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'received'::text, 'cancelled'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    event_category text DEFAULT 'security'::text NOT NULL,
    event_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    severity text DEFAULT 'info'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: certificate_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    student_name text,
    email text,
    course_id text NOT NULL,
    course_name text,
    certificate_type text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    paypal_order_id text,
    certificate_id text,
    payment_status text DEFAULT 'paid_pending_admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'paypal'::text NOT NULL,
    school_name text,
    class_name text,
    CONSTRAINT certificate_payments_certificate_type_check CHECK ((certificate_type = ANY (ARRAY['certificate'::text, 'diploma'::text])))
);


--
-- Name: contracted_schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracted_schools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    normalized_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    seat_limit integer,
    notes text,
    logo_url text
);


--
-- Name: course_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id text NOT NULL,
    level text NOT NULL,
    completed_modules integer[] DEFAULT '{}'::integer[] NOT NULL,
    quiz_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_progress_level_check CHECK ((level = ANY (ARRAY['certificate'::text, 'diploma'::text])))
);


--
-- Name: enrollment_certificate_ids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollment_certificate_ids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id text NOT NULL,
    level text NOT NULL,
    student_name text,
    course_title text,
    certificate_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id text NOT NULL,
    level text NOT NULL,
    course_title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enrollments_level_check CHECK ((level = ANY (ARRAY['certificate'::text, 'diploma'::text])))
);


--
-- Name: ip_reputation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_reputation (
    ip_address text NOT NULL,
    anomaly_count integer DEFAULT 0 NOT NULL,
    failed_logins integer DEFAULT 0 NOT NULL,
    banned_until timestamp with time zone,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partnership_program_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partnership_program_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_name text NOT NULL,
    email text NOT NULL,
    phone text,
    organization_name text NOT NULL,
    organization_type text NOT NULL,
    website text,
    program_title text NOT NULL,
    program_description text NOT NULL,
    audience text NOT NULL,
    expected_reach text,
    message text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partnership_program_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'contacted'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    country text,
    city text,
    mobile_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    signup_type text DEFAULT 'standard'::text NOT NULL,
    school_name text,
    last_password_change timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    anonymized_at timestamp with time zone,
    deletion_status text DEFAULT 'active'::text NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    engagement_segment text DEFAULT 'active'::text NOT NULL,
    school_id uuid,
    normalized_school text GENERATED ALWAYS AS (lower(btrim(school_name))) STORED,
    class_name text,
    CONSTRAINT profiles_deletion_status_check CHECK ((deletion_status = ANY (ARRAY['active'::text, 'pending_deletion'::text, 'anonymized'::text, 'retained'::text])))
);


--
-- Name: rate_limit_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_hits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_key text NOT NULL,
    ip_address text NOT NULL,
    method text DEFAULT 'GET'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: retention_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retention_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_user_id uuid NOT NULL,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    retain_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: school_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_admins (
    user_id uuid NOT NULL,
    school_name text NOT NULL,
    normalized_school text GENERATED ALWAYS AS (lower(btrim(school_name))) STORED,
    contact_name text,
    contact_phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    school_id uuid
);


--
-- Name: school_rosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_rosters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_admin_id uuid NOT NULL,
    school_name text NOT NULL,
    normalized_school text GENERATED ALWAYS AS (lower(btrim(school_name))) STORED,
    full_name text NOT NULL,
    normalized_name text GENERATED ALWAYS AS (lower(btrim(full_name))) STORED,
    class_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid
);


--
-- Name: session_anomalies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_anomalies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id text,
    anomaly_type text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    severity text DEFAULT 'low'::text NOT NULL,
    points integer DEFAULT 5 NOT NULL,
    ip_address text,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: special_program_diplomas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_program_diplomas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id text NOT NULL,
    issued boolean DEFAULT false NOT NULL,
    issued_at timestamp with time zone,
    issued_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_engagement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_engagement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nudge_type text NOT NULL,
    channel text DEFAULT 'in_app'::text NOT NULL,
    message text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ux_failures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ux_failures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    failure_type text DEFAULT 'rage_click'::text NOT NULL,
    route text,
    element_label text,
    click_count integer DEFAULT 0 NOT NULL,
    replay_url text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alt_payment_requests alt_payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alt_payment_requests
    ADD CONSTRAINT alt_payment_requests_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: certificate_payments certificate_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_payments
    ADD CONSTRAINT certificate_payments_pkey PRIMARY KEY (id);


--
-- Name: contracted_schools contracted_schools_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracted_schools
    ADD CONSTRAINT contracted_schools_normalized_name_key UNIQUE (normalized_name);


--
-- Name: contracted_schools contracted_schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracted_schools
    ADD CONSTRAINT contracted_schools_pkey PRIMARY KEY (id);


--
-- Name: course_progress course_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_pkey PRIMARY KEY (id);


--
-- Name: course_progress course_progress_user_id_course_id_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_user_id_course_id_level_key UNIQUE (user_id, course_id, level);


--
-- Name: enrollment_certificate_ids enrollment_certificate_ids_certificate_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_certificate_ids
    ADD CONSTRAINT enrollment_certificate_ids_certificate_id_key UNIQUE (certificate_id);


--
-- Name: enrollment_certificate_ids enrollment_certificate_ids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_certificate_ids
    ADD CONSTRAINT enrollment_certificate_ids_pkey PRIMARY KEY (id);


--
-- Name: enrollment_certificate_ids enrollment_certificate_ids_user_id_course_id_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_certificate_ids
    ADD CONSTRAINT enrollment_certificate_ids_user_id_course_id_level_key UNIQUE (user_id, course_id, level);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_user_id_course_id_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_user_id_course_id_level_key UNIQUE (user_id, course_id, level);


--
-- Name: ip_reputation ip_reputation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_reputation
    ADD CONSTRAINT ip_reputation_pkey PRIMARY KEY (ip_address);


--
-- Name: notification_log notification_log_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_event_key_key UNIQUE (event_key);


--
-- Name: notification_log notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_log
    ADD CONSTRAINT notification_log_pkey PRIMARY KEY (id);


--
-- Name: partnership_program_requests partnership_program_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partnership_program_requests
    ADD CONSTRAINT partnership_program_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_hits rate_limit_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_hits
    ADD CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (id);


--
-- Name: retention_archive retention_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_archive
    ADD CONSTRAINT retention_archive_pkey PRIMARY KEY (id);


--
-- Name: school_admins school_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_admins
    ADD CONSTRAINT school_admins_pkey PRIMARY KEY (user_id);


--
-- Name: school_rosters school_rosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_rosters
    ADD CONSTRAINT school_rosters_pkey PRIMARY KEY (id);


--
-- Name: session_anomalies session_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_anomalies
    ADD CONSTRAINT session_anomalies_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- Name: special_program_diplomas special_program_diplomas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_program_diplomas
    ADD CONSTRAINT special_program_diplomas_pkey PRIMARY KEY (id);


--
-- Name: special_program_diplomas special_program_diplomas_user_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_program_diplomas
    ADD CONSTRAINT special_program_diplomas_user_id_course_id_key UNIQUE (user_id, course_id);


--
-- Name: user_engagement user_engagement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_engagement
    ADD CONSTRAINT user_engagement_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: ux_failures ux_failures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ux_failures
    ADD CONSTRAINT ux_failures_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_event_type_idx ON public.audit_logs USING btree (event_type, created_at DESC);


--
-- Name: audit_logs_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_user_created_idx ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_alt_pay_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alt_pay_status ON public.alt_payment_requests USING btree (status, created_at DESC);


--
-- Name: idx_alt_payment_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alt_payment_requests_status ON public.alt_payment_requests USING btree (status);


--
-- Name: idx_alt_payment_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alt_payment_requests_user ON public.alt_payment_requests USING btree (user_id);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_cert_payments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_payments_created ON public.certificate_payments USING btree (created_at DESC);


--
-- Name: idx_cert_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_payments_status ON public.certificate_payments USING btree (payment_status);


--
-- Name: idx_cert_payments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cert_payments_user ON public.certificate_payments USING btree (user_id);


--
-- Name: idx_course_progress_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_progress_updated ON public.course_progress USING btree (updated_at DESC);


--
-- Name: idx_course_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_progress_user ON public.course_progress USING btree (user_id);


--
-- Name: idx_enrollment_cert_ids_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollment_cert_ids_user ON public.enrollment_certificate_ids USING btree (user_id);


--
-- Name: idx_enrollments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_user ON public.enrollments USING btree (user_id);


--
-- Name: idx_profiles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_created_at ON public.profiles USING btree (created_at DESC);


--
-- Name: idx_profiles_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email_lower ON public.profiles USING btree (lower(email));


--
-- Name: idx_profiles_last_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_last_active ON public.profiles USING btree (last_active_at DESC);


--
-- Name: idx_profiles_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_name_lower ON public.profiles USING btree (lower(full_name));


--
-- Name: idx_profiles_normalized_school; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_normalized_school ON public.profiles USING btree (normalized_school);


--
-- Name: idx_profiles_school_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_school_id ON public.profiles USING btree (school_id);


--
-- Name: idx_rate_limit_bucket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_bucket ON public.rate_limit_hits USING btree (bucket_key, created_at DESC);


--
-- Name: idx_school_admins_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_admins_normalized ON public.school_admins USING btree (normalized_school);


--
-- Name: idx_school_rosters_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_rosters_admin ON public.school_rosters USING btree (school_admin_id);


--
-- Name: idx_school_rosters_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_rosters_match ON public.school_rosters USING btree (normalized_school, normalized_name);


--
-- Name: idx_school_rosters_school; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_school_rosters_school ON public.school_rosters USING btree (school_id);


--
-- Name: idx_session_anomalies_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_anomalies_user ON public.session_anomalies USING btree (user_id, created_at DESC);


--
-- Name: idx_user_engagement_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_engagement_user ON public.user_engagement USING btree (user_id, created_at DESC);


--
-- Name: partnership_program_requests_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partnership_program_requests_created_at_idx ON public.partnership_program_requests USING btree (created_at DESC);


--
-- Name: partnership_program_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partnership_program_requests_status_idx ON public.partnership_program_requests USING btree (status);


--
-- Name: rate_limit_hits_bucket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limit_hits_bucket_idx ON public.rate_limit_hits USING btree (bucket_key, created_at DESC);


--
-- Name: retention_archive_retain_until_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retention_archive_retain_until_idx ON public.retention_archive USING btree (retain_until);


--
-- Name: session_anomalies_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_anomalies_user_idx ON public.session_anomalies USING btree (user_id, created_at DESC);


--
-- Name: user_engagement_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_engagement_user_idx ON public.user_engagement USING btree (user_id, created_at DESC);


--
-- Name: alt_payment_requests alt_payment_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER alt_payment_requests_updated_at BEFORE UPDATE ON public.alt_payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles audit_profiles_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_profiles_changes AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();


--
-- Name: contracted_schools contracted_schools_adopt_rows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contracted_schools_adopt_rows AFTER INSERT ON public.contracted_schools FOR EACH ROW EXECUTE FUNCTION public.adopt_rows_for_school();


--
-- Name: enrollments enrollments_allocate_certificate_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enrollments_allocate_certificate_id AFTER INSERT ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.allocate_enrollment_certificate_id();


--
-- Name: partnership_program_requests partnership_program_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partnership_program_requests_updated_at BEFORE UPDATE ON public.partnership_program_requests FOR EACH ROW EXECUTE FUNCTION public.set_partnership_program_requests_updated_at();


--
-- Name: profiles profiles_link_school_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_link_school_id BEFORE INSERT OR UPDATE OF school_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.link_school_id();


--
-- Name: school_admins school_admins_link_school_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER school_admins_link_school_id BEFORE INSERT OR UPDATE OF school_name ON public.school_admins FOR EACH ROW EXECUTE FUNCTION public.link_school_id();


--
-- Name: school_rosters school_rosters_link_school_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER school_rosters_link_school_id BEFORE INSERT OR UPDATE OF school_name ON public.school_rosters FOR EACH ROW EXECUTE FUNCTION public.link_school_id();


--
-- Name: certificate_payments update_certificate_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_certificate_payments_updated_at BEFORE UPDATE ON public.certificate_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: course_progress update_course_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_course_progress_updated_at BEFORE UPDATE ON public.course_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ip_reputation update_ip_reputation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ip_reputation_updated_at BEFORE UPDATE ON public.ip_reputation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: retention_archive update_retention_archive_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_retention_archive_updated_at BEFORE UPDATE ON public.retention_archive FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: special_program_diplomas update_special_program_diplomas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_special_program_diplomas_updated_at BEFORE UPDATE ON public.special_program_diplomas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: alt_payment_requests alt_payment_requests_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alt_payment_requests
    ADD CONSTRAINT alt_payment_requests_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id);


--
-- Name: alt_payment_requests alt_payment_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alt_payment_requests
    ADD CONSTRAINT alt_payment_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certificate_payments certificate_payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_payments
    ADD CONSTRAINT certificate_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contracted_schools contracted_schools_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracted_schools
    ADD CONSTRAINT contracted_schools_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: course_progress course_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: enrollment_certificate_ids enrollment_certificate_ids_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_certificate_ids
    ADD CONSTRAINT enrollment_certificate_ids_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.contracted_schools(id) ON DELETE SET NULL;


--
-- Name: school_admins school_admins_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_admins
    ADD CONSTRAINT school_admins_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: school_admins school_admins_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_admins
    ADD CONSTRAINT school_admins_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.contracted_schools(id) ON DELETE SET NULL;


--
-- Name: school_admins school_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_admins
    ADD CONSTRAINT school_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: school_rosters school_rosters_school_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_rosters
    ADD CONSTRAINT school_rosters_school_admin_id_fkey FOREIGN KEY (school_admin_id) REFERENCES public.school_admins(user_id) ON DELETE CASCADE;


--
-- Name: school_rosters school_rosters_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_rosters
    ADD CONSTRAINT school_rosters_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.contracted_schools(id) ON DELETE SET NULL;


--
-- Name: session_anomalies session_anomalies_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_anomalies
    ADD CONSTRAINT session_anomalies_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: session_anomalies session_anomalies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_anomalies
    ADD CONSTRAINT session_anomalies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: site_settings site_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: special_program_diplomas special_program_diplomas_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_program_diplomas
    ADD CONSTRAINT special_program_diplomas_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES auth.users(id);


--
-- Name: special_program_diplomas special_program_diplomas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_program_diplomas
    ADD CONSTRAINT special_program_diplomas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_engagement user_engagement_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_engagement
    ADD CONSTRAINT user_engagement_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ux_failures ux_failures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ux_failures
    ADD CONSTRAINT ux_failures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certificate_payments Admins can delete payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete payments" ON public.certificate_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contracted_schools Admins can manage contracted schools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage contracted schools" ON public.contracted_schools TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: school_admins Admins can manage school admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage school admins" ON public.school_admins TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: session_anomalies Admins can resolve anomalies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can resolve anomalies" ON public.session_anomalies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: certificate_payments Admins can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update payments" ON public.certificate_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: school_admins Admins can view all school admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all school admins" ON public.school_admins FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: session_anomalies Admins can view anomalies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view anomalies" ON public.session_anomalies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ip_reputation Admins can view ip reputation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view ip reputation" ON public.ip_reputation FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: rate_limit_hits Admins can view rate limit hits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view rate limit hits" ON public.rate_limit_hits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: retention_archive Admins can view the retention archive; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view the retention archive" ON public.retention_archive FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ux_failures Admins can view ux failures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view ux failures" ON public.ux_failures FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: site_settings Admins can write site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can write site settings" ON public.site_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: special_program_diplomas Admins manage special programme diplomas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage special programme diplomas" ON public.special_program_diplomas TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: partnership_program_requests Anyone can submit partnership requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit partnership requests" ON public.partnership_program_requests FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: contracted_schools Authenticated users can view contracted schools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view contracted schools" ON public.contracted_schools FOR SELECT TO authenticated USING (true);


--
-- Name: school_rosters Edusanna admins can view rosters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Edusanna admins can view rosters" ON public.school_rosters FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: school_admins School admins can view their own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "School admins can view their own record" ON public.school_admins FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: certificate_payments School admins can view their school's payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "School admins can view their school's payments" ON public.certificate_payments FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'school_admin'::public.app_role) AND (lower(btrim(COALESCE(school_name, ''::text))) = public.school_for_admin(auth.uid())) AND (public.school_for_admin(auth.uid()) IS NOT NULL) AND (public.school_for_admin(auth.uid()) <> ''::text)));


--
-- Name: profiles School admins can view their school's profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "School admins can view their school's profiles" ON public.profiles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'school_admin'::public.app_role) AND (lower(btrim(COALESCE(school_name, ''::text))) = public.school_for_admin(auth.uid())) AND (public.school_for_admin(auth.uid()) IS NOT NULL) AND (public.school_for_admin(auth.uid()) <> ''::text)));


--
-- Name: school_rosters School admins manage their own roster; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "School admins manage their own roster" ON public.school_rosters TO authenticated USING ((auth.uid() = school_admin_id)) WITH CHECK ((auth.uid() = school_admin_id));


--
-- Name: site_settings Site settings are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Site settings are publicly readable" ON public.site_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_engagement Users can mark their nudges read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark their nudges read" ON public.user_engagement FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: audit_logs Users can view their own audit trail; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own audit trail" ON public.audit_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_engagement Users can view their own nudges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own nudges" ON public.user_engagement FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: certificate_payments Users can view their own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own payments" ON public.certificate_payments FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: enrollments Users manage their own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own enrollments" ON public.enrollments USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: course_progress Users manage their own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own progress" ON public.course_progress USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: alt_payment_requests admin update alt payment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin update alt payment" ON public.alt_payment_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: alt_payment_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alt_payment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: certificate_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificate_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: contracted_schools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracted_schools ENABLE ROW LEVEL SECURITY;

--
-- Name: course_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollment_certificate_ids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollment_certificate_ids ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: ip_reputation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_reputation ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

--
-- Name: partnership_program_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partnership_program_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_hits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

--
-- Name: retention_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retention_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: school_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: school_rosters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_rosters ENABLE ROW LEVEL SECURITY;

--
-- Name: session_anomalies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_anomalies ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: special_program_diplomas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.special_program_diplomas ENABLE ROW LEVEL SECURITY;

--
-- Name: user_engagement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: alt_payment_requests users insert own alt payment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own alt payment" ON public.alt_payment_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: alt_payment_requests users view own alt payment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own alt payment" ON public.alt_payment_requests FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: ux_failures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ux_failures ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


