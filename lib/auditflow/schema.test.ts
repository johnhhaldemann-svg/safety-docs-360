import { describe, expect, it } from "vitest";
import {
  canSubmitAuditFlowAssignment,
  itemKey,
  normalizeAuditFlowAnswers,
  parseAuditFlowTemplateSchema,
  scoreAuditFlowSubmission,
  validateAuditFlowSubmission,
} from "./schema";

const schema = parseAuditFlowTemplateSchema({
  sections: [
    {
      id: "general",
      title: "General",
      items: [
        { id: "ppe", label: "PPE in use", weight: 2, requireCommentOnFail: true },
        { id: "photo", label: "Photo required", weight: 1, requirePhotoUrl: true },
      ],
    },
  ],
});

describe("AuditFlow schema helpers", () => {
  it("normalizes schema and scores weighted pass/fail answers", () => {
    const answers = normalizeAuditFlowAnswers({
      [itemKey("general", "ppe")]: { value: "pass" },
      [itemKey("general", "photo")]: { value: "fail", comment: "Blocked access", photoUrl: "https://example.test/a.jpg" },
    });

    const score = scoreAuditFlowSubmission(schema, answers);

    expect(score).toMatchObject({
      totalItems: 2,
      answeredItems: 2,
      pass: 1,
      fail: 1,
      possibleWeight: 3,
      earnedWeight: 2,
      compliancePercent: 67,
    });
    expect(score.failedItems[0]?.itemLabel).toBe("Photo required");
  });

  it("requires complete answers, failure comments, photo URLs, and a signature", () => {
    const answers = normalizeAuditFlowAnswers({
      [itemKey("general", "ppe")]: { value: "fail" },
      [itemKey("general", "photo")]: { value: "pass" },
    });

    const validation = validateAuditFlowSubmission(schema, answers, "");

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Signature is required.");
    expect(validation.errors.some((error) => error.includes("needs a comment"))).toBe(true);
    expect(validation.errors.some((error) => error.includes("requires a photo URL"))).toBe(true);
  });

  it("allows managers or the assigned employee to submit an assignment", () => {
    expect(canSubmitAuditFlowAssignment({ role: "field_user", userId: "user-1", assignedUserId: "user-1" })).toBe(true);
    expect(canSubmitAuditFlowAssignment({ role: "field_user", userId: "user-1", assignedUserId: "user-2" })).toBe(false);
    expect(canSubmitAuditFlowAssignment({ role: "safety_manager", userId: "user-1", assignedUserId: "user-2" })).toBe(true);
  });
});
