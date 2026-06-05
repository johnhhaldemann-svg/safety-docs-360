-- AI Approval Memory Bank.
--
-- An append-only ledger of every human approve/reject decision made across the
-- platform's review surfaces (starting with Superadmin Prediction Validation, and
-- extensible to AI Knowledge Map candidate/relationship reviews). Unlike the mutable
-- prediction_review_* columns on the source records — which are overwritten on every
-- re-review — this table keeps a permanent, labeled snapshot of WHAT was decided and
-- WHY, so the AI can later learn what is approvable and what is not.
--
-- Server-only: written and read exclusively via service_role (review API routes).
-- RLS is enabled with no client policies on purpose — direct client access is blocked.

create table if not exists public.ai_approval_memory (
  id uuid primary key default gen_random_uuid(),
  -- The label being learned.
  decision text not null,
  -- Which review surface produced the decision.
  surface text not null,
  -- What kind of thing was reviewed (e.g. sor, incident, injury, corrective_action).
  source_type text null,
  source_table text null,
  source_record_id text null,
  company_id uuid null references public.companies(id) on delete set null,
  -- Snapshot of the reviewed content at decision time (the learnable example).
  title text null,
  content text null,
  category text null,
  severity text null,
  risk_level text null,
  -- 1-5 quality rating captured on approvals.
  rating integer null,
  tags text[] not null default '{}',
  -- Free-text reviewer rationale — especially valuable for rejections.
  reason text null,
  -- Structured feature snapshot for future model training / recall.
  features jsonb not null default '{}'::jsonb,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint ai_approval_memory_decision_check check (decision in ('approved', 'rejected')),
  constraint ai_approval_memory_surface_check check (
    surface in ('prediction_validation', 'knowledge_map_candidate', 'knowledge_map_relationship')
  ),
  constraint ai_approval_memory_rating_check check (rating is null or (rating between 1 and 5)),
  constraint ai_approval_memory_features_object check (jsonb_typeof(features) = 'object')
);

create index if not exists ai_approval_memory_surface_decision_idx
  on public.ai_approval_memory(surface, decision, created_at desc);
create index if not exists ai_approval_memory_source_idx
  on public.ai_approval_memory(source_table, source_record_id);
create index if not exists ai_approval_memory_company_idx
  on public.ai_approval_memory(company_id, created_at desc);

alter table public.ai_approval_memory enable row level security;

revoke all on public.ai_approval_memory from public, anon, authenticated;
grant select, insert, update, delete on public.ai_approval_memory to service_role;

comment on table public.ai_approval_memory is
  'Server-only. Append-only memory bank of human approve/reject decisions (Prediction Validation, AI Knowledge Map reviews) used to teach the AI what is approvable. Written and read exclusively via service_role. RLS enabled with no client policies is intentional — blocks direct client access. Do not add permissive policies without security review.';
