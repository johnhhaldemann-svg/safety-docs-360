alter table public.company_invites
drop constraint if exists company_invites_role_check;

alter table public.company_invites
add constraint company_invites_role_check check (
  role in ('company_admin', 'manager', 'company_user')
);
