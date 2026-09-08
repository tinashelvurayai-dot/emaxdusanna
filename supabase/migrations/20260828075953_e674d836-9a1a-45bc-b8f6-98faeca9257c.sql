REVOKE EXECUTE ON FUNCTION public.link_school_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adopt_rows_for_school() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.school_id_for_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_id_for_admin(uuid) TO service_role;