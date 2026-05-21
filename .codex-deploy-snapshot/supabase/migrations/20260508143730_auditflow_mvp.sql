-- Clean-room AuditFlow MVP module.
-- Separate from company_jobsite_audits / field-audits.

create table if not exists public.company_auditflow_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text null,
  active boolean not null default true,
  current_version_id uuid null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_auditflow_templates_title_nonempty check (length(trim(title)) > 0)
);

create table if not exists public.company_auditflow_template_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.company_auditflow_templates(id) on delete cascade,
  version integer not null,
  schema jsonb not null default '{"sections":[]}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint company_auditflow_template_versions_unique unique (template_id, version),
  constraint company_auditflow_template_versions_positive check (version > 0)
);

alter table public.company_auditflow_templates
  drop constraint if exists company_auditflow_templates_current_version_fk;

alter table public.company_auditflow_templates
  add constraint company_auditflow_templates_current_version_fk
  foreign key (current_version_id)
  references public.company_auditflow_template_versions(id)
  on delete set null;

create table if not exists public.company_auditflow_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.company_auditflow_templates(id) on delete restrict,
  template_version_id uuid not null references public.company_auditflow_template_versions(id) on delete restrict,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  assigned_user_id uuid null references auth.users(id) on delete set null,
  scheduled_date date null,
  due_at timestamptz null,
  status text not null default 'assigned',
  manager_notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_auditflow_assignments_status_check check (
    status in ('assigned', 'in_progress', 'submitted', 'approved', 'returned', 'cancelled')
  )
);

create table if not exists public.company_auditflow_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assignment_id uuid not null references public.company_auditflow_assignments(id) on delete cascade,
  template_id uuid not null references public.company_auditflow_templates(id) on delete restrict,
  template_version_id uuid not null references public.company_auditflow_template_versions(id) on delete restrict,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  submitted_by uuid null references auth.users(id) on delete set null,
  status text not null default 'submitted',
  answers jsonb not null default '{}'::jsonb,
  score_summary jsonb not null default '{}'::jsonb,
  notes text null,
  signature_text text not null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  review_notes text null,
  reviewed_at timestamptz null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_auditflow_submissions_status_check check (
    status in ('submitted', 'approved', 'returned')
  ),
  constraint company_auditflow_submissions_signature_nonempty check (length(trim(signature_text)) > 0)
);

create table if not exists public.company_auditflow_corrective_action_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assignment_id uuid not null references public.company_auditflow_assignments(id) on delete cascade,
  submission_id uuid not null references public.company_auditflow_submissions(id) on delete cascade,
  action_id uuid not null references public.company_corrective_actions(id) on delete cascade,
  item_key text not null,
  created_at timestamptz not null default now(),
  constraint company_auditflow_corrective_action_links_unique unique (submission_id, item_key)
);

create index if not exists company_auditflow_templates_company_idx
  on public.company_auditflow_templates(company_id, active, updated_at desc);

create index if not exists company_auditflow_template_versions_template_idx
  on public.company_auditflow_template_versions(template_id, version desc);

create index if not exists company_auditflow_assignments_company_status_idx
  on public.company_auditflow_assignments(company_id, status, due_at, updated_at desc);

create index if not exists company_auditflow_assignments_assignee_idx
  on public.company_auditflow_assignments(company_id, assigned_user_id, status, due_at);

create index if not exists company_auditflow_submissions_assignment_idx
  on public.company_auditflow_submissions(company_id, assignment_id, submitted_at desc);

create index if not exists company_auditflow_action_links_action_idx
  on public.company_auditflow_corrective_action_links(company_id, action_id);

drop trigger if exists set_company_auditflow_templates_updated_at on public.company_auditflow_templates;
create trigger set_company_auditflow_templates_updated_at
before update on public.company_auditflow_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_company_auditflow_assignments_updated_at on public.company_auditflow_assignments;
create trigger set_company_auditflow_assignments_updated_at
before update on public.company_auditflow_assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_company_auditflow_submissions_updated_at on public.company_auditflow_submissions;
create trigger set_company_auditflow_submissions_updated_at
before update on public.company_auditflow_submissions
for each row execute function public.set_updated_at();

alter table public.company_auditflow_templates enable row level security;
alter table public.company_auditflow_template_versions enable row level security;
alter table public.company_auditflow_assignments enable row level security;
alter table public.company_auditflow_submissions enable row level security;
alter table public.company_auditflow_corrective_action_links enable row level security;

grant select, insert, update on public.company_auditflow_templates to authenticated;
grant select, insert on public.company_auditflow_template_versions to authenticated;
grant select, insert, update on public.company_auditflow_assignments to authenticated;
grant select, insert, update on public.company_auditflow_submissions to authenticated;
grant select, insert on public.company_auditflow_corrective_action_links to authenticated;

grant select, insert, update, delete on public.company_auditflow_templates to service_role;
grant select, insert, update, delete on public.company_auditflow_template_versions to service_role;
grant select, insert, update, delete on public.company_auditflow_assignments to service_role;
grant select, insert, update, delete on public.company_auditflow_submissions to service_role;
grant select, insert, update, delete on public.company_auditflow_corrective_action_links to service_role;

drop policy if exists company_auditflow_templates_select_scope on public.company_auditflow_templates;
create policy company_auditflow_templates_select_scope
on public.company_auditflow_templates for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_templates_insert_scope on public.company_auditflow_templates;
create policy company_auditflow_templates_insert_scope
on public.company_auditflow_templates for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_auditflow_templates_update_scope on public.company_auditflow_templates;
create policy company_auditflow_templates_update_scope
on public.company_auditflow_templates for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_auditflow_template_versions_select_scope on public.company_auditflow_template_versions;
create policy company_auditflow_template_versions_select_scope
on public.company_auditflow_template_versions for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_template_versions_insert_scope on public.company_auditflow_template_versions;
create policy company_auditflow_template_versions_insert_scope
on public.company_auditflow_template_versions for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_auditflow_assignments_select_scope on public.company_auditflow_assignments;
create policy company_auditflow_assignments_select_scope
on public.company_auditflow_assignments for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_assignments_insert_scope on public.company_auditflow_assignments;
create policy company_auditflow_assignments_insert_scope
on public.company_auditflow_assignments for insert to authenticated
with check (public.security_can_write_company_data(company_id));

drop policy if exists company_auditflow_assignments_update_scope on public.company_auditflow_assignments;
create policy company_auditflow_assignments_update_scope
on public.company_auditflow_assignments for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_submissions_select_scope on public.company_auditflow_submissions;
create policy company_auditflow_submissions_select_scope
on public.company_auditflow_submissions for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_submissions_insert_scope on public.company_auditflow_submissions;
create policy company_auditflow_submissions_insert_scope
on public.company_auditflow_submissions for insert to authenticated
with check (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_submissions_update_scope on public.company_auditflow_submissions;
create policy company_auditflow_submissions_update_scope
on public.company_auditflow_submissions for update to authenticated
using (public.security_is_company_member(company_id))
with check (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_action_links_select_scope on public.company_auditflow_corrective_action_links;
create policy company_auditflow_action_links_select_scope
on public.company_auditflow_corrective_action_links for select to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists company_auditflow_action_links_insert_scope on public.company_auditflow_corrective_action_links;
create policy company_auditflow_action_links_insert_scope
on public.company_auditflow_corrective_action_links for insert to authenticated
with check (public.security_is_company_member(company_id));
