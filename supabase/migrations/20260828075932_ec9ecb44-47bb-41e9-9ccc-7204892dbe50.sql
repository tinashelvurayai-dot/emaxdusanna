-- 1) Contracted schools gain lifecycle + capacity fields
ALTER TABLE public.contracted_schools
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seat_limit integer,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2) Formal school_id relationships
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.contracted_schools(id) ON DELETE SET NULL;
ALTER TABLE public.school_admins
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.contracted_schools(id) ON DELETE SET NULL;
ALTER TABLE public.school_rosters
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.contracted_schools(id) ON DELETE SET NULL;

-- normalized school on profiles for fast, case-insensitive matching
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS normalized_school text
  GENERATED ALWAYS AS (lower(btrim(school_name))) STORED;

-- 3) Auto-link school_id from the school name
CREATE OR REPLACE FUNCTION public.link_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS profiles_link_school_id ON public.profiles;
CREATE TRIGGER profiles_link_school_id
  BEFORE INSERT OR UPDATE OF school_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_school_id();

DROP TRIGGER IF EXISTS school_admins_link_school_id ON public.school_admins;
CREATE TRIGGER school_admins_link_school_id
  BEFORE INSERT OR UPDATE OF school_name ON public.school_admins
  FOR EACH ROW EXECUTE FUNCTION public.link_school_id();

DROP TRIGGER IF EXISTS school_rosters_link_school_id ON public.school_rosters;
CREATE TRIGGER school_rosters_link_school_id
  BEFORE INSERT OR UPDATE OF school_name ON public.school_rosters
  FOR EACH ROW EXECUTE FUNCTION public.link_school_id();

-- when a school is added to the contracted list, adopt existing rows with that name
CREATE OR REPLACE FUNCTION public.adopt_rows_for_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS contracted_schools_adopt_rows ON public.contracted_schools;
CREATE TRIGGER contracted_schools_adopt_rows
  AFTER INSERT ON public.contracted_schools
  FOR EACH ROW EXECUTE FUNCTION public.adopt_rows_for_school();

-- 4) Backfill existing data
UPDATE public.profiles p SET school_id = cs.id
  FROM public.contracted_schools cs
  WHERE lower(btrim(COALESCE(p.school_name,''))) = cs.normalized_name AND p.school_id IS NULL;
UPDATE public.school_admins sa SET school_id = cs.id
  FROM public.contracted_schools cs
  WHERE sa.normalized_school = cs.normalized_name AND sa.school_id IS NULL;
UPDATE public.school_rosters sr SET school_id = cs.id
  FROM public.contracted_schools cs
  WHERE sr.normalized_school = cs.normalized_name AND sr.school_id IS NULL;

-- 5) Helper for school-scoped access
CREATE OR REPLACE FUNCTION public.school_id_for_admin(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT school_id FROM public.school_admins WHERE user_id = _user_id LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.school_id_for_admin(uuid) FROM PUBLIC, anon;

-- 6) Scaling indexes
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_normalized_school ON public.profiles(normalized_school);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_name_lower ON public.profiles(lower(full_name));
CREATE INDEX IF NOT EXISTS idx_course_progress_user ON public.course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_updated ON public.course_progress(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_payments_user ON public.certificate_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_payments_status ON public.certificate_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_cert_payments_created ON public.certificate_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alt_pay_status ON public.alt_payment_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket ON public.rate_limit_hits(bucket_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_user ON public.session_anomalies(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_engagement_user ON public.user_engagement(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_rosters_school ON public.school_rosters(school_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_cert_ids_user ON public.enrollment_certificate_ids(user_id);