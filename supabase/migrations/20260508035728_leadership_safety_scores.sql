create table if not exists public.company_leadership_safety_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  score integer not null,
  grade text not null,
  trend integer not null default 0,
  last_scored_at timestamptz not null default now(),
  positive_signals jsonb not null default '[]'::jsonb,
  negative_signals jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_leadership_safety_scores_score_check check (score >= 0 and score <= 100),
  constraint company_leadership_safety_scores_grade_check check (grade in ('A', 'B', 'C', 'D', 'F')),
  constraint company_leadership_safety_scores_window_check check (window_end > window_start),
  constraint company_leadership_safety_scores_unique unique (company_id, user_id, role, window_start, window_end)
);

create index if not exists company_leadership_safety_scores_company_window_idx
  on public.company_leadership_safety_scores(company_id, window_end desc, score desc);

create index if not exists company_leadership_safety_scores_user_window_idx
  on public.company_leadership_safety_scores(company_id, user_id, window_end desc);

drop trigger if exists set_company_leadership_safety_scores_updated_at on public.company_leadership_safety_scores;
create trigger set_company_leadership_safety_scores_updated_at
before update on public.company_leadership_safety_scores
for each row
execute function public.set_updated_at();

alter table public.company_leadership_safety_scores enable row level security;

grant select, insert, update on public.company_leadership_safety_scores to authenticated;

drop policy if exists "company_leadership_safety_scores_select_scope" on public.company_leadership_safety_scores;
create policy "company_leadership_safety_scores_select_scope"
on public.company_leadership_safety_scores
for select
to authenticated
using (
  public.is_admin_role()
  or auth.uid() = user_id
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager', 'project_manager', 'field_supervisor')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager', 'project_manager', 'field_supervisor')
  )
);

drop policy if exists "company_leadership_safety_scores_insert_managers" on public.company_leadership_safety_scores;
create policy "company_leadership_safety_scores_insert_managers"
on public.company_leadership_safety_scores
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);

drop policy if exists "company_leadership_safety_scores_update_managers" on public.company_leadership_safety_scores;
create policy "company_leadership_safety_scores_update_managers"
on public.company_leadership_safety_scores
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.company_memberships actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
  or exists (
    select 1
    from public.user_roles actor
    where actor.user_id = auth.uid()
      and actor.company_id = public.company_leadership_safety_scores.company_id
      and actor.role in ('company_admin', 'manager', 'safety_manager')
  )
);

comment on table public.company_leadership_safety_scores is
  'Automatic, evidence-backed safety commitment ratings for leadership roles. Intended for coaching and risk reduction, not discipline.';
