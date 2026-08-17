-- Restore Data API privileges (RLS policies still control row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_progress TO authenticated;
GRANT ALL ON public.course_progress TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.certificate_payments TO authenticated;
GRANT DELETE ON public.certificate_payments TO authenticated;
GRANT ALL ON public.certificate_payments TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.alt_payment_requests TO authenticated;
GRANT ALL ON public.alt_payment_requests TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracted_schools TO authenticated;
GRANT ALL ON public.contracted_schools TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_admins TO authenticated;
GRANT ALL ON public.school_admins TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_rosters TO authenticated;
GRANT ALL ON public.school_rosters TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

GRANT ALL ON public.enrollment_certificate_ids TO service_role;
GRANT ALL ON public.notification_log TO service_role;