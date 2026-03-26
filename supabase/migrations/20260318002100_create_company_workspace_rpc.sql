create or replace function public.create_company_workspace(
  p_company_name text,
  p_industry text default null,
  p_phone text default null,
  p_website text default null,
  p_address_line_1 text default null,
  p_city text default null,
  p_state_region text default null,
  p_postal_code text default null,
  p_country text default null,
  p_plan_name text default 'Pro'
)
returns table (
  company_id uuid,
  company_name text,
  team_key text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text := '';
  actor_name text := '';
  existing_company_id uuid := null;
  base_key text := '';
  generated_team_key text := '';
  created_company public.companies%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if public.is_admin_role() then
    raise exception 'Internal admin accounts do not create customer companies from this setup flow.';
  end if;

  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required.';
  end if;

  select ur.company_id
  into existing_company_id
  from public.user_roles ur
  where ur.user_id = actor_id
  limit 1;

  if existing_company_id is not null then
    raise exception 'This account is already linked to a company workspace.';
  end if;

  select
    coalesce(au.email, ''),
    coalesce(
      nullif(au.raw_user_meta_data ->> 'full_name', ''),
      nullif(au.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(au.email, ''), '@', 1),
      'Company Admin'
    )
  into actor_email, actor_name
  from auth.users au
  where au.id = actor_id;

  base_key := regexp_replace(lower(trim(p_company_name)), '[^a-z0-9]+', '-', 'g');
  base_key := regexp_replace(base_key, '(^-+|-+$)', '', 'g');
  base_key := left(coalesce(nullif(base_key, ''), 'company'), 42);

  loop
    generated_team_key := base_key || '-' || substr(md5(clock_timestamp()::text || random()::text), 1, 8);
    exit when not exists (
      select 1
      from public.companies c
      where c.team_key = generated_team_key
    );
  end loop;

  insert into public.companies (
    name,
    team_key,
    status,
    industry,
    phone,
    website,
    address_line_1,
    city,
    state_region,
    postal_code,
    country,
    primary_contact_name,
    primary_contact_email,
    created_by,
    updated_by
  )
  values (
    trim(p_company_name),
    generated_team_key,
    'active',
    nullif(trim(coalesce(p_industry, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_address_line_1, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state_region, '')), ''),
    nullif(trim(coalesce(p_postal_code, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    actor_name,
    nullif(actor_email, ''),
    actor_id,
    actor_id
  )
  returning *
  into created_company;

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
    actor_id,
    'company_admin',
    created_company.name,
    created_company.id,
    'active',
    actor_id,
    actor_id
  )
  on conflict (user_id) do update set
    role = excluded.role,
    team = excluded.team,
    company_id = excluded.company_id,
    account_status = excluded.account_status,
    updated_by = actor_id,
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
    actor_id,
    created_company.id,
    'company_admin',
    'active',
    actor_id,
    actor_id
  )
  on conflict (user_id, company_id) do update set
    role = excluded.role,
    status = excluded.status,
    updated_by = actor_id,
    updated_at = now();

  insert into public.company_subscriptions (
    company_id,
    status,
    plan_name,
    created_by,
    updated_by
  )
  values (
    created_company.id,
    'active',
    nullif(trim(coalesce(p_plan_name, 'Pro')), ''),
    actor_id,
    actor_id
  )
  on conflict (company_id) do update set
    status = excluded.status,
    plan_name = excluded.plan_name,
    updated_by = actor_id,
    updated_at = now();

  return query
  select
    created_company.id,
    created_company.name,
    created_company.team_key;
end;
$$;

revoke all on function public.create_company_workspace(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_company_workspace(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
