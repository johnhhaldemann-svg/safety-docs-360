-- Configurable safety form definitions, versioned schema, and submissions.

create table if not exists public.company_safety_form_definitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_safety_form_definitions_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists company_safety_form_definitions_company_idx
  on public.company_safety_form_definitions(company_id, active, title);

drop trigger if exists set_company_safety_form_definitions_updated_at on public.company_safety_form_definitions;
create trigger set_company_safety_form_definitions_updated_at
before update on public.company_safety_form_definitions
for each row execute function public.set_updated_at();

create table if not exists public.company_safety_form_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  definition_id uuid not null references public.company_safety_form_definitions(id) on delete cascade,
  version int not null,
  schema jsonb not null default '{"fields":[]}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_safety_form_versions_unique unique (definition_id, version)
);

create index if not exists company_safety_form_versions_definition_idx
  on public.company_safety_form_versions(definition_id, version desc);

create table if not exists public.company_safety_form_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  version_id uuid not null references public.company_safety_form_versions(id) on delete restrict,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  status text not null default 'draft',
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_by uuid null references auth.users(id) on delete set null,
  constraint company_safety_form_submissions_status_check check (
    status in ('draft', 'submitted', 'approved')
  )
);

create index if not exists company_safety_form_submissions_scope_idx
  on public.company_safety_form_submissions(company_id, jobsite_id, status, updated_at desc);

drop trigger if exists set_company_safety_form_submissions_updated_at on public.company_safety_form_submissions;
create trigger set_company_safety_form_submissions_updated_at
before update on public.company_safety_form_submissions
for each row execute function public.set_updated_at();

alter table public.company_safety_form_definitions enable row level security;
alter table public.company_safety_form_versions enable row level security;
alter table public.company_safety_form_submissions enable row level security;

grant select, insert, update on public.company_safety_form_definitions to authenticated;
grant select, insert, update on public.company_safety_form_versions to authenticated;
grant select, insert, update on public.company_safety_form_submissions to authenticated;

drop policy if exists "company_safety_form_definitions_select_scope" on public.company_safety_form_definitions;
create policy "company_safety_form_definitions_select_scope"
on public.company_safety_form_definitions for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
);

drop policy if exists "company_safety_form_definitions_insert_scope" on public.company_safety_form_definitions;
create policy "company_safety_form_definitions_insert_scope"
on public.company_safety_form_definitions for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
);

drop policy if exists "company_safety_form_definitions_update_scope" on public.company_safety_form_definitions;
create policy "company_safety_form_definitions_update_scope"
on public.company_safety_form_definitions for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_definitions.company_id)
);

drop policy if exists "company_safety_form_versions_select_scope" on public.company_safety_form_versions;
create policy "company_safety_form_versions_select_scope"
on public.company_safety_form_versions for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_versions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_versions.company_id)
);

drop policy if exists "company_safety_form_versions_insert_scope" on public.company_safety_form_versions;
create policy "company_safety_form_versions_insert_scope"
on public.company_safety_form_versions for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_versions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_versions.company_id)
);

drop policy if exists "company_safety_form_submissions_select_scope" on public.company_safety_form_submissions;
create policy "company_safety_form_submissions_select_scope"
on public.company_safety_form_submissions for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
);

drop policy if exists "company_safety_form_submissions_insert_scope" on public.company_safety_form_submissions;
create policy "company_safety_form_submissions_insert_scope"
on public.company_safety_form_submissions for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
);

drop policy if exists "company_safety_form_submissions_update_scope" on public.company_safety_form_submissions;
create policy "company_safety_form_submissions_update_scope"
on public.company_safety_form_submissions for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_safety_form_submissions.company_id)
);
