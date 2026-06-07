-- ============================================================
-- Corrective Action Root Cause Analysis System
-- Adds AI-guided RCA sessions, conversation log, findings,
-- and CAPA items to the existing corrective actions system.
-- ============================================================

-- 1. Link column on company_corrective_actions
ALTER TABLE "public"."company_corrective_actions"
  ADD COLUMN IF NOT EXISTS "rca_required" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "rca_session_id" uuid;

-- 2. RCA sessions (one per corrective action)
CREATE TABLE IF NOT EXISTS "public"."ca_rca_sessions" (
  "id"                     uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"             uuid NOT NULL,
  "corrective_action_id"   uuid NOT NULL,
  "rca_method"             text DEFAULT 'five_whys' NOT NULL,
  "status"                 text DEFAULT 'in_progress' NOT NULL,
  "current_step"           text DEFAULT 'problem_statement' NOT NULL,
  "summary"                text,
  "root_cause_confirmed"   text,
  "hse_notified_at"        timestamp with time zone,
  "hse_notified_user_ids"  uuid[] DEFAULT '{}' NOT NULL,
  "approved_by"            uuid,
  "approved_at"            timestamp with time zone,
  "created_by"             uuid,
  "created_at"             timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"             timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ca_rca_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ca_rca_sessions_method_check" CHECK (
    "rca_method" = ANY (ARRAY[
      'five_whys', 'fishbone', 'fault_tree', 'combined'
    ])
  ),
  CONSTRAINT "ca_rca_sessions_status_check" CHECK (
    "status" = ANY (ARRAY[
      'in_progress', 'pending_review', 'approved', 'closed'
    ])
  ),
  CONSTRAINT "ca_rca_sessions_step_check" CHECK (
    "current_step" = ANY (ARRAY[
      'problem_statement', 'immediate_cause', 'contributing_factors',
      'five_whys', 'fishbone', 'systemic_factors', 'capa', 'review'
    ])
  )
);

ALTER TABLE "public"."ca_rca_sessions" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ca_rca_sessions_company_id_idx"
  ON "public"."ca_rca_sessions" ("company_id");

CREATE INDEX IF NOT EXISTS "ca_rca_sessions_corrective_action_id_idx"
  ON "public"."ca_rca_sessions" ("corrective_action_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ca_rca_sessions_one_per_ca"
  ON "public"."ca_rca_sessions" ("corrective_action_id")
  WHERE "status" != 'closed';

-- 3. RCA conversation messages (AI ↔ user per session)
CREATE TABLE IF NOT EXISTS "public"."ca_rca_messages" (
  "id"             uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id"     uuid NOT NULL,
  "company_id"     uuid NOT NULL,
  "role"           text NOT NULL,
  "content"        text NOT NULL,
  "step_key"       text,
  "metadata"       jsonb DEFAULT '{}' NOT NULL,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ca_rca_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ca_rca_messages_role_check" CHECK (
    "role" = ANY (ARRAY['user', 'assistant', 'system'])
  )
);

ALTER TABLE "public"."ca_rca_messages" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ca_rca_messages_session_id_idx"
  ON "public"."ca_rca_messages" ("session_id", "created_at");

CREATE INDEX IF NOT EXISTS "ca_rca_messages_company_id_idx"
  ON "public"."ca_rca_messages" ("company_id");

-- 4. RCA root cause findings (structured output)
CREATE TABLE IF NOT EXISTS "public"."ca_rca_findings" (
  "id"              uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id"      uuid NOT NULL,
  "company_id"      uuid NOT NULL,
  "finding_type"    text NOT NULL,
  "category"        text,
  "description"     text NOT NULL,
  "why_level"       integer,
  "sort_order"      integer DEFAULT 0 NOT NULL,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ca_rca_findings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ca_rca_findings_type_check" CHECK (
    "finding_type" = ANY (ARRAY[
      'immediate_cause', 'contributing_factor',
      'root_cause', 'systemic_factor'
    ])
  ),
  CONSTRAINT "ca_rca_findings_why_level_check" CHECK (
    "why_level" IS NULL OR ("why_level" >= 1 AND "why_level" <= 5)
  )
);

ALTER TABLE "public"."ca_rca_findings" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ca_rca_findings_session_id_idx"
  ON "public"."ca_rca_findings" ("session_id");

