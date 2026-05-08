create policy "injury_forecast_audit_log_select_scope"
on public.injury_forecast_audit_log
for select
to authenticated
using (
  public.is_admin_role()
  or (
    company_id is not null
    and exists (
      select 1
      from public.company_memberships actor
      where actor.user_id = auth.uid()
        and actor.company_id = injury_forecast_audit_log.company_id
    )
  )
  or (
    company_id is not null
    and exists (
      select 1
      from public.user_roles actor
      where actor.user_id = auth.uid()
        and actor.company_id = injury_forecast_audit_log.company_id
        and actor.account_status = 'active'
    )
  )
);