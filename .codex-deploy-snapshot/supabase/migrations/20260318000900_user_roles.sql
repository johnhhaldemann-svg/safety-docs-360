create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'viewer',
  team text not null default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  updated_by uuid null references auth.users (id) on delete set null,
  constraint user_roles_role_check check (
    role in ('super_admin', 'admin', 'manager', 'editor', 'viewer')
  )
);

create index if not exists user_roles_role_idx on public.user_roles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_updated_at();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'viewer'
  );
$$;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('super_admin', 'admin');
$$;

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_role());

drop policy if exists "user_roles_insert_admin" on public.user_roles;
create policy "user_roles_insert_admin"
on public.user_roles
for insert
to authenticated
with check (public.is_admin_role());

drop policy if exists "user_roles_update_admin" on public.user_roles;
create policy "user_roles_update_admin"
on public.user_roles
for update
to authenticated
using (public.is_admin_role())
with check (public.is_admin_role());

drop policy if exists "user_roles_delete_admin" on public.user_roles;
create policy "user_roles_delete_admin"
on public.user_roles
for delete
to authenticated
using (public.is_admin_role());
