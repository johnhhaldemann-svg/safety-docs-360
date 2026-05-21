import { describe, expect, it } from "vitest";
import {
  buildRiskActionEvidencePack,
  buildRuleBasedRiskActionDrafts,
  parseRiskActionDraftsFromModelText,
} from "@/lib/riskActionPlan";
import type { PredictiveRiskPayload } from "@/lib/predictiveRisk";
import type { RiskMemoryStructuredContext } from "@/lib/riskMemory/structuredContext";

function predictive(overrides?: Partial<PredictiveRiskPayload>): PredictiveRiskPayload {
  return {
    filters: { days: 30, jobsiteId: null, month: null },
    summary: {
      highRiskLocationCount: 0,
      predictedIncidents: 0,
      averageRiskScore: 0,
      confidencePercent: 0,
      riskSignalCount: 0,
    },
    locations: [],
    drivers: [],
    trend: [],
    actions: [],
    model: {
      version: "test",
      generatedAt: "2026-05-20T00:00:00.000Z",
      confidenceLabel: "Low",
      provenanceNote: "test",
      source: "company",
      predictionSource: "company",
      fallbackUsed: false,
      fallbackReason: null,
      confidenceLevel: "low",
      dataScope: "company_specific",
    },
    behaviorRisk: {
      behaviorRiskScore: 0,
      riskLevel: "Low",
      topDrivers: [],
      recommendedActions: [],
      sourceEvents: [],
      byTrade: [],
      bySupervisor: [],
    },
    leadershipTrust: {
      lastUpdatedAt: "2026-05-20T00:00:00.000Z",
      dateWindowLabel: "Last 30 days",
      confidenceLabel: "Low",
      confidencePercent: 0,
      sourceCoverage: [],
      missingSignals: [],
      evidenceRefs: [],
      nextActions: [],
      executiveSummary: "test",
      provenanceNote: "test",
    },
    ...overrides,
  };
}

function riskMemory(overrides?: Partial<RiskMemoryStructuredContext>): RiskMemoryStructuredContext {
  return {
    engine: "Safety360 Risk Memory Engine",
    windowDays: 30,
    facetCount: 12,
    topScopes: [{ code: "steel", count: 5 }],
    topHazards: [{ code: "fall", count: 4 }],
    topLocationGrids: [],
    topLocationAreas: [],
    openCorrectiveFacetHints: { openStyleStatuses: 2 },
    aggregated: { score: 10, band: "moderate", sampleSize: 12, baselineContribution: 2 },
    baselineHints: [],
    aggregatedWithBaseline: { score: 18, band: "high" },
    derivedRollupConfidence: 0.72,
    ...overrides,
  };
}

describe("riskActionPlan", () => {
  it("builds an empty evidence pack without inventing signals", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive(),
      riskMemory: null,
      memoryItems: [],
    });

    expect(pack.topDrivers).toEqual([]);
    expect(pack.topLocations).toEqual([]);
    expect(pack.riskMemory.facetCount).toBe(0);
    expect(pack.sourceCoverage.find((source) => source.key === "companyMemory")?.status).toBe("missing");
  });

  it("creates high-priority rule actions from high-signal evidence", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive({
        locations: [
          {
            id: "site-1",
            label: "North Tower",
            subtitle: null,
            riskScore: 82,
            trendDelta: 9,
            topDriver: "Fall protection",
            sourceCounts: { correctiveActions: 1, incidents: 1, permits: 0, jsaActivities: 0, scheduleItems: 1 },
          },
        ],
        drivers: [{ id: "fall", label: "Fall protection", percent: 56, count: 7 }],
      }),
      riskMemory: riskMemory(),
      memoryItems: [],
    });
    const drafts = buildRuleBasedRiskActionDrafts(pack);

    expect(drafts.length).toBeGreaterThanOrEqual(3);
    expect(drafts[0]?.priority).toBe("critical");
    expect(drafts.some((draft) => draft.targetModule === "risk_memory")).toBe(true);
  });

  it("rejects malformed LLM output", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive(),
      riskMemory: null,
    });

    expect(parseRiskActionDraftsFromModelText("not json", pack)).toEqual([]);
  });

  it("normalizes LLM drafts to supported targets and priorities", () => {
    const pack = buildRiskActionEvidencePack({
      days: 30,
      predictiveRisk: predictive(),
      riskMemory: null,
    });
    const drafts = parseRiskActionDraftsFromModelText(
      JSON.stringify([
        {
          kind: "bad_target",
          title: "Check controls",
          body: "Verify controls before release.",
          confidence: 2,
          priority: "urgent",
          targetModule: "unsupported",
        },
      ]),
      pack
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.confidence).toBe(0.95);
    expect(drafts[0]?.priority).toBe("medium");
    expect(drafts[0]?.targetModule).toBe("predictive_risk");
  });
});
