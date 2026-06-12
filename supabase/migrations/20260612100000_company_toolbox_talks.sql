-- ============================================================
-- Toolbox Talks
-- Logs short safety briefings held at the start of each shift.
-- company_id and created_by are auto-set from the JWT context.
-- ============================================================

-- Shared helper: auto-set company_id and created_by from auth JWT
-- SECURITY DEFINER so auth.uid() / session vars are accessible.
CREATE OR REPLACE FUNCTION public.set_company_meta_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT cu.company_id INTO NEW.company_id
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS "public"."company_toolbox_talks" (
  "id"             uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id"     uuid,
  "topic"          text NOT NULL,
  "presenter"      text NOT NULL,
  "talk_date"      date NOT NULL,
  "location"       text NOT NULL,
  "attendee_count" integer NOT NULL DEFAULT 0,
  "notes"          text,
  "created_by"     uuid,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_toolbox_talks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."company_toolbox_talks" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "company_toolbox_talks_company_id_idx"
  ON "public"."company_toolbox_talks" ("company_id");

CREATE INDEX IF NOT EXISTS "company_toolbox_talks_talk_date_idx"
  ON "public"."company_toolbox_talks" ("talk_date" DESC);

-- Trigger: auto-populate company_id and created_by from JWT
CREATE OR REPLACE TRIGGER "company_toolbox_talks_set_meta"
  BEFORE INSERT ON "public"."company_toolbox_talks"
  FOR EACH ROW EXECUTE FUNCTION public.set_company_meta_from_auth();

-- RLS: only show records belonging to the user's company
ALTER TABLE "public"."company_toolbox_talks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_toolbox_talks_select" ON "public"."company_toolbox_talks"
  FOR SELECT USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "company_toolbox_talks_insert" ON "public"."company_toolbox_talks"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "company_toolbox_talks_update" ON "public"."company_toolbox_talks"
  FOR UPDATE USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );

CREATE POLICY "company_toolbox_talks_delete" ON "public"."company_toolbox_talks"
  FOR DELETE USING (
    company_id IN (
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.status = 'active'
    )
  );
