create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'company_user',
  team text not null default 'General',
  company_id uuid not null references public.companies(id) on delete cascade,
  account_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  consumed_at timestamptz null,
  consumed_by uuid null references auth.users(id) on delete set null,
  constraint company_invites_role_check check (
    role in ('company_admin', 'company_user')
  ),
  constraint company_invites_status_check check (
    account_status in ('pending', 'active', 'suspended')
  )
);

create unique index if not exists company_invites_email_company_active_idx
  on public.company_invites (lower(email), company_id)
  where consumed_at is null;

drop trigger if exists set_company_invites_updated_at on public.company_invites;
create trigger set_company_invites_updated_at
before update on public.company_invites
for each row
execute function public.set_updated_at();

alter table public.company_invites enable row level security;

drop policy if exists "company_invites_select_admin_or_company_admin" on public.company_invites;
create policy "company_invites_select_admin_or_company_admin"
on public.company_invites
for select
to authenticated
using (
  public.is_admin_role()
  or company_id = (
    select ur.company_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'company_admin'
    limit 1
  )
);

drop policy if exists "company_invites_insert_admin_or_company_admin" on public.company_invites;
create policy "company_invites_insert_admin_or_company_admin"
on public.company_invites
for insert
to authenticated
with check (
  public.is_admin_role()
  or company_id = (
    select ur.company_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'company_admin'
    limit 1
  )
);

drop policy if exists "company_invites_update_admin_or_company_admin" on public.company_invites;
create policy "company_invites_update_admin_or_company_admin"
on public.company_invites
for update
to authenticated
using (
  public.is_admin_role()
  or company_id = (
    select ur.company_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'company_admin'
    limit 1
  )
)
with check (
  public.is_admin_role()
  or company_id = (
    select ur.company_id
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'company_admin'
    limit 1
  )
);

create or replace function public.lookup_company_invite(invite_email text)
returns table (
  id uuid,
  email text,
  role text,
  team text,
  company_id uuid,
  account_status text
)
language sql
security definer
set search_path = public
as $$
  select
    ci.id,
    ci.email,
    ci.role,
    ci.team,
    ci.company_id,
    ci.account_status
  from public.company_invites ci
  where lower(ci.email) = lower(invite_email)
    and ci.consumed_at is null
  order by ci.created_at desc
  limit 1;
$$;

revoke all on function public.lookup_company_invite(text) from public;
grant execute on function public.lookup_company_invite(text) to anon, authenticated;

create or replace function public.consume_company_invite(
  invite_email text,
  invited_user_id uuid
)
returns table (
  id uuid,
  email text,
  role text,
  team text,
  company_id uuid,
  account_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.company_invites%rowtype;
begin
  select *
  into invite_row
  from public.company_invites ci
  where lower(ci.email) = lower(invite_email)
    and ci.consumed_at is null
  order by ci.created_at desc
  limit 1;

  if invite_row.id is null then
    return;
  end if;

  update public.company_invites
  set consumed_at = now(),
      consumed_by = invited_user_id,
      updated_at = now(),
      updated_by = invited_user_id
  where public.company_invites.id = invite_row.id;

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
    invited_user_id,
    invite_row.role,
    invite_row.team,
    invite_row.company_id,
    invite_row.account_status,
    coalesce(invite_row.created_by, invited_user_id),
    invited_user_id
  )
  on conflict (user_id) do update set
    role = excluded.role,
    team = excluded.team,
    company_id = excluded.company_id,
    account_status = excluded.account_status,
    updated_by = invited_user_id,
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
    invited_user_id,
    invite_row.company_id,
    invite_row.role,
    case
      when invite_row.account_status = 'pending' then 'pending'
      when invite_row.account_status = 'suspended' then 'suspended'
      else 'active'
    end,
    coalesce(invite_row.created_by, invited_user_id),
    invited_user_id
  )
  on conflict (user_id, company_id) do update set
    role = excluded.role,
    status = excluded.status,
    updated_by = invited_user_id,
    updated_at = now();

  return query
  select
    invite_row.id,
    invite_row.email,
    invite_row.role,
    invite_row.team,
    invite_row.company_id,
    invite_row.account_status;
end;
$$;

revoke all on function public.consume_company_invite(text, uuid) from public;
grant execute on function public.consume_company_invite(text, uuid) to anon, authenticated;
