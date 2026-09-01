-- 1) Lock down EXECUTE on internal helper/trigger functions.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.log_audit_event(uuid, text, text, jsonb, text, text, text)',
    'public.purge_expired_retention_archive()',
    'public.register_rate_limit_hit(text, text, text, integer, integer)',
    'public.run_engagement_sweep()',
    'public.session_risk_score(uuid, text)',
    'public.touch_last_password_change(uuid)',
    'public.is_admin()',
    'public.school_for_admin(uuid)',
    'public.pretty_name_from_email(text)',
    'public.allocate_enrollment_certificate_id()',
    'public.audit_profile_changes()',
    'public.handle_new_user()',
    'public.update_updated_at_column()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- Functions the app legitimately calls as the signed-in user stay callable.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_contracted(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_school_contracted(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_last_active() FROM PUBLIC, anon;

-- 2) Server-only tables: no client privileges, plus explicit deny-all policies
--    so the intent is documented instead of showing up as "RLS with no policies".
REVOKE ALL ON TABLE public.enrollment_certificate_ids FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_log FROM anon, authenticated;
GRANT ALL ON TABLE public.enrollment_certificate_ids TO service_role;
GRANT ALL ON TABLE public.notification_log TO service_role;

DROP POLICY IF EXISTS "No client access" ON public.enrollment_certificate_ids;
CREATE POLICY "No client access" ON public.enrollment_certificate_ids
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client access" ON public.notification_log;
CREATE POLICY "No client access" ON public.notification_log
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);