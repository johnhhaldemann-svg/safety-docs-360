alter table public.user_roles
add column if not exists account_status text not null default 'active';

alter table public.user_roles
drop constraint if exists user_roles_account_status_check;

alter table public.user_roles
add constraint user_roles_account_status_check check (
  account_status in ('active', 'suspended')
);
