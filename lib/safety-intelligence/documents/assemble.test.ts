import { describe, expect, it } from "vitest";
import { buildGeneratedSafetyPlanDraft } from "@/lib/safety-intelligence/documents/assemble";

describe("buildGeneratedSafetyPlanDraft", () => {
  it("assembles the required dynamic safety-plan sections", () => {
    const draft = buildGeneratedSafetyPlanDraft({
      generationContext: {
        project: {
          projectName: "Tower A",
          projectAddress: "100 Center St",
          ownerClient: "Owner",
          gcCm: "GC",
          contractorCompany: "Contractor",
        },
        scope: {
          trades: ["Mechanical"],
          subTrades: ["HVAC"],
          tasks: ["Install rooftop unit"],
          equipment: ["MEWP"],
          location: "Roof",
        },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "mechanical",
            tradeLabel: "Mechanical",
            subTradeCode: "hvac",
            subTradeLabel: "HVAC",
            taskCode: "install_rooftop_unit",
            taskTitle: "Install rooftop unit",
            description: "Set rooftop unit on curb",
            equipmentUsed: ["MEWP"],
            workConditions: ["Roof access"],
            hazardHints: ["fall"],
            requiredControlHints: ["fall_protection"],
            permitHints: ["elevated_work_notice"],
            ppeHints: ["Hard Hat"],
            workAreaLabel: "Roof",
            locationGrid: "R1",
            locationLabel: "Roof",
            weatherConditionCode: "wind",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            crewSize: 4,
            metadata: {},
          },
        ],
        siteContext: {
          location: "Roof",
          workConditions: ["Roof access"],
          siteRestrictions: ["No A-frame ladders."],
          simultaneousOperations: ["Electrical rough-in below"],
          weather: {
            conditionCode: "wind",
            summary: "High winds require elevated-work review.",
          },
        },
        programSelections: [
          {
            category: "hazard",
            item: "Falls from height",
            relatedTasks: ["Install rooftop unit"],
            source: "selected",
          },
          {
            category: "ppe",
            item: "Safety Glasses",
            relatedTasks: ["Install rooftop unit"],
            source: "selected",
          },
        ],
        documentProfile: {
          documentType: "csep",
          source: "builder_submit",
        },
        legacyFormSnapshot: {},
      },
      reviewContext: {
        companyId: "company-1",
        jobsiteId: "jobsite-1",
        documentType: "csep",
        buckets: [
          {
            bucketKey: "bucket-1",
            bucketType: "task_execution",
            companyId: "company-1",
            jobsiteId: "jobsite-1",
            operationId: "op-1",
            taskTitle: "Install rooftop unit",
            tradeCode: "mechanical",
            subTradeCode: "hvac",
            taskCode: "install_rooftop_unit",
            workAreaLabel: "Roof",
            locationGrid: "R1",
            startsAt: "2026-04-13T14:00:00.000Z",
            endsAt: "2026-04-13T17:00:00.000Z",
            weatherConditionCode: "wind",
            equipmentUsed: ["MEWP"],
            workConditions: ["Roof access"],
            siteRestrictions: ["No A-frame ladders."],
            prohibitedEquipment: ["a_frame_ladder"],
            hazardFamilies: ["fall"],
            permitTriggers: ["elevated_work_notice"],
            requiredControls: ["fall_protection"],
            ppeRequirements: ["Hard Hat"],
            trainingRequirementCodes: [],
            payload: {},
            source: {
              module: "manual",
              id: null,
            },
          },
        ],
        rulesEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            findings: [],
            permitTriggers: ["elevated_work_notice"],
            hazardFamilies: ["fall"],
            hazardCategories: ["Fall"],
            ppeRequirements: ["Hard Hat"],
            equipmentChecks: [],
            weatherRestrictions: ["high_wind_pause"],
            requiredControls: ["fall_protection"],
            siteRestrictions: ["No A-frame ladders."],
            prohibitedEquipment: ["a_frame_ladder"],
            trainingRequirements: [],
            score: 12,
            band: "moderate",
            evaluationVersion: "v2",
          },
        ],
        conflictEvaluations: [
          {
            bucketKey: "bucket-1",
            operationId: "op-1",
            conflicts: [],
            score: 5,
            band: "low",
          },
        ],
        riskMemorySummary: null,
      },
      conflictMatrix: {
        items: [
          {
            code: "overhead_hazard_propagation",
            type: "hazard_propagation",
            severity: "high",
            sourceScope: "intra_document",
            rationale: "Overhead work in the same area creates a downstream exposure for adjacent crews.",
            operationIds: ["op-1", "op-2"],
            relatedBucketKeys: ["bucket-1", "bucket-2"],
            requiredMitigations: ["drop_zone_control"],
            permitDependencies: ["elevated_work_notice"],
            resequencingSuggestion: "Run overhead work in an isolated window.",
          },
        ],
        score: 5,
        band: "moderate",
        intraDocumentConflictCount: 1,
        externalConflictCount: 0,
      },
      narrativeSections: {
        safetyNarrative: "Structured narrative.",
      },
      riskMemorySummary: null,
    });

    expect(draft.sectionMap.map((section) => section.key)).toEqual(
      expect.arrayContaining([
        "project_overview",
        "trade_risk_breakdown",
        "task_hazard_analysis",
        "permit_matrix",
        "simultaneous_operations",
        "equipment_conditions",
        "weather_integration",
        "required_controls",
        "risk_priority_summary",
        "safety_narrative",
        "program_hazard__falls_from_height__base",
        "program_ppe__safety_glasses__base",
      ])
    );
    expect(draft.ruleSummary.siteRestrictions).toContain("No A-frame ladders.");
    expect(draft.conflictSummary.total).toBe(1);
    expect(draft.narrativeSections.safetyNarrative).toBe("Structured narrative.");
    expect(
      draft.sectionMap.find((section) => section.key === "program_hazard__falls_from_height__base")
        ?.subsections
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Related Task Triggers",
          bullets: ["Install rooftop unit"],
        }),
      ])
    );
  });
});
