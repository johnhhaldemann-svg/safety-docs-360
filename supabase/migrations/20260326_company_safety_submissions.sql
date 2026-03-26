create table if not exists public.company_safety_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  title text not null,
  description text null,
  severity text not null default 'medium',
  photo_path text null,
  submitted_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_safety_submissions_severity_check check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint company_safety_submissions_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists company_safety_submissions_company_created_idx
  on public.company_safety_submissions(company_id, created_at desc);
create index if not exists company_safety_submissions_jobsite_idx
  on public.company_safety_submissions(company_id, jobsite_id, created_at desc);

drop trigger if exists set_company_safety_submissions_updated_at on public.company_safety_submissions;
create trigger set_company_safety_submissions_updated_at
before update on public.company_safety_submissions
for each row
execute function public.set_updated_at();

alter table public.company_corrective_actions
add column if not exists source_submission_id uuid null references public.company_safety_submissions(id) on delete set null;

create index if not exists company_corrective_actions_source_submission_idx
  on public.company_corrective_actions(source_submission_id);

alter table public.company_safety_submissions enable row level security;

grant select, insert on public.company_safety_submissions to authenticated;

drop policy if exists "safety_submissions_select_company_scope" on public.company_safety_submissions;
create policy "safety_submissions_select_company_scope"
on public.company_safety_submissions
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_safety_submissions.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_safety_submissions.company_id
  )
);

drop policy if exists "safety_submissions_insert_company_scope" on public.company_safety_submissions;
create policy "safety_submissions_insert_company_scope"
on public.company_safety_submissions
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_safety_submissions.company_id
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_safety_submissions.company_id
  )
);
