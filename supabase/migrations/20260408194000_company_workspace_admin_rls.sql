-- Allow authenticated internal admins to activate workspaces from the approval flow
-- when the request-scoped Supabase client is used instead of the service role.

alter table public.companies enable row level security;
grant select, insert, update, delete on public.companies to authenticated;

drop policy if exists "companies_select_admin_or_member" on public.companies;
create policy "companies_select_admin_or_member"
on public.companies
for select
to authenticated
using (
  public.is_admin_role()
  or public.security_is_company_member(id)
);

drop policy if exists "companies_insert_admin_only" on public.companies;
create policy "companies_insert_admin_only"
on public.companies
for insert
to authenticated
with check (public.is_admin_role());

drop policy if exists "companies_update_admin_only" on public.companies;
create policy "companies_update_admin_only"
on public.companies
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

drop policy if exists "companies_delete_admin_only" on public.companies;
create policy "companies_delete_admin_only"
on public.companies
for delete
to authenticated
using (public.is_admin_role());

alter table public.company_subscriptions enable row level security;
grant select, insert, update, delete on public.company_subscriptions to authenticated;

drop policy if exists "company_subscriptions_select_member_scope" on public.company_subscriptions;
create policy "company_subscriptions_select_member_scope"
on public.company_subscriptions
for select
to authenticated
using (public.security_is_company_member(company_id));

drop policy if exists "company_subscriptions_insert_admin_only" on public.company_subscriptions;
create policy "company_subscriptions_insert_admin_only"
on public.company_subscriptions
for insert
to authenticated
with check (public.is_admin_role());

drop policy if exists "company_subscriptions_update_admin_only" on public.company_subscriptions;
create policy "company_subscriptions_update_admin_only"
on public.company_subscriptions
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

drop policy if exists "company_subscriptions_delete_admin_only" on public.company_subscriptions;
create policy "company_subscriptions_delete_admin_only"
on public.company_subscriptions
for delete
to authenticated
using (public.is_admin_role());
