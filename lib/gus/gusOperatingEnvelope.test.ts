import { describe, expect, it } from "vitest";
import {
  classifyGusOperatingLimit,
  evaluateGusAutonomyAction,
  isGusLeftLimitAction,
} from "@/lib/gus/gusOperatingEnvelope";

describe("Gus operating envelope", () => {
  it("allows left-limit autonomous coach actions", () => {
    for (const actionKey of ["coach_user", "give_sitrep", "ask_followup", "prepare_draft_text", "guide_to_risk"]) {
      const decision = evaluateGusAutonomyAction(actionKey);

      expect(decision.allowed).toBe(true);
      expect(decision.blocked).toBe(false);
      expect(decision.action.limit).toBe("left");
      expect(decision.humanReviewRequired).toBe(true);
      expect(isGusLeftLimitAction(actionKey)).toBe(true);
    }
  });

  it("requires confirmation for draft records, saved sessions, and email alerts", () => {
    for (const actionKey of ["create_draft_jsa", "create_draft_permit_checklist", "save_planning_session", "send_email_alert"]) {
      const decision = evaluateGusAutonomyAction(actionKey);

      expect(decision.allowed).toBe(false);
      expect(decision.blocked).toBe(false);
      expect(decision.action.requiresConfirmation).toBe(true);
      expect(decision.action.limit).toBe("confirmation");
    }
  });

  it("blocks right-limit official actions", () => {
    for (const actionKey of ["approve_permit", "submit_jsa", "close_corrective_action", "delete_record", "release_work", "change_training_status", "modify_official_document"]) {
      const decision = evaluateGusAutonomyAction(actionKey);

      expect(decision.allowed).toBe(false);
      expect(decision.blocked).toBe(true);
      expect(decision.action.limit).toBe("right");
      expect(decision.reason).toContain("blocked");
    }
  });

  it("classifies unknown harmless actions as left-limit review support", () => {
    expect(classifyGusOperatingLimit("review_current_page")).toBe("left");
  });
});
