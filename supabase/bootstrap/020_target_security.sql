-- Fresh external target only: do not replay historical migrations over this baseline.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments, public.course_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alt_payment_requests TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.certificate_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracted_schools, public.school_admins, public.school_rosters, public.site_settings, public.special_program_diplomas, public.user_roles TO authenticated;
GRANT SELECT ON public.audit_logs, public.ip_reputation, public.rate_limit_hits, public.retention_archive, public.ux_failures TO authenticated;
GRANT SELECT, UPDATE ON public.session_anomalies, public.user_engagement TO authenticated;
GRANT INSERT ON public.partnership_program_requests TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role), public.is_admin(), public.school_for_admin(uuid), public.school_id_for_admin(uuid), public.touch_last_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_contracted(text) TO anon, authenticated;

-- Prevent self-updates from bypassing session invalidation or account deletion.
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, country, city, mobile_number, school_name, class_name) ON public.profiles TO authenticated;

ALTER TABLE public.contracted_schools
  ADD COLUMN IF NOT EXISTS school_name text GENERATED ALWAYS AS (name) STORED,
  ADD COLUMN IF NOT EXISTS school_code text,
  ADD COLUMN IF NOT EXISTS onboarding_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_updated_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS contracted_schools_school_code_key ON public.contracted_schools(school_code);
CREATE OR REPLACE FUNCTION public.assign_contracted_school_code() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.school_code IS NULL THEN NEW.school_code := 'CS' || upper(substr(replace(NEW.id::text, '-', ''), 1, 12)); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER contracted_schools_assign_code BEFORE INSERT ON public.contracted_schools
FOR EACH ROW EXECUTE FUNCTION public.assign_contracted_school_code();

-- RLS deliberately leaves credentials, enrollment IDs and notification deduplication
-- inaccessible to browser clients; privileged server functions own these records.