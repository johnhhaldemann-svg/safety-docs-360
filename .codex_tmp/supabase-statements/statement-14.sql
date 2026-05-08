create policy "injury_forecast_audit_log_insert_admin_scope"
on public.injury_forecast_audit_log
for insert
to authenticated
with check (
  public.is_admin_role()
  or (
    company_id is not null
    and exists (
      select 1
      from public.user_roles actor
      where actor.user_id = auth.uid()
        and actor.company_id = injury_forecast_audit_log.company_id
        and actor.role in ('company_admin', 'manager', 'admin', 'super_admin', 'platform_admin')
        and actor.account_status = 'active'
    )
  )
);