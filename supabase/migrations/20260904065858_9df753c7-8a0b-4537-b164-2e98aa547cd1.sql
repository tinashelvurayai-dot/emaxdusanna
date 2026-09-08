ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_name text;
ALTER TABLE public.contracted_schools ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO public.profiles (id, full_name, email, country, mobile_number, signup_type, school_name, class_name)
SELECT u.id,
       COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), split_part(u.email, '@', 1)),
       u.email,
       NULLIF(u.raw_user_meta_data->>'country',''),
       NULLIF(u.raw_user_meta_data->>'mobile_number',''),
       COALESCE(NULLIF(u.raw_user_meta_data->>'signup_type',''), 'standard'),
       NULLIF(u.raw_user_meta_data->>'school_name',''),
       NULLIF(u.raw_user_meta_data->>'class_name','')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

GRANT EXECUTE ON FUNCTION public.school_for_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_id_for_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;