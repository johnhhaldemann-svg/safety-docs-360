import { describe, expect, it } from "vitest";
import { buildSafetyDomainUnderstanding } from "@/lib/safety-ai/domainUnderstanding";
import type { AiSafetyUnifiedContext } from "@/lib/aiSafetyUnifiedContext";

const unifiedContext: AiSafetyUnifiedContext = {
  generatedAt: "2026-05-25T12:00:00.000Z",
  sourceCoverage: [
    { sourceSystem: "predictive_risk", label: "Predictive Risk", evidenceCount: 1, conflictCount: 0, status: "available" },
    { sourceSystem: "safety_intelligence", label: "Safety Intelligence", evidenceCount: 1, conflictCount: 0, status: "available" },
    { sourceSystem: "gus_photo_review", label: "Gus field evidence", evidenceCount: 1, conflictCount: 0, status: "available" },
  ],
  evidence: [
    {
      id: "ev-1",
      sourceSystem: "predictive_risk",
      sourceModule: "daily_briefing.high_risk_work",
      sourceId: "work-1",
      label: "Roof edge layout",
      detail: "Elevated work with fall exposure and open edge controls needing verification.",
      riskLevel: "high",
      confidence: "medium",
      jobsiteId: "j1",
      trade: "roofing",
      area: "Level 4",
      date: "2026-05-25",
      evidenceRefs: [],
    },
    {
      id: "ev-2",
      sourceSystem: "safety_intelligence",
      sourceModule: "company_bucket_items",
      sourceId: "bucket-1",
      label: "Roof access bucket",
      detail: "Fall protection plan and rescue plan are required controls.",
      riskLevel: "high",
      confidence: "medium",
      jobsiteId: "j1",
      trade: "roofing",
      area: "Level 4",
      date: "2026-05-25",
      evidenceRefs: [],
    },
    {
      id: "ev-3",
      sourceSystem: "gus_photo_review",
      sourceModule: "gus_photo_review",
      sourceId: "field-1",
      label: "Field evidence needing verification",
      detail: "Photo concern: open roof edge appears exposed.",
      riskLevel: "high",
      confidence: "medium",
      jobsiteId: "j1",
      trade: null,
      area: null,
      date: null,
      evidenceRefs: [],
    },
  ],
  conflicts: [],
  missingInformation: ["anchor verification"],
  conflictingSignals: [],
  nextBestActions: [],
  confidence: "medium",
  doNotClaim: ["Do not approve work."],
};

describe("buildSafetyDomainUnderstanding", () => {
  it("recognizes safety disciplines and creates field verification questions", () => {
    const understanding = buildSafetyDomainUnderstanding({ unifiedContext });

    expect(understanding.recognizedDisciplines).toContain("fall_protection");
    expect(understanding.concepts[0]).toEqual(
      expect.objectContaining({
        id: "fall_protection",
        riskLevel: "high",
        basis: expect.arrayContaining(["predictive_evidence", "safety_intelligence", "field_evidence"]),
      }),
    );
    expect(understanding.permitAndPlanFocus).toEqual(expect.arrayContaining(["fall protection plan", "rescue plan"]));
    expect(understanding.fieldVerificationQuestions.join(" ")).toContain("fall edge");
    expect(understanding.controlHierarchyGaps.join(" ")).toContain("removed or work resequenced");
  });

  it("returns conservative missing-data output when no safety discipline is recognized", () => {
    const understanding = buildSafetyDomainUnderstanding({
      unifiedContext: { ...unifiedContext, evidence: [], sourceCoverage: [], missingInformation: [] },
    });

    expect(understanding.concepts).toEqual([]);
    expect(understanding.confidence).toBe("low");
    expect(understanding.missingInformation).toEqual(
      expect.arrayContaining(["No safety-domain concept was confidently recognized from the loaded evidence."]),
    );
  });
});
