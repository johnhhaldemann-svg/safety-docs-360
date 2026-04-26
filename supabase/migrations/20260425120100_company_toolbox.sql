-- Toolbox / pre-start briefing templates, sessions, and attendees.

create table if not exists public.company_toolbox_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  topics jsonb not null default '[]'::jsonb,
  trade_tags jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint company_toolbox_templates_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists company_toolbox_templates_company_idx
  on public.company_toolbox_templates(company_id, active, name);

drop trigger if exists set_company_toolbox_templates_updated_at on public.company_toolbox_templates;
create trigger set_company_toolbox_templates_updated_at
before update on public.company_toolbox_templates
for each row execute function public.set_updated_at();

create table if not exists public.company_toolbox_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites(id) on delete cascade,
  template_id uuid null references public.company_toolbox_templates(id) on delete set null,
  conducted_by uuid null references auth.users(id) on delete set null,
  conducted_at timestamptz not null default now(),
  notes text null,
  status text not null default 'draft',
  linked_corrective_action_id uuid null references public.company_corrective_actions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_toolbox_sessions_status_check check (status in ('draft', 'completed'))
);

create index if not exists company_toolbox_sessions_jobsite_idx
  on public.company_toolbox_sessions(company_id, jobsite_id, conducted_at desc);

drop trigger if exists set_company_toolbox_sessions_updated_at on public.company_toolbox_sessions;
create trigger set_company_toolbox_sessions_updated_at
before update on public.company_toolbox_sessions
for each row execute function public.set_updated_at();

create table if not exists public.company_toolbox_attendees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  session_id uuid not null references public.company_toolbox_sessions(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  guest_name text null,
  signed_at timestamptz null,
  signature_note text null,
  created_at timestamptz not null default now(),
  constraint company_toolbox_attendees_subject_check check (
    (user_id is not null) or (guest_name is not null and length(trim(guest_name)) > 0)
  )
);

create index if not exists company_toolbox_attendees_session_idx
  on public.company_toolbox_attendees(session_id, created_at desc);

alter table public.company_toolbox_templates enable row level security;
alter table public.company_toolbox_sessions enable row level security;
alter table public.company_toolbox_attendees enable row level security;

grant select, insert, update on public.company_toolbox_templates to authenticated;
grant select, insert, update on public.company_toolbox_sessions to authenticated;
grant select, insert, update on public.company_toolbox_attendees to authenticated;

drop policy if exists "company_toolbox_templates_select_scope" on public.company_toolbox_templates;
create policy "company_toolbox_templates_select_scope"
on public.company_toolbox_templates for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
);

drop policy if exists "company_toolbox_templates_insert_scope" on public.company_toolbox_templates;
create policy "company_toolbox_templates_insert_scope"
on public.company_toolbox_templates for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
);

drop policy if exists "company_toolbox_templates_update_scope" on public.company_toolbox_templates;
create policy "company_toolbox_templates_update_scope"
on public.company_toolbox_templates for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_templates.company_id)
);

drop policy if exists "company_toolbox_sessions_select_scope" on public.company_toolbox_sessions;
create policy "company_toolbox_sessions_select_scope"
on public.company_toolbox_sessions for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
);

drop policy if exists "company_toolbox_sessions_insert_scope" on public.company_toolbox_sessions;
create policy "company_toolbox_sessions_insert_scope"
on public.company_toolbox_sessions for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
);

drop policy if exists "company_toolbox_sessions_update_scope" on public.company_toolbox_sessions;
create policy "company_toolbox_sessions_update_scope"
on public.company_toolbox_sessions for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_sessions.company_id)
);

drop policy if exists "company_toolbox_attendees_select_scope" on public.company_toolbox_attendees;
create policy "company_toolbox_attendees_select_scope"
on public.company_toolbox_attendees for select to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
);

drop policy if exists "company_toolbox_attendees_insert_scope" on public.company_toolbox_attendees;
create policy "company_toolbox_attendees_insert_scope"
on public.company_toolbox_attendees for insert to authenticated
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
);

drop policy if exists "company_toolbox_attendees_update_scope" on public.company_toolbox_attendees;
create policy "company_toolbox_attendees_update_scope"
on public.company_toolbox_attendees for update to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_toolbox_attendees.company_id)
);
