-- Fix auth_rls_initplan performance warnings (Supabase WARN advisors)
-- Replace bare auth.uid() with (select auth.uid()) in USING / WITH CHECK clauses.
-- The wrapped form executes auth.uid() once per query instead of once per row,
-- which eliminates the "init-plan" re-evaluation penalty on large tables.
--
-- Tables fixed here (top 6 by advisor warning count):
--   pshsep_drafts, user_dashboard_layouts, user_onboarding_state,
--   jobsite_weather_subscriptions, company_training_requirements,
--   company_sor_records, company_risk_memory_facets
--
-- Behavior is unchanged. Only execution plan changes (scalar subplan → init plan).

-- ─── pshsep_drafts ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "pshsep_drafts_delete_own" ON public.pshsep_drafts;
DROP POLICY IF EXISTS "pshsep_drafts_select_own" ON public.pshsep_drafts;
DROP POLICY IF EXISTS "pshsep_drafts_update_own" ON public.pshsep_drafts;

CREATE POLICY "pshsep_drafts_delete_own" ON public.pshsep_drafts
  FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "pshsep_drafts_select_own" ON public.pshsep_drafts
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "pshsep_drafts_update_own" ON public.pshsep_drafts
  FOR UPDATE
  USING     ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── user_dashboard_layouts ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_dashboard_layouts_delete_self" ON public.user_dashboard_layouts;
DROP POLICY IF EXISTS "user_dashboard_layouts_select_self" ON public.user_dashboard_layouts;
DROP POLICY IF EXISTS "user_dashboard_layouts_update_self" ON public.user_dashboard_layouts;

CREATE POLICY "user_dashboard_layouts_delete_self" ON public.user_dashboard_layouts
  FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "user_dashboard_layouts_select_self" ON public.user_dashboard_layouts
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "user_dashboard_layouts_update_self" ON public.user_dashboard_layouts
  FOR UPDATE
  USING     ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── user_onboarding_state ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_onboarding_state_delete_self" ON public.user_onboarding_state;
DROP POLICY IF EXISTS "user_onboarding_state_select_self" ON public.user_onboarding_state;
DROP POLICY IF EXISTS "user_onboarding_state_update_self" ON public.user_onboarding_state;

CREATE POLICY "user_onboarding_state_delete_self" ON public.user_onboarding_state
  FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "user_onboarding_state_select_self" ON public.user_onboarding_state
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "user_onboarding_state_update_self" ON public.user_onboarding_state
  FOR UPDATE
  USING     ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── jobsite_weather_subscriptions ───────────────────────────────────────────

DROP POLICY IF EXISTS "jobsite_weather_subscriptions_delete_scope" ON public.jobsite_weather_subscriptions;
DROP POLICY IF EXISTS "jobsite_weather_subscriptions_select_scope" ON public.jobsite_weather_subscriptions;
DROP POLICY IF EXISTS "jobsite_weather_subscriptions_update_scope" ON public.jobsite_weather_subscriptions;

CREATE POLICY "jobsite_weather_subscriptions_delete_scope" ON public.jobsite_weather_subscriptions
  FOR DELETE USING (
    security_is_company_manager(company_id)
    OR ((user_id = (select auth.uid())) AND security_has_jobsite_access(company_id, jobsite_id))
  );

CREATE POLICY "jobsite_weather_subscriptions_select_scope" ON public.jobsite_weather_subscriptions
  FOR SELECT USING (
    security_is_company_manager(company_id)
    OR ((user_id = (select auth.uid())) AND security_has_jobsite_access(company_id, jobsite_id))
  );

CREATE POLICY "jobsite_weather_subscriptions_update_scope" ON public.jobsite_weather_subscriptions
  FOR UPDATE
  USING (
    security_is_company_manager(company_id)
    OR ((user_id = (select auth.uid())) AND security_has_jobsite_access(company_id, jobsite_id))
  )
  WITH CHECK (
    (security_is_company_manager(company_id) OR (user_id = (select auth.uid())))
    AND security_has_jobsite_access(company_id, jobsite_id)
    AND (EXISTS (
      SELECT 1 FROM company_jobsites jobsite
      WHERE jobsite.id = jobsite_weather_subscriptions.jobsite_id
        AND jobsite.company_id = jobsite_weather_subscriptions.company_id
    ))
  );

-- ─── company_training_requirements ───────────────────────────────────────────

DROP POLICY IF EXISTS "company_training_requirements_delete_lead" ON public.company_training_requirements;
DROP POLICY IF EXISTS "company_training_requirements_select_member" ON public.company_training_requirements;
DROP POLICY IF EXISTS "company_training_requirements_update_lead" ON public.company_training_requirements;

