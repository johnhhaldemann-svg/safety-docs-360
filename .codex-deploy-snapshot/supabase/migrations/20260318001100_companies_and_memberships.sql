create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_key text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null default 'company_user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint company_memberships_user_company_unique unique (user_id, company_id)
);

alter table public.user_roles
add column if not exists company_id uuid null references public.companies(id) on delete set null;

alter table public.documents
add column if not exists company_id uuid null references public.companies(id) on delete set null;

insert into public.companies (name, team_key)
select distinct
  coalesce(nullif(trim(team), ''), 'General') as name,
  coalesce(nullif(trim(team), ''), 'General') as team_key
from public.user_roles
where coalesce(nullif(trim(team), ''), 'General') is not null
on conflict (team_key) do nothing;

update public.user_roles ur
set company_id = c.id
from public.companies c
where c.team_key = coalesce(nullif(trim(ur.team), ''), 'General')
  and ur.company_id is null;

insert into public.company_memberships (user_id, company_id, role, status, created_by, updated_by)
select
  ur.user_id,
  ur.company_id,
  case
    when ur.role in ('company_admin', 'company_user') then ur.role
    else 'company_user'
  end,
  case
    when ur.account_status in ('pending', 'suspended') then ur.account_status
    else 'active'
  end,
  ur.created_by,
  ur.updated_by
from public.user_roles ur
where ur.company_id is not null
on conflict (user_id, company_id) do nothing;

update public.documents d
set company_id = ur.company_id
from public.user_roles ur
where d.user_id = ur.user_id
  and d.company_id is null
  and ur.company_id is not null;
