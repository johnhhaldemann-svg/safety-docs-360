create or replace function public.lookup_my_company_signup_request()
returns table (
  id uuid,
  company_name text,
  primary_contact_email text,
  owner_user_id uuid,
  status text,
  account_status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    csr.id,
    csr.company_name,
    csr.primary_contact_email,
    csr.owner_user_id,
    csr.status,
    csr.account_status,
    csr.created_at
  from public.company_signup_requests csr
  where (
    csr.owner_user_id = auth.uid()
    or lower(coalesce(csr.primary_contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
    and lower(coalesce(csr.status, '')) = 'pending'
  order by csr.created_at desc nulls last
  limit 1;
$$;

revoke all on function public.lookup_my_company_signup_request() from public;
grant execute on function public.lookup_my_company_signup_request() to authenticated;