-- 5. CAPA items generated from RCA
CREATE TABLE IF NOT EXISTS "public"."ca_rca_capa_items" (
  "id"                uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id"        uuid NOT NULL,
  "company_id"        uuid NOT NULL,
  "corrective_action_id" uuid NOT NULL,
  "title"             text NOT NULL,
  "description"       text,
  "priority"          text DEFAULT 'medium' NOT NULL,
  "status"            text DEFAULT 'open' NOT NULL,
  "assigned_to"       uuid,
  "due_at"            timestamp with time zone,
  "completed_at"      timestamp with time zone,
  "completed_by"      uuid,
  "created_by"        uuid,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"        timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ca_rca_capa_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ca_rca_capa_items_priority_check" CHECK (
    "priority" = ANY (ARRAY['low', 'medium', 'high', 'critical'])
  ),
  CONSTRAINT "ca_rca_capa_items_status_check" CHECK (
    "status" = ANY (ARRAY['open', 'in_progress', 'completed', 'overdue', 'cancelled'])
  )
);

ALTER TABLE "public"."ca_rca_capa_items" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "ca_rca_capa_items_session_id_idx"
  ON "public"."ca_rca_capa_items" ("session_id");

CREATE INDEX IF NOT EXISTS "ca_rca_capa_items_company_id_idx"
  ON "public"."ca_rca_capa_items" ("company_id");

CREATE INDEX IF NOT EXISTS "ca_rca_capa_items_assigned_to_idx"
  ON "public"."ca_rca_capa_items" ("assigned_to")
  WHERE "assigned_to" IS NOT NULL;

-- 6. Foreign keys
ALTER TABLE "public"."ca_rca_sessions"
  ADD CONSTRAINT "ca_rca_sessions_corrective_action_id_fkey"
    FOREIGN KEY ("corrective_action_id")
    REFERENCES "public"."company_corrective_actions" ("id") ON DELETE CASCADE;

ALTER TABLE "public"."ca_rca_messages"
  ADD CONSTRAINT "ca_rca_messages_session_id_fkey"
    FOREIGN KEY ("session_id")
    REFERENCES "public"."ca_rca_sessions" ("id") ON DELETE CASCADE;

ALTER TABLE "public"."ca_rca_findings"
  ADD CONSTRAINT "ca_rca_findings_session_id_fkey"
    FOREIGN KEY ("session_id")
    REFERENCES "public"."ca_rca_sessions" ("id") ON DELETE CASCADE;

ALTER TABLE "public"."ca_rca_capa_items"
  ADD CONSTRAINT "ca_rca_capa_items_session_id_fkey"
    FOREIGN KEY ("session_id")
    REFERENCES "public"."ca_rca_sessions" ("id") ON DELETE CASCADE;

ALTER TABLE "public"."ca_rca_capa_items"
  ADD CONSTRAINT "ca_rca_capa_items_corrective_action_id_fkey"
    FOREIGN KEY ("corrective_action_id")
    REFERENCES "public"."company_corrective_actions" ("id") ON DELETE CASCADE;

-- 7. Link rca_session_id back to session
ALTER TABLE "public"."company_corrective_actions"
  ADD CONSTRAINT "company_corrective_actions_rca_session_id_fkey"
    FOREIGN KEY ("rca_session_id")
    REFERENCES "public"."ca_rca_sessions" ("id") ON DELETE SET NULL;

-- 8. updated_at triggers
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "ca_rca_sessions_updated_at"
  BEFORE UPDATE ON "public"."ca_rca_sessions"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "ca_rca_capa_items_updated_at"
  BEFORE UPDATE ON "public"."ca_rca_capa_items"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

-- 9. RLS: company-scoped access only
ALTER TABLE "public"."ca_rca_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ca_rca_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ca_rca_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ca_rca_capa_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_rca_sessions_company_access" ON "public"."ca_rca_sessions"
  USING (
    "company_id" IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "ca_rca_messages_company_access" ON "public"."ca_rca_messages"
  USING (
    "company_id" IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "ca_rca_findings_company_access" ON "public"."ca_rca_findings"
  USING (
    "company_id" IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "ca_rca_capa_items_company_access" ON "public"."ca_rca_capa_items"
  USING (
    "company_id" IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );
