import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateDocumentDraft,
  generateSafetyPlanNarratives,
} from "@/lib/safety-intelligence/ai/documentGenerationService";

const { runStructuredAiJsonMock } = vi.hoisted(() => ({
  runStructuredAiJsonMock: vi.fn(
    async (params: { fallback: unknown; system: string }) => ({
      parsed: params.fallback,
      model: "test-model",
      promptHash: "prompt-hash",
      fallbackUsed: false,
    })
  ),
}));

vi.mock("@/lib/safety-intelligence/ai/utils", () => ({
  runStructuredAiJson: runStructuredAiJsonMock,
}));

vi.mock("@/lib/safety-intelligence/validation/ai", () => ({
  assertAiReviewContextReady: vi.fn(),
}));

describe("documentGenerationService prompts", () => {
  afterEach(() => {
    runStructuredAiJsonMock.mockClear();
  });

  it("includes full layout guidance in the document draft prompt", async () => {
    await generateDocumentDraft({
      documentType: "csep",
      title: "Test Draft",
      reviewContext: {
        companyId: "company-1",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
      },
    });

    const call = runStructuredAiJsonMock.mock.calls[0]?.[0];
    expect(call?.system).toContain("Customer-facing document layout expectations");
    expect(call?.system).toContain(
      "Document Summary, High-Risk Work Snapshot, Revision / Prepared By"
    );
    expect(call?.system).toContain(
      "group hazards, tasks, controls, and PPE by trade / subtrade package"
    );
    expect(call?.system).toContain("Customer-facing language only");
    expect(call?.system).toContain("Keep narrative fields concise and non-repetitive");
    expect(call?.system).toContain("Do not reuse the same sentence");
  });

  it("includes full layout guidance in the narrative prompt", async () => {
    await generateSafetyPlanNarratives({
      draft: {
        documentType: "csep",
        projectDeliveryType: "ground_up",
        title: "Test CSEP",
        projectOverview: {
          projectName: "Project",
        },
        operations: [],
        ruleSummary: {
          permitTriggers: [],
          ppeRequirements: [],
          requiredControls: [],
          hazardCategories: [],
          siteRestrictions: [],
          prohibitedEquipment: [],
          trainingRequirements: [],
          weatherRestrictions: [],
        },
        conflictSummary: {
          total: 0,
          intraDocument: 0,
          external: 0,
          highestSeverity: "none",
          items: [],
        },
        riskSummary: {
          score: 0,
          band: "low",
          priorities: [],
        },
        trainingProgram: {
          rows: [],
          summaryTrainingTitles: [],
        },
        narrativeSections: {},
        sectionMap: [],
        provenance: {},
      },
      reviewContext: {
        companyId: "company-1",
        buckets: [],
        rulesEvaluations: [],
        conflictEvaluations: [],
      },
    });

    const call = runStructuredAiJsonMock.mock.calls[0]?.[0];
    expect(call?.system).toContain("Customer-facing document layout expectations");
    expect(call?.system).toContain("short headings, structured tables, and clear section summaries");
    expect(call?.system).toContain("Do not surface raw risk scores in front matter");
    expect(call?.system).toContain("Do not repeat the same sentence or idea across fields");
    expect(call?.system).toContain("keep these narrative fields brief");
    expect(call?.system).toContain("final deciding factor for section emphasis");
    expect(call?.system).toContain("aiAssemblyDecisions");
  });
});
