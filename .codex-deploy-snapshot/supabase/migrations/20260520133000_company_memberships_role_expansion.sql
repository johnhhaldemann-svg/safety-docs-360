alter table public.company_memberships
drop constraint if exists company_memberships_role_check;

alter table public.company_memberships
add constraint company_memberships_role_check check (
  role in (
    'company_admin',
    'manager',
    'safety_manager',
    'project_manager',
    'field_supervisor',
    'foreman',
    'field_user',
    'read_only',
    'company_user'
  )
);
