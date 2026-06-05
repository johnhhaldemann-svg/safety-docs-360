-- Pilot revenue hardening: close actionable RLS-no-policy findings that can be
-- fixed without changing public API behavior. These policies keep server-only
-- tables server-only and scope contractor training records through company
-- membership and jobsite assignments.

alter table public.billing_invoice_counters enable row level security;
drop policy if exists billing_invoice_counters_service_role_all on public.billing_invoice_counters;
create policy billing_invoice_counters_service_role_all
on public.billing_invoice_counters
for all
to service_role
using (true)
with check (true);

alter table public.platform_predictability_aggregates enable row level security;
drop policy if exists platform_predictability_aggregates_service_role_all on public.platform_predictability_aggregates;
create policy platform_predictability_aggregates_service_role_all
on public.platform_predictability_aggregates
for all
to service_role
using (true)
with check (true);

alter table public.osha_predictability_baselines enable row level security;
drop policy if exists osha_predictability_baselines_service_role_all on public.osha_predictability_baselines;
create policy osha_predictability_baselines_service_role_all
on public.osha_predictability_baselines
for all
to service_role
using (true)
with check (true);

alter table public.contractor_employee_profiles enable row level security;
drop policy if exists contractor_employee_profiles_select_scope on public.contractor_employee_profiles;
create policy contractor_employee_profiles_select_scope
on public.contractor_employee_profiles
for select
to authenticated
using (
  public.is_admin_role()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.contractor_employee_jobsite_assignments assignment
    where assignment.contractor_employee_id = public.contractor_employee_profiles.id
      and public.security_is_company_member(assignment.company_id)
  )
);

drop policy if exists contractor_employee_profiles_insert_own on public.contractor_employee_profiles;
create policy contractor_employee_profiles_insert_own
on public.contractor_employee_profiles
for insert
to authenticated
with check (
  public.is_admin_role()
  or created_by = auth.uid()
);

drop policy if exists contractor_employee_profiles_update_scope on public.contractor_employee_profiles;
create policy contractor_employee_profiles_update_scope
on public.contractor_employee_profiles
for update
to authenticated
using (
  public.is_admin_role()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.contractor_employee_jobsite_assignments assignment
    where assignment.contractor_employee_id = public.contractor_employee_profiles.id
      and public.security_is_company_member(assignment.company_id)
  )
)
with check (
  public.is_admin_role()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.contractor_employee_jobsite_assignments assignment
    where assignment.contractor_employee_id = public.contractor_employee_profiles.id
      and public.security_is_company_member(assignment.company_id)
  )
);

alter table public.contractor_employee_training_records enable row level security;
drop policy if exists contractor_employee_training_records_select_scope on public.contractor_employee_training_records;
create policy contractor_employee_training_records_select_scope
on public.contractor_employee_training_records
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_profiles profile
    where profile.id = public.contractor_employee_training_records.contractor_employee_id
      and (
        profile.created_by = auth.uid()
        or exists (
          select 1
          from public.contractor_employee_jobsite_assignments assignment
          where assignment.contractor_employee_id = profile.id
            and public.security_is_company_member(assignment.company_id)
        )
      )
  )
);

drop policy if exists contractor_employee_training_records_insert_scope on public.contractor_employee_training_records;
create policy contractor_employee_training_records_insert_scope
on public.contractor_employee_training_records
for insert
to authenticated
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_profiles profile
    where profile.id = public.contractor_employee_training_records.contractor_employee_id
      and (
        profile.created_by = auth.uid()
        or exists (
          select 1
          from public.contractor_employee_jobsite_assignments assignment
          where assignment.contractor_employee_id = profile.id
            and public.security_is_company_member(assignment.company_id)
        )
      )
  )
);

drop policy if exists contractor_employee_training_records_update_scope on public.contractor_employee_training_records;
create policy contractor_employee_training_records_update_scope
on public.contractor_employee_training_records
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_profiles profile
    where profile.id = public.contractor_employee_training_records.contractor_employee_id
      and (
        profile.created_by = auth.uid()
        or exists (
          select 1
          from public.contractor_employee_jobsite_assignments assignment
          where assignment.contractor_employee_id = profile.id
            and public.security_is_company_member(assignment.company_id)
        )
      )
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_profiles profile
    where profile.id = public.contractor_employee_training_records.contractor_employee_id
      and (
        profile.created_by = auth.uid()
        or exists (
          select 1
          from public.contractor_employee_jobsite_assignments assignment
          where assignment.contractor_employee_id = profile.id
            and public.security_is_company_member(assignment.company_id)
        )
      )
  )
);

