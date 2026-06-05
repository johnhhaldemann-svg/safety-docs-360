import { describe, expect, it } from "vitest";
import { relevanceScore, scoreApprovability, type ApprovalHistoryRow } from "@/lib/aiApprovalRecall";

const approvedFall: ApprovalHistoryRow = {
  decision: "approved",
  surface: "prediction_validation",
  source_type: "incident",
  category: "near_miss",
  title: "Fall from unprotected edge",
  content: "Worker near miss at an unprotected leading edge on the third floor.",
  rating: 5,
};

describe("AI approval recall", () => {
  it("scores relevance higher for matching content + category + source", () => {
    const query = {
      surface: "prediction_validation" as const,
      sourceType: "incident",
      category: "near_miss",
      content: "Near miss at an unprotected edge, worker almost fell.",
    };
    const related = relevanceScore(query, approvedFall);
    const unrelated = relevanceScore(query, {
      decision: "approved",
      source_type: "corrective_action",
      category: "housekeeping",
      title: "Sweep the floor",
      content: "General tidiness reminder.",
    });
    expect(related).toBeGreaterThan(unrelated);
    expect(related).toBeGreaterThan(0.3);
  });

  it("returns no_evidence when nothing is comparable", () => {
    const verdict = scoreApprovability([], { content: "anything" });
    expect(verdict.recommendation).toBe("no_evidence");
    expect(verdict.score).toBeNull();
    expect(verdict.confidence).toBe("none");
  });

  it("recommends likely_approvable when comparable history skews approved", () => {
    const history: ApprovalHistoryRow[] = Array.from({ length: 8 }, (_, i) => ({
      ...approvedFall,
      title: `Fall near miss ${i}`,
    }));
    const verdict = scoreApprovability(history, {
      sourceType: "incident",
      category: "near_miss",
      content: "Unprotected edge fall near miss on a jobsite.",
    });
    expect(verdict.recommendation).toBe("likely_approvable");
    expect(verdict.approvedCount).toBeGreaterThanOrEqual(6);
    expect(verdict.rejectedCount).toBe(0);
    expect(verdict.score).toBeGreaterThan(0.66);
    expect(verdict.confidence).toBe("medium");
    expect(verdict.topMatches.length).toBeGreaterThan(0);
  });

  it("recommends likely_not_approvable when comparable history skews rejected", () => {
    const history: ApprovalHistoryRow[] = Array.from({ length: 6 }, (_, i) => ({
      decision: "rejected" as const,
      source_type: "sor",
      category: "observation",
      title: `Vague observation ${i}`,
      content: "Vague observation with no actionable detail or location.",
      rating: null,
    }));
    const verdict = scoreApprovability(history, {
      sourceType: "sor",
      category: "observation",
      content: "Vague observation lacking detail and location.",
    });
    expect(verdict.recommendation).toBe("likely_not_approvable");
    expect(verdict.score).toBeLessThan(0.34);
  });

  it("weights high-rated approvals more than low-rated ones", () => {
    const base = { decision: "approved" as const, source_type: "incident", category: "near_miss", content: "edge fall near miss", title: "x" };
    const query = { sourceType: "incident", category: "near_miss", content: "edge fall near miss" };
    const highRated = scoreApprovability(
      [{ ...base, rating: 5 }, { decision: "rejected", source_type: "incident", category: "near_miss", content: "edge fall near miss", title: "y", rating: null }],
      query
    );
    const lowRated = scoreApprovability(
      [{ ...base, rating: 1 }, { decision: "rejected", source_type: "incident", category: "near_miss", content: "edge fall near miss", title: "y", rating: null }],
      query
    );
    expect(highRated.score ?? 0).toBeGreaterThan(lowRated.score ?? 0);
  });
});
