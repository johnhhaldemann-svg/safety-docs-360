-- Targeted performance indexes for high-frequency list/dashboard queries.
-- Built with defensive existence checks to stay compatible across schema variants.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'documents'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'created_at'
    ) then
      execute 'create index if not exists documents_created_at_desc_idx on public.documents (created_at desc)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'user_id'
    ) then
      execute 'create index if not exists documents_user_id_created_at_idx on public.documents (user_id, created_at desc)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'company_id'
    ) then
      execute 'create index if not exists documents_company_id_created_at_idx on public.documents (company_id, created_at desc)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'status'
    ) then
      execute 'create index if not exists documents_status_created_at_idx on public.documents (status, created_at desc)';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'documents' and column_name = 'document_type'
    ) then
      execute 'create index if not exists documents_document_type_created_at_idx on public.documents (document_type, created_at desc)';
    end if;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_corrective_actions'
  ) then
    execute 'create index if not exists company_corrective_actions_company_status_created_idx on public.company_corrective_actions (company_id, status, created_at desc)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_incidents'
  ) then
    execute 'create index if not exists company_incidents_company_status_created_idx on public.company_incidents (company_id, status, created_at desc)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_permits'
  ) then
    execute 'create index if not exists company_permits_company_status_created_idx on public.company_permits (company_id, status, created_at desc)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_daps'
  ) then
    execute 'create index if not exists company_daps_company_status_created_idx on public.company_daps (company_id, status, created_at desc)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_reports'
  ) then
    execute 'create index if not exists company_reports_company_status_created_idx on public.company_reports (company_id, status, created_at desc)';
  end if;
end
$$;
