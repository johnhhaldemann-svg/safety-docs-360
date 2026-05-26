import { describe, expect, it } from "vitest";
import {
  buildActionDecisionForwardBody,
  mapActionDecisionTriggerToWorkflowAction,
  validateActionDecisionExecution,
} from "@/lib/aiActionDecisionWorkflow";

describe("AI action decision workflow mapping", () => {
  it("maps action-word intents onto existing recommendation actions", () => {
    expect(mapActionDecisionTriggerToWorkflowAction("request_assignment")).toMatchObject({ workflowAction: "assign" });
    expect(mapActionDecisionTriggerToWorkflowAction("request_field_verification")).toMatchObject({ workflowAction: "mark_field_used" });
    expect(mapActionDecisionTriggerToWorkflowAction("request_escalation")).toMatchObject({ workflowAction: "stop_work_review" });
    expect(mapActionDecisionTriggerToWorkflowAction("request_resolution")).toMatchObject({ workflowAction: "resolve" });
    expect(mapActionDecisionTriggerToWorkflowAction("request_dismissal")).toMatchObject({ workflowAction: "dismiss" });
    expect(mapActionDecisionTriggerToWorkflowAction("sync_actions")).toMatchObject({ workflowAction: "sync_actions", requiresRecommendation: false });
  });

  it("blocks authority intents instead of mutating workflow records", () => {
    const mapping = mapActionDecisionTriggerToWorkflowAction("blocked_authority");

    expect(mapping).toEqual(
      expect.objectContaining({
        workflowAction: null,
        blocked: true,
        humanReviewRequired: true,
      }),
    );
    expect(mapping.blockedReason).toMatch(/cannot approve/i);
  });

  it("requires field verification before field-used or resolved states", () => {
    expect(validateActionDecisionExecution({
      recommendationId: "rec-1",
      intent: "request_field_verification",
      confirmation: true,
    })).toEqual(
      expect.objectContaining({
        ok: false,
        requiredConfirmationFields: ["fieldVerificationSummary"],
      }),
    );

    expect(validateActionDecisionExecution({
      recommendationId: "rec-1",
      intent: "request_resolution",
      confirmation: true,
      fieldVerificationSummary: "Supervisor verified controls in the field.",
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  it("requires a human reason before dismissal or suppression", () => {
    expect(validateActionDecisionExecution({
      recommendationId: "rec-1",
      intent: "suppress_or_ignore",
      confirmation: true,
    })).toEqual(
      expect.objectContaining({
        ok: false,
        requiredConfirmationFields: ["dismissReason"],
      }),
    );
  });

  it("builds a forward body with audit metadata", () => {
    const mapping = mapActionDecisionTriggerToWorkflowAction("request_resolution");
    const body = buildActionDecisionForwardBody({
      recommendationId: "rec-1",
      triggerId: "trigger-1",
      intent: "request_resolution",
      confirmation: true,
      fieldVerificationSummary: "Controls verified by foreman.",
    }, mapping);

    expect(body).toEqual(
      expect.objectContaining({
        actionType: "resolve",
        evidenceProvided: true,
        actionDecisionIntent: "request_resolution",
        actionDecisionTriggerId: "trigger-1",
      }),
    );
    expect(body.notes).toContain("Field verification summary");
  });
});
