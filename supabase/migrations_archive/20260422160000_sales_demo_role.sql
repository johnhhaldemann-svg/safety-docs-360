alter table public.user_roles
drop constraint if exists user_roles_role_check;

alter table public.user_roles
add constraint user_roles_role_check
check (
  role = any (
    array[
      'platform_admin'::text,
      'sales_demo'::text,
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
