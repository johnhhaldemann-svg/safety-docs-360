import { describe, expect, it } from "vitest";
import {
  buildClosedLoopEventMetadata,
  buildClosedLoopLearningEvent,
  buildClosedLoopOutcomeRecord,
} from "@/lib/aiKnowledgeMap/closedLoopOutcomes";

describe("AI recommendation corrective-action outcome learning", () => {
  it("records a verified risk reduction without writing trusted memory", () => {
    const outcome = buildClosedLoopOutcomeRecord({
      recommendation: {
        id: "rec-1",
        title: "Fix exposed cord trip hazard",
        priority: "medium",
        verification_required: true,
        evidence_summary: { riskScore: 52 },
      },
      correctiveAction: {
        id: "ca-1",
        status: "verified_closed",
        created_at: "2026-05-01T00:00:00.000Z",
        closed_at: "2026-05-03T12:00:00.000Z",
      },
      evidenceCount: 2,
      closureNote: "Cord removed from walkway and route verified clear.",
    });
    const learningEvent = buildClosedLoopLearningEvent(outcome);

    expect(outcome.outcomeStatus).toBe("risk_reduced");
    expect(outcome.afterRiskScore).toBeLessThan(outcome.beforeRiskScore ?? 0);
    expect(outcome.wasEffective).toBe(true);
    expect(outcome.trustedMemoryWrite).toBe(false);
    expect(learningEvent.learningType).toBe("control_effectiveness");
    expect(learningEvent.trustedMemoryWrite).toBe(false);
  });

  it("requires Human Review for high-impact learning before memory can change", () => {
    const outcome = buildClosedLoopOutcomeRecord({
      recommendation: {
        id: "rec-2",
        title: "Stop-work review for energized electrical exposure",
        priority: "critical",
        verification_required: true,
        evidence_summary: { riskScore: 91 },
      },
      correctiveAction: {
        id: "ca-2",
        status: "verified_closed",
        created_at: "2026-05-01T00:00:00.000Z",
        closed_at: "2026-05-01T08:00:00.000Z",
      },
      evidenceCount: 1,
    });
    const learningEvent = buildClosedLoopLearningEvent(outcome);
    const metadata = buildClosedLoopEventMetadata({ outcome, learningEvent });

    expect(outcome.humanReviewRequired).toBe(true);
    expect(outcome.reviewStatus).toBe("pending_review");
    expect(learningEvent.humanReviewRequired).toBe(true);
    expect(metadata.officialMapWriteAllowed).toBe(false);
    expect(metadata.recommendationUseAllowed).toBe(false);
    expect(metadata.closedLoopOutcome.trustedMemoryWrite).toBe(false);
  });

  it("does not give outcome credit when the corrective action is not closed", () => {
    const outcome = buildClosedLoopOutcomeRecord({
      recommendation: {
        id: "rec-3",
        title: "Assign housekeeping walkthrough",
        priority: "high",
        verification_required: true,
      },
      correctiveAction: {
        id: "ca-3",
        status: "open",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    });
    const learningEvent = buildClosedLoopLearningEvent(outcome);

    expect(outcome.outcomeStatus).toBe("pending_verification");
    expect(outcome.afterRiskScore).toBeNull();
    expect(outcome.riskReductionPoints).toBe(0);
    expect(outcome.wasEffective).toBeNull();
    expect(learningEvent.learningType).toBe("not_enough_data");
  });

  it("lowers confidence when closure used a manager override", () => {
    const outcome = buildClosedLoopOutcomeRecord({
      recommendation: {
        id: "rec-4",
        title: "Verify barricade corrective action",
        priority: "high",
        verification_required: true,
      },
      correctiveAction: {
        id: "ca-4",
        status: "verified_closed",
        created_at: "2026-05-01T00:00:00.000Z",
        closed_at: "2026-05-01T02:00:00.000Z",
        manager_override_close: true,
      },
      evidenceCount: 0,
    });

    expect(outcome.confidenceScore).toBeLessThan(0.7);
    expect(outcome.humanReviewRequired).toBe(true);
    expect(outcome.reviewReasons.join(" ")).toContain("Low-confidence");
  });
});
