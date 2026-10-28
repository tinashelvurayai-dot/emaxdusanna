CREATE TABLE IF NOT EXISTS public.school_partnership_onboarding (
  school_id uuid PRIMARY KEY REFERENCES public.contracted_schools(id) ON DELETE CASCADE,
  outreach_sent boolean NOT NULL DEFAULT false,
  favorable_feedback boolean NOT NULL DEFAULT false,
  credentials_handed_over boolean NOT NULL DEFAULT false,
  meeting_completed boolean NOT NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false,
  certificate_handed_over boolean NOT NULL DEFAULT false,
  manual_handed_over boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz,
  recorded_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.school_partnership_onboarding TO authenticated;
GRANT ALL ON public.school_partnership_onboarding TO service_role;
ALTER TABLE public.school_partnership_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage school partnership onboarding"
  ON public.school_partnership_onboarding FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.school_partnership_onboarding IS 'Admin-recorded school-head signature and handover checklist, not a digital signature or proof of email delivery.';