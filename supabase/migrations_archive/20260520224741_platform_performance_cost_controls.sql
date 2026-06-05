-- Performance and cost controls for production Supabase/Vercel operation.
-- Keep this migration idempotent because many of these tables were introduced
-- across separate feature migrations and may differ on old preview databases.

create table if not exists public.platform_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  duration_ms integer null,
  processed_count integer null,
  error_code text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_job_runs_status_check check (
    status in ('running', 'succeeded', 'failed', 'partial')
  )
);

alter table public.platform_job_runs enable row level security;
revoke all on public.platform_job_runs from anon, authenticated;
grant select, insert, update, delete on public.platform_job_runs to service_role;

drop policy if exists platform_job_runs_no_authenticated_access on public.platform_job_runs;
create policy platform_job_runs_no_authenticated_access
on public.platform_job_runs
for all
to authenticated
using (false)
with check (false);

create index if not exists platform_job_runs_job_started_idx
  on public.platform_job_runs(job_name, started_at desc);
create index if not exists platform_job_runs_status_started_idx
  on public.platform_job_runs(status, started_at desc);

alter table if exists public.company_ai_reviews
  add column if not exists input_snapshot_storage_path text null,
  add column if not exists ai_summary_storage_path text null;

alter table if exists public.company_generated_documents
  add column if not exists html_preview_storage_path text null,
  add column if not exists draft_json_storage_path text null,
  add column if not exists payload_hot_until timestamptz null;
alter table if exists public.company_generated_documents
  alter column draft_json drop not null;

alter table if exists public.company_generated_document_versions
  add column if not exists html_preview_storage_path text null,
  add column if not exists draft_json_storage_path text null,
  add column if not exists payload_hot_until timestamptz null;
alter table if exists public.company_generated_document_versions
  alter column draft_json drop not null;

alter table if exists public.company_safety_intelligence_audit_log
  add column if not exists payload_storage_path text null;

alter table if exists public.company_safety_intelligence_history
  add column if not exists old_record_storage_path text null,
  add column if not exists new_record_storage_path text null;

do $$
begin
  if to_regclass('public.company_ai_reviews') is not null then
    execute 'create index if not exists company_ai_reviews_bucket_run_id_idx on public.company_ai_reviews(bucket_run_id)';
    execute 'create index if not exists company_ai_reviews_created_by_idx on public.company_ai_reviews(created_by)';
    execute 'create index if not exists company_ai_reviews_updated_by_idx on public.company_ai_reviews(updated_by)';
    execute 'create index if not exists company_ai_reviews_jobsite_id_idx on public.company_ai_reviews(jobsite_id)';
  end if;

  if to_regclass('public.company_bucket_runs') is not null then
    execute 'create index if not exists company_bucket_runs_created_by_idx on public.company_bucket_runs(created_by)';
    execute 'create index if not exists company_bucket_runs_jobsite_id_idx on public.company_bucket_runs(jobsite_id)';
  end if;

  if to_regclass('public.company_bucket_items') is not null then
    execute 'create index if not exists company_bucket_items_bucket_run_id_idx on public.company_bucket_items(bucket_run_id)';
    execute 'create index if not exists company_bucket_items_jobsite_id_idx on public.company_bucket_items(jobsite_id)';
    execute 'create index if not exists company_bucket_items_created_by_idx on public.company_bucket_items(created_by)';
    execute 'create index if not exists company_bucket_items_updated_by_idx on public.company_bucket_items(updated_by)';
  end if;

  if to_regclass('public.company_auditflow_assignments') is not null then
    execute 'create index if not exists company_auditflow_assignments_assigned_user_id_idx on public.company_auditflow_assignments(assigned_user_id)';
    execute 'create index if not exists company_auditflow_assignments_created_by_idx on public.company_auditflow_assignments(created_by)';
    execute 'create index if not exists company_auditflow_assignments_jobsite_id_idx on public.company_auditflow_assignments(jobsite_id)';
    execute 'create index if not exists company_auditflow_assignments_template_id_idx on public.company_auditflow_assignments(template_id)';
    execute 'create index if not exists company_auditflow_assignments_template_version_id_idx on public.company_auditflow_assignments(template_version_id)';
    execute 'create index if not exists company_auditflow_assignments_updated_by_idx on public.company_auditflow_assignments(updated_by)';
  end if;

  if to_regclass('public.company_auditflow_submissions') is not null then
    execute 'create index if not exists company_auditflow_submissions_assignment_id_idx on public.company_auditflow_submissions(assignment_id)';
    execute 'create index if not exists company_auditflow_submissions_jobsite_id_idx on public.company_auditflow_submissions(jobsite_id)';
    execute 'create index if not exists company_auditflow_submissions_submitted_by_idx on public.company_auditflow_submissions(submitted_by)';
    execute 'create index if not exists company_auditflow_submissions_reviewed_by_idx on public.company_auditflow_submissions(reviewed_by)';
    execute 'create index if not exists company_auditflow_submissions_template_id_idx on public.company_auditflow_submissions(template_id)';
    execute 'create index if not exists company_auditflow_submissions_template_version_id_idx on public.company_auditflow_submissions(template_version_id)';
  end if;

  if to_regclass('public.billing_events') is not null then
    execute 'create index if not exists billing_events_created_by_user_id_idx on public.billing_events(created_by_user_id)';
  end if;

  if to_regclass('public.billing_invoice_payments') is not null then
    execute 'create index if not exists billing_invoice_payments_created_by_user_id_idx on public.billing_invoice_payments(created_by_user_id)';
  end if;

  if to_regclass('public.billing_invoices') is not null then
    execute 'create index if not exists billing_invoices_created_by_user_id_idx on public.billing_invoices(created_by_user_id)';
  end if;

  if to_regclass('public.billing_staff_company_assignments') is not null then
    execute 'create index if not exists billing_staff_company_assignments_created_by_idx on public.billing_staff_company_assignments(created_by)';
  end if;

  if to_regclass('public.behavior_risk_events') is not null then
    execute 'create index if not exists behavior_risk_events_crew_id_idx on public.behavior_risk_events(crew_id)';
    execute 'create index if not exists behavior_risk_events_jobsite_id_idx on public.behavior_risk_events(jobsite_id)';
    execute 'create index if not exists behavior_risk_events_supervisor_id_idx on public.behavior_risk_events(supervisor_id)';
  end if;

  if to_regclass('public.company_corrective_action_events') is not null then
    execute 'create index if not exists company_corrective_action_events_action_id_idx on public.company_corrective_action_events(action_id)';
    execute 'create index if not exists company_corrective_action_events_created_by_idx on public.company_corrective_action_events(created_by)';
  end if;
