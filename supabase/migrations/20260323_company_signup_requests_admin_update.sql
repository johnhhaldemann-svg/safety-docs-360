grant select, update on public.company_signup_requests to authenticated;

drop policy if exists "company_signup_requests_admin_update" on public.company_signup_requests;
create policy "company_signup_requests_admin_update"
on public.company_signup_requests
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());
