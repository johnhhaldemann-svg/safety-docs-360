-- Tighten DELETE policies on safety-critical tables.
--
-- Root cause: security_can_write_company_data() includes field_user, employee,
-- foreman, company_user, and editor roles. This means non-manager users could
-- delete incident reports, corrective actions, and permits — unacceptable for
-- a safety compliance platform.
--
-- Fix: replace security_can_write_company_data() with security_is_company_manager()
-- on DELETE policies for these three tables.
-- security_is_company_manager() allows: platform_admin, super_admin, admin,
--   company_admin, manager, safety_manager only.
--
-- JSA deletes intentionally left at write-scope (field users may delete own drafts).
-- INSERT and UPDATE policies are unchanged.

-- ─── company_incidents ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_incidents_delete_company_scope" ON public.company_incidents;
CREATE POLICY "company_incidents_delete_company_scope" ON public.company_incidents
  FOR DELETE USING (
    security_is_company_manager(company_id)
    AND security_has_jobsite_access(company_id, jobsite_id)
  );

-- ─── company_corrective_actions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "company_corrective_actions_delete_company_scope" ON public.company_corrective_actions;
CREATE POLICY "company_corrective_actions_delete_company_scope" ON public.company_corrective_actions
  FOR DELETE USING (
    security_is_company_manager(company_id)
    AND security_has_jobsite_access(company_id, jobsite_id)
  );

-- ─── company_permits ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_permits_delete_company_scope" ON public.company_permits;
CREATE POLICY "company_permits_delete_company_scope" ON public.company_permits
  FOR DELETE USING (
    security_is_company_manager(company_id)
    AND security_has_jobsite_access(company_id, jobsite_id)
  );
