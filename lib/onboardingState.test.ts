import { describe, expect, it } from "vitest";
import { emptyOnboardingState, normalizeOnboardingState } from "@/lib/onboardingState";

describe("onboardingState", () => {
  it("returns an empty onboarding state for missing rows", () => {
    expect(normalizeOnboardingState(null)).toEqual(emptyOnboardingState());
  });

  it("normalizes persisted rows into client-facing onboarding state", () => {
    expect(
      normalizeOnboardingState({
        completed_steps: ["team_invites", "not-a-step", "command_center", "team_invites"],
        dismissed_at: "2026-04-25T12:00:00.000Z",
        last_seen_command_center_at: "2026-04-25T12:15:00.000Z",
      })
    ).toEqual({
      completedSteps: ["team_invites", "command_center"],
      dismissedAt: "2026-04-25T12:00:00.000Z",
      lastSeenCommandCenterAt: "2026-04-25T12:15:00.000Z",
    });
  });
});
