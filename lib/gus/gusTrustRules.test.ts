import { describe, expect, it } from "vitest";
import { requireHumanReview, sanitizeGusMessage } from "@/lib/gus/gusSafetyGate";
import { isForbiddenGusAction } from "@/lib/gus/gusTrustRules";
import { validateGusOutput } from "@/lib/gus/gusValidation";

describe("Gus trust and safety guardrails", () => {
  it("blocks forbidden platform actions", () => {
    expect(isForbiddenGusAction("approve_permit")).toBe(true);
    expect(isForbiddenGusAction("submit-jsa")).toBe(true);
    expect(isForbiddenGusAction("recommend_review")).toBe(false);
  });

  it("replaces unsafe approval and release language", () => {
    const message = sanitizeGusMessage(
      "This is approved, compliant, safe to start, released for work, and no review needed."
    );

    expect(message).not.toMatch(/\bapproved\b/i);
    expect(message).not.toMatch(/\bcompliant\b/i);
    expect(message).not.toMatch(/\bsafe to start\b/i);
    expect(message).not.toMatch(/\breleased for work\b/i);
    expect(message).not.toMatch(/\bno review needed\b/i);
    expect(message).toContain("human review is required");
  });

  it("sanitizes output and records validation findings", () => {
    const result = validateGusOutput({
      status: "safe_to_start",
      actionKey: "close_corrective_action",
      message: "No review needed. Work is compliant.",
    });

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.findings.map((finding) => finding.code)).toContain("forbidden_action");
    expect(result.sanitizedOutput).toMatchObject({
      status: "blocked_missing_critical_info",
      actionKey: "recommend_review",
    });
    expect(result.sanitizedOutput.message).toContain("human review is required");
  });

  it("forces human review and draft-only status on plans", () => {
    const plan = requireHumanReview({
      status: "released_for_work",
      actionKey: "approve_permit",
      title: "Lift plan",
    });

    expect(plan).toMatchObject({
      humanReviewRequired: true,
      status: "blocked_missing_critical_info",
      actionKey: "recommend_review",
      title: "Lift plan",
    });
  });
});
