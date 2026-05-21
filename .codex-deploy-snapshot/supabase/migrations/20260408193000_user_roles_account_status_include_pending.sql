-- Company owner signup (company-register) inserts user_roles.account_status = 'pending'
-- while the original check only allowed active/suspended. Align with invites and app logic.
alter table public.user_roles
drop constraint if exists user_roles_account_status_check;

alter table public.user_roles
add constraint user_roles_account_status_check check (
  account_status in ('pending', 'active', 'suspended')
);
