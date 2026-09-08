create table if not exists public.partnership_program_requests (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  email text not null,
  phone text,
  organization_name text not null,
  organization_type text not null,
  website text,
  program_title text not null,
  program_description text not null,
  audience text not null,
  expected_reach text,
  message text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'contacted', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partnership_program_requests_created_at_idx on public.partnership_program_requests (created_at desc);
create index if not exists partnership_program_requests_status_idx on public.partnership_program_requests (status);
alter table public.partnership_program_requests enable row level security;
drop policy if exists "Anyone can submit partnership requests" on public.partnership_program_requests;
create policy "Anyone can submit partnership requests" on public.partnership_program_requests for insert to anon, authenticated with check (true);
-- Reads and status changes are performed through the existing server-side admin client after has_role verification.
revoke all on public.partnership_program_requests from anon, authenticated;
grant insert on public.partnership_program_requests to anon, authenticated;
grant all on public.partnership_program_requests to service_role;


drop trigger if exists partnership_program_requests_updated_at on public.partnership_program_requests;
create or replace function public.set_partnership_program_requests_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger partnership_program_requests_updated_at before update on public.partnership_program_requests for each row execute function public.set_partnership_program_requests_updated_at();