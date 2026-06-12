-- ============================================================
-- JSA Evidence (Photo Attachments)
-- Stores references to photos uploaded from the mobile app
-- against a specific JSA. company_id and created_by are
-- passed explicitly by the API route (no trigger needed).
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."company_jsa_evidence" (
  "id"           uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"   uuid NOT NULL,
  "jsa_id"       uuid NOT NULL,
  "jobsite_id"   uuid,
  "file_path"    text NOT NULL,
  "file_name"    text NOT NULL,
  "mime_type"    text,
  "created_by"   uuid,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_jsa_evidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."company_jsa_evidence" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "company_jsa_evidence_company_id_idx"
  ON "public"."company_jsa_evidence" ("company_id");

CREATE INDEX IF NOT EXISTS "company_jsa_evidence_jsa_id_idx"
  ON "public"."company_jsa_evidence" ("jsa_id");

CREATE INDEX IF NOT EXISTS "company_jsa_evidence_jobsite_id_idx"
  ON "public"."company_jsa_evidence" ("jobsite_id")
  WHERE "jobsite_id" IS NOT NULL;

-- RLS: company-scoped access via API route (service role bypasses RLS);
-- also allow authenticated users in same company to read evidence.
ALTER TABLE "public"."company_jsa_evidence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_jsa_evidence_select" ON "public"."company_jsa_evidence"
  FOR SELECT USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "company_jsa_evidence_insert" ON "public"."company_jsa_evidence"
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "company_jsa_evidence_delete" ON "public"."company_jsa_evidence"
  FOR DELETE USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );
