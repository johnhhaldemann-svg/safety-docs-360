create table if not exists public.ai_improvement_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  proposed_by uuid null references auth.users (id) on delete set null,
  created_by_type text not null default 'user',
  status text not null default 'draft',
  risk_level text not null default 'medium',
  affected_area text not null default '',
  branch_name text null,
  pull_request_url text null,
  latest_commit_sha text null,
  test_summary text not null default '',
  codex_summary text not null default '',
  rollback_plan text not null default '',
  checks_passed boolean not null default false,
  super_admin_override_reason text null,
  approved_by_super_admin_id uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  rejected_by_super_admin_id uuid null references auth.users (id) on delete set null,
  rejected_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_improvement_requests_title_not_blank check (length(trim(title)) > 0),
  constraint ai_improvement_requests_created_by_type_check check (
    created_by_type in ('user', 'ai', 'system')
  ),
  constraint ai_improvement_requests_status_check check (
    status in (
      'draft',
      'proposed',
      'in_progress',
      'awaiting_super_admin_approval',
      'approved',
      'rejected',
      'merged',
      'deployed',
      'failed',
      'rolled_back'
    )
  ),
  constraint ai_improvement_requests_risk_level_check check (
    risk_level in ('low', 'medium', 'high', 'critical')
  ),
  constraint ai_improvement_requests_approval_requires_superadmin check (
    status <> 'approved'
    or (
      approved_by_super_admin_id is not null
      and approved_at is not null
      and (
        checks_passed = true
        or length(trim(coalesce(super_admin_override_reason, ''))) > 0
      )
    )
  ),
  constraint ai_improvement_requests_rejection_requires_reason check (
    status <> 'rejected'
    or (
      rejected_by_super_admin_id is not null
      and rejected_at is not null
      and length(trim(coalesce(rejection_reason, ''))) > 0
    )
  )
);

create index if not exists ai_improvement_requests_status_created_idx
  on public.ai_improvement_requests (status, created_at desc);

create index if not exists ai_improvement_requests_risk_created_idx
  on public.ai_improvement_requests (risk_level, created_at desc);

create index if not exists ai_improvement_requests_branch_idx
  on public.ai_improvement_requests (branch_name)
  where branch_name is not null;

drop trigger if exists set_ai_improvement_requests_updated_at on public.ai_improvement_requests;
create trigger set_ai_improvement_requests_updated_at
before update on public.ai_improvement_requests
for each row
execute function public.set_updated_at();

create table if not exists public.ai_improvement_audit_events (
  id uuid primary key default gen_random_uuid(),
  improvement_request_id uuid null references public.ai_improvement_requests (id) on delete set null,
  actor_id uuid null references auth.users (id) on delete set null,
  actor_type text not null default 'system',
  event_type text not null,
  old_status text null,
  new_status text null,
  ip_address text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_improvement_audit_events_actor_type_check check (
    actor_type in ('user', 'ai', 'system')
  ),
  constraint ai_improvement_audit_events_status_check check (
    old_status is null
    or old_status in (
      'draft',
      'proposed',
      'in_progress',
      'awaiting_super_admin_approval',
      'approved',
      'rejected',
      'merged',
      'deployed',
      'failed',
      'rolled_back'
    )
  ),
  constraint ai_improvement_audit_events_new_status_check check (
    new_status is null
    or new_status in (
      'draft',
      'proposed',
      'in_progress',
      'awaiting_super_admin_approval',
      'approved',
      'rejected',
      'merged',
      'deployed',
      'failed',
      'rolled_back'
    )
  ),
  constraint ai_improvement_audit_events_event_type_check check (
    event_type in (
      'ai_improvement_request_created',
      'ai_improvement_request_updated',
      'codex_branch_linked',
      'pull_request_linked',
      'tests_completed',
      'approval_requested',
      'super_admin_approved',
      'super_admin_rejected',
      'unauthorized_approval_attempt',
      'deployment_triggered',
      'rollback_triggered'
    )
  )
);

create index if not exists ai_improvement_audit_events_request_created_idx
  on public.ai_improvement_audit_events (improvement_request_id, created_at desc);

create index if not exists ai_improvement_audit_events_event_created_idx
  on public.ai_improvement_audit_events (event_type, created_at desc);

alter table public.ai_improvement_requests enable row level security;
alter table public.ai_improvement_audit_events enable row level security;

revoke all on public.ai_improvement_requests from public, anon, authenticated;
revoke all on public.ai_improvement_audit_events from public, anon, authenticated;

grant select, insert, update on public.ai_improvement_requests to authenticated;
grant select on public.ai_improvement_audit_events to authenticated;

drop policy if exists "ai_improvement_requests_super_admin_only" on public.ai_improvement_requests;
create policy "ai_improvement_requests_super_admin_only"
on public.ai_improvement_requests
for all
to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

drop policy if exists "ai_improvement_audit_events_super_admin_select" on public.ai_improvement_audit_events;
create policy "ai_improvement_audit_events_super_admin_select"
on public.ai_improvement_audit_events
for select
to authenticated
using (public.current_app_role() = 'super_admin');
