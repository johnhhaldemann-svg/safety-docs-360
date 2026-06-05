create table if not exists public.company_security_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null,
  event_type text not null,
  resource_type text not null,
  resource_id text null,
  title text not null,
  detail text null,
  ip_address text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint company_security_events_event_type_not_blank check (length(trim(event_type)) > 0),
  constraint company_security_events_resource_type_not_blank check (length(trim(resource_type)) > 0),
  constraint company_security_events_title_not_blank check (length(trim(title)) > 0)
);

create index if not exists company_security_events_company_occurred_idx
  on public.company_security_events(company_id, occurred_at desc);

create index if not exists company_security_events_company_type_idx
  on public.company_security_events(company_id, event_type, occurred_at desc);

create index if not exists company_security_events_resource_idx
  on public.company_security_events(company_id, resource_type, resource_id);

create index if not exists company_security_events_metadata_idx
  on public.company_security_events using gin (metadata);

create table if not exists public.company_data_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_type text not null,
  request_scope text not null,
  subject_user_id uuid null references auth.users(id) on delete set null,
  subject_email text null,
  jobsite_id uuid null references public.company_jobsites(id) on delete set null,
  document_id uuid null references public.documents(id) on delete set null,
  status text not null default 'submitted',
  requested_by uuid null references auth.users(id) on delete set null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  completed_by uuid null references auth.users(id) on delete set null,
  title text not null,
  description text null,
  reviewer_notes text null,
  completion_evidence text null,
  evidence_storage_path text null,
  metadata jsonb not null default '{}'::jsonb,
  due_at timestamptz null,
  reviewed_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_data_requests_request_type_check check (
    request_type in ('export', 'deletion', 'correction', 'privacy_review')
  ),
  constraint company_data_requests_request_scope_check check (
    request_scope in ('company', 'jobsite', 'user', 'document', 'other')
  ),
  constraint company_data_requests_status_check check (
    status in ('submitted', 'reviewing', 'waiting_on_customer', 'completed', 'denied', 'canceled')
  ),
  constraint company_data_requests_title_not_blank check (length(trim(title)) > 0)
);

create index if not exists company_data_requests_company_created_idx
  on public.company_data_requests(company_id, created_at desc);

create index if not exists company_data_requests_company_status_idx
  on public.company_data_requests(company_id, status, updated_at desc);

create index if not exists company_data_requests_subject_user_idx
  on public.company_data_requests(company_id, subject_user_id)
  where subject_user_id is not null;

create index if not exists company_data_requests_subject_email_idx
  on public.company_data_requests(company_id, lower(subject_email))
  where subject_email is not null;

drop trigger if exists set_company_data_requests_updated_at on public.company_data_requests;
create trigger set_company_data_requests_updated_at
before update on public.company_data_requests
for each row
execute function public.set_updated_at();

alter table public.company_security_events enable row level security;
alter table public.company_data_requests enable row level security;

grant select, insert on public.company_security_events to authenticated;
grant select, insert, update on public.company_data_requests to authenticated;
grant select, insert, update, delete on public.company_security_events to service_role;
grant select, insert, update, delete on public.company_data_requests to service_role;

drop policy if exists "company_security_events_select_manager_scope" on public.company_security_events;
create policy "company_security_events_select_manager_scope"
on public.company_security_events
for select
to authenticated
using (public.security_is_company_manager(company_id));

drop policy if exists "company_security_events_insert_member_scope" on public.company_security_events;
create policy "company_security_events_insert_member_scope"
on public.company_security_events
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.security_is_company_member(company_id)
);

drop policy if exists "company_data_requests_select_manager_scope" on public.company_data_requests;
create policy "company_data_requests_select_manager_scope"
on public.company_data_requests
for select
to authenticated
using (public.security_is_company_manager(company_id));

drop policy if exists "company_data_requests_insert_manager_scope" on public.company_data_requests;
create policy "company_data_requests_insert_manager_scope"
on public.company_data_requests
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.security_is_company_manager(company_id)
);

drop policy if exists "company_data_requests_update_manager_scope" on public.company_data_requests;
create policy "company_data_requests_update_manager_scope"
on public.company_data_requests
for update
to authenticated
using (public.security_is_company_manager(company_id))
with check (public.security_is_company_manager(company_id));
