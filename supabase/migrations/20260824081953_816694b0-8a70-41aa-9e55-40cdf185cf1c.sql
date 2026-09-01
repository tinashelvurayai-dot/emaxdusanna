CREATE OR REPLACE FUNCTION public.audit_profile_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN _changed := array_append(_changed, 'full_name'::text); END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN _changed := array_append(_changed, 'email'::text); END IF;
  IF NEW.country IS DISTINCT FROM OLD.country THEN _changed := array_append(_changed, 'country'::text); END IF;
  IF NEW.city IS DISTINCT FROM OLD.city THEN _changed := array_append(_changed, 'city'::text); END IF;
  IF NEW.mobile_number IS DISTINCT FROM OLD.mobile_number THEN _changed := array_append(_changed, 'mobile_number'::text); END IF;
  IF NEW.school_name IS DISTINCT FROM OLD.school_name THEN _changed := array_append(_changed, 'school_name'::text); END IF;

  IF array_length(_changed, 1) > 0 THEN
    INSERT INTO public.audit_logs (user_id, event_type, event_category, event_details, severity)
    VALUES (NEW.id, 'profile_update', 'account',
            jsonb_build_object('fields', to_jsonb(_changed)), 'info');
  END IF;

  RETURN NEW;
END;
$function$;