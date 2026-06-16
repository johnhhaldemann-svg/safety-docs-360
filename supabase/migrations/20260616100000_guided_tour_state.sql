-- Migration: 20260616100000_guided_tour_state
-- Adds guided tour tracking columns to user_onboarding_state.
-- guided_tour_completed_at: set when user finishes the tour
-- guided_tour_dismissed_at: set when user explicitly skips/closes tour without finishing

ALTER TABLE "public"."user_onboarding_state"
  ADD COLUMN IF NOT EXISTS "guided_tour_completed_at"  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "guided_tour_dismissed_at"  timestamptz DEFAULT NULL;

COMMENT ON COLUMN "public"."user_onboarding_state"."guided_tour_completed_at"
  IS 'Timestamp when the user completed the full guided product tour. NULL means not yet completed.';

COMMENT ON COLUMN "public"."user_onboarding_state"."guided_tour_dismissed_at"
  IS 'Timestamp when the user dismissed/skipped the guided tour without completing it. NULL means not yet dismissed.';