alter table public.contractor_employee_intake_tokens enable row level security;
drop policy if exists contractor_employee_intake_tokens_select_scope on public.contractor_employee_intake_tokens;
create policy contractor_employee_intake_tokens_select_scope
on public.contractor_employee_intake_tokens
for select
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_jobsite_assignments assignment
    where assignment.id = public.contractor_employee_intake_tokens.assignment_id
      and public.security_is_company_member(assignment.company_id)
  )
);

drop policy if exists contractor_employee_intake_tokens_insert_scope on public.contractor_employee_intake_tokens;
create policy contractor_employee_intake_tokens_insert_scope
on public.contractor_employee_intake_tokens
for insert
to authenticated
with check (
  public.is_admin_role()
  or (
    created_by = auth.uid()
    and exists (
      select 1
      from public.contractor_employee_jobsite_assignments assignment
      where assignment.id = public.contractor_employee_intake_tokens.assignment_id
        and assignment.company_id = public.contractor_employee_intake_tokens.company_id
        and assignment.jobsite_id = public.contractor_employee_intake_tokens.jobsite_id
        and assignment.contractor_employee_id = public.contractor_employee_intake_tokens.contractor_employee_id
        and public.security_is_company_member(assignment.company_id)
    )
  )
);

drop policy if exists contractor_employee_intake_tokens_update_scope on public.contractor_employee_intake_tokens;
create policy contractor_employee_intake_tokens_update_scope
on public.contractor_employee_intake_tokens
for update
to authenticated
using (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_jobsite_assignments assignment
    where assignment.id = public.contractor_employee_intake_tokens.assignment_id
      and public.security_is_company_member(assignment.company_id)
  )
)
with check (
  public.is_admin_role()
  or exists (
    select 1
    from public.contractor_employee_jobsite_assignments assignment
    where assignment.id = public.contractor_employee_intake_tokens.assignment_id
      and assignment.company_id = public.contractor_employee_intake_tokens.company_id
      and assignment.jobsite_id = public.contractor_employee_intake_tokens.jobsite_id
      and assignment.contractor_employee_id = public.contractor_employee_intake_tokens.contractor_employee_id
      and public.security_is_company_member(assignment.company_id)
  )
);

create index if not exists contractor_employee_profiles_created_by_idx
  on public.contractor_employee_profiles(created_by)
  where created_by is not null;

create index if not exists contractor_employee_training_records_requirement_idx
  on public.contractor_employee_training_records(requirement_id)
  where requirement_id is not null;

create index if not exists contractor_employee_intake_tokens_company_jobsite_idx
  on public.contractor_employee_intake_tokens(company_id, jobsite_id, created_at desc);

create index if not exists contractor_employee_intake_tokens_contractor_employee_idx
  on public.contractor_employee_intake_tokens(contractor_employee_id, created_at desc);

create index if not exists contractor_employee_jobsite_assignments_employee_idx
  on public.contractor_employee_jobsite_assignments(contractor_employee_id);

create index if not exists contractor_employee_jobsite_assignments_contractor_idx
  on public.contractor_employee_jobsite_assignments(contractor_id)
  where contractor_id is not null;

create index if not exists ai_visual_generation_jobs_jobsite_id_idx
  on public.ai_visual_generation_jobs(jobsite_id);

create index if not exists ai_visual_generation_jobs_site_map_id_idx
  on public.ai_visual_generation_jobs(site_map_id)
  where site_map_id is not null;

create index if not exists ai_visual_generation_jobs_blueprint_id_idx
  on public.ai_visual_generation_jobs(blueprint_id)
  where blueprint_id is not null;

create index if not exists ai_visual_generation_jobs_render_id_idx
  on public.ai_visual_generation_jobs(render_id)
  where render_id is not null;

create index if not exists ai_visual_generation_jobs_created_by_idx
  on public.ai_visual_generation_jobs(created_by)
  where created_by is not null;

create index if not exists ai_visual_generation_jobs_updated_by_idx
  on public.ai_visual_generation_jobs(updated_by)
  where updated_by is not null;
