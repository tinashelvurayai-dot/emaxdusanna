CREATE TABLE public.special_program_diplomas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  issued boolean NOT NULL DEFAULT false,
  issued_at timestamp with time zone,
  issued_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_program_diplomas TO authenticated;
GRANT ALL ON public.special_program_diplomas TO service_role;

ALTER TABLE public.special_program_diplomas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage special programme diplomas"
ON public.special_program_diplomas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_special_program_diplomas_updated_at
BEFORE UPDATE ON public.special_program_diplomas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();