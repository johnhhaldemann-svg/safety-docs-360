-- Internal team jobsite audit submissions (admin workspace checklist + Excel template scores).

create table if not exists public.internal_jobsite_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by_user_id uuid not null references auth.users (id) on delete cascade,
  created_by_email text,
  jobsite_name text,
  audit_date date,
  auditors text,
  payload jsonb not null default '{}'::jsonb
);

comment on table public.internal_jobsite_audits is
  'Jobsite audit drafts submitted from /admin/jobsite-audits (internal admins only).';

create index if not exists internal_jobsite_audits_created_at_idx
  on public.internal_jobsite_audits (created_at desc);

create index if not exists internal_jobsite_audits_created_by_idx
  on public.internal_jobsite_audits (created_by_user_id);

alter table public.internal_jobsite_audits enable row level security;

drop policy if exists internal_jobsite_audits_select_admin on public.internal_jobsite_audits;
create policy internal_jobsite_audits_select_admin
  on public.internal_jobsite_audits
  for select
  to authenticated
  using (public.is_admin_role());

drop policy if exists internal_jobsite_audits_insert_admin on public.internal_jobsite_audits;
create policy internal_jobsite_audits_insert_admin
  on public.internal_jobsite_audits
  for insert
  to authenticated
  with check (
    auth.uid() = created_by_user_id
    and public.is_admin_role()
  );
