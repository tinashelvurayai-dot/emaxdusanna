-- 1. Audit logs
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_category text NOT NULL DEFAULT 'security',
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own audit trail" ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX audit_logs_user_created_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_event_type_idx ON public.audit_logs (event_type, created_at DESC);

-- Server-side helper so backend code can write audit rows
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _user_id uuid,
  _event_type text,
  _event_category text DEFAULT 'security',
  _event_details jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _severity text DEFAULT 'info'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, ip_address, user_agent, severity)
  VALUES (_user_id, _event_type, _event_category, coalesce(_event_details, '{}'::jsonb), _ip_address, _user_agent, coalesce(_severity, 'info'))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.log_audit_event(uuid, text, text, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, jsonb, text, text, text) TO service_role;

-- 2. Trigger: log profile updates, password changes and deletion state changes
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
CREATE TRIGGER audit_profiles_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

-- 3. Session anomalies + risk scoring
CREATE TABLE public.session_anomalies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  anomaly_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'low',
  points integer NOT NULL DEFAULT 5,
  ip_address text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.session_anomalies TO authenticated;
GRANT ALL ON public.session_anomalies TO service_role;
ALTER TABLE public.session_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view anomalies" ON public.session_anomalies
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can resolve anomalies" ON public.session_anomalies
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX session_anomalies_user_idx ON public.session_anomalies (user_id, created_at DESC);

-- Rolling risk score over the last 30 minutes of unresolved anomalies
CREATE OR REPLACE FUNCTION public.session_risk_score(_user_id uuid, _session_id text DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::int
  FROM public.session_anomalies
  WHERE user_id = _user_id
    AND resolved = false
    AND created_at > now() - interval '30 minutes'
    AND (_session_id IS NULL OR session_id IS NULL OR session_id = _session_id);
$$;
GRANT EXECUTE ON FUNCTION public.session_risk_score(uuid, text) TO service_role;

-- 4. IP reputation / adaptive rate limiting
CREATE TABLE public.ip_reputation (
  ip_address text NOT NULL PRIMARY KEY,
  anomaly_count integer NOT NULL DEFAULT 0,
  failed_logins integer NOT NULL DEFAULT 0,
  banned_until timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ip_reputation TO authenticated;
GRANT ALL ON public.ip_reputation TO service_role;
ALTER TABLE public.ip_reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view ip reputation" ON public.ip_reputation
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_ip_reputation_updated_at BEFORE UPDATE ON public.ip_reputation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rate_limit_hits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_key text NOT NULL,
  ip_address text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
CREATE INDEX rate_limit_hits_bucket_idx ON public.rate_limit_hits (bucket_key, created_at DESC);

-- Counts a hit and reports whether the caller is over the limit / banned
CREATE OR REPLACE FUNCTION public.register_rate_limit_hit(
  _bucket_key text, _ip text, _method text, _limit integer, _window_seconds integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
GRANT EXECUTE ON FUNCTION public.register_rate_limit_hit(text, text, text, integer, integer) TO service_role;

-- 5. Engagement tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS engagement_segment text NOT NULL DEFAULT 'active';

CREATE TABLE public.user_engagement (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  message text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.user_engagement TO authenticated;
GRANT ALL ON public.user_engagement TO service_role;
ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own nudges" ON public.user_engagement
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can mark their nudges read" ON public.user_engagement
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_engagement_user_idx ON public.user_engagement (user_id, created_at DESC);

CREATE TABLE public.ux_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  failure_type text NOT NULL DEFAULT 'rage_click',
  route text,
  element_label text,
  click_count integer NOT NULL DEFAULT 0,
  replay_url text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ux_failures TO authenticated;
GRANT ALL ON public.ux_failures TO service_role;
ALTER TABLE public.ux_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view ux failures" ON public.ux_failures
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cron worker: nudge users idle 24h, flag churned after 48h
CREATE OR REPLACE FUNCTION public.run_engagement_sweep()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
GRANT EXECUTE ON FUNCTION public.run_engagement_sweep() TO service_role;

-- Heartbeat callable by the signed-in learner
CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET last_active_at = now(),
      engagement_segment = CASE WHEN engagement_segment = 'churned' THEN 'reactivated' ELSE engagement_segment END
  WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;