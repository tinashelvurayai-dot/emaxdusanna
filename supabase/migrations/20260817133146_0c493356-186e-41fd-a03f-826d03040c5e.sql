CREATE OR REPLACE FUNCTION public.allocate_enrollment_certificate_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.enrollment_certificate_ids (user_id, course_id, level, course_title, certificate_id, student_name)
  VALUES (
    NEW.user_id,
    NEW.course_id,
    NEW.level,
    NEW.course_title,
    'EDU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    (SELECT full_name FROM public.profiles WHERE id = NEW.user_id)
  )
  ON CONFLICT (user_id, course_id, level) DO NOTHING;
  RETURN NEW;
END;
$function$;