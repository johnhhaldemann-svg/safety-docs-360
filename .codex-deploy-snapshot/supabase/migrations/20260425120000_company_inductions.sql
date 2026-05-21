-- Induction programs, per-jobsite (or company-wide) requirements, and completions for site access gating.

create table if not exists public.company_induction_programs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text null,
  audience text not null default 'worker',
  required_docs jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint company_induction_programs_audience_check check (
    audience in ('worker', 'visitor', 'subcontractor')
  ),
  constraint company_induction_programs_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists company_induction_programs_company_active_idx
  on public.company_induction_programs(company_id, active, name);

drop trigger if exists set_company_induction_programs_updated_at on public.company_induction_programs;
create trigger set_company_induction_programs_updated_at
before update on public.company_induction_programs
for each row execute function public.set_updated_at();

create table if not exists public.company_induction_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  program_id uuid not null references public.company_induction_programs(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete cascade,
  active boolean not null default true,
  effective_from date not null default (current_date),
  effective_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists company_induction_requirements_lookup_idx
  on public.company_induction_requirements(company_id, active, jobsite_id, program_id);

drop trigger if exists set_company_induction_requirements_updated_at on public.company_induction_requirements;
create trigger set_company_induction_requirements_updated_at
before update on public.company_induction_requirements
for each row execute function public.set_updated_at();

create table if not exists public.company_induction_completions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  program_id uuid not null references public.company_induction_programs(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  visitor_display_name text null,
  completed_at timestamptz not null default now(),
  expires_at timestamptz null,
  evidence_path text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_by uuid null references auth.users(id) on delete set null,
  constraint company_induction_completions_subject_check check (
    (user_id is not null) or (visitor_display_name is not null and length(trim(visitor_display_name)) > 0)
  )
);

create index if not exists company_induction_completions_user_idx
  on public.company_induction_completions(company_id, user_id, program_id, jobsite_id);
create index if not exists company_induction_completions_expires_idx
  on public.company_induction_completions(company_id, expires_at);

drop trigger if exists set_company_induction_completions_updated_at on public.company_induction_completions;
create trigger set_company_induction_completions_updated_at
before update on public.company_induction_completions
for each row execute function public.set_updated_at();

alter table public.company_induction_programs enable row level security;
alter table public.company_induction_requirements enable row level security;
alter table public.company_induction_completions enable row level security;

grant select, insert, update on public.company_induction_programs to authenticated;
grant select, insert, update on public.company_induction_requirements to authenticated;
grant select, insert, update on public.company_induction_completions to authenticated;

drop policy if exists "company_induction_programs_select_scope" on public.company_induction_programs;
create policy "company_induction_programs_select_scope"
on public.company_induction_programs for select to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
);

drop policy if exists "company_induction_programs_insert_scope" on public.company_induction_programs;
create policy "company_induction_programs_insert_scope"
on public.company_induction_programs for insert to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
);

drop policy if exists "company_induction_programs_update_scope" on public.company_induction_programs;
create policy "company_induction_programs_update_scope"
on public.company_induction_programs for update to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_programs.company_id
  )
);

drop policy if exists "company_induction_requirements_select_scope" on public.company_induction_requirements;
create policy "company_induction_requirements_select_scope"
on public.company_induction_requirements for select to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
);

drop policy if exists "company_induction_requirements_insert_scope" on public.company_induction_requirements;
create policy "company_induction_requirements_insert_scope"
on public.company_induction_requirements for insert to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
);

drop policy if exists "company_induction_requirements_update_scope" on public.company_induction_requirements;
create policy "company_induction_requirements_update_scope"
on public.company_induction_requirements for update to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_requirements.company_id
  )
);

drop policy if exists "company_induction_completions_select_scope" on public.company_induction_completions;
create policy "company_induction_completions_select_scope"
on public.company_induction_completions for select to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
);

drop policy if exists "company_induction_completions_insert_scope" on public.company_induction_completions;
create policy "company_induction_completions_insert_scope"
on public.company_induction_completions for insert to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
);

drop policy if exists "company_induction_completions_update_scope" on public.company_induction_completions;
create policy "company_induction_completions_update_scope"
on public.company_induction_completions for update to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_induction_completions.company_id
  )
);
