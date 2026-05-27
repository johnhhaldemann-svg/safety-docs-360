/*
  SafetyDocs360 Supabase data readiness audit.
  Read-only and aggregate-only: returns counts/status only.
*/

with active_companies as (
  select id
  from public.companies
  where archived_at is null
    and coalesce(status, '') <> 'archived'
),
company_rollup as (
  select
    c.id,
    exists (select 1 from public.company_memberships m where m.company_id = c.id and coalesce(m.status, '') in ('active', 'approved', 'accepted')) as has_active_membership,
    exists (select 1 from public.company_subscriptions s where s.company_id = c.id) as has_subscription,
    exists (select 1 from public.company_jobsites j where j.company_id = c.id and j.archived_at is null) as has_jobsite,
    exists (select 1 from public.company_employee_profiles e where e.company_id = c.id and e.archived_at is null) as has_employee_profiles,
    exists (select 1 from public.company_employee_training_records tr where tr.company_id = c.id) as has_training_records,
    exists (select 1 from public.company_training_requirements req where req.company_id = c.id and coalesce(req.active, true)) as has_training_requirements,
    exists (select 1 from public.company_jsas jsa where jsa.company_id = c.id) as has_jsas,
    exists (select 1 from public.company_permits p where p.company_id = c.id) as has_permits,
    exists (select 1 from public.company_incidents i where i.company_id = c.id) as has_incidents,
    exists (select 1 from public.company_corrective_actions ca where ca.company_id = c.id and coalesce(ca.is_deleted, false) = false) as has_corrective_actions,
    exists (select 1 from public.company_reports r where r.company_id = c.id) as has_reports,
    exists (select 1 from public.company_jobsite_schedule_items sched where sched.company_id = c.id and sched.archived_at is null) as has_schedule_items,
    exists (select 1 from public.company_jobsite_emergency_profiles eap where eap.company_id = c.id and eap.archived_at is null) as has_emergency_profiles,
    exists (select 1 from public.company_risk_scores rs where rs.company_id = c.id) as has_risk_scores,
    exists (select 1 from public.company_risk_ai_recommendations rr where rr.company_id = c.id) as has_risk_recommendations,
    exists (select 1 from public.company_memory_items mem where mem.company_id = c.id) as has_memory_items
  from active_companies c
),
active_jobsites as (
  select *
  from public.company_jobsites
  where archived_at is null
),
public_table_grants as (
  select grantee, privilege_type, count(distinct table_name)::bigint as table_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  group by grantee, privilege_type
),
security_definer_functions as (
  select
    p.oid,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
),
storage_policy_rollup as (
  select
    count(*)::bigint as policy_count,
    count(*) filter (where lower(policyname) in ('allow authenticated read', 'allow authenticated upload'))::bigint as generic_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
)
select * from (
  values
    ('migration_health', 'migration_count', (select count(*)::text from supabase_migrations.schema_migrations), 'info', 'Remote migration history count.'),
    ('migration_health', 'latest_migration', (select max(version)::text from supabase_migrations.schema_migrations), 'info', 'Latest remote migration version.'),

    ('safety_readiness', 'active_companies', (select count(*)::text from company_rollup), 'info', 'Companies not archived.'),
    ('safety_readiness', 'companies_missing_active_membership', (select count(*)::text from company_rollup where not has_active_membership), 'needs_review', 'No active/accepted company member.'),
    ('safety_readiness', 'companies_missing_subscription', (select count(*)::text from company_rollup where not has_subscription), 'needs_review', 'No subscription record.'),
    ('safety_readiness', 'companies_missing_jobsite', (select count(*)::text from company_rollup where not has_jobsite), 'needs_review', 'No active jobsite.'),
    ('safety_readiness', 'companies_missing_employee_profiles', (select count(*)::text from company_rollup where not has_employee_profiles), 'needs_review', 'No active employee profile roster.'),
    ('safety_readiness', 'companies_missing_training_requirements', (select count(*)::text from company_rollup where not has_training_requirements), 'needs_review', 'No active training requirement catalog.'),
    ('safety_readiness', 'companies_missing_training_records', (select count(*)::text from company_rollup where not has_training_records), 'needs_review', 'No employee training completion records.'),
    ('safety_readiness', 'companies_missing_jsas', (select count(*)::text from company_rollup where not has_jsas), 'needs_review', 'No JSA records.'),
    ('safety_readiness', 'companies_missing_permits', (select count(*)::text from company_rollup where not has_permits), 'needs_review', 'No permit records.'),
    ('safety_readiness', 'companies_missing_incidents', (select count(*)::text from company_rollup where not has_incidents), 'needs_review', 'No incident history; valid for new accounts but weakens predictions.'),
    ('safety_readiness', 'companies_missing_corrective_actions', (select count(*)::text from company_rollup where not has_corrective_actions), 'needs_review', 'No corrective action history.'),
    ('safety_readiness', 'companies_missing_reports', (select count(*)::text from company_rollup where not has_reports), 'needs_review', 'No generated report records.'),
    ('safety_readiness', 'companies_missing_schedule_items', (select count(*)::text from company_rollup where not has_schedule_items), 'needs_review', 'No schedule items.'),
    ('safety_readiness', 'companies_missing_emergency_profiles', (select count(*)::text from company_rollup where not has_emergency_profiles), 'urgent', 'No emergency action profiles.'),
    ('safety_readiness', 'companies_missing_risk_scores', (select count(*)::text from company_rollup where not has_risk_scores), 'urgent', 'No computed risk scores.'),
    ('safety_readiness', 'companies_missing_risk_recommendations', (select count(*)::text from company_rollup where not has_risk_recommendations), 'needs_review', 'No risk recommendations.'),
    ('safety_readiness', 'companies_missing_memory_items', (select count(*)::text from company_rollup where not has_memory_items), 'needs_review', 'No memory items for contextual safety intelligence.'),

    ('jobsite_readiness', 'active_jobsites', (select count(*)::text from active_jobsites), 'info', 'Jobsites not archived.'),
    ('jobsite_readiness', 'jobsites_missing_project_number', (select count(*)::text from active_jobsites where nullif(trim(project_number), '') is null), 'needs_review', 'Project number supports audit traceability.'),
    ('jobsite_readiness', 'jobsites_missing_location', (select count(*)::text from active_jobsites where nullif(trim(location), '') is null), 'urgent', 'Location is required for emergency/weather workflows.'),
    ('jobsite_readiness', 'jobsites_missing_dates', (select count(*)::text from active_jobsites where start_date is null or end_date is null), 'needs_review', 'Dates support schedule prediction and stale jobsite review.'),
    ('jobsite_readiness', 'jobsites_missing_project_manager', (select count(*)::text from active_jobsites where nullif(trim(project_manager), '') is null), 'needs_review', 'Project manager helps route owner actions.'),
    ('jobsite_readiness', 'jobsites_missing_safety_lead', (select count(*)::text from active_jobsites where nullif(trim(safety_lead), '') is null), 'urgent', 'Safety lead supports urgent escalation routing.'),
    ('jobsite_readiness', 'jobsites_missing_weather_address', (select count(*)::text from active_jobsites where coalesce(nullif(trim(weather_address_line_1), ''), nullif(trim(weather_city), ''), nullif(trim(weather_state), ''), nullif(trim(zip_code), '')) is null), 'needs_review', 'Weather address supports weather risk predictions.'),
    ('jobsite_readiness', 'jobsites_missing_weather_grid', (select count(*)::text from active_jobsites where weather_enabled is true and (nws_grid_id is null or nws_grid_x is null or nws_grid_y is null)), 'needs_review', 'Weather-enabled jobsites should have NWS grid metadata.'),
    ('jobsite_readiness', 'jobsites_missing_emergency_profile', (select count(*)::text from active_jobsites j where not exists (select 1 from public.company_jobsite_emergency_profiles e where e.jobsite_id = j.id and e.archived_at is null)), 'urgent', 'Every active jobsite should have an emergency action profile.'),
    ('jobsite_readiness', 'jobsites_missing_schedule_items', (select count(*)::text from active_jobsites j where not exists (select 1 from public.company_jobsite_schedule_items s where s.jobsite_id = j.id and s.archived_at is null)), 'needs_review', 'Schedule items drive predictive risk.'),
    ('jobsite_readiness', 'jobsites_missing_site_map', (select count(*)::text from active_jobsites j where not exists (select 1 from public.company_jobsite_site_maps m where m.jobsite_id = j.id)), 'needs_review', 'Site maps support visual planning.'),

    ('platform_reference', 'library_documents', (select count(*)::text from public.library_documents), 'needs_review', 'Marketplace/library content rows.'),
    ('platform_reference', 'library_categories', (select count(*)::text from public.library_categories), 'needs_review', 'Library taxonomy rows.'),
    ('platform_reference', 'platform_trades', (select count(*)::text from public.platform_trades), 'info', 'Platform trade taxonomy rows.'),
    ('platform_reference', 'platform_sub_trades', (select count(*)::text from public.platform_sub_trades), 'needs_review', 'Sub-trade taxonomy rows.'),
    ('platform_reference', 'platform_task_templates', (select count(*)::text from public.platform_task_templates), 'needs_review', 'Task templates used by safety intelligence.'),
    ('platform_reference', 'platform_jurisdictions', (select count(*)::text from public.platform_jurisdictions), 'info', 'Jurisdiction rows.'),
    ('platform_reference', 'platform_jurisdiction_standards', (select count(*)::text from public.platform_jurisdiction_standards), 'needs_review', 'Do not claim complete coverage without review.'),
    ('platform_reference', 'osha_predictability_baselines', (select count(*)::text from public.osha_predictability_baselines), 'urgent', 'Fallback baselines for prediction when customer data is thin.'),
    ('platform_reference', 'platform_predictability_aggregates', (select count(*)::text from public.platform_predictability_aggregates), 'needs_review', 'Privacy-safe aggregate benchmark buckets.'),

    ('gus_ai_knowledge', 'approved_sources', (select count(*)::text from public.approved_sources), 'urgent', 'Approved source rows used to ground Gus answers.'),
    ('gus_ai_knowledge', 'approved_knowledge', (select count(*)::text from public.approved_knowledge), 'urgent', 'Approved knowledge rows used for source-backed answers.'),
    ('gus_ai_knowledge', 'research_queue', (select count(*)::text from public.research_queue), 'needs_review', 'Research intake queue rows.'),
    ('gus_ai_knowledge', 'knowledge_change_log', (select count(*)::text from public.knowledge_change_log), 'needs_review', 'Knowledge governance rows.'),
    ('gus_ai_knowledge', 'ai_output_feedback', (select count(*)::text from public.ai_output_feedback), 'info', 'AI output feedback rows.'),
    ('gus_ai_knowledge', 'ai_call_log', (select count(*)::text from public.ai_call_log), 'info', 'AI call log rows.'),

    ('revenue_ops', 'billing_customers', (select count(*)::text from public.billing_customers), 'info', 'Billing customer rows.'),
    ('revenue_ops', 'billing_invoices', (select count(*)::text from public.billing_invoices), 'info', 'Billing invoice rows.'),
    ('revenue_ops', 'billing_invoice_payments', (select count(*)::text from public.billing_invoice_payments), 'needs_review', 'Billing payment rows.'),
    ('revenue_ops', 'marketplace_document_purchases', (select count(*)::text from public.marketplace_document_purchases), 'needs_review', 'Company-level marketplace entitlements.'),
    ('revenue_ops', 'company_clients', (select count(*)::text from public.company_clients), 'needs_review', 'Customer/client directory rows.'),
    ('revenue_ops', 'company_finance_transactions', (select count(*)::text from public.company_finance_transactions), 'needs_review', 'Finance transaction rows.'),

    ('storage_posture', 'storage_buckets', (select count(*)::text from storage.buckets), 'info', 'Configured storage buckets.'),
    ('storage_posture', 'public_storage_buckets', (select count(*)::text from storage.buckets where public), 'urgent', 'Expected 0 unless explicitly approved.'),
    ('storage_posture', 'buckets_missing_file_size_limit', (select count(*)::text from storage.buckets where file_size_limit is null), 'needs_review', 'Buckets without upload size caps.'),
    ('storage_posture', 'buckets_missing_mime_allowlist', (select count(*)::text from storage.buckets where allowed_mime_types is null), 'needs_review', 'Buckets without MIME allowlists.'),
    ('storage_posture', 'sumissions_bucket_present', (select count(*)::text from storage.buckets where id = 'sumissions'), 'needs_review', 'Investigate likely legacy typo before removal.'),
    ('storage_posture', 'storage_object_policies', (select policy_count::text from storage_policy_rollup), 'info', 'Total storage.objects policies.'),
    ('storage_posture', 'generic_storage_policies', (select generic_policy_count::text from storage_policy_rollup), 'needs_review', 'Generic policies should become bucket-specific policies.'),

    ('security_posture', 'public_tables', (select count(*)::text from pg_tables where schemaname = 'public'), 'info', 'Public schema tables.'),
    ('security_posture', 'public_tables_without_rls', (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'urgent', 'Expected 0 for exposed schema tables.'),
    ('security_posture', 'anon_select_grants', (select coalesce(max(table_count), 0)::text from public_table_grants where grantee = 'anon' and privilege_type = 'SELECT'), 'needs_review', 'Anon table grants should be least privilege.'),
    ('security_posture', 'anon_write_grants', (select coalesce(sum(table_count), 0)::text from public_table_grants where grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')), 'urgent', 'Anon write grants should be very limited and intentional.'),
    ('security_posture', 'authenticated_select_grants', (select coalesce(max(table_count), 0)::text from public_table_grants where grantee = 'authenticated' and privilege_type = 'SELECT'), 'needs_review', 'Authenticated grants should align to app access.'),
    ('security_posture', 'authenticated_write_grants', (select coalesce(sum(table_count), 0)::text from public_table_grants where grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')), 'needs_review', 'Authenticated write grants should align to app access.'),
    ('security_posture', 'public_security_definer_functions', (select count(*)::text from security_definer_functions), 'needs_review', 'Classify public security-definer functions.'),
    ('security_posture', 'anon_executable_security_definer_functions', (select count(*)::text from security_definer_functions where anon_can_execute), 'urgent', 'Public execution of SECURITY DEFINER functions needs explicit approval.'),
    ('security_posture', 'authenticated_executable_security_definer_functions', (select count(*)::text from security_definer_functions where authenticated_can_execute), 'needs_review', 'Signed-in execution of privileged helpers needs classification.')
) as audit(category, metric, value, status, notes)
order by category, metric;
