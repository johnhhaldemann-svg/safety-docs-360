create or replace function public.security_is_company_member(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
    )
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.company_id = target_company_id
    );
$$;

create or replace function public.security_is_company_manager(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'platform_admin',
          'super_admin',
          'admin',
          'company_admin',
          'manager',
          'safety_manager'
        )
    );
$$;

create or replace function public.security_can_write_company_data(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_role()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.company_id = target_company_id
        and coalesce(ur.account_status, 'active') = 'active'
        and ur.role in (
          'platform_admin',
          'super_admin',
          'admin',
          'company_admin',
          'manager',
          'safety_manager',
          'project_manager',
          'foreman',
          'field_user',
          'internal_reviewer',
          'employee',
          'company_user',
          'editor'
        )
    );
$$;

create or replace function public.security_has_jobsite_access(target_company_id uuid, target_jobsite_id uuid)
returns boolean
language sql
stable
as $$
  select
    target_jobsite_id is null
    or public.security_is_company_manager(target_company_id)
    or exists (
      select 1
      from public.company_jobsite_assignments cja
      where cja.user_id = auth.uid()
        and cja.company_id = target_company_id
        and cja.jobsite_id = target_jobsite_id
    );
$$;

do $$
declare
  rec record;
  p record;
  has_jobsite boolean;
  scope_using text;
  scope_check text;
begin
  for rec in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and t.table_name in (
        select c.table_name
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.column_name = 'company_id'
      )
  loop
    execute format('alter table public.%I enable row level security', rec.table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', rec.table_name);

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = rec.table_name
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, rec.table_name);
    end loop;

    select exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = rec.table_name
        and c.column_name = 'jobsite_id'
    ) into has_jobsite;

    scope_using := 'public.security_is_company_member(company_id)';
    scope_check := 'public.security_can_write_company_data(company_id)';

    if has_jobsite then
      scope_using := scope_using || ' and public.security_has_jobsite_access(company_id, jobsite_id)';
      scope_check := scope_check || ' and public.security_has_jobsite_access(company_id, jobsite_id)';
    end if;

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      rec.table_name || '_select_company_scope',
      rec.table_name,
      scope_using
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      rec.table_name || '_insert_company_scope',
      rec.table_name,
      scope_check
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      rec.table_name || '_update_company_scope',
      rec.table_name,
      scope_using,
      scope_check
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      rec.table_name || '_delete_company_scope',
      rec.table_name,
      scope_check
    );
  end loop;
end
$$;

do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'company_users',
    'company_invites',
    'company_jobsite_assignments',
    'company_subscriptions',
    'company_credit_transactions'
  ]
  loop
    if exists (
      select 1 from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_name = tbl
    ) then
      for pol in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = tbl
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
      end loop;

      execute format(
        'create policy %I on public.%I for select to authenticated using (public.security_is_company_manager(company_id))',
        tbl || '_select_manager_scope',
        tbl
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.security_is_company_manager(company_id))',
        tbl || '_insert_manager_scope',
        tbl
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.security_is_company_manager(company_id)) with check (public.security_is_company_manager(company_id))',
        tbl || '_update_manager_scope',
        tbl
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.security_is_company_manager(company_id))',
        tbl || '_delete_manager_scope',
        tbl
      );
    end if;
  end loop;
end
$$;

drop policy if exists "documents_bucket_select_company_scope" on storage.objects;
create policy "documents_bucket_select_company_scope"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and split_part(storage.objects.name, '/', 1) = 'companies'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and public.security_is_company_member((split_part(storage.objects.name, '/', 2))::uuid)
  and (
    split_part(storage.objects.name, '/', 4) !~* '^[0-9a-f-]{36}$'
    or public.security_has_jobsite_access(
      (split_part(storage.objects.name, '/', 2))::uuid,
      (split_part(storage.objects.name, '/', 4))::uuid
    )
  )
);

drop policy if exists "documents_bucket_insert_company_scope" on storage.objects;
create policy "documents_bucket_insert_company_scope"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and split_part(storage.objects.name, '/', 1) = 'companies'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and public.security_can_write_company_data((split_part(storage.objects.name, '/', 2))::uuid)
  and (
    split_part(storage.objects.name, '/', 4) !~* '^[0-9a-f-]{36}$'
    or public.security_has_jobsite_access(
      (split_part(storage.objects.name, '/', 2))::uuid,
      (split_part(storage.objects.name, '/', 4))::uuid
    )
  )
);

drop policy if exists "documents_bucket_update_company_scope" on storage.objects;
create policy "documents_bucket_update_company_scope"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and split_part(storage.objects.name, '/', 1) = 'companies'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and public.security_can_write_company_data((split_part(storage.objects.name, '/', 2))::uuid)
  and (
    split_part(storage.objects.name, '/', 4) !~* '^[0-9a-f-]{36}$'
    or public.security_has_jobsite_access(
      (split_part(storage.objects.name, '/', 2))::uuid,
      (split_part(storage.objects.name, '/', 4))::uuid
    )
  )
)
with check (
  bucket_id = 'documents'
  and split_part(storage.objects.name, '/', 1) = 'companies'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and public.security_can_write_company_data((split_part(storage.objects.name, '/', 2))::uuid)
  and (
    split_part(storage.objects.name, '/', 4) !~* '^[0-9a-f-]{36}$'
    or public.security_has_jobsite_access(
      (split_part(storage.objects.name, '/', 2))::uuid,
      (split_part(storage.objects.name, '/', 4))::uuid
    )
  )
);

drop policy if exists "documents_bucket_delete_company_scope" on storage.objects;
create policy "documents_bucket_delete_company_scope"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and split_part(storage.objects.name, '/', 1) = 'companies'
  and split_part(storage.objects.name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and public.security_can_write_company_data((split_part(storage.objects.name, '/', 2))::uuid)
  and (
    split_part(storage.objects.name, '/', 4) !~* '^[0-9a-f-]{36}$'
    or public.security_has_jobsite_access(
      (split_part(storage.objects.name, '/', 2))::uuid,
      (split_part(storage.objects.name, '/', 4))::uuid
    )
  )
);
