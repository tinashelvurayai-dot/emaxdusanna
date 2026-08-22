-- Lock down the new backend-only functions
REVOKE ALL ON FUNCTION public.audit_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_rate_limit_hit(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_engagement_sweep() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.session_risk_score(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_rate_limit_hit(text, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_engagement_sweep() TO service_role;
GRANT EXECUTE ON FUNCTION public.session_risk_score(uuid, text) TO service_role;

-- Heartbeat stays callable by signed-in learners only
REVOKE ALL ON FUNCTION public.touch_last_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated, service_role;

-- Pin the search path on the remaining helper
CREATE OR REPLACE FUNCTION public.pretty_name_from_email(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT initcap(regexp_replace(split_part(coalesce(_email,''),'@',1), '[._\-]+', ' ', 'g'));
$$;

-- Rate-limit counters: admin read only, writes remain service-role
CREATE POLICY "Admins can view rate limit hits" ON public.rate_limit_hits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));