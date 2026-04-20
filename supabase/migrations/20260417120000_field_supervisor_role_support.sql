alter table public.user_roles
drop constraint if exists user_roles_role_check;

alter table public.user_roles
add constraint user_roles_role_check
check (
  role = any (
    array[
      'platform_admin'::text,
      'internal_reviewer'::text,
      'employee'::text,
      'super_admin'::text,
      'admin'::text,
      'manager'::text,
      'company_admin'::text,
      'safety_manager'::text,
      'project_manager'::text,
      'field_supervisor'::text,
      'foreman'::text,
      'field_user'::text,
      'read_only'::text,
      'company_user'::text,
      'editor'::text,
      'viewer'::text
    ]
  )
);

alter table public.company_invites
drop constraint if exists company_invites_role_check;

alter table public.company_invites
add constraint company_invites_role_check
check (
  role = any (
    array[
      'company_admin'::text,
      'manager'::text,
      'safety_manager'::text,
      'project_manager'::text,
      'field_supervisor'::text,
      'foreman'::text,
      'field_user'::text,
      'read_only'::text,
      'company_user'::text
    ]
  )
);

alter table public.company_jobsite_assignments
drop constraint if exists company_jobsite_assignments_role_check;

alter table public.company_jobsite_assignments
add constraint company_jobsite_assignments_role_check
check (
  role = any (
    array[
      'project_manager'::text,
      'field_supervisor'::text,
      'foreman'::text,
      'field_user'::text,
      'read_only'::text,
      'company_user'::text
    ]
  )
);
