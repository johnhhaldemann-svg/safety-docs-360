-- Reset only isolated demo workspaces. This script intentionally never targets
-- companies unless public.companies.demo_company = true.

update public.company_sor_records sor
set is_deleted = true,
    updated_at = now()
where sor.company_id in (
  select id from public.companies where demo_company = true
)
and sor.is_deleted = false
and sor.status not in ('submitted', 'locked', 'superseded');

delete from public.company_corrective_action_events
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_corrective_action_evidence
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_risk_events
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_microsoft_project_assignments
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_microsoft_project_tasks
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_microsoft_project_sources
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_integration_sync_runs
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_integration_connections
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_induction_completions
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_induction_requirements
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_induction_programs
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_training_requirements
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_permits
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_incidents
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_jsa_activities
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_jsas
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_corrective_actions
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_jobsites
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_subscriptions
where company_id in (select id from public.companies where demo_company = true);

delete from public.company_memberships
where company_id in (select id from public.companies where demo_company = true);

delete from public.companies
where demo_company = true;
