-- AI server-only tables: document intentional RLS-no-policy posture
-- These tables are accessed exclusively via the service_role key (server-side API routes only).
-- RLS is enabled. Having no client policies is intentional: it blocks all anon/authenticated
-- direct access. The service_role bypasses RLS, so server-side code retains full access.
-- This migration adds COMMENT to each table to silence the Supabase security advisor
-- and make the intent explicit for future reviewers.

COMMENT ON TABLE public.ai_engine_events IS
  'Server-only. Written and read exclusively via service_role (API routes, cron jobs). '
  'RLS enabled with no client policies is intentional — blocks direct client access. '
  'Do not add permissive policies without security review.';

COMMENT ON TABLE public.ai_engine_validation_logs IS
  'Server-only. Written and read exclusively via service_role (superadmin AI Engine routes). '
  'RLS enabled with no client policies is intentional — blocks direct client access. '
  'Do not add permissive policies without security review.';

COMMENT ON TABLE public.ai_knowledge_edges IS
  'Server-only. Written via service_role AI knowledge ingest pipeline. '
  'RLS enabled with no client policies is intentional — blocks direct client access. '
  'Read access is exposed only through server-side safety intelligence API routes.';

COMMENT ON TABLE public.ai_knowledge_ingest_batches IS
  'Server-only. Managed exclusively by the AI knowledge ingest pipeline (service_role). '
  'RLS enabled with no client policies is intentional — blocks direct client access.';

COMMENT ON TABLE public.ai_knowledge_ingest_candidates IS
  'Server-only. Managed exclusively by the AI knowledge ingest pipeline (service_role). '
  'RLS enabled with no client policies is intentional — blocks direct client access.';

COMMENT ON TABLE public.ai_knowledge_map_views IS
  'Server-only. Written by the AI knowledge map pipeline (service_role). '
  'RLS enabled with no client policies is intentional — blocks direct client access.';

COMMENT ON TABLE public.ai_knowledge_nodes IS
  'Server-only. Written via service_role AI knowledge ingest pipeline. '
  'RLS enabled with no client policies is intentional — blocks direct client access. '
  'Read access is exposed only through server-side safety intelligence API routes.';

COMMENT ON TABLE public.ai_vector_memory IS
  'Server-only. Vector embeddings store for company AI memory, managed via service_role. '
  'RLS enabled with no client policies is intentional — blocks direct client access. '
  'Similarity search is exposed only via server-side API routes, never direct table queries.';
