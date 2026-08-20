ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_password_change timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_deletion_status_check
  CHECK (deletion_status IN ('active', 'pending_deletion', 'anonymized', 'retained'));

CREATE TABLE public.retention_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  retain_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_archive TO authenticated;
GRANT ALL ON public.retention_archive TO service_role;

ALTER TABLE public.retention_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view the retention archive"
  ON public.retention_archive FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_retention_archive_updated_at
  BEFORE UPDATE ON public.retention_archive
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX retention_archive_retain_until_idx ON public.retention_archive (retain_until);

CREATE OR REPLACE FUNCTION public.touch_last_password_change(_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
BEGIN
  UPDATE public.profiles SET last_password_change = _now WHERE id = _user_id;
  RETURN _now;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_expired_retention_archive()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.purge_expired_retention_archive() FROM anon, authenticated;