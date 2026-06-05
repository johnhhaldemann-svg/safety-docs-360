create or replace function public.claim_approved_company_owner(
  approved_email text,
  approved_user_id uuid
)
returns table (
  company_id uuid,
  company_name text,
  linked_role text,
  account_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(approved_email, '')));
  matched_company public.companies%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if approved_user_id is null or approved_user_id <> auth.uid() then
    raise exception 'User not allowed';
  end if;

  if normalized_email = '' then
    return;
  end if;

  select c.*
  into matched_company
  from public.companies c
  where lower(coalesce(c.primary_contact_email, '')) = normalized_email
    and lower(coalesce(c.status, 'active')) = 'active'
  order by c.created_at desc nulls last
  limit 1;

  if matched_company.id is null then
    return;
  end if;

  insert into public.user_roles (
    user_id,
    role,
    team,
    company_id,
    account_status,
    created_by,
    updated_by
  )
  values (
    approved_user_id,
    'company_admin',
    matched_company.name,
    matched_company.id,
    'active',
    approved_user_id,
    approved_user_id
  )
  on conflict (user_id) do update set
    role = 'company_admin',
    team = excluded.team,
    company_id = excluded.company_id,
    account_status = 'active',
    updated_by = approved_user_id,
    updated_at = now();

  insert into public.company_memberships (
    user_id,
    company_id,
    role,
    status,
    created_by,
    updated_by
  )
  values (
    approved_user_id,
    matched_company.id,
    'company_admin',
    'active',
    approved_user_id,
    approved_user_id
  )
  on conflict (user_id, company_id) do update set
    role = 'company_admin',
    status = 'active',
    updated_by = approved_user_id,
    updated_at = now();

  update public.company_invites
  set
    consumed_at = coalesce(consumed_at, now()),
    consumed_by = approved_user_id,
    updated_at = now(),
    updated_by = approved_user_id
  where lower(coalesce(email, '')) = normalized_email
    and consumed_at is null;

  return query
  select
    matched_company.id,
    matched_company.name,
    'company_admin'::text,
    'active'::text;
end;
$$;

revoke all on function public.claim_approved_company_owner(text, uuid) from public;
grant execute on function public.claim_approved_company_owner(text, uuid) to authenticated;