CREATE POLICY "company_training_requirements_delete_lead" ON public.company_training_requirements
  FOR DELETE USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships m
      WHERE m.company_id = company_training_requirements.company_id
        AND m.user_id    = (select auth.uid())
        AND COALESCE(m.status, '') = 'active'
        AND COALESCE(m.role, '')   = ANY (ARRAY['company_admin'::text, 'manager'::text, 'safety_manager'::text])
    ))
  );

CREATE POLICY "company_training_requirements_select_member" ON public.company_training_requirements
  FOR SELECT USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships m
      WHERE m.company_id = company_training_requirements.company_id
        AND m.user_id    = (select auth.uid())
        AND COALESCE(m.status, '') = 'active'
    ))
  );

CREATE POLICY "company_training_requirements_update_lead" ON public.company_training_requirements
  FOR UPDATE
  USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships m
      WHERE m.company_id = company_training_requirements.company_id
        AND m.user_id    = (select auth.uid())
        AND COALESCE(m.status, '') = 'active'
        AND COALESCE(m.role, '')   = ANY (ARRAY['company_admin'::text, 'manager'::text, 'safety_manager'::text])
    ))
  )
  WITH CHECK (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships m
      WHERE m.company_id = company_training_requirements.company_id
        AND m.user_id    = (select auth.uid())
        AND COALESCE(m.status, '') = 'active'
        AND COALESCE(m.role, '')   = ANY (ARRAY['company_admin'::text, 'manager'::text, 'safety_manager'::text])
    ))
  );

-- ─── company_sor_records ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sor_admin_supersede_locked" ON public.company_sor_records;
DROP POLICY IF EXISTS "sor_select_company_scope"   ON public.company_sor_records;
DROP POLICY IF EXISTS "sor_update_own_draft_only"  ON public.company_sor_records;

CREATE POLICY "sor_admin_supersede_locked" ON public.company_sor_records
  FOR UPDATE
  USING (
    (status = ANY (ARRAY['submitted'::text, 'locked'::text]))
    AND (
      is_admin_role()
      OR (EXISTS (
        SELECT 1 FROM user_roles actor
        WHERE actor.user_id     = (select auth.uid())
          AND actor.company_id  = company_sor_records.company_id
          AND actor.role        = ANY (ARRAY['company_admin'::text, 'manager'::text, 'admin'::text, 'super_admin'::text, 'platform_admin'::text])
          AND actor.account_status = 'active'
      ))
    )
  )
  WITH CHECK (status = ANY (ARRAY['submitted'::text, 'locked'::text, 'superseded'::text]));

CREATE POLICY "sor_select_company_scope" ON public.company_sor_records
  FOR SELECT USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_sor_records.company_id
    ))
    OR (EXISTS (
      SELECT 1 FROM user_roles actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_sor_records.company_id
        AND actor.account_status = 'active'
    ))
  );

CREATE POLICY "sor_update_own_draft_only" ON public.company_sor_records
  FOR UPDATE
  USING     ((created_by = (select auth.uid())) AND (status = 'draft'::text))
  WITH CHECK ((created_by = (select auth.uid())) AND (status = 'draft'::text));

-- ─── company_risk_memory_facets ───────────────────────────────────────────────

DROP POLICY IF EXISTS "company_risk_memory_facets_delete_scope" ON public.company_risk_memory_facets;
DROP POLICY IF EXISTS "company_risk_memory_facets_select_scope" ON public.company_risk_memory_facets;
DROP POLICY IF EXISTS "company_risk_memory_facets_update_scope" ON public.company_risk_memory_facets;

CREATE POLICY "company_risk_memory_facets_delete_scope" ON public.company_risk_memory_facets
  FOR DELETE USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
    OR (EXISTS (
      SELECT 1 FROM user_roles actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
  );

CREATE POLICY "company_risk_memory_facets_select_scope" ON public.company_risk_memory_facets
  FOR SELECT USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
    OR (EXISTS (
      SELECT 1 FROM user_roles actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
  );

CREATE POLICY "company_risk_memory_facets_update_scope" ON public.company_risk_memory_facets
  FOR UPDATE
  USING (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
    OR (EXISTS (
      SELECT 1 FROM user_roles actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
  )
  WITH CHECK (
    is_admin_role()
    OR (EXISTS (
      SELECT 1 FROM company_memberships actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
    OR (EXISTS (
      SELECT 1 FROM user_roles actor
      WHERE actor.user_id    = (select auth.uid())
        AND actor.company_id = company_risk_memory_facets.company_id
    ))
  );