end $$;

-- Drop legacy duplicate permissive policies that overlap newer company-scoped
-- policies. The newer policies remain in place and preserve the app's access
-- model while reducing policy evaluation work per request.
drop policy if exists documents_select_own_admin_or_approved on public.documents;
drop policy if exists documents_insert_own_or_admin on public.documents;
drop policy if exists documents_update_own_or_admin on public.documents;

drop policy if exists company_daps_select_company_scope on public.company_jsas;
drop policy if exists company_daps_insert_company_scope on public.company_jsas;
drop policy if exists company_daps_update_company_scope on public.company_jsas;

drop policy if exists subscriptions_select_own_or_admin on public.subscriptions;
drop policy if exists "users can view own subscription" on public.subscriptions;

drop policy if exists submissions_select_own_or_admin on public.submissions;
drop policy if exists submissions_insert_own_or_admin on public.submissions;

drop policy if exists document_downloads_select_own_or_admin on public.document_downloads;
drop policy if exists document_downloads_insert_authenticated on public.document_downloads;

drop policy if exists credit_transactions_select_own_or_admin on public.credit_transactions;

create or replace function public.platform_performance_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  slow_queries jsonb := '[]'::jsonb;
  top_tables jsonb := '[]'::jsonb;
  duplicate_policy_count integer := 0;
  missing_fk_index_count integer := 0;
  rls_enabled_no_policy_count integer := 0;
begin
  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
  into top_tables
  from (
    select
      relname as table_name,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      seq_scan,
      idx_scan,
      pg_total_relation_size(relid) as total_bytes
    from pg_stat_user_tables
    where schemaname = 'public'
    order by pg_total_relation_size(relid) desc
    limit 20
  ) row_data;

  select count(*)
  into duplicate_policy_count
  from (
    select schemaname, tablename, roles::text, cmd
    from pg_policies
    where schemaname = 'public'
    group by schemaname, tablename, roles::text, cmd
    having count(*) > 1
  ) duplicate_policies;

  select count(*)
  into missing_fk_index_count
  from pg_constraint c
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = c.conrelid
        and i.indisvalid
        and array(
          select key.attnum::smallint
          from unnest(i.indkey) with ordinality as key(attnum, ord)
          where key.ord <= cardinality(c.conkey)
          order by key.ord
        )::smallint[] = c.conkey
    );

  select count(*)
  into rls_enabled_no_policy_count
  from pg_class cls
  join pg_namespace ns on ns.oid = cls.relnamespace
  left join pg_policies pol
    on pol.schemaname = ns.nspname
   and pol.tablename = cls.relname
  where ns.nspname = 'public'
    and cls.relkind = 'r'
    and cls.relrowsecurity
    and pol.policyname is null;

  if exists (select 1 from pg_extension where extname = 'pg_stat_statements') then
    execute $slow$
      select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)
      from (
        select
          calls,
          round(total_exec_time::numeric, 2) as total_exec_ms,
          round(mean_exec_time::numeric, 2) as mean_exec_ms,
          rows,
          left(regexp_replace(query, '\s+', ' ', 'g'), 220) as query_sample
        from pg_stat_statements
        where dbid = (select oid from pg_database where datname = current_database())
        order by total_exec_time desc
        limit 10
      ) row_data
    $slow$
    into slow_queries;
  end if;

  return jsonb_build_object(
    'topTables', top_tables,
    'slowQueries', slow_queries,
    'advisorSummary', jsonb_build_object(
      'duplicatePolicyGroups', duplicate_policy_count,
      'missingForeignKeyIndexes', missing_fk_index_count,
      'rlsEnabledNoPolicyTables', rls_enabled_no_policy_count
    ),
    'capturedAt', now()
  );
end;
$$;

revoke all on function public.platform_performance_snapshot() from public, anon, authenticated;
grant execute on function public.platform_performance_snapshot() to service_role;
