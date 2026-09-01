CREATE OR REPLACE FUNCTION public.system_capacity_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'users_active', (SELECT count(*) FROM public.profiles WHERE deletion_status = 'active'),
    'mau', (SELECT count(*) FROM public.profiles WHERE last_active_at > now() - interval '30 days'),
    'dau', (SELECT count(*) FROM public.profiles WHERE last_active_at > now() - interval '24 hours'),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'enrollments', (SELECT count(*) FROM public.enrollments),
    'progress_rows', (SELECT count(*) FROM public.course_progress),
    'payments', (SELECT count(*) FROM public.certificate_payments),
    'alt_payments_pending', (SELECT count(*) FROM public.alt_payment_requests WHERE status <> 'received'),
    'audit_logs', (SELECT count(*) FROM public.audit_logs),
    'audit_logs_24h', (SELECT count(*) FROM public.audit_logs WHERE created_at > now() - interval '24 hours'),
    'rate_limit_hits_24h', (SELECT count(*) FROM public.rate_limit_hits WHERE created_at > now() - interval '24 hours'),
    'anomalies_open', (SELECT count(*) FROM public.session_anomalies WHERE resolved = false),
    'banned_ips', (SELECT count(*) FROM public.ip_reputation WHERE banned_until > now()),
    'schools', (SELECT count(*) FROM public.contracted_schools),
    'school_admins', (SELECT count(*) FROM public.school_admins),
    'roster_rows', (SELECT count(*) FROM public.school_rosters),
    'churned', (SELECT count(*) FROM public.profiles WHERE engagement_segment = 'churned'),
    'db_bytes', (SELECT pg_database_size(current_database())),
    'largest_tables', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT c.relname AS table_name, pg_total_relation_size(c.oid) AS bytes
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 8
      ) t
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.system_capacity_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_capacity_snapshot() TO service_role;