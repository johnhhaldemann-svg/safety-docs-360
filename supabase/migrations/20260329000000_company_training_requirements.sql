-- Company-scoped training requirement definitions (keyword match against user_profiles in app layer).
create table if not exists public.company_training_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  match_keywords text[] not null default '{}',
  match_fields text[] not null default array['certifications']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists company_training_requirements_company_id_idx
  on public.company_training_requirements (company_id);

create index if not exists company_training_requirements_company_sort_idx
  on public.company_training_requirements (company_id, sort_order);

alter table public.company_training_requirements enable row level security;

-- Active company members can read requirements for their company.
drop policy if exists "company_training_requirements_select_member" on public.company_training_requirements;
create policy "company_training_requirements_select_member"
on public.company_training_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships m
    where m.company_id = company_training_requirements.company_id
      and m.user_id = auth.uid()
      and coalesce(m.status, '') = 'active'
  )
  or public.is_admin_role()
);

-- Company admins, operations managers, and safety managers can manage requirements.
drop policy if exists "company_training_requirements_insert_lead" on public.company_training_requirements;
create policy "company_training_requirements_insert_lead"
on public.company_training_requirements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_memberships m
    where m.company_id = company_training_requirements.company_id
      and m.user_id = auth.uid()
      and coalesce(m.status, '') = 'active'
      and coalesce(m.role, '') in (
        'company_admin',
        'manager',
        'safety_manager'
      )
  )
  or public.is_admin_role()
);

drop policy if exists "company_training_requirements_update_lead" on public.company_training_requirements;
create policy "company_training_requirements_update_lead"
on public.company_training_requirements
for update
to authenticated
using (
  exists (
    select 1
    from public.company_memberships m
    where m.company_id = company_training_requirements.company_id
      and m.user_id = auth.uid()
      and coalesce(m.status, '') = 'active'
      and coalesce(m.role, '') in (
        'company_admin',
        'manager',
        'safety_manager'
      )
  )
  or public.is_admin_role()
)
with check (
  exists (
    select 1
    from public.company_memberships m
    where m.company_id = company_training_requirements.company_id
      and m.user_id = auth.uid()
      and coalesce(m.status, '') = 'active'
      and coalesce(m.role, '') in (
        'company_admin',
        'manager',
        'safety_manager'
      )
  )
  or public.is_admin_role()
);

drop policy if exists "company_training_requirements_delete_lead" on public.company_training_requirements;
create policy "company_training_requirements_delete_lead"
on public.company_training_requirements
for delete
to authenticated
using (
  exists (
    select 1
    from public.company_memberships m
    where m.company_id = company_training_requirements.company_id
      and m.user_id = auth.uid()
      and coalesce(m.status, '') = 'active'
      and coalesce(m.role, '') in (
        'company_admin',
        'manager',
        'safety_manager'
      )
  )
  or public.is_admin_role()
);
