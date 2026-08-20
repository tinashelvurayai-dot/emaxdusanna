REVOKE ALL ON FUNCTION public.touch_last_password_change(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.purge_expired_retention_archive() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.touch_last_password_change(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_retention_archive() TO service_role;