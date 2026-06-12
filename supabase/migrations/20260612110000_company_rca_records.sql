-- ============================================================
-- RCA Records
-- Standalone Root Cause Analysis investigations (not tied to
-- ca_rca_sessions — those are CA-linked AI-guided sessions).
-- This table backs the SafePredict /rca page directly.
-- company_id and created_by auto-set via trigger from JWT.
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."company_rca_records" (
  "id"                        uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"                uuid,
  "incident_title"            text NOT NULL,
  "rca_method"                text NOT NULL DEFAULT '5-Why Analysis',
  "status"                    text NOT NULL DEFAULT 'open',
  "assigned_investigator"     text,
  "due_date"                  date,
  "initial_findings"          text,
  "root_cause_summary"        text,
  "linked_corrective_actions" integer DEFAULT 0 NOT NULL,
  "created_by"                uuid,
  "created_at"                timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_rca_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_rca_records_status_check" CHECK (
    "status" = ANY (ARRAY['open', 'in_review', 'completed'])
  )
);

ALTER TABLE "public"."company_rca_records" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "company_rca_records_company_id_idx"
  ON "public"."company_rca_records" ("company_id");

CREATE INDEX IF NOT EXISTS "company_rca_records_status_idx"
  ON "public"."company_rca_records" ("status");

CREATE INDEX IF NOT EXISTS "company_rca_records_created_at_idx"
  ON "public"."company_rca_records" ("created_at" DESC);

-- Trigger: auto-populate company_id and created_by from JWT
-- (reuses function created in 20260612100000_company_toolbox_talks)
CREATE OR REPLACE TRIGGER "company_rca_records_set_meta"
  BEFORE INSERT ON "public"."company_rca_records"
  FOR EACH ROW EXECUTE FUNCTION public.set_company_meta_from_auth();

-- updated_at trigger
CREATE OR REPLACE TRIGGER "company_rca_records_updated_at"
  BEFORE UPDATE ON "public"."company_rca_records"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE "public"."company_rca_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_rca_records_select" ON "public"."company_rca_records"
  FOR SELECT USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "company_rca_records_insert" ON "public"."company_rca_records"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "company_rca_records_update" ON "public"."company_rca_records"
  FOR UPDATE USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "company_rca_records_delete" ON "public"."company_rca_records"
  FOR DELETE USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );
