-- AI reliability observability expansion and async visual job queue.
-- Tables remain service-role only; route handlers enforce app RBAC before
-- reading or mutating job rows.

alter table public.ai_call_log
  add column if not exists trace_id uuid,
  add column if not exists prompt_version text,
  add column if not exists output_schema_version text,
  add column if not exists error_type text,
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists cache_hit boolean not null default false,
  add column if not exists tool_calls_used integer not null default 0 check (tool_calls_used >= 0),
  add column if not exists eval_fixture_id text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer;

update public.ai_call_log
set
  input_tokens = coalesce(input_tokens, prompt_tokens),
  output_tokens = coalesce(output_tokens, completion_tokens),
  retry_count = greatest(0, coalesce(attempts, 1) - 1)
where input_tokens is null
   or output_tokens is null
   or retry_count = 0;

create index if not exists ai_call_log_trace_id_idx
  on public.ai_call_log (trace_id)
  where trace_id is not null;

create index if not exists ai_call_log_surface_latency_created_idx
  on public.ai_call_log (surface, created_at desc, latency_ms);

create index if not exists ai_call_log_error_type_created_idx
  on public.ai_call_log (error_type, created_at desc)
  where error_type is not null;

create table if not exists public.ai_visual_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  company_id uuid not null references public.companies (id) on delete cascade,
  jobsite_id uuid not null references public.company_jobsites (id) on delete cascade,
  site_map_id uuid references public.company_jobsite_site_maps (id) on delete set null,
  blueprint_id uuid references public.company_jobsite_site_blueprints (id) on delete set null,
  render_id uuid references public.company_jobsite_site_renders (id) on delete set null,
  surface text not null default 'jobsite.site-visual.render.generate',
  status text not null default 'queued',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  stage text not null default 'queued',
  prompt_hash text,
  context_hash text,
  token_budget integer not null default 12000 check (token_budget > 0),
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  ai_meta jsonb not null default '{}'::jsonb,
  error_type text,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint ai_visual_generation_jobs_status_check check (
    status in ('queued', 'running', 'ready', 'failed', 'fallback_ready')
  )
);

create index if not exists ai_visual_generation_jobs_company_jobsite_created_idx
  on public.ai_visual_generation_jobs (company_id, jobsite_id, created_at desc);

create index if not exists ai_visual_generation_jobs_status_created_idx
  on public.ai_visual_generation_jobs (status, created_at desc);

create index if not exists ai_visual_generation_jobs_prompt_hash_idx
  on public.ai_visual_generation_jobs (company_id, jobsite_id, prompt_hash, created_at desc)
  where prompt_hash is not null;

alter table public.ai_visual_generation_jobs enable row level security;

revoke all on public.ai_visual_generation_jobs from public;
revoke all on public.ai_visual_generation_jobs from authenticated;
revoke all on public.ai_visual_generation_jobs from anon;
grant select, insert, update, delete on public.ai_visual_generation_jobs to service_role;

drop policy if exists "ai_visual_generation_jobs_no_authenticated_access"
  on public.ai_visual_generation_jobs;
create policy "ai_visual_generation_jobs_no_authenticated_access"
on public.ai_visual_generation_jobs
for all
to authenticated
using (false)
with check (false);
