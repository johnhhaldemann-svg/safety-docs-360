import { describe, expect, it } from "vitest";
import {
  buildLeadershipTrustMetadata,
  confidenceLabelFromPercent,
  coverageStatus,
  explainRecommendation,
  trustConfidenceFromCoverage,
} from "@/lib/leadershipTrust";

describe("leadership trust metadata", () => {
  it("labels confidence from percent bands", () => {
    expect(confidenceLabelFromPercent(90)).toBe("High");
    expect(confidenceLabelFromPercent(55)).toBe("Medium");
    expect(confidenceLabelFromPercent(12)).toBe("Low");
  });

  it("derives lower confidence when source coverage is sparse", () => {
    const percent = trustConfidenceFromCoverage({
      sourceCoverage: [
        { key: "incidents", label: "Incidents", count: 3, status: "connected" },
        { key: "permits", label: "Permits", count: 0, status: "missing" },
        { key: "jsas", label: "JSAs", count: 0, status: "missing" },
      ],
      missingSignals: ["No permits", "No JSAs"],
    });

    expect(percent).toBeLessThan(50);
  });

  it("builds missing signal messages and evidence defaults", () => {
    const trust = buildLeadershipTrustMetadata({
      dateWindowLabel: "Last 30 days",
      sourceCoverage: [
        { key: "correctives", label: "Correctives", count: 4, status: coverageStatus(4) },
        { key: "incidents", label: "Incidents", count: 0, status: coverageStatus(0) },
      ],
      executiveSummary: "Leadership summary",
      provenanceNote: "Company scoped sources.",
    });

    expect(trust.missingSignals).toEqual(["Incidents has no records in this window."]);
    expect(trust.confidenceLabel).toBe("Medium");
  });

  it("makes recommendations explainable without schema-only fields", () => {
    const recommendation = explainRecommendation({
      id: "rec-1",
      kind: "rule_based",
      title: "Review fall exposure",
      body: "Verify fall protection controls.",
      confidence: 0.82,
      created_at: "2026-05-04T12:00:00.000Z",
    });

    expect(recommendation.sourceModule).toBe("risk_memory");
    expect(recommendation.businessImpact).toContain("High confidence");
    expect(recommendation.actionHref).toBe("/analytics?tab=risk");
  });
});
