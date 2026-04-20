import { describe, expect, it } from "vitest";
import { STEEL_ERECTION_HAZARD_MODULES } from "@/lib/steelErectionHazardModules.generated";
import { STEEL_ERECTION_PROGRAM_MODULES } from "@/lib/steelErectionProgramModules.generated";
import { STEEL_ERECTION_TASK_MODULES } from "@/lib/steelErectionTaskModules.generated";
import {
  getSteelErectionHazardModulesForCsepSelection,
} from "@/lib/steelErectionHazardModules";
import {
  getSteelErectionProgramModulesForCsepSelection,
} from "@/lib/steelErectionProgramModules";
import {
  getSteelErectionReferencePacksForPshsepSelection,
} from "@/lib/steelErectionReferencePacks";
import { getSteelErectionTaskModulesForCsepSelection } from "@/lib/steelErectionTaskModules";

describe("steel erection reference packs", () => {
  it("ships generated hazard, task, and program libraries for all steel source docs", () => {
    expect(STEEL_ERECTION_HAZARD_MODULES).toHaveLength(8);
    expect(STEEL_ERECTION_TASK_MODULES).toHaveLength(9);
    expect(STEEL_ERECTION_PROGRAM_MODULES).toHaveLength(10);

    expect(STEEL_ERECTION_HAZARD_MODULES[0]).toEqual(
      expect.objectContaining({
        title: "Fall Exposure",
        sourceFilename: "Hazard_01_Fall_Exposure.docx",
        sectionHeadings: expect.arrayContaining(["1. Risks & Hazards"]),
      })
    );
    expect(STEEL_ERECTION_TASK_MODULES[0]).toEqual(
      expect.objectContaining({
        title: "Pre-Erection Planning and Site Readiness",
        sourceFilename: "Task_01_Pre_Erection_Planning_and_Site_Readiness.docx",
        sectionHeadings: expect.arrayContaining(["1. Task Scope & Work Conditions"]),
      })
    );
    expect(STEEL_ERECTION_PROGRAM_MODULES[0]).toEqual(
      expect.objectContaining({
        title: "Leading Edge and Connector Work Program",
        sourceFilename: "01_Leading_Edge_and_Connector_Work_Program.docx",
        sectionHeadings: expect.arrayContaining(["1. Program Purpose and Applicability"]),
      })
    );
  });

  it("matches steel hazard, task, and program packs for CSEP steel selections", () => {
    const taskModules = getSteelErectionTaskModulesForCsepSelection({
      tradeLabel: "Structural Steel / Metals",
      subTradeLabel: "Steel erection / decking",
      taskNames: ["Column erection", "Decking install", "Welding"],
    });
    const hazardModules = getSteelErectionHazardModulesForCsepSelection({
      selectedHazards: ["Falls from height", "Falling object hazards", "Rigging and lifting hazards"],
      selectedPermits: ["Lift Plan"],
      taskNames: ["Column erection", "Decking install", "Welding"],
      tradeLabel: "Structural Steel / Metals",
      subTradeLabel: "Steel erection / decking",
    });
    const programModules = getSteelErectionProgramModulesForCsepSelection({
      programSelections: [
        {
          category: "hazard",
          item: "Falls from height",
          relatedTasks: ["Decking install"],
          source: "selected",
        },
        {
          category: "hazard",
          item: "Crane lift hazards",
          relatedTasks: ["Column erection"],
          source: "derived",
        },
      ],
      selectedHazards: ["Falls from height", "Falling objects", "Crane lift hazards"],
      selectedPermits: ["Lift Plan"],
      taskNames: ["Column erection", "Decking install", "Welding"],
      tradeLabel: "Structural Steel / Metals",
      subTradeLabel: "Steel erection / decking",
    });

    expect(taskModules.map((module) => module.moduleKey)).toEqual(
      expect.arrayContaining([
        "steel_setting_columns_and_base_lines",
        "steel_installing_metal_decking_and_controlling_openings",
        "steel_field_welding_cutting_and_shear_connectors",
      ])
    );
    expect(hazardModules.map((module) => module.moduleKey)).toEqual(
      expect.arrayContaining([
        "steel_fall_exposure",
        "steel_falling_objects_and_dropped_materials",
        "steel_hoisting_and_rigging",
      ])
    );
    expect(programModules.map((module) => module.moduleKey)).toEqual(
      expect.arrayContaining([
        "steel_leading_edge_and_connector_work_program",
        "steel_hoisting_and_rigging_program",
        "steel_controlled_decking_zone_and_decking_access_program",
      ])
    );
  });

  it("does not attach steel packs for non-steel CSEP selections", () => {
    expect(
      getSteelErectionTaskModulesForCsepSelection({
        tradeLabel: "Electrical",
        subTradeLabel: "Power distribution / feeders / branch power",
        taskNames: ["Conduit install"],
      })
    ).toEqual([]);
    expect(
      getSteelErectionHazardModulesForCsepSelection({
        selectedHazards: ["Electrical shock"],
        selectedPermits: ["LOTO Permit"],
        taskNames: ["Conduit install"],
        tradeLabel: "Electrical",
        subTradeLabel: "Power distribution / feeders / branch power",
      })
    ).toEqual([]);
  });

  it("matches steel packs for PSHSEP steel scope and high-risk selections", () => {
    const packs = getSteelErectionReferencePacksForPshsepSelection({
      scopeOfWorkSelected: ["Steel Erection"],
      highRiskFocusAreas: ["Steel erection / rigging", "Ladders / scaffolds / access"],
      assumedTradesIndex: ["Steel Erection"],
      exportProgramIds: ["steel_erection", "crane_rigging", "fall_protection"],
      programSelections: [
        {
          category: "hazard",
          item: "Crane lift hazards",
          relatedTasks: ["Steel Erection"],
          source: "derived",
        },
      ],
    });

    expect(packs.taskModules.length).toBeGreaterThan(0);
    expect(packs.hazardModules.map((module) => module.moduleKey)).toEqual(
      expect.arrayContaining(["steel_fall_exposure", "steel_hoisting_and_rigging"])
    );
    expect(packs.programModules.map((module) => module.moduleKey)).toEqual(
      expect.arrayContaining([
        "steel_leading_edge_and_connector_work_program",
        "steel_hoisting_and_rigging_program",
      ])
    );
  });
});
