begin;

alter table public.company_daps rename to company_jsas;
alter table public.company_jsas rename constraint company_daps_status_check to company_jsas_status_check;
alter table public.company_jsas rename constraint company_daps_severity_check to company_jsas_severity_check;
alter index if exists public.company_daps_company_status_idx rename to company_jsas_company_status_idx;
alter trigger set_company_daps_updated_at on public.company_jsas rename to set_company_jsas_updated_at;
drop policy if exists company_daps_select_scope on public.company_jsas;
create policy company_jsas_select_scope on public.company_jsas for select to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
);
drop policy if exists company_daps_insert_scope on public.company_jsas;
create policy company_jsas_insert_scope on public.company_jsas for insert to authenticated with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
);
drop policy if exists company_daps_update_scope on public.company_jsas;
create policy company_jsas_update_scope on public.company_jsas for update to authenticated using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
) with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsas.company_id)
);

alter table public.company_dap_activities rename to company_jsa_activities;
alter table public.company_jsa_activities rename column dap_id to jsa_id;
alter table public.company_jsa_activities rename constraint company_dap_activities_status_check to company_jsa_activities_status_check;
alter index if exists public.company_dap_activities_company_work_date_idx rename to company_jsa_activities_company_work_date_idx;
alter trigger set_company_dap_activities_updated_at on public.company_jsa_activities rename to set_company_jsa_activities_updated_at;
drop policy if exists company_dap_activities_scope on public.company_jsa_activities;
create policy company_jsa_activities_scope
on public.company_jsa_activities
for all
to authenticated
using (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsa_activities.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsa_activities.company_id and actor.account_status = 'active')
)
with check (
  public.is_admin_role()
  or exists (select 1 from public.company_memberships actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsa_activities.company_id)
  or exists (select 1 from public.user_roles actor where actor.user_id = auth.uid() and actor.company_id = public.company_jsa_activities.company_id and actor.account_status = 'active')
);

commit;
