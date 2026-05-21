import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveCsepTrainingProgram } from "@/lib/safety-intelligence/trainingProgram";
import { loadMergedTradeLibrary } from "@/lib/safety-intelligence/library";

vi.mock("@/lib/safety-intelligence/library", () => ({
  loadMergedTradeLibrary: vi.fn(),
}));

describe("deriveCsepTrainingProgram", () => {
  beforeEach(() => {
    vi.mocked(loadMergedTradeLibrary).mockReset();
  });

  it("merges task-template and rule training requirements without duplicate rows", async () => {
    vi.mocked(loadMergedTradeLibrary).mockResolvedValue([
      {
        code: "mechanical",
        name: "Mechanical",
        subTrades: [{ code: "hvac", name: "HVAC" }],
        taskTemplates: [
          {
            code: "install_rooftop_unit",
            name: "Install rooftop unit",
            trainingRequirements: ["nfpa70e"],
            equipmentUsed: [],
            workConditions: [],
            hazardFamilies: [],
            requiredControls: [],
            permitTriggers: [],
            weatherSensitivity: "medium",
          },
        ],
        equipmentUsed: [],
        workConditions: [],
        hazardFamilies: [],
        requiredControls: [],
        permitTriggers: [],
        trainingRequirements: ["hot_work_training"],
      },
    ] as any);

    const program = await deriveCsepTrainingProgram({
      supabase: {} as any,
      companyId: "company-1",
      generationContext: {
        project: { projectName: "Tower A" },
        scope: { trades: ["Mechanical"], subTrades: ["HVAC"], tasks: ["Install rooftop unit"], equipment: [] },
        operations: [
          {
            operationId: "op-1",
            tradeCode: "mechanical",
            tradeLabel: "Mechanical",
            subTradeCode: "hvac",
            subTradeLabel: "HVAC",
            taskCode: "install_rooftop_unit",
            taskTitle: "Install rooftop unit",
            equipmentUsed: [],
            workConditions: [],
            hazardHints: [],
            requiredControlHints: [],
            permitHints: [],
            ppeHints: [],
          },
        ],
        siteContext: { workConditions: [], siteRestrictions: [], simultaneousOperations: [] },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
        },
        legacyFormSnapshot: {},
      },
      rulesEvaluations: [
        {
          bucketKey: "bucket-1",
          operationId: "op-1",
          findings: [],
          permitTriggers: [],
          hazardFamilies: [],
          hazardCategories: [],
          ppeRequirements: [],
          equipmentChecks: [],
          weatherRestrictions: [],
          requiredControls: [],
          siteRestrictions: [],
          prohibitedEquipment: [],
          trainingRequirements: ["nfpa70e", "qualified_electrical_worker"],
          score: 1,
          band: "low",
          evaluationVersion: "test",
        },
      ],
    });

    expect(program.rows).toHaveLength(2);
    expect(program.rows.map((row) => row.trainingTitle)).toEqual([
      "NFPA 70E",
      "Qualified electrical worker",
    ]);
    expect(program.rows.find((row) => row.trainingCode === "nfpa70e")?.sourceLabels).toEqual(
      expect.arrayContaining(["Task template", "Rule evaluation"])
    );
    expect(program.summaryTrainingTitles).toEqual(["NFPA 70E", "Qualified electrical worker"]);
  });

  it("falls back to trade defaults when the matched task template has no training requirements", async () => {
    vi.mocked(loadMergedTradeLibrary).mockResolvedValue([
      {
        code: "electrical",
        name: "Electrical",
        subTrades: [{ code: "distribution", name: "Distribution" }],
        taskTemplates: [
          {
            code: "panel_install",
            name: "Panel install",
            trainingRequirements: [],
            equipmentUsed: [],
            workConditions: [],
            hazardFamilies: [],
            requiredControls: [],
            permitTriggers: [],
            weatherSensitivity: "medium",
          },
        ],
        equipmentUsed: [],
        workConditions: [],
        hazardFamilies: [],
        requiredControls: [],
        permitTriggers: [],
        trainingRequirements: ["qualified_electrical_worker"],
      },
    ] as any);

    const program = await deriveCsepTrainingProgram({
      supabase: {} as any,
      companyId: "company-1",
      generationContext: {
        project: { projectName: "Tower B" },
        scope: { trades: ["Electrical"], subTrades: ["Distribution"], tasks: ["Panel install"], equipment: [] },
        operations: [
          {
            operationId: "op-2",
            tradeCode: "electrical",
            tradeLabel: "Electrical",
            subTradeCode: "distribution",
            subTradeLabel: "Distribution",
            taskCode: "panel_install",
            taskTitle: "Panel install",
            equipmentUsed: [],
            workConditions: [],
            hazardHints: [],
            requiredControlHints: [],
            permitHints: [],
            ppeHints: [],
          },
        ],
        siteContext: { workConditions: [], siteRestrictions: [], simultaneousOperations: [] },
        documentProfile: {
          documentType: "csep",
          projectDeliveryType: "ground_up",
          source: "builder_submit",
        },
        legacyFormSnapshot: {},
      },
      rulesEvaluations: [],
    });

    expect(program.rows).toHaveLength(1);
    expect(program.rows[0]).toMatchObject({
      tradeLabel: "Electrical",
      subTradeLabel: "Distribution",
      taskTitle: "Panel install",
      trainingTitle: "Qualified electrical worker",
      whySource: "Trade default",
    });
  });
});
