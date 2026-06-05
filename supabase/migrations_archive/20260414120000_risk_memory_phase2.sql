-- Risk Memory Engine Phase 2: contractors, AI recommendations, human-performance & cost facets.

-- ---------------------------------------------------------------------------
-- Company contractors (for facet FK and reporting)
-- ---------------------------------------------------------------------------
create table if not exists public.company_contractors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  notes text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  constraint company_contractors_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists company_contractors_company_active_idx
  on public.company_contractors (company_id, active, name);

drop trigger if exists set_company_contractors_updated_at on public.company_contractors;
create trigger set_company_contractors_updated_at
before update on public.company_contractors
for each row execute function public.set_updated_at();

alter table public.company_contractors enable row level security;

grant select, insert, update on public.company_contractors to authenticated;

drop policy if exists "company_contractors_select_scope" on public.company_contractors;
create policy "company_contractors_select_scope"
on public.company_contractors
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
);

drop policy if exists "company_contractors_insert_scope" on public.company_contractors;
create policy "company_contractors_insert_scope"
on public.company_contractors
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
);

drop policy if exists "company_contractors_update_scope" on public.company_contractors;
create policy "company_contractors_update_scope"
on public.company_contractors
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_contractors.company_id
  )
);

-- ---------------------------------------------------------------------------
-- Facet extensions (Phase 2 learning dimensions)
-- ---------------------------------------------------------------------------
alter table public.company_risk_memory_facets
  add column if not exists contractor_id uuid null references public.company_contractors (id) on delete set null;

alter table public.company_risk_memory_facets
  add column if not exists behavior_category text null;

alter table public.company_risk_memory_facets
  add column if not exists training_status text null;

alter table public.company_risk_memory_facets
  add column if not exists supervision_status text null;

alter table public.company_risk_memory_facets
  add column if not exists equipment_type text null;

alter table public.company_risk_memory_facets
  add column if not exists cost_impact_band text null;

alter table public.company_risk_memory_facets
  add column if not exists forecast_confidence numeric null;

alter table public.company_risk_memory_facets
  add column if not exists location_grid text null;

alter table public.company_risk_memory_facets
  drop constraint if exists company_risk_memory_facets_cost_impact_check;

alter table public.company_risk_memory_facets
  add constraint company_risk_memory_facets_cost_impact_check check (
    cost_impact_band is null
    or cost_impact_band in ('none', 'low', 'medium', 'high', 'critical')
  );

alter table public.company_risk_memory_facets
  drop constraint if exists company_risk_memory_facets_forecast_confidence_check;

alter table public.company_risk_memory_facets
  add constraint company_risk_memory_facets_forecast_confidence_check check (
    forecast_confidence is null
    or (forecast_confidence >= 0 and forecast_confidence <= 1)
  );

create index if not exists company_risk_memory_facets_contractor_idx
  on public.company_risk_memory_facets (company_id, contractor_id)
  where contractor_id is not null;

create index if not exists company_risk_memory_facets_behavior_idx
  on public.company_risk_memory_facets (company_id, behavior_category)
  where behavior_category is not null;

-- ---------------------------------------------------------------------------
-- AI / rule-based recommendations (stored for dashboards and follow-up)
-- ---------------------------------------------------------------------------
create table if not exists public.company_risk_ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites (id) on delete set null,
  kind text not null default 'insight',
  title text not null,
  body text not null,
  confidence numeric not null default 0.5,
  context_snapshot jsonb not null default '{}'::jsonb,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  constraint company_risk_ai_recommendations_confidence_check check (
    confidence >= 0 and confidence <= 1
  ),
  constraint company_risk_ai_recommendations_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists company_risk_ai_recommendations_company_created_idx
  on public.company_risk_ai_recommendations (company_id, created_at desc)
  where dismissed = false;

alter table public.company_risk_ai_recommendations enable row level security;

grant select, insert, update on public.company_risk_ai_recommendations to authenticated;

drop policy if exists "company_risk_ai_recommendations_select_scope" on public.company_risk_ai_recommendations;
create policy "company_risk_ai_recommendations_select_scope"
on public.company_risk_ai_recommendations
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
);

drop policy if exists "company_risk_ai_recommendations_insert_scope" on public.company_risk_ai_recommendations;
create policy "company_risk_ai_recommendations_insert_scope"
on public.company_risk_ai_recommendations
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
);

drop policy if exists "company_risk_ai_recommendations_update_scope" on public.company_risk_ai_recommendations;
create policy "company_risk_ai_recommendations_update_scope"
on public.company_risk_ai_recommendations
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1 from public.company_memberships actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
  or exists (
    select 1 from public.user_roles actor
    where actor.user_id = auth.uid() and actor.company_id = public.company_risk_ai_recommendations.company_id
  )
);

comment on column public.company_risk_memory_facets.behavior_category is
  'Phase 2: human performance / learning dimension; use carefully for culture not blame.';
comment on table public.company_risk_ai_recommendations is
  'Rule-based or future LLM-generated risk recommendations for the workspace.';
