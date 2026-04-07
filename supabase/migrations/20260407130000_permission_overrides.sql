alter table public.companies
  add column if not exists permission_overrides jsonb not null default '{"allow":[],"deny":[]}'::jsonb;

alter table public.user_roles
  add column if not exists permission_overrides jsonb not null default '{"allow":[],"deny":[]}'::jsonb;

update public.companies
set permission_overrides = '{"allow":[],"deny":[]}'::jsonb
where permission_overrides is null;

update public.user_roles
set permission_overrides = '{"allow":[],"deny":[]}'::jsonb
where permission_overrides is null;

comment on column public.companies.permission_overrides is
  'Workspace-wide function access overrides for company-scoped users.';

comment on column public.user_roles.permission_overrides is
  'User-specific function access overrides layered on top of the role and company defaults.';
