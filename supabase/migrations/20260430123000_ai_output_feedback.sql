create table if not exists public.ai_output_feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  surface text not null,
  source_id text,
  ai_review_id text,
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  outcome text not null check (outcome in ('accepted', 'edited', 'rejected', 'regenerated', 'field-used')),
  edited_text text,
  reason text,
  created_by uuid
);

create index if not exists ai_output_feedback_created_at_idx
  on public.ai_output_feedback (created_at desc);

create index if not exists ai_output_feedback_surface_created_at_idx
  on public.ai_output_feedback (surface, created_at desc);

alter table public.ai_output_feedback enable row level security;

-- Superadmin AI learning-loop data is service-role only. Route handlers enforce
-- `super_admin` before using the service-role client.
revoke all on public.ai_output_feedback from public;
revoke all on public.ai_output_feedback from authenticated;
revoke all on public.ai_output_feedback from anon;

drop policy if exists "ai_output_feedback_no_authenticated_select" on public.ai_output_feedback;
create policy "ai_output_feedback_no_authenticated_select"
on public.ai_output_feedback
for select
to authenticated
using (false);
