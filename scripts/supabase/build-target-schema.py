"""Build a fresh-target candidate without changing the source backend.

No secrets or database connection are read by this script.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / "supabase/bootstrap/000_current_public_schema.sql").read_text()
# Discard Cloud ACL/default-privilege sections, not application DDL or policies.
source = source[:source.index("-- Name: SCHEMA public; Type: ACL")]
source = source.replace("CREATE SCHEMA public;", "CREATE SCHEMA IF NOT EXISTS public;")
source = re.sub(r"^SET transaction_timeout = 0;\n", "", source, flags=re.M)
# Only profiles and role membership reference managed Auth directly.
source = re.sub(r"ALTER TABLE ONLY public\.(?!profiles\b|user_roles\b)[\s\S]*?;", lambda m: "" if "REFERENCES auth.users" in m.group() else m.group(), source)
# Do not automatically promote users using an email address supplied at signup.
source = re.sub(r"\n  IF lower\(NEW.email\).*?\n  END IF;", "", source, flags=re.S)
# Trigger is enabled after importing users/data, not during transfer.
source = source.replace("    NEW.raw_user_meta_data ->> 'school_name'\n  );", "    NEW.raw_user_meta_data ->> 'school_name'\n  ) ON CONFLICT (id) DO NOTHING;")
tables = re.findall(r"CREATE TABLE public\.(\w+) \(", source)
# Lock every table immediately; later least-privilege grants authorize access.
source = re.sub(r"(CREATE TABLE public\.(\w+) \([\s\S]*?\n\);)", lambda m: m.group(1) + f"\nGRANT ALL ON public.{m.group(2)} TO service_role;\nALTER TABLE public.{m.group(2)} ENABLE ROW LEVEL SECURITY;", source)
source += "\n" + (ROOT / "supabase/bootstrap/020_target_security.sql").read_text()
source += "\n" + (ROOT / "supabase/bootstrap/030_school_partnership_onboarding.sql").read_text()
target = ROOT / "supabase/target/000_fresh_schema.sql"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text("-- GENERATED CANDIDATE: fresh empty target only. Rehearsal required.\n" + source)
print(f"Prepared candidate schema for {len(tables)} existing tables plus school partnership tracking.")