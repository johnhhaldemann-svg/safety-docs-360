import { describe, expect, it } from "vitest";
import { requireHumanReview, sanitizeGusMessage, sanitizeGusTriggerLanguage } from "@/lib/gus/gusSafetyGate";
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

  it("rewrites Gus-facing trigger vocabulary without weakening the safety meaning", () => {
    const message = sanitizeGusTriggerLanguage(
      "Action words: Review, verify, confirm, inspect, assign, resolve, dismiss, ignore, pause, stop, hold, create, sync, and brief the next actions.",
    );

    expect(message).toContain("safety cue");
    expect(message).toContain("check");
    expect(message).not.toContain("human safety check critical controls");
    expect(message).toContain("field-check");
    expect(message).toContain("make sure");
    expect(message).toContain("name an owner");
    expect(message).toContain("do not continue");
    expect(message).toContain("next safe steps");
    expect(message).not.toMatch(
      /\baction words?\b|\breview\b|\bverify\b|\bconfirm\b|\binspect\b|\bassign\b|\bresolve\b|\bdismiss\b|\bignore\b|\bpause\b|\bstop\b|\bhold\b|\bcreate\b|\bsync\b/i,
    );
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

  it("uses safety lead language for Gus-facing review wording", () => {
    expect(sanitizeGusTriggerLanguage("Human review before work starts.")).toBe("Safety lead check before work starts.");
    expect(sanitizeGusTriggerLanguage("Ask the human reviewer to review critical controls.")).toBe(
      "Ask the safety lead to walk critical controls.",
    );
    expect(sanitizeGusTriggerLanguage("Review risk and confirm the owner.")).toBe("Walk risk drivers and make sure the owner is clear.");
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
